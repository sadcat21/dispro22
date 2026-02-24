
-- Create worker_permissions table for individual worker permission overrides
CREATE TABLE public.worker_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.workers(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(worker_id, permission_id)
);

-- Enable RLS
ALTER TABLE public.worker_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage worker_permissions"
ON public.worker_permissions
FOR ALL
USING (is_admin() OR is_branch_admin())
WITH CHECK (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view own permissions"
ON public.worker_permissions
FOR SELECT
USING (worker_id = get_worker_id());

-- Update get_worker_permissions function to also include individual worker permissions
CREATE OR REPLACE FUNCTION public.get_worker_permissions(p_worker_id uuid)
RETURNS TABLE(permission_code text, permission_name text, category text, resource text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    -- Role-based permissions
    SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
    FROM public.worker_roles wr
    JOIN public.role_permissions rp ON rp.role_id = wr.custom_role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE wr.worker_id = p_worker_id
    
    UNION
    
    -- Individual worker permissions
    SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
    FROM public.worker_permissions wp
    JOIN public.permissions p ON p.id = wp.permission_id
    WHERE wp.worker_id = p_worker_id
$$;
