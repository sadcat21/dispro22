
-- Create bank accounts table for treasury
CREATE TABLE public.treasury_bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid REFERENCES public.branches(id),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.workers(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.treasury_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage treasury_bank_accounts"
ON public.treasury_bank_accounts FOR ALL
USING (is_admin() OR is_branch_admin());

CREATE POLICY "Workers can view treasury_bank_accounts"
ON public.treasury_bank_accounts FOR SELECT
USING (is_worker());

-- Add bank_account_id and receipt_image_url to manager_handovers
ALTER TABLE public.manager_handovers
ADD COLUMN bank_account_id uuid REFERENCES public.treasury_bank_accounts(id),
ADD COLUMN receipt_image_url text;
