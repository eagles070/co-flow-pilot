ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku_ameex text;
CREATE INDEX IF NOT EXISTS idx_products_sku_ameex ON public.products(sku_ameex);