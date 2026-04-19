import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Trash2, Check, ChevronsUpDown, PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductOpt {
  id: string;
  name: string;
  sku: string | null;
  sell_price: number;
}

export interface LineItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  products: ProductOpt[];
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export function ProductLineEditor({ products, items, onChange }: Props) {
  const [pickProduct, setPickProduct] = useState("");
  const [open, setOpen] = useState(false);
  const lastAddedRef = useRef<string | null>(null);
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const total = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items]
  );

  // Auto-focus quantity input after adding
  useEffect(() => {
    if (lastAddedRef.current && qtyRefs.current[lastAddedRef.current]) {
      const el = qtyRefs.current[lastAddedRef.current];
      el?.focus();
      el?.select();
      lastAddedRef.current = null;
    }
  }, [items]);

  const addItem = (productId?: string) => {
    const id = productId ?? pickProduct;
    if (!id) return;
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const existing = items.find((i) => i.product_id === p.id);
    if (existing) {
      onChange(
        items.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      onChange([
        ...items,
        {
          product_id: p.id,
          product_name: p.name,
          quantity: 1,
          unit_price: Number(p.sell_price),
        },
      ]);
    }
    lastAddedRef.current = p.id;
    setPickProduct("");
    setOpen(false);
  };

  const updateItem = (pid: string, patch: Partial<LineItem>) =>
    onChange(items.map((i) => (i.product_id === pid ? { ...i, ...patch } : i)));

  const removeItem = (pid: string) =>
    onChange(items.filter((i) => i.product_id !== pid));

  const selectedLabel = pickProduct
    ? products.find((p) => p.id === pickProduct)?.name
    : "";

  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Products *</Label>
        <span className="text-base font-bold text-primary">
          Total: {total.toFixed(2)}
        </span>
      </div>

      {/* Searchable product picker */}
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal"
            >
              <span className="flex items-center gap-2 truncate">
                <PackageSearch className="h-4 w-4 shrink-0 opacity-60" />
                {selectedLabel ||
                  (products.length === 0
                    ? "No products available"
                    : "Search and select a product...")}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by name or SKU..." />
              <CommandList>
                <CommandEmpty>No product found.</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.sku ?? ""}`}
                      onSelect={() => addItem(p.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          items.some((i) => i.product_id === p.id)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">
                        {p.name}
                        {p.sku ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({p.sku})
                          </span>
                        ) : null}
                      </span>
                      <span className="ml-2 text-xs font-medium">
                        {Number(p.sell_price).toFixed(2)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="default"
          onClick={() => addItem()}
          disabled={!pickProduct}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Items table */}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
          No products added yet. Pick one above to start.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="h-9">Product</TableHead>
                <TableHead className="h-9 w-20 text-center">Qty</TableHead>
                <TableHead className="h-9 w-28 text-center">Price</TableHead>
                <TableHead className="h-9 w-24 text-right">Subtotal</TableHead>
                <TableHead className="h-9 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.product_id}>
                  <TableCell className="py-1.5 text-sm font-medium">
                    {i.product_name}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      ref={(el) => {
                        qtyRefs.current[i.product_id] = el;
                      }}
                      type="number"
                      min={1}
                      value={i.quantity}
                      onChange={(e) =>
                        updateItem(i.product_id, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="h-8 text-center"
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={i.unit_price}
                      onChange={(e) =>
                        updateItem(i.product_id, {
                          unit_price: Number(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-center"
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-sm font-semibold">
                    {(i.quantity * i.unit_price).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(i.product_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
