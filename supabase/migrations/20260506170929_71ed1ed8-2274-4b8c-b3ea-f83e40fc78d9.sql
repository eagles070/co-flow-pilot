ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_colis text,
  ADD COLUMN IF NOT EXISTS tracking_number text;