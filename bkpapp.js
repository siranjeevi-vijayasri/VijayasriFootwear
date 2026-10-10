(() => {
  const WA = '918300029513';
  const config = window.VJS_CONFIG || {};
  const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_PROJECT') && config.SUPABASE_ANON_KEY && !config.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
  const supa = configured && window.supabase ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const grid = document.getElementById('productGrid'); const empty = document.getElementById('emptyHint');
  let products = []; let category = 'All';
  document.getElementById('year').textContent = new Date().getFullYear();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function productCard(p) {
    const msg = `Hello Vijayasri Footwear, I am interested in ${p.brand || ''} ${p.name || 'this product'}${p.model ? ' (Model: '+p.model+')' : ''}. Please confirm sizes, colours, availability and current price.`;
    const image = p.image_url ? `<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.brand+' '+p.name)}" onerror="this.parentElement.innerHTML='<div class=\'image-fallback\'>Image unavailable</div>'">` : '<div class="image-fallback">Product photo to be added</div>';
    return `<article class="product-card"><div class="product-image">${image}</div><div class="product-info"><div class="product-brand">${esc(p.brand || 'Footwear')}</div><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc([p.model, p.category, p.sizes].filter(Boolean).join(' · '))}</div><div class="product-price">${p.price != null && p.price !== '' ? '₹'+Number(p.price).toLocaleString('en-IN') : 'Ask for price'} <small>${p.mrp && Number(p.mrp)>Number(p.price) ? `<s>₹${Number(p.mrp).toLocaleString('en-IN')}</s>` : ''}</small></div><a class="btn btn-green" target="_blank" rel="noopener" href="https://wa.me/${WA}?text=${encodeURIComponent(msg)}">Enquire on WhatsApp ↗</a></div></article>`;
  }
  function render() {
    const q = (document.getElementById('search')?.value || '').trim().toLowerCase();
    const shown = products.filter(p => (category==='All' || p.category===category || p.audience===category) && `${p.brand||''} ${p.name||''} ${p.model||''} ${p.category||''}`.toLowerCase().includes(q));
    grid.innerHTML = shown.map(productCard).join(''); empty.hidden = shown.length > 0;
    if (!supa) { grid.innerHTML = '<div class="loading">Catalogue setup is not connected yet. The shop owner must add Supabase settings and publish approved products before they appear here.</div>'; empty.hidden = true; }
  }
  document.getElementById('search')?.addEventListener('input', render);
  document.getElementById('filters')?.addEventListener('click', e => { const b=e.target.closest('[data-category]'); if(!b)return; category=b.dataset.category; document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b)); render(); });
  async function load() { if(!supa){render();return;} const {data,error}=await supa.from('products').select('*').eq('published',true).order('created_at',{ascending:false}); if(error){grid.innerHTML='<div class="loading">We could not load the catalogue right now. Please contact the shop on WhatsApp.</div>';return;} products=data||[];render(); }
  load();
})();
