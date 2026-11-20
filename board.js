// Leaderboards + replays.
//
// - One board per track, built from everyone's cloud-saved best time.
// - Search filters the board by username (ranks stay global) and also finds
//   players across all tracks; clicking a name opens their profile.
// - Every run with a stored ghost can be watched: the game plays it back as a
//   solid car with the chase cam, with pause / seek / speed controls.
import { api, SkyCloud } from './cloud.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RATES = [0.25, 0.5, 1, 2, 4];
const CACHE_MS = 20e3;

let game = null;
let btn, overlay, bar, els = {}, barEls = {};
let open = false;
let view = { kind: 'track', track: 0, q: '', player: '' };
let board = null;        // last track board response
let players = [];        // global username matches for the search box
let profile = null;      // last player profile response
let msg = '';
let loading = false;
let reqId = 0;
let searchTimer = null;
let watching = null;     // { username, track, car } while a replay is up
const cache = new Map(); // url -> { at, data }

const fmt = (t) => game.fmt(t);
const trackIdx = (id) => game.tracks.findIndex((t) => t.id === id);
const trackName = (id) => game.tracks[trackIdx(id)]?.name || id;
const carName = (id) => game.cars.find((c) => c.id === id)?.name || '—';
const myName = () => SkyCloud.user?.username?.toLowerCase() || '';

async function get(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await api(url);
  cache.set(url, { at: Date.now(), data });
  if (cache.size > 60) cache.delete(cache.keys().next().value);
  return data;
}

// ---- loading ------------------------------------------------------------------------

async function load() {
  const id = ++reqId;
  loading = true;
  msg = '';
  render();
  try {
    if (view.kind === 'player') {
      profile = await get('/api/leaderboard?player=' + encodeURIComponent(view.player));
    } else {
      const t = game.tracks[view.track];
      const q = view.q.trim();
      const [b, p] = await Promise.all([
        get(`/api/leaderboard?track=${encodeURIComponent(t.id)}${q ? '&q=' + encodeURIComponent(q) : ''}`),
        q ? get('/api/leaderboard?players=' + encodeURIComponent(q)) : Promise.resolve({ players: [] }),
      ]);
      if (id !== reqId) return;
      board = b;
      players = p.players;
    }
  } catch (e) {
    if (id !== reqId) return;
    msg = e.message || "Couldn't load the leaderboard.";
  }
  if (id !== reqId) return;
  loading = false;
  render();
}

// ---- replays --------------------------------------------------------------------------

async function watch(username, track) {
  if (game.mpActive()) { msg = 'Leave your multiplayer room to watch replays.'; return render(); }
  const ti = trackIdx(track);
  if (ti < 0) { msg = 'This track needs a newer version of the game. Refresh the page.'; return render(); }
  msg = `Loading ${username}'s run…`;
  render();
  let rep;
  try {
    ({ replay: rep } = await get(`/api/leaderboard?replay=${encodeURIComponent(username)}&track=${encodeURIComponent(track)}`));
  } catch (e) {
    msg = e.message || "Couldn't load that replay.";
    return render();
  }
  if (!rep) { msg = 'No replay saved for that run.'; return render(); }
  game.audio();
  const back = { ...view };
  const ok = game.startReplay({
    track: ti, ghost: rep.ghost, time: rep.time, splits: rep.splits, car: rep.car,
    onExit: () => { watching = null; renderBar(); view = back; openBoard(); },
  });
  if (!ok) { msg = "Couldn't start that replay."; return render(); }
  msg = '';
  watching = { username: rep.username, track: rep.track, car: rep.car, time: rep.time };
  closeBoard(false);
  renderBar();
}

// ---- UI -------------------------------------------------------------------------------

const setHTML = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };

function buildUI() {
  const play = document.getElementById('btn-play');
  btn = Object.assign(document.createElement('button'), { className: 'btn', id: 'btn-board', type: 'button', textContent: 'LEADERBOARD 🏆' });
  btn.hidden = true;
  play.after(btn);
  btn.addEventListener('click', () => { game.audio(); view.track = game.trackIndex(); view.kind = 'track'; openBoard(); });

  overlay = Object.assign(document.createElement('div'), { id: 'board', className: 'screen dim hidden' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'lb-title');
  overlay.innerHTML = `
    <div class='panel lb-panel'>
      <h2 id='lb-title'>Leaderboard</h2>
      <div class='lb-tabs' data-el='tabs' role='tablist'></div>
      <form class='lb-search' data-el='form' autocomplete='off' role='search'>
        <input data-el='q' type='search' placeholder='Search players by username' maxlength='20' autocapitalize='off' spellcheck='false' aria-label='Search players by username'>
      </form>
      <div data-el='players'></div>
      <div data-el='head'></div>
      <div class='lb-list' data-el='list'></div>
      <div class='mp-msg' role='status' data-el='msg'></div>
      <div class='mp-actions'><button class='btn' type='button' data-lb='close'>CLOSE</button></div>
    </div>`;
  document.body.appendChild(overlay);
  for (const el of overlay.querySelectorAll('[data-el]')) els[el.dataset.el] = el;

  els.form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchTimer); view.q = els.q.value.trim(); load(); });
  els.q.addEventListener('input', () => {
    const v = els.q.value.trim();
    if (!/^[A-Za-z0-9_-]{0,20}$/.test(v)) { msg = 'Usernames only use letters, numbers, _ and -.'; return render(); }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { view.q = v; view.kind = 'track'; load(); }, 250);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) return closeBoard();
    const b = e.target.closest('[data-lb]');
    if (!b) return;
    game.audio();
    const { lb, track, user } = b.dataset;
    if (lb === 'close') closeBoard();
    else if (lb === 'tab') { view.track = +track; view.kind = 'track'; load(); }
    else if (lb === 'player') { view.kind = 'player'; view.player = user; load(); }
    else if (lb === 'back') { view.kind = 'track'; load(); }
    else if (lb === 'track') { view.kind = 'track'; view.track = Math.max(0, trackIdx(track)); view.q = ''; els.q.value = ''; load(); }
    else if (lb === 'watch') watch(user, track);
  });

  // Keep keys away from the game's hotkeys while the board is up (Space/Enter would start a race).
  // Only keydown is held back: keyup always reaches the game so a held key can't get stuck.
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    const auth = document.getElementById('auth');
    if (auth && !auth.classList.contains('hidden')) return;
    e.stopPropagation();
    if (e.key === 'Escape') closeBoard();
  }, true);

  // Replay controls along the bottom of the screen.
  bar = Object.assign(document.createElement('div'), { id: 'replay-bar', className: 'hidden' });
  bar.innerHTML = `
    <div class='rp-top'><span class='rp-tag'>REPLAY</span><span class='rp-who' data-rp='who'></span></div>
    <input class='rp-scrub' data-rp='scrub' type='range' min='0' max='1' step='0.001' value='0' aria-label='Replay position'>
    <div class='rp-ctl'>
      <button type='button' data-rp='restart' title='Restart (R)' aria-label='Restart'>⏮</button>
      <button type='button' data-rp='back' title='Back 5 s (←)' aria-label='Back 5 seconds'>⏪</button>
      <button type='button' data-rp='play' class='rp-play' title='Play / pause (Space)' aria-label='Play or pause'>⏸</button>
      <button type='button' data-rp='fwd' title='Forward 5 s (→)' aria-label='Forward 5 seconds'>⏩</button>
      <button type='button' data-rp='rate' title='Speed ([ and ])' aria-label='Playback speed'>1×</button>
      <button type='button' data-rp='cam' title='Camera (C)' aria-label='Switch camera'>🎥</button>
      <span class='rp-time' data-rp='time'></span>
      <button type='button' data-rp='exit' class='rp-exit' title='Exit (Esc)'>EXIT ✕</button>
    </div>`;
  document.body.appendChild(bar);
  for (const el of bar.querySelectorAll('[data-rp]')) barEls[el.dataset.rp] = el;
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rp]');
    if (!b) return;
    b.blur(); // so Space goes to the game, not back into this button
    const st = game.replayState();
    if (!st) return;
    const a = b.dataset.rp;
    if (a === 'restart') { game.replaySeek(0); if (st.paused) game.replayToggle(); }
    else if (a === 'back') game.replaySeek(st.time - 5);
    else if (a === 'fwd') game.replaySeek(st.time + 5);
    else if (a === 'play') game.replayToggle();
    else if (a === 'rate') game.replayRate(RATES[(RATES.indexOf(st.rate) + 1) % RATES.length] || 1);
    else if (a === 'cam') game.camera();
    else if (a === 'exit') game.replayExit();
  });
  barEls.scrub.addEventListener('input', () => {
    const st = game.replayState();
    if (st) game.replaySeek(+barEls.scrub.value * st.total);
  });
  barEls.scrub.addEventListener('keydown', (e) => e.stopPropagation(), true);
  barEls.scrub.addEventListener('change', () => barEls.scrub.blur());

  window.addEventListener('skyrush:auth', () => { cache.clear(); render(); });
  requestAnimationFrame(tickBar);
  render();
}

function openBoard() {
  open = true;
  overlay.classList.remove('hidden');
  els.q.value = view.q;
  load();
}

function closeBoard(focusBtn = true) {
  open = false;
  overlay.classList.add('hidden');
  msg = '';
  if (focusBtn && btn && !btn.hidden) btn.focus();
}

function watchBtn(user, track, has) {
  return has
    ? `<button type='button' class='lb-watch' data-lb='watch' data-user='${esc(user)}' data-track='${esc(track)}' title='Watch replay' aria-label='Watch ${esc(user)}&#39;s replay'>▶</button>`
    : `<span class='lb-watch off' title='No replay saved'>—</span>`;
}

function entryRow(e, lead, track) {
  const mine = e.username.toLowerCase() === myName();
  const gap = lead != null && e.time > lead ? `<span class='gap'>+${(e.time - lead).toFixed(3)}</span>` : '';
  return `<li class='${mine ? 'me' : ''}'>
    <span class='pos'>${e.rank}</span>
    <span class='nm'><button type='button' class='lb-name' data-lb='player' data-user='${esc(e.username)}'>${esc(e.username)}</button><small>${esc(carName(e.car))}</small></span>
    <span class='tm'><b>${fmt(e.time)}</b>${gap}</span>
    ${watchBtn(e.username, track, e.replay)}
  </li>`;
}

function render() {
  if (!game || !btn) return;
  btn.hidden = !SkyCloud.available;
  if (!open) return;
  setHTML(els.msg, esc(msg));

  if (view.kind === 'player') {
    els.tabs.hidden = true;
    setHTML(els.players, '');
    const p = profile;
    const name = p?.player?.username || view.player;
    setHTML(els.head, `<div class='lb-head'><button type='button' class='acct-btn' data-lb='back'>← BOARD</button><span>👤 <b>${esc(name)}</b></span></div>`);
    if (loading && !p) return setHTML(els.list, `<div class='lb-empty'>Loading…</div>`);
    if (!p?.player) return setHTML(els.list, `<div class='lb-empty'>No player called <b>${esc(view.player)}</b>.</div>`);
    if (!p.records.length) return setHTML(els.list, `<div class='lb-empty'><b>${esc(name)}</b> hasn't set any times yet.</div>`);
    setHTML(els.list, `<ol class='mp-results lb-rows'>${p.records.map((r) => `
      <li>
        <span class='pos'>${r.rank}</span>
        <span class='nm'><button type='button' class='lb-name' data-lb='track' data-track='${esc(r.track)}'>${esc(trackName(r.track))}</button><small>#${r.rank} of ${r.total} · ${esc(carName(r.car))}</small></span>
        <span class='tm'><b>${fmt(r.time)}</b></span>
        ${watchBtn(name, r.track, r.replay)}
      </li>`).join('')}</ol>`);
    return;
  }

  els.tabs.hidden = false;
  setHTML(els.tabs, game.tracks.map((t, i) => `<button type='button' role='tab' aria-selected='${i === view.track}' class='lb-tab${i === view.track ? ' sel' : ''}' data-lb='tab' data-track='${i}'>${esc(t.name)}</button>`).join(''));
  const q = view.q.trim();
  setHTML(els.players, q && players.length
    ? `<div class='lb-chips'><span class='mp-label'>PLAYERS</span>${players.map((p) => `<button type='button' class='lb-chip' data-lb='player' data-user='${esc(p.username)}'>👤 ${esc(p.username)} <small>${p.tracks} track${p.tracks === 1 ? '' : 's'}</small></button>`).join('')}</div>`
    : '');
  const track = game.tracks[view.track];
  const b = board && board.track === track.id ? board : null;
  const local = game.localBest(track.id);
  setHTML(els.head, `<div class='lb-head'><span><b>${esc(track.name)}</b> · ${b ? `${b.total} driver${b.total === 1 ? '' : 's'}` : '…'}</span>${
    SkyCloud.user ? '' : `<span class='lb-hint'>Sign in to get on the board${local ? ` (your best: ${fmt(local.time)})` : ''}</span>`}</div>`);
  if (!b) return setHTML(els.list, `<div class='lb-empty'>${loading ? 'Loading…' : ''}</div>`);
  if (!b.entries.length) {
    return setHTML(els.list, `<div class='lb-empty'>${q ? `Nobody matching <b>${esc(q)}</b> has a time on ${esc(track.name)}.` : 'No times yet. Be the first!'}</div>`);
  }
  const lead = b.entries.find((e) => e.rank === 1)?.time ?? null;
  let html = `<ol class='mp-results lb-rows'>${b.entries.map((e) => entryRow(e, lead, track.id)).join('')}</ol>`;
  if (b.me && !b.entries.some((e) => e.username === b.me.username)) {
    html += `<div class='mp-label lb-you'>YOU</div><ol class='mp-results lb-rows'>${entryRow(b.me, lead, track.id)}</ol>`;
  }
  setHTML(els.list, html);
}

function renderBar() {
  bar.classList.toggle('hidden', !watching);
  if (!watching) return;
  setHTML(barEls.who, `<b>${esc(watching.username)}</b> · ${esc(trackName(watching.track))} · ${esc(carName(watching.car))} · ${fmt(watching.time)}`);
}

function tickBar() {
  requestAnimationFrame(tickBar);
  if (!game) return;
  const st = game.replayState();
  if (!st) { if (watching) { watching = null; renderBar(); } return; }
  if (document.activeElement !== barEls.scrub) barEls.scrub.value = String(st.total > 0 ? st.time / st.total : 0);
  const play = st.ended ? '↻' : st.paused ? '▶' : '⏸';
  if (barEls.play.textContent !== play) barEls.play.textContent = play;
  const rate = `${st.rate}×`;
  if (barEls.rate.textContent !== rate) barEls.rate.textContent = rate;
  const tm = `${fmt(st.time)} / ${fmt(st.total)}`;
  if (barEls.time.textContent !== tm) barEls.time.textContent = tm;
}

// ---- hooks for game.js ----------------------------------------------------------------

export const SkyBoard = {
  attach(hooks) {
    game = hooks;
    buildUI();
  },
};
