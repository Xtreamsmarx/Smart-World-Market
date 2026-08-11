/* Login page script */
initParticles('cv', 70);

// ── Tab switch ────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('login-form').style.display    = tab === 'login'    ? 'flex' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-reg').classList.toggle('active',   tab === 'register');
}

if (location.hash === '#register') switchTab('register');

// ── Floating product circles ──────────────────────────────────
async function loadFloatCircles() {
  const data = await apiFetch('/search').catch(()=>({results:[]}));
  const prods = (data.results||[]).slice(0,8);
  const container = document.getElementById('float-circles');
  const positions = [
    {top:'10%',left:'5%'},{top:'25%',right:'8%'},{top:'55%',left:'3%'},
    {top:'70%',right:'5%'},{top:'40%',left:'60%'},{bottom:'15%',left:'15%'},
    {bottom:'30%',right:'15%'},{top:'80%',left:'40%'}
  ];
  container.innerHTML = prods.map((p,i) => {
    const pos = positions[i]||{top:'50%',left:'50%'};
    const posStr = Object.entries(pos).map(([k,v])=>`${k}:${v}`).join(';');
    const size = 40 + Math.random()*25;
    return `<div class="float-circle" style="${posStr};width:${size}px;height:${size}px;background:${p.gradient};animation-delay:${i*0.5}s;animation-duration:${3+Math.random()*3}s" title="${p.name}">${p.name[0]}</div>`;
  }).join('');
}
loadFloatCircles();

// ── Password toggle ───────────────────────────────────────────
function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

// ── Show error/success message ────────────────────────────────
function showMsg(formId, msg, isError = true) {
  let el = document.getElementById(formId + '-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = formId + '-msg';
    el.style.cssText = 'padding:.65rem 1rem;border-radius:var(--r);font-size:.85rem;margin-bottom:1rem;font-weight:600;';
    document.getElementById(formId).prepend(el);
  }
  el.textContent = msg;
  el.style.background = isError ? 'rgba(239,68,68,.15)' : 'rgba(16,185,129,.15)';
  el.style.color       = isError ? '#f87171' : '#34d399';
  el.style.border      = isError ? '1px solid rgba(239,68,68,.3)' : '1px solid rgba(16,185,129,.3)';
}

// ── Handle login (calls real API → saves to SQLite) ───────────
async function handleLogin(e) {
  e.preventDefault();
  const btn   = e.target.querySelector('button[type=submit]');
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-pwd').value;

  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const res = await apiFetch('/login-user', {
      method: 'POST',
      body: JSON.stringify({email, password: pwd})
    });
    Auth.login({...res.user, avatar: res.user.avatar || res.user.name?.[0]?.toUpperCase()});
    showMsg('login-form', '✓ Welcome back, ' + res.user.name + '!', false);
    setTimeout(() => location.href = '/member', 700);
  } catch (err) {
    const msg = err.message?.includes('401') ? 'Incorrect email or password.'
                : err.message?.includes('400') ? 'Please fill all fields.'
                : 'Login failed. Please try again.';
    showMsg('login-form', msg);
    btn.disabled = false; btn.textContent = 'Sign In to Universe →';
  }
}

// ── Handle register (calls real API → saves to SQLite) ────────
async function handleRegister(e) {
  e.preventDefault();
  const btn  = e.target.querySelector('button[type=submit]');
  const name = (document.getElementById('reg-first').value + ' ' +
                document.getElementById('reg-last').value).trim();
  const email = document.getElementById('reg-email').value.trim();
  const pwd   = document.getElementById('reg-pwd').value;
  const type  = document.getElementById('reg-type').value;

  btn.disabled = true; btn.textContent = 'Creating account...';
  try {
    const res = await apiFetch('/register', {
      method: 'POST',
      body: JSON.stringify({name, email, password: pwd, account_type: type})
    });
    Auth.login({...res.user, avatar: res.user.avatar || name[0]?.toUpperCase()});
    showMsg('register-form', '✓ Account created! Welcome, ' + name + '!', false);
    setTimeout(() => location.href = '/member', 700);
  } catch (err) {
    const msg = err.message?.includes('409') ? 'That email is already registered.'
                : err.message?.includes('400') ? 'Please fill all fields correctly.'
                : 'Registration failed. Please try again.';
    showMsg('register-form', msg);
    btn.disabled = false; btn.textContent = 'Create Universe Account →';
  }
}

// ── Social login (mock — OAuth not configured) ────────────────
function socialLogin(provider) {
  const names = { google:'Universe Explorer', github:'Dev Pioneer', guest:'Guest Visitor' };
  Auth.login({ name: names[provider]||'User', email: provider+'@swm.demo',
               avatar: '🌍', provider, joined: new Date().toISOString() });
  toast('Signed in as ' + (names[provider]||'User'));
  setTimeout(() => location.href = '/member', 700);
}

initCounters();

// ── Tab switch ────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('login-form').style.display    = tab === 'login'    ? 'flex' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-reg').classList.toggle('active',   tab === 'register');
}

// ── Hash routing for #register ────────────────────────────────
if (location.hash === '#register') switchTab('register');

// ── Floating product circles ──────────────────────────────────
async function loadFloatCircles() {
  const data = await apiFetch('/search').catch(()=>({results:[]}));
  const prods = (data.results||[]).slice(0,8);
  const container = document.getElementById('float-circles');
  const positions = [
    {top:'10%',left:'5%'},{top:'25%',right:'8%'},{top:'55%',left:'3%'},
    {top:'70%',right:'5%'},{top:'40%',left:'60%'},{bottom:'15%',left:'15%'},
    {bottom:'30%',right:'15%'},{top:'80%',left:'40%'}
  ];
  container.innerHTML = prods.map((p,i) => {
    const pos = positions[i]||{top:'50%',left:'50%'};
    const posStr = Object.entries(pos).map(([k,v])=>`${k}:${v}`).join(';');
    const size = 40 + Math.random()*25;
    const delay = i*0.5;
    return `<div class="float-circle" style="${posStr};width:${size}px;height:${size}px;background:${p.gradient};animation-delay:${delay}s;animation-duration:${3+Math.random()*3}s" title="${p.name}">${p.name[0]}</div>`;
  }).join('');
}
loadFloatCircles();

// ── Password toggle ───────────────────────────────────────────
function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

// ── Handle login ──────────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const name  = email.split('@')[0];
  Auth.login({ name, email, avatar: name[0].toUpperCase(), joined: new Date().toISOString() });
  toast('Welcome back, ' + name + '!');
  setTimeout(() => location.href = '/member', 800);
}

// ── Handle register ───────────────────────────────────────────
function handleRegister(e) {
  e.preventDefault();
  const first = document.getElementById('reg-first').value;
  const last  = document.getElementById('reg-last').value;
  const email = document.getElementById('reg-email').value;
  const type  = document.getElementById('reg-type').value;
  const name  = first + ' ' + last;
  Auth.login({ name, email, avatar: first[0].toUpperCase(), type, joined: new Date().toISOString() });
  toast('Welcome to Smart World Market, ' + first + '!');
  setTimeout(() => location.href = '/member', 800);
}

// ── Social login ──────────────────────────────────────────────
function socialLogin(provider) {
  const names = { google:'Universe Explorer', github:'Dev Pioneer', guest:'Guest Visitor' };
  Auth.login({ name: names[provider]||'User', email: provider+'@sxw.demo', avatar: '🌍', provider, joined: new Date().toISOString() });
  toast('Signed in via ' + provider);
  setTimeout(() => location.href = '/member', 800);
}

initCounters();
