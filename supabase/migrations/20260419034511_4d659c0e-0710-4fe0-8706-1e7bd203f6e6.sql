-- Cities (delivery / return cost estimates)
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  delivery_cost numeric NOT NULL DEFAULT 0,
  return_cost numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read cities" ON public.cities FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'agent') OR has_role(auth.uid(),'media_buyer'));
CREATE POLICY "Admins manage cities" ON public.cities FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Order sources (configurable list, separate from order_source enum used by integrations)
CREATE TABLE IF NOT EXISTS public.order_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read order_sources" ON public.order_sources FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'agent') OR has_role(auth.uid(),'media_buyer'));
CREATE POLICY "Admins manage order_sources" ON public.order_sources FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_order_sources_updated BEFORE UPDATE ON public.order_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Expense categories (configurable, separate from expense_category enum)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read expense_categories" ON public.expense_categories FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'agent') OR has_role(auth.uid(),'media_buyer'));
CREATE POLICY "Admins manage expense_categories" ON public.expense_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_expense_categories_updated BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Statuses configuration (label/color/order overlay over the enum)
CREATE TABLE IF NOT EXISTS public.status_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.status_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read status_configs" ON public.status_configs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'agent') OR has_role(auth.uid(),'media_buyer'));
CREATE POLICY "Admins manage status_configs" ON public.status_configs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_status_configs_updated BEFORE UPDATE ON public.status_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notification settings (per alert type)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT false,
  threshold numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read notification_settings" ON public.notification_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY "Admins manage notification_settings" ON public.notification_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_notification_settings_updated BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default statuses (idempotent)
INSERT INTO public.status_configs (key,label,color,sort_order,is_system) VALUES
  ('new','New','#3b82f6',1,true),
  ('assigned','Assigned','#8b5cf6',2,true),
  ('confirmed','Confirmed','#10b981',3,true),
  ('no_reply','NRP','#f59e0b',4,true),
  ('postponed','Postponed','#eab308',5,true),
  ('cancelled','Cancelled','#ef4444',6,true),
  ('duplicate','Duplicate','#a3a3a3',7,true),
  ('shipped','Shipped','#0ea5e9',8,true),
  ('in_transit','In transit','#06b6d4',9,true),
  ('delivered','Delivered','#16a34a',10,true),
  ('returned','Returned','#f97316',11,true),
  ('refused','Refused','#dc2626',12,true)
ON CONFLICT (key) DO NOTHING;

-- Seed default sources
INSERT INTO public.order_sources (name,sort_order) VALUES
  ('Facebook',1),('Instagram',2),('TikTok',3),('Shopify',4),('WhatsApp',5),('Google Sheet',6),('Manual',7),('Landing page',8)
ON CONFLICT (name) DO NOTHING;

-- Seed default expense categories
INSERT INTO public.expense_categories (name,sort_order) VALUES
  ('Ads',1),('Product Cost',2),('Tools',3),('Transport',4),('Packaging',5),('Salaries',6),('Rent',7),('Other',8)
ON CONFLICT (name) DO NOTHING;

-- Seed default notification settings
INSERT INTO public.notification_settings (alert_key,enabled,in_app,email,threshold) VALUES
  ('low_stock',true,true,false,10),
  ('low_profit',true,true,false,0),
  ('high_return_rate',true,true,false,15),
  ('agent_performance',true,true,false,50)
ON CONFLICT (alert_key) DO NOTHING;