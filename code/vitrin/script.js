/* Vitrin script — improved filters */
let allProds = [], filtered = [], view = 'grid';
let state = { cat:'all', price:'all', rating:0, billing:'all', search:'', sort:'default', verified:false, cpu:false, api:false, minP:null, maxP:null };

const CAT_ICONS = {'Language Model':'🧠','Image Generation':'🎨','Code Generation':'💻','Voice & Audio':'🎙️','Computer Vision':'👁️','Data Analysis':'📊','Healthcare AI':'🏥','Financial AI':'💰','Robotics':'🤖','Cybersecurity':'🔒','Physical Hardware':'⚙️','Biological':'🧬','Space Tech':'🚀','Climate & Environment':'🌍','Human Services':'👤'};

async function init() {
  initParticles('cv', 50);
  const qs = new URLSearchParams(location.search);
  if (qs.get('q'))        { state.search  = qs.get('q');        document.getElementById('fb-search').value = state.search; }
  if (qs.get('category')) { state.cat = qs.get('category'); }
  if (qs.get('sort'))     { state.sort = qs.get('sort'); document.getElementById('sort-sel').value = state.sort; }

  const data = await apiFetch('/search').catch(()=>({results:[]}));
  allProds = data.results || [];
  buildCatTabs();
  buildSidebarCats();
  syncCatTabUI();
  applyAll();
}

// ── Category tab bar ──────────────────────────────────────────
function buildCatTabs() {
  const cats = [...new Set(allProds.map(p=>p.category))].sort();
  const wrap = document.getElementById('cat-tabs');
  document.getElementById('count-all').textContent = allProds.length;
  cats.forEach(c => {
    const cnt = allProds.filter(p=>p.category===c).length;
    const btn = document.createElement('button');
    btn.className = 'cat-tab';
    btn.dataset.cat = c;
    btn.innerHTML = `${CAT_ICONS[c]||'📦'} ${c} <span class="cat-count">${cnt}</span>`;
    btn.onclick = () => setCat(c, btn);
    wrap.appendChild(btn);
  });
}

function syncCatTabUI() {
  document.querySelectorAll('.cat-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === state.cat);
  });
}

// ── Sidebar category list ─────────────────────────────────────
function buildSidebarCats() {
  const cats = [...new Set(allProds.map(p=>p.category))].sort();
  const container = document.getElementById('sidebar-cats');
  container.innerHTML = cats.map(c => {
    const cnt = allProds.filter(p=>p.category===c).length;
    return `<div class="sb-cat-item ${state.cat===c?'active':''}" data-cat="${c}" onclick="setCat('${c.replace(/'/g,"\\'")}')">
      <span>${CAT_ICONS[c]||'📦'} ${c}</span>
      <span class="sb-cat-count">${cnt}</span>
    </div>`;
  }).join('');
}

// ── Filter setters ────────────────────────────────────────────
function setCat(cat, btn) {
  state.cat = cat;
  document.querySelectorAll('.cat-tab').forEach(b=>b.classList.toggle('active', b.dataset.cat===cat));
  document.querySelectorAll('.sb-cat-item').forEach(b=>b.classList.toggle('active', b.dataset.cat===cat));
  applyAll();
}
function setPrice(val, btn) {
  state.price = val;
  document.querySelectorAll('[data-price]').forEach(b=>b.classList.toggle('active', b.dataset.price===val));
  applyAll();
}
function setRating(val, btn) {
  state.rating = Number(val);
  document.querySelectorAll('[data-rat]').forEach(b=>b.classList.toggle('active', Number(b.dataset.rat)===Number(val)));
  applyAll();
}
function setBilling(val, btn) {
  state.billing = val;
  document.querySelectorAll('[data-bill]').forEach(b=>b.classList.toggle('active', b.dataset.bill===val));
  applyAll();
}
let searchTimer;
function onSearch() {
  clearTimeout(searchTimer);
  const q = document.getElementById('fb-search').value;
  document.getElementById('fb-clear-search').style.display = q ? 'block' : 'none';
  searchTimer = setTimeout(() => { state.search = q; applyAll(); }, 220);
}
function clearSearch() {
  document.getElementById('fb-search').value = '';
  document.getElementById('fb-clear-search').style.display = 'none';
  state.search = '';
  applyAll();
}

// ── Master apply ──────────────────────────────────────────────
function applyAll() {
  const q        = state.search.toLowerCase();
  const minPrice = parseFloat(document.getElementById('min-price').value) || null;
  const maxPrice = parseFloat(document.getElementById('max-price').value) || null;
  const sort     = document.getElementById('sort-sel').value;
  const verified = document.getElementById('tog-verified').checked;
  const cpuOnly  = document.getElementById('tog-cpu').checked;
  const apiOnly  = document.getElementById('tog-api').checked;

  filtered = allProds.filter(p => {
    // Category
    if (state.cat !== 'all' && p.category !== state.cat) return false;
    // Rating
    if (p.rating < state.rating) return false;
    // Price chip
    if (state.price === 'free'  && p.price > 0) return false;
    if (state.price === 'low'   && (p.price > 100 || p.price === 0)) return false;
    if (state.price === 'mid'   && (p.price < 100 || p.price > 500)) return false;
    if (state.price === 'high'  && p.price <= 500) return false;
    // Custom price range
    if (minPrice !== null && p.price < minPrice) return false;
    if (maxPrice !== null && p.price > maxPrice) return false;
    // Billing
    if (state.billing !== 'all' && p.billing !== state.billing) return false;
    // Toggles
    if (verified && !p.seller_verified) return false;
    if (cpuOnly  && p.specs?.gpu_required) return false;
    if (apiOnly  && !p.specs?.api_available) return false;
    // Search
    if (q) {
      const hay = (p.name+p.short_description+p.category+(p.tags||[]).join(' ')+p.seller).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Sort
  if (sort === 'rating')    filtered.sort((a,b)=>b.rating-a.rating);
  else if (sort==='popular') filtered.sort((a,b)=>b.downloads-a.downloads);
  else if (sort==='price_asc') filtered.sort((a,b)=>a.price-b.price);
  else if (sort==='price_desc') filtered.sort((a,b)=>b.price-a.price);
  else if (sort==='newest') filtered.sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
  else filtered.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||b.rating-a.rating);

  render();
  updateActiveFilters();
  updateURL(sort, q);
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const grid = document.getElementById('vitrin-grid');
  const noR  = document.getElementById('no-results');
  const cnt  = document.getElementById('result-count');
  cnt.innerHTML = `<strong>${filtered.length}</strong> of <strong>${allProds.length}</strong> products`;
  if (!filtered.length) { grid.innerHTML=''; noR.style.display='block'; return; }
  noR.style.display = 'none';
  grid.innerHTML = filtered.map(p => productCard(p)).join('');
  if (view==='list') grid.classList.add('list-view'); else grid.classList.remove('list-view');
}

// ── Active filter pills ───────────────────────────────────────
function updateActiveFilters() {
  const pills = [];
  if (state.cat !== 'all')     pills.push({label:`📂 ${state.cat}`,     clear:()=>{state.cat='all';setCat('all');}});
  if (state.price !== 'all')   pills.push({label:`💰 ${state.price}`,   clear:()=>setPrice('all')});
  if (state.rating > 0)        pills.push({label:`★ ${state.rating}+`,  clear:()=>setRating(0)});
  if (state.billing !== 'all') pills.push({label:`📅 ${state.billing}`, clear:()=>setBilling('all')});
  if (state.search)            pills.push({label:`🔍 "${state.search}"`,clear:clearSearch});

  const bar = document.getElementById('active-filters');
  const pill_el = document.getElementById('active-pills');
  const clearBtn = document.getElementById('clear-all-btn');

  if (pills.length) {
    bar.style.display='flex';
    clearBtn.style.display='block';
    pill_el.innerHTML = pills.map((p,i)=>
      `<span class="af-pill" onclick="pills_clear_${i}()">${p.label} ×</span>`
    ).join('');
    pills.forEach((p,i)=>{ window[`pills_clear_${i}`] = ()=>{ p.clear(); }; });
  } else {
    bar.style.display='none';
    clearBtn.style.display='none';
  }
}

// ── Clear all ─────────────────────────────────────────────────
function clearAllFilters() {
  state = {cat:'all',price:'all',rating:0,billing:'all',search:'',sort:'default',verified:false,cpu:false,api:false,minP:null,maxP:null};
  document.getElementById('fb-search').value='';
  document.getElementById('fb-clear-search').style.display='none';
  document.getElementById('sort-sel').value='default';
  document.getElementById('min-price').value='';
  document.getElementById('max-price').value='';
  document.getElementById('tog-verified').checked=false;
  document.getElementById('tog-cpu').checked=false;
  document.getElementById('tog-api').checked=false;
  document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active', b.dataset.price==='all'||b.dataset.rat==='0'||b.dataset.bill==='all'));
  syncCatTabUI();
  document.querySelectorAll('.sb-cat-item').forEach(b=>b.classList.toggle('active', b.dataset.cat==='all'));
  applyAll();
}

// ── View toggle ───────────────────────────────────────────────
function setView(v, btn) {
  view=v;
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const grid=document.getElementById('vitrin-grid');
  if(v==='list') grid.classList.add('list-view'); else grid.classList.remove('list-view');
}

// ── URL sync ──────────────────────────────────────────────────
function updateURL(sort, q) {
  const p = new URLSearchParams();
  if (q) p.set('q',q);
  if (state.cat!=='all') p.set('category',state.cat);
  if (sort!=='default') p.set('sort',sort);
  history.replaceState(null,'','?'+p.toString());
}

init();
