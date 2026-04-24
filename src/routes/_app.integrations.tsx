import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, FileSpreadsheet, Truck, Copy, RefreshCw, Trash2, Send, Plus, Pencil, Plug, CheckCircle2, AlertCircle, ExternalLink, Eye, EyeOff } from "lucide-react";
import {
  listIntegrations,
  createShopifyStore,
  updateShopifyStore,
  deleteShopifyStore,
  testShopifyWebhook,
  createSheetsIntegration,
  deleteSheetsIntegration,
  syncSheetNow,
  createDeliveryProvider,
  updateDeliveryProvider,
  deleteDeliveryProvider,
  testDeliveryProvider,
} from "@/utils/integrations.functions";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsPage,
});

function copy(s: string) {
  navigator.clipboard.writeText(s);
  toast.success("Copied to clipboard");
}

function IntegrationsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listIntegrations);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => list(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations"
        description="Connect Shopify, Google Sheets and delivery providers."
      />
      <SectionHeader
        icon={Plug}
        title="Connected Channels"
        description="Manage external systems feeding orders into your CRM"
        variant="primary"
      />
      <Tabs defaultValue="shopify" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shopify">
            <ShoppingBag className="mr-2 h-4 w-4" /> Shopify
          </TabsTrigger>
          <TabsTrigger value="sheets">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Google Sheets
          </TabsTrigger>
          <TabsTrigger value="delivery">
            <Truck className="mr-2 h-4 w-4" /> Delivery Providers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shopify">
          <ShopifyTab
            stores={data?.shopify ?? []}
            loading={isLoading}
            baseUrl={baseUrl}
            onChange={refresh}
          />
        </TabsContent>

        <TabsContent value="sheets">
          <SheetsTab sheets={data?.sheets ?? []} loading={isLoading} onChange={refresh} />
        </TabsContent>

        <TabsContent value="delivery">
          <DeliveryTab
            providers={data?.providers ?? []}
            loading={isLoading}
            baseUrl={baseUrl}
            onChange={refresh}
          />
        </TabsContent>
      </Tabs>

      <LogsPanel logs={data?.logs ?? []} />
    </div>
  );
}

// -------------------- SHOPIFY --------------------

function ShopifyTab({
  stores,
  loading,
  baseUrl,
  onChange,
}: {
  stores: any[];
  loading: boolean;
  baseUrl: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [createdStore, setCreatedStore] = useState<any | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [editSecretFor, setEditSecretFor] = useState<any | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const create = useServerFn(createShopifyStore);
  const update = useServerFn(updateShopifyStore);
  const del = useServerFn(deleteShopifyStore);
  const testWebhook = useServerFn(testShopifyWebhook);

  const createMut = useMutation({
    mutationFn: () =>
      create({ data: { name, domain, webhook_secret: newSecret || undefined } }),
    onSuccess: (row: any) => {
      toast.success("Boutique Shopify ajoutée");
      setOpen(false);
      setName("");
      setDomain("");
      setNewSecret("");
      setCreatedStore(row);
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSecretMut = useMutation({
    mutationFn: (vars: { id: string; webhook_secret: string }) =>
      update({ data: vars }),
    onSuccess: () => {
      toast.success("Secret updated. Now test the webhook.");
      setEditSecretFor(null);
      setSecretInput("");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => testWebhook({ data: { id, base_url: baseUrl } }),
    onSuccess: (r: any) => {
      if (r.error) {
        toast.error(`Network error: ${r.error}`);
      } else if (r.http_status >= 200 && r.http_status < 300) {
        toast.success(`Webhook is live (HTTP ${r.http_status}). A test order was created.`);
        onChange();
      } else if (r.http_status === 401) {
        toast.error("HMAC verification failed (HTTP 401). Secret may be misconfigured.");
      } else {
        toast.error(`Webhook responded HTTP ${r.http_status}: ${r.body}`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Shopify stores</CardTitle>
          <CardDescription>
            Receive new orders automatically via webhooks. Configure each store in Shopify
            Admin → Settings → Notifications → Webhooks.
          </CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add store
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/15 p-2">
              <AlertCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-2 text-sm flex-1">
              <div className="font-semibold">How Shopify webhooks work with this CRM</div>
              <ol className="text-muted-foreground text-xs leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>
                  <strong className="text-foreground">In your CRM (here):</strong> Add the store
                  below. We give you a <strong>Webhook URL</strong> like{" "}
                  <code className="font-mono">/api/webhooks/shopify/&lt;store-id&gt;</code>.
                </li>
                <li>
                  <strong className="text-foreground">In Shopify Admin:</strong> Go to{" "}
                  <strong>Settings → Notifications → Webhooks → Create webhook</strong>. Pick
                  event <strong>Order creation</strong>, format <strong>JSON</strong>, paste the
                  CRM URL, then save. Shopify shows a long signing secret at the bottom (e.g.{" "}
                  <code className="font-mono">1577b79637c87b…</code>).
                </li>
                <li>
                  <strong className="text-foreground">Back here:</strong> Click{" "}
                  <strong>Paste secret from Shopify</strong> on the store row and paste that
                  signing secret. Then click <strong>Test webhook</strong> — should return 200.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Shopify stores connected yet.</p>
        ) : (
          <div className="space-y-3">
            {stores.map((s) => {
              const url = `${baseUrl}/api/webhooks/shopify/${s.id}`;
              const revealed = revealId === s.id;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.domain}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground mr-2">
                        Last sync: {s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : "Never"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testMut.mutate(s.id)}
                        disabled={testMut.isPending}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        {testMut.isPending ? "Testing…" : "Test webhook"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCreatedStore(s)}>
                        Setup guide
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => delMut.mutate(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                      <div className="flex items-center gap-1">
                        <Input value={url} readOnly className="font-mono text-xs" />
                        <Button variant="outline" size="icon" onClick={() => copy(url)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        HMAC secret (must match Shopify)
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          value={revealed ? s.webhook_secret : "•".repeat(24)}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setRevealId(revealed ? null : s.id)}
                          title={revealed ? "Hide" : "Reveal"}
                        >
                          {revealed ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copy(s.webhook_secret)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full mt-1"
                        onClick={() => {
                          setSecretInput("");
                          setEditSecretFor(s);
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Paste secret from Shopify
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle boutique</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nom de la boutique</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: MonStore Maroc"
              />
              <p className="text-xs text-muted-foreground">Le nom qui apparaît dans le CRM</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Domaine Shopify (.myshopify.com)</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="ex: kev81q-i0.myshopify.com"
              />
              <p className="text-xs text-muted-foreground">Votre domaine Shopify complet</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Shopify Webhook Secret</Label>
              <Input
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                placeholder="Signing secret from Shopify Admin"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Shopify Admin → Settings → Notifications → Webhooks. Laissez vide pour générer un
                secret automatique.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name || !domain}>
              {createMut.isPending ? "Enregistrement…" : "💾 Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShopifySetupDialog
        store={createdStore}
        baseUrl={baseUrl}
        onClose={() => setCreatedStore(null)}
        onTest={(id) => testMut.mutate(id)}
        testing={testMut.isPending}
      />

      <Dialog open={!!editSecretFor} onOpenChange={(v) => !v && setEditSecretFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste signing secret from Shopify</DialogTitle>
            <DialogDescription>
              In Shopify Admin → Settings → Notifications → Webhooks, scroll to{" "}
              <strong>"Your webhooks will be signed with"</strong> at the bottom of the page and
              copy that long hex string. Paste it here so we can verify incoming webhooks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Shopify signing secret</Label>
              <Input
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="1577b79637c87b06663332db08b64b60ebd9214bf2f52774251ade0c1f52adef"
                className="font-mono text-xs"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Replaces the auto-generated secret for{" "}
                <strong>{editSecretFor?.name}</strong>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSecretFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editSecretFor &&
                updateSecretMut.mutate({
                  id: editSecretFor.id,
                  webhook_secret: secretInput.trim(),
                })
              }
              disabled={!secretInput.trim() || updateSecretMut.isPending}
            >
              {updateSecretMut.isPending ? "Saving…" : "Save secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ShopifySetupDialog({
  store,
  baseUrl,
  onClose,
  onTest,
  testing,
}: {
  store: any | null;
  baseUrl: string;
  onClose: () => void;
  onTest: (id: string) => void;
  testing: boolean;
}) {
  if (!store) return null;
  const url = `${baseUrl}/api/webhooks/shopify/${store.id}`;
  const adminUrl = `https://${store.domain}/admin/settings/notifications`;

  return (
    <Dialog open={!!store} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Connect this store to Shopify
          </DialogTitle>
          <DialogDescription>
            Follow these 4 steps in your Shopify admin. Total time: ~2 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm flex gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
            <span>
              Shopify does <strong>not</strong> have a "Test webhook" button inside the admin.
              Use the <strong>Test webhook</strong> button below — it sends a signed sample
              order to your endpoint and confirms it works.
            </span>
          </div>

          <ol className="space-y-3 text-sm">
            <li className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="font-medium mb-1">1. Open Shopify webhooks settings</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(adminUrl, "_blank")}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Open {store.domain}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Path: Settings → Notifications → scroll to <strong>Webhooks</strong> → Create
                webhook.
              </p>
            </li>

            <li className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="font-medium">2. Configure the webhook</div>
              <div className="grid gap-2 text-xs">
                <Field label="Event" value="Order creation" />
                <Field label="Format" value="JSON" />
                <Field label="API version" value="Latest stable" />
                <Field label="URL" value={url} mono copyable />
              </div>
            </li>

            <li className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="font-medium">3. Save the HMAC secret</div>
              <p className="text-xs text-muted-foreground">
                After saving the webhook, Shopify shows an <strong>HMAC signing secret</strong>{" "}
                (just under the webhook). Copy it and replace the one we generated below if it
                differs — or use ours and set it inside Shopify if your plan allows custom
                secrets. For most stores, Shopify generates the secret itself, so update yours
                here:
              </p>
              <Field label="Our generated secret" value={store.webhook_secret} mono copyable />
              <p className="text-xs text-muted-foreground">
                Important: the secret stored here must match what Shopify uses to sign requests,
                otherwise webhooks will be rejected (401).
              </p>
            </li>

            <li className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="font-medium">4. Test the connection</div>
              <p className="text-xs text-muted-foreground">
                Click below — we'll POST a signed sample order to your webhook URL and create a
                test order if everything works.
              </p>
              <Button onClick={() => onTest(store.id)} disabled={testing}>
                <Send className="mr-1 h-3 w-3" />
                {testing ? "Testing…" : "Test webhook now"}
              </Button>
            </li>
          </ol>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}:</span>
      <Input
        value={value}
        readOnly
        className={`h-8 ${mono ? "font-mono text-xs" : "text-xs"}`}
      />
      {copyable && (
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(value)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// -------------------- SHEETS --------------------

function SheetsTab({
  sheets,
  loading,
  onChange,
}: {
  sheets: any[];
  loading: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"import" | "export">("import");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [mapping, setMapping] = useState(
    JSON.stringify(
      {
        customer_name: "name",
        customer_phone: "phone",
        city: "city",
        shipping_address: "address",
        total_amount: "total",
        product_name: "product",
      },
      null,
      2,
    ),
  );

  const create = useServerFn(createSheetsIntegration);
  const del = useServerFn(deleteSheetsIntegration);
  const sync = useServerFn(syncSheetNow);

  const createMut = useMutation({
    mutationFn: async () => {
      let column_mapping: Record<string, string> = {};
      try {
        column_mapping = JSON.parse(mapping);
      } catch {
        throw new Error("Column mapping is not valid JSON");
      }
      return create({
        data: {
          name,
          direction,
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          column_mapping,
        },
      });
    },
    onSuccess: () => {
      toast.success("Integration added");
      setOpen(false);
      setName("");
      setSpreadsheetId("");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: async (id: string) => {
      const { data: sess } = await supabase.auth.getSession();
      const provider_token = (sess.session as any)?.provider_token;
      return sync({ data: { id, provider_token } });
    },
    onSuccess: (r: any) => {
      toast.success(`Imported ${r.imported} new orders`);
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function reconnectGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/integrations",
        scopes: "https://www.googleapis.com/auth/spreadsheets.readonly email profile",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) toast.error("Google sign-in failed: " + error.message);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Google Sheets</CardTitle>
          <CardDescription>
            Import orders from a spreadsheet. First row must be headers — map them below.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reconnectGoogle}>
            Connect Google
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add sheet
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sheets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sheet integrations yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Spreadsheet</TableHead>
                <TableHead>Sheet</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheets.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.direction}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.spreadsheet_id.slice(0, 12)}…
                  </TableCell>
                  <TableCell>{s.sheet_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncMut.mutate(s.id)}
                      disabled={syncMut.isPending}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" /> Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => del({ data: { id: s.id } }).then(onChange)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect a Google Sheet</DialogTitle>
            <DialogDescription>
              Click "Connect Google" first to authorize access. Then paste the spreadsheet ID
              from its URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Orders sheet" />
            </div>
            <div>
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "import" | "export")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="import">Import (Sheet → CRM)</SelectItem>
                  <SelectItem value="export">Export (CRM → Sheet)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Spreadsheet ID</Label>
              <Input
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="1abc...XYZ"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                From URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
              </p>
            </div>
            <div>
              <Label>Sheet (tab) name</Label>
              <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
            </div>
            <div>
              <Label>Column mapping (CRM field → spreadsheet header)</Label>
              <Textarea
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// -------------------- DELIVERY --------------------

function DeliveryTab({
  providers,
  loading,
  baseUrl,
  onChange,
}: {
  providers: any[];
  loading: boolean;
  baseUrl: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Ameex");
  const [providerType, setProviderType] = useState("ameex");
  const [apiId, setApiId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [baseApi, setBaseApi] = useState("https://api.ameex.app");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editProviderType, setEditProviderType] = useState("ameex");
  const [editApiId, setEditApiId] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editBusinessId, setEditBusinessId] = useState("");
  const [editBaseApi, setEditBaseApi] = useState("https://api.ameex.app");

  const create = useServerFn(createDeliveryProvider);
  const update = useServerFn(updateDeliveryProvider);
  const del = useServerFn(deleteDeliveryProvider);
  const test = useServerFn(testDeliveryProvider);

  const openEdit = (p: any) => {
    setEditId(p.id);
    setEditName(p.name ?? "");
    setEditProviderType(p.provider_type ?? "ameex");
    setEditApiId(p.api_id ?? "");
    setEditApiKey(p.api_key ?? "");
    setEditBusinessId(p.business_id ?? "");
    setEditBaseApi(p.base_url ?? "https://api.ameex.app");
    setEditOpen(true);
  };

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          provider_type: providerType,
          api_id: apiId,
          api_key: apiKey,
          business_id: businessId,
          base_url: baseApi,
        },
      }),
    onSuccess: () => {
      toast.success("Provider added");
      setOpen(false);
      setApiId("");
      setApiKey("");
      setBusinessId("");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      update({
        data: {
          id: editId!,
          name: editName,
          provider_type: editProviderType,
          api_id: editApiId,
          api_key: editApiKey,
          business_id: editBusinessId,
          base_url: editBaseApi,
        },
      }),
    onSuccess: () => {
      toast.success("Provider updated");
      setEditOpen(false);
      setEditId(null);
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (r: any) => {
      const status = r?.http_status;
      if (status >= 200 && status < 300) {
        toast.success(`Connection OK (HTTP ${status}) — credentials are valid.`);
      } else if (status === 401 || status === 403) {
        toast.error(`Auth failed (HTTP ${status}) — check API ID & API Key.`);
      } else {
        toast.error(`Provider responded HTTP ${status}. Check credentials and base URL.`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Delivery providers</CardTitle>
          <CardDescription>
            Send confirmed orders to your carrier and receive automatic status updates.
          </CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add provider
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No delivery providers connected yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Webhook URL</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => {
                const url = `${baseUrl}/api/webhooks/ameex/${p.id}?token=${p.webhook_token}`;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.provider_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => copy(url)}>
                        <Copy className="mr-1 h-3 w-3" /> Copy URL
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.last_sync_at ? new Date(p.last_sync_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testMut.mutate(p.id)}
                        disabled={testMut.isPending}
                      >
                        <Send className="mr-1 h-3 w-3" /> Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(p)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => del({ data: { id: p.id } }).then(onChange)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add delivery provider</DialogTitle>
            <DialogDescription>
              For Ameex: get your API ID and API Key from your Ameex account, then paste the
              generated webhook URL into Ameex webhook settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={providerType} onValueChange={setProviderType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ameex">Ameex</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>API ID</Label>
              <Input value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="572" />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="700790-..."
              />
            </div>
            <div>
              <Label>Business ID</Label>
              <Input
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="Exact Ameex business ID"
              />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input value={baseApi} onChange={(e) => setBaseApi(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit delivery provider</DialogTitle>
            <DialogDescription>
              Update credentials. Changes apply immediately to new shipments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Display name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={editProviderType} onValueChange={setEditProviderType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ameex">Ameex</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>API ID</Label>
              <Input value={editApiId} onChange={(e) => setEditApiId(e.target.value)} />
            </div>
            <div>
              <Label>API Key</Label>
              <Input value={editApiKey} onChange={(e) => setEditApiKey(e.target.value)} />
            </div>
            <div>
              <Label>Business ID</Label>
              <Input
                value={editBusinessId}
                onChange={(e) => setEditBusinessId(e.target.value)}
                placeholder="Exact Ameex business ID"
              />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input value={editBaseApi} onChange={(e) => setEditBaseApi(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !editId}
            >
              {updateMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// -------------------- LOGS --------------------

function LogsPanel({ logs }: { logs: any[] }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Integration logs</CardTitle>
        <CardDescription>Last 100 events across all integrations.</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Endpoint / Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">
                    {new Date(l.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.provider_type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.direction}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "success" ? "default" : "destructive"}>
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.http_status ?? "—"}</TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                    {l.error || l.endpoint || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
