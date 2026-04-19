-- Shopify stores
CREATE TABLE public.shopify_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  webhook_secret TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shopify_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full shopify_stores"
ON public.shopify_stores FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE TRIGGER trg_shopify_stores_updated
BEFORE UPDATE ON public.shopify_stores
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Google Sheets integrations
CREATE TABLE public.google_sheets_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'import', -- import | export
  spreadsheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  google_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_sheets_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full sheets"
ON public.google_sheets_integrations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE TRIGGER trg_sheets_updated
BEFORE UPDATE ON public.google_sheets_integrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Delivery providers
CREATE TABLE public.delivery_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'ameex', -- ameex | other
  api_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT 'https://api.ameex.app',
  business_id TEXT,
  webhook_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full delivery_providers"
ON public.delivery_providers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE TRIGGER trg_delivery_providers_updated
BEFORE UPDATE ON public.delivery_providers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Integration logs
CREATE TABLE public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL, -- shopify | sheets | delivery
  provider_id UUID,
  direction TEXT NOT NULL, -- incoming | outgoing
  endpoint TEXT,
  http_status INTEGER,
  status TEXT NOT NULL DEFAULT 'success', -- success | error
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_logs_created_at ON public.integration_logs (created_at DESC);
CREATE INDEX idx_integration_logs_provider ON public.integration_logs (provider_type, provider_id);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods read logs"
ON public.integration_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- Add tracking_number convenience: deliveries already has it. Add provider_id link.
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.delivery_providers(id) ON DELETE SET NULL;