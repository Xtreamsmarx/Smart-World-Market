/* Profile page script */
initParticles('cv', 70);

function init() {
  const user = Auth.user();
  if (!user) return;
  document.getElementById('profile-av').textContent = user.avatar || user.name?.[0] || '🌍';
  document.getElementById('profile-name').textContent = user.name || 'Universe Explorer';
  document.getElementById('profile-email').textContent = user.email || '';
  if (user.type) document.getElementById('account-type-badge').textContent = user.type;
  if (user.joined) document.getElementById('joined-badge').textContent = 'Member since ' + user.joined.slice(0,4);
  if (user.name) document.getElementById('edit-name').value = user.name;
}

async function loadFeatured() {
  const data = await apiFetch('/search').catch(()=>({results:[]}));
  const featured = (data.results||[]).filter(p=>p.featured).slice(0,6);
  document.getElementById('featured-grid').innerHTML = featured.map(p=>productCard(p)).join('');
}

function switchPTab(tab, btn) {
  document.querySelectorAll('.ptab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('ptab-' + tab);
  if (panel) { panel.style.display = 'block'; panel.classList.add('active'); }
  btn.classList.add('active');
  if (tab === 'featured') loadFeatured();
}

function editProfile() { switchPTab('about', document.querySelectorAll('.ptab')[2]); }

function saveProfile() {
  const user = Auth.user() || {};
  user.name = document.getElementById('edit-name').value || user.name;
  Auth.login(user);
  document.getElementById('profile-name').textContent = user.name;
  toast('Profile saved!');
}

init();
