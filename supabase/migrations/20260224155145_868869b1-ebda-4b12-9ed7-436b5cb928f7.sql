
-- Fix: link admin worker_roles record to the admin custom_role
UPDATE public.worker_roles 
SET custom_role_id = cr.id
FROM public.custom_roles cr
WHERE worker_roles.custom_role_id IS NULL
AND cr.code = worker_roles.role::text;

-- Update get_worker_permissions to also handle role matching by role column
CREATE OR REPLACE FUNCTION public.get_worker_permissions(p_worker_id uuid)
 RETURNS TABLE(permission_code text, permission_name text, category text, resource text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    -- Get role-based permissions MINUS individually denied ones
    SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
    FROM public.worker_roles wr
    LEFT JOIN public.custom_roles cr_direct ON cr_direct.id = wr.custom_role_id
    LEFT JOIN public.custom_roles cr_by_role ON cr_by_role.code = wr.role::text AND wr.custom_role_id IS NULL
    JOIN public.role_permissions rp ON rp.role_id = COALESCE(cr_direct.id, cr_by_role.id)
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE wr.worker_id = p_worker_id
    AND NOT EXISTS (
        SELECT 1 FROM public.worker_permissions wp
        WHERE wp.worker_id = p_worker_id
        AND wp.permission_id = p.id
        AND wp.granted = false
    )
    
    UNION
    
    -- Individual worker permissions that are explicitly granted
    SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
    FROM public.worker_permissions wp
    JOIN public.permissions p ON p.id = wp.permission_id
    WHERE wp.worker_id = p_worker_id
    AND wp.granted = true
$function$;

-- Also update worker_has_permission to handle the same case
CREATE OR REPLACE FUNCTION public.worker_has_permission(p_worker_id uuid, p_permission_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM public.worker_permissions wp
            JOIN public.permissions p ON p.id = wp.permission_id
            WHERE wp.worker_id = p_worker_id AND p.code = p_permission_code
        ) THEN (
            SELECT wp.granted FROM public.worker_permissions wp
            JOIN public.permissions p ON p.id = wp.permission_id
            WHERE wp.worker_id = p_worker_id AND p.code = p_permission_code
            LIMIT 1
        )
        ELSE EXISTS (
            SELECT 1 
            FROM public.worker_roles wr
            LEFT JOIN public.custom_roles cr_direct ON cr_direct.id = wr.custom_role_id
            LEFT JOIN public.custom_roles cr_by_role ON cr_by_role.code = wr.role::text AND wr.custom_role_id IS NULL
            JOIN public.role_permissions rp ON rp.role_id = COALESCE(cr_direct.id, cr_by_role.id)
            JOIN public.permissions p ON p.id = rp.permission_id
            WHERE wr.worker_id = p_worker_id AND p.code = p_permission_code
        )
    END
$function$;
