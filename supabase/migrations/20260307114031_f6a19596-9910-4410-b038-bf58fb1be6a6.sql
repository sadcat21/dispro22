
CREATE TABLE public.sector_schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  worker_type text NOT NULL CHECK (worker_type IN ('delivery', 'sales')),
  original_day text NOT NULL,
  new_day text NOT NULL,
  week_start date NOT NULL,
  is_permanent boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.workers(id),
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sector_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view overrides" ON public.sector_schedule_overrides
  FOR SELECT TO authenticated USING (public.is_worker());

CREATE POLICY "Admins can manage overrides" ON public.sector_schedule_overrides
  FOR ALL TO authenticated USING (public.is_admin() OR public.is_branch_admin());
