(() => {
  const WA = '918300029513';
  const config = window.VJS_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_PROJECT') && config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  const supa = configured && window.supabase ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyHint');
  let products = [];
  const CART_KEY = 'vjs-footwear-cart-v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (!Array.isArray(cart)) cart = []; } catch (_) { cart = []; }
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const cartItems = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');
  const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const brandFilter = document.getElementById('brandFilter');
  const audienceFilter = document.getElementById('audienceFilter');
  const typeFilter = document.getElementById('typeFilter');
  const sizeFilter = document.getElementById('sizeFilter');
  const resetFilters = document.getElementById('resetFilters');
  document.getElementById('year').textContent = new Date().getFullYear();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const imageUrls = value => [...new Set(String(value || '').split(/[\n,]+/).map(url => url.trim()).filter(Boolean))];

  function productCard(p) {
    const urls = imageUrls(p.image_url);
    const msg = `Hello Vijayasri Footwear, I am interested in ${p.brand || ''} ${p.name || 'this product'}${p.model ? ' (Model: '+p.model+')' : ''}. Please confirm sizes, colours, availability and current price.${urls[0] ? '\n\nProduct image: ' + urls[0] : ''}`;
    const galleryId = 'gallery-' + String(p.id || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g, '');
    let gallery = '<div class="image-fallback">Product photo to be added</div>';
    if (urls.length) {
      gallery = `<div class="gallery-main"><img data-gallery-main="${galleryId}" loading="lazy" src="${esc(urls[0])}" alt="${esc((p.brand || '') + ' ' + (p.name || 'footwear'))}" onerror="this.alt='Image unavailable';this.style.opacity='.35'"></div>`;
      if (urls.length > 1) {
        gallery += `<div class="gallery-thumbs" aria-label="More product images">${urls.map((url, index) => `<button type="button" class="gallery-thumb${index === 0 ? ' active' : ''}" data-gallery-target="${galleryId}" data-gallery-url="${esc(url)}" aria-label="View image ${index + 1}"><img loading="lazy" src="${esc(url)}" alt=""></button>`).join('')}</div>`;
      }
    }
    const sizes = productSizes(p);
    const sizePicker = sizes.length
      ? `<label class="cart-size-label">Size <select class="cart-size-select" data-cart-size="${esc(p.id)}"><option value="">Choose size</option>${sizes.map(size => `<option value="${esc(size)}">${esc(size)}</option>`).join('')}</select></label>`
      : '<p class="cart-size-hint">Size can be confirmed with the shop</p>';
    return `<article class="product-card"><div class="product-image product-gallery">${gallery}</div><div class="product-info"><div class="product-brand">${esc(p.brand || 'Footwear')}</div><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc([p.model, p.category, p.sizes].filter(Boolean).join(' · '))}</div><div class="product-price">${p.price != null && p.price !== '' ? '₹'+Number(p.price).toLocaleString('en-IN') : 'Ask for price'} <small>${p.mrp && Number(p.mrp)>Number(p.price) ? `<s>₹${Number(p.mrp).toLocaleString('en-IN')}</s>` : ''}</small></div>${sizePicker}<button class="btn btn-add-cart" type="button" data-add-cart="${esc(p.id)}">＋ Add to cart</button><a class="btn btn-green" target="_blank" rel="noopener" href="https://wa.me/${WA}?text=${encodeURIComponent(msg)}">Enquire on WhatsApp ↗</a></div></article>`;
  }

  function persistCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (_) {}
    renderCart();
  }
  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.textContent = String(count);
    const floatingCart = document.getElementById('floatingCart');
    if (floatingCart) { floatingCart.hidden = count === 0; const floatingCount = document.getElementById('floatingCartCount'); if (floatingCount) floatingCount.textContent = String(count); }
    if (cartItems) {
      cartItems.innerHTML = cart.length ? cart.map(item => `
        <article class="cart-item">
          ${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy">` : '<div class="cart-item-placeholder">👟</div>'}
          <div class="cart-item-info"><strong>${esc(item.brand)} ${esc(item.name)}</strong><small>${esc(item.model || '')}${item.model ? ' · ' : ''}Size: ${esc(item.size || 'To confirm')}</small><b>${item.price != null ? money(item.price * item.quantity) : 'Price to confirm'}</b>
            <div class="cart-quantity"><button type="button" data-cart-action="minus" data-cart-key="${esc(item.key)}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-cart-action="plus" data-cart-key="${esc(item.key)}" aria-label="Increase quantity">+</button><button type="button" class="cart-remove" data-cart-action="remove" data-cart-key="${esc(item.key)}">Remove</button></div>
          </div>
        </article>`).join('') : '<div class="cart-empty"><span>🪔</span><strong>Your cart is waiting to sparkle</strong><p>Add a few footwear favourites from the catalogue.</p></div>';
    }
    const total = cart.reduce((sum, item) => sum + (item.price == null ? 0 : item.price * item.quantity), 0);
    if (cartTotal) cartTotal.textContent = money(total);
    const checkout = document.getElementById('checkoutWhatsApp');
    if (checkout) checkout.disabled = cart.length === 0;
  }
  function openCart() {
    if (!cartDrawer || !cartBackdrop) return;
    cartDrawer.hidden = false; cartBackdrop.hidden = false;
    document.body.classList.add('cart-open');
    renderCart();
  }
  function closeCart() {
    if (!cartDrawer || !cartBackdrop) return;
    cartDrawer.hidden = true; cartBackdrop.hidden = true;
    document.body.classList.remove('cart-open');
  }
  grid.addEventListener('click', event => {
    const addButton = event.target.closest('[data-add-cart]');
    if (!addButton) return;
    const product = products.find(item => String(item.id) === String(addButton.dataset.addCart));
    if (!product) return;
    const sizes = productSizes(product);
    const picker = grid.querySelector(`[data-cart-size="${CSS.escape(String(product.id))}"]`);
    const chosenSize = picker ? picker.value : 'Size to confirm';
    if (sizes.length && !chosenSize) {
      picker?.focus();
      if (picker) picker.setCustomValidity('Please choose a size first.');
      picker?.reportValidity();
      picker?.addEventListener('change', () => picker.setCustomValidity(''), { once: true });
      return;
    }
    const size = chosenSize || 'Size to confirm';
    const key = String(product.id) + '::' + size;
    const existing = cart.find(item => item.key === key);
    if (existing) existing.quantity += 1;
    else cart.push({ key, id: String(product.id), brand: product.brand || 'Footwear', name: product.name || 'Footwear', model: product.model || '', price: product.price == null || product.price === '' || !Number.isFinite(Number(product.price)) ? null : Number(product.price), image: imageUrls(product.image_url)[0] || '', size, quantity: 1 });
    persistCart();
    addButton.textContent = '✓ Added';
    window.setTimeout(() => { if (addButton.isConnected) addButton.textContent = '＋ Add to cart'; }, 1200);
  });
  cartItems?.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-action]');
    if (!button) return;
    const item = cart.find(entry => entry.key === button.dataset.cartKey);
    if (!item) return;
    if (button.dataset.cartAction === 'plus') item.quantity += 1;
    if (button.dataset.cartAction === 'minus') item.quantity -= 1;
    if (button.dataset.cartAction === 'remove' || item.quantity <= 0) cart = cart.filter(entry => entry.key !== item.key);
    persistCart();
  });
  document.getElementById('cartToggle')?.addEventListener('click', openCart);
  document.getElementById('floatingCart')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('continueShopping')?.addEventListener('click', closeCart);
  cartBackdrop?.addEventListener('click', closeCart);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && cartDrawer && !cartDrawer.hidden) closeCart(); });
  document.getElementById('checkoutWhatsApp')?.addEventListener('click', () => {
    if (!cart.length) return;
    const lines = cart.map((item, index) => `${index + 1}. ${item.brand} ${item.name}${item.model ? ' (' + item.model + ')' : ''} | Size: ${item.size || 'To confirm'} | Qty: ${item.quantity} | ${item.price == null ? 'Price to confirm' : money(item.price * item.quantity)}${item.image ? '\n   Product image: ' + item.image : ''}`);
    const total = cart.reduce((sum, item) => sum + (item.price == null ? 0 : item.price * item.quantity), 0);
    const message = `Hello Vijayasri Footwear! I'd like to enquire about these items from my cart:\n\n${lines.join('\n')}\n\nEstimated total for priced items: ${money(total)}\nPlease confirm size, availability and final price. This is an order enquiry; no payment has been made.`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  });
  renderCart();

  // Run colourful fireworks across the full viewport for sixty seconds.
  const diwaliHero = document.querySelector('.diwali-hero');
  const diwaliDecor = document.querySelector('.diwali-decor');
  let fireworksStopTimer = null;

  function createFireworkParticles() {
    if (!diwaliDecor) return;
    const palette = ['#ffcf33', '#ff4f64', '#35c9ff', '#a8f05a', '#ff8c42', '#f7f2ff', '#d86bff'];
    diwaliDecor.querySelectorAll('.firework').forEach((firework, fireworkIndex) => {
      firework.textContent = '';
      firework.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 18; i++) {
        const particle = document.createElement('span');
        const angle = (Math.PI * 2 * i / 18) + (fireworkIndex * 0.17);
        const distance = 34 + (i % 3) * 13;
        particle.className = 'firework-particle';
        particle.style.setProperty('--dx', (Math.cos(angle) * distance) + 'px');
        particle.style.setProperty('--dy', (Math.sin(angle) * distance) + 'px');
        particle.style.setProperty('--particle-colour', palette[(i + fireworkIndex * 2) % palette.length]);
        particle.style.setProperty('--particle-delay', ((i % 6) * 0.025) + 's');
        firework.appendChild(particle);
      }
    });
  }

  function startFireworksForSixtySeconds() {
    createFireworkParticles();
    if (diwaliHero && diwaliDecor) { diwaliHero.classList.add('fireworks-active'); diwaliDecor.classList.add('fireworks-active'); }
    let overlay = document.getElementById('siteFireworks');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'siteFireworks'; overlay.className = 'site-fireworks'; overlay.setAttribute('aria-hidden', 'true'); document.body.appendChild(overlay); }
    overlay.classList.add('site-fireworks-active');
    let burstCount = 0;
    const launchRocket = () => {
      if (!overlay.isConnected || !overlay.classList.contains('site-fireworks-active')) return;
      const width = window.innerWidth || 1200, height = window.innerHeight || 800;
      const x = 35 + Math.random() * Math.max(1, width - 70), targetY = 70 + Math.random() * Math.max(1, height * 0.62);
      const rocket = document.createElement('span'); rocket.className = 'site-rocket';
      rocket.style.setProperty('--rocket-x', x + 'px'); rocket.style.setProperty('--rocket-y', targetY + 'px');
      rocket.style.setProperty('--rocket-flight', (0.55 + Math.random() * 0.4) + 's');
      rocket.style.setProperty('--rocket-colour', ['#ffcf33','#ff4f64','#35c9ff','#a8f05a','#ff8c42','#d86bff'][burstCount % 6]);
      overlay.appendChild(rocket);
      window.setTimeout(() => {
        if (!overlay.isConnected) return;
        rocket.remove();
        const colours = ['#ffcf33','#ff4f64','#35c9ff','#a8f05a','#ff8c42','#f7f2ff','#d86bff'];
        const burst = document.createElement('span'); burst.className = 'site-rocket-burst';
        burst.style.setProperty('--burst-x', x + 'px'); burst.style.setProperty('--burst-y', targetY + 'px');
        for (let i = 0; i < 24; i++) {
          const particle = document.createElement('i'), angle = (Math.PI * 2 * i / 24) + Math.random() * 0.12, distance = 35 + Math.random() * 65;
          particle.style.setProperty('--burst-dx', (Math.cos(angle) * distance) + 'px'); particle.style.setProperty('--burst-dy', (Math.sin(angle) * distance) + 'px');
          particle.style.setProperty('--burst-colour', colours[(i + burstCount) % colours.length]); burst.appendChild(particle);
        }
        overlay.appendChild(burst); window.setTimeout(() => burst.remove(), 1350); burstCount++;
      }, 620);
    };
    launchRocket(); const rocketTimer = window.setInterval(launchRocket, 420);
    if (fireworksStopTimer) window.clearTimeout(fireworksStopTimer);
    fireworksStopTimer = window.setTimeout(() => {
      window.clearInterval(rocketTimer); overlay.classList.remove('site-fireworks-active');
      if (diwaliHero) diwaliHero.classList.remove('fireworks-active'); if (diwaliDecor) diwaliDecor.classList.remove('fireworks-active');
      window.setTimeout(() => { if (overlay.isConnected) overlay.remove(); }, 1500);
    }, 60000);
  }

  startFireworksForSixtySeconds();

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
