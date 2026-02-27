
-- Stock discrepancies tracking table (surplus/deficit per worker per product)
CREATE TABLE public.stock_discrepancies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid NOT NULL,
  product_id uuid NOT NULL,
  branch_id uuid,
  discrepancy_type text NOT NULL CHECK (discrepancy_type IN ('surplus', 'deficit')),
  quantity numeric NOT NULL DEFAULT 0,
  remaining_quantity numeric NOT NULL DEFAULT 0,
  price_per_unit numeric DEFAULT 0,
  total_value numeric DEFAULT 0,
  pricing_method text, -- 'invoice1_gros', 'invoice1_super_gros', 'invoice1_retail', 'invoice2', 'manual'
  source_session_id uuid, -- loading_session that created this
  accounting_session_id uuid, -- accounting_session where it was resolved
  status text NOT NULL DEFAULT 'pending', -- pending, resolved, added_to_stock
  resolved_by uuid,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_discrepancies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage stock_discrepancies"
  ON public.stock_discrepancies FOR ALL
  USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view their own discrepancies"
  ON public.stock_discrepancies FOR SELECT
  USING (worker_id = get_worker_id());

-- Indexes
CREATE INDEX idx_stock_discrepancies_worker ON public.stock_discrepancies(worker_id);
CREATE INDEX idx_stock_discrepancies_status ON public.stock_discrepancies(status);
CREATE INDEX idx_stock_discrepancies_product ON public.stock_discrepancies(product_id);

-- Update trigger
CREATE TRIGGER update_stock_discrepancies_updated_at
  BEFORE UPDATE ON public.stock_discrepancies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
