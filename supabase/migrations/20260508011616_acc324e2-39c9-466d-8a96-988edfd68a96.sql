-- Create private backups bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Admins can read backup files
CREATE POLICY "Admins read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can upload backup files
CREATE POLICY "Admins upload backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete backup files
CREATE POLICY "Admins delete backups"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));