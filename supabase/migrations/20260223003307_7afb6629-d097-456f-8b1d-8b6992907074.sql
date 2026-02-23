-- Create sector_zones table
CREATE TABLE public.sector_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sector_zones ENABLE ROW LEVEL SECURITY;

-- Everyone can read zones
CREATE POLICY "Allow read access to sector_zones" ON public.sector_zones
  FOR SELECT USING (true);

-- Admins can manage zones
CREATE POLICY "Admins can manage sector_zones" ON public.sector_zones
  FOR ALL USING (is_admin() OR is_branch_admin())
  WITH CHECK (is_admin() OR is_branch_admin());

-- Add zone_id to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.sector_zones(id) ON DELETE SET NULL;