ALTER TABLE public.loading_session_items
  ADD COLUMN previous_quantity numeric NOT NULL DEFAULT 0;