-- Enums
CREATE TYPE public.purchase_status AS ENUM ('ordered', 'in_transit', 'received');
CREATE TYPE public.transport_type AS ENUM ('air', 'sea', 'other');

-- Purchases table
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric NOT NULL GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  amount_paid numeric NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  transport_type public.transport_type NOT NULL DEFAULT 'other',
  status public.purchase_status NOT NULL DEFAULT 'ordered',
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  stock_applied boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchases_product ON public.purchases(product_id);
CREATE INDEX idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX idx_purchases_status ON public.purchases(status);
CREATE INDEX idx_purchases_date ON public.purchases(purchase_date DESC);

-- updated_at trigger
CREATE TRIGGER trg_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-apply stock when received
CREATE OR REPLACE FUNCTION public.apply_purchase_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'received' AND NEW.stock_applied = false THEN
    INSERT INTO public.stock_movements (product_id, type, quantity, unit_cost, supplier_id, reference, note, created_by)
    VALUES (NEW.product_id, 'purchase', NEW.quantity, NEW.unit_cost, NEW.supplier_id, 'PUR-' || substr(NEW.id::text, 1, 8), 'Auto from purchase', NEW.created_by);
    NEW.stock_applied := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_purchases_apply_stock
BEFORE INSERT OR UPDATE OF status ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_stock();

-- Stock movement trigger (apply quantity changes to products)
DROP TRIGGER IF EXISTS trg_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full purchases"
ON public.purchases FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff read purchases"
ON public.purchases FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'agent'));