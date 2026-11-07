# Vijayasri Footwear POS setup

This is an additive POS extension. It does **not** replace, rename, or delete the existing `public.products` table, catalogue images, or customer-facing catalogue.

## Apply the database migration
1. Open the existing Supabase project used by this repository.
2. Confirm `supabase/schema.sql` has already been applied and the current catalogue is working. Do not rerun or replace the existing schema for this POS update.
3. In Supabase SQL Editor, run these files in order:
   - `supabase/migrations/20261101_footwear_pos.sql`
   - `supabase/migrations/20261101_footwear_pos_security_fix.sql`
   - `supabase/migrations/20261107_pos_compatibility.sql` (required for the existing colour-aware catalogue and `stock_quantity` schema)
4. The existing account listed in `public.admin_users` is treated as **Owner** automatically.
5. Open `/VJSManage/pos.html` and sign in using the same Supabase email/password as VJSManage.

## Add Manager or Cashier accounts
Create each staff user's account in Supabase Authentication → Users. Copy the user's UUID, then run one statement per user in SQL Editor (replace the UUID and role):
```sql
insert into public.staff_roles(user_id, role)
values ('AUTH-USER-UUID', 'Cashier')
on conflict (user_id) do update set role = excluded.role;
``
Use `Manager` or `Cashier` as the role. Keep Owner membership restricted to the existing `admin_users` table. Do not enable public sign-ups unless there is a deliberate staff onboarding process.

## First-time stock setup
- Open **Size inventory** in POS.
- Select an existing catalogue product and add each size as its own row (for example 6, 7, 8, 9).
- Enter cost price, selling price, reorder level and opening quantity.
- Existing catalogue sizes are descriptive text; the POS uses the new `product_variants` table for actual size-level quantities.
- Do not assume the existing product size list has stock. Add and verify physical counts before selling through POS.

## Billing notes
- POS invoices are saved in `sales` and `sale_items`; stock deductions and movement history are recorded atomically by the database function.
- GST rate is entered per bill line because the applicable rate depends on the product's current tax classification. Verify HSN and GST rate with your accountant before issuing GST tax invoices.
- Choose whether the entered selling price already includes GST or GST should be added.
- Non-GST bills calculate no GST. Do not use this option to avoid a legal GST obligation.
- The receipt can be printed or saved as PDF from the browser and shared through WhatsApp.
- Sales screen shows the latest 100 bills. Daily and monthly totals are calculated across all completed bills in the current month using paged reads.

## Current scope / next implementation
This first POS increment includes secure staff sign-in, GST/non-GST checkout, per-size stock, stock adjustment, sales history, print/PDF receipt and WhatsApp sharing. Purchase-entry workflow, supplier management, returns/cancellations, full staff-role management UI, and a detailed profit dashboard are not part of this increment yet; the database includes the initial purchase tables for the next stage.

## Safety checks before going live
- Test with a non-production product and a small opening stock count.
- Confirm one completed sale deducts the selected size quantity exactly once.
- Confirm an over-stock sale is rejected and no invoice is created.
- Confirm Cashier cannot add or adjust stock.
- Confirm Manager can adjust stock and Cashier can create bills.
- Test the same shoe size in multiple colours and verify that each colour has independent stock.
- Verify daily/monthly totals when the month contains more than 100 bills.
- Confirm Owner can manage staff roles.
- Verify invoice tax treatment and GST details with your accountant before issuing live tax invoices.
