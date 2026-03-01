-- Add updated_at column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Set existing rows' updated_at to created_at
UPDATE public.customers SET updated_at = created_at WHERE updated_at IS NULL;

-- Make it NOT NULL with default
ALTER TABLE public.customers ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN updated_at SET DEFAULT now();

-- Create trigger to auto-update updated_at on changes
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();