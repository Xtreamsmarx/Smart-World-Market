/* Member dashboard script */
const CAT_ICONS = {'Language Model':'🧠','Image Generation':'🎨','Code Generation':'💻','Voice & Audio':'🎙️','Computer Vision':'👁️','Data Analysis':'📊','Healthcare AI':'🏥','Financial AI':'💰','Robotics':'🤖','Cybersecurity':'🔒','Physical Hardware':'⚙️','Biological':'🧬','Space Tech':'🚀','Climate & Environment':'🌍','Human Services':'👤'};

async function init() {
  loadUserInfo();
  checkOllama();
  await Promise.all([loadRecommendations(), loadCategoryGrid()]);
  initCounters();
}

function loadUserInfo() {
  const user = Auth.user();
  if (!user) return;
  const name = user.name || 'Explorer';
  document.getElementById('user-avatar').textContent = (user.avatar || name[0]).toUpperCase();
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-email').textContent = user.email || '';
  document.getElementById('welcome-name').textContent = name.split(' ')[0];
  const navArea = document.getElementById('nav-user-area');
  navArea.innerHTML = `<a href="/profile" class="btn btn-ghost">${user.avatar||'👤'} ${name.split(' ')[0]}</a><a href="#" class="btn btn-primary" onclick="Auth.logout();location.href='/'">Sign Out</a>`;
}

async function checkOllama() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  try {
    await fetch('http://localhost:11434', { mode:'no-cors' });
    dot.style.background = '#34d399';
    txt.textContent = 'Online — LLM ready';
  } catch {
    dot.style.background = '#f87171';
    txt.textContent = 'Offline — using fallback';
  }
}

async function loadRecommendations() {
  const data = await apiFetch('/search').catch(() => ({ results: [] }));
  const featured = (data.results || []).filter(p => p.featured || p.rating >= 4.8).slice(0, 6);
  document.getElementById('recs-grid').innerHTML = featured.map(p => productCard(p)).join('');
}

function refreshRecs() {
  document.getElementById('recs-grid').innerHTML = Array(3).fill('<div class="skeleton" style="height:200px;border-radius:var(--r-lg)"></div>').join('');
  setTimeout(loadRecommendations, 500);
}

async function loadCategoryGrid() {
  const data = await apiFetch('/search').catch(() => ({ results: [] }));
  const prods = data.results || [];
  const cats = {};
  prods.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat, cnt]) => `
    <a class="cat-item" href="/vitrin?category=${encodeURIComponent(cat)}">
      <div class="ci-icon">${CAT_ICONS[cat]||'📦'}</div>
      <div class="ci-name">${cat}</div>
      <div class="ci-cnt">${cnt} products</div>
    </a>`).join('');
}

// ── AI Chat ───────────────────────────────────────────────────
const chatHistory = [];

async function sendChat() {
  const inp = document.getElementById('chat-inp');
  const q   = inp.value.trim();
  if (!q) return;
  inp.value = '';

  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${q}</div></div>`;
  msgs.innerHTML += `<div class="chat-msg bot" id="typing-msg"><div class="chat-bubble" style="color:var(--t3);font-style:italic">🤖 thinking...</div></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  const data = await apiFetch('/rag', { method:'POST', body:JSON.stringify({question:q}) }).catch(() => null);
  document.getElementById('typing-msg')?.remove();

  const answer = data?.answer || 'Sorry, I could not get a response right now.';
  msgs.innerHTML += `<div class="chat-msg bot"><div class="chat-bubble">${answer}${data?.ollama_active?'<div style="font-size:.65rem;color:var(--t3);margin-top:.4rem">⚡ Ollama LLM</div>':''}</div></div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

document.getElementById('chat-inp').addEventListener('keydown', e => { if(e.key==='Enter') sendChat(); });

init();
