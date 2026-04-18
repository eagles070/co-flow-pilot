import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [appName, setAppName] = useState("CallCenter");
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*");
      for (const row of data ?? []) {
        if (row.key === "app_name") setAppName(String(row.value));
        if (row.key === "max_call_attempts") setMaxAttempts(Number(row.value));
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
    ]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="System configuration and preferences." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label>App name</Label>
              <Input
                value={appName}
                disabled={!isAdmin}
                onChange={(e) => setAppName(e.target.value)}
              />
            </div>
            <div>
              <Label>Max call attempts before auto-cancel</Label>
              <Input
                type="number"
                value={maxAttempts}
                disabled={!isAdmin}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
              />
            </div>
            {isAdmin && (
              <div>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            )}
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">Admin only.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>CallCenter — an internal app for managing orders, calls and deliveries.</p>
            <p className="mt-2">More configuration modules (sources, statuses, cities, automation rules) coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
