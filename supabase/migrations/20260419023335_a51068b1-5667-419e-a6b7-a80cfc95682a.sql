ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_concurrent_orders integer DEFAULT 20;

-- Allow a user to stamp their own last_login_at (already covered by Update own or admin policy, but make sure it exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Update own or admin'
  ) THEN
    CREATE POLICY "Update own or admin" ON public.profiles
      FOR UPDATE USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
  END IF;
END$$;