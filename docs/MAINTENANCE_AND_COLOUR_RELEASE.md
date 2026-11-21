# Coordinated maintenance and model/colour catalogue release

## Current branch behaviour

This branch intentionally enables `MAINTENANCE_MODE: true` in `config.js`. When this branch is deployed to the customer-facing production host, the public catalogue displays a temporary maintenance page and WhatsApp contact link. The private `/VJSManage/` route remains available to the owner.

Creating or pushing this branch does not itself change the live website. Deploy it to the currently connected production host only when the maintenance window is approved.

## Database migration

Run `supabase/model-colour-variants.sql` in the EXISTING catalogue Supabase project after taking a backup. It is additive and does not alter existing products or image objects.

The migration adds `product_variants` with:
- colour name and hex swatch colour;
- sizes and available sizes;
- ordered colour-specific image URL gallery;
- active flag and sort order.

Legacy products continue rendering from `products.sizes`, `products.colours` and `products.image_url` if variant rows have not been entered yet.

## VJSManage updates

For each model, add one colour per line in the Colour variants and image galleries field:

`Colour | #HEX | size1,size2,size3 | image-url-1;image-url-2`

Example:

```text
Black | #202020 | 6,7,8,9 | https://cdn.example.com/model-black-front.jpg;https://cdn.example.com/model-black-side.jpg
Tan | #B87945 | 6,7,8 | https://cdn.example.com/model-tan-front.jpg;https://cdn.example.com/model-tan-side.jpg
```

Use HTTPS image URLs. The existing product-level multi-image uploader and URL field remain available for shared/model-level images. Use images only when the shop has permission to publish them.

## Customer catalogue behaviour

- Products with the same brand and model are grouped into one model card.
- Colour swatches switch the main image and that colour's thumbnail gallery.
- Size choices update with the selected colour.
- Add-to-cart stores model, colour and size as distinct item identity.
- WhatsApp enquiry and cart message include the selected colour and size.
- Existing brand/audience/type/size filters, image zoom, cart, WhatsApp flow, seasonal design and shop information are retained.

## Validation and go-live

1. Back up the catalogue Supabase project and verify the backup.
2. Apply the additive variant migration.
3. Deploy this branch to a preview first.
4. Test existing products without variants, models with multiple legacy rows, colour variants with separate image galleries, mobile swatches, image zoom, size selection, cart identity and WhatsApp message.
5. Test VJSManage login, add/edit product, upload multiple model images, add URL galleries, remove a colour variant and publish/unpublish.
6. Confirm no changes to existing product IDs or image objects.
7. Keep maintenance enabled while data migration and regression testing are in progress.
8. Set `MAINTENANCE_MODE: false` only after Operations sync and rollback plan are ready.

## Important boundary

The catalogue variant table is a compatibility layer, not the inventory source of truth. Live size availability must eventually be supplied by the Operations sync service. Do not claim real-time inventory until that integration is deployed and tested.
