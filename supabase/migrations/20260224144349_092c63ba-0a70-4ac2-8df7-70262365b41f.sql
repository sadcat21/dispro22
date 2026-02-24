-- Insert bypass_location_check permission
INSERT INTO public.permissions (code, name_ar, description_ar, category, resource)
VALUES ('bypass_location_check', 'تجاوز التحقق من الموقع', 'يسمح للعامل بتمرير الطلبيات خارج موقع العميل', 'data_scope', 'orders')
ON CONFLICT DO NOTHING;