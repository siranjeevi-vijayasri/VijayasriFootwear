# Vijayasri Footwear — Netlify catalogue + VJSManage

A responsive public footwear catalogue and a separate owner admin page at `/VJSManage/`. Uses Supabase Auth, Postgres Row Level Security (RLS), and Storage for protected product editing and persistent catalogue changes. Includes a Netlify Function to import public product metadata from supported product pages.

## Shop details included
- Shop: Vijayasri Footwear
- WhatsApp: +91 83000 29513 (`918300029513` link format)
- Address: Salai St, Ayyampettai, Tamil Nadu 614201
- Logo: `assets/VS_Logo.jpg`
- Admin path: `/VJSManage/` (a custom path, not an authentication control)

## Important before launch
The package is built and deployable, but it will not show/manage live products until you connect a Supabase project and create an admin account. The `config.js` currently contains obvious placeholders. Do not put a Supabase service-role key in browser code; only use the project's public anon/publishable key. RLS in `supabase/schema.sql` is the actual access control.

## Setup and deploy
1. Create a Supabase project at https://supabase.com/.
2. Open **SQL Editor** and run all of `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and public anon/publishable key. Edit `config.js` and replace `https://YOUR_PROJECT_ID.supabase.co` and `YOUR_SUPABASE_ANON_KEY`.
4. In Supabase **Authentication → Users**, create the owner account using the intended admin email and a strong unique password. Disable public sign-ups in Authentication settings if not needed.
5. Copy that user's UUID from Authentication → Users. In SQL Editor run (replace the UUID):
   ```sql
   insert into public.admin_users (user_id) values ('PASTE-AUTH-USER-UUID-HERE');
   ```
   Never add an admin using only a client-side setting. Keep this table limited to owner-approved user IDs.
6. Test locally or deploy: sign in to Netlify at https://app.netlify.com/drop, extract this ZIP, then drag the extracted `VijayasriFootwear` folder contents (including `netlify.toml` and `netlify/functions`) to the Netlify Drop deployment area. If the Drop workflow does not deploy Functions, create a Netlify site from a Git repository or use Netlify CLI (`netlify deploy --prod`) so Functions are bundled.
7. Open `https://YOUR-SITE.netlify.app/VJSManage/`, sign in, and add products. Changes are saved to Supabase and appear in the customer catalogue when `Publish on customer catalogue` is checked.
8. Test the customer site, admin login, rejected non-admin login, image upload, product publishing, and WhatsApp enquiry from a phone before sharing the URL.

## Product image importer
In VJSManage, paste a product page URL and choose **Fetch product details and image**. The Netlify Function only accepts HTTPS pages on a small allowlist: Walkaroo, Flite, Paragon Footwear, Bata, Myntra and AJIO. It attempts to read public Open Graph/title/price metadata; sites can block automated access or render data in JavaScript, so import may fail. Always verify product name, model, image, price and image-reuse rights. Imported price is only a reference; enter your actual shop selling price before publishing. This is a page metadata importer, not a guaranteed bulk crawler or a search engine.

## Security notes
- `/VJSManage/` is a path, not a security boundary. Supabase email/password authentication plus `admin_users` checks and database/storage RLS restrict edits.
- Never put service-role keys, passwords, or private credentials in `config.js`.
- Use a strong unique admin password and keep the owner account secure.
- Publicly published product images are accessible to customers; upload only images you have permission to use.
- The importer allowlist reduces SSRF risk but does not guarantee every merchant permits scraping. Respect site terms, rate limits, and image copyright/licensing.

## Files
- `index.html`, `styles.css`, `app.js`: customer catalogue
- `VJSManage/index.html`, `VJSManage/admin.js`: login and admin UI
- `config.js`: Supabase public project settings (fill before use)
- `supabase/schema.sql`: tables, RLS, and image storage policies
- `netlify/functions/import-product.mjs`: product-page metadata importer
- `netlify.toml`: Netlify publish/function configuration

## Limitations
This package does not contain a live database or credentials, and no merchant product pages are preloaded. Real product images enter the catalogue after an admin imports a supported product URL or uploads an approved image and publishes the product. Prices should be checked and set by the shop owner.


## Admin inventory update
- Choose a common footwear brand from the Brand dropdown, or choose **Other** to type a brand not listed.
- Use **Upload product images** to select multiple JPG, PNG, or WebP files in one action. Each file must be 5 MB or smaller.
- Multi-image upload uses the existing public Supabase Storage bucket `product-images` and its admin-only upload policy. If this ZIP is a fresh deployment, run `supabase/schema.sql` in Supabase SQL Editor to create/confirm the bucket and policies.
- Product image URLs can still be pasted as comma-separated or newline-separated links.
- On desktop/laptop, open a product image to use the zoom controls; use the mouse wheel, double-click, or `+`, `-`, and `0` keys to zoom/reset.
- Keep your currently working `config.js` when deploying if it contains your real Supabase URL and publishable/anon key; the template file in this ZIP uses placeholders.
