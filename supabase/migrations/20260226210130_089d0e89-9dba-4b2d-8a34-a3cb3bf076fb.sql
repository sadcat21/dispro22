-- Allow admins to delete promos
CREATE POLICY "Admins can delete promos"
ON public.promos FOR DELETE
USING (is_admin() OR is_branch_admin());

-- Allow admins to delete stock_movements
CREATE POLICY "Admins can delete stock_movements"
ON public.stock_movements FOR DELETE
USING (is_admin() OR is_branch_admin());

-- Allow admins to delete activity_logs
CREATE POLICY "Admins can delete activity_logs"
ON public.activity_logs FOR DELETE
USING (is_admin() OR is_branch_admin());