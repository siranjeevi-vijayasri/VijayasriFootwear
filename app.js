(() => {
  const WA = '918300029513';
  const config = window.VJS_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_PROJECT') && config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  const supa = configured && window.supabase ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyHint');
  let products = [];
  const brandFilter = document.getElementById('brandFilter');
  const audienceFilter = document.getElementById('audienceFilter');
  const typeFilter = document.getElementById('typeFilter');
  const sizeFilter = document.getElementById('sizeFilter');
  const resetFilters = document.getElementById('resetFilters');
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

  function productAudience(p) {
    if (p.audience) return String(p.audience).trim();
    const first = String(p.category || '').split(' - ')[0].trim();
    return ['Men', 'Women', 'Kids', 'Unisex'].includes(first) ? first : '';
  }
  function productType(p) {
    const parts = String(p.category || '').split(' - ');
    if (parts.length > 1 && ['Men', 'Women', 'Kids', 'Unisex'].includes(parts[0].trim())) return parts.slice(1).join(' - ').trim();
    return ['Sandals', 'Shoes', 'Slippers', 'Flip-Flops', 'Formal', 'Sports', 'Other'].includes(String(p.category || '').trim()) ? String(p.category).trim() : '';
  }
  function productSizes(p) {
    return [...new Set(String(p.sizes || '').split(/[，,;|/]+/).map(s => s.trim()).filter(Boolean))];
  }
  function setOptions(select, values, placeholder, selected = '') {
    const unique = [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
    select.innerHTML = '<option value="">' + esc(placeholder) + '</option>' + unique.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
    select.value = unique.includes(selected) ? selected : '';
    select.disabled = unique.length === 0;
  }
  function updateFilters() {
    const brand = brandFilter.value, audience = audienceFilter.value, type = typeFilter.value, size = sizeFilter.value;
    setOptions(brandFilter, products.map(p => String(p.brand || '').trim()), 'All brands', brand);
    const byBrand = products.filter(p => !brandFilter.value || String(p.brand || '').trim() === brandFilter.value);
    setOptions(audienceFilter, byBrand.map(productAudience), 'All audiences', audience);
    const byAudience = byBrand.filter(p => !audienceFilter.value || productAudience(p) === audienceFilter.value);
    setOptions(typeFilter, byAudience.map(productType), 'All types', type);
    const byType = byAudience.filter(p => !typeFilter.value || productType(p) === typeFilter.value);
    setOptions(sizeFilter, byType.flatMap(productSizes), 'All sizes', size);
  }
  function render() {
    const q = (document.getElementById('search')?.value || '').trim().toLowerCase();
    const brand = brandFilter?.value || '', audience = audienceFilter?.value || '', type = typeFilter?.value || '', size = sizeFilter?.value || '';
    const shown = products.filter(p => {
      const text = `${p.brand || ''} ${p.name || ''} ${p.model || ''} ${p.category || ''} ${p.sizes || ''} ${p.colours || ''}`.toLowerCase();
      return (!brand || String(p.brand || '').trim() === brand) &&
        (!audience || productAudience(p) === audience) &&
        (!type || productType(p) === type) &&
        (!size || productSizes(p).includes(size)) && text.includes(q);
    });
    grid.innerHTML = shown.map(productCard).join('');
    empty.hidden = shown.length > 0;
    if (!supa) {
      grid.innerHTML = '<div class="loading">Catalogue setup is not connected yet. The shop owner must add Supabase settings and publish approved products before they appear here.</div>';
      empty.hidden = true;
    }
  }

  // Full-screen image viewer: tap a catalogue photo, then pinch to zoom on mobile.
  let imageViewer = document.getElementById('imageViewer');
  if (!imageViewer) {
    imageViewer = document.createElement('div');
    imageViewer.id = 'imageViewer';
    imageViewer.className = 'image-viewer';
    imageViewer.hidden = true;
    imageViewer.setAttribute('role', 'dialog');
    imageViewer.setAttribute('aria-modal', 'true');
    imageViewer.setAttribute('aria-label', 'Product image viewer');
    imageViewer.innerHTML = '<button type="button" class="image-viewer-close" aria-label="Close image">×</button><div class="image-viewer-hint">Mouse wheel or + / − to zoom · Drag to inspect · Esc to close</div><div class="image-viewer-controls" aria-label="Image zoom controls"><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="reset" aria-label="Reset zoom">Reset</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div><img class="image-viewer-photo" alt="Zoomed product image">';
    document.body.appendChild(imageViewer);
  }
  const viewerPhoto = imageViewer.querySelector('.image-viewer-photo');
  let zoomScale = 1, panX = 0, panY = 0, dragging = false, dragStartX = 0, dragStartY = 0, dragOriginX = 0, dragOriginY = 0;
  const applyZoom = () => { viewerPhoto.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`; viewerPhoto.style.cursor = zoomScale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in'; };
  const resetZoom = () => { zoomScale = 1; panX = 0; panY = 0; dragging = false; applyZoom(); };
  const changeZoom = delta => { zoomScale = Math.max(1, Math.min(5, +(zoomScale + delta).toFixed(2))); if (zoomScale === 1) { panX = 0; panY = 0; } applyZoom(); };
  const closeViewer = () => { imageViewer.hidden = true; viewerPhoto.removeAttribute('src'); resetZoom(); document.body.classList.remove('image-viewer-open'); };
  imageViewer.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => { const action = button.dataset.zoom; if (action === 'in') changeZoom(0.5); else if (action === 'out') changeZoom(-0.5); else resetZoom(); }));
  imageViewer.addEventListener('wheel', event => {
    if (imageViewer.hidden) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 0.25 : -0.25);
  }, { passive: false });
  viewerPhoto.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' || zoomScale <= 1) return; dragging = true; dragStartX = event.clientX; dragStartY = event.clientY; dragOriginX = panX; dragOriginY = panY; viewerPhoto.setPointerCapture?.(event.pointerId); applyZoom(); });
  viewerPhoto.addEventListener('pointermove', event => { if (!dragging) return; panX = dragOriginX + event.clientX - dragStartX; panY = dragOriginY + event.clientY - dragStartY; applyZoom(); });
  const stopDragging = () => { if (dragging) { dragging = false; applyZoom(); } };
  viewerPhoto.addEventListener('pointerup', stopDragging); viewerPhoto.addEventListener('pointercancel', stopDragging);
  imageViewer.addEventListener('dblclick', event => { if (event.target === viewerPhoto) { if (zoomScale > 1) resetZoom(); else changeZoom(1); } });
  grid.addEventListener('click', event => {
    const thumb = event.target.closest('[data-gallery-target]');
    if (thumb) {
      const main = grid.querySelector(`[data-gallery-main="${thumb.dataset.galleryTarget}"]`);
      if (!main) return;
      main.src = thumb.dataset.galleryUrl;
      const gallery = thumb.closest('.gallery-thumbs');
      gallery?.querySelectorAll('.gallery-thumb').forEach(button => button.classList.toggle('active', button === thumb));
      return;
    }
    const mainImage = event.target.closest('[data-gallery-main]');
    if (mainImage && mainImage.src) {
      resetZoom();
      viewerPhoto.src = mainImage.src;
      viewerPhoto.alt = mainImage.alt || 'Product image';
      imageViewer.hidden = false;
      document.body.classList.add('image-viewer-open');
    }
  });
  imageViewer.addEventListener('click', event => { if (event.target === imageViewer || event.target.closest('.image-viewer-close')) closeViewer(); });
  document.addEventListener('keydown', event => {
    if (imageViewer.hidden) return;
    if (event.key === 'Escape') closeViewer();
    else if (event.key === '+' || event.key === '=') changeZoom(0.5);
    else if (event.key === '-' || event.key === '_') changeZoom(-0.5);
    else if (event.key === '0') resetZoom();
  });

  document.getElementById('search')?.addEventListener('input', render);
  brandFilter?.addEventListener('change', () => { audienceFilter.value = ''; typeFilter.value = ''; sizeFilter.value = ''; updateFilters(); render(); });
  audienceFilter?.addEventListener('change', () => { typeFilter.value = ''; sizeFilter.value = ''; updateFilters(); render(); });
  typeFilter?.addEventListener('change', () => { sizeFilter.value = ''; updateFilters(); render(); });
  sizeFilter?.addEventListener('change', render);
  resetFilters?.addEventListener('click', () => {
    brandFilter.value = ''; audienceFilter.value = ''; typeFilter.value = ''; sizeFilter.value = '';
    updateFilters(); render();
  });
  async function load() {
    if (!supa) { render(); return; }
    const { data, error } = await supa.from('products').select('*').eq('published', true).order('created_at', { ascending: false });
    if (error) { grid.innerHTML = '<div class="loading">We could not load the catalogue right now. Please contact the shop on WhatsApp.</div>'; return; }
    products = data || [];
    updateFilters();
    render();
  }
  load();
})();
