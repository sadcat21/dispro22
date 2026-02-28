ALTER TABLE public.loading_sessions
ADD COLUMN IF NOT EXISTS unloading_details jsonb;