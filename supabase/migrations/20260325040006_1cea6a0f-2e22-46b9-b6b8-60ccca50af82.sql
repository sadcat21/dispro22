
DROP POLICY IF EXISTS "Admin/branch_admin can create stock receipt items" ON public.stock_receipt_items;

CREATE POLICY "Admin/branch_admin/warehouse can create stock receipt items"
ON public.stock_receipt_items FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() IN ('admin'::app_role, 'branch_admin'::app_role)
  OR has_custom_role('warehouse_manager')
);
