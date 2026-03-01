
CREATE OR REPLACE FUNCTION public.reward_on_new_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_new_count INT;
BEGIN
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  
  v_today := CURRENT_DATE;

  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'new_customers' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*) INTO v_new_count
    FROM public.customers
    WHERE created_by = NEW.created_by
      AND created_at::date = CURRENT_DATE;

    IF v_new_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = NEW.created_by AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.created_by, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'new_customers', 'تلقائي: ' || v_task.name);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reward_on_visit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_visit_count INT;
BEGIN
  v_today := CURRENT_DATE;
  
  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'visits' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*) INTO v_visit_count
    FROM public.visit_tracking
    WHERE worker_id = NEW.worker_id
      AND created_at::date = CURRENT_DATE;

    IF v_visit_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = NEW.worker_id AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'visits', 'تلقائي: ' || v_task.name);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reward_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_order_count INT;
  v_total_sales NUMERIC;
BEGIN
  IF NEW.status NOT IN ('delivered', 'completed', 'confirmed') THEN
    RETURN NEW;
  END IF;

  v_today := CURRENT_DATE;

  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'sales' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO v_order_count, v_total_sales
    FROM public.orders
    WHERE worker_id = NEW.worker_id
      AND created_at::date = CURRENT_DATE
      AND status IN ('delivered', 'completed', 'confirmed');

    IF (
      (v_task.condition_logic->>'min_amount' IS NOT NULL AND v_total_sales >= (v_task.condition_logic->>'min_amount')::numeric)
      OR
      (v_task.condition_logic->>'min_amount' IS NULL AND v_order_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1))
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = NEW.worker_id AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'sales', 'تلقائي: ' || v_task.name || ' (' || v_order_count || ' طلب)');
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reward_on_debt_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_today DATE;
  v_payment_count INT;
  v_total_collected NUMERIC;
BEGIN
  v_today := CURRENT_DATE;

  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'collections' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_payment_count, v_total_collected
    FROM public.debt_payments
    WHERE worker_id = NEW.worker_id
      AND collected_at::date = CURRENT_DATE;

    IF (
      (v_task.condition_logic->>'min_amount' IS NOT NULL AND v_total_collected >= (v_task.condition_logic->>'min_amount')::numeric)
      OR
      (v_task.condition_logic->>'min_amount' IS NULL AND v_payment_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1))
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = NEW.worker_id AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                (SELECT branch_id FROM public.workers WHERE id = NEW.worker_id),
                'collections', 'تلقائي: ' || v_task.name);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_automatic_penalty()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_penalty RECORD;
  v_worker_id uuid;
  v_branch_id uuid;
  v_trigger text;
  v_today DATE;
BEGIN
  v_trigger := TG_ARGV[0];
  v_today := CURRENT_DATE;

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
$function$;
