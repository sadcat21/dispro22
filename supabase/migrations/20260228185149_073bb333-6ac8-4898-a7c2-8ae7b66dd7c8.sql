-- Add factory return and compensation tracking columns to warehouse_stock
ALTER TABLE public.warehouse_stock 
ADD COLUMN factory_return_quantity numeric NOT NULL DEFAULT 0,
ADD COLUMN compensation_quantity numeric NOT NULL DEFAULT 0;