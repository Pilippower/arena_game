'use strict';
// Jeu en ligne entre amis (étape 1 : 1v1) — connexion directe entre navigateurs (WebRTC via PeerJS, chargé
// seulement quand on clique « Online » ; le service public PeerJS ne sert qu'à se trouver).
// L'hôte fait autorité : il simule la partie (dégâts, sorts, contrôles, manches) et envoie l'état 20 fois/s.
// L'invité se déplace en local avec les mêmes contrôles (pas de latence) et envoie sa position ; ses sorts, sa cible
// et son trinket partent chez l'hôte, qui lui renvoie les mêmes messages d'erreur que hors ligne (unitError). Pendant un déplacement imposé par l'hôte (ruée, blink, peur, étourdissement,
// mouton) ou en cas d'écart > 3 m, l'invité reprend la position de l'hôte.
// Points d'accroche : update() (sim.js), resetRound / tryPlayerSkill / useTrinket (combat.js), setTarget (rules.js),
// showResults (match.js), bouton Play du lobby (settings.js).
var NET = {
  // var : visible comme window.NET par les points d'accroche
  role: null, // 'host' | 'guest' | null
  peer: null,
  conn: null,
  code: '',
  guest: null, // hôte : { cls, race, name } de l'invité
  events: [],
  sendT: 0,
  inT: 0,
  snap: null,
  remote: null, // hôte : dernière entrée de l'invité
  lastEnded: false
};
const NET_PREFIX = 'arena-ascendant-';
const netIdx = u => (state?.units ? state.units.indexOf(u) : -1);
const r2 = v => Math.round(v * 100) / 100;
function netSend(m) {
  if (NET.conn?.open) NET.conn.send(m);
}
function netStatus(t) {
  const el = $('netStatus');
  if (el) el.textContent = t;
}
function netLoadPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = ok;
    s.onerror = () => ko(new Error('PeerJS unavailable'));
    document.head.appendChild(s);
  });
}
function netCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => A[(Math.random() * A.length) | 0]).join('');
}
function netClose(msg) {
  try {
    NET.conn?.close();
    NET.peer?.destroy();
  } catch (_) {}
  Object.assign(NET, { role: null, peer: null, conn: null, guest: null, remote: null, snap: null, events: [] });
  netStatus(msg || 'Offline');
  netLobbyButtons();
}
function netLobbyButtons() {
  const b = $('onlineBtn');
  if (b) b.classList.toggle('selected', !!NET.role);
  const play = $('playBtn');
  if (play && NET.role === 'guest') play.disabled = true;
}
// ---------- lobby ----------
async function netHost() {
  netClose('Connecting…');
  try {
    await netLoadPeer();
  } catch (e) {
    return netStatus('Online play unavailable (no connection to the PeerJS service).');
  }
  NET.code = netCode();
  NET.role = 'host';
  NET.peer = new Peer(NET_PREFIX + NET.code);
  NET.peer.on('open', () => {
    $('netCode').textContent = NET.code;
    netStatus('Share this code with your friend, then wait for them to join.');
  });
  NET.peer.on('error', e => netStatus('Error: ' + (e.type || e.message)));
  NET.peer.on('connection', c => {
    if (NET.conn?.open) return c.close(); // une seule place en 1v1
    NET.conn = c;
    c.on('data', netOnData);
    c.on('close', () => netLost('Your friend left.'));
  });
  netLobbyButtons();
}
async function netJoin(code) {
  code = (code || '').trim().toUpperCase();
  if (code.length < 4) return netStatus('Enter the code given by the host.');
  netClose('Connecting…');
  try {
    await netLoadPeer();
  } catch (e) {
    return netStatus('Online play unavailable (no connection to the PeerJS service).');
  }
  NET.role = 'guest';
  NET.peer = new Peer();
  NET.peer.on('error', e =>
    netStatus('Error: ' + (e.type === 'peer-unavailable' ? 'no game with this code' : e.type || e.message))
  );
  NET.peer.on('open', () => {
    const c = (NET.conn = NET.peer.connect(NET_PREFIX + code, { reliable: true }));
    c.on('open', () => {
      netStatus('Connected! Pick your race and class — the host starts the match.');
      netLobbyChoice();
    });
    c.on('data', netOnData);
    c.on('close', () => netLost('The host left the game.'));
  });
  netLobbyButtons();
}
// choix de l'invité envoyé à l'hôte (à la connexion et à chaque changement de carte)
let NET_CHOICE = { race: null, cls: null };
function netLobbyChoice(race, cls) {
  if (race !== undefined) NET_CHOICE = { race, cls };
  if (NET.role === 'guest') netSend({ t: 'hello', race: NET_CHOICE.race, cls: NET_CHOICE.cls });
  netLobbyButtons();
}
function netLost(msg) {
  const wasGuestInGame = NET.role === 'guest' && state?.units;
  if (NET.role === 'host' && state?.units) {
    // l'invité est parti : son personnage passe à l'IA, la partie continue
    for (const u of state.units)
      if (u.remote) {
        u.remote = false;
        u.ai = true;
      }
    showError?.('Your friend left — an AI takes over');
  }
  netClose(msg);
  if (wasGuestInGame) {
    leaveMatch();
    showError?.(msg);
  }
}
// ---------- messages ----------
function netOnData(m) {
  if (!m || !m.t) return;
  if (NET.role === 'host') {
    if (m.t === 'hello') {
      NET.guest = m.cls && m.race ? { cls: m.cls, race: m.race, name: 'Friend' } : null;
      netStatus(
        NET.guest
          ? `Your friend is ready: ${RACE[m.race].name} ${CLASS[m.cls].name}. Press Play to start the 1v1.`
          : 'Your friend joined — waiting for their race and class…'
      );
      return;
    }
    const u = state?.units?.find(v => v.remote);
    if (!u) return;
    if (m.t === 'in') NET.remote = m;
    else if (m.t === 'skill') {
      // comme tryPlayerSkill : un sort appuyé juste avant la fin du GCD ou de sa recharge part dès que possible
      if (u.alive && !(u.poly > 0) && !useSkill(u, m.i)) {
        const W = SPELL_QUEUE_WINDOW;
        if ((u.gcd > 0 && u.gcd <= W) || (u.cd[m.i] > 0 && u.cd[m.i] <= W))
          u.queuedSkill = { i: m.i, until: now() + 0.35 };
        else unitError(u, skillFailReason(u, m.i)); // même message que hors ligne (portée, recharge, ressource…)
      }
    } else if (m.t === 'trinket') useTrinket(u);
    else if (m.t === 'target') setTarget(u, state.units[m.i] || null);
    return;
  }
  // invité
  if (m.t === 'roster') netGuestBuild(m);
  else if (m.t === 's') NET.snap = m;
  else if (m.t === 'err') showError(m.text);
  else if (m.t === 'results' && state?.units) {
    state.stats = m.stats;
    const me = state.player.team;
    state.scoreA = me ? m.scoreB : m.scoreA;
    state.scoreB = me ? m.scoreA : m.scoreB;
    showResults();
  }
}
// ---------- hôte ----------
// Composition en ligne : l'hôte contre son ami (1v1).
function netRoster() {
  return state.units.map(u => ({
    cls: u.cls,
    race: u.race,
    team: u.team,
    name: u.remote ? 'You' : u === state.player ? 'Host' : u.name
  }));
}
function netSendRoster() {
  if (NET.role !== 'host' || !state?.units) return;
  $('netPanel').style.display = 'none';
  netSend({
    t: 'roster',
    map: MAP_ID,
    round: state.round,
    size: state.size,
    scoreA: state.scoreA,
    scoreB: state.scoreB,
    me: state.units.findIndex(u => u.remote),
    units: netRoster()
  });
}
function netUnitState(u) {
  return {
    x: r2(u.x),
    y: r2(u.y || 0),
    z: r2(u.z),
    yaw: r2(u.yaw),
    hp: Math.round(u.hp),
    mh: u.maxHp,
    res: Math.round(u.res),
    sh: Math.round(u.shield || 0),
    sn: u.shieldName || null,
    al: u.alive,
    mv: !!u.moving,
    mp: r2(u.movePhase),
    gr: !!u.grounded,
    cast: u.cast ? { n: u.cast.name, i: u.cast.i, rem: r2(u.cast.end - now()), dur: u.cast.dur } : null,
    stun: r2(u.stun),
    root: r2(u.root),
    fear: r2(u.fear || 0),
    poly: r2(u.poly || 0),
    pk: u.polyKind || null,
    sil: r2(u.silence),
    slow: r2(u.slow || 0),
    sp: u.slowPct || 0,
    burst: r2(u.burst),
    sb: r2(u.speedBuff),
    si: r2(u.spellImmune || 0),
    st: !!u.stealth,
    form: u.form || null,
    act: r2(u.action),
    at: u.actionType,
    mob: u.mobility?.type || (u.mobility ? 'move' : null),
    tg: netIdx(u.target),
    ds: u.debuffSpell || null,
    lo: u.lockout && u.lockout.until > now() ? r2(u.lockout.until - now()) : 0,
    ah: r2(u.antiheal || 0),
    tr: r2(u.trinket),
    gcd: r2(u.gcd),
    gm: u.gcdMax || 1,
    cd: u.cd.map(r2)
  };
}
// Chaque pas de simulation de l'hôte (appelé par update) : position de l'invité, envoi de l'état 20 fois/s.
function netHostUpdate(dt) {
  const u = state.units.find(v => v.remote),
    m = NET.remote;
  if (u && m && u.alive) {
    const forced = u.mobility || u.fear > 0 || u.stun > 0 || u.poly > 0 || u.root > 0;
    if (!forced && Math.hypot(m.x - u.x, m.z - u.z) < 3) {
      u.x = m.x;
      u.z = m.z;
      u.y = m.y;
      u.vy = m.vy;
      u.grounded = m.gr;
      u.yaw = m.yaw;
      u.moving = m.mv;
      u.movePhase = m.mp;
      if (m.mv && u.cast) u.cast = null; // bouger interrompt l'incantation, comme pour le joueur
    } else if (forced) u.moving = !!u.mobility || u.fear > 0;
  }
  NET.sendT -= dt;
  if (NET.sendT > 0) return;
  NET.sendT = 0.05;
  netSend({
    t: 's',
    u: state.units.map(netUnitState),
    T: r2(state.t),
    el: r2(state.elapsed || 0),
    dp: state.dampening || 0,
    ended: !!state.ended,
    wt: state.winTeam ?? null,
    sa: state.scoreA,
    sb: state.scoreB,
    shr: state.shrines?.map(s => s.active),
    ev: NET.events.splice(0)
  });
}
// ---------- invité ----------
function netGuestBuild(m) {
  if (MAP_ID !== m.map) applyMap(m.map);
  const me = m.units[m.me];
  state = {
    pcls: me.cls,
    prace: me.race,
    scoreA: m.units[m.me].team ? m.scoreB : m.scoreA,
    scoreB: m.units[m.me].team ? m.scoreA : m.scoreB,
    round: m.round,
    stats: [],
    map: m.map,
    size: m.size,
    t: 150,
    elapsed: 0,
    dampening: 0,
    ended: false,
    keys: {},
    fx: [],
    floaters: [],
    shrines: HEALTH_SPOTS.map(p => ({ x: p.x, z: p.z, active: true, respawn: 0 })),
    splash: 1.8,
    uiTick: 0,
    online: true
  };
  state.units = m.units.map((r, i) => {
    const u = makeUnit(r.cls, 0, 0, r.team, r.name, false, r.race, i);
    u.slotIndex = i;
    return u;
  });
  state.player = state.units[m.me];
  NET.snap = null;
  NET.lastEnded = false;
  hideResults();
  $('netPanel').style.display = 'none';
  $('overlay').style.display = 'none';
  camera.yaw = state.player.team ? -Math.PI / 2 : Math.PI / 2;
  camera.pitch = 0.2;
  showSplash(`Round ${state.round}`);
  if (HF.enabled) hfSyncUnits();
  if (typeof musicStart === 'function' && m.round === 1) musicStart();
  updateUI();
}
const NET_COPY = u => s => {
  u.hp = s.hp;
  u.maxHp = s.mh;
  u.res = s.res;
  u.shield = s.sh;
  u.shieldName = s.sn;
  u.alive = s.al;
  u.cast = s.cast ? { name: s.cast.n, i: s.cast.i, end: now() + s.cast.rem, dur: s.cast.dur } : null;
  u.stun = s.stun;
  u.root = s.root;
  u.fear = s.fear;
  u.poly = s.poly;
  u.polyKind = s.pk;
  u.silence = s.sil;
  u.slow = s.slow;
  u.slowPct = s.sp;
  u.burst = s.burst;
  u.speedBuff = s.sb;
  u.spellImmune = s.si;
  u.stealth = s.st;
  u.form = s.form;
  u.action = s.act;
  u.actionType = s.at;
  u.mobility = s.mob ? { type: s.mob } : null;
  u.target = state.units[s.tg] || null;
  u.debuffSpell = s.ds;
  u.lockout = s.lo ? { until: now() + s.lo } : null;
  u.antiheal = s.ah;
  u.trinket = s.tr;
  u.gcd = s.gcd;
  u.gcdMax = s.gm;
  for (let i = 0; i < s.cd.length; i++) u.cd[i] = s.cd[i];
};
function netGuestUpdate(dt) {
  if (!state?.units) return;
  const P = state.player,
    S = NET.snap;
  for (const u of state.units) {
    u.prevX = u.x;
    u.prevY = u.y || 0;
    u.prevZ = u.z;
    u.prevYaw = u.yaw;
  }
  if (S) {
    state.t = S.T;
    state.elapsed = S.el;
    state.dampening = S.dp;
    state.scoreA = P.team ? S.sb : S.sa;
    state.scoreB = P.team ? S.sa : S.sb;
    S.shr?.forEach((a, i) => state.shrines[i] && (state.shrines[i].active = a));
    if (S.ended && !NET.lastEnded) {
      const win = S.wt === P.team;
      showSplash(win ? 'Round won!' : 'Round lost');
      if (win) SFX.victory(false);
      else SFX.defeat();
    }
    NET.lastEnded = state.ended = S.ended;
    state.winTeam = S.wt;
    for (const e of S.ev || []) netReplay(e);
    S.ev = [];
    const k = 1 - Math.exp(-dt * 18);
    state.units.forEach((u, i) => {
      const s = S.u[i];
      if (!s) return;
      NET_COPY(u)(s);
      const own = u === P,
        forced = s.mob || s.fear > 0 || s.stun > 0 || s.poly > 0,
        far = Math.hypot(s.x - u.x, s.z - u.z) > (own ? 3 : 4);
      if (own && !forced && !far) return; // l'invité se déplace lui-même
      if (far) {
        u.x = s.x;
        u.z = s.z;
        u.y = s.y;
        u.visualSnap = true;
      } else {
        u.x += (s.x - u.x) * k;
        u.z += (s.z - u.z) * k;
        u.y += (s.y - u.y) * k;
      }
      u.yaw = s.yaw;
      u.moving = s.mv;
      u.movePhase = s.mp;
      u.grounded = s.gr;
    });
  }
  // déplacement local de l'invité : mêmes contrôles et même saut que hors ligne
  if (!state.ended && !(S && (S.u[netIdx(P)]?.mob || P.fear > 0))) {
    playerMove(dt);
    const ground = groundAt(P);
    if (P.grounded && (P.y || 0) > ground + 0.05) {
      P.grounded = false;
      P.vy = 0;
    } else if (P.grounded) P.y = ground;
    if (!P.grounded) {
      P.vy -= 19 * dt;
      P.y += P.vy * dt;
      if (P.y <= ground) {
        P.y = ground;
        P.vy = 0;
        P.grounded = true;
      }
    }
  }
  NET.inT -= dt;
  if (NET.inT <= 0) {
    NET.inT = 1 / 30;
    netSend({
      t: 'in',
      x: r2(P.x),
      y: r2(P.y || 0),
      z: r2(P.z),
      vy: r2(P.vy || 0),
      gr: !!P.grounded,
      yaw: r2(P.yaw),
      mv: !!P.moving,
      mp: r2(P.movePhase)
    });
  }
  if (state.splash > 0) state.splash -= dt;
  updateVisualState(dt);
  state.uiTick -= dt;
  if (state.uiTick <= 0) {
    state.uiTick = 0.08;
    updateUI();
  }
}
// ---------- événements visuels et sonores relayés par l'hôte ----------
const netArg = a => (a && typeof a === 'object' && 'cls' in a && 'team' in a ? { $u: netIdx(a) } : a);
const netUnArg = a => (a && typeof a === 'object' && '$u' in a ? state.units[a.$u] : a);
function netReplay(e) {
  const [k, ...a] = e;
  if (k === 'fx') NET_ORIG.fx(...a);
  else if (k === 'fl') NET_ORIG.addFloat(state.units[a[0]], a[1], a[2], a[3]);
  else if (k === 'S' && SFX[a[0]]) NET_ORIG.sfx[a[0]](...a[1].map(netUnArg));
}
const NET_ORIG = { fx, addFloat, sfx: {} };
window.fx = function (...a) {
  if (NET.role === 'host') NET.events.push(['fx', ...a.map(v => (v === undefined ? null : v))]);
  return NET_ORIG.fx(...a);
};
window.addFloat = function (u, text, color, big = false) {
  if (NET.role === 'host') NET.events.push(['fl', netIdx(u), text, color, big]);
  return NET_ORIG.addFloat(u, text, color, big);
};
// sons de combat : relayés, sauf victoire / défaite (chacun joue le sien selon son équipe)
for (const k of Object.keys(SFX)) {
  const f = (NET_ORIG.sfx[k] = SFX[k]);
  if (k === 'victory' || k === 'defeat') continue;
  SFX[k] = (...a) => {
    if (NET.role === 'host' && state?.units) NET.events.push(['S', k, a.map(netArg)]);
    return f(...a);
  };
}
// ---------- panneau « Online » du lobby ----------
$('onlineBtn').onclick = () => ($('netPanel').style.display = 'flex');
$('netClose').onclick = () => ($('netPanel').style.display = 'none');
$('netHostBtn').onclick = () => netHost();
$('netJoinBtn').onclick = () => netJoin($('netJoinCode').value);
$('netLeaveBtn').onclick = () => {
  netClose('Offline');
  $('netCode').textContent = '—';
};
