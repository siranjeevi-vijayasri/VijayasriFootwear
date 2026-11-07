# Vijayasri Footwear — Master Product Requirements

**Status:** Product requirements and target architecture  
**Canonical scope:** This document is the single source of truth for product scope, workflows, architecture, security, compatibility and delivery acceptance.  
**Repository:** `siranjeevi-vijayasri/VijayasriFootwear`  
**Development branch:** `feature/pos-role-based-access`

---

## 1. Product vision

Build Vijayasri Footwear as a single-workspace retail operations platform for the physical shop and its digital sales channels. The platform must use one central product master, one SKU system and one authoritative inventory ledger. Shop POS, the public website and future marketplaces must never maintain independent stock balances.

The immediate priority is a reliable shop-management and POS foundation while preserving the existing public catalogue. Amazon and Flipkart connectivity is a future integration phase, not a claim of current live integration.

## 2. Workspace navigation and modules

The management application must remain a **single workspace** at the existing custom route `/VJSManage/`. Do not introduce `/admin`.

| Module | Required scope |
|---|---|
| Dashboard | Sales, profit, stock alerts, purchases and recent activity |
| Products | Brands, models, sizes, colours, images, pricing and SKU/variant management |
| Suppliers | Supplier contacts, GSTIN, price lists, purchase history and supplier balances |
| Purchases | Purchase bills, invoice uploads, purchase returns and stock receipt |
| Inventory | Size-wise stock, transfers, adjustments, reservations and low-stock alerts |
| Sales & POS | Walk-in sales, GST/non-GST bills, payments, returns and receipts |
| Reports | Sales, margins, profit, tax, stock movement and supplier reports |
| Customers & Staff | Customer profiles/history, staff accounts, roles, permissions and activity logs |
| Online catalogue | Public products, published pricing, enquiries, cart/order tracking and order status |
| Marketplace centre | Future Amazon/Flipkart listings, marketplace orders and stock synchronisation |

All modules should share the same underlying records and permissions. Avoid duplicate product, customer, supplier or stock masters.

## 3. Central product master and SKU model

- Maintain one canonical product master for each footwear model/product.
- Maintain a distinct SKU for every sellable variant, at minimum model + colour + size. A SKU must identify exactly one stock-keeping variant.
- Store brand, model/name, audience (Men/Women/Kids/Unisex), footwear type/category, size, colour, images, description, MRP, selling price, cost and publication status as appropriate.
- Support multiple product images per model/variant and retain existing image URL support.
- Support product-level and variant-level attributes without forcing existing catalogue records into an incompatible shape.
- Keep a clear relationship between the legacy public catalogue product and its new SKU/variant records.
- Do not bulk-rename brands or product names based on fuzzy text matching. Brand spelling/normalisation changes require deliberate, reviewed data migration.

## 4. Central inventory service — critical architecture

**All channels must reserve and update stock through the same inventory service to reduce overselling.**

Channels:
- **Shop POS:** walk-in and in-store sales.
- **Website:** public catalogue orders.
- **Marketplaces:** future Amazon and Flipkart orders/listings.

Inventory requirements:
1. Maintain stock by SKU and, where needed, physical location.
2. Maintain an auditable stock ledger. Never treat a manually edited quantity as the only historical record.
3. Track on-hand, reserved, available and (if used) damaged/quarantined quantities separately.
4. Calculate available-to-sell from committed stock and active reservations, applying any configured safety buffer.
5. Reserve stock atomically inside the database/service so concurrent orders from different channels cannot reserve the same units.
6. Confirm/fulfil an order by consuming its reservation and recording the stock movement exactly once.
7. Release reservations on cancellation, expiry or payment failure according to the channel's order policy.
8. Process returns through a return/inspection workflow. Only approved saleable items are returned to available stock; damaged items remain unavailable.
9. Record purchases, receipts, sales, returns, transfers and adjustments as ledger movements with actor, timestamp, reason and source reference.
10. Make operations idempotent so retries or duplicate webhooks do not double-deduct or double-release stock.
11. Reconcile channel orders and stock updates with the central ledger. Record failures and retry safely.
12. Publish channel availability only after the underlying inventory transaction commits.

Do not rely on delayed website or marketplace quantity updates as the stock-control mechanism. Channel integrations must call the shared service/API. Use database transactions, constraints and appropriate row locking/atomic functions for reservation and deduction.

## 5. Sales, POS and payments

- Support quick walk-in sales by selecting products and exact size/colour SKU.
- Validate availability through the central inventory service before completing a sale.
- Support GST and non-GST bill types, with configurable tax treatment and transparent tax/total calculation.
- Support discounts, payment method and payment status, receipts, printable invoices/PDF and WhatsApp sharing.
- Record line-item selling price, discount, tax, cost snapshot and margin inputs so historical reports remain accurate if product prices change later.
- Support full and partial returns/refunds where the business workflow allows them; return stock must pass through the central inventory return flow.
- Prevent a sale from being completed twice when a user retries or the network reconnects.

## 6. Purchasing and suppliers

- Maintain supplier name, contact details, address and GSTIN, plus price lists and supplier balances.
- Record purchase bills, invoice number/date, supplier, line items, unit cost, tax, discounts and attachments/invoice uploads.
- Receive stock against purchase lines and create inventory ledger entries only when stock is actually received.
- Support partial receipts, purchase returns and supplier balance updates.
- Preserve purchase cost history for margin and profit reporting.

## 7. Inventory operations

- Provide size-wise and colour-wise stock visibility.
- Support stock receipt, inter-location transfers, stock adjustments, damaged/quarantined stock and low-stock thresholds.
- Require a reason and actor for manual adjustments.
- Show stock on hand, reserved, available and reorder/low-stock status distinctly.
- Provide a traceable movement history per SKU.

## 8. Customers, staff and permissions

- Maintain customer contact details and purchase/order history, subject to appropriate privacy and access controls.
- Support staff accounts and role-based permissions (for example owner/admin, manager, cashier and inventory/purchase staff).
- Enforce permissions on the server/database, not merely by hiding UI controls.
- Log important actions: sign-in/access where feasible, product changes, price changes, purchases, sales, refunds, stock adjustments, role changes and exports.
- Keep owner-controlled administration and least-privilege access. Do not expose Supabase service-role credentials in browser code.

## 9. Public online catalogue and customer experience

Preserve the current public catalogue and its existing customer-facing behaviour while progressively integrating central product/SKU and inventory services.

Required customer experience:
- Publicly display published products, brand/model, price and product images.
- Filter by brand, audience (Men/Women/Kids/Unisex), footwear type and size.
- Show footwear images clearly in the scrolling catalogue; avoid excessive cropping and allow customers to inspect images without opening every product.
- Support multiple images per product.
- Support mobile image zoom and usable desktop image zoom.
- Provide size selection and add-to-cart; make the cart easy to find and use.
- Provide WhatsApp product enquiries and order communication.
- Support online order tracking/status as the order workflow is introduced.
- Preserve the existing Diwali theme and crackers animation where currently part of the customer experience; do not add sound. Theme changes must not impair usability or accessibility.
- Do not make unpublished products public.
- Do not expose private customer or operational data through public catalogue queries.

## 10. Marketplace centre — future phase

Design for Amazon and Flipkart without pretending integrations are already active.

Future capabilities:
- Map central products/SKUs to marketplace listing identifiers.
- Publish/update listing data and channel-specific price/availability where permitted.
- Ingest marketplace orders and route them through the same reservation/fulfilment service.
- Synchronise stock from the central inventory service.
- Handle duplicate/out-of-order webhooks, cancellations, returns and reconciliation.
- Track integration status, errors and retry history.
- Store credentials securely server-side; never in frontend code.

Marketplace API access, seller accounts, approvals and credentials are prerequisites for enabling live integrations.

## 11. Reports and business metrics

Provide reports for:
- Sales by date, channel, product, SKU and staff.
- Gross margin and profit using historical cost snapshots and recorded discounts/returns.
- GST/tax summaries and bill registers.
- Current stock, reserved/available stock, low stock and stock movement.
- Purchases, supplier balances and purchase returns.
- Returns, cancellations and refunds.
- Channel reconciliation and marketplace integration exceptions when those channels are enabled.

Clearly define each metric and its treatment of tax, discounts, returns and cancelled orders. Avoid presenting estimates as realised profit.

## 12. Separate catalogue and operations projects

The product is now split into two independently deployed projects:

**Existing catalogue project**
- Repository: `siranjeevi-vijayasri/VijayasriFootwear`
- Branch for current catalogue-project maintenance: `feature/pos-role-based-access`
- Owns the current public catalogue, customer-facing experience, and existing `/VJSManage/` route until a deliberate migration plan says otherwise.
- Its existing Supabase project, product data, image storage and deployment must remain untouched by operations-platform development.
- Do not repoint the live catalogue to a new database or change its production configuration as part of building the operations platform.

**New retail operations project**
- Proposed repository: `siranjeevi-vijayasri/VijayasriFootwearOperations` (to be created separately).
- Own Supabase project, database, Auth configuration, Storage buckets, RLS policies, migrations and deployment configuration.
- Owns the new management workspace: product/SKU master, suppliers, purchases, inventory ledger, POS, billing, staff roles, reports and future marketplace adapters.
- All operations-platform implementation and migrations belong in the new repository and its dedicated Supabase project.

**Future integration**
- The new operations platform becomes the authoritative source for product/SKU and inventory data once it is production-ready.
- The existing public catalogue may later consume published products and availability through a controlled, authenticated/server-mediated integration.
- Do not copy production secrets between projects or expose service-role keys in browser code.
- Do not migrate, delete, or repoint existing catalogue data until backup, mapping, regression testing and explicit cutover approval are complete.

For the new operations project, use additive migrations within its own clean database. Inspect the new project's schema before each implementation phase.
## 13. Security, reliability and quality requirements

- Apply Row Level Security to every table containing operational or personal data.
- Validate all inventory-changing operations server-side/database-side.
- Use transaction-safe reservation, fulfilment, release and return operations.
- Add foreign keys, uniqueness constraints, non-negative stock protections and appropriate indexes.
- Use audit records for sensitive business operations.
- Avoid logging secrets, payment credentials or unnecessary customer personal information.
- Handle network retries, duplicate requests and out-of-order channel events safely.
- Provide useful error messages without leaking internal credentials or database details.
- Test desktop and mobile layouts, accessibility basics and the existing public catalogue regression paths.

## 14. Acceptance criteria

The foundation is not ready for production until tests demonstrate:

1. Existing products remain readable and publishable after migrations.
2. Each sellable size/colour variant maps to one unique SKU.
3. Two concurrent channels cannot reserve the last unit twice.
4. A confirmed sale deducts stock once, including safe retry behaviour.
5. Cancellation/expiry releases a reservation once.
6. A return does not increase available stock until it is inspected and approved.
7. Purchases and receipts increase stock through ledger entries.
8. Transfers and adjustments preserve total stock accounting and audit history.
9. A cashier cannot perform owner-only actions; database policies enforce this.
10. Public users can read only published catalogue data and cannot access operational records.
11. POS, website and future marketplace adapters use the same inventory operations.
12. Existing catalogue filters, images, cart, theme and WhatsApp enquiry continue to work.
13. GST/non-GST invoices and report calculations are verified against test cases.
14. Failed channel synchronisation is visible and can be reconciled/retried without duplicate stock movement.

## 15. Delivery sequence

1. **Create project foundations:** create the new GitHub repository and a separate Supabase project; record project identifiers, region, deployment target and secret-management approach. No credentials should be committed.
2. **Discovery and baseline:** inspect the new repository scaffold and Supabase project settings; establish migrations, environment configuration, RLS testing and deployment checks.
3. **Data foundation:** implement product master, SKU/variant model, inventory locations and stock ledger in the new database.
4. **Inventory service:** implement atomic reserve, confirm, release, return, transfer and adjustment operations plus concurrency/idempotency tests.
5. **Core operations:** suppliers, purchasing, receipts, POS, payments, invoices and returns.
6. **People and controls:** customer records, staff roles, server-side permissions and activity audit.
7. **Workspace and reports:** dashboard, module navigation and validated business reports.
8. **Catalogue integration:** only after the new platform is tested, define and implement a controlled interface from the existing catalogue to published products and availability. Preserve the live catalogue until explicit cutover approval.
9. **Marketplace readiness:** build channel adapter contracts and reconciliation framework; enable live Amazon/Flipkart integrations only after access and credentials are provided.

Every stage must be reviewed, tested and committed to the appropriate repository before moving to the next. Do not claim a feature is implemented merely because it is documented here.
## 16. Project boundaries

**Existing catalogue repository**
- `siranjeevi-vijayasri/VijayasriFootwear`
- Current designated branch: `feature/pos-role-based-access`
- Restrict changes here to catalogue maintenance and the documented future integration boundary.

**New operations repository**
- Proposed name: `siranjeevi-vijayasri/VijayasriFootwearOperations`
- To be created; all new POS/retail-operations application code and database migrations must live here.
- Use a dedicated Supabase project, separate from the existing catalogue Supabase project.

Do not modify `vsfootwear`, `MRSSTATIONERY` or `main` unless the user explicitly changes that instruction.
