
-- Fix loading_session_items RLS for warehouse_manager and supervisor
DROP POLICY IF EXISTS "Admins can manage loading_session_items" ON public.loading_session_items;

CREATE POLICY "Admins and managers can manage loading_session_items"
ON public.loading_session_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM loading_sessions s
    WHERE s.id = loading_session_items.session_id
    AND (is_admin() OR is_branch_admin() OR get_user_role() IN ('warehouse_manager', 'supervisor'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM loading_sessions s
    WHERE s.id = loading_session_items.session_id
    AND (is_admin() OR is_branch_admin() OR get_user_role() IN ('warehouse_manager', 'supervisor'))
  )
);
