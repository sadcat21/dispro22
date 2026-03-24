
DROP POLICY "Admins can manage ui overrides" ON public.worker_ui_overrides;

CREATE POLICY "Admins can manage ui overrides"
ON public.worker_ui_overrides
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) 
  IN ('admin', 'project_manager', 'branch_admin', 'supervisor', 'accountant', 'admin_assistant', 'warehouse_manager')
)
WITH CHECK (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) 
  IN ('admin', 'project_manager', 'branch_admin', 'supervisor', 'accountant', 'admin_assistant', 'warehouse_manager')
);
