-- Make product_id nullable so purchases can exist without a linked product
ALTER TABLE public.purchases ALTER COLUMN product_id DROP NOT NULL;

-- Add manual product fields for sourcing-only purchases
ALTER TABLE public.purchases 
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS converted_to_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Update apply_purchase_stock trigger so it only auto-applies stock when a product is linked
CREATE OR REPLACE FUNCTION public.apply_purchase_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'received' AND NEW.stock_applied = false AND NEW.product_id IS NOT NULL THEN
    INSERT INTO public.stock_movements (product_id, type, quantity, unit_cost, supplier_id, reference, note, created_by)
    VALUES (NEW.product_id, 'purchase', NEW.quantity, NEW.unit_cost, NEW.supplier_id, 'PUR-' || substr(NEW.id::text, 1, 8), 'Auto from purchase', NEW.created_by);
    NEW.stock_applied := true;
  END IF;
  RETURN NEW;
END;
$$;