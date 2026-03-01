
-- Fix reward_on_order trigger function to use correct column names
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
  v_worker_id uuid;
BEGIN
  IF NEW.status NOT IN ('delivered', 'completed', 'confirmed') THEN
    RETURN NEW;
  END IF;

  -- Use assigned_worker_id or created_by as the worker
  v_worker_id := COALESCE(NEW.assigned_worker_id, NEW.created_by);
  IF v_worker_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_today := CURRENT_DATE;

  FOR v_task IN
    SELECT * FROM public.reward_tasks
    WHERE is_active = true AND data_source = 'sales' AND frequency = 'daily'
  LOOP
    SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO v_order_count, v_total_sales
    FROM public.orders
    WHERE COALESCE(assigned_worker_id, created_by) = v_worker_id
      AND created_at::date = CURRENT_DATE
      AND status IN ('delivered', 'completed', 'confirmed');

    IF (
      (v_task.condition_logic->>'min_amount' IS NOT NULL AND v_total_sales >= (v_task.condition_logic->>'min_amount')::numeric)
      OR
      (v_task.condition_logic->>'min_amount' IS NULL AND v_order_count >= COALESCE((v_task.condition_logic->>'min_count')::int, 1))
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.employee_points_log
        WHERE worker_id = v_worker_id AND task_id = v_task.id AND point_date = v_today AND point_type = 'reward'
      ) THEN
        INSERT INTO public.employee_points_log (worker_id, task_id, points, point_type, point_date, branch_id, source_entity, notes)
        VALUES (v_worker_id, v_task.id, v_task.reward_points, 'reward', v_today,
                NEW.branch_id, 'sales', 'تلقائي: ' || v_task.name || ' (' || v_order_count || ' طلب)');
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Now fix the 3 broken orders
UPDATE public.orders 
SET status = 'delivered', 
    payment_status = 'cash',
    updated_at = now()
WHERE id IN (
  'dc365e5a-518f-4a25-b075-cba584daf5f2',
  '5d003b5d-50e8-4ff0-a092-1757b83c97ba',
  '804eb38e-7ba3-4b8d-af47-92e85ba6f8a2'
)
AND status = 'in_progress';
