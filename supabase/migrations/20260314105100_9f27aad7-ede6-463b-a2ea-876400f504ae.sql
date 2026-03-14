-- Fix swapped dates in existing coverage records
UPDATE public.sector_coverage 
SET start_date = end_date, end_date = start_date 
WHERE start_date > end_date;

-- Add a validation trigger to prevent swapped dates in the future
CREATE OR REPLACE FUNCTION public.validate_sector_coverage_dates()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.start_date > NEW.end_date THEN
    -- Auto-swap instead of rejecting
    DECLARE tmp date;
    BEGIN
      tmp := NEW.start_date;
      NEW.start_date := NEW.end_date;
      NEW.end_date := tmp;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sector_coverage_dates
  BEFORE INSERT OR UPDATE ON public.sector_coverage
  FOR EACH ROW EXECUTE FUNCTION public.validate_sector_coverage_dates();