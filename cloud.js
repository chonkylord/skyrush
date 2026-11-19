// Accounts + cloud-saved best times.
//
// localStorage ('skyrush_best_<track>') stays the source the game reads from;
// this module mirrors it to /api/scores for the signed-in user:
//   - on sign-in / page load: pull faster cloud times down, push faster local times up
//   - on a new personal best: upload it
// If /api isn't reachable (e.g. plain static hosting) the account UI stays hidden
// and the game behaves exactly as before.

const BEST = 'skyrush_best_';
const OWNER = 'skyrush_owner'; // user id whose bests are currently in localStorage

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  keys() { try { return Object.keys(localStorage); } catch { return []; } },
};

let available = false;
let user = null;
let syncing = null;
let statusText = '';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    try { data = await res.json(); } catch {}
  }
  if (!res.ok || !data) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---- local best records ---------------------------------------------------

function localBests() {
  const out = new Map();
  for (const k of ls.keys()) {
    if (!k.startsWith(BEST)) continue;
    try {
      const rec = JSON.parse(ls.get(k));
      if (rec && Number.isFinite(rec.time)) out.set(k.slice(BEST.length), rec);
    } catch {}
  }
  return out;
}

function clearLocalBests() {
  for (const k of ls.keys()) if (k.startsWith(BEST)) ls.del(k);
}

const notify = () => window.dispatchEvent(new CustomEvent('skyrush:bests'));
const authChanged = () => window.dispatchEvent(new CustomEvent('skyrush:auth', { detail: { user } }));

function upload(track, rec) {
  return api('/api/scores', {
    method: 'POST',
    body: {
      track,
      time: rec.time,
      splits: Array.from(rec.splits || [], (s) => (Number.isFinite(s) ? s : null)),
      ghost: Array.isArray(rec.ghost) ? rec.ghost : [],
      car: ls.get('skyrush_car') || undefined,
    },
  });
}

function sync() {
  if (!user) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    // Bests on this device belong to whoever was last signed in. A different
    // account gets a clean slate; records made while signed out (no owner yet)
    // are claimed by the account that signs in.
    const owner = ls.get(OWNER);
    let changed = false;
    if (owner && owner !== user.id) { clearLocalBests(); changed = true; }
    ls.set(OWNER, user.id);

    const { scores } = await api('/api/scores');
    const cloud = new Map(scores.map((s) => [s.track, s]));
    const local = localBests();
    let uploaded = 0;

    for (const track of new Set([...cloud.keys(), ...local.keys()])) {
      const c = cloud.get(track);
      const l = local.get(track);
      if (c && (!l || c.time < l.time)) {
        const { score } = await api('/api/scores?track=' + encodeURIComponent(track));
        if (score) {
          ls.set(BEST + track, JSON.stringify({ time: score.time, splits: score.splits, ghost: score.ghost }));
          changed = true;
        }
      } else if (l && (!c || l.time < c.time)) {
        await upload(track, l);
        uploaded++;
      }
    }
    setStatus(uploaded ? `Synced ${uploaded} time${uploaded > 1 ? 's' : ''}` : 'Times saved to your account');
    if (changed) notify();
  })()
    .catch((err) => {
      console.warn('[skyrush] sync failed', err);
      setStatus("Couldn't sync, will retry");
    })
    .finally(() => { syncing = null; });
  return syncing;
}

// ---- UI -------------------------------------------------------------------

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

let bar, barText, barBtn, modal, form, finCloud, opener = null, mode = 'login';

function buildUI() {
  // Account strip in the main menu, above the track list.
  barText = el('span', { className: 'acct-text' });
  barBtn = el('button', { type: 'button', className: 'acct-btn' });
  bar = el('div', { id: 'account', className: 'account' }, barText, barBtn);
  barBtn.addEventListener('click', () => (user ? signOut() : openAuth('login', barBtn)));
  const tracks = document.getElementById('tracks');
  tracks.parentNode.insertBefore(bar, tracks);

  // Line on the finish screen.
  finCloud = el('div', { id: 'fin-cloud', className: 'fin-cloud' });
  const diff = document.getElementById('fin-diff');
  diff.parentNode.insertBefore(finCloud, diff.nextSibling);

  // Sign-in / sign-up dialog.
  form = el('form', { className: 'panel auth-panel', noValidate: true });
  form.innerHTML = `
    <h2 id='auth-title'>Sign in</h2>
    <p class='auth-sub'>Save your best times and ghosts to your account and race them on any device.</p>
    <label class='auth-field'><span>Username</span>
      <input name='username' autocomplete='username' autocapitalize='off' spellcheck='false' maxlength='20' required></label>
    <label class='auth-field'><span>Password</span>
      <input name='password' type='password' autocomplete='current-password' maxlength='200' required></label>
    <div class='auth-err' role='alert'></div>
    <div class='auth-actions'>
      <button class='btn primary' type='submit' data-submit>SIGN IN</button>
      <button class='btn' type='button' data-cancel>CANCEL</button>
    </div>
    <div class='auth-switch'><span data-switch-text>New here?</span> <button type='button' class='link' data-switch>Create an account</button></div>`;
  modal = el('div', { id: 'auth', className: 'screen dim hidden' }, form);
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'auth-title');
  document.body.appendChild(modal);

  // Keep typing out of the game's hotkeys (M = mute, R = respawn, Enter = race...).
  // keyup is let through so a key held while the dialog opens can't get stuck in the game.
  modal.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeAuth();
  });
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeAuth(); });
  form.querySelector('[data-cancel]').addEventListener('click', closeAuth);
  form.querySelector('[data-switch]').addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
  form.addEventListener('submit', onSubmit);
  render();
}

function setMode(m) {
  mode = m;
  const signup = m === 'signup';
  form.querySelector('#auth-title').textContent = signup ? 'Create account' : 'Sign in';
  form.querySelector('[data-submit]').textContent = signup ? 'CREATE ACCOUNT' : 'SIGN IN';
  form.querySelector('[data-switch-text]').textContent = signup ? 'Already have an account?' : 'New here?';
  form.querySelector('[data-switch]').textContent = signup ? 'Sign in' : 'Create an account';
  form.password.autocomplete = signup ? 'new-password' : 'current-password';
  form.password.placeholder = signup ? 'At least 8 characters' : '';
  form.username.placeholder = signup ? '3–20 letters, numbers, _ or -' : '';
  form.querySelector('.auth-err').textContent = '';
}

function openAuth(m, from) {
  opener = from || document.activeElement;
  setMode(m);
  form.password.value = '';
  modal.classList.remove('hidden');
  form.username.focus();
}

function closeAuth() {
  modal.classList.add('hidden');
  if (opener && opener.focus) opener.focus();
  opener = null;
}

async function onSubmit(e) {
  e.preventDefault();
  const errEl = form.querySelector('.auth-err');
  const submit = form.querySelector('[data-submit]');
  errEl.textContent = '';
  submit.disabled = true;
  try {
    const data = await api('/api/auth', {
      method: 'POST',
      body: { action: mode, username: form.username.value, password: form.password.value },
    });
    user = data.user;
    form.password.value = '';
    closeAuth();
    authChanged();
    setStatus('Syncing…');
    render();
    await sync();
  } catch (err) {
    errEl.textContent = err.message || 'Something went wrong.';
  } finally {
    submit.disabled = false;
  }
}

async function signOut() {
  barBtn.disabled = true;
  try {
    await api('/api/auth', { method: 'POST', body: { action: 'logout' } });
    user = null;
    statusText = '';
    render();
    authChanged();
  } catch (err) {
    setStatus("Couldn't sign out");
  } finally {
    barBtn.disabled = false;
  }
}

function setStatus(t) {
  statusText = t;
  render();
}

function render() {
  if (!bar) return;
  bar.hidden = !available;
  barText.replaceChildren();
  if (user) {
    barText.append('☁ Signed in as ', el('b', { textContent: user.username }));
    if (statusText) barText.append(el('span', { className: 'acct-status', textContent: ' · ' + statusText }));
    barBtn.textContent = 'Sign out';
  } else {
    barText.append('☁ Sign in to save your best times');
    barBtn.textContent = 'Sign in';
  }
}

// ---- hooks called from game.js ------------------------------------------

export const SkyCloud = {
  get user() { return user; },
  get available() { return available; },
  openAuth(from) { openAuth('login', from); },

  // A new personal best was just written to localStorage.
  save(track, rec) {
    if (!available || !user) return;
    ls.set(OWNER, user.id);
    upload(track, rec)
      .then(() => {
        setStatus('Times saved to your account');
        if (finCloud) finCloud.textContent = '☁ Saved to your account';
      })
      .catch((err) => {
        console.warn('[skyrush] save failed', err);
        setStatus("Couldn't save, will retry");
        if (finCloud) finCloud.textContent = "☁ Couldn't save yet, will retry when you're back online";
      });
  },

  // A run finished; isBest says whether it set a new personal best.
  onFinish(isBest) {
    if (!finCloud) return;
    finCloud.replaceChildren();
    if (!available || !isBest) return;
    if (user) {
      finCloud.textContent = '☁ Saving to your account…';
    } else {
      const b = el('button', { type: 'button', className: 'link', textContent: 'Sign in' });
      b.addEventListener('click', () => openAuth('login', b));
      finCloud.append(b, ' to save this time to your account');
    }
  },
};

// ---- boot -----------------------------------------------------------------

buildUI();
api('/api/auth')
  .then((data) => {
    available = true;
    user = data.user;
    render();
    authChanged();
    if (user) sync();
  })
  .catch((err) => {
    console.info('[skyrush] accounts unavailable, using local saves only', err.message);
  });
window.addEventListener('online', () => sync());
