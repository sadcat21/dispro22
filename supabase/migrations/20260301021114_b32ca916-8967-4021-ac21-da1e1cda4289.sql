
-- =============================================
-- مهام المكافآت الافتراضية
-- =============================================
INSERT INTO public.reward_tasks (name, category, data_source, condition_logic, reward_points, penalty_points, frequency, is_cumulative, is_active) VALUES
-- المبيعات
('تحقيق 10 طلبيات يومياً', 'sales', 'sales', '{"min_count": 10}', 5, 0, 'daily', false, true),
('تحقيق 20 طلبية يومياً', 'sales', 'sales', '{"min_count": 20}', 10, 0, 'daily', false, true),
('مبيعات يومية 50,000 دج', 'sales', 'sales', '{"min_amount": 50000}', 8, 0, 'daily', false, true),
('مبيعات يومية 100,000 دج', 'sales', 'sales', '{"min_amount": 100000}', 15, 0, 'daily', false, true),
('تسجيل عميل جديد', 'sales', 'new_customers', '{"min_count": 1}', 3, 0, 'daily', false, true),
('تسجيل 3 عملاء جدد يومياً', 'sales', 'new_customers', '{"min_count": 3}', 10, 0, 'daily', false, true),
-- الانضباط
('إتمام 15 زيارة يومياً', 'discipline', 'visits', '{"min_count": 15}', 5, 0, 'daily', false, true),
('إتمام 25 زيارة يومياً', 'discipline', 'visits', '{"min_count": 25}', 10, 0, 'daily', false, true),
-- التحصيل
('تحصيل 3 ديون يومياً', 'collection', 'collections', '{"min_count": 3}', 5, 0, 'daily', false, true),
('تحصيل 5 ديون يومياً', 'collection', 'collections', '{"min_count": 5}', 10, 0, 'daily', false, true),
('تحصيل 30,000 دج يومياً', 'collection', 'collections', '{"min_amount": 30000}', 8, 0, 'daily', false, true),
('تحصيل 50,000 دج يومياً', 'collection', 'collections', '{"min_amount": 50000}', 15, 0, 'daily', false, true);

-- =============================================
-- العقوبات والمخالفات الافتراضية
-- =============================================
INSERT INTO public.reward_penalties (name, penalty_points, trigger_event, is_automatic, is_active) VALUES
-- المبيعات
('إلغاء طلبية', 3, 'cancel_visit', true, true),
('فشل التسليم', 5, 'missing_delivery', true, true),
('إرجاع منتج بسبب الموظف', 4, 'product_return', true, true),
('خصم غير مصرح', 7, 'unauthorized_discount', false, true),
('خطأ في الفاتورة', 3, 'wrong_invoice', false, true),
-- التحصيل
('تأخر تحصيل دين', 5, 'debt_overdue', true, true),
('عدم جمع مستند', 3, 'document_missing', true, true),
-- الانضباط
('تأخير عن الموعد', 3, 'late_arrival', false, true),
('غياب بدون إذن', 10, 'absence', false, true),
('مغادرة مبكرة', 3, 'early_leave', false, true),
('انحراف عن المسار GPS', 5, 'gps_deviation', false, true),
('عدم الرد على الهاتف', 2, 'phone_unreachable', false, true),
-- المالية
('فرق في النقد', 8, 'cash_discrepancy', true, true),
('نقص في المخزون', 7, 'stock_shortage', true, true),
-- الجودة
('شكوى مؤكدة من عميل', 10, 'confirmed_complaint', false, true),
('فقدان عميل', 8, 'customer_loss', false, true),
-- السلامة
('قيادة غير آمنة', 10, 'unsafe_driving', false, true),
('ضرر في الشاحنة', 15, 'truck_damage', false, true),
-- عام
('مخالفة سياسة الشركة', 5, 'policy_violation', false, true);
