

## Goal
Ameex parcel must show the **product name** (readable on label/dashboard) AND still link to the Ameex warehouse stock via SKU (so it's not treated as a free "sample" parcel).

## Current behavior
In `src/utils/ameex.ts` → `getAmeexItemLabel()` returns the **SKU only** (falling back to name). So Ameex receives `product = "572-0-13855-6429-WV x1"` — warehouse links correctly but the user sees just the cryptic SKU instead of the product name.

## Fix
Combine **SKU + product name** in the same `product` field, in a format Ameex's warehouse parser still recognizes:

```
[572-0-13855-6429-WV] Sabr – Montre Quartz pour Homme x1
```

- `[SKU]` prefix → Ameex matches this token to its warehouse product → stock auto-decrements (parcel is no longer "sample").
- The product name follows → visible on parcel label and Ameex dashboard.
- If a line has no SKU in our DB → fall back to `name xQty` only (no brackets), and surface a warning so the agent can fix the product before retrying.

## Files to edit

**`src/utils/ameex.ts`**
- Update `getAmeexItemLabel(item)`:
  - If `sku` present → return `[${sku}] ${product_name}`
  - Else → return `product_name`

That's the only behavior change — `buildAmeexParcelForm` already uses this helper and appends `xQty`.

**`src/utils/call-center.functions.ts`** — no logic change needed (already passes both `sku` and `name` into `ameexItems`). Just confirm the existing `stockErrors` warning surfaces when SKU is missing.

## Test plan
1. Confirm a fresh order in Call Center for a product with SKU.
2. In Ameex dashboard: parcel should display `[SKU] Product name x1` and warehouse stock for that SKU should decrement (parcel = "Nouveau colis", not "Sample").
3. For a product without SKU: parcel still creates with just the product name and the UI shows a warning.

