import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { ShoppingBag, FileSpreadsheet, Truck, Copy, Trash2, Send, Plus, Pencil, Plug, CheckCircle2, AlertCircle, ExternalLink, Eye, EyeOff, RefreshCw, Webhook, MapPin, Zap, Package, PhoneOff, XCircle, RotateCcw, Clock, CheckCheck, Boxes, Sparkles } from "lucide-react";
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
    <div className="space-y-6">
      {/* Modern gradient hero */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary/80 to-primary-glow p-6 sm:p-8 text-primary-foreground shadow-xl">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Integrations Hub
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Integrations</h1>
            <p className="text-sm sm:text-base text-primary-foreground/80 max-w-xl">
              Connect Shopify stores, Google Sheets and delivery providers — manage every channel from one clean dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur px-3 py-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="font-medium">{(data?.shopify?.length ?? 0) + (data?.sheets?.length ?? 0) + (data?.providers?.length ?? 0)} connected</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="delivery" className="space-y-5">
        <TabsList className="bg-card border border-border/60 p-1 rounded-2xl shadow-sm h-auto">
          <TabsTrigger value="delivery" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 px-4 py-2">
            <Truck className="h-4 w-4" /> Delivery
          </TabsTrigger>
          <TabsTrigger value="shopify" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 px-4 py-2">
            <ShoppingBag className="h-4 w-4" /> Shopify
          </TabsTrigger>
          <TabsTrigger value="sheets" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 px-4 py-2">
            <FileSpreadsheet className="h-4 w-4" /> Google Sheets
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
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 sm:p-7 text-white shadow-lg">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 backdrop-blur p-3"><ShoppingBag className="h-7 w-7" /></div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Shopify</h2>
              <p className="text-sm text-white/80 max-w-md">Receive new orders automatically via webhooks from your Shopify stores.</p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-white text-teal-700 hover:bg-white/90 rounded-xl shadow-md">
            <Plus className="mr-1.5 h-4 w-4" /> Add store
          </Button>
        </div>
      </div>

    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader>
        <div>
          <CardTitle>Connected stores</CardTitle>
          <CardDescription>
            Manage Shopify webhooks. Configure each store in Shopify Admin → Settings → Notifications → Webhooks.
          </CardDescription>
        </div>
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
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Commandes");

  const create = useServerFn(createSheetsIntegration);
  const del = useServerFn(deleteSheetsIntegration);
  const sync = useServerFn(syncSheetNow);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          direction: "both",
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          column_mapping: {},
        },
      }),
    onSuccess: () => {
      toast.success("Configuration ajoutée");
      setOpen(false);
      setName("");
      setSpreadsheetId("");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: (id: string) => sync({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(
        r?.imported
          ? `${r.imported} nouvelle(s) commande(s) importée(s)`
          : "Sync terminée — aucune nouvelle ligne",
      );
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Pick the first integration as the active one for showing snippets.
  const active = sheets[0];
  const token = active?.column_mapping?.webhook_token ?? "";
  const webhookUrl = active ? `${baseUrl}/api/webhooks/sheets/${active.id}?token=${token}` : "";

  const exportScript = `// 1. Extensions → Apps Script (dans votre Sheet)
// 2. Collez ce code, sauvegardez, puis Deploy → New deployment → Web app
// 3. Anyone → Deploy → copiez l'URL → "Nouvelle config"

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheetName = data.sheet || 'Commandes';
    var row = data.row;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Code','Client','Téléphone','Ville','Adresse','Produit','Prix','État','Source','Boutique','Employé','Livreur','Date ajout','Date validation']);
    }
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ok: true})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: String(err)})).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const importScript = `// 1. Extensions → Apps Script (dans votre Sheet)
// 2. Collez ce code complet
// 3. Modifiez CRM_URL avec l'URL ci-dessus
// 4. Run → setupTrigger (une seule fois, autorisez les permissions)

var CRM_URL = '${webhookUrl || "https://votre-crm.app/api/webhooks/sheets/<id>?token=<token>"}';

function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t){ if (t.getHandlerFunction() === 'onNewRow') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onNewRow').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
}

function onNewRow(e) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var row = sheet.getRange(lastRow, 1, 1, 9).getValues()[0];
  // Columns: A Nom, B Téléphone, C Ville, D Adresse, E Produit, F Quantité, G Prix, H Source, I Note
  var payload = { row: row, external_id: 'sheet-row-' + lastRow };
  UrlFetchApp.fetch(CRM_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}`;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-3xl border border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent p-5 flex items-start gap-4">
        <div className="rounded-2xl bg-success/15 p-3 shrink-0">
          <FileSpreadsheet className="h-7 w-7 text-success" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Double synchronisation</h3>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              CRM → Sheets (confirmation) <CheckCircle2 className="h-4 w-4 text-success" />
            </span>
            <span className="flex items-center gap-1.5">
              Sheets → CRM (nouvelle commande) <CheckCircle2 className="h-4 w-4 text-success" />
            </span>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nouvelle config
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : sheets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune configuration encore. Cliquez sur <strong>Nouvelle config</strong> pour
              démarrer.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {active && (
        <>
          {/* Active config summary */}
          <Card>
            <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{active.name}</Badge>
                <span className="text-xs text-muted-foreground">
                  Sheet : <strong className="text-foreground">{active.sheet_name}</strong>
                </span>
                <span className="text-xs text-muted-foreground">
                  Dernière sync :{" "}
                  {active.last_sync_at
                    ? new Date(active.last_sync_at).toLocaleString()
                    : "Jamais"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => del({ data: { id: active.id } }).then(onChange)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Direction 1: CRM → Sheets */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-success">→</span> CRM → Google Sheets
                  </CardTitle>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                    Auto sur confirmation
                  </Badge>
                </div>
                <CardDescription>
                  Chaque commande confirmée est envoyée automatiquement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  1. Apps Script dans votre Sheet :
                </div>
                <CodeBlock code={exportScript} />
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>
                    Deploy → New deployment → Web app → Anyone → Deploy → copiez l'URL → ouvrez{" "}
                    <strong>"Nouvelle config"</strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Direction 2: Sheets → CRM */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-primary">←</span> Google Sheets → CRM
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      Auto sur nouvelle ligne
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncMut.mutate(active.id)}
                      disabled={syncMut.isPending || !active.spreadsheet_id}
                      title={
                        !active.spreadsheet_id
                          ? "Ajoutez le Spreadsheet ID pour activer la sync manuelle"
                          : "Relire les dernières lignes du Sheet"
                      }
                    >
                      <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
                      {syncMut.isPending ? "Sync…" : "Sync maintenant"}
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Chaque nouvelle ligne dans le Sheet crée une commande dans le CRM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                    1. URL Webhook CRM :
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl bg-muted/50 border border-border/60 px-3 py-2">
                    <code className="font-mono text-xs flex-1 truncate text-primary">
                      {webhookUrl}
                    </code>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(webhookUrl)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">
                    2. Apps Script dans votre Sheet :
                  </div>
                  <CodeBlock code={importScript} />
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <div className="text-xs font-semibold mb-2">
                    Structure du Sheet (ordre des colonnes) :
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>● A – Nom client</span>
                    <span>● B – Téléphone</span>
                    <span>● C – Ville</span>
                    <span>● D – Adresse</span>
                    <span>● E – Produit</span>
                    <span>● F – Quantité</span>
                    <span>● G – Prix</span>
                    <span>● H – Source</span>
                    <span>● I – Note</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle configuration</DialogTitle>
            <DialogDescription>
              Liez un Google Sheet pour la synchronisation bidirectionnelle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nom de la configuration</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Sheet commandes principal"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Spreadsheet ID (optionnel)</Label>
              <Input
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="1abc...XYZ (depuis l'URL du Sheet)"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nom de l'onglet</Label>
              <Input
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Commandes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name}>
              {createMut.isPending ? "Enregistrement…" : "💾 Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="rounded-xl bg-foreground/95 text-background p-3 pr-16 text-[11px] leading-relaxed font-mono overflow-x-auto max-h-72 overflow-y-auto border border-border/40">
        <code>{code}</code>
      </pre>
      <Button
        variant="secondary"
        size="sm"
        className="absolute top-2 right-2 h-7 text-xs"
        onClick={() => copy(code)}
      >
        <Copy className="mr-1 h-3 w-3" /> Copier
      </Button>
    </div>
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
    <div className="space-y-6">
      {/* Section header card with actions */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 p-6 sm:p-7 text-white shadow-lg">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 backdrop-blur p-3">
              <Truck className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Delivery</h2>
              <p className="text-sm text-white/80 max-w-md">
                Connect carrier APIs, sync shipment statuses, and trigger pickup requests in real time.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen(true)} className="bg-white text-violet-700 hover:bg-white/90 rounded-xl shadow-md">
              <Plus className="mr-1.5 h-4 w-4" /> Add Company
            </Button>
            <Button variant="outline" className="rounded-xl bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
              <Webhook className="mr-1.5 h-4 w-4" /> Webhook Logs
            </Button>
            <Button variant="outline" className="rounded-xl bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
              <Package className="mr-1.5 h-4 w-4" /> Pickup Request
            </Button>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">API Configuration</CardTitle>
              <CardDescription>Global endpoints used to communicate with carriers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ConfigField label="API Base URL" value="https://api.ameex.app" />
            <ConfigField label="Auth Headers" value="C-Api-Id, C-Api-Key" mono />
            <div className="md:col-span-2">
              <ConfigField label="Webhook URL" value={`${baseUrl}/api/webhooks/ameex/{provider_id}`} mono />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Delivery Providers</h3>
          <span className="text-xs text-muted-foreground">{providers.length} connected</span>
        </div>
        {loading ? (
          <Card className="rounded-2xl"><CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : providers.length === 0 ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="py-12 text-center">
              <Truck className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No delivery providers connected yet.</p>
              <Button className="mt-4 rounded-xl" onClick={() => setOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add your first provider
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((p, idx) => {
              const url = `${baseUrl}/api/webhooks/ameex/${p.id}?token=${p.webhook_token}`;
              return (
                <Card key={p.id} className="rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md">
                          {p.name?.[0]?.toUpperCase() ?? "D"}
                        </div>
                        <div>
                          <div className="font-semibold leading-tight">{p.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{p.provider_type}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 rounded-full text-[10px] gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                        </Badge>
                        {idx === 0 && (
                          <Badge variant="outline" className="rounded-full text-[10px] border-primary/30 text-primary">Default</Badge>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-muted/50 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Provider ID</div>
                        <code className="font-mono text-xs truncate block">{p.id}</code>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(url)} title="Copy webhook URL">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Last sync: {p.last_sync_at ? new Date(p.last_sync_at).toLocaleString() : "Never"}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => testMut.mutate(p.id)} disabled={testMut.isPending}>
                        <Send className="mr-1 h-3 w-3" /> Test
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <MapPin className="mr-1 h-3 w-3" /> Cities
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openEdit(p)}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => del({ data: { id: p.id } }).then(onChange)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Status mapping */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Delivery Status Mapping</CardTitle>
              <CardDescription>How carrier statuses map into your CRM pipeline</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <StatusChip icon={Truck} label="In Progress" tone="blue" />
            <StatusChip icon={CheckCheck} label="Delivered" tone="emerald" />
            <StatusChip icon={XCircle} label="Cancelled" tone="rose" />
            <StatusChip icon={PhoneOff} label="No Answer" tone="amber" />
            <StatusChip icon={RotateCcw} label="Return" tone="orange" />
            <StatusChip icon={Clock} label="Postponed" tone="violet" />
            <StatusChip icon={Package} label="Distribution" tone="indigo" />
          </div>
        </CardContent>
      </Card>

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
    </div>
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

// -------------------- HELPERS --------------------

function ConfigField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input value={value} readOnly className={`rounded-xl bg-muted/40 border-border/60 ${mono ? "font-mono text-xs" : ""}`} />
        <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => copy(value)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const TONE_MAP: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  orange: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
};

function StatusChip({ icon: Icon, label, tone }: { icon: any; label: string; tone: string }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium ${TONE_MAP[tone] ?? ""}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
