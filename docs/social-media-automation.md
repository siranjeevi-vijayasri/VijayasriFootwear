# Catalogue-triggered Instagram + Facebook posting

This feature adds an opt-in server-side publishing queue without changing the existing `products` table or the customer catalogue.

## How it works

1. The Supabase trigger queues a snapshot when a product is first published or a published product's catalogue fields change.
2. Netlify's scheduled function checks the queue every five minutes.
3. It publishes the first public HTTPS product image and a generated caption to the Facebook Page and Instagram professional account.
4. The queue records the platform post IDs, status, attempts, and any error. A platform that already succeeded is not intentionally re-posted when retrying the other platform.

The automation does not publish old products merely because the migration is installed. New published products and future edits are queued. A product needs a public HTTPS image URL. Image changes create a new social post; they do not replace an existing post.

## One-time setup

### 1. Create and connect the Meta accounts

- Create the Facebook Page for **Vijayasri Footwear**.
- Create an Instagram account and switch it to a Business professional account.
- Connect the Instagram professional account to the Facebook Page in Meta Business Suite.
- Keep your own account as an administrator of both.
- Create/configure a Meta developer app with the permissions needed to publish Instagram content and Facebook Page photos. Follow Meta's current publishing requirements and complete any required app review/access steps.

### 2. Apply the Supabase migration

Open the Supabase SQL Editor and run the entire file:

`supabase/migrations/20261017_social_publish_queue.sql`

This adds a separate queue table and trigger. It does not alter or replace the existing `products` table. Do not put a service-role key in `config.js` or browser JavaScript.

### 3. Configure Netlify environment variables

In **Netlify → Site configuration → Environment variables**, add these variables for the deployed site:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Existing Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role/secret key; server-side only |
| `META_PAGE_ID` | Facebook Page ID |
| `META_PAGE_ACCESS_TOKEN` | Page access token with the permissions required to publish Page photos |
| `META_IG_USER_ID` | Instagram professional account ID |
| `META_IG_ACCESS_TOKEN` | Access token permitted to publish content to that Instagram account |
| `META_GRAPH_API_VERSION` | Optional; use a currently supported Graph API version, e.g. `v26.0` if supported by your app |

Never commit access tokens or service-role keys to GitHub, and never send them in chat. Keep them only in Netlify's encrypted environment-variable settings. After adding or changing variables, redeploy the site/functions.

### 4. Deploy and test

- Deploy the branch through a pull request after reviewing and merging it.
- In Supabase, add or edit a test product and make sure **published** is enabled.
- Wait up to five minutes for the scheduled function.
- Check Netlify function logs for `social-publisher`.
- Check `public.social_publish_queue` in Supabase. `published` means both platforms returned IDs; `partial` means one platform succeeded and the other can be retried; `failed` means the maximum attempts were reached. Inspect `last_error` and platform post IDs.
- Test a product with a public HTTPS image, accurate price, sizes, and brand before using live customer-facing posts.

## Important safeguards / current scope

- The queue is not accessible to browser/anon users; the function uses the server-side service-role key.
- Only products whose `published` field is true are queued for publishing.
- Each product event creates a new social post. Frequent edits can therefore create multiple posts; edit products carefully.
- The function publishes the first URL in the existing comma/newline-separated `image_url` field, not a carousel.
- If account tokens or permissions are missing, posting will not work. The migration and code do not create social accounts or authorize Meta API access for you.
- This is organic posting, not paid local advertising or ad targeting.
