-- ============ ENUMS ============
CREATE TYPE public.order_status AS ENUM (
  'new', 'assigned', 'confirmed', 'no_reply', 'cancelled', 'duplicate',
  'shipped', 'in_transit', 'delivered', 'returned', 'refused', 'postponed'
);

CREATE TYPE public.order_source AS ENUM ('shopify', 'google_sheet', 'manual', 'landing_page');

CREATE TYPE public.store_type AS ENUM ('shopify', 'google_sheet', 'manual');

-- ============ STORES ============
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.store_type NOT NULL DEFAULT 'manual',
  external_id TEXT,
  url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full stores" ON public.stores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff read stores" ON public.stores
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
    OR has_role(auth.uid(), 'agent') OR auth.uid() = owner_id
  );

CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  description TEXT,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full products" ON public.products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff read products" ON public.products
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
    OR has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'media_buyer')
  );

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL DEFAULT ('ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  source public.order_source NOT NULL DEFAULT 'manual',
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  external_order_id TEXT,
  status public.order_status NOT NULL DEFAULT 'new',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_phone_alt TEXT,
  shipping_address TEXT,
  city TEXT,
  region TEXT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  agent_id UUID,
  attempts INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_agent ON public.orders(agent_id);
CREATE INDEX idx_orders_store ON public.orders(store_id);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_phone ON public.orders(customer_phone);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full orders" ON public.orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Agents view assigned" ON public.orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'agent') AND agent_id = auth.uid());

CREATE POLICY "Agents update assigned" ON public.orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'agent') AND agent_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'agent') AND agent_id = auth.uid());

CREATE POLICY "Media buyers view own store orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'media_buyer')
    AND store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDER ITEMS ============
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items follow order access" ON public.order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
      OR (has_role(auth.uid(), 'agent') AND o.agent_id = auth.uid())
      OR (has_role(auth.uid(), 'media_buyer') AND o.store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
    ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
      OR (has_role(auth.uid(), 'agent') AND o.agent_id = auth.uid())
    ))
  );

-- ============ STATUS HISTORY ============
CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  changed_by UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_order ON public.order_status_history(order_id);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "History read by staff" ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.agent_id = auth.uid())
  );

CREATE POLICY "History insert by staff" ON public.order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'agent')
  );

-- ============ AUTO LOG STATUS CHANGES ============
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_log_status
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();