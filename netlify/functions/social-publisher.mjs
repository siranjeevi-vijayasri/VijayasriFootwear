const SITE_URL = "https://vijayasrifootwear.netlify.app";
const SHOP_WHATSAPP = "918300029513";
const SHOP_ADDRESS = "Salai Street, Ayyampettai, Tamil Nadu 614201";
const MAX_PER_RUN = 5;
const MAX_ATTEMPTS = 3;

export const config = { schedule: "*/5 * * * *" };

const env = (name) => (Netlify.env.get(name) || "").trim();

function requiredConfig() {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "META_PAGE_ID",
    "META_PAGE_ACCESS_TOKEN",
    "META_IG_USER_ID",
    "META_IG_ACCESS_TOKEN",
  ];
  const missing = names.filter((name) => !env(name));
  if (missing.length) throw new Error("Missing Netlify environment variables: " + missing.join(", "));
  return {
    supabaseUrl: env("SUPABASE_URL").replace(/\/$/, ""),
    serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    pageId: env("META_PAGE_ID"),
    pageToken: env("META_PAGE_ACCESS_TOKEN"),
    instagramId: env("META_IG_USER_ID"),
    instagramToken: env("META_IG_ACCESS_TOKEN"),
    graphVersion: env("META_GRAPH_API_VERSION") || "v26.0",
  };
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(config.supabaseUrl + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: "Bearer " + config.serviceKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  let data = null;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }
  if (!response.ok) throw new Error("Supabase request failed (" + response.status + "): " + JSON.stringify(data));
  return data;
}

async function graphPost(config, endpoint, token, parameters) {
  const response = await fetch("https://graph.facebook.com/" + config.graphVersion + "/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...parameters, access_token: token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error("Meta API error: " + (data.error?.message || JSON.stringify(data)));
  }
  return data;
}

function firstPublicImage(product) {
  const value = String(product.image_url || "").split(/[\n,]+/).map((part) => part.trim()).find(Boolean);
  if (!value) throw new Error("Product has no image URL; social post requires a public product image.");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("Product image must be available at a public HTTPS URL.");
  return value;
}

function makeCaption(product) {
  const title = [product.brand, product.name, product.model].filter(Boolean).join(" ");
  const lines = [
    "✨ New at Vijayasri Footwear",
    title,
    product.price != null ? "Price: ₹" + Number(product.price).toLocaleString("en-IN") : "",
    product.sizes ? "Available sizes: " + product.sizes : "",
    "",
    "Browse our catalogue: " + SITE_URL,
    "WhatsApp: https://wa.me/" + SHOP_WHATSAPP,
    "📍 " + SHOP_ADDRESS,
    "",
    "#VijayasriFootwear #Ayyampettai #Footwear #ShopLocal",
  ];
  return lines.filter((line, index) => line || (index > 0 && lines[index - 1])).join("\n").trim();
}

async function publishFacebook(config, row, imageUrl, caption) {
  if (row.facebook_post_id) return row.facebook_post_id;
  const result = await graphPost(
    config,
    config.pageId + "/photos",
    config.pageToken,
    { url: imageUrl, caption, published: "true" },
  );
  if (!result.id) throw new Error("Facebook did not return a photo/post ID.");
  return result.id;
}

async function publishInstagram(config, row, imageUrl, caption) {
  if (row.instagram_post_id) return row.instagram_post_id;
  const created = await graphPost(
    config,
    config.instagramId + "/media",
    config.instagramToken,
    { image_url: imageUrl, caption },
  );
  if (!created.id) throw new Error("Instagram did not return a media container ID.");

  // Meta requires the container to be published in a separate request.
  const published = await graphPost(
    config,
    config.instagramId + "/media_publish",
    config.instagramToken,
    { creation_id: created.id },
  );
  if (!published.id) throw new Error("Instagram did not return a published media ID.");
  return published.id;
}

async function updateQueue(config, id, patch) {
  await supabaseRequest(config, "social_publish_queue?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

export default async () => {
  let config;
  try {
    config = requiredConfig();
  } catch (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const rows = await supabaseRequest(
      config,
      "social_publish_queue?status=in.%28pending,partial%29&order=created_at.asc&limit=" + MAX_PER_RUN,
    );
    const results = [];

    for (const row of rows || []) {
      const attempts = Number(row.attempts || 0) + 1;
      await updateQueue(config, row.id, { status: "processing", attempts, last_error: null });

      let facebookId = row.facebook_post_id || null;
      let instagramId = row.instagram_post_id || null;
      const errors = [];
      try {
        const product = row.product_snapshot || {};
        if (!product.published) throw new Error("Product is no longer published in the catalogue.");
        const imageUrl = firstPublicImage(product);
        const caption = makeCaption(product);

        try {
          facebookId = await publishFacebook(config, { ...row, facebook_post_id: facebookId }, imageUrl, caption);
          if (facebookId !== row.facebook_post_id) await updateQueue(config, row.id, { facebook_post_id: facebookId });
        } catch (error) {
          errors.push("Facebook: " + error.message);
        }

        try {
          instagramId = await publishInstagram(config, { ...row, instagram_post_id: instagramId }, imageUrl, caption);
          if (instagramId !== row.instagram_post_id) await updateQueue(config, row.id, { instagram_post_id: instagramId });
        } catch (error) {
          errors.push("Instagram: " + error.message);
        }
      } catch (error) {
        errors.push(error.message);
      }

      const bothDone = Boolean(facebookId && instagramId);
      const anyDone = Boolean(facebookId || instagramId);
      const status = bothDone ? "published" : (attempts >= MAX_ATTEMPTS ? "failed" : (anyDone ? "partial" : "pending"));
      const lastError = errors.length ? errors.join(" | ").slice(0, 2000) : null;
      await updateQueue(config, row.id, {
        status,
        facebook_post_id: facebookId,
        instagram_post_id: instagramId,
        last_error: lastError,
        processed_at: bothDone || status === "failed" ? new Date().toISOString() : null,
      });
      results.push({ id: row.id, status, error: lastError });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Social publisher failed:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
