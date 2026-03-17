
-- Insert new custom_roles
INSERT INTO public.custom_roles (code, name_ar, description_ar, is_system)
VALUES 
  ('project_manager', 'مدير المشروع', 'صلاحيات كاملة مثل مدير النظام', true),
  ('accountant', 'المحاسب', 'إدارة الحسابات والمالية', true),
  ('admin_assistant', 'عون إداري', 'مساعدة إدارية', true)
ON CONFLICT (code) DO NOTHING;

-- Give project_manager ALL permissions that admin has
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM public.custom_roles WHERE code = 'project_manager'),
  p.id
FROM public.permissions p
ON CONFLICT DO NOTHING;

-- Update helper functions to treat project_manager like admin
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'project_manager')
    )
$$;

CREATE OR REPLACE FUNCTION public.is_worker()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'worker', 'branch_admin', 'supervisor', 'project_manager', 'accountant', 'admin_assistant')
    )
$$;
