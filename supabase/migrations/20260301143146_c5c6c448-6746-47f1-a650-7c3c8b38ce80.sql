-- Fix pallet settings write permissions for workers within their own branch
DROP POLICY IF EXISTS "Admins can manage pallet_settings" ON public.pallet_settings;

CREATE POLICY "Workers can manage pallet_settings in own branch"
ON public.pallet_settings
FOR ALL
TO public
USING (
  is_admin()
  OR (is_worker() AND branch_id = get_worker_branch_id())
)
WITH CHECK (
  is_admin()
  OR (is_worker() AND branch_id = get_worker_branch_id())
);