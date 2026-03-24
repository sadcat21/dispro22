-- Fix: Allow supervisors to view all visit_tracking records (same as admin)
-- This ensures "Today's Customers" shows correct visit data for supervisors
DROP POLICY IF EXISTS "Admins can view all visits" ON public.visit_tracking;
CREATE POLICY "Admins can view all visits"
  ON public.visit_tracking
  FOR SELECT
  USING (
    is_admin() OR is_branch_admin() OR (get_user_role() = 'supervisor'::app_role)
  );

-- Also allow supervisors to insert visits (for tracking worker coverage)
DROP POLICY IF EXISTS "Admins can insert visits" ON public.visit_tracking;
CREATE POLICY "Admins can insert visits"
  ON public.visit_tracking
  FOR INSERT
  WITH CHECK (
    is_admin() OR is_branch_admin() OR (get_user_role() = 'supervisor'::app_role)
  );