
-- Table to track individual items (checks, versements, virements) included in each handover
CREATE TABLE public.handover_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handover_id UUID NOT NULL REFERENCES public.manager_handovers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  treasury_entry_id UUID REFERENCES public.manager_treasury(id),
  payment_method TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  customer_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.handover_items ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage handover_items"
ON public.handover_items
FOR ALL
USING (is_admin() OR is_branch_admin());

-- Workers can view their own handover items
CREATE POLICY "Workers can view handover_items"
ON public.handover_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM manager_handovers h
  WHERE h.id = handover_items.handover_id AND h.manager_id = get_worker_id()
));

-- Index for quick lookup
CREATE INDEX idx_handover_items_order_id ON public.handover_items(order_id);
CREATE INDEX idx_handover_items_handover_id ON public.handover_items(handover_id);
