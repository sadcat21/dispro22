CREATE OR REPLACE FUNCTION public.confirm_loading_session_atomic(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_worker_id uuid;
  v_session public.loading_sessions%ROWTYPE;
  v_item RECORD;
  v_warehouse_row RECORD;
  v_worker_row RECORD;
  v_pieces_per_box numeric;
  v_item_qty_rounded numeric;
  v_item_boxes numeric;
  v_item_piece_part numeric;
  v_gift_pieces numeric;
  v_total_load_pieces numeric;
  v_new_warehouse_pieces numeric;
  v_new_worker_pieces numeric;
BEGIN
  v_actor_worker_id := public.get_worker_id();

  IF v_actor_worker_id IS NULL THEN
    RAISE EXCEPTION 'No active worker session';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.is_branch_admin()
    OR public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to confirm loading sessions';
  END IF;

  SELECT *
  INTO v_session
  FROM public.loading_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loading session not found';
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'session_id', v_session.id,
      'status', v_session.status
    );
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Loading session is not open';
  END IF;

  IF v_session.branch_id IS NULL THEN
    RAISE EXCEPTION 'Loading session branch is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.loading_session_items
    WHERE session_id = p_session_id
  ) THEN
    RAISE EXCEPTION 'Loading session has no items';
  END IF;

  FOR v_item IN
    SELECT
      lsi.*,
      p.name AS product_name,
      COALESCE(p.pieces_per_box, 20) AS pieces_per_box
    FROM public.loading_session_items lsi
    JOIN public.products p ON p.id = lsi.product_id
    WHERE lsi.session_id = p_session_id
    ORDER BY lsi.created_at, lsi.id
  LOOP
    v_pieces_per_box := COALESCE(v_item.pieces_per_box, 20);
    v_item_qty_rounded := ROUND(COALESCE(v_item.quantity, 0)::numeric, 2);
    v_item_boxes := FLOOR(v_item_qty_rounded);
    v_item_piece_part := ROUND((v_item_qty_rounded - v_item_boxes) * 100);
    v_gift_pieces := CASE
      WHEN COALESCE(v_item.gift_unit, 'piece') = 'box' THEN COALESCE(v_item.gift_quantity, 0)::numeric * v_pieces_per_box
      ELSE COALESCE(v_item.gift_quantity, 0)::numeric
    END;

    v_total_load_pieces := (v_item_boxes * v_pieces_per_box) + v_item_piece_part + v_gift_pieces;

    SELECT
      ws.id,
      ws.quantity,
      (
        FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box +
        ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_warehouse_row
    FROM public.warehouse_stock ws
    WHERE ws.branch_id = v_session.branch_id
      AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_warehouse_row.total_pieces < v_total_load_pieces THEN
      RAISE EXCEPTION 'Insufficient warehouse stock for %', COALESCE(v_item.product_name, v_item.product_id::text);
    END IF;

    v_new_warehouse_pieces := v_warehouse_row.total_pieces - v_total_load_pieces;

    UPDATE public.warehouse_stock
    SET
      quantity = FLOOR(v_new_warehouse_pieces / v_pieces_per_box) + MOD(v_new_warehouse_pieces, v_pieces_per_box) / 100.0,
      updated_at = now()
    WHERE id = v_warehouse_row.id;

    SELECT
      ws.id,
      ws.quantity,
      (
        FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box +
        ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_worker_row
    FROM public.worker_stock ws
    WHERE ws.worker_id = v_session.worker_id
      AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_worker_pieces := v_worker_row.total_pieces + v_total_load_pieces;

      UPDATE public.worker_stock
      SET
        quantity = FLOOR(v_new_worker_pieces / v_pieces_per_box) + MOD(v_new_worker_pieces, v_pieces_per_box) / 100.0,
        updated_at = now()
      WHERE id = v_worker_row.id;
    ELSE
      INSERT INTO public.worker_stock (
        worker_id,
        product_id,
        branch_id,
        quantity,
        updated_at
      )
      VALUES (
        v_session.worker_id,
        v_item.product_id,
        v_session.branch_id,
        FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0,
        now()
      );
    END IF;

    INSERT INTO public.stock_movements (
      product_id,
      branch_id,
      quantity,
      movement_type,
      status,
      created_by,
      worker_id,
      notes
    )
    VALUES (
      v_item.product_id,
      v_session.branch_id,
      FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0,
      'load',
      'approved',
      v_actor_worker_id,
      v_session.worker_id,
      'شحن من جلسة - ' || COALESCE(v_item.product_name, '')
    );
  END LOOP;

  UPDATE public.loading_sessions
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = p_session_id
    AND status = 'open';

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'session_id', v_session.id,
    'status', 'completed'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirm_loading_session_atomic(uuid) TO authenticated;
