
-- Add salary and bonus fields to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS salary numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_cap_percentage numeric DEFAULT 20,
ADD COLUMN IF NOT EXISTS department text DEFAULT NULL;

-- Reward tasks (dynamic task builder)
CREATE TABLE public.reward_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_fr text,
  category text NOT NULL DEFAULT 'sales', -- sales, discipline, quality, collection
  data_source text NOT NULL DEFAULT 'visits', -- gps, visits, sales, collections, new_customers, attendance
  condition_logic jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_points numeric NOT NULL DEFAULT 0,
  penalty_points numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
  is_cumulative boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  branch_id uuid REFERENCES public.branches(id),
  created_by uuid REFERENCES public.workers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reward_tasks" ON public.reward_tasks
  FOR ALL USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view active reward_tasks" ON public.reward_tasks
  FOR SELECT USING (is_worker() AND is_active = true);

-- Penalty definitions (violations)
CREATE TABLE public.reward_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_fr text,
  penalty_points numeric NOT NULL DEFAULT 0,
  trigger_event text, -- cancel_visit, gps_deviation, late_arrival
  is_automatic boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  branch_id uuid REFERENCES public.branches(id),
  created_by uuid REFERENCES public.workers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reward_penalties" ON public.reward_penalties
  FOR ALL USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view active reward_penalties" ON public.reward_penalties
  FOR SELECT USING (is_worker() AND is_active = true);

-- Employee points log
CREATE TABLE public.employee_points_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  task_id uuid REFERENCES public.reward_tasks(id),
  penalty_id uuid REFERENCES public.reward_penalties(id),
  points numeric NOT NULL DEFAULT 0,
  point_type text NOT NULL DEFAULT 'reward', -- reward, penalty
  source_entity text, -- order, visit, debt_collection, etc.
  source_entity_id uuid,
  notes text,
  point_date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_points_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employee_points_log" ON public.employee_points_log
  FOR ALL USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view own points" ON public.employee_points_log
  FOR SELECT USING (worker_id = get_worker_id());

-- Monthly bonus summary
CREATE TABLE public.monthly_bonus_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  month date NOT NULL, -- first day of month
  total_points numeric NOT NULL DEFAULT 0,
  reward_points numeric NOT NULL DEFAULT 0,
  penalty_points numeric NOT NULL DEFAULT 0,
  point_value numeric, -- calculated: budget / total all workers points
  bonus_amount numeric DEFAULT 0,
  capped_amount numeric DEFAULT 0, -- after applying cap
  status text NOT NULL DEFAULT 'draft', -- draft, finalized
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(worker_id, month)
);

ALTER TABLE public.monthly_bonus_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage monthly_bonus_summary" ON public.monthly_bonus_summary
  FOR ALL USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view own bonus summary" ON public.monthly_bonus_summary
  FOR SELECT USING (worker_id = get_worker_id());

-- Reward settings (stored in app_settings, but let's add specific ones)
-- We'll use app_settings table with keys like:
-- reward_monthly_budget, reward_penalties_enabled, reward_absolute_cap
