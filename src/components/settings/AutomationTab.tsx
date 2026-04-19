import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isAdmin: boolean;
}

const KEYS = [
  "auto_assign_enabled",
  "nrp_max_attempts",
  "nrp_retry_delay_hours",
  "nrp_auto_reassign",
  "auto_transfer_enabled",
] as const;

export function AutomationTab({ isAdmin }: Props) {
  const [autoAssign, setAutoAssign] = useState(false);
  const [nrpMax, setNrpMax] = useState(3);
  const [nrpDelay, setNrpDelay] = useState(3);
  const [nrpReassign, setNrpReassign] = useState(true);
  const [autoTransfer, setAutoTransfer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").in("key", KEYS as unknown as string[]);
      for (const row of data ?? []) {
        if (row.key === "auto_assign_enabled") setAutoAssign(Boolean(row.value));
        if (row.key === "nrp_max_attempts") setNrpMax(Number(row.value));
        if (row.key === "nrp_retry_delay_hours") setNrpDelay(Number(row.value));
        if (row.key === "nrp_auto_reassign") setNrpReassign(Boolean(row.value));
        if (row.key === "auto_transfer_enabled") setAutoTransfer(Boolean(row.value));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!isAdmin) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert([
      { key: "auto_assign_enabled", value: autoAssign },
      { key: "nrp_max_attempts", value: nrpMax },
      { key: "nrp_retry_delay_hours", value: nrpDelay },
      { key: "nrp_auto_reassign", value: nrpReassign },
      { key: "auto_transfer_enabled", value: autoTransfer },
    ]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Automation rules saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto assign</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Auto-distribute orders</p>
              <p className="text-xs text-muted-foreground">Distribute new orders automatically across active agents.</p>
            </div>
            <Switch checked={autoAssign} disabled={!isAdmin} onCheckedChange={setAutoAssign} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">NRP logic</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div>
            <Label>Max attempts</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={nrpMax}
              disabled={!isAdmin}
              onChange={(e) => setNrpMax(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Retry delay</Label>
            <Select
              value={String(nrpDelay)}
              disabled={!isAdmin}
              onValueChange={(v) => setNrpDelay(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="3">3 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Auto-reassign after max attempts</p>
              <p className="text-xs text-muted-foreground">Reassign the order to another agent automatically.</p>
            </div>
            <Switch checked={nrpReassign} disabled={!isAdmin} onCheckedChange={setNrpReassign} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfer rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Enable auto-transfer between agents</p>
              <p className="text-xs text-muted-foreground">Allow the system to transfer orders between agents based on workload.</p>
            </div>
            <Switch checked={autoTransfer} disabled={!isAdmin} onCheckedChange={setAutoTransfer} />
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="md:col-span-2">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save automation rules
          </Button>
        </div>
      )}
      {!isAdmin && <p className="text-xs text-muted-foreground md:col-span-2">Admin only.</p>}
    </div>
  );
}
