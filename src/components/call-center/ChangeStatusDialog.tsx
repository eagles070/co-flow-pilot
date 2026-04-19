import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { OrderStatus } from "@/lib/order-status";

export interface StatusOpt {
  key: string;
  label: string;
  color: string;
}

interface Props {
  orderId: string | null;
  currentStatus?: OrderStatus | null;
  statuses: StatusOpt[];
  onClose: () => void;
  onSaved: () => void;
  /** When true, also writes a call_attempts row + uses current agent */
  logCallAttempt?: boolean;
}

export function ChangeStatusDialog({ orderId, currentStatus, statuses, onClose, onSaved, logCallAttempt }: Props) {
  const open = !!orderId;
  const [value, setValue] = useState<string>("");
  const [note, setNote] = useState("");
  const [recallAt, setRecallAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(currentStatus ?? "");
      setNote("");
      setRecallAt("");
    }
  }, [open, currentStatus]);

  const submit = async () => {
    if (!orderId || !value) {
      toast.error("Select a status");
      return;
    }
    setSaving(true);
    const patch: { status: OrderStatus; confirmed_at?: string } = { status: value as OrderStatus };
    if (value === "confirmed") patch.confirmed_at = new Date().toISOString();

    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    if (logCallAttempt) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("call_attempts").insert({
          order_id: orderId,
          agent_id: u.user.id,
          outcome: (value === "confirmed" ? "confirmed"
            : value === "cancelled" ? "cancelled"
            : value === "no_reply" ? "no_reply"
            : value === "postponed" ? "postponed"
            : "callback_requested"),
          note: note || null,
          recall_at: recallAt ? new Date(recallAt).toISOString() : null,
        });
      }
    }

    setSaving(false);
    toast.success("Status updated");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Select status</Label>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a status..." />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Recall at (optional)</Label>
            <Input type="datetime-local" value={recallAt} onChange={(e) => setRecallAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !value}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
