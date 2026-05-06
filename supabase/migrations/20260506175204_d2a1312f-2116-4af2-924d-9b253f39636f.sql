
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS relaunch_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relaunched_at timestamptz,
  ADD COLUMN IF NOT EXISTS relaunched_by uuid,
  ADD COLUMN IF NOT EXISTS previous_status text;

CREATE INDEX IF NOT EXISTS idx_orders_relaunch_eligible
  ON public.orders (relaunch_eligible)
  WHERE relaunch_eligible = true;

CREATE TABLE IF NOT EXISTS public.relaunch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  parcel_code text,
  previous_status text,
  new_order_id uuid,
  comments text,
  response jsonb,
  status text NOT NULL DEFAULT 'success',
  relaunched_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relaunch_logs_order_id ON public.relaunch_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_relaunch_logs_new_order_id ON public.relaunch_logs (new_order_id);

ALTER TABLE public.relaunch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read relaunch_logs"
ON public.relaunch_logs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'moderator'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
);

CREATE POLICY "Staff insert relaunch_logs"
ON public.relaunch_logs FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'moderator'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
);

-- Auto-mark eligibility based on status transitions
CREATE OR REPLACE FUNCTION public.mark_relaunch_eligible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'returned', 'refused', 'no_reply') THEN
    NEW.relaunch_eligible := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_relaunch_eligible ON public.orders;
CREATE TRIGGER trg_mark_relaunch_eligible
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_relaunch_eligible();

-- Backfill existing eligible orders
UPDATE public.orders
SET relaunch_eligible = true
WHERE status IN ('cancelled', 'returned', 'refused', 'no_reply')
  AND relaunch_eligible = false;
