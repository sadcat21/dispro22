
-- Generic function to apply automatic penalties
CREATE OR REPLACE FUNCTION public.apply_automatic_penalty()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_penalty RECORD;
  v_worker_id uuid;
  v_branch_id uuid;
  v_trigger text;
  v_today text;
BEGIN
  v_trigger := TG_ARGV[0];
  v_today := to_char(NOW(), 'YYYY-MM-DD');

  -- Determine worker_id and branch_id based on source table
  CASE TG_TABLE_NAME
    WHEN 'orders' THEN
      v_worker_id := COALESCE(NEW.assigned_worker_id, NEW.created_by);
      v_branch_id := NEW.branch_id;
    WHEN 'visit_tracking' THEN
      v_worker_id := NEW.worker_id;
      v_branch_id := NEW.branch_id;
    WHEN 'accounting_session_items' THEN
      SELECT s.worker_id, s.branch_id INTO v_worker_id, v_branch_id
      FROM public.accounting_sessions s WHERE s.id = NEW.session_id;
    WHEN 'customer_debts' THEN
      v_worker_id := NEW.worker_id;
      v_branch_id := NEW.branch_id;
    WHEN 'debt_collections' THEN
      v_worker_id := NEW.worker_id;
      v_branch_id := (SELECT cd.branch_id FROM public.customer_debts cd WHERE cd.id = NEW.debt_id);
    ELSE
      RETURN NEW;
  END CASE;

  IF v_worker_id IS NULL THEN RETURN NEW; END IF;

  FOR v_penalty IN
    SELECT * FROM public.reward_penalties
    WHERE is_active = true
      AND is_automatic = true
      AND trigger_event = v_trigger
      AND (branch_id IS NULL OR branch_id = v_branch_id)
  LOOP
    -- Avoid duplicate penalty for same worker/penalty/day
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_points_log
      WHERE worker_id = v_worker_id
        AND penalty_id = v_penalty.id
        AND point_date = v_today
        AND point_type = 'penalty'
        AND source_entity_id = NEW.id
    ) THEN
      INSERT INTO public.employee_points_log
        (worker_id, penalty_id, points, point_type, point_date, branch_id, source_entity, source_entity_id, notes)
      VALUES
        (v_worker_id, v_penalty.id, v_penalty.penalty_points, 'penalty', v_today, v_branch_id,
         TG_TABLE_NAME, NEW.id, 'عقوبة تلقائية: ' || v_penalty.name);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 1. cancel_visit: when an order is cancelled
CREATE OR REPLACE TRIGGER penalty_on_order_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION public.apply_automatic_penalty('cancel_visit');

-- 2. missing_delivery: when order delivery fails
CREATE OR REPLACE TRIGGER penalty_on_missing_delivery
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'failed' AND OLD.status != 'failed')
  EXECUTE FUNCTION public.apply_automatic_penalty('missing_delivery');

-- 3. cash_discrepancy: when accounting item has negative difference
CREATE OR REPLACE TRIGGER penalty_on_cash_discrepancy
  AFTER INSERT ON public.accounting_session_items
  FOR EACH ROW
  WHEN (NEW.difference IS NOT NULL AND NEW.difference < 0)
  EXECUTE FUNCTION public.apply_automatic_penalty('cash_discrepancy');

-- 4. debt_overdue: when debt status changes to overdue
CREATE OR REPLACE TRIGGER penalty_on_debt_overdue
  AFTER UPDATE OF status ON public.customer_debts
  FOR EACH ROW
  WHEN (NEW.status = 'overdue' AND OLD.status != 'overdue')
  EXECUTE FUNCTION public.apply_automatic_penalty('debt_overdue');

-- 5. document_missing: when visit has no_collection action
CREATE OR REPLACE TRIGGER penalty_on_doc_no_collection
  AFTER INSERT ON public.debt_collections
  FOR EACH ROW
  WHEN (NEW.action = 'no_payment')
  EXECUTE FUNCTION public.apply_automatic_penalty('document_missing');
