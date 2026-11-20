// Multiplayer: invite friends by username and race the same track at the same time.
//
// - Nobody collides: opponents are see-through cars driven by their relayed
//   positions; your physics only ever touches the track.
// - The winner is decided by comparing each player's own finish time (exact to
//   well under a millisecond, interpolated inside the physics step), not by who
//   reached the server first, so lag can't flip a result.
// - Live traffic goes over a WebSocket to the multiplayer server on Render
//   (mp-server/). The Vercel API is only used to get a signed 60-second ticket
//   when connecting, so racing doesn't use up Vercel's free plan.
import { api, SkyCloud } from './cloud.js';

const SEND_MS = 50;          // 20 position updates/s while racing
const MAX_SNAPS = 60;
const IDLE_MS = 15 * 60e3;   // drop the connection after 15 min idle in the menu so Render can sleep

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (t) => {
  if (t == null || !isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60), s = t - 60 * m;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
};
const gapText = (g) => (g >= 0.001 ? g.toFixed(3) : g.toFixed(4));

let game = null;                  // hooks handed over by game.js
let myId = null;
let data = null;                  // { room, players, me } from the server, or null when not in a room
let invites = [];
let launchedRace = 0;             // raceNo started (or skipped) locally
let launchTimer = null;
let myResult = null;              // { raceNo, time, pending, error }
let homeOpen = false;
let notice = '';
const ghosts = new Map();         // userId -> { car, obj, snaps, done }
const states = new Map();         // userId -> latest { t, p, cp }

// ---- connection -------------------------------------------------------------------

let ws = null;
let conn = 'off';                 // off | connecting | online
let backoff = 1000, retryTimer = null, wakeSlow = null;
let ticketCache = null;           // { ticket, server, at }
let lastInput = Date.now();
let stopReason = '';

const wanted = () => !!SkyCloud.user && !document.hidden && !stopReason && (!!data || homeOpen || Date.now() - lastInput < IDLE_MS);

async function getTicket() {
  if (ticketCache && Date.now() - ticketCache.at < 45e3) return ticketCache;
  const d = await api('/api/auth?ticket');
  ticketCache = { ...d, at: Date.now() };
  return ticketCache;
}

async function connect() {
  clearTimeout(retryTimer);
  if (!game || ws || !wanted()) return;
  conn = 'connecting';
  render();
  let t;
  try {
    t = await getTicket();
  } catch (e) {
    conn = 'off';
    notice = e.message;
    render();
    if (e.status !== 401 && e.status !== 503) retry();
    return;
  }
  if (ws || !wanted()) { conn = ws ? conn : 'off'; return; }
  const sock = new WebSocket(t.server);
  ws = sock;
  clearTimeout(wakeSlow);
  wakeSlow = setTimeout(() => { if (conn === 'connecting') render(); }, 4000); // show the "waking up" hint
  sock.onopen = () => sock.send(JSON.stringify({ type: 'hello', ticket: t.ticket }));
  sock.onmessage = (e) => { try { onServer(JSON.parse(e.data)); } catch (err) { console.warn('[skyrush] bad message', err); } };
  sock.onclose = (e) => {
    if (ws !== sock) return;
    ws = null;
    conn = 'off';
    if (e.code === 4003) ticketCache = null;
    if (e.code === 4000) stopReason = 'Multiplayer is open in another tab.';
    render();
    retry();
  };
}

function retry() {
  clearTimeout(retryTimer);
  if (!wanted()) return;
  retryTimer = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 30e3);
}

function disconnect() {
  clearTimeout(retryTimer);
  if (ws) { const s = ws; ws = null; s.close(1000, 'bye'); }
  conn = 'off';
}

function sendMsg(msg) {
  if (ws && ws.readyState === 1) { ws.send(JSON.stringify(msg)); return true; }
  notice = conn === 'connecting' ? 'Still connecting to the multiplayer server…' : 'Not connected. Retrying…';
  render();
  connect();
  return false;
}

// ---- server clock -----------------------------------------------------------------
// Offset from the lowest-latency recent ping, so all clients agree on when the
// race starts to within a few ms.
const clockSamples = [];
let clockOffset = 0;
const serverNow = () => Date.now() + clockOffset;
let pingTimer = null;

function startPings() {
  clearInterval(pingTimer);
  let n = 0;
  const ping = () => sendMsg({ type: 'ping', c: Date.now() });
  ping();
  pingTimer = setInterval(() => { ping(); if (++n === 5) { clearInterval(pingTimer); pingTimer = setInterval(ping, 15e3); } }, 300);
}

// ---- server messages --------------------------------------------------------------

function onServer(msg) {
  switch (msg.type) {
    case 'welcome':
      myId = msg.you.id;
      conn = 'online';
      backoff = 1000;
      if (notice.startsWith('Not connected') || notice.startsWith('Still connecting')) notice = '';
      startPings();
      if (myResult?.pending) sendMsg({ type: 'finish', raceNo: myResult.raceNo, time: myResult.time }); // resend after a drop
      if (data) sendMsg({ type: 'car', car: game.carId() });
      render();
      break;
    case 'pong': {
      const now = Date.now();
      clockSamples.push({ rtt: now - msg.c, off: msg.s - (msg.c + now) / 2 });
      if (clockSamples.length > 15) clockSamples.shift();
      clockOffset = clockSamples.reduce((a, b) => (b.rtt < a.rtt ? b : a)).off;
      break;
    }
    case 'room':
      if (msg.room) applyRoom({ room: msg.room, players: msg.room.players, me: myId });
      else if (data) clearRoom('That room is no longer available (the multiplayer server may have restarted).');
      else render();
      break;
    case 'state': {
      const s = { t: msg.t, p: msg.p, cp: msg.cp, at: performance.now() / 1000 };
      states.set(msg.id, s);
      const g = ghosts.get(msg.id);
      if (g && (!g.snaps.length || s.t > g.snaps[g.snaps.length - 1].t)) {
        g.snaps.push(s);
        if (g.snaps.length > MAX_SNAPS) g.snaps.shift();
      }
      break;
    }
    case 'invite':
      if (!invites.some((i) => i.room === msg.room)) invites.unshift({ room: msg.room, from: msg.from, track: msg.track, at: msg.at });
      invites = invites.slice(0, 10);
      render();
      break;
    case 'finishAck':
      if (myResult && myResult.raceNo === msg.raceNo) {
        myResult.pending = false;
        if (!msg.ok) myResult.error = msg.text;
        render();
      }
      break;
    case 'notice':
    case 'error':
      notice = msg.text;
      render();
      break;
  }
}

// ---- helpers ----------------------------------------------------------------------

const me = () => data?.players.find((p) => p.id === data.me) || null;
const isHost = () => !!data && data.room.hostId === data.me;
const trackIdx = (id) => game.tracks.findIndex((t) => t.id === id);
const trackName = (id) => game.tracks[trackIdx(id)]?.name || id;
const carName = (id) => game.cars.find((c) => c.id === id)?.name || '—';
const carOpen = (c) => !c.owner || !!(SkyCloud.user && SkyCloud.user.username.toLowerCase() === c.owner);
function fillCars() {
  if (!els.car || !game) return;
  const html = game.cars.map((c, i) => (carOpen(c) ? `<option value='${i}'>${esc(c.name)} · ${esc(c.tag)}</option>` : '')).join('');
  if (els.car._h !== html) { els.car._h = html; els.car.innerHTML = html; }
}
const mode = () => game.state().mode;
const ROUND_CHOICES = [1, 2, 3, 4, 5, 7, 10];
const multiRound = () => !!data && data.room.rounds > 1;
const seriesRunning = () => !!data && data.room.round > 0 && data.room.round < data.room.rounds;
const seriesOver = () => !!data && data.room.round > 0 && data.room.round >= data.room.rounds;
const nextRound = () => (seriesRunning() ? data.room.round + 1 : 1);
const roundTag = () => (multiRound() && data.room.round > 0 ? `Round ${data.room.round}/${data.room.rounds}` : '');
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const inLiveRace = () => !!data && data.room.status === 'racing' && launchedRace === data.room.raceNo
  && (mode() === 'countdown' || mode() === 'racing');

function liveOf(p) {
  if (p.id === data.me) {
    const s = game.state();
    return s.pos ? { cp: s.cp, p: [s.pos.x, s.pos.y, s.pos.z] } : null;
  }
  return states.get(p.id) || p.state;
}

// Finished first (fastest exact time wins), then racers by checkpoints/progress, then DNF.
function standings() {
  return data.players.filter((p) => p.racing)
    .map((p) => {
      const s = liveOf(p);
      const prog = p.finish != null ? 1 : s ? game.progress(s.p[0], s.p[1], s.p[2]) : 0;
      return { ...p, prog, cp: s?.cp ?? 0 };
    })
    .sort((a, b) => {
      const rank = (p) => (p.finish != null ? 0 : p.dnf ? 2 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.finish != null) return a.finish - b.finish;
      if (a.cp !== b.cp) return b.cp - a.cp;
      return b.prog - a.prog;
    });
}

// ---- room state machine -----------------------------------------------------------

function applyRoom(d) {
  const prev = data;
  data = d;
  const r = d.room;
  if (!prev || prev.room.id !== r.id || prev.room.raceNo !== r.raceNo) states.clear();
  homeOpen = false;

  if (r.status === 'lobby') {
    if (launchedRace && prev?.room.status !== 'lobby') {
      for (const id of [...ghosts.keys()]) dropGhost(id);
      myResult = null;
      if (mode() !== 'menu') game.toMenu();
    }
    const i = trackIdx(r.track);
    if (i >= 0 && game.trackIndex() !== i && mode() === 'menu') game.selectTrack(i);
  }

  const self = me();
  if (r.status === 'racing' && self?.racing && launchedRace !== r.raceNo && !launchTimer) planLaunch();
  if (r.status === 'racing' || r.status === 'finished') syncGhosts();
  render();
}

function clearRoom(msg = '') {
  data = null;
  launchedRace = 0;
  myResult = null;
  clearTimeout(launchTimer);
  launchTimer = null;
  states.clear();
  for (const id of [...ghosts.keys()]) dropGhost(id);
  if (game && mode() !== 'menu') game.toMenu();
  notice = msg;
  render();
}

function planLaunch() {
  const r = data.room;
  const i = trackIdx(r.track);
  if (i < 0) { notice = 'This track needs a newer version of the game. Refresh the page.'; return; }
  game.selectTrack(i); // build the track now so the countdown isn't eaten by loading

  const fire = () => {
    launchTimer = null;
    if (!data || data.room.raceNo !== r.raceNo || data.room.status !== 'racing') return;
    const lead = (r.startAt - serverNow()) / 1000;
    launchedRace = r.raceNo;
    myResult = null;
    if (lead < -3) {
      // Arrived far too late (e.g. reloaded mid-race): sit this one out.
      sendMsg({ type: 'forfeit', raceNo: r.raceNo });
      render();
      return;
    }
    game.start(Math.max(0.05, Math.min(2.4, lead))); // the game's own 3-2-1, lined up with the server
    render();
  };
  const wait = r.startAt - serverNow() - 2400;
  if (wait > 0) launchTimer = setTimeout(fire, wait);
  else fire();
}

function onLocalFinish(time) {
  if (!data || launchedRace !== data.room.raceNo) return;
  if (data.room.status !== 'racing') {
    myResult = { raceNo: launchedRace, time, pending: false, error: `You finished in ${fmt(time)}, but the race had already been closed.` };
    render();
    return;
  }
  myResult = { raceNo: launchedRace, time, pending: true };
  sendMsg({ type: 'finish', raceNo: launchedRace, time }); // resent on reconnect until acked
  render();
}

function leaveRace() {
  if (!data) return;
  sendMsg({ type: 'forfeit', raceNo: data.room.raceNo });
  game.toMenu();
  render();
}

function leaveRoom() {
  sendMsg({ type: 'leave' });
  clearRoom();
}

// Position updates while racing.
setInterval(() => {
  if (!game || !inLiveRace() || !ws || ws.readyState !== 1) return;
  const s = game.state();
  if (!s.pos) return;
  const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 1e4) / 1e4;
  ws.send(JSON.stringify({
    type: 'state', raceNo: data.room.raceNo, t: Math.round(s.time * 1000) / 1000, cp: s.cp,
    p: [r2(s.pos.x), r2(s.pos.y), r2(s.pos.z), r4(s.quat.x), r4(s.quat.y), r4(s.quat.z), r4(s.quat.w)],
  }));
}, SEND_MS);

// ---- opponents (see-through, no collision) -----------------------------------------

function makeLabel(text) {
  const { THREE } = game;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'italic 900 34px ui-sans-serif, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(16,19,28,.72)';
  g.beginPath();
  if (g.roundRect) g.roundRect((256 - w) / 2, 8, w, 48, 14); else g.rect((256 - w) / 2, 8, w, 48);
  g.fill();
  g.fillStyle = '#fff';
  g.fillText(text, 128, 33, 230);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.2, 0.8, 1);
  sp.position.set(0, 2.2, 0);
  return sp;
}

function ghostFor(p) {
  let g = ghosts.get(p.id);
  if (g && g.car === p.car) return g;
  const snaps = g ? g.snaps : [];
  if (g) dropGhost(p.id);
  const spec = (game.cars.find((c) => c.id === p.car) || game.cars[0]).spec;
  const obj = game.makeGhostCar(spec);
  obj.group.add(makeLabel(p.username));
  obj.group.visible = false;
  game.scene.add(obj.group);
  g = { car: p.car, obj, snaps, done: false };
  ghosts.set(p.id, g);
  return g;
}

function dropGhost(id) {
  const g = ghosts.get(id);
  if (!g) return;
  game.scene.remove(g.obj.group);
  game.dispose(g.obj.group);
  ghosts.delete(id);
}

function syncGhosts() {
  const keep = new Set();
  let created = false;
  for (const p of data.players) {
    if (p.id === data.me || !p.racing) continue;
    keep.add(p.id);
    if (ghosts.get(p.id)?.car !== p.car) created = true;
    const g = ghostFor(p);
    g.done = p.finish != null || p.dnf || data.room.status !== 'racing';
    const s = p.state; // last known position (useful after a reconnect)
    if (s && Array.isArray(s.p) && !g.snaps.length) g.snaps.push({ ...s, at: performance.now() / 1000 });
  }
  for (const id of [...ghosts.keys()]) if (!keep.has(id)) dropGhost(id);
  if (created) warmGhosts();
}

// Compile the see-through car materials now (during "Get ready"), not on the
// first frame they appear, which is what caused the freeze right at GO.
function warmGhosts() {
  const groups = [...ghosts.values()].map((g) => g.obj.group);
  for (const grp of groups) grp.visible = true;
  try { game.warm(); } catch (e) { console.warn('[skyrush] warm-up failed', e); }
  for (const grp of groups) grp.visible = false;
}

// Each opponent is drawn on their own clock, mapped onto ours from when their
// updates actually arrive. So it doesn't matter if their game started a touch
// late or dropped frames: they move smoothly instead of stalling and jumping.
const JITTER = 0.1;      // seconds of buffer against network jitter
const MAX_EXTRAP = 0.25; // keep moving this long if updates pause
let tmpQ = null, tmpQ2 = null, tmpV = null, lastFrame = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const nowMs = performance.now();
  const dt = Math.min(0.1, (nowMs - lastFrame) / 1000);
  lastFrame = nowMs;
  if (!game) return;
  const show = !!data && data.room.status === 'racing' && launchedRace === data.room.raceNo && mode() !== 'menu';
  if (!show) { for (const g of ghosts.values()) { g.obj.group.visible = false; g.shown = false; } return; }
  const { THREE } = game;
  tmpQ ??= new THREE.Quaternion(); tmpQ2 ??= new THREE.Quaternion(); tmpV ??= new THREE.Vector3();
  const now = nowMs / 1000;
  for (const g of ghosts.values()) {
    const s = g.snaps, grp = g.obj.group;
    if (g.done || !s.length) { grp.visible = false; g.shown = false; continue; }
    let off = Infinity;
    for (const x of s) off = Math.min(off, x.at - x.t); // lowest-lag sample in the last ~3 s
    const rt = now - off - JITTER;
    const last = s[s.length - 1];
    if (rt >= last.t) {
      const prev = s.length > 1 ? s[s.length - 2] : last;
      const span = last.t - prev.t;
      const e = span > 0 ? Math.min(rt - last.t, MAX_EXTRAP) / span : 0;
      tmpV.set(last.p[0] + (last.p[0] - prev.p[0]) * e, last.p[1] + (last.p[1] - prev.p[1]) * e, last.p[2] + (last.p[2] - prev.p[2]) * e);
      tmpQ.set(last.p[3], last.p[4], last.p[5], last.p[6]);
    } else {
      let a = s[0], b = s[0];
      if (rt > s[0].t) for (let i = s.length - 1; i > 0; i--) if (s[i - 1].t <= rt) { a = s[i - 1]; b = s[i]; break; }
      const k = b.t > a.t ? (rt - a.t) / (b.t - a.t) : 0;
      tmpV.set(a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k);
      tmpQ.set(a.p[3], a.p[4], a.p[5], a.p[6]);
      if (k > 0) tmpQ.slerp(tmpQ2.set(b.p[3], b.p[4], b.p[5], b.p[6]), k);
    }
    if (!g.shown || grp.position.distanceTo(tmpV) > 12) {
      grp.position.copy(tmpV); // first frame or a respawn: jump straight there
      grp.quaternion.copy(tmpQ);
    } else {
      const k = 1 - Math.exp(-20 * dt); // ease toward the target to hide any remaining jitter
      grp.position.lerp(tmpV, k);
      grp.quaternion.slerp(tmpQ, k);
    }
    grp.visible = true;
    g.shown = true;
  }
}

// ---- UI ---------------------------------------------------------------------------

let mpBtn, banner, overlay, hud, els = {};
const setHTML = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };

function buildUI() {
  const play = document.getElementById('btn-play');
  mpBtn = Object.assign(document.createElement('button'), { className: 'btn', id: 'btn-mp', type: 'button' });
  mpBtn.hidden = true;
  play.after(mpBtn);
  mpBtn.addEventListener('click', () => {
    game.audio();
    if (!SkyCloud.user) return SkyCloud.openAuth(mpBtn);
    homeOpen = true;
    notice = '';
    stopReason = '';
    connect();
    render();
  });

  banner = Object.assign(document.createElement('div'), { id: 'mp-invites' });
  const tracks = document.getElementById('tracks');
  tracks.parentNode.insertBefore(banner, tracks);

  overlay = Object.assign(document.createElement('div'), { id: 'mp', className: 'screen hidden' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-labelledby', 'mp-title');
  overlay.innerHTML = `
    <div class='panel mp-panel'>
      <h2 id='mp-title'>Multiplayer</h2>
      <div class='mp-sub' data-el='sub'></div>
      <div data-el='body'></div>
      <div class='mp-pickers' data-el='pickers'>
        <label><span>Track</span><select data-el='track'></select></label>
        <label><span>Your car</span><select data-el='car'></select></label>
        <label><span>Rounds</span><select data-el='rounds'></select></label>
      </div>
      <form class='mp-invite' data-el='inviteForm' autocomplete='off'>
        <input data-el='inviteName' placeholder="Friend's username" maxlength='20' autocapitalize='off' spellcheck='false' aria-label="Friend's username">
        <button class='acct-btn' type='submit'>INVITE</button>
      </form>
      <div class='mp-msg' role='status' data-el='msg'></div>
      <div class='mp-actions' data-el='actions'></div>
    </div>`;
  document.body.appendChild(overlay);
  for (const el of overlay.querySelectorAll('[data-el]')) els[el.dataset.el] = el;
  els.track.innerHTML = game.tracks.map((t, i) => `<option value='${i}'>${esc(t.name)} · ${esc(t.difficulty)}</option>`).join('');
  els.rounds.innerHTML = ROUND_CHOICES.map((n) => `<option value='${n}'>${n === 1 ? 'Single race' : `${n} rounds`}</option>`).join('');
  fillCars();

  els.rounds.addEventListener('change', () => sendMsg({ type: 'rounds', rounds: +els.rounds.value }));
  els.track.addEventListener('change', () => {
    const t = game.tracks[+els.track.value];
    if (t) sendMsg({ type: 'track', track: t.id });
  });
  els.car.addEventListener('change', () => {
    game.selectCar(+els.car.value);
    sendMsg({ type: 'car', car: game.carId() });
  });
  els.inviteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = els.inviteName.value.trim();
    if (name && sendMsg({ type: 'invite', name })) els.inviteName.value = '';
  });

  // One click handler for every [data-act] button (overlay, banner, HUD).
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !game) return;
    const { act, room } = b.dataset;
    game.audio();
    if (act === 'create') {
      const t = game.tracks[game.trackIndex()];
      sendMsg({ type: 'create', track: t.id, car: game.carId() });
    } else if (act === 'join') {
      invites = invites.filter((i) => i.room !== room);
      sendMsg({ type: 'join', room, car: game.carId() });
      render();
    } else if (act === 'decline') {
      invites = invites.filter((i) => i.room !== room);
      sendMsg({ type: 'decline', room });
      render();
    } else if (act === 'start') sendMsg({ type: 'start' });
    else if (act === 'reset') sendMsg({ type: 'reset' });
    else if (act === 'next') sendMsg({ type: 'next' });
    else if (act === 'end-series') sendMsg({ type: 'endSeries' });
    else if (act === 'leave') leaveRoom();
    else if (act === 'leave-race') leaveRace();
    else if (act === 'retry') { stopReason = ''; notice = ''; backoff = 1000; connect(); }
    else if (act === 'close') { homeOpen = false; notice = ''; render(); }
  });

  // While the panel is up, keep keys away from the game's hotkeys (Space = race, C = car, M = mute...).
  // Only keydown is held back: keyup always reaches the game so a held key can't get stuck.
  window.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) return;
    const auth = document.getElementById('auth');
    if (auth && !auth.classList.contains('hidden')) return;
    e.stopPropagation();
    if (e.key === 'Escape' && !data) { homeOpen = false; notice = ''; render(); }
  }, true);

  hud = Object.assign(document.createElement('div'), { id: 'mp-hud', className: 'hidden' });
  document.getElementById('hud').appendChild(hud);

  // Connect while someone's signed in and around; let go when they're idle or the tab is hidden.
  const touch = () => { const was = Date.now() - lastInput >= IDLE_MS; lastInput = Date.now(); if (was) connect(); };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, touch, { passive: true, capture: true });
  window.addEventListener('skyrush:auth', (e) => {
    if (!e.detail.user) { disconnect(); clearRoom(); invites = []; homeOpen = false; ticketCache = null; }
    else connect();
    fillCars();
    render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) connect(); });
  setInterval(() => {
    if (ws && !data && !wanted()) disconnect(); // idle in the menu: free the Render instance
    const cutoff = Date.now() - 10 * 60e3;
    if (invites.some((i) => i.at < cutoff)) { invites = invites.filter((i) => i.at >= cutoff); render(); }
  }, 30e3);
  setInterval(() => { if (data && (launchTimer || data.room.status === 'racing')) render(); }, 250); // countdown + live standings
  requestAnimationFrame(frame);
  render();
}

function inviteRows(list) {
  return list.map((i) => `
    <div class='mp-inv'>
      <span>🏁 <b>${esc(i.from)}</b> invited you to race <b>${esc(trackName(i.track))}</b></span>
      <span class='mp-inv-btns'>
        <button class='acct-btn primary' type='button' data-act='join' data-room='${esc(i.room)}'>JOIN</button>
        <button class='acct-btn' type='button' data-act='decline' data-room='${esc(i.room)}' aria-label='Decline invite'>✕</button>
      </span>
    </div>`).join('');
}

function playerRows() {
  return `<ul class='mp-players'>${data.players.map((p) => `
    <li class='${p.present ? '' : 'away'}'>
      <span class='dot' aria-hidden='true'></span>
      <b>${esc(p.username)}</b>
      <span class='mp-car'>${esc(carName(p.id === data.me ? game.carId() : p.car))}</span>
      ${p.host ? "<span class='tagc'>HOST</span>" : ''}${p.id === data.me ? "<span class='tagc you'>YOU</span>" : ''}
    </li>`).join('')}</ul>`;
}

function resultRows() {
  const rows = standings();
  const lead = rows.find((p) => p.finish != null)?.finish;
  return `<ol class='mp-results'>${rows.map((p, i) => {
    let right;
    if (p.finish != null) right = `<b>${fmt(p.finish)}</b>${lead != null && p.finish > lead ? ` <span class='gap'>+${gapText(p.finish - lead)}s</span>` : ''}`;
    else if (p.dnf) right = `<span class='gap'>DNF</span>`;
    else right = `<span class='gap'>racing · ${Math.round(p.prog * 100)}%</span>`;
    return `<li class='${p.id === data.me ? 'me' : ''}'><span class='pos'>${i + 1}</span><span class='nm'>${esc(p.username)}</span><span class='tm'>${right}</span></li>`;
  }).join('')}</ol>`;
}

// Series points table. withDelta shows what each player just scored this round.
function seriesRows(label, withDelta) {
  const r = data.room;
  if (!r.standings?.length) return '';
  return `<div class='mp-label'>${esc(label)}</div><ol class='mp-results mp-series'>${r.standings.map((e, i) => {
    const last = e.results[e.results.length - 1];
    const delta = withDelta && last && last.round === r.round ? ` <span class='gap'>+${last.pts}</span>` : '';
    const hist = e.results.map((x) => (x.place ? ordinal(x.place) : 'DNF')).join(' · ');
    return `<li class='${e.id === data.me ? 'me' : ''}${e.inRoom ? '' : ' away'}'>
      <span class='pos'>${i + 1}</span>
      <span class='nm'>${esc(e.username)}${e.wins ? ` <span class='gap'>🏆${e.wins > 1 ? '×' + e.wins : ''}</span>` : ''}<small class='mp-hist'>${hist}${e.inRoom ? '' : ' · left'}</small></span>
      <span class='tm'><b>${e.pts}</b> pts${delta}</span></li>`;
  }).join('')}</ol>`;
}

function connLine() {
  if (stopReason) return `${esc(stopReason)} <button type='button' class='link' data-act='retry'>Use it here</button>`;
  if (conn === 'online') return '';
  if (conn === 'connecting') return 'Connecting to the multiplayer server… If nobody has played for a while it can take up to a minute to wake up.';
  return `Offline. <button type='button' class='link' data-act='retry'>Reconnect</button>`;
}

function render() {
  if (!game || !overlay) return;
  const user = SkyCloud.user;
  mpBtn.hidden = !SkyCloud.available;
  const pending = data ? 0 : invites.length;
  mpBtn.innerHTML = `MULTIPLAYER 👥${pending ? ` <span class='badge'>${pending}</span>` : ''}`;
  setHTML(banner, user && !data && invites.length && !homeOpen ? inviteRows(invites) : '');

  let view = null;
  const r = data?.room, self = me();
  if (user && data) {
    if (r.status === 'lobby') view = 'lobby';
    else if (r.status === 'racing' && self?.racing && launchedRace !== r.raceNo) view = 'starting';
    else if (inLiveRace()) view = null; // driving: HUD only
    else view = 'results';
  } else if (user && homeOpen) view = 'home';

  // Live race HUD
  const showHud = !!data && r.status === 'racing' && launchedRace === r.raceNo && mode() !== 'menu';
  hud.classList.toggle('hidden', !showHud);
  if (showHud) {
    setHTML(hud, `${roundTag() ? `<div class='mp-round'>${roundTag()}</div>` : ''}<ol>${standings().map((p, i) => `<li class='${p.id === data.me ? 'me' : ''}${p.dnf ? ' out' : ''}'><span>${i + 1}</span><b>${esc(p.username)}</b><em>${p.finish != null ? fmt(p.finish) : p.dnf ? 'DNF' : Math.round(p.prog * 100) + '%'}</em></li>`).join('')}</ol>
      ${inLiveRace() ? "<button type='button' class='mp-leave' data-act='leave-race'>Leave race</button>" : ''}`);
  }

  overlay.classList.toggle('hidden', !view);
  overlay.classList.toggle('dim', view === 'home' || view === 'lobby' || view === 'starting');
  overlay.classList.toggle('mp-side', view === 'results');
  if (!view) return;

  els.pickers.hidden = view !== 'lobby';
  els.inviteForm.hidden = view !== 'lobby';
  const line = connLine();
  setHTML(els.msg, [esc(notice), line].filter(Boolean).join('<br>'));
  let title = 'Multiplayer', sub = '', body = '', acts = '';

  if (view === 'home') {
    const t = game.tracks[game.trackIndex()];
    sub = "Race friends live. Opponents are see-through and can't hit you. The fastest time wins, to the millisecond.";
    body = invites.length ? `<div class='mp-label'>INVITES</div>${inviteRows(invites)}` : '';
    acts = `<button class='btn primary' type='button' data-act='create' ${conn !== 'online' ? 'disabled' : ''}>CREATE ROOM</button>
            <button class='btn' type='button' data-act='close'>CLOSE</button>
            <div class='mp-hint'>Room starts on <b>${esc(t?.name)}</b>. The host can change it in the lobby. Friends need the game open and be signed in to get your invite.</div>`;
  } else if (view === 'lobby') {
    const present = data.players.filter((p) => p.present).length;
    const host = data.players.find((p) => p.host);
    title = 'Lobby';
    const roundsLine = multiRound() ? `Round <b>${nextRound()}</b> of <b>${r.rounds}</b> · ` : '';
    sub = `${roundsLine}Racing <b>${esc(trackName(r.track))}</b>. Invite friends by username.`;
    body = playerRows();
    if (multiRound() && r.round > 0 && r.standings?.length) body += seriesRows(seriesOver() ? 'LAST SERIES · FINAL STANDINGS' : 'SERIES STANDINGS', false);
    if (document.activeElement !== els.track) els.track.value = String(Math.max(0, trackIdx(r.track)));
    els.track.disabled = !isHost();
    if (document.activeElement !== els.car) els.car.value = String(game.carIndex());
    if (document.activeElement !== els.rounds) {
      if (!ROUND_CHOICES.includes(r.rounds)) els.rounds.insertAdjacentHTML('beforeend', `<option value='${r.rounds}'>${r.rounds} rounds</option>`);
      els.rounds.value = String(r.rounds);
    }
    els.rounds.disabled = !isHost() || seriesRunning();
    const startLabel = multiRound() ? `START ROUND ${nextRound()}/${r.rounds} ▶` : 'START RACE ▶';
    acts = isHost()
      ? `<button class='btn primary' type='button' data-act='start' ${present < 2 ? 'disabled' : ''}>${startLabel}</button>`
      : `<div class='mp-hint'>Waiting for <b>${esc(host?.username)}</b> to start…</div>`;
    if (isHost() && seriesRunning()) acts += `<button class='btn' type='button' data-act='end-series'>END SERIES</button>`;
    acts += `<button class='btn' type='button' data-act='leave'>LEAVE ROOM</button>`;
    if (isHost() && present < 2) acts += `<div class='mp-hint'>You need at least one friend in the lobby to start.</div>`;
  } else if (view === 'starting') {
    const s = Math.max(0, Math.ceil((r.startAt - serverNow()) / 1000));
    title = 'Get ready';
    sub = `${roundTag() ? `${roundTag()} · ` : ''}<b>${esc(trackName(r.track))}</b> · starting in <b class='mp-count'>${s}</b>`;
    body = playerRows();
  } else if (view === 'results') {
    const done = r.status === 'finished';
    const fin = standings().filter((p) => p.finish != null);
    title = done ? 'Results' : 'Race in progress';
    if (multiRound()) title = done ? (seriesOver() ? 'Final round' : `Round ${r.round}/${r.rounds} results`) : `Round ${r.round}/${r.rounds}`;
    if (done && fin.length) {
      const [a, b] = fin;
      if (b && a.finish === b.finish) sub = '🏁 Dead heat!';
      else if (b) sub = `🏆 <b>${esc(a.username)}</b> wins by <b>${gapText(b.finish - a.finish)}s</b>`;
      else sub = `🏆 <b>${esc(a.username)}</b> wins`;
    } else if (done) sub = 'Nobody finished.';
    else if (myResult?.pending) sub = `You finished in <b>${fmt(myResult.time)}</b> · sending time…`;
    else sub = 'Waiting for everyone to finish…';
    if (myResult?.error) setHTML(els.msg, esc(myResult.error));
    body = resultRows();
    if (multiRound() && done) {
      const champ = seriesOver() ? r.standings[0] : null;
      if (champ) sub += `<br>👑 <b>${esc(champ.username)}</b> wins the series with <b>${champ.pts}</b> pts`;
      body += seriesRows(seriesOver() ? 'FINAL STANDINGS' : 'SERIES STANDINGS', true);
    }
    if (done && isHost() && seriesRunning()) {
      acts = `<button class='btn primary' type='button' data-act='next'>NEXT ROUND ▶</button>
              <button class='btn' type='button' data-act='reset'>LOBBY</button>
              <div class='mp-hint'>Go to the lobby to pick a different track for round ${r.round + 1}.</div>`;
    } else if (done && isHost()) acts = `<button class='btn primary' type='button' data-act='reset'>BACK TO LOBBY</button>`;
    else if (done) acts = `<div class='mp-hint'>Waiting for the host…</div>`;
    acts += `<button class='btn' type='button' data-act='leave'>LEAVE ROOM</button>`;
  }

  setHTML(els.sub, sub);
  overlay.querySelector('#mp-title').textContent = title;
  setHTML(els.body, body);
  setHTML(els.actions, acts);
}

// ---- hooks for game.js ------------------------------------------------------------

export const SkyMP = {
  // True while you're in a room: the game then blocks solo restarts, pausing and
  // the personal-best ghost, and shows multiplayer results instead of its finish screen.
  get active() { return !!data; },
  attach(hooks) {
    game = hooks;
    buildUI();
    connect();
  },
  onFinish(time) { onLocalFinish(time); },
};
