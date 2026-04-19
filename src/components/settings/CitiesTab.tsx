import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { fetchAmeexCities } from "@/utils/ameex-cities.functions";

interface Props {
  isAdmin: boolean;
}

interface CityRow {
  id: string;
  name: string;
  delivery_cost: number;
  return_cost: number;
  is_active: boolean;
  ameex_city_id: string | null;
}

interface AmeexCity {
  id: string;
  code: string;
  name: string;
}

export function CitiesTab({ isAdmin }: Props) {
  const [rows, setRows] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CityRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    delivery_cost: 0,
    return_cost: 0,
    ameex_city_id: "",
  });
  const [ameexCities, setAmeexCities] = useState<AmeexCity[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [savingMap, setSavingMap] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cities").select("*").order("name");
    setRows((data ?? []) as CityRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const syncAmeex = async () => {
    setSyncing(true);
    try {
      const result = await fetchAmeexCities();
      if (!result.ok) {
        toast.error(result.error || "Failed to fetch Ameex cities");
        return;
      }
      setAmeexCities(result.cities);
      toast.success(`Loaded ${result.cities.length} cities from Ameex`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch Ameex cities");
    } finally {
      setSyncing(false);
    }
  };

  const ameexById = useMemo(() => {
    const map = new Map<string, AmeexCity>();
    for (const c of ameexCities) map.set(c.id, c);
    return map;
  }, [ameexCities]);

  // Auto-suggest Ameex IDs by name match (case-insensitive, normalized)
  const autoMap = async () => {
    if (!ameexCities.length) {
      toast.error("Click 'Sync Ameex cities' first");
      return;
    }
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const ameexByName = new Map<string, AmeexCity>();
    for (const c of ameexCities) ameexByName.set(normalize(c.name), c);

    const updates: { id: string; ameex_city_id: string }[] = [];
    for (const r of rows) {
      if (r.ameex_city_id) continue;
      const match = ameexByName.get(normalize(r.name));
      if (match) updates.push({ id: r.id, ameex_city_id: match.id });
    }
    if (!updates.length) {
      toast.info("No new matches found");
      return;
    }
    let ok = 0;
    for (const u of updates) {
      const { error } = await supabase
        .from("cities")
        .update({ ameex_city_id: u.ameex_city_id })
        .eq("id", u.id);
      if (!error) ok++;
    }
    toast.success(`Auto-mapped ${ok} city(ies)`);
    load();
  };

  const setAmeexId = async (row: CityRow, value: string) => {
    setSavingMap(row.id);
    const newId = value === "__none__" ? null : value;
    const { error } = await supabase
      .from("cities")
      .update({ ameex_city_id: newId })
      .eq("id", row.id);
    setSavingMap(null);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ameex_city_id: newId } : r)));
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", delivery_cost: 0, return_cost: 0, ameex_city_id: "" });
    setOpen(true);
  };

  const openEdit = (r: CityRow) => {
    setEditing(r);
    setForm({
      name: r.name,
      delivery_cost: r.delivery_cost,
      return_cost: r.return_cost,
      ameex_city_id: r.ameex_city_id ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("City name is required");
    const payload = {
      name: form.name.trim(),
      delivery_cost: Number(form.delivery_cost) || 0,
      return_cost: Number(form.return_cost) || 0,
      ameex_city_id: form.ameex_city_id.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("cities").update(payload).eq("id", editing.id)
      : await supabase.from("cities").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("City saved");
    setOpen(false);
    load();
  };

  const remove = async (r: CityRow) => {
    const { error } = await supabase.from("cities").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("City deleted");
    load();
  };

  const toggleActive = async (r: CityRow, checked: boolean) => {
    await supabase.from("cities").update({ is_active: checked }).eq("id", r.id);
    load();
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast.error("File is empty");
    const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());

    const nameIdx = ["city_name", "name", "city"]
      .map((h) => headers.indexOf(h))
      .find((i) => i >= 0) ?? -1;
    const dIdx = ["delivery_price", "delivery_cost"]
      .map((h) => headers.indexOf(h))
      .find((i) => i >= 0) ?? -1;
    const rIdx = ["refused_price", "return_cost", "return_price"]
      .map((h) => headers.indexOf(h))
      .find((i) => i >= 0) ?? -1;

    if (nameIdx < 0)
      return toast.error("Header missing. Expected: city_name,delivery_price,refused_price");

    const inserts: { name: string; delivery_cost: number; return_cost: number }[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(/[,;\t]/).map((c) => c.trim());
      const name = cols[nameIdx];
      if (!name) continue;
      inserts.push({
        name,
        delivery_cost: dIdx >= 0 ? Number(cols[dIdx]) || 0 : 0,
        return_cost: rIdx >= 0 ? Number(cols[rIdx]) || 0 : 0,
      });
    }
    if (!inserts.length) return toast.error("No rows parsed");
    const dedupMap = new Map<string, { name: string; delivery_cost: number; return_cost: number }>();
    for (const row of inserts) dedupMap.set(row.name.toLowerCase(), row);
    const deduped = Array.from(dedupMap.values());
    const { error } = await supabase.from("cities").upsert(deduped, { onConflict: "name" });
    if (error) return toast.error(error.message);
    toast.success(`Imported ${inserts.length} cities`);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const downloadTemplate = () => {
    const csv = [
      "city_name,delivery_price,refused_price",
      "Casablanca,25,10",
      "Rabat,30,12",
      "Marrakech,35,15",
      "Tanger,40,18",
      "Fes,35,15",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cities_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filtered = rows.filter((r) =>
    search ? r.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const unmappedCount = rows.filter((r) => !r.ameex_city_id).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Cities</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Map each local city to an Ameex city ID so shipments are accepted.
            Click <strong>Sync Ameex cities</strong>, then <strong>Auto-map</strong>{" "}
            or pick the Ameex city in each row.
          </p>
          {unmappedCount > 0 && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              {unmappedCount} city(ies) not yet mapped to Ameex.
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap justify-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <Button size="sm" variant="outline" onClick={syncAmeex} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Ameex cities
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={autoMap}
              disabled={!ameexCities.length}
            >
              Auto-map by name
            </Button>
            <Button size="sm" variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNew}>
                  <Plus className="mr-2 h-4 w-4" /> New city
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit city" : "New city"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>City name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Casablanca"
                    />
                  </div>
                  <div>
                    <Label>Ameex city ID</Label>
                    <Input
                      value={form.ameex_city_id}
                      onChange={(e) =>
                        setForm({ ...form, ameex_city_id: e.target.value })
                      }
                      placeholder="e.g. 21"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Numeric ID from Ameex. Use Sync Ameex cities to discover values.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Delivery price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.delivery_cost}
                        onChange={(e) =>
                          setForm({ ...form, delivery_cost: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label>Refused price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.return_cost}
                        onChange={(e) =>
                          setForm({ ...form, return_cost: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={submit}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <Input
            placeholder="Search cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No cities yet." : "No cities match your search."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City name</TableHead>
                <TableHead>Ameex city</TableHead>
                <TableHead className="text-right">Delivery</TableHead>
                <TableHead className="text-right">Refused</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const matched = r.ameex_city_id ? ameexById.get(r.ameex_city_id) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      {ameexCities.length > 0 && isAdmin ? (
                        <Select
                          value={r.ameex_city_id ?? "__none__"}
                          onValueChange={(v) => setAmeexId(r, v)}
                          disabled={savingMap === r.id}
                        >
                          <SelectTrigger className="h-8 w-[220px]">
                            <SelectValue placeholder="— not mapped —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— not mapped —</SelectItem>
                            {ameexCities.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} ({c.code} · #{c.id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : r.ameex_city_id ? (
                        <span className="text-xs text-muted-foreground">
                          #{r.ameex_city_id}
                          {matched ? ` · ${matched.name}` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          Not mapped
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{Number(r.delivery_cost).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(r.return_cost).toFixed(2)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={r.is_active}
                        disabled={!isAdmin}
                        onCheckedChange={(v) => toggleActive(r, v)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete city?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(r)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
