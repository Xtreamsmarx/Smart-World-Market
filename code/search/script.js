/* Search page script */
let mode = 'search';
initParticles('cv', 60);
initSuggest('big-inp', 'big-suggest');

// ── Pre-fill from URL ─────────────────────────────────────────
const initQ = new URLSearchParams(location.search).get('q') || '';
if (initQ) { document.getElementById('big-inp').value = initQ; doSearch(); }

// ── Mode toggle ───────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById('mode-search').classList.toggle('active', m === 'search');
  document.getElementById('mode-ai').classList.toggle('active', m === 'ai');
}

// ── Main search ───────────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById('big-inp').value.trim();
  if (!q) return;

  if (mode === 'ai') {
    await doAISearch(q);
    return;
  }

  document.getElementById('results-info').textContent = 'Searching...';
  document.getElementById('no-result').style.display = 'none';
  document.getElementById('ai-result-box').style.display = 'none';

  const data = await apiFetch('/search?q=' + encodeURIComponent(q)).catch(() => ({ results: [], total: 0 }));
  const products = data.results || [];

  document.getElementById('results-info').textContent = `Found ${products.length} results for "${q}"`;

  const grid = document.getElementById('results-grid');
  if (!products.length) {
    grid.innerHTML = '';
    document.getElementById('no-result').style.display = 'block';
    return;
  }
  grid.innerHTML = products.map(p => productCard(p)).join('');
}

// ── AI search ─────────────────────────────────────────────────
async function doAISearch(q) {
  document.getElementById('results-info').textContent = '🤖 AI is searching inventory...';
  document.getElementById('results-grid').innerHTML = '';
  const box = document.getElementById('ai-result-box');
  box.style.display = 'block';
  await askAI(q, box, document.getElementById('ai-result-cards'));
  document.getElementById('results-info').textContent = 'AI search completed';
}

// ── Quick category search ─────────────────────────────────────
async function quickSearch(cat) {
  document.getElementById('big-inp').value = cat;
  setMode('search');
  const data = await apiFetch('/search?category=' + encodeURIComponent(cat)).catch(() => ({ results: [] }));
  const products = data.results || [];
  document.getElementById('results-info').textContent = `${products.length} products in "${cat}"`;
  document.getElementById('results-grid').innerHTML = products.map(p => productCard(p)).join('');
  document.getElementById('ai-result-box').style.display = 'none';
}

// ── Aside AI ──────────────────────────────────────────────────
async function doAsideAI() {
  const q = document.getElementById('aside-ai-inp').value.trim();
  if (!q) return;
  const box = document.getElementById('aside-ai-answer');
  box.innerHTML = '<span style="color:var(--t3);font-style:italic">Thinking...</span>';
  const data = await apiFetch('/rag', { method:'POST', body:JSON.stringify({question:q}) }).catch(()=>null);
  if (data) box.innerHTML = `<div style="line-height:1.75">${data.answer}</div>`;
  else box.textContent = 'Failed to get AI response.';
}
