// David Hlopetki Simulator: multiplayer server (deploy on Render as a Node web service).
//
// Holds rooms in memory and relays live positions over WebSockets. Cars never
// collide: the server only forwards positions so clients can draw see-through
// opponents. The winner is decided by comparing each player's own finish time
// (measured by the game's fixed-step physics), never by arrival order.
//
// Identity comes from a 60-second ticket signed by the game's Vercel API
// (/api/auth?ticket) with an Ed25519 key; this server only has the public key.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { verify, createPublicKey, randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_KEY = createPublicKey(process.env.TICKET_PUBLIC_KEY || readFileSync(new URL('./ticket-public.pem', import.meta.url)));
const ORIGIN_RE = process.env.ALLOWED_ORIGINS
  ? null
  : /^(https:\/\/david-hlopetki(-[a-z0-9-]+)?\.vercel\.app|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const ALLOWED = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean));

const MAX_PLAYERS = 8;
const START_DELAY_MS = 5000;     // countdown lead so every client lines up
const RACE_MAX_MS = 10 * 60e3;
const DROP_GRACE_MS = 10e3;      // reconnect window before a dropped player is out
const INVITE_TTL_MS = 10 * 60e3;
const FINISH_SLACK_LATE = 5;     // seconds a reported time may exceed the server clock (clock-sync error)
const FINISH_SLACK_EARLY = 60;   // ...or trail it (late start, slow machine dropping frames, short freezes)
const MAX_ROUNDS = 10;
const POINTS = [10, 8, 6, 5, 4, 3, 2, 1]; // per finishing place in a round; DNF scores 0
const ID_RE = /^[a-z0-9_-]{1,32}$/;
const NAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/** userId -> { id, name, ws, roomId, dropTimer } */
const users = new Map();
/** lowercased name -> userId (online users only) */
const byName = new Map();
/** roomId -> room */
const rooms = new Map();

// ---- tickets ----------------------------------------------------------------------

function readTicket(ticket) {
  if (typeof ticket !== 'string' || ticket.length > 1000) return null;
  const [payload, sig] = ticket.split('.');
  if (!payload || !sig) return null;
  try {
    if (!verify(null, Buffer.from(payload), PUBLIC_KEY, Buffer.from(sig, 'base64url'))) return null;
    const t = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!t || typeof t.uid !== 'string' || !NAME_RE.test(t.name) || !(t.exp > Date.now())) return null;
    return t;
  } catch {
    return null;
  }
}

// ---- rooms ------------------------------------------------------------------------

function newRoomId() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id;
  do { id = Array.from({ length: 8 }, () => abc[randomInt(abc.length)]).join(''); } while (rooms.has(id));
  return id;
}

function makeMember(user, car) {
  return { id: user.id, name: user.name, car, joinedAt: Date.now(), connected: true, raceNo: 0, finish: null, dnf: false, state: null };
}

// Series standings: most points, then most round wins, then best average place.
function seriesTable(room) {
  return [...room.series.values()]
    .map((e) => ({
      id: e.id, username: e.name, pts: e.pts, wins: e.wins, results: e.results,
      inRoom: room.members.has(e.id),
    }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.username.localeCompare(b.username));
}

const seriesRunning = (room) => room.round > 0 && room.round < room.rounds;

function snapshot(room) {
  return {
    id: room.id,
    track: room.track,
    status: room.status,
    raceNo: room.raceNo,
    rounds: room.rounds,
    round: room.round,
    standings: room.round > 0 ? seriesTable(room) : [],
    startAt: room.startAt,
    hostId: room.hostId,
    players: [...room.members.values()].map((m) => {
      const racing = room.raceNo > 0 && m.raceNo === room.raceNo && room.status !== 'lobby';
      return {
        id: m.id, username: m.name, car: publicCar(m.car), host: m.id === room.hostId,
        active: true, present: m.connected, racing,
        finish: racing ? m.finish : null, dnf: racing && m.finish == null && m.dnf,
        state: racing && room.status === 'racing' ? m.state : null,
      };
    }),
  };
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId) {
  const text = JSON.stringify(msg);
  for (const m of room.members.values()) {
    if (m.id === exceptId) continue;
    const ws = users.get(m.id)?.ws;
    if (ws && ws.readyState === 1) ws.send(text);
  }
}

function pushRoom(room) {
  broadcast(room, { type: 'room', now: Date.now(), room: snapshot(room) });
}

function settle(room) {
  if (room.status !== 'racing') return;
  const entrants = [...room.members.values()].filter((m) => m.raceNo === room.raceNo);
  const over = Date.now() - room.startAt > RACE_MAX_MS;
  if (over || entrants.every((m) => m.finish != null || m.dnf)) {
    room.status = 'finished';
    clearTimeout(room.capTimer);
    for (const m of entrants) { m.state = null; if (m.finish == null) m.dnf = true; }
    award(room, entrants);
  }
}

// Points for the round that just finished. Equal times share a place.
function award(room, entrants) {
  const fin = entrants.filter((m) => m.finish != null).sort((a, b) => a.finish - b.finish);
  let place = 0;
  fin.forEach((m, i) => { if (i === 0 || m.finish !== fin[i - 1].finish) place = i + 1; m.place = place; });
  for (const m of entrants) {
    let e = room.series.get(m.id);
    if (!e) { e = { id: m.id, name: m.name, pts: 0, wins: 0, results: [] }; room.series.set(m.id, e); }
    e.name = m.name;
    const placed = m.finish != null ? m.place : null;
    const pts = placed ? (POINTS[placed - 1] ?? 0) : 0;
    e.pts += pts;
    if (placed === 1) e.wins++;
    e.results.push({ round: room.round, track: room.track, place: placed, time: m.finish, pts });
  }
}

// Starts the next round (or a fresh series when the last one is over).
function startRound(room) {
  const present = [...room.members.values()].filter((m) => m.connected);
  if (present.length < 2) return 'You need at least 2 players in the lobby.';
  if (!seriesRunning(room)) { room.series.clear(); room.round = 0; }
  room.round++;
  room.raceNo++;
  room.status = 'racing';
  room.startAt = Date.now() + START_DELAY_MS;
  for (const m of present) Object.assign(m, { raceNo: room.raceNo, finish: null, dnf: false, state: null, place: null });
  clearTimeout(room.capTimer);
  room.capTimer = setTimeout(() => { settle(room); pushRoom(room); }, START_DELAY_MS + RACE_MAX_MS + 1000);
  return null;
}

function leaveRoom(userId) {
  const u = users.get(userId);
  const roomId = u?.roomId;
  const room = roomId && rooms.get(roomId);
  if (u) u.roomId = null;
  if (!room) return;
  room.members.delete(userId);
  if (!room.members.size) {
    clearTimeout(room.capTimer);
    rooms.delete(room.id);
    return;
  }
  if (room.hostId === userId) {
    room.hostId = [...room.members.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0].id;
  }
  settle(room);
  pushRoom(room);
}

function joinRoom(user, room, car) {
  if (user.roomId && user.roomId !== room.id) leaveRoom(user.id);
  user.roomId = room.id;
  if (!room.members.has(user.id)) room.members.set(user.id, makeMember(user, car));
  else Object.assign(room.members.get(user.id), { connected: true, car: car || room.members.get(user.id).car });
  room.invited.delete(user.id);
  pushRoom(room);
}

// ---- message handling -------------------------------------------------------------

const err = (ws, text) => send(ws, { type: 'error', text });
// Cars only one account may drive. Anyone else sending the id is treated as "no car".
const SECRET_CAR = { hub: 'advaitstechhub' };
// What other players are told about a car: secret ones look like the stock car they're styled after.
const DISGUISE = { hub: 'nikhil' };
const publicCar = (c) => DISGUISE[c] ?? c;
const carOf = (v, user) => {
  if (typeof v !== 'string' || !ID_RE.test(v)) return null;
  const owner = SECRET_CAR[v];
  if (owner && (!user || String(user.name).toLowerCase() !== owner)) return null;
  return v;
};

function onMessage(user, ws, msg) {
  const room = user.roomId ? rooms.get(user.roomId) : null;
  const member = room?.members.get(user.id);
  const isHost = room && room.hostId === user.id;

  switch (msg.type) {
    case 'ping':
      return send(ws, { type: 'pong', c: msg.c, s: Date.now() });

    case 'create': {
      if (typeof msg.track !== 'string' || !ID_RE.test(msg.track)) return err(ws, 'Bad track.');
      const r = {
        id: newRoomId(), track: msg.track, status: 'lobby', raceNo: 0, startAt: null, hostId: user.id,
        members: new Map(), invited: new Map(), capTimer: null,
        rounds: 1, round: 0, series: new Map(),
      };
      rooms.set(r.id, r);
      return joinRoom(user, r, carOf(msg.car, user));
    }

    case 'invite': {
      if (!room) return err(ws, 'Create a room first.');
      const name = typeof msg.name === 'string' ? msg.name.trim() : '';
      if (!NAME_RE.test(name)) return err(ws, 'Enter a valid username.');
      const targetId = byName.get(name.toLowerCase());
      const target = targetId && users.get(targetId);
      if (!target) return err(ws, `${name} isn't online right now. They need the game open and be signed in.`);
      if (target.id === user.id) return err(ws, "You can't invite yourself.");
      if (room.members.has(target.id)) return err(ws, `${target.name} is already in the room.`);
      if (room.members.size >= MAX_PLAYERS) return err(ws, 'The room is full.');
      room.invited.set(target.id, Date.now());
      send(target.ws, { type: 'invite', room: room.id, from: user.name, track: room.track, at: Date.now() });
      return send(ws, { type: 'notice', text: `Invite sent to ${target.name}.` });
    }

    case 'join': {
      const r = rooms.get(msg.room);
      if (!r) return err(ws, 'That room has closed.');
      const at = r.invited.get(user.id);
      if (!r.members.has(user.id) && !(at && Date.now() - at < INVITE_TTL_MS)) return err(ws, 'That invite has expired.');
      if (!r.members.has(user.id) && r.members.size >= MAX_PLAYERS) return err(ws, 'The room is full.');
      return joinRoom(user, r, carOf(msg.car, user));
    }

    case 'decline': {
      rooms.get(msg.room)?.invited.delete(user.id);
      return;
    }

    case 'leave':
      leaveRoom(user.id);
      return send(ws, { type: 'room', now: Date.now(), room: null });

    case 'car': {
      if (!member) return;
      member.car = carOf(msg.car, user) || member.car;
      return pushRoom(room);
    }

    case 'track': {
      if (!isHost) return err(ws, 'Only the host can change the track.');
      if (room.status !== 'lobby') return err(ws, 'Wait for the race to end.');
      if (typeof msg.track !== 'string' || !ID_RE.test(msg.track)) return err(ws, 'Bad track.');
      room.track = msg.track;
      return pushRoom(room);
    }

    case 'rounds': {
      if (!isHost) return err(ws, 'Only the host can change the number of rounds.');
      if (room.status !== 'lobby') return err(ws, 'Wait for the race to end.');
      if (seriesRunning(room)) return err(ws, 'Finish or end the current series first.');
      const n = msg.rounds;
      if (!Number.isInteger(n) || n < 1 || n > MAX_ROUNDS) return err(ws, 'Bad number of rounds.');
      room.rounds = n;
      room.round = 0;
      room.series.clear();
      return pushRoom(room);
    }

    case 'endSeries': {
      if (!isHost) return err(ws, 'Only the host can do that.');
      if (room.status === 'racing') return err(ws, 'Wait for the race to end.');
      room.round = 0;
      room.series.clear();
      if (room.status === 'finished') room.status = 'lobby';
      return pushRoom(room);
    }

    case 'start': {
      if (!isHost) return err(ws, 'Only the host can start the race.');
      if (room.status !== 'lobby') return err(ws, 'A race is already running.');
      const e = startRound(room);
      if (e) return err(ws, e);
      return pushRoom(room);
    }

    case 'next': {
      // Straight into the next round on the same track (host skips the lobby).
      if (!isHost) return err(ws, 'Only the host can start the next round.');
      if (room.status !== 'finished') return;
      room.status = 'lobby';
      const e = startRound(room);
      if (e) { pushRoom(room); return err(ws, e); }
      return pushRoom(room);
    }

    case 'state': {
      // Live position, relayed straight to the others. Cosmetic only.
      if (!member || room.status !== 'racing' || msg.raceNo !== room.raceNo || member.raceNo !== room.raceNo) return;
      if (member.finish != null || member.dnf) return;
      const now = Date.now();
      if (member.lastState && now - member.lastState < 25) return; // ~40 msg/s max
      member.lastState = now;
      const { t, p, cp } = msg;
      if (!finite(t) || t < 0 || t > 3600 || !Number.isInteger(cp) || cp < 0 || cp > 255) return;
      if (!Array.isArray(p) || p.length !== 7 || !p.every((v) => finite(v) && Math.abs(v) < 1e5)) return;
      member.state = { t, p, cp };
      return broadcast(room, { type: 'state', id: user.id, t, p, cp }, user.id);
    }

    case 'finish': {
      if (!member) return err(ws, 'You are not in a room.');
      if (room.status !== 'racing' || msg.raceNo !== room.raceNo || member.raceNo !== room.raceNo) {
        return send(ws, { type: 'finishAck', raceNo: msg.raceNo, ok: false, text: 'That race is over.' });
      }
      if (member.finish != null) return send(ws, { type: 'finishAck', raceNo: room.raceNo, ok: true });
      const time = msg.time;
      const elapsed = (Date.now() - room.startAt) / 1000;
      if (!finite(time) || time <= 0 || time > elapsed + FINISH_SLACK_LATE || time < elapsed - FINISH_SLACK_EARLY) {
        member.dnf = true;
        settle(room);
        pushRoom(room);
        return send(ws, { type: 'finishAck', raceNo: room.raceNo, ok: false, text: "Your time didn't match the race clock (was the game paused or in the background?)." });
      }
      member.finish = time; // full precision: decides the winner
      member.state = null;
      send(ws, { type: 'finishAck', raceNo: room.raceNo, ok: true });
      settle(room);
      return pushRoom(room);
    }

    case 'forfeit': {
      if (!member || room.status !== 'racing' || member.raceNo !== room.raceNo || member.finish != null) return;
      member.dnf = true;
      member.state = null;
      settle(room);
      return pushRoom(room);
    }

    case 'reset': {
      if (!isHost) return err(ws, 'Only the host can do that.');
      if (room.status !== 'finished') return;
      room.status = 'lobby';
      return pushRoom(room);
    }

    default:
      return err(ws, 'Unknown message.');
  }
}

// ---- connections ------------------------------------------------------------------

function onClose(user, ws) {
  if (user.ws !== ws) return; // replaced by a newer connection
  user.ws = null;
  if (byName.get(user.name.toLowerCase()) === user.id) byName.delete(user.name.toLowerCase());
  const room = user.roomId && rooms.get(user.roomId);
  const m = room?.members.get(user.id);
  if (m) { m.connected = false; pushRoom(room); }
  clearTimeout(user.dropTimer);
  user.dropTimer = setTimeout(() => {
    if (user.ws) return;
    const r = user.roomId && rooms.get(user.roomId);
    const mm = r?.members.get(user.id);
    if (r && mm) {
      if (r.status === 'racing' && mm.raceNo === r.raceNo && mm.finish == null) {
        // Out of this race; stays listed with a DNF until they leave or the room resets.
        mm.dnf = true; mm.state = null; settle(r); pushRoom(r);
      } else if (r.status !== 'racing') {
        leaveRoom(user.id);
      }
    }
    if (!user.roomId) users.delete(user.id);
  }, DROP_GRACE_MS);
}

const http = createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`David Hlopetki Simulator multiplayer server\nrooms: ${rooms.size}, online: ${byName.size}\n`);
});

const wss = new WebSocketServer({
  server: http,
  maxPayload: 16 * 1024,
  verifyClient: ({ origin }) => (ORIGIN_RE ? ORIGIN_RE.test(origin || '') : ALLOWED.has(origin)),
});

wss.on('connection', (ws) => {
  let user = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const helloTimer = setTimeout(() => ws.close(4001, 'hello timeout'), 10e3);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    if (!user) {
      if (msg.type !== 'hello') return ws.close(4001, 'say hello first');
      const t = readTicket(msg.ticket);
      if (!t) return ws.close(4003, 'bad ticket');
      clearTimeout(helloTimer);
      user = users.get(t.uid);
      if (user) {
        if (user.ws && user.ws !== ws) user.ws.close(4000, 'opened in another tab');
        clearTimeout(user.dropTimer);
        user.name = t.name;
      } else {
        user = { id: t.uid, name: t.name, ws: null, roomId: null, dropTimer: null };
        users.set(user.id, user);
      }
      user.ws = ws;
      byName.set(user.name.toLowerCase(), user.id);
      const room = user.roomId && rooms.get(user.roomId);
      const m = room?.members.get(user.id);
      if (m) { m.connected = true; pushRoom(room); }
      send(ws, { type: 'welcome', you: { id: user.id, name: user.name }, now: Date.now() });
      if (!room) send(ws, { type: 'room', now: Date.now(), room: null });
      // Re-deliver invites still open for this user.
      for (const r of rooms.values()) {
        const at = r.invited.get(user.id);
        if (at && Date.now() - at < INVITE_TTL_MS && !r.members.has(user.id)) {
          const host = r.members.get(r.hostId);
          send(ws, { type: 'invite', room: r.id, from: host?.name || 'Someone', track: r.track, at });
        }
      }
      return;
    }
    try { onMessage(user, ws, msg); } catch (e) { console.error(e); err(ws, 'Server error.'); }
  });

  ws.on('close', () => { clearTimeout(helloTimer); if (user) onClose(user, ws); });
  ws.on('error', () => {});
});

// Drop dead sockets (and keep proxies from idling the connection out).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 25e3);

http.listen(PORT, () => console.log(`multiplayer server on :${PORT}`));
