-- ============ ENUMS ============
CREATE TYPE public.call_outcome AS ENUM (
  'confirmed', 'cancelled', 'no_reply', 'wrong_number', 'postponed',
  'duplicate', 'callback_requested', 'voicemail'
);

CREATE TYPE public.delivery_status AS ENUM (
  'pending', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'returned', 'refused', 'lost'
);

CREATE TYPE public.stock_movement_type AS ENUM (
  'purchase', 'sale', 'return', 'adjustment', 'damaged'
);

CREATE TYPE public.expense_category AS ENUM (
  'ads', 'salaries', 'rent', 'shipping', 'inventory', 'tools', 'other'
);

CREATE TYPE public.activity_action AS ENUM (
  'create', 'update', 'delete', 'assign', 'status_change', 'login', 'export', 'import'
);

-- ============ CALL ATTEMPTS ============
CREATE TABLE public.call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  outcome public.call_outcome NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  note TEXT,
  recall_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_attempts_order ON public.call_attempts(order_id);
CREATE INDEX idx_call_attempts_agent ON public.call_attempts(agent_id);
CREATE INDEX idx_call_attempts_recall ON public.call_attempts(recall_at) WHERE recall_at IS NOT NULL;

ALTER TABLE public.call_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view call attempts" ON public.call_attempts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
    OR (has_role(auth.uid(), 'agent') AND agent_id = auth.uid())
  );

CREATE POLICY "Agents log own attempts" ON public.call_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND (has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  );

CREATE POLICY "Admins manage attempts" ON public.call_attempts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- Auto-increment order attempts counter
CREATE OR REPLACE FUNCTION public.bump_order_attempts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.orders
    SET attempts = attempts + 1
    WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_call_bump_attempts
  AFTER INSERT ON public.call_attempts
  FOR EACH ROW EXECUTE FUNCTION public.bump_order_attempts();

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN lead_time_days INTEGER DEFAULT 7;
ALTER TABLE public.products ADD COLUMN low_stock_threshold INTEGER DEFAULT 10;

-- ============ STOCK MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  reference TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_created ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full stock" ON public.stock_movements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff read stock" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
    OR has_role(auth.uid(), 'agent')
  );

-- Auto-update product stock
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type IN ('purchase', 'return') THEN
    UPDATE public.products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type IN ('sale', 'damaged') THEN
    UPDATE public.products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'adjustment' THEN
    UPDATE public.products SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_apply
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- ============ DELIVERIES ============
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier TEXT NOT NULL DEFAULT 'manual',
  tracking_number TEXT,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  return_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deliveries_status ON public.deliveries(status);
CREATE INDEX idx_deliveries_tracking ON public.deliveries(tracking_number);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Staff read deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
    OR has_role(auth.uid(), 'agent')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_id AND s.owner_id = auth.uid()
    )
  );

CREATE TRIGGER trg_deliveries_updated BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.expense_category NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX idx_expenses_category ON public.expenses(category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- ============ BLACKLIST ============
CREATE TABLE public.blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  reason TEXT,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blacklist_phone ON public.blacklist(phone);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full blacklist" ON public.blacklist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Agents read blacklist" ON public.blacklist
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action public.activity_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX idx_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_logs_entity ON public.activity_logs(entity_type, entity_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============ APP SETTINGS ============
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff read settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
    OR has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'media_buyer')
  );

-- ============ BLACKLIST CHECK ON ORDER INSERT ============
CREATE OR REPLACE FUNCTION public.flag_blacklisted_orders()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.blacklist WHERE phone = NEW.customer_phone) THEN
    NEW.status := 'cancelled';
    NEW.notes := COALESCE(NEW.notes || E'\n', '') || '[AUTO] Customer phone is blacklisted.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_blacklist_check
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.flag_blacklisted_orders();