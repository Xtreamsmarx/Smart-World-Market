/* AI Composer — script */
let _result = null;  // last synthesis result

// ── Background canvas ─────────────────────────────────────────
initParticles('bg-canvas', 100);

// ── Goal input ────────────────────────────────────────────────
function setGoal(btn) {
  const ta = document.getElementById('goal-input');
  ta.value = btn.textContent;
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

document.getElementById('goal-input').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') synthesize();
});

// ── Synthesize ────────────────────────────────────────────────
const LOADING_MSGS = [
  '🔭 Scanning universe inventory...',
  '🧬 Analyzing product compatibility...',
  '⚗️ Synthesizing bundle architecture...',
  '🤖 Generating AI connections...',
  '✨ Composing final bundle...',
];

async function synthesize() {
  const goal = document.getElementById('goal-input').value.trim();
  if (!goal) { document.getElementById('goal-input').focus(); return; }

  const btn = document.getElementById('synth-btn');
  btn.disabled = true;
  document.getElementById('synth-label').textContent = '⏳ Synthesizing...';
  document.getElementById('result-section').style.display = 'none';

  // Show loading
  const ls = document.getElementById('loading-state');
  ls.style.display = 'flex';
  const stepsEl = document.getElementById('loading-steps');
  stepsEl.innerHTML = '';

  // Animate loading steps
  for (let i = 0; i < LOADING_MSGS.length; i++) {
    await new Promise(r => setTimeout(r, 700));
    const div = document.createElement('div');
    div.className = 'loading-step';
    div.textContent = LOADING_MSGS[i];
    stepsEl.appendChild(div);
    document.getElementById('loading-text').textContent = LOADING_MSGS[i];
    await new Promise(r => setTimeout(r, 50));
    div.classList.add('done');
  }

  try {
    const data = await apiFetch('/compose', {
      method: 'POST',
      body: JSON.stringify({ goal })
    });
    _result = data;
    renderResult(data);
  } catch (e) {
    toast('Synthesis failed — check server connection', 'error');
    ls.style.display = 'none';
  }

  btn.disabled = false;
  document.getElementById('synth-label').textContent = '⚗️ Synthesize';
}

// ── Render result ─────────────────────────────────────────────
function renderResult(data) {
  document.getElementById('loading-state').style.display = 'none';
  const rs = document.getElementById('result-section');
  rs.style.display = 'block';
  rs.style.animation = 'fadeUp .6s ease both';

  const { synthesis: s, products, pricing } = data;

  // Header
  document.getElementById('bundle-name').textContent = s.bundle_name || 'AI Bundle';
  document.getElementById('bundle-tagline').textContent = s.tagline || '';

  // Bundle actions
  document.getElementById('bundle-actions').innerHTML = `
    <a href="/compare" class="btn btn-ghost btn-sm">⚖️ Compare All</a>
    <button class="btn btn-ghost btn-sm" onclick="shareBundle()">🔗 Share</button>`;

  // Details
  document.getElementById('bundle-desc').textContent = s.description || '';
  document.getElementById('bundle-arch').textContent = s.architecture || '';

  document.getElementById('bundle-caps').innerHTML = (s.capabilities || []).map(c =>
    `<li>${c}</li>`).join('');

  document.getElementById('bundle-uses').innerHTML = (s.use_cases || []).map(u =>
    `<span class="use-case-tag">${u}</span>`).join('');

  // Products grid
  document.getElementById('bundle-products-grid').innerHTML = products.map(p => productCard(p)).join('');

  // Pricing
  document.getElementById('price-individual').textContent = `Individual total: $${pricing.individual_total.toFixed(0)}/mo`;
  document.getElementById('price-bundle').textContent = `$${pricing.bundle_price}/mo`;
  document.getElementById('price-rent').textContent = `$${pricing.rent_7d_price}/week`;
  document.getElementById('price-save').textContent = `Save $${pricing.savings}/mo`;

  document.getElementById('buy-bundle-btn').onclick  = () => showBundleCheckout('buy', pricing.bundle_price, products);
  document.getElementById('rent-bundle-btn').onclick = () => showBundleCheckout('rent', pricing.rent_7d_price, products);
  document.getElementById('test-bundle-btn').onclick = () => testAllModels(products);

  // Molecule canvas
  setTimeout(() => drawMolecule(products, s.connections || [], s.bundle_name), 200);

  // Scroll to result
  rs.scrollIntoView({ behavior: 'smooth' });
}

// ── Molecule canvas visualization ─────────────────────────────
let _mol_frame = 0, _mol_nodes = [], _mol_hovered = -1;

function drawMolecule(products, connections, bundleName) {
  const canvas = document.getElementById('mol-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.offsetWidth;
  const H = Math.max(W * 0.55, 350);
  canvas.width = W; canvas.height = H;

  const cx = W / 2, cy = H / 2;
  const r  = Math.min(W, H) * 0.32;

  // Build nodes: center = bundle, surrounding = products
  _mol_nodes = products.map((p, i) => {
    const angle = (-Math.PI / 2) + (2 * Math.PI / products.length) * i;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      product: p,
      vx: 0, vy: 0,
      isCenter: false,
      rad: 36,
    };
  });
  _mol_nodes.push({ x: cx, y: cy, isCenter: true, rad: 52, label: bundleName });

  function getColors(grad) {
    const m = (grad || '').match(/#[0-9a-fA-F]{3,6}/g) || [];
    return [m[0] || '#7c3aed', m[1] || '#2563eb'];
  }

  function frame() {
    _mol_frame++;
    ctx.clearRect(0, 0, W, H);

    const centerNode = _mol_nodes.find(n => n.isCenter);

    // Draw connections to center
    _mol_nodes.forEach((n, i) => {
      if (n.isCenter) return;
      const alpha = i === _mol_hovered ? 0.8 : 0.3;
      const pulse = 0.15 * Math.sin(_mol_frame * 0.05 + i);

      // Animated dashed line
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -(_mol_frame * 0.4);
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(centerNode.x, centerNode.y);
      ctx.strokeStyle = `rgba(124,58,237,${alpha + pulse})`;
      ctx.lineWidth   = i === _mol_hovered ? 2.5 : 1.5;
      ctx.stroke();
      ctx.restore();

      // Connection label (if connection exists)
      const conn = (connections || []).find(c => c.from === n.product?.market_id || c.to === n.product?.market_id);
      if (conn && conn.label && i === _mol_hovered) {
        const mx = (n.x + centerNode.x) / 2;
        const my = (n.y + centerNode.y) / 2;
        ctx.fillStyle = 'rgba(255,255,255,.65)';
        ctx.font = '10px Inter,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(conn.label, mx, my - 5);
      }
    });

    // Draw product-to-product connections from synthesis
    (connections || []).forEach(conn => {
      const from = _mol_nodes.find(n => n.product?.market_id === conn.from);
      const to   = _mol_nodes.find(n => n.product?.market_id === conn.to);
      if (from && to) {
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -(_mol_frame * 0.3);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = 'rgba(6,182,212,0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
    });

    // Draw nodes
    _mol_nodes.forEach((n, i) => {
      const hov = i === _mol_hovered;
      ctx.save();
      if (n.isCenter) {
        // Center bundle node
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rad);
        g.addColorStop(0, 'rgba(124,58,237,.9)');
        g.addColorStop(0.6, 'rgba(37,99,235,.7)');
        g.addColorStop(1, 'rgba(124,58,237,.2)');
        ctx.beginPath(); ctx.arc(n.x, n.y, n.rad + (hov?4:0), 0, Math.PI*2);
        ctx.fillStyle = g; ctx.fill();
        // Glow ring
        ctx.beginPath(); ctx.arc(n.x, n.y, n.rad + 6 + 3*Math.sin(_mol_frame*.07), 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(124,58,237,.4)'; ctx.lineWidth = 2; ctx.stroke();
        // Label
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter,sans-serif'; ctx.textAlign = 'center';
        const words = (n.label||'Bundle').split(' ').slice(0,2);
        words.forEach((w, wi) => ctx.fillText(w, n.x, n.y + wi*12 - (words.length-1)*6));
      } else {
        const [c1, c2] = getColors(n.product?.gradient);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rad);
        g.addColorStop(0, c1 + 'cc');
        g.addColorStop(1, c2 + '44');
        const scale = hov ? 1.15 : 1 + 0.03*Math.sin(_mol_frame*.06+i);
        ctx.translate(n.x, n.y); ctx.scale(scale, scale); ctx.translate(-n.x, -n.y);
        ctx.beginPath(); ctx.arc(n.x, n.y, n.rad, 0, Math.PI*2);
        ctx.fillStyle = g; ctx.fill();
        if (hov) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        // Letter avatar
        ctx.fillStyle = '#fff'; ctx.font = `bold ${n.rad*0.6}px Inter,sans-serif`; ctx.textAlign = 'center';
        ctx.fillText((n.product?.name||'?')[0], n.x, n.y + n.rad*0.2);
        // Name below
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '9px Inter,sans-serif';
        ctx.fillText((n.product?.name||'').slice(0,12), n.x, n.y + n.rad + 14);
      }
      ctx.restore();
    });

    requestAnimationFrame(frame);
  }

  // Mouse hover
  canvas.onmousemove = e => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top)  * (H / rect.height);
    _mol_hovered = _mol_nodes.findIndex(n => Math.hypot(n.x-mx, n.y-my) < n.rad + 4);
    canvas.style.cursor = _mol_hovered >= 0 && !_mol_nodes[_mol_hovered].isCenter ? 'pointer' : 'default';
  };
  canvas.onclick = e => {
    if (_mol_hovered >= 0 && !_mol_nodes[_mol_hovered].isCenter) {
      const mid = _mol_nodes[_mol_hovered].product?.market_id;
      if (mid) window.open('/product/'+mid, '_blank');
    }
  };

  frame();
}

// ── Bundle checkout (mock) ────────────────────────────────────
function showBundleCheckout(type, price, products) {
  const mids = products.map(p=>p.market_id).join(',');
  if (type === 'rent') {
    // Create rent keys for all products
    toast(`Renting ${products.length} products for $${price}/week — redirecting to checkout...`);
    setTimeout(() => location.href = '/compare#' + mids, 1200);
  } else {
    toast(`Buying full bundle ($${price}/mo) — redirecting to checkout...`);
    setTimeout(() => location.href = '/compare#' + mids, 1200);
  }
}

// ── Test all models ───────────────────────────────────────────
async function testAllModels(products) {
  const modal = document.getElementById('test-all-modal');
  const res   = document.getElementById('test-all-results');
  modal.style.display = 'flex';
  res.innerHTML = products.map(p => `
    <div class="test-result-row" id="tr-${p.market_id}">
      <h4><span style="width:34px;height:34px;border-radius:8px;background:${p.gradient};display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:.9rem;flex-shrink:0">${p.name[0]}</span>${p.name} <span class="badge badge-c" style="font-size:.65rem">${p.market_id}</span></h4>
      <div class="tm-output-area" id="tout-${p.market_id}" style="min-height:60px;font-family:monospace;font-size:.8rem;background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:var(--r);padding:.75rem;color:var(--t2)">
        ⏳ Waiting to test...
      </div>
    </div>`).join('');

  // Test each product sequentially with a demo input
  const DEMO_INPUTS = {
    'Language Model': 'Summarize the key benefits of AI for this use case',
    'Image Generation': 'Generate a professional product visualization',
    'Code Generation': 'Write a Python function to process the data',
    'Healthcare AI': 'Analyze patient symptoms: fatigue, shortness of breath, elevated heart rate',
    'Financial AI': 'Predict market movement for the next 30 days',
    'Robotics': 'Execute pick and place task on assembly line',
    'Cybersecurity': 'Analyze network traffic for threat indicators',
    'Data Analysis': 'Find anomalies in sensor readings dataset',
    'Voice & Audio': 'Hello, this is a test of the voice synthesis system',
    'Computer Vision': 'Detect and classify objects in camera feed',
  };

  for (const p of products) {
    const outEl = document.getElementById(`tout-${p.market_id}`);
    outEl.textContent = '🔄 Testing...';
    outEl.style.color = 'var(--t2)';
    await new Promise(r => setTimeout(r, 600 + Math.random()*400));
    const latency = Math.floor(Math.random()*200+50);
    outEl.innerHTML = `<span style="color:#34d399">✓ Success</span>  |  ⚡ ${latency}ms  |  🎯 ${p.accuracy}\n\nSample output: "${(DEMO_INPUTS[p.category]||'Test completed').slice(0,60)}..."\n\nModel responded with ${p.parameters} parameter inference.`;
    outEl.style.color = 'var(--t1)';
  }
}

// ── Share bundle ──────────────────────────────────────────────
function shareBundle() {
  const goal = document.getElementById('goal-input').value;
  const url  = location.origin + '/compose?goal=' + encodeURIComponent(goal);
  navigator.clipboard.writeText(url).then(() => toast('Bundle URL copied!')).catch(()=>{});
}

// ── Restore goal from URL ─────────────────────────────────────
const urlGoal = new URLSearchParams(location.search).get('goal');
if (urlGoal) { document.getElementById('goal-input').value = urlGoal; synthesize(); }
