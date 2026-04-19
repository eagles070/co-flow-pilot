-- 1) Remove duplicate inverted rows: keep only the lowest id per (real city name).
DELETE FROM public.cities a
USING public.cities b
WHERE a.name ~ '^[0-9]+$'
  AND b.name ~ '^[0-9]+$'
  AND a.ameex_city_id = b.ameex_city_id
  AND a.id > b.id;

-- 2) Swap inverted columns.
UPDATE public.cities
SET name = ameex_city_id,
    ameex_city_id = name
WHERE name ~ '^[0-9]+$'
  AND ameex_city_id IS NOT NULL
  AND ameex_city_id !~ '^[0-9]+$';