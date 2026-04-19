-- Cash flow table for tracking real money movements
CREATE TABLE IF NOT EXISTS public.cash_flow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('in', 'out')),
  amount numeric NOT NULL,
  source text NOT NULL CHECK (source IN ('delivery', 'ads', 'supplier', 'other')),
  description text,
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods full cash_flow"
ON public.cash_flow FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'moderator'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'moderator'::app_role));

CREATE POLICY "Staff read cash_flow"
ON public.cash_flow FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'moderator'::app_role) OR has_role(auth.uid(),'agent'::app_role));

-- Add product_id to expenses for product-linked expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON public.cash_flow(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_product ON public.expenses(product_id);