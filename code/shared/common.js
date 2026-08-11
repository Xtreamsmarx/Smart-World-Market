/* Smart World Market — shared utilities used by all pages */

const API = '/api';  // relative — works with Flask or Django on any port

// ── Fetch helpers ─────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || res.statusText);
    err.status = res.status;
    err.message = res.status + ' ' + (body.error || res.statusText);
    throw err;
  }
  return res.json();
}

// ── Simple auth state (localStorage) ─────────────────────────
const Auth = {
  user() { try { return JSON.parse(localStorage.getItem('sxw_user')); } catch { return null; } },
  login(data) { localStorage.setItem('sxw_user', JSON.stringify(data)); },
  logout() { localStorage.removeItem('sxw_user'); },
  isLoggedIn() { return !!this.user(); }
};

// ── Format helpers ────────────────────────────────────────────
function fmtNum(n) {
  n = Number(n);
  if (n >= 1e6)  return (n/1e6).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(n >= 1e4 ? 0 : 1) + 'K';
  return String(n);
}
function fmtPrice(p, billing) {
  if (!Number(p)) return '<span style="color:#34d399;font-weight:800">Free</span>';
  const per = billing === 'one-time' ? '' : billing === 'yearly' ? '/yr' : billing === 'per-call' ? '/call' : '/mo';
  return `<span style="font-weight:900">$${Number(p).toFixed(0)}</span><span style="font-size:.7rem;color:#64748b">${per}</span>`;
}
function fmtStars(r) {
  r = Number(r);
  return '★'.repeat(Math.floor(r)) + (r%1>=.5?'½':'') + '☆'.repeat(5-Math.ceil(r));
}

// ── Product card HTML ─────────────────────────────────────────
function productCard(p, opts = {}) {
  const tags = (p.tags||[]).slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('');
  const speechText = `${p.name}. ${p.short_description}. Category: ${p.category}. Price: $${p.price} per ${p.billing}. Accuracy: ${p.accuracy}.`;
  const imgUrl = `/product/${p.market_id}/image.svg`;
  return `
<div class="card pc" style="cursor:pointer;" onclick="if(!event.target.closest('button,a'))location.href='/product/${p.market_id}'">
  <img class="pc-img" src="${imgUrl}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">
  <div class="pc-top" style="background:${p.gradient}"></div>
  <div class="pc-body">
    <div class="pc-head">
      <div class="pc-av" style="background:${p.gradient}">${(p.name||'?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div class="pc-name">${p.name}</div>
        <div class="pc-cat">${p.category}</div>
        <div class="pc-mid"><span class="dot" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--cyan);margin-right:3px;animation:pulse 1.5s infinite"></span>${p.market_id}</div>
      </div>
      ${p.seller_verified ? '<span class="badge badge-g" style="flex-shrink:0;font-size:.6rem">✓</span>' : ''}
    </div>
    <p class="pc-desc">${p.short_description}</p>
    <div class="pc-tags">${tags}</div>
    <div class="pc-stats">
      <div><span class="pc-sv">${p.parameters}</span><span class="pc-sl">Params</span></div>
      <div><span class="pc-sv">${p.accuracy}</span><span class="pc-sl">Accuracy</span></div>
      <div><span class="pc-sv">${fmtNum(p.downloads)}</span><span class="pc-sl">Downloads</span></div>
    </div>
    <div class="pc-foot">
      <div>
        <div class="pc-price gt">${fmtPrice(p.price, p.billing)}</div>
        <div style="font-size:.68rem;color:var(--t3)">★ ${p.rating} (${fmtNum(p.review_count)})</div>
      </div>
      <div class="pc-actions">
        <button class="btn btn-ghost btn-sm" title="Listen" onclick="event.stopPropagation();speakProduct('${speechText.replace(/'/g,'&#39;')}',this)">🔊</button>
        <a href="/market/${p.market_id}/" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()" title="Market Page">🏪</a>
        <a href="/payment/${p.market_id}" class="btn btn-primary btn-sm" onclick="event.stopPropagation()">Buy</a>
      </div>
    </div>
  </div>
</div>`;
}

// ── Web Speech API ────────────────────────────────────────────
let _activeUtt = null;
function speakProduct(text, btn) {
  if (_activeUtt) { speechSynthesis.cancel(); _activeUtt = null; if(btn) btn.textContent='🔊'; return; }
  if (!('speechSynthesis' in window)) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.93; utt.pitch = 1.05;
  utt.onstart = () => { _activeUtt = utt; if(btn) btn.innerHTML='⏹ <span class="sound-wave"><span></span><span></span><span></span><span></span><span></span></span>'; };
  utt.onend = utt.onerror = () => { _activeUtt = null; if(btn) btn.textContent='🔊'; };
  speechSynthesis.speak(utt);
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type==='success'?'✅':'❌'}</span><span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Particle canvas (shared background) ──────────────────────
function initParticles(canvasId, count = 90) {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, pts = [], rafId;

  // Use parent dimensions; window is the fallback for full-screen heroes
  function getSize() {
    const p = cv.parentElement;
    return {
      w: (p && p.clientWidth  > 10 ? p.clientWidth  : 0) || window.innerWidth,
      h: (p && p.clientHeight > 10 ? p.clientHeight : 0) || window.innerHeight
    };
  }

  function resize() {
    const s = getSize();
    W = cv.width  = s.w;
    H = cv.height = s.h;
  }

  function initPts() {
    pts = Array.from({length: count}, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  Math.random() * 1.6 + 0.5,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      hue: 210 + Math.random() * 80
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 130) {
          const alpha = (1 - d / 130) * 0.4;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `hsla(${pts[i].hue},85%,68%,${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${pts[i].hue},85%,68%)`;
      ctx.fill();

      pts[i].x += pts[i].vx;
      pts[i].y += pts[i].vy;
      if (pts[i].x < 0 || pts[i].x > W) pts[i].vx *= -1;
      if (pts[i].y < 0 || pts[i].y > H) pts[i].vy *= -1;
    }
    rafId = requestAnimationFrame(draw);
  }

  function onResize() { resize(); initPts(); }
  window.addEventListener('resize', onResize);

  // Defer so the browser finishes layout before we measure dimensions
  requestAnimationFrame(() => {
    resize();
    // Second RAF ensures full layout (fonts, images, min-height vh)
    requestAnimationFrame(() => {
      if (W < 100) { resize(); } // retry if still too small
      initPts();
      draw();
    });
  });
}

// ── Intersection observer fade-up ─────────────────────────────
function initFadeUp(selector = '[data-fade]') {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('afu'); io.unobserve(e.target); } });
  }, {threshold:.12});
  document.querySelectorAll(selector).forEach(el => { el.style.opacity = '0'; io.observe(el); });
}

// ── Number counter ────────────────────────────────────────────
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const dur = 2000;
  const start = performance.now();
  const tick = now => {
    const p = Math.min((now-start)/dur, 1);
    const e = 1-Math.pow(1-p,3);
    el.textContent = fmtNum(Math.round(e*target));
    if(p<1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function initCounters() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting && !e.target.dataset.done) { e.target.dataset.done='1'; animateCounter(e.target); } });
  }, {threshold:.5});
  document.querySelectorAll('[data-target]').forEach(el => io.observe(el));
}

// ── Search suggest ────────────────────────────────────────────
function initSuggest(inputId, dropId) {
  const inp = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  if(!inp||!drop) return;
  const icons = {model:'🤖',tag:'🏷️',category:'📂'};
  let tmr;
  inp.addEventListener('input', function() {
    clearTimeout(tmr);
    const q = this.value.trim();
    if(q.length<2) { drop.style.display='none'; return; }
    tmr = setTimeout(async () => {
      const data = await apiFetch('/suggest?q='+encodeURIComponent(q)).catch(()=>({suggestions:[]}));
      if(!data.suggestions.length) { drop.style.display='none'; return; }
      drop.innerHTML = data.suggestions.map(s=>`
        <a href="${s.id?'/product/'+s.id:'/search?q='+encodeURIComponent(s.text)}" class="sug-item">
          <span style="width:28px;height:28px;border-radius:7px;background:rgba(124,58,237,.2);display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0">${icons[s.type]||'🔍'}</span>
          <div><div style="font-size:.875rem;font-weight:600">${s.text}</div><div style="font-size:.7rem;color:var(--t3)">${s.type}</div></div>
        </a>`).join('');
      drop.style.display='block';
    }, 230);
  });
  document.addEventListener('click', e => { if(!inp.closest('.search-wrap')?.contains(e.target)) drop.style.display='none'; });
}

// ── RAG AI chat ───────────────────────────────────────────────
async function askAI(question, resultContainer, cardsContainer) {
  if(!question.trim()) return;
  resultContainer.innerHTML = '<div style="color:var(--t2);font-style:italic;display:flex;align-items:center;gap:.5rem"><div style="width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--violet);border-radius:50%;animation:spin .8s linear infinite"></div> AI is thinking...</div>';
  try {
    const data = await apiFetch('/rag', { method:'POST', body:JSON.stringify({question}) });
    resultContainer.innerHTML = `<div style="display:flex;gap:.75rem;align-items:flex-start">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>
      <div style="flex:1">
        <div style="font-size:.875rem;line-height:1.75;color:var(--t1)">${data.answer}</div>
        ${data.ollama_active?'<div style="font-size:.68rem;color:var(--t3);margin-top:.4rem">⚡ Powered by local Ollama LLM</div>':'<div style="font-size:.68rem;color:var(--t3);margin-top:.4rem">📦 Install Ollama for smarter answers</div>'}
      </div>
    </div>`;
    if(cardsContainer && data.products?.length) {
      cardsContainer.innerHTML = data.products.map(p=>productCard(p)).join('');
    }
  } catch(e) {
    resultContainer.innerHTML = '<div style="color:var(--red)">Failed to get AI response. Make sure the server is running.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initFadeUp();
  initCounters();
});
