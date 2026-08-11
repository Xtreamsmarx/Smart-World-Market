/* Home page script */
let allProducts = [], currentCat = 'all';

const CAT_ICONS = {
  'Language Model':'🧠','Image Generation':'🎨','Code Generation':'💻',
  'Voice & Audio':'🎙️','Computer Vision':'👁️','Data Analysis':'📊',
  'Healthcare AI':'🏥','Financial AI':'💰','Robotics':'🤖','Cybersecurity':'🔒',
  'Physical Hardware':'⚙️','Biological':'🧬','Space Tech':'🚀',
  'Climate & Environment':'🌍','Human Services':'👤'
};

// ── Full-screen neural-net canvas ────────────────────────────
(function () {
  const cv  = document.getElementById('hero-canvas');
  const ctx = cv.getContext('2d');
  const COUNT = 140, CONNECT = 160, SPEED = 0.35;
  let W = 0, H = 0, nodes = [], mouse = {x:-999,y:-999};

  function resize() {
    W = cv.width  = window.innerWidth;
    H = cv.height = Math.max(window.innerHeight, document.querySelector('.hero')?.offsetHeight || 0);
  }

  function spawn() {
    nodes = Array.from({length:COUNT}, () => ({
      x:   Math.random()*W, y:   Math.random()*H,
      vx:  (Math.random()-.5)*SPEED, vy: (Math.random()-.5)*SPEED,
      r:   Math.random()*2.2+.5,
      hue: 215 + Math.random()*80
    }));
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    for (let i=0; i<nodes.length; i++) {
      const {x,y,vx,vy,r,hue} = nodes[i];
      // Mouse repulsion
      const mdx=x-mouse.x, mdy=y-mouse.y, md=Math.sqrt(mdx*mdx+mdy*mdy);
      if (md<100 && md>0) { nodes[i].vx+=(mdx/md)*.22; nodes[i].vy+=(mdy/md)*.22; }
      const sp=Math.sqrt(nodes[i].vx**2+nodes[i].vy**2);
      if (sp>1.5) { nodes[i].vx*=.92; nodes[i].vy*=.92; }

      for (let j=i+1; j<nodes.length; j++) {
        const dx=x-nodes[j].x, dy=y-nodes[j].y, d=Math.sqrt(dx*dx+dy*dy);
        if (d<CONNECT) {
          const alpha=(1-d/CONNECT)*.42;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(nodes[j].x,nodes[j].y);
          ctx.strokeStyle=`hsla(${hue},85%,68%,${alpha})`; ctx.lineWidth=.65; ctx.stroke();
        }
      }
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle=`hsl(${hue},85%,70%)`; ctx.fill();

      nodes[i].x+=nodes[i].vx; nodes[i].y+=nodes[i].vy;
      if (nodes[i].x<0||nodes[i].x>W) { nodes[i].vx*=-1; nodes[i].x=Math.max(0,Math.min(W,nodes[i].x)); }
      if (nodes[i].y<0||nodes[i].y>H) { nodes[i].vy*=-1; nodes[i].y=Math.max(0,Math.min(H,nodes[i].y)); }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', ()=>{ resize(); spawn(); });
  document.addEventListener('mousemove', e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ resize(); spawn(); draw(); }));
})();

// ── Typing animation ─────────────────────────────────────────
(function () {
  const phrases = [
    'anything that exists',
    'medical AI at 97% accuracy',
    'voice synthesis in 3 seconds',
    'genome decoding tools',
    'autonomous robot control',
    'asteroid tracking systems',
    'drug discovery AI',
    'climate models at 10km resolution',
    'brain-computer interfaces',
    'quantum computing chips',
  ];
  let i=0, j=0, del=false;
  const el = document.getElementById('typing-text');
  function tick() {
    const phrase = phrases[i%phrases.length];
    if (!del) {
      el.textContent = phrase.slice(0,++j);
      if (j===phrase.length) { del=true; setTimeout(tick,2000); return; }
    } else {
      el.textContent = phrase.slice(0,--j);
      if (j===0) { del=false; i++; }
    }
    setTimeout(tick, del?50:80);
  }
  tick();
})();

// ── Load products ─────────────────────────────────────────────
async function loadProducts() {
  const data = await apiFetch('/search').catch(()=>({results:[]}));
  allProducts = data.results || [];

  buildTicker(allProducts);
  renderStories(allProducts.filter(p=>p.featured).slice(0,12));
  renderTrending(allProducts.slice(0,3));
  renderUniverseMap(allProducts);
  renderFeed(allProducts.slice(0,9));
  startLiveNotifications(allProducts);
}

// ── Ticker strip ──────────────────────────────────────────────
function buildTicker(products) {
  const track = document.getElementById('ticker-track');
  const extract = c => c.match(/#[0-9a-fA-F]{3,6}/)?.[0] || '#7c3aed';
  const items = products.slice(0,30).map(p=>
    `<span class="ticker-item">
      <span class="ticker-dot" style="background:${extract(p.gradient)}"></span>
      <strong style="color:var(--t1)">${p.name}</strong>
      <span class="ticker-price">${p.price>0?'$'+p.price:'Free'}</span>
      <span style="color:rgba(255,255,255,.2)">·</span>
      <span>${p.category}</span>
    </span>`
  ).join('');
  // Duplicate for seamless loop
  track.innerHTML = items + items;
}

// ── Stories (featured circles) ────────────────────────────────
function renderStories(products) {
  document.getElementById('stories-row').innerHTML = products.map(p=>`
    <div class="story-item" onclick="location.href='/product/${p.market_id}'">
      <div class="story-ring">
        <div class="story-av" style="background:${p.gradient}">${p.name[0]}</div>
      </div>
      <div class="story-name">${p.name}</div>
      <div class="story-price">${p.price>0?'$'+p.price:'Free'}</div>
    </div>`).join('');
}

// ── Trending top 3 ────────────────────────────────────────────
function renderTrending(products) {
  const sorted = [...products].sort((a,b)=>b.downloads-a.downloads).slice(0,3);
  document.getElementById('trending-grid').innerHTML = sorted.map((p,i)=>`
    <div class="trending-card" onclick="location.href='/product/${p.market_id}'">
      <div class="trending-av" style="background:${p.gradient}">${p.name[0]}</div>
      <div style="flex:1;min-width:0">
        <div class="trending-name">${p.name}</div>
        <div class="trending-meta">⬇️ ${fmtNum(p.downloads)} · ★ ${p.rating} · ${p.category}</div>
        <div style="margin-top:.35rem;font-size:.78rem;font-weight:700;color:${p.price>0?'var(--cyan)':'#34d399'}">${p.price>0?'$'+p.price+'/'+p.billing:'Free'}</div>
      </div>
      <div class="trending-rank">#${i+1}</div>
    </div>`).join('');
}

// ── Universe Map section ──────────────────────────────────────
function renderUniverseMap(products) {
  const cats = {};
  products.forEach(p => { cats[p.category] = (cats[p.category]||0)+1; });
  const grid = document.getElementById('universe-map-grid');
  grid.innerHTML = Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,cnt])=>{
    const extract = c => c.match(/#[0-9a-fA-F]{3,6}/)?.[0]||'#7c3aed';
    const sample = products.find(p=>p.category===cat);
    const col = sample ? extract(sample.gradient) : '#7c3aed';
    return `<a class="um-card" href="/vitrin?category=${encodeURIComponent(cat)}" style="--um-col:${col}">
      <div class="um-card" style="border-color:transparent">
        <style>.um-card:hover::before{background:${col}}</style>
      </div>
      <span class="um-icon">${CAT_ICONS[cat]||'📦'}</span>
      <div class="um-name">${cat}</div>
      <div class="um-count">${cnt}</div>
      <div class="um-label">product${cnt>1?'s':''}</div>
    </a>`;
  }).join('');
}

// ── Product feed ──────────────────────────────────────────────
function renderFeed(products) {
  const grid = document.getElementById('feed-grid');
  if (!products.length) {
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--t2)">No products found.</div>';
    return;
  }
  grid.innerHTML = products.map(p=>productCard(p)).join('');
}

// ── Category filter ───────────────────────────────────────────
function filterCat(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('.cat-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat==='all' ? allProducts : allProducts.filter(p=>p.category===cat);
  document.getElementById('feed-label').textContent   = '✦ ' + (cat==='all'?'All Products':cat);
  document.getElementById('feed-title').textContent   = cat==='all' ? 'Universe Feed' : cat+' Products';
  document.getElementById('feed-subtitle').textContent= `${filtered.length} products found`;
  renderFeed(filtered.slice(0,9));
}

// ── Search ────────────────────────────────────────────────────
function handleSearch(e) {
  e.preventDefault();
  const q = document.getElementById('search-inp').value.trim();
  if (q) location.href = '/vitrin?q='+encodeURIComponent(q);
}

// ── AI Chat ───────────────────────────────────────────────────
let aiOpen=false;
function toggleAIChat() {
  aiOpen=!aiOpen;
  document.getElementById('ai-panel').style.display=aiOpen?'block':'none';
  document.getElementById('ai-toggle-btn').textContent='🤖 Ask AI Assistant '+(aiOpen?'▴':'▾');
}
async function doAskAI() {
  const q=document.getElementById('ai-input').value.trim();
  if (!q) return;
  await askAI(q, document.getElementById('ai-answer'), document.getElementById('ai-cards'));
}
document.getElementById('ai-input')?.addEventListener('keydown',e=>{ if(e.key==='Enter') doAskAI(); });

// ── Search suggestions ────────────────────────────────────────
initSuggest('search-inp','suggest-drop');

// ── Live notifications ────────────────────────────────────────
const NAMES = ['Alex M.','Sarah K.','James L.','Priya R.','Marco T.','Yuki S.','Fatima A.','Chen W.'];
const ACTIONS = ['just purchased','is evaluating','just deployed','started a trial of'];
function startLiveNotifications(products) {
  if (!products.length) return;
  let idx=0;
  setInterval(()=>{
    const p = products[Math.floor(Math.random()*Math.min(products.length,20))];
    const name = NAMES[Math.floor(Math.random()*NAMES.length)];
    const action = ACTIONS[Math.floor(Math.random()*ACTIONS.length)];
    const extract = c=>c.match(/#[0-9a-fA-F]{3,6}/)?.[0]||'#7c3aed';
    const el = document.getElementById('live-notif');
    el.innerHTML = `
      <div class="live-notif-av" style="background:${p.gradient}">${p.name[0]}</div>
      <div class="live-notif-text">
        <strong>${name}</strong> ${action}
        <strong>${p.name}</strong>
        <div class="live-notif-time">Just now · ${p.category}</div>
      </div>`;
    el.style.display='flex';
    clearTimeout(el._timeout);
    el._timeout=setTimeout(()=>{ el.style.display='none'; },4500);
  }, 8000);
}

// ── PWA ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

// ── Boot ──────────────────────────────────────────────────────
loadProducts();
initCounters();
