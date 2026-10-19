# Database Migration Notes — Phases 1–6

Every schema change in Phases 1–6 was designed to be additive (new fields
default to `null`/`false`/`[]`/unset). **No migration script is strictly
required to keep the app running against an existing database** — but a few
things need a one-time backfill to make the new features actually useful on
old data, listed below in the order to run them.

No live MongoDB was reachable from the environment these changes were built
in, so none of the steps below have been run against real data — they're
written and reasoned through, not executed. Test against a staging copy of
the database first.

---

## 1. Categories → hierarchy (Phase 1)

**Nothing required.** Existing categories have no `parent` — Mongoose
applies the schema default (`parent: null`), which means every existing
category becomes a top-level (root) category automatically. `ancestors: []`
and `level: 0` follow the same way. No script needed.

## 2. Units (Phase 3)

**Optional.** `Product.unit` is optional; existing products without one
simply show no unit. If you want existing products to display a unit:

```js
// One-time backfill example — adjust the match/unit to your catalog
const Unit = require('./models/Unit');
const Product = require('./models/Product');

const piece = await Unit.findOne({ name: 'Piece' });
await Product.updateMany({ unit: { $exists: false } }, { unit: piece._id, unitValue: 1 });
```

## 3. Category attribute templates (Phase 4)

**Nothing required.** `Category.attributeTemplate` defaults to `[]` —
existing categories have no required fields, so existing products pass
validation on their next update unchanged. Only newly-added `required`
template fields on a category affect that category's products going
forward.

## 4. Variants (Phase 5)

**Nothing required for existing products** — `hasVariants` defaults to
`false`, so every existing product keeps behaving exactly as a simple
(non-variant) product. `User.cart[].variant` and `Order.items[].variant`
default to `null`.

If you want to convert an existing product's `colors`/`sizes` arrays into
real Variant documents (own SKU/price/stock per combination), that's a
deliberate content decision per product, not a blanket script — doing it
automatically would need to invent SKUs and split a single stock number
across combinations without knowing the real per-combination stock, which
would fabricate data. Recommend doing this product-by-product through the
new `/products/:productId/variants` API as each one is actually re-merchandised.

## 5. Inventory / Warehouses (Phase 6) — ⚠️ backfill required before using `/inventory`

This is the one migration that actually matters. `Product.stock` /
`Variant.stock` are now a **synced aggregate** of `WarehouseStock.available`
records — but no `WarehouseStock` records exist yet for pre-Phase-6 data.

**If you run any `/inventory` operation before backfilling, the first
`syncAggregateStock()` call will recompute the aggregate from an EMPTY
ledger and zero out that product's stock.** Run this before using the
Inventory module in production:

```js
// scripts/backfill-warehouse-stock.js — same logic seed/index.js now runs
// automatically for freshly-seeded data; run this once for an EXISTING database.
const Warehouse = require('./models/Warehouse');
const WarehouseStock = require('./models/WarehouseStock');
const Product = require('./models/Product');
const Variant = require('./models/Variant');

async function backfill() {
  let warehouse = await Warehouse.findOne({ isDefault: true });
  if (!warehouse) {
    warehouse = await Warehouse.create({ name: 'Main Warehouse', code: 'MAIN', isDefault: true });
  }

  const products = await Product.find({ isDeleted: false, hasVariants: false });
  const variants = await Variant.find({});

  const records = [
    ...products.map((p) => ({ product: p._id, variant: null, warehouse: warehouse._id, available: p.stock || 0 })),
    ...variants.map((v) => ({ product: v.product, variant: v._id, warehouse: warehouse._id, available: v.stock || 0 })),
  ];

  for (const r of records) {
    await WarehouseStock.updateOne(
      { product: r.product, variant: r.variant, warehouse: r.warehouse },
      { $setOnInsert: r },
      { upsert: true }
    );
  }
  console.log(`Backfilled ${records.length} warehouse stock records`);
}
```

Run this **once**, after deploying Phase 6 but before any admin uses
`/inventory/purchase`, `/adjust`, `/transfer`, etc.

## Indexes

New indexes are declared on the schemas themselves (`Category.parent+name`,
`Category.ancestors`, `Product.unit`, `Variant.sku` unique,
`WarehouseStock.product+variant+warehouse` unique,
`StockMovement.product+variant+createdAt`, `StockMovement.warehouse+createdAt`).
Mongoose creates these automatically on first connection in a dev
environment; for a production replica set, consider building them with
`{ background: true }` during a low-traffic window if the existing
collections are large, since a unique-index build on `Variant.sku` will
fail if any two existing variants (there shouldn't be any pre-Phase-5) share
a SKU.

## Transactions

Phase 6's inventory operations use MongoDB multi-document transactions when
the deployment supports them (replica set — this includes every MongoDB
Atlas cluster). **Standalone MongoDB does not support transactions**; the
code detects this and falls back to sequential non-atomic writes rather
than crashing, but that fallback is only safe for single-writer/dev use, not
concurrent production traffic. Confirm your production deployment is a
replica set.

---

## 6. Mobile OTP auth (Phase 7) — ⚠️ check for duplicate mobile numbers before deploying

`User.mobile` changed from unindexed to `unique + sparse`. If any two
existing users already share the same non-empty mobile value (e.g. a
placeholder like `"0000000000"` entered by more than one account), the
unique index will fail to build. Check first:

```js
// Run before deploying Phase 7
const dupes = await User.aggregate([
  { $match: { mobile: { $ne: null, $ne: '' } } },
  { $group: { _id: '$mobile', count: { $sum: 1 }, ids: { $push: '$_id' } } },
  { $match: { count: { $gt: 1 } } },
]);
console.log(dupes); // must be empty before the unique index can build
```

If duplicates exist, resolve them (clear the mobile field on all but one
account, or correct the data) before deploying.

**Sessions:** no backfill needed. Existing logged-in users simply have no
`Session` document until their next login — their current access token
keeps working until it naturally expires (≤15 min), and their next
`/auth/login` or refresh attempt will either succeed normally (creating a
session) or require a fresh login. The old `user.refreshToken` field is
left in place, unused, rather than dropped.

## 8. Phases 16–20 — no required backfill

Every new collection (`NotificationTemplate`, `NotificationJob`,
`AuditLog`, `Blog`, `BlogCategory`, `Media`, `MediaFolder`, `Page`,
`HomeSection`, `Faq`, `Settings`) starts empty and is populated organically
or via its seeder — nothing here needs a backfill against existing data.

`User.failedLoginAttempts`/`lockUntil`/`permissions`/`pushTokens` are all
`default`-backed — existing users simply read back with the defaults
(`0`/`null`/`[]`/`[]`) on next load. No script needed.

**One operational step, not a data migration:** if you want API caching
(Phase 19) or the notification retry queue to actually run against Redis
in production, set `REDIS_URL`. Without it, both features are safe no-ops
(already the state this was built and verified in) — nothing breaks, you
just don't get the performance benefit until it's set.

**Required for the notification queue and scheduled blog publishing to
actually run:** nothing extra — `services/scheduler.service.js` starts
automatically in `server.js` once the server boots. If running multiple
instances behind a load balancer, see the "Known limitations" note in
`docs/API.md` before relying on exactly-once job processing.

