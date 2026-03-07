
-- Warehouse review sessions
CREATE TABLE public.warehouse_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  reviewer_id UUID NOT NULL REFERENCES public.workers(id),
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  include_damaged BOOLEAN DEFAULT false,
  include_pallets BOOLEAN DEFAULT false,
  total_products INTEGER DEFAULT 0,
  total_discrepancies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Warehouse review items
CREATE TABLE public.warehouse_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.warehouse_review_sessions(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'product', -- 'product', 'damaged', 'pallet'
  product_id UUID REFERENCES public.products(id),
  expected_quantity NUMERIC NOT NULL DEFAULT 0,
  actual_quantity NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,
  status TEXT NOT NULL DEFAULT 'matched', -- 'matched', 'surplus', 'deficit'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.warehouse_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can manage warehouse reviews" ON public.warehouse_review_sessions
  FOR ALL TO authenticated USING (public.is_worker()) WITH CHECK (public.is_worker());

CREATE POLICY "Workers can manage warehouse review items" ON public.warehouse_review_items
  FOR ALL TO authenticated USING (public.is_worker()) WITH CHECK (public.is_worker());

-- Indexes
CREATE INDEX idx_warehouse_review_sessions_branch ON public.warehouse_review_sessions(branch_id);
CREATE INDEX idx_warehouse_review_items_session ON public.warehouse_review_items(session_id);
