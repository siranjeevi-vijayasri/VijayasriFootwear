(() => {
  const cfg = window.VJS_CONFIG || {};
  const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_PROJECT') &&
    cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE') && window.supabase;
  const el = id => document.getElementById(id);
  const status = el('status');
  let client = null;
  let all = [];
  let adminId = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function say(message, error = false) {
    status.textContent = message;
    status.className = 'status' + (error ? ' error' : '');
  }

  function parseImageUrls(value) {
    return [...new Set(String(value || '').split(/[\n,]+/).map(url => url.trim()).filter(Boolean))];
  }

  if (!ready) {
    say('Setup required: edit config.js with your Supabase project URL and publishable/anon key, run supabase/schema.sql, and create the first admin.', true);
    el('loginForm').querySelector('button').disabled = true;
    return;
  }

  client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  async function verifyAdmin() {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      showLoggedOut();
      return false;
    }
    const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error || !data) {
      await client.auth.signOut();
      showLoggedOut();
      say(error ? 'Could not verify admin access: ' + error.message : 'This account is not authorised for VJSManage.', true);
      return false;
    }
    adminId = user.id;
    el('loginPanel').hidden = true;
    el('adminApp').hidden = false;
    await loadProducts();
    say('Signed in. Changes are saved to the connected catalogue.');
    return true;
  }

  function showLoggedOut() {
    el('loginPanel').hidden = false;
    el('adminApp').hidden = true;
  }

  el('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    say('Signing in…');
    const { error } = await client.auth.signInWithPassword({
      email: el('email').value.trim(),
      password: el('password').value
    });
    if (error) {
      say('Sign-in failed: ' + error.message, true);
      return;
    }
    await verifyAdmin();
  });

  el('logout').addEventListener('click', async () => {
    await client.auth.signOut();
    showLoggedOut();
    say('Signed out.');
  });

  async function loadProducts() {
    const { data, error } = await client.from('products').select('*').order('created_at', { ascending: false });
    if (error) {
      say('Could not load products: ' + error.message, true);
      return;
    }
    all = data || [];
    el('productRows').innerHTML = all.length ? all.map(product => {
      const firstImage = parseImageUrls(product.image_url)[0];
      return `<tr><td>${firstImage ? `<img src="${esc(firstImage)}" alt="Product photo">` : '—'}</td><td><b>${esc(product.brand)} ${esc(product.name)}</b><div class="muted">${esc(product.model || '')} · ${esc(product.category || '')}</div><div class="muted">${parseImageUrls(product.image_url).length} image(s)</div></td><td>${product.price == null ? '—' : '₹' + Number(product.price).toLocaleString('en-IN')}</td><td>${product.published ? 'Yes' : 'Draft'}</td><td><button class="small-btn" data-edit="${esc(product.id)}">Edit</button> <button class="small-btn danger" data-delete="${esc(product.id)}">Delete</button></td></tr>`;
    }).join('') : '<tr><td colspan="5">No products yet. Add a product above.</td></tr>';
  }

  function reset() {
    el('productForm').reset();
    syncBrandField('');
    el('productId').value = '';
    el('formTitle').textContent = 'Add a product';
    el('published').checked = false;
  }

  const brandSelect = el('brand');
  const customBrand = el('customBrand');
  function syncBrandField(value = brandSelect.value) {
    const isOther = value === 'Other';
    customBrand.style.display = isOther ? 'block' : 'none';
    customBrand.required = isOther;
    if (!isOther) customBrand.value = '';
  }
  brandSelect.addEventListener('change', () => syncBrandField());
  el('resetForm').addEventListener('click', reset);

  el('productRows').addEventListener('click', async event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    if (edit) {
      const product = all.find(item => item.id === edit.dataset.edit);
      if (!product) return;
      el('productId').value = product.id;
      const knownBrands = [...brandSelect.options].map(option => option.value);
      if (knownBrands.includes(product.brand || '')) {
        brandSelect.value = product.brand || '';
        customBrand.value = '';
      } else {
        brandSelect.value = 'Other';
        customBrand.value = product.brand || '';
      }
      syncBrandField();
      el('name').value = product.name || '';
      el('model').value = product.model || '';
      const categoryParts = String(product.category || '').split(' - ');
      const savedAudience = ['Men', 'Women', 'Kids', 'Unisex'].includes(categoryParts[0]) ? categoryParts[0] : (['Men', 'Women', 'Kids'].includes(product.category) ? product.category : 'Men');
      const savedType = categoryParts.length > 1 ? categoryParts.slice(1).join(' - ') : (['Sandals', 'Shoes', 'Slippers', 'Flip-Flops', 'Formal', 'Sports', 'Other'].includes(product.category) ? product.category : 'Other');
      el('audience').value = savedAudience;
      el('category').value = savedType;
      el('price').value = product.price ?? '';
      el('mrp').value = product.mrp ?? '';
      el('sizes').value = product.sizes || '';
      el('colours').value = product.colours || '';
      el('imageUrl').value = parseImageUrls(product.image_url).join(', ');
      el('imageFile').value = '';
      el('sourcePage').value = product.source_url || '';
      el('description').value = product.description || '';
      el('published').checked = !!product.published;
      el('formTitle').textContent = 'Edit product';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (del && confirm('Delete this product? This cannot be undone.')) {
      const { error } = await client.from('products').delete().eq('id', del.dataset.delete);
      if (error) say(error.message, true);
      else { say('Product deleted.'); await loadProducts(); }
    }
  });

  async function collectImageUrls() {
    const urls = parseImageUrls(el('imageUrl').value);
    const files = Array.from(el('imageFile').files || []);
    const maxBytes = 5 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    for (const file of files) {
      if (file.size > maxBytes) throw new Error(`"${file.name}" is larger than 5 MB. Please resize it and try again.`);
      if (!allowedTypes.includes(file.type)) throw new Error(`"${file.name}" is not a supported image. Use JPG, PNG or WebP.`);
    }
    if (files.length) {
      say(`Uploading ${files.length} image(s)…`);
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${adminId}/${Date.now()}-${index}-${safeName}`;
        const { error } = await client.storage.from('product-images').upload(path, file, {
          upsert: false, contentType: file.type, cacheControl: '3600'
        });
        if (error) {
          throw new Error(`Could not upload "${file.name}". Check that the Supabase "product-images" bucket exists, is public for display, and its upload policy allows admins. Details: ${error.message}`);
        }
        const { data } = client.storage.from('product-images').getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
        else throw new Error(`Upload succeeded for "${file.name}", but a public image URL could not be created.`);
      }
    }
    const uniqueUrls = [...new Set(urls)];
    for (const url of uniqueUrls) {
      let parsed;
      try { parsed = new URL(url); } catch { throw new Error('One of the image URLs is invalid: ' + url); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Image URLs must start with http:// or https://');
    }
    return uniqueUrls;
  }

  el('productForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      say('Saving product…');
      const imageUrls = await collectImageUrls();
      const payload = {
        brand: (el('brand').value === 'Other' ? el('customBrand').value : el('brand').value).trim(),
        name: el('name').value.trim(),
        model: el('model').value.trim() || null,
        // Store both choices in the existing category column; no database migration needed.
        category: `${el('audience').value} - ${el('category').value}`, 
        price: el('price').value === '' ? null : Number(el('price').value),
        mrp: el('mrp').value === '' ? null : Number(el('mrp').value),
        sizes: el('sizes').value.trim() || null,
        colours: el('colours').value.trim() || null,
        // Backward-compatible: store comma-separated URLs in the existing text column.
        image_url: imageUrls.length ? imageUrls.join(',') : null,
        source_url: el('sourcePage').value.trim() || null,
        description: el('description').value.trim() || null,
        published: el('published').checked,
        updated_at: new Date().toISOString()
      };
      if (payload.price !== null && payload.price < 0) throw new Error('Price cannot be negative.');
      if (payload.mrp !== null && payload.mrp < 0) throw new Error('MRP cannot be negative.');
      const id = el('productId').value;
      const result = id
        ? await client.from('products').update(payload).eq('id', id)
        : await client.from('products').insert(payload);
      if (result.error) throw result.error;
      reset();
      await loadProducts();
      say(`Product saved with ${imageUrls.length} image(s).`);
    } catch (error) {
      say(error.message || 'Unable to save product.', true);
    }
  });

  el('scrapeBtn').addEventListener('click', async () => {
    const url = el('sourceUrl').value.trim();
    if (!url) { say('Enter a product page URL first.', true); return; }
    say('Fetching public product metadata…');
    try {
      const response = await fetch('/.netlify/functions/import-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Import failed');
      const product = result.product || {};
      if (product.name && !el('name').value) el('name').value = product.name;
      if (product.brand && !el('brand').value) {
        const knownBrands = [...brandSelect.options].map(option => option.value);
        if (knownBrands.includes(product.brand)) brandSelect.value = product.brand;
        else { brandSelect.value = 'Other'; customBrand.value = product.brand; }
        syncBrandField();
      }
      if (product.price != null && !el('price').value) el('price').value = product.price;
      if (product.mrp != null && !el('mrp').value) el('mrp').value = product.mrp;
      if (product.image_url) el('imageUrl').value = product.image_url;
      el('sourcePage').value = url;
      say('Metadata fetched. Verify all details and image URLs before saving.');
    } catch (error) {
      say(error.message || 'Product import failed.', true);
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) { showLoggedOut(); say('Could not restore session: ' + error.message, true); return; }
    return data.session ? verifyAdmin() : showLoggedOut();
  });
})();
