# Vijayasri Footwear — Product & Architecture Outline

## Product direction

Vijayasri Footwear is a single-workspace retail operations platform backed by one central product and inventory service. The shop POS, public website and future marketplaces must use the same product identities, SKU definitions and stock ledger.

## Single workspace

1. **Dashboard** — Sales, profit, stock alerts, purchases and activity.
2. **Products** — Brands, models, sizes, colours, images and pricing.
3. **Suppliers** — Contacts, GSTIN, price lists and supplier balances.
4. **Purchases** — Purchase bills, invoice uploads, returns and stock receipt.
5. **Inventory** — Size-wise stock, transfers, adjustments and low-stock alerts.
6. **Sales & POS** — GST/non-GST bills, payments, returns and receipts.
7. **Reports** — Sales, margins, profit, tax, stock and supplier reports.
8. **Customers & Staff** — Customer history, roles, permissions and activity.
9. **Online catalogue** — Public products, pricing, enquiries and order tracking.
10. **Marketplace centre** — Future Flipkart and Amazon listings, orders and stock sync.

## Central product and inventory model

- Maintain one canonical product master.
- Maintain one SKU per sellable variant (for example, model + colour + size).
- Track stock movements in a central, auditable stock ledger.
- Keep stock quantities by SKU and location.
- Treat POS, website and marketplace as sales channels, not independent inventory stores.

## Shared stock service and channel rules

All channels must reserve and update stock through the same inventory service to reduce overselling.

Expected order lifecycle:
1. **Check availability** against sellable on-hand stock, existing reservations and any safety buffer.
2. **Reserve atomically** when an order is accepted. A reservation must not allow two channels to claim the same units.
3. **Confirm/fulfil** by converting the reservation into a stock deduction and recording the corresponding ledger movement.
4. **Release** the reservation when an order is cancelled, expires or payment fails according to the configured channel policy.
5. **Return/reconcile** returned units through an inspected return flow; only saleable units return to available stock.
6. **Reconcile** marketplace and website stock updates with the central ledger, recording failures and retrying safely.

Inventory operations must be idempotent, auditable and concurrency-safe. Do not rely on delayed storefront quantity updates as the stock-control mechanism. Channel integrations should consume the central service/API and publish availability changes after committed inventory transactions.

## Scope and integration principles

- Shop POS supports walk-in sales.
- Website supports online orders and the existing public catalogue.
- Marketplaces are planned for future Amazon and Flipkart integration.
- Marketplace centre should be designed for listing, order ingestion and stock synchronisation, but external marketplace connectivity is not assumed to be active in the initial release.
- Preserve the existing Supabase `products` table and catalogue data. Use additive, backwards-compatible migrations; do not drop or destructively rewrite existing product data.
- Keep the management route at `/VJSManage`; do not introduce `/admin`.
- Preserve the existing customer-facing catalogue and its current theme/cart behaviour while integrating shared inventory.
- Keep this project isolated to `siranjeevi-vijayasri/VijayasriFootwear`, branch `feature/pos-role-based-access`. Do not modify `vsfootwear`, `MRSSTATIONERY` or `main`.

## Delivery approach

Implement in stages: (1) inspect and document the existing schema and application, (2) central product/SKU and stock ledger foundation, (3) shared reservation/commit/release service, (4) POS and purchasing workflows, (5) customer and staff permissions, (6) reporting, (7) website integration, and (8) marketplace adapters when credentials and API access are available.

Each stage must include migration safety checks and tests for duplicate reservations, concurrent sales, cancellation/release, returns, and channel reconciliation before being enabled in production.
