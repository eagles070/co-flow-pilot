import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
}

const SETTING_KEYS = ["app_name", "max_call_attempts", "default_language", "logo_url"] as const;

export function GeneralTab({ isAdmin }: Props) {
  const [appName, setAppName] = useState("CallCenter");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [language, setLanguage] = useState("en");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").in("key", SETTING_KEYS as unknown as string[]);
      for (const row of data ?? []) {
        if (row.key === "app_name") setAppName(String(row.value));
        if (row.key === "max_call_attempts") setMaxAttempts(Number(row.value));
        if (row.key === "default_language") setLanguage(String(row.value));
        if (row.key === "logo_url") setLogoUrl(String(row.value ?? ""));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!isAdmin) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert([
      { key: "app_name", value: appName },
      { key: "max_call_attempts", value: maxAttempts },
      { key: "default_language", value: language },
      { key: "logo_url", value: logoUrl },
    ]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("General settings saved");
  };

  const onUpload = async (file: File) => {
    if (!isAdmin) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `app/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Logo uploaded — don't forget to save");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General configuration</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>App name</Label>
          <Input value={appName} disabled={!isAdmin} onChange={(e) => setAppName(e.target.value)} />
        </div>
        <div>
          <Label>Default language</Label>
          <Input value={language} disabled={!isAdmin} onChange={(e) => setLanguage(e.target.value)} placeholder="en, fr, ar..." />
        </div>
        <div>
          <Label>Max call attempts (default 3)</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            disabled={!isAdmin}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded border object-cover" />
            ) : (
              <div className="h-12 w-12 rounded border bg-muted" />
            )}
            <label className="inline-flex">
              <Button type="button" variant="outline" disabled={!isAdmin || uploading} asChild>
                <span>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload logo
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!isAdmin || uploading}
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </label>
          </div>
        </div>
        {isAdmin && (
          <div className="md:col-span-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        )}
        {!isAdmin && <p className="text-xs text-muted-foreground md:col-span-2">Admin only.</p>}
      </CardContent>
    </Card>
  );
}
