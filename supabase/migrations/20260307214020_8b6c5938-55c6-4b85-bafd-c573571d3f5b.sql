
-- Table to assign workers to supervisors
CREATE TABLE public.supervisor_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  UNIQUE(supervisor_id, worker_id)
);

ALTER TABLE public.supervisor_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supervisor_workers"
  ON public.supervisor_workers
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_branch_admin())
  WITH CHECK (public.is_admin() OR public.is_branch_admin());

CREATE POLICY "Supervisors can view their assignments"
  ON public.supervisor_workers
  FOR SELECT
  TO authenticated
  USING (supervisor_id = public.get_worker_id());

CREATE POLICY "Workers can view if assigned"
  ON public.supervisor_workers
  FOR SELECT
  TO authenticated
  USING (worker_id = public.get_worker_id());
