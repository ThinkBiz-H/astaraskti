# Changelog — Phases 1–6

Status: **Phases 1–6 complete and verified** (module load-checked in isolated
processes; live-MongoDB behavior not runtime-tested — no database is
reachable from the environment these changes were built in). **Phases 7–10
(OTP auth, Shiprocket production integration, order timeline, CMS) are not
started.**

Every change below is additive or backward-compatible unless explicitly
listed under "Breaking changes."

---

## Phase 1 — Category Hierarchy

**Added**
- `parent` / `ancestors` / `level` on `Category` — unlimited-depth nesting
- `services/category.service.js` — reparent with cycle detection, subtree
  ancestor recompute, delete-guard (blocks deleting a category with
  children or products)
- `GET /categories?tree=true`, `?parent=<id>`
- `Product` listing by `category` now matches that category **and every
  descendant** (was exact-match only)

**Breaking**
- `Category.name` was globally unique; now unique **per parent**

## Phase 2 — Product Architecture

**Added** (all optional fields, nothing existing removed)
- `unit`, `unitValue`, `relatedProducts`, `crossSell`, `upSell`, `weight`,
  `dimensions`, `shippingClass`, `minOrderQuantity`, `maxOrderQuantity`,
  `warranty`, `returnPolicy`, `videoUrl`, `documents`, `seoKeywords`,
  `hasVariants` on `Product`
- Required-attribute validation against the product's category's
  attribute template (see Phase 4) on create/update

## Phase 3 — Units

**Added**
- `Unit` model + full CRUD (`/units`) — admin-managed, no unit hardcoded
  anywhere in the app
- Seeder with the units list from spec (kg, gm, ltr, ml, piece, pair, set,
  box, pack, etc.), each with `allowDecimal`

## Phase 4 — Dynamic Category Attributes

**Added**
- `Category.attributeTemplate` — `[{key, label, type, options, unit, required}]`
- `getEffectiveAttributeTemplate()` — merges a category's template with
  every ancestor's (root-first; more specific level overrides same `key`)
- `GET /categories/:id/attribute-template` — what the admin product form
  should call to know which fields to render for the selected category

## Phase 5 — Variant Engine

**Added**
- `Variant` model (own SKU/barcode/price/salePrice/stock/weight/dimensions/images/status), separate collection, `product` ref
- Full CRUD nested under products: `/products/:productId/variants`
- `isDefault` enforcement (exactly one default variant per product;
  auto-promotes the next one if the default is deleted)
- **Cart, Wishlist move-to-cart, and Order** all made variant-aware end to
  end — a product with `hasVariants: true` requires a `variantId`, and
  price/stock resolve from the variant, not the product. This was not
  optional polish: without it, variants would exist in the admin but never
  be purchasable.

**Breaking**
- `User.cart[]` items gained a `variant` field (default `null` — existing
  carts/non-variant products unaffected)
- `Order.items[]` gained `variant` and `sku` fields (default `null` /
  unset — existing orders unaffected)

## Phase 6 — Inventory

**Added**
- `Warehouse`, `WarehouseStock` (available/reserved/damaged/incoming +
  low-stock threshold, per product-or-variant per warehouse), `StockMovement`
  (immutable audit ledger) models
- `services/inventory.service.js` — purchase, signed adjustment, transfer,
  reserve/release, mark-damaged, all through one atomic `applyMovement`
  primitive; MongoDB transactions where the deployment supports them
  (replica set / Atlas), safe non-atomic fallback on standalone MongoDB
- `/warehouses` and `/inventory` admin APIs
- Low-stock/out-of-stock admin notifications via the existing per-user
  Notification system (best-effort, not deduplicated across repeated
  breaches)
- Admin dashboard's `/admin/dashboard/low-stock` extended to also report
  variant-level low stock (was product-only)

**Design decisions (not breaking, but worth knowing)**
- `Product.stock` / `Variant.stock` remain flat numbers, kept as a
  **synced aggregate** (sum of `available` across warehouses) — Cart,
  Checkout, and product listing needed zero changes
- Checkout's stock-deduction **timing is unchanged** from before this
  phase (COD on order creation, online payment on verified payment) — it
  now also writes a `StockMovement` and updates `WarehouseStock`.
  `reserveStock`/`releaseReservedStock` exist as building blocks for a
  future two-phase checkout but are not auto-triggered by cart/checkout today.

---

## Not yet implemented

- **Phase 7 — OTP Authentication**
- **Phase 8 — Shiprocket production integration**
- **Phase 9 — Complete order timeline / Shiprocket event mapping**
- **Phase 10 — CMS**
