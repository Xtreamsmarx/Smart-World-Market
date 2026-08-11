/* Compare page — improved script */
const MAX = 4;
let compared   = [];
let allProducts = [];

// Gradient pool for radar polygons
const RADAR_COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b'];

// ── Row definitions grouped by section ─────────────────────────
const SECTIONS = [
  {
    title: '🏆 Performance',
    rows: [
      { key:'rating',    label:'Rating',         fmt: p=>`${p.rating} ★`,             num: p=>p.rating,                   highGood:true,  bar:true },
      { key:'accuracy',  label:'Accuracy',        fmt: p=>p.accuracy,                  num: p=>parseAcc(p.accuracy),       highGood:true,  bar:true },
      { key:'downloads', label:'Downloads',       fmt: p=>fmtNum(p.downloads),         num: p=>p.downloads,                highGood:true,  bar:true },
      { key:'reviews',   label:'Reviews',         fmt: p=>fmtNum(p.review_count)+' reviews', num: p=>p.review_count,       highGood:true,  bar:false },
    ]
  },
  {
    title: '💰 Pricing & Scale',
    rows: [
      { key:'price',     label:'Price',           fmt: p=>p.price>0?`$${p.price}/${p.billing||'mo'}`:'Free', num:p=>p.price, highGood:false, bar:true },
      { key:'apicalls',  label:'API Calls / Mo',  fmt: p=>fmtNum(p.api_calls_per_month), num:p=>p.api_calls_per_month,    highGood:true,  bar:true },
    ]
  },
  {
    title: '⚙️ Technical',
    rows: [
      { key:'response',  label:'Response Time',   fmt: p=>p.response_time },
      { key:'params',    label:'Parameters',      fmt: p=>p.parameters },
      { key:'gpu',       label:'GPU Required',    fmt: p=>p.specs?.gpu_required?'✓ Yes (GPU)':'✗ CPU only' },
      { key:'framework', label:'Framework',       fmt: p=>p.specs?.framework||'N/A' },
      { key:'input',     label:'Input',           fmt: p=>p.specs?.input||'N/A' },
      { key:'output',    label:'Output',          fmt: p=>p.specs?.output||'N/A' },
    ]
  },
  {
    title: '📋 Details',
    rows: [
      { key:'category',  label:'Category',        fmt: p=>p.category },
      { key:'license',   label:'License',         fmt: p=>p.license },
      { key:'seller',    label:'Seller',          fmt: p=>p.seller+(p.seller_verified?' ✓':'') },
      { key:'mid',       label:'Market ID',       fmt: p=>`<span style="font-family:monospace;font-size:.8rem">${p.market_id}</span>` },
    ]
  }
];

// ── Scoring ────────────────────────────────────────────────────
function parseAcc(acc) {
  const m = String(acc||'').match(/(\d+\.?\d*)/);
  return m ? Math.min(parseFloat(m[1]), 100) : 0;
}
function calcScore(p) {
  const acc  = parseAcc(p.accuracy);
  const rat  = (p.rating / 5) * 100;
  const dl   = Math.min(Math.log10(p.downloads + 1) / Math.log10(1000000) * 100, 100);
  const pval = p.price > 0 ? Math.max(0, 100 - Math.log10(p.price) * 28) : 100;
  const api  = Math.min(Math.log10(p.api_calls_per_month + 1) / Math.log10(2000000) * 100, 100);
  return Math.round(acc*0.25 + rat*0.25 + dl*0.20 + pval*0.15 + api*0.15);
}

function bestFor(p, scores) {
  const s = calcScore(p);
  const maxScore = Math.max(...scores);
  if (s === maxScore)    return 'Best overall value & performance';
  if (p.price === Math.min(...compared.map(x=>x.price))) return 'Best for: budget-conscious teams';
  if (p.rating === Math.max(...compared.map(x=>x.rating))) return 'Best for: quality-first projects';
  if (p.downloads === Math.max(...compared.map(x=>x.downloads))) return 'Best for: community-proven use';
  if (!p.specs?.gpu_required) return 'Best for: easy CPU deployment';
  return 'Specialist use case';
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  const data = await apiFetch('/search').catch(()=>({results:[]}));
  allProducts = data.results || [];
  buildQuickCats();
  buildSuggested();
  initSearch();

  // Restore from URL hash
  const ids = location.hash.replace('#','').split(',').filter(Boolean);
  for (const mid of ids.slice(0, MAX)) {
    const p = allProducts.find(x => x.market_id === mid);
    if (p) addProduct(p, false);
  }
  render();
}

// ── Search ────────────────────────────────────────────────────
function initSearch() {
  const inp  = document.getElementById('add-input');
  const drop = document.getElementById('add-dropdown');
  let tmr;
  inp.addEventListener('input', function () {
    clearTimeout(tmr);
    const q = this.value.trim().toLowerCase();
    if (!q) { drop.classList.remove('open'); return; }
    tmr = setTimeout(() => {
      const matches = allProducts
        .filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) ||
                     (p.tags||[]).some(t=>t.toLowerCase().includes(q)))
        .slice(0, 8);
      if (!matches.length) { drop.classList.remove('open'); return; }
      drop.innerHTML = matches.map(p => {
        const added = compared.some(c=>c.market_id===p.market_id);
        return `<div class="add-drop-item ${added?'already':''}" onclick="${added?'':` pickProduct('${p.market_id}')` }">
          <div class="add-drop-av" style="background:${p.gradient}">${p.name[0]}</div>
          <div style="flex:1;min-width:0"><div class="add-drop-name">${p.name}</div><div class="add-drop-cat">${p.category} · ${p.market_id}</div></div>
          <div class="add-drop-price">${p.price>0?'$'+p.price:'Free'}</div>
        </div>`;
      }).join('');
      drop.classList.add('open');
    }, 200);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.add-search-wrap')) drop.classList.remove('open'); });
}

function pickProduct(mid) {
  document.getElementById('add-dropdown').classList.remove('open');
  document.getElementById('add-input').value = '';
  const p = allProducts.find(x=>x.market_id===mid);
  if (p) { addProduct(p); render(); }
}

// ── Add / Remove ──────────────────────────────────────────────
function addProduct(p, shouldRender = true) {
  if (compared.length >= MAX || compared.some(c=>c.market_id===p.market_id)) return;
  compared.push(p);
  updateURL();
  if (shouldRender) render();
}
function removeProduct(mid) { compared = compared.filter(p=>p.market_id!==mid); updateURL(); render(); }
function clearAll() { compared = []; updateURL(); render(); }
function updateURL() {
  const hash = compared.map(p=>p.market_id).join(',');
  history.replaceState(null,'', hash ? '#'+hash : location.pathname);
}

// ── Share ─────────────────────────────────────────────────────
function shareComparison() {
  navigator.clipboard.writeText(location.href).then(()=>toast('Comparison URL copied to clipboard! 🔗')).catch(()=>toast('Copy this URL: '+location.href,'error'));
}

// ── Quick categories ──────────────────────────────────────────
function buildQuickCats() {
  const cats = [...new Set(allProducts.map(p=>p.category))].sort();
  const ICONS = {'Language Model':'🧠','Image Generation':'🎨','Code Generation':'💻','Voice & Audio':'🎙️','Computer Vision':'👁️','Data Analysis':'📊','Healthcare AI':'🏥','Financial AI':'💰','Robotics':'🤖','Cybersecurity':'🔒','Physical Hardware':'⚙️','Biological':'🧬','Space Tech':'🚀','Climate & Environment':'🌍','Human Services':'👤'};
  document.getElementById('quick-cats').innerHTML = cats.map(c=>
    `<button class="qc-pill" onclick="addCat('${c.replace(/'/g,"\\'")}')">
      ${ICONS[c]||'📦'} ${c}
    </button>`).join('');
}
function addCat(cat) {
  if (compared.length >= MAX) { toast('Maximum 4 products in comparison.','error'); return; }
  const pool = allProducts.filter(p=>p.category===cat && !compared.some(c=>c.market_id===p.market_id));
  if (!pool.length) { toast('All '+cat+' products already added.','error'); return; }
  const top = pool.sort((a,b)=>b.rating-a.rating)[0];
  addProduct(top); toast('Added: '+top.name);
}

// ── Suggested ─────────────────────────────────────────────────
function buildSuggested() {
  const featured = allProducts.filter(p=>p.featured||p.rating>=4.8).slice(0,6);
  document.getElementById('suggested-grid').innerHTML = featured.map(p=>`
    <div class="card pc" onclick="addProduct(JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(p))}')))" style="cursor:pointer" title="Click to add to comparison">
      <div class="pc-top" style="background:${p.gradient}"></div>
      <div class="pc-body">
        <div class="pc-head">
          <div class="pc-av" style="background:${p.gradient}">${p.name[0]}</div>
          <div><div class="pc-name">${p.name}</div><div class="pc-cat">${p.category}</div></div>
        </div>
        <div style="font-size:.78rem;color:var(--t2);margin-bottom:.5rem">${(p.short_description||'').slice(0,60)}...</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:800">${p.price>0?'$'+p.price:'Free'}</span>
          <span class="btn btn-primary btn-sm">+ Compare</span>
        </div>
      </div>
    </div>`).join('');
}

// ── Master render ─────────────────────────────────────────────
function render() {
  document.getElementById('slot-counter').textContent = `${compared.length} / ${MAX}`;
  const has = compared.length > 0;
  document.getElementById('cmp-wrap').style.display  = has ? 'block' : 'none';
  document.getElementById('empty-cmp').style.display = has ? 'none'  : 'block';
  if (!has) return;

  const scores = compared.map(calcScore);
  const maxScore = Math.max(...scores);
  const winnerIdx = scores.indexOf(maxScore);

  renderActions();
  renderScoreboard(scores, winnerIdx);
  renderHeaders(scores, winnerIdx);
  renderRadar();
  renderTable(scores);
  renderAIRec(scores, winnerIdx);
}

// ── Actions bar ───────────────────────────────────────────────
function renderActions() {
  document.getElementById('cmp-actions').innerHTML = `
    <div style="font-size:1.1rem;font-weight:900;display:flex;align-items:center;gap:.6rem">
      ⚖️ Comparing ${compared.length} product${compared.length>1?'s':''}
    </div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="shareComparison()">🔗 Share</button>
      <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ Print</button>
      <button class="btn btn-ghost btn-sm" onclick="clearAll()" style="color:var(--red)">✕ Clear All</button>
    </div>`;
}

// ── Scoreboard ────────────────────────────────────────────────
function renderScoreboard(scores, winnerIdx) {
  const rows = compared.map((p,i) => {
    const pct = scores[i];
    const isWinner = i === winnerIdx;
    const grad = p.gradient;
    return `<div class="score-row">
      <div class="score-av" style="background:${grad}">${p.name[0]}</div>
      <div class="score-name">${p.name}${isWinner?'<span class="score-winner-badge">🏆 Winner</span>':''}</div>
      <div class="score-bar-wrap">
        <div class="score-bar-fill" style="width:${pct}%;background:${grad}">
          <span style="font-size:.65rem;font-weight:800;color:rgba(255,255,255,.9)">${pct}</span>
        </div>
      </div>
      <div class="score-num" style="color:${isWinner?'#fbbf24':'var(--t2)'}">${pct}</div>
    </div>`;
  }).join('');
  document.getElementById('scoreboard').innerHTML = `
    <div class="scoreboard-title">📊 Overall Score (Performance · Accuracy · Value · Scale)</div>
    ${rows}`;
}

// ── Product header cards ───────────────────────────────────────
function renderHeaders(scores, winnerIdx) {
  const row  = document.getElementById('cmp-header-row');
  const cols = compared.length < MAX ? compared.length + 1 : compared.length;
  row.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const allScores = scores;

  const cards = compared.map((p,i) => {
    const isWinner = i === winnerIdx;
    return `<div class="cmp-prod-card ${isWinner?'winner':''}">
      ${isWinner ? '<div class="cmp-crown">👑</div>' : ''}
      <div class="cmp-prod-top" style="background:${p.gradient}"></div>
      <div class="cmp-prod-body">
        <button class="cmp-remove-btn" onclick="removeProduct('${p.market_id}')" title="Remove">✕</button>
        <div class="cmp-prod-head">
          <div class="cmp-prod-av" style="background:${p.gradient}">${p.name[0]}</div>
          <div>
            <div class="cmp-prod-name">${p.name}</div>
            <div class="cmp-prod-cat">${p.category}</div>
          </div>
        </div>
        <div class="cmp-prod-price">${p.price>0?`$${p.price}`:' Free'}<span style="font-size:.72rem;font-weight:400;color:var(--t3)">/${p.billing||'mo'}</span></div>
        <div class="cmp-prod-rating">${'★'.repeat(Math.round(p.rating))} ${p.rating} (${fmtNum(p.review_count)})</div>
        <div class="cmp-best-for">${bestFor(p, allScores)}</div>
        <div class="cmp-prod-actions">
          <button class="btn btn-ghost btn-sm" onclick="speakProduct('${(p.name+'. '+(p.short_description||'')).replace(/'/g,"\\'")}')">🔊</button>
          <a href="/market/${p.market_id}/" class="btn btn-ghost btn-sm" target="_blank">🏪</a>
          <a href="/payment/${p.market_id}" class="btn btn-primary btn-sm">Buy</a>
        </div>
      </div>
    </div>`;
  }).join('');

  const addSlot = compared.length < MAX ? `
    <div class="add-slot-card" onclick="document.getElementById('add-input').focus()">
      <div class="plus">＋</div><div>Add product</div>
    </div>` : '';

  row.innerHTML = cards + addSlot;
}

// ── Radar chart ───────────────────────────────────────────────
function renderRadar() {
  const container = document.getElementById('radar-container');
  if (!container || compared.length < 2) { if(container) container.style.display='none'; return; }
  container.style.display = 'block';

  const METRICS = [
    { label:'Rating',    val: p=>(p.rating/5)*100 },
    { label:'Accuracy',  val: p=>parseAcc(p.accuracy) },
    { label:'Downloads', val: p=>Math.min(Math.log10(p.downloads+1)/Math.log10(1000000)*100,100) },
    { label:'Value',     val: p=>p.price>0?Math.max(0,100-Math.log10(p.price)*28):100 },
    { label:'API Scale', val: p=>Math.min(Math.log10(p.api_calls_per_month+1)/Math.log10(2000000)*100,100) },
  ];
  const N = METRICS.length, cx=130, cy=130, r=100;
  const angles = Array.from({length:N},(_,i)=>-Math.PI/2+(2*Math.PI/N)*i);
  const pt = (angle, radius) => [cx+radius*Math.cos(angle), cy+radius*Math.sin(angle)];

  // Grid rings
  let grid = '';
  [25,50,75,100].forEach(pct => {
    const pts = angles.map(a=>pt(a,r*pct/100).join(',')).join(' ');
    grid += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
  });

  // Axes + labels
  let axes = '';
  angles.forEach((a,i) => {
    const [x1,y1]=pt(a,r), [lx,ly]=pt(a,r+18);
    axes += `<line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    axes += `<text x="${lx}" y="${ly}" fill="rgba(255,255,255,0.45)" font-size="9" text-anchor="middle" dominant-baseline="middle" font-family="Inter,sans-serif">${METRICS[i].label}</text>`;
  });

  // Product polygons
  let polys = '';
  compared.forEach((p,pi) => {
    const vals = METRICS.map(m=>m.val(p));
    const pts  = angles.map((a,i)=>pt(a,r*vals[i]/100).join(',')).join(' ');
    const col  = RADAR_COLORS[pi % RADAR_COLORS.length];
    polys += `<polygon points="${pts}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`;
    angles.forEach((a,i)=>{
      const [dx,dy]=pt(a,r*vals[i]/100);
      polys += `<circle cx="${dx}" cy="${dy}" r="3.5" fill="${col}" stroke="${col}" stroke-width="1"/>`;
    });
  });

  // Legend
  const legend = compared.map((p,i)=>`
    <div class="radar-legend-item">
      <div class="radar-legend-dot" style="background:${RADAR_COLORS[i%RADAR_COLORS.length]}"></div>
      <span style="color:var(--t2)">${p.name}</span>
    </div>`).join('');

  container.innerHTML = `
    <div class="radar-title">📡 Capability Radar</div>
    <svg class="radar-svg" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
      ${grid}${axes}${polys}
    </svg>
    <div class="radar-legend">${legend}</div>`;
}

// ── Comparison table ──────────────────────────────────────────
function renderTable(scores) {
  const tbody = document.getElementById('cmp-tbody');
  let html = '';

  SECTIONS.forEach(section => {
    // Section header row (spans all columns)
    html += `<tr class="section-row">
      <th>${section.title}</th>
      ${compared.map(()=>'<td>·</td>').join('')}
    </tr>`;

    section.rows.forEach(row => {
      const vals = compared.map(p=>row.fmt(p));
      const nums = row.num ? compared.map(p=>row.num(p)) : null;

      let bestIdx=-1, worstIdx=-1;
      if (nums && nums.length>1 && nums.every(n=>typeof n==='number'&&!isNaN(n))) {
        bestIdx  = row.highGood ? nums.indexOf(Math.max(...nums)) : nums.indexOf(Math.min(...nums));
        worstIdx = row.highGood ? nums.indexOf(Math.min(...nums)) : nums.indexOf(Math.max(...nums));
        if (bestIdx===worstIdx) { bestIdx=-1; worstIdx=-1; }
      }
      const maxNum = nums ? Math.max(...nums) : 0;

      const cells = vals.map((v,i)=>{
        let cls='', badge='';
        if (i===bestIdx)  { cls='val-best';  badge='<span class="val-badge">✦ Best</span>'; }
        if (i===worstIdx) { cls='val-worst'; }

        // Mini bar for numeric rows
        let content = v;
        if (row.bar && nums && maxNum > 0) {
          const pct = Math.round((nums[i]/maxNum)*100);
          const col = i===bestIdx?'#34d399':i===worstIdx?'#f87171':'#7c3aed';
          content = `<div class="cell-bar-wrap">${v}${badge}<div class="cell-bar" style="min-width:30px"><div class="cell-bar-fill" style="width:${pct}%;background:${col}"></div></div></div>`;
          badge = '';
        }
        return `<td class="${cls}">${content}${badge}</td>`;
      }).join('');

      html += `<tr><th>${row.label}</th>${cells}</tr>`;
    });
  });

  tbody.innerHTML = html;
}

// ── AI Recommendation ──────────────────────────────────────────
function renderAIRec(scores, winnerIdx) {
  const el = document.getElementById('ai-rec');
  if (!el) return;
  const winner = compared[winnerIdx];
  const second = compared.find((_,i)=>i!==winnerIdx);
  const priceDiff = second ? Math.abs(winner.price - second.price) : 0;
  const msg = `Based on our analysis, <strong>${winner.name}</strong> (${winner.market_id}) scores highest overall with ${scores[winnerIdx]}/100.
  It excels in ${winner.accuracy} accuracy and ${fmtNum(winner.downloads)} downloads, making it the most proven choice.
  ${priceDiff > 0 && winner.price > (second?.price||0) ? `While it costs $${priceDiff} more than <strong>${second?.name}</strong>, the performance advantage justifies the premium for production workloads.` : priceDiff > 0 ? `It also offers better value at $${priceDiff} less than <strong>${second?.name}</strong>.` : ''}
  Best suited for teams prioritizing ${winner.category.toLowerCase()} capabilities at scale.`;

  el.innerHTML = `
    <div class="ai-rec-icon">🤖</div>
    <div>
      <div class="ai-rec-title">✦ AI Analysis & Recommendation</div>
      <div class="ai-rec-text">${msg}</div>
    </div>`;
  el.style.display = 'flex';
}

init();
