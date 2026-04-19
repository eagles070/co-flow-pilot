ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS ameex_city_id text;
COMMENT ON COLUMN public.cities.ameex_city_id IS 'Numeric city ID expected by the Ameex delivery API (e.g. "1" = Marrakech, "21" = Casablanca).';
CREATE INDEX IF NOT EXISTS idx_cities_ameex_city_id ON public.cities(ameex_city_id);