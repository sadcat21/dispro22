-- 1) Enforce server-side sync: review session items must update worker_stock
CREATE OR REPLACE FUNCTION public.sync_worker_stock_from_review_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
  v_branch_id uuid;
  v_is_review boolean;
BEGIN
  SELECT s.worker_id, s.branch_id, (s.status = 'review')
  INTO v_worker_id, v_branch_id, v_is_review
  FROM public.loading_sessions s
  WHERE s.id = NEW.session_id;

  IF NOT COALESCE(v_is_review, false) THEN
    RETURN NEW;
  END IF;

  UPDATE public.worker_stock
  SET quantity = COALESCE(NEW.quantity, 0),
      updated_at = now()
  WHERE worker_id = v_worker_id
    AND product_id = NEW.product_id;

  IF NOT FOUND THEN
    INSERT INTO public.worker_stock (worker_id, product_id, quantity, branch_id, updated_at)
    VALUES (v_worker_id, NEW.product_id, COALESCE(NEW.quantity, 0), v_branch_id, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_review_item_worker_stock ON public.loading_session_items;

CREATE TRIGGER trg_sync_review_item_worker_stock
AFTER INSERT OR UPDATE OF quantity
ON public.loading_session_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_worker_stock_from_review_item();

-- 2) Backfill existing inconsistent balances from latest review per worker/product
WITH latest_review_item AS (
  SELECT DISTINCT ON (s.worker_id, i.product_id)
    s.worker_id,
    i.product_id,
    COALESCE(i.quantity, 0) AS quantity,
    s.branch_id
  FROM public.loading_sessions s
  JOIN public.loading_session_items i ON i.session_id = s.id
  WHERE s.status = 'review'
  ORDER BY s.worker_id, i.product_id, s.created_at DESC, i.created_at DESC
)
UPDATE public.worker_stock ws
SET quantity = lri.quantity,
    updated_at = now()
FROM latest_review_item lri
WHERE ws.worker_id = lri.worker_id
  AND ws.product_id = lri.product_id;

WITH latest_review_item AS (
  SELECT DISTINCT ON (s.worker_id, i.product_id)
    s.worker_id,
    i.product_id,
    COALESCE(i.quantity, 0) AS quantity,
    s.branch_id
  FROM public.loading_sessions s
  JOIN public.loading_session_items i ON i.session_id = s.id
  WHERE s.status = 'review'
  ORDER BY s.worker_id, i.product_id, s.created_at DESC, i.created_at DESC
)
INSERT INTO public.worker_stock (worker_id, product_id, quantity, branch_id, updated_at)
SELECT lri.worker_id, lri.product_id, lri.quantity, lri.branch_id, now()
FROM latest_review_item lri
LEFT JOIN public.worker_stock ws
  ON ws.worker_id = lri.worker_id
 AND ws.product_id = lri.product_id
WHERE ws.id IS NULL;