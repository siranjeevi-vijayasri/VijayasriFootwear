(() => {
  const WA = '918300029513';
  const config = window.VJS_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_PROJECT') && config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  const supa = configured && window.supabase ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyHint');
  let products = [];
  let category = 'All';
  document.getElementById('year').textContent = new Date().getFullYear();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const imageUrls = value => [...new Set(String(value || '').split(/[\n,]+/).map(url => url.trim()).filter(Boolean))];

  function productCard(p) {
    const msg = `Hello Vijayasri Footwear, I am interested in ${p.brand || ''} ${p.name || 'this product'}${p.model ? ' (Model: '+p.model+')' : ''}. Please confirm sizes, colours, availability and current price.`;
    const urls = imageUrls(p.image_url);
    const galleryId = 'gallery-' + String(p.id || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g, '');
    let gallery = '<div class="image-fallback">Product photo to be added</div>';
    if (urls.length) {
      gallery = `<div class="gallery-main"><img data-gallery-main="${galleryId}" loading="lazy" src="${esc(urls[0])}" alt="${esc((p.brand || '') + ' ' + (p.name || 'footwear'))}" onerror="this.alt='Image unavailable';this.style.opacity='.35'"></div>`;
      if (urls.length > 1) {
        gallery += `<div class="gallery-thumbs" aria-label="More product images">${urls.map((url, index) => `<button type="button" class="gallery-thumb${index === 0 ? ' active' : ''}" data-gallery-target="${galleryId}" data-gallery-url="${esc(url)}" aria-label="View image ${index + 1}"><img loading="lazy" src="${esc(url)}" alt=""></button>`).join('')}</div>`;
      }
    }
    return `<article class="product-card"><div class="product-image product-gallery">${gallery}</div><div class="product-info"><div class="product-brand">${esc(p.brand || 'Footwear')}</div><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc([p.model, p.category, p.sizes].filter(Boolean).join(' · '))}</div><div class="product-price">${p.price != null && p.price !== '' ? '₹'+Number(p.price).toLocaleString('en-IN') : 'Ask for price'} <small>${p.mrp && Number(p.mrp)>Number(p.price) ? `<s>₹${Number(p.mrp).toLocaleString('en-IN')}</s>` : ''}</small></div><a class="btn btn-green" target="_blank" rel="noopener" href="https://wa.me/${WA}?text=${encodeURIComponent(msg)}">Enquire on WhatsApp ↗</a></div></article>`;
  }

  function render() {
    const q = (document.getElementById('search')?.value || '').trim().toLowerCase();
    const shown = products.filter(p => { const parts = String(p.category || '').split(' - '); const matchesCategory = category === 'All' || parts.includes(category) || p.category === category || p.audience === category; return matchesCategory && `${p.brand || ''} ${p.name || ''} ${p.model || ''} ${p.category || ''}`.toLowerCase().includes(q); });
    grid.innerHTML = shown.map(productCard).join('');
    empty.hidden = shown.length > 0;
    if (!supa) {
      grid.innerHTML = '<div class="loading">Catalogue setup is not connected yet. The shop owner must add Supabase settings and publish approved products before they appear here.</div>';
      empty.hidden = true;
    }
  }

  // Thumbnail clicks change the main image for that product only.
  grid.addEventListener('click', event => {
    const thumb = event.target.closest('[data-gallery-target]');
    if (!thumb) return;
    const main = grid.querySelector(`[data-gallery-main="${thumb.dataset.galleryTarget}"]`);
    if (!main) return;
    main.src = thumb.dataset.galleryUrl;
    const gallery = thumb.closest('.gallery-thumbs');
    gallery?.querySelectorAll('.gallery-thumb').forEach(button => button.classList.toggle('active', button === thumb));
  });

  document.getElementById('search')?.addEventListener('input', render);
  document.getElementById('filters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button));
    render();
  });
  async function load() {
    if (!supa) { render(); return; }
    const { data, error } = await supa.from('products').select('*').eq('published', true).order('created_at', { ascending: false });
    if (error) { grid.innerHTML = '<div class="loading">We could not load the catalogue right now. Please contact the shop on WhatsApp.</div>'; return; }
    products = data || [];
    render();
  }
  load();
})();
