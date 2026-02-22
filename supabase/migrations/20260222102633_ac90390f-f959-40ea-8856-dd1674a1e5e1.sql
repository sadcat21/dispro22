
-- جدول الوصولات/الفواتير
CREATE TABLE public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number serial NOT NULL,
  receipt_type text NOT NULL DEFAULT 'delivery', -- 'direct_sale', 'delivery', 'debt_payment'
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  debt_id uuid REFERENCES public.customer_debts(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  branch_id uuid REFERENCES public.branches(id),
  
  -- بيانات العميل (نسخة مجمدة)
  customer_name text NOT NULL,
  customer_phone text,
  worker_name text NOT NULL,
  worker_phone text,
  
  -- تفاصيل المنتجات (JSON مجمد)
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- المعلومات المالية
  total_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  
  -- عدد مرات الطباعة
  print_count integer NOT NULL DEFAULT 0,
  last_printed_at timestamp with time zone,
  
  -- حالة التعديل
  is_modified boolean NOT NULL DEFAULT false,
  original_data jsonb, -- النسخة الأصلية قبل التعديل
  
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- فهرس للبحث السريع
CREATE INDEX idx_receipts_created_at ON public.receipts(created_at DESC);
CREATE INDEX idx_receipts_worker_id ON public.receipts(worker_id);
CREATE INDEX idx_receipts_customer_id ON public.receipts(customer_id);
CREATE INDEX idx_receipts_receipt_type ON public.receipts(receipt_type);
CREATE INDEX idx_receipts_order_id ON public.receipts(order_id);
CREATE INDEX idx_receipts_branch_id ON public.receipts(branch_id);

-- RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on receipts"
  ON public.receipts FOR ALL
  USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view receipts"
  ON public.receipts FOR SELECT
  USING (is_worker());

CREATE POLICY "Workers can insert receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (is_worker() AND worker_id = get_worker_id());

CREATE POLICY "Workers can update own receipts"
  ON public.receipts FOR UPDATE
  USING (worker_id = get_worker_id());

-- جدول سجل التعديلات
CREATE TABLE public.receipt_modifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  modified_by uuid NOT NULL REFERENCES public.workers(id),
  modification_type text NOT NULL DEFAULT 'edit', -- 'edit', 'cancel'
  original_data jsonb NOT NULL,
  modified_data jsonb NOT NULL,
  changes_summary text, -- وصف مختصر للتغييرات
  is_reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.workers(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipt_modifications_receipt_id ON public.receipt_modifications(receipt_id);
CREATE INDEX idx_receipt_modifications_is_reviewed ON public.receipt_modifications(is_reviewed);

ALTER TABLE public.receipt_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on receipt_modifications"
  ON public.receipt_modifications FOR ALL
  USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view modifications"
  ON public.receipt_modifications FOR SELECT
  USING (is_worker());

CREATE POLICY "Workers can insert modifications"
  ON public.receipt_modifications FOR INSERT
  WITH CHECK (is_worker() AND modified_by = get_worker_id());

-- Trigger لتحديث updated_at
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
