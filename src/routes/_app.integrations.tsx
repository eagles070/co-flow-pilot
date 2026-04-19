import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { ShoppingBag, FileSpreadsheet, Truck, Copy, RefreshCw, Trash2, Send, Plus } from "lucide-react";
import {
  listIntegrations,
  createShopifyStore,
  deleteShopifyStore,
  createSheetsIntegration,
  deleteSheetsIntegration,
  syncSheetNow,
  createDeliveryProvider,
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
    <div>
      <PageHeader
        title="Integrations"
        description="Connect Shopify, Google Sheets and delivery providers."
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
  const create = useServerFn(createShopifyStore);
  const del = useServerFn(deleteShopifyStore);

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, domain } }),
    onSuccess: () => {
      toast.success("Shopify store added");
      setOpen(false);
      setName("");
      setDomain("");
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
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Shopify stores connected yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Webhook URL</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => {
                const url = `${baseUrl}/api/webhooks/shopify/${s.id}`;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.domain}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => copy(url)}>
                        <Copy className="mr-1 h-3 w-3" /> Copy URL
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(s.webhook_secret)}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => delMut.mutate(s.id)}
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
            <DialogTitle>Add Shopify store</DialogTitle>
            <DialogDescription>
              We'll generate a webhook URL and HMAC secret. Add them in your Shopify admin
              under <strong>Settings → Notifications → Webhooks</strong> for the
              "Order creation" event with format JSON.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Store name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Store" />
            </div>
            <div>
              <Label>Shopify domain</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="my-store.myshopify.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Adding…" : "Add store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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

  const create = useServerFn(createDeliveryProvider);
  const del = useServerFn(deleteDeliveryProvider);
  const test = useServerFn(testDeliveryProvider);

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          provider_type: providerType,
          api_id: apiId,
          api_key: apiKey,
          base_url: baseApi,
          business_id: businessId,
        },
      }),
    onSuccess: () => {
      toast.success("Provider added");
      setOpen(false);
      setApiId("");
      setApiKey("");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (r: any) => toast.success(`Provider responded: HTTP ${r.http_status}`),
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
              <Label>Business ID (optional)</Label>
              <Input
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="2"
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
