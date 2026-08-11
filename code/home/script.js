/* Smart World Market — homepage interactions */
let allProducts = [];
let currentCat = 'all';

const CAT_ICONS = {
  'Language Model':'🧠','Image Generation':'🎨','Code Generation':'⌨️',
  'Voice & Audio':'◉','Computer Vision':'👁','Data Analysis':'▦',
  'Healthcare AI':'✚','Financial AI':'↗','Robotics':'🤖','Cybersecurity':'◇',
  'Physical Hardware':'⚙','Biological':'🧬','Space Tech':'🚀',
  'Climate & Environment':'◎','Human Services':'◯'
};

const safeText = value => String(value ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#039;');

const colorFromGradient = value => String(value || '').match(/#[0-9a-fA-F]{3,8}/)?.[0] || '#7c66ff';
const formatPrice = p => Number(p?.price) > 0 ? `$${p.price}${p.billing ? `/${p.billing}` : ''}` : 'Free';

// Neural field background — adaptive density and reduced-motion aware.
(function initHeroCanvas() {
  const cv = document.getElementById('hero-canvas');
  if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  let W=0, H=0, nodes=[], raf=0;
  const pointer={x:-9999,y:-9999,active:false};
  const dpr=Math.min(window.devicePixelRatio || 1, 1.75);

  function config() {
    const mobile=window.innerWidth < 700;
    return { count:mobile ? 56 : 92, connect:mobile ? 118 : 148, speed:.22 };
  }
  function resize() {
    const rect=cv.getBoundingClientRect();
    W=Math.max(1,rect.width); H=Math.max(1,rect.height);
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    spawn();
  }
  function spawn() {
    const cfg=config();
    nodes=Array.from({length:cfg.count},()=>({
      x:Math.random()*W,y:Math.random()*H,
      vx:(Math.random()-.5)*cfg.speed,vy:(Math.random()-.5)*cfg.speed,
      r:Math.random()*1.4+.45,hue:215+Math.random()*80
    }));
  }
  function draw() {
    const cfg=config();
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<nodes.length;i++) {
      const n=nodes[i];
      if(pointer.active) {
        const dx=n.x-pointer.x,dy=n.y-pointer.y,d=Math.hypot(dx,dy);
        if(d<130 && d>0) { n.vx+=(dx/d)*.012;n.vy+=(dy/d)*.012; }
      }
      const speed=Math.hypot(n.vx,n.vy);
      if(speed>.72){n.vx*=.96;n.vy*=.96;}

      for(let j=i+1;j<nodes.length;j++) {
        const other=nodes[j],d=Math.hypot(n.x-other.x,n.y-other.y);
        if(d<cfg.connect) {
          ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(other.x,other.y);
          ctx.strokeStyle=`hsla(${n.hue},90%,72%,${(1-d/cfg.connect)*.18})`;
          ctx.lineWidth=.55;ctx.stroke();
        }
      }
      ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
      ctx.fillStyle=`hsla(${n.hue},90%,76%,.72)`;ctx.fill();
      n.x+=n.vx;n.y+=n.vy;
      if(n.x<-4)n.x=W+4;if(n.x>W+4)n.x=-4;if(n.y<-4)n.y=H+4;if(n.y>H+4)n.y=-4;
    }
    raf=requestAnimationFrame(draw);
  }
  const onResize=()=>{cancelAnimationFrame(raf);resize();draw();};
  window.addEventListener('resize',onResize,{passive:true});
  document.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;},{passive:true});
  document.addEventListener('pointerleave',()=>pointer.active=false,{passive:true});
  requestAnimationFrame(()=>{resize();draw();});
})();

// Demand examples in the hero.
(function initTyping() {
  const el=document.getElementById('typing-text');
  if(!el) return;
  const phrases=[
    'an AI that predicts soil moisture from NISAR',
    'a robot for autonomous Arctic inspection',
    'a cancer-detection model with clinical evidence',
    'a satellite dataset for flood intelligence',
    'a model that forecasts markets 10 days ahead',
    'a supplier for a product that does not exist yet'
  ];
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=phrases[0];return;}
  let i=0,j=0,deleting=false;
  function tick(){
    const phrase=phrases[i%phrases.length];
    j+=deleting?-1:1;
    el.textContent=phrase.slice(0,Math.max(0,j));
    if(!deleting && j>=phrase.length){deleting=true;setTimeout(tick,1650);return;}
    if(deleting && j<=0){deleting=false;i++;}
    setTimeout(tick,deleting?28:48);
  }
  tick();
})();

async function loadProducts() {
  const data=await apiFetch('/search').catch(()=>({results:[]}));
  allProducts=Array.isArray(data?.results)?data.results:[];

  updateMarketCounts(allProducts);
  buildTicker(allProducts);
  renderStories(allProducts.filter(p=>p.featured).slice(0,12));
  renderTrending(allProducts);
  renderUniverseMap(allProducts);
  renderFeed(allProducts.slice(0,9));
  startLiveNotifications(allProducts);
}

function updateMarketCounts(products){
  const count=products.length || 100;
  document.getElementById('live-count')?.replaceChildren(document.createTextNode(String(count)));
  const marketObjectStat=document.querySelector('.stat-n[data-target="100"]');
  if(marketObjectStat) marketObjectStat.dataset.target=String(count);
}

function buildTicker(products) {
  const track=document.getElementById('ticker-track');
  if(!track) return;
  if(!products.length){track.innerHTML='<span class="ticker-item">Market inventory is loading…</span>';return;}
  const items=products.slice(0,30).map(p=>`
    <span class="ticker-item">
      <span class="ticker-dot" style="background:${colorFromGradient(p.gradient)}"></span>
      <strong>${safeText(p.name)}</strong>
      <span class="ticker-price">${safeText(formatPrice(p))}</span>
      <span>·</span>
      <span>${safeText(p.category)}</span>
    </span>`).join('');
  track.innerHTML=items+items;
}

function renderStories(products) {
  const root=document.getElementById('stories-row');
  if(!root) return;
  if(!products.length){root.innerHTML='<div class="empty-state">Featured supply will appear here.</div>';return;}
  root.innerHTML=products.map(p=>`
    <article class="story-item" role="link" tabindex="0" data-href="/product/${encodeURIComponent(p.market_id)}">
      <div class="story-ring"><div class="story-av" style="background:${safeText(p.gradient)}">${safeText(String(p.name||'?')[0])}</div></div>
      <div class="story-name">${safeText(p.name)}</div>
      <div class="story-price">${safeText(formatPrice(p))}</div>
    </article>`).join('');
  enableCardNavigation(root);
}

function renderTrending(products) {
  const root=document.getElementById('trending-grid');
  if(!root) return;
  const sorted=[...products].sort((a,b)=>(Number(b.downloads)||0)-(Number(a.downloads)||0)).slice(0,3);
  if(!sorted.length){root.innerHTML='<div class="empty-state">Trending supply will appear as market activity grows.</div>';return;}
  root.innerHTML=sorted.map((p,i)=>`
    <article class="trending-card" role="link" tabindex="0" data-href="/product/${encodeURIComponent(p.market_id)}">
      <div class="trending-av" style="background:${safeText(p.gradient)}">${safeText(String(p.name||'?')[0])}</div>
      <div style="flex:1;min-width:0">
        <div class="trending-name">${safeText(p.name)}</div>
        <div class="trending-meta">${safeText(typeof fmtNum==='function'?fmtNum(Number(p.downloads)||0):Number(p.downloads)||0)} uses · ★ ${safeText(p.rating ?? '—')} · ${safeText(p.category)}</div>
        <div style="margin-top:.38rem;font-size:.72rem;font-weight:800;color:${Number(p.price)>0?'var(--cyan,#66e4ff)':'#5de3ac'}">${safeText(formatPrice(p))}</div>
      </div>
      <div class="trending-rank">0${i+1}</div>
    </article>`).join('');
  enableCardNavigation(root);
}

function renderUniverseMap(products) {
  const root=document.getElementById('universe-map-grid');
  if(!root) return;
  const cats={};
  products.forEach(p=>{if(p?.category) cats[p.category]=(cats[p.category]||0)+1;});
  const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){root.innerHTML='<div class="empty-state">Category intelligence will appear when inventory is available.</div>';return;}
  root.innerHTML=entries.map(([cat,cnt])=>{
    const sample=products.find(p=>p.category===cat);
    const col=colorFromGradient(sample?.gradient);
    return `<a class="um-card" href="/vitrin?category=${encodeURIComponent(cat)}" style="--um-col:${col}">
      <span class="um-icon">${CAT_ICONS[cat]||'◇'}</span>
      <div class="um-name">${safeText(cat)}</div>
      <div class="um-count">${cnt}</div>
      <div class="um-label">market object${cnt===1?'':'s'}</div>
    </a>`;
  }).join('');
}

function renderFeed(products) {
  const root=document.getElementById('feed-grid');
  if(!root) return;
  if(!products.length){root.innerHTML='<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--t2)">No matching supply found. This may be an unmet market demand.</div>';return;}
  root.innerHTML=products.map(p=>productCard(p)).join('');
}

function filterCat(cat,btn) {
  currentCat=cat;
  document.querySelectorAll('.cat-pill').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  const filtered=cat==='all'?allProducts:allProducts.filter(p=>p.category===cat);
  const label=document.getElementById('feed-label');
  const title=document.getElementById('feed-title');
  const subtitle=document.getElementById('feed-subtitle');
  if(label) label.textContent=cat==='all'?'All Supply':cat;
  if(title) title.textContent=cat==='all'?'Market Feed':`${cat} Supply`;
  if(subtitle) subtitle.textContent=filtered.length?`${filtered.length} market object${filtered.length===1?'':'s'} available`:'No current supply — potential market gap';
  renderFeed(filtered.slice(0,9));
  document.querySelector('.feed-section')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function handleSearch(e) {
  e.preventDefault();
  const q=document.getElementById('search-inp')?.value.trim();
  if(q) location.href='/vitrin?q='+encodeURIComponent(q);
}

let aiOpen=false;
function toggleAIChat() {
  aiOpen=!aiOpen;
  const panel=document.getElementById('ai-panel');
  const btn=document.getElementById('ai-toggle-btn');
  if(panel) panel.hidden=!aiOpen;
  if(btn){
    btn.setAttribute('aria-expanded',String(aiOpen));
    btn.innerHTML=`<span aria-hidden="true">✦</span> Ask Market AI <span class="toggle-chevron">${aiOpen?'⌃':'⌄'}</span>`;
  }
  if(aiOpen) setTimeout(()=>document.getElementById('ai-input')?.focus(),120);
}

async function doAskAI() {
  const input=document.getElementById('ai-input');
  const q=input?.value.trim();
  if(!q) return;
  const answer=document.getElementById('ai-answer');
  const cards=document.getElementById('ai-cards');
  try {
    await askAI(q,answer,cards);
  } catch(err) {
    if(answer) answer.innerHTML='<div class="ai-welcome"><div class="ai-avatar">AI</div><div>I could not reach the market assistant. Try the main search while the service reconnects.</div></div>';
  }
}

document.getElementById('ai-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doAskAI();}});
if(typeof initSuggest==='function') initSuggest('search-inp','suggest-drop');

const NAMES=['Alex M.','Sarah K.','James L.','Priya R.','Marco T.','Yuki S.','Fatima A.','Chen W.'];
const ACTIONS=['matched with','is evaluating','deployed','started testing'];
function startLiveNotifications(products) {
  if(!products.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el=document.getElementById('live-notif');
  if(!el) return;
  setInterval(()=>{
    if(document.hidden) return;
    const p=products[Math.floor(Math.random()*Math.min(products.length,20))];
    const name=NAMES[Math.floor(Math.random()*NAMES.length)];
    const action=ACTIONS[Math.floor(Math.random()*ACTIONS.length)];
    el.innerHTML=`
      <div class="live-notif-av" style="background:${safeText(p.gradient)}">${safeText(String(p.name||'?')[0])}</div>
      <div class="live-notif-text"><strong>${safeText(name)}</strong> ${safeText(action)} <strong>${safeText(p.name)}</strong><div class="live-notif-time">Market activity · ${safeText(p.category)}</div></div>`;
    el.hidden=false;
    clearTimeout(el._timeout);
    el._timeout=setTimeout(()=>{el.hidden=true;},4200);
  },11000);
}

function enableCardNavigation(root){
  root.querySelectorAll('[data-href]').forEach(card=>{
    const go=()=>{location.href=card.dataset.href;};
    card.addEventListener('click',go);
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
  });
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
loadProducts();
if(typeof initCounters==='function') initCounters();
