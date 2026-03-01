
-- Trigger: عند تسجيل زيارة جديدة → احتساب نقاط تلقائي
CREATE OR REPLACE FUNCTION public.reward_on_visit()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
  v_today TEXT;
  v_visit_count INT;
BEGIN
  v_today := to_char(NOW(), 'YYYY-MM-DD');
  
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
        WHERE worker_id = NEW.worker_id
          AND task_id = v_task.id
          AND point_date = v_today
          AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (NEW.worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'visits', 'تلقائي: ' || v_task.name);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: عند إنشاء/تحديث طلب → احتساب نقاط المبيعات
CREATE OR REPLACE FUNCTION public.reward_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
  v_today TEXT;
  v_order_count INT;
  v_total_sales NUMERIC;
BEGIN
  IF NEW.status NOT IN ('delivered', 'completed', 'confirmed') THEN
    RETURN NEW;
  END IF;

  v_today := to_char(NOW(), 'YYYY-MM-DD');

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: عند تسجيل تحصيل دين → احتساب نقاط
CREATE OR REPLACE FUNCTION public.reward_on_debt_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
  v_today TEXT;
  v_payment_count INT;
  v_total_collected NUMERIC;
BEGIN
  v_today := to_char(NOW(), 'YYYY-MM-DD');

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: عند إضافة عميل جديد → احتساب نقاط
CREATE OR REPLACE FUNCTION public.reward_on_new_customer()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
  v_today TEXT;
  v_new_count INT;
BEGIN
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  
  v_today := to_char(NOW(), 'YYYY-MM-DD');

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the triggers
CREATE TRIGGER trg_reward_on_visit
  AFTER INSERT ON public.visit_tracking
  FOR EACH ROW EXECUTE FUNCTION public.reward_on_visit();

CREATE TRIGGER trg_reward_on_order
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reward_on_order();

CREATE TRIGGER trg_reward_on_debt_payment
  AFTER INSERT ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.reward_on_debt_payment();

CREATE TRIGGER trg_reward_on_new_customer
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.reward_on_new_customer();
