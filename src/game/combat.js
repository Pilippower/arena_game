'use strict';
// Règles de combat : unités, dégâts/soins, contrôles et rendements décroissants, interruptions, ruées, sorts (useSkill).
// ---------- gameplay ----------
function makeUnit(cls, x, z, team, name, ai = false, race = null, slot = 0) {
  const c = CLASS[cls];
  return {
    id: Math.random(),
    cls,
    name,
    team,
    ai,
    x,
    z,
    y: 0,
    vy: 0,
    grounded: true,
    yaw: team ? Math.PI : 0,
    hp: c.hp,
    maxHp: c.hp,
    res: 100,
    maxRes: 100,
    alive: true,
    cd: [0, 0, 0, 0, 0, 0],
    gcd: 0,
    trinket: 0,
    target: null,
    stun: 0,
    root: 0,
    silence: 0,
    shield: 0,
    antiheal: 0,
    burst: 0,
    speedBuff: 0,
    cast: null,
    flash: 0,
    moving: false,
    movePhase: 0,
    action: 0,
    actionType: '',
    queuedSkill: null,
    mobility: null,
    slow: 0,
    slowPct: 0,
    fear: 0,
    fearOwner: null,
    fearSourceX: x,
    fearSourceZ: z,
    fearPhase: Math.random() * 6.28,
    rootBreakDamage: 0,
    rootMin: 0,
    prevX: x,
    prevZ: z,
    prevYaw: team ? Math.PI : 0,
    visualSnap: false,
    stepCd: 0,
    race: race || raceForClass(cls, team, slot),
    dr: { stun: 1, root: 1, silence: 1, fear: 1, poly: 1 },
    drT: { stun: 0, root: 0, silence: 0, fear: 0, poly: 0 }
  };
}
function compForPlayer(cls) {
  if (cls === 'oracle') return ['sentinel', 'shade'];
  if (cls === 'sentinel') return ['oracle', 'arcanist'];
  if (cls === 'warlock') return ['oracle', 'sentinel'];
  return ['oracle', 'sentinel'];
}
// Format du match choisi au lobby : 1v1, 2v2 ou 3v3 (TEAM_SIZE joueurs par équipe, 3 par défaut).
let TEAM_SIZE = (() => {
  try {
    const n = +(new URLSearchParams(location.search).get('size') || localStorage.getItem('arenaTeamSize'));
    return n >= 1 && n <= 3 ? n : 3;
  } catch (_) {
    return 3;
  }
})();
// Équipes selon le format : en 2v2 un soigneur et un combattant de chaque côté ; en 1v1 un adversaire
// qui peut mourir (pas de soigneur seul en face).
function teamsFor(pcls, size) {
  const allies = compForPlayer(pcls),
    foes = [
      ['reaver', 'Kargan', 'orc'],
      ['arcanist', 'Nyx', 'elf'],
      ['oracle', 'Seris', 'dwarf']
    ];
  if (size === 3) return { allies, foes };
  if (size === 2) return { allies: allies.slice(0, 1), foes: [foes[0], foes[2]] };
  return { allies: [], foes: [pcls === 'reaver' ? ['sentinel', 'Kargan', 'orc'] : foes[0]] };
}
function resetRound() {
  const o = state || {},
    size = o.size || TEAM_SIZE,
    T = o.online
      ? { allies: [], foes: [[o.online.cls, o.online.name, o.online.race]] }
      : teamsFor(o.pcls || 'sentinel', size),
    allies = T.allies,
    spot = (i, n, gap) => (i - (n - 1) / 2) * gap; // en 3v3 : mêmes places qu'avant (alliés tous les 5, adversaires tous les 6)
  state = {
    pcls: o.pcls || 'sentinel',
    prace: o.prace || raceForClass(o.pcls || 'sentinel'),
    scoreA: o.scoreA || 0,
    scoreB: o.scoreB || 0,
    round: (o.round || 0) + 1,
    stats: o.stats && o.round ? o.stats : [],
    map: o.map,
    online: o.online || null, // en ligne : l'adversaire est l'ami connecté (src/net/online.js)
    size,
    t: 150,
    elapsed: 0,
    dampening: 0,
    ended: false,
    keys: {},
    fx: [],
    floaters: [],
    shrines: HEALTH_SPOTS.map(p => ({ x: p.x, z: p.z, active: true, respawn: 0 })),
    splash: 1.8,
    uiTick: 0
  };
  const mates = [
    [allies[0], 'Lyra', raceForClass(allies[0], 0, 1)],
    [allies[1], 'Torren', 'dwarf']
  ].slice(0, allies.length);
  state.units = [
    makeUnit(state.pcls, -26, spot(0, size, 5), 0, 'You', false, state.prace, 0),
    ...mates.map(([c, n, r], i) => makeUnit(c, -26, spot(i + 1, size, 5), 0, n, true, r, i + 1)),
    ...T.foes.map(([c, n, r], i) => makeUnit(c, 26, spot(i, size, 6), 1, n, true, r, i))
  ];
  state.units.forEach((u, i) => (u.slotIndex = i));
  if (state.online)
    for (const u of state.units)
      if (u.team === 1) {
        u.remote = true;
        u.ai = false;
      }
  state.player = state.units[0];
  setTarget(state.player, state.units[size]);
  applyDifficulty();
  camera.yaw = Math.PI / 2;
  camera.pitch = 0.2;
  showSplash(`Round ${state.round}`);
  if (HF.enabled) hfSyncUnits();
  updateUI();
  if (state.online) netSendRoster();
}
// distance 3D : une unité sur le pont n'est pas « au contact » d'une unité en dessous
const d2 = (a, b) => (!a || !b ? 999 : Math.hypot(a.x - b.x, a.z - b.z, ((a.y || 0) - (b.y || 0)) * 0.8));
function enemies(u) {
  return state.units.filter(v => v.team !== u.team && v.alive);
}
function allies(u) {
  return state.units.filter(v => v.team === u.team && v.alive);
}
function nearestEnemy(u, skipPoly = false) {
  return enemies(u)
    .filter(e => !skipPoly || !(e.poly > 0))
    .sort((a, b) => d2(a, u) - d2(b, u))[0];
}
function lowestAlly(u) {
  return allies(u).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}
function segmentCircle(ax, az, bx, bz, cx, cz, r) {
  const vx = bx - ax,
    vz = bz - az,
    wx = cx - ax,
    wz = cz - az,
    den = vx * vx + vz * vz || 1,
    t = clamp((vx * wx + vz * wz) / den, 0, 1);
  return Math.hypot(ax + vx * t - cx, az + vz * t - cz) < r;
}
function los(a, b) {
  if (!a || !b) return false;
  // le tablier du pont cache une unité en dessous à une unité dessus
  const B = arena.bridge;
  if (B) {
    const top = u => (u.y || 0) > B.y - 0.6,
      under = u => !top(u) && Math.abs(u.z) < B.halfW + 0.2;
    if ((top(a) && under(b)) || (top(b) && under(a))) return false;
  }
  const low = Math.min(a.y || 0, b.y || 0) + 1.2;
  return !arena.pillars.some(p => p.h > low && segmentCircle(a.x, a.z, b.x, b.z, p.x, p.z, p.r + 0.18));
}
function resolveWalls(u) {
  u.x = clamp(u.x, -arena.halfX + 0.72, arena.halfX - 0.72);
  u.z = clamp(u.z, -arena.halfZ + 0.72, arena.halfZ - 0.72);
  if (blockedBySurface(u) && u.prevX != null) {
    u.x = u.prevX;
    u.z = u.prevZ;
  }
  bridgeRail(u);
  for (const p of arena.pillars) {
    if ((u.y || 0) > p.h) continue; // au-dessus de l'obstacle (sur le pont)
    let dx = u.x - p.x,
      dz = u.z - p.z,
      d = Math.hypot(dx, dz),
      m = p.r + 0.66;
    if (d < m) {
      d = d || 0.01;
      u.x = p.x + (dx / d) * m;
      u.z = p.z + (dz / d) * m;
    }
  }
}
// Couleur des dégâts selon l'école (coups d'arme : rouge) ; un coup critique s'affiche en plus gros (big).
const SCHOOL_COLOR = {
  physical: '#ff7d88',
  arcane: '#e59bff',
  frost: '#8fdcff',
  holy: '#ffe79a',
  nature: '#d4ef6e',
  shadow: '#b897ff',
  unholy: '#a9e07a'
};
function addFloat(u, text, color, big = false) {
  if (!state) return;
  state.floaters.push({
    x: u.x,
    y: (u.y || 0) + 2.3,
    z: u.z,
    text,
    color,
    big,
    life: 1,
    max: 1,
    off: (Math.random() - 0.5) * 0.5
  });
}
function fx(type, x, y, z, color, life = 0.55, size = 0.4, to = null, extra = null) {
  if (!state) return;
  if (state.fx.length > 180) state.fx.splice(0, state.fx.length - 180);
  const f = { type, x, y, z, color, life, max: life, size, to, from: [x, y, z], extra };
  try {
    f.fx3d = !!(window.SpellFX?.ok && SpellFX.spawn(f));
  } catch (_) {}
  state.fx.push(f);
}
// school : 'physical' ou école du sort ; par défaut l'école du sort en cours du lanceur (src.curSchool).
function damage(src, t, v, crit = false, school = src.curSchool || 'physical') {
  if (!t?.alive) return;
  // mage : ses sorts sont toujours critiques sur une cible gelée par sa Frost Nova
  if (src.cls === 'arcanist' && school !== 'physical' && t.root > 0 && t.rootKind === 'ice') crit = true;
  // Cloak of Shadows : insensible aux sorts (pas aux coups d'arme)
  if (t.spellImmune > 0 && school !== 'physical' && src.team !== t.team) {
    addFloat(t, 'Immune', '#d9c9ff');
    return;
  }
  v *= 1 - armorReduction(t, school);
  if (t.poly > 0) endPoly(t, true);
  src.lastCombat = t.lastCombat = now();
  if (t.stealth) setStealth(t, false);
  if (src.stealth && src !== t) setStealth(src, false);
  if (t.form === 'bear') v *= FORM_INFO.bear.armor;
  v *= (src.burst > 0 ? 1.35 : 1) * (src.aiDmg || 1);
  if (t.shield > 0) {
    const q = Math.min(t.shield, v);
    t.shield -= q;
    v -= q;
  }
  v = Math.round(v * (crit ? 1.5 : 1));
  recordDamage(src, t, Math.min(v, t.hp));
  t.hp = Math.max(0, t.hp - v);
  t.flash = 0.14;
  src.res = clamp(src.res + 6, 0, 100);
  if (t.fear > 0 && v >= t.maxHp * 0.08) {
    t.fear = 0;
    t.fearOwner = null;
    addFloat(t, 'Fear broken', '#d8a7ff');
  }
  if (t.root > 0 && t.rootBreakDamage > 0) {
    t.rootBreakDamage -= v;
    if (t.rootMin <= 0 && t.rootBreakDamage <= 0) {
      t.root = 0;
      t.rootBreakDamage = 0;
      addFloat(t, 'Nova broken', '#9de8ff');
    }
  }
  addFloat(t, crit ? `-${v}!` : `-${v}`, SCHOOL_COLOR[school] || SCHOOL_COLOR.physical, crit);
  fx('burst', t.x, 1.15, t.z, [1, 0.18, 0.08], 0.42, 0.35);
  if (t.hp <= 0) {
    recordKill(src, t);
    t.alive = false;
    t.cast = null;
    t.mobility = null;
    t.fear = 0;
    addFloat(t, 'K.O.', '#ffe6a6');
  }
}
function heal(src, t, v) {
  if (!t?.alive) return;
  v *= src.aiHeal || 1;
  const damp = state?.dampening || 0;
  v = Math.round(v * (1 - clamp(t.antiheal, 0, 0.6)) * (1 - damp));
  if (v <= 0) return;
  recordHeal(src, Math.min(v, t.maxHp - t.hp));
  t.hp = Math.min(t.maxHp, t.hp + v);
  addFloat(t, `+${v}`, '#6ff395');
  fx('burst', t.x, 1.2, t.z, [0.15, 1, 0.5], 0.52, 0.42);
}
// Sort en train d'agir (lancement, fin d'incantation, impact d'une charge) : control / applySlow / interrupt
// notent sur la cible le sort qui a posé chaque effet (icônes des débuffs au-dessus des personnages).
let SPELL_NOW = null;
const markDebuff = (t, k) => SPELL_NOW && ((t.debuffSpell = t.debuffSpell || {})[k] = SPELL_NOW);
function control(t, type, dur, src = null) {
  if (t.spellImmune > 0 && src && src.team !== t.team && (src.curSchool || 'physical') !== 'physical') {
    addFloat(t, 'Immune', '#d9c9ff');
    return false;
  }
  const m = t.dr[type] ?? 1;
  // rendements décroissants épuisés : le sort part quand même, sans effet, et « Immune » s'affiche
  if (m <= 0) {
    addFloat(t, 'Immune', '#ffffff');
    return false;
  }
  dur *= m;
  t[type] = Math.max(t[type] || 0, dur);
  markDebuff(t, type);
  if (type === 'root') t.rootSchool = src?.curSchool || 'magic';
  t.dr[type] = m === 1 ? 0.5 : m === 0.5 ? 0.25 : 0;
  t.drT[type] = 20;
  if (type === 'stun' || type === 'fear' || type === 'silence' || type === 'poly') t.cast = null;
  if (type === 'poly') {
    t.polyOwner = src?.id ?? null;
    t.polyX = t.x;
    t.polyZ = t.z;
    t.wanderT = 0;
    t.mobility = null;
    t.fear = 0;
    t.fearOwner = null;
    t.queuedSkill = null;
  }
  if (type === 'fear') {
    t.fearOwner = src?.id ?? null;
    t.fearSourceX = src?.x ?? t.x;
    t.fearSourceZ = src?.z ?? t.z;
    t.mobility = null;
  }
  const label =
    type === 'poly'
      ? src?.cls === 'shade'
        ? 'Sapped!'
        : 'Sheep!'
      : type === 'stun'
        ? 'Stunned'
        : type === 'root'
          ? 'Rooted'
          : type === 'fear'
            ? 'Fear'
            : 'Silence';
  addFloat(t, label, '#f3d078');
  return true;
}
function applySlow(t, pct = 0.5, dur = 8, magic = false) {
  if (!t?.alive) return;
  t.slowMagic = magic;
  t.slow = Math.max(t.slow || 0, dur);
  t.slowPct = Math.max(t.slowPct || 0, clamp(pct, 0, 0.8));
  markDebuff(t, 'slow');
  addFloat(t, `Slowed ${Math.round(t.slowPct * 100)}%`, '#9ed7ff');
}
function moveSpeed(u) {
  const buff = u.speedBuff > 0 ? 1.18 : 1,
    slow = u.slow > 0 ? 1 - clamp(u.slowPct || 0, 0, 0.8) : 1,
    form = u.form ? FORM_INFO[u.form].speed : 1,
    st = u.stealth ? 0.7 : 1;
  return CLASS[u.cls].speed * buff * slow * form * st;
}
// Interruption : coupe l'incantation et verrouille son école 4 s (les sorts de cette école passent en recharge 4 s).
// Sort non abouti sans faute du lanceur : on rend la ressource et la recharge.
function refundCast(u, ca) {
  const S = CLASS[u.cls].skills[ca.i];
  if (!S) return;
  u.res = clamp(u.res + S.c, 0, 100);
  u.cd[ca.i] = 0;
}
function interrupt(u, t) {
  if (!t?.cast) return false;
  const S = CLASS[t.cls].skills[t.cast.i],
    sch = S?.s;
  t.cast = null;
  if (sch) {
    skillsOf(t).forEach((k, j) => {
      if (k.s === sch) t.cd[j] = Math.max(t.cd[j], 4);
    });
    t.lockout = { school: sch, until: now() + 4 };
    markDebuff(t, 'lockout');
  }
  addFloat(t, 'Interrupted!', '#ff9f6b');
  fx('silence', t.x, (t.y || 0) + 1.3, t.z, [1, 0.55, 0.3], 0.6, 0.7);
  return true;
}
// Death Grip : la cible est tirée jusqu'à 1,5 m devant le chevalier
function startGrip(u, t) {
  face(u, t);
  t.cast = null;
  t.mobility = { type: 'grip', tx: u.x + Math.sin(u.yaw) * 1.5, tz: u.z + Math.cos(u.yaw) * 1.5, speed: 26, life: 0.7 };
  fx('chain', u.x, (u.y || 0) + 1.2, u.z, CLASS[u.cls].accent, 0.5, 0.45, [t.x, (t.y || 0) + 1.2, t.z]);
}
function face(u, t) {
  if (t) u.yaw = Math.atan2(t.x - u.x, t.z - u.z);
}
function dashToward(u, t, a) {
  if (!t) return;
  let dx = t.x - u.x,
    dz = t.z - u.z,
    d = Math.hypot(dx, dz) || 1;
  const step = Math.max(0, Math.min(a, d - 1.6));
  u.x += (dx / d) * step;
  u.z += (dz / d) * step;
  resolveWalls(u);
  u.visualSnap = true;
}
function pointWalkable(x, z, margin = 0.68) {
  if (x < -arena.halfX + margin || x > arena.halfX - margin || z < -arena.halfZ + margin || z > arena.halfZ - margin)
    return false;
  return !arena.pillars.some(p => Math.hypot(x - p.x, z - p.z) < p.r + margin);
}
function blinkForward(u, distance = 7.0) {
  const ox = u.x,
    oz = u.z,
    sx = Math.sin(u.yaw),
    sz = Math.cos(u.yaw),
    step = 0.18;
  let bestX = ox,
    bestZ = oz;
  for (let d = step; d <= distance + 1e-6; d += step) {
    const x = ox + sx * d,
      z = oz + sz * d;
    if (!pointWalkable(x, z)) break;
    bestX = x;
    bestZ = z;
  }
  u.x = bestX;
  u.z = bestZ;
  resolveWalls(u);
  u.root = 0;
  u.visualSnap = true;
  return {
    from: [ox, (u.y || 0) + 0.75, oz],
    to: [u.x, (u.y || 0) + 0.75, u.z],
    distance: Math.hypot(u.x - ox, u.z - oz)
  };
}
function beginCharge(u, t, hitCC = { cc: 'stun', dur: 2 }) {
  if (!t?.alive) return false;
  const d = d2(u, t);
  if (d < 2.8 || d > 15 || !los(u, t)) return false;
  face(u, t);
  u.mobility = { type: 'charge', cc: hitCC, target: t, life: 0.72, speed: 24, stop: 1.48, hit: false, trailTick: 0 };
  u.cast = null;
  u.root = 0;
  action(u, 'dash');
  fx('chargeStart', u.x, (u.y || 0) + 0.85, u.z, CLASS[u.cls].accent, 0.42, 0.62);
  return true;
}
function finishCharge(u, hit = true) {
  const m = u.mobility;
  if (!m) return;
  const t = m.target;
  u.mobility = null;
  u.moving = false;
  if (hit && t?.alive && d2(u, t) < 2.15) {
    SPELL_NOW = m.cc?.cc === 'root' ? 'Wild Charge' : 'Charge';
    damage(u, t, 55);
    control(t, m.cc?.cc || 'stun', m.cc?.dur || 2, u);
    if (m.cc?.cc === 'root') t.rootKind = 'vines';
    fx('chargeImpact', t.x, (t.y || 0) + 1.0, t.z, CLASS[u.cls].accent, 0.62, 0.92);
    addFloat(t, 'Charge !', '#ffd995');
  }
}
function updateMobility(u, dt) {
  const m = u.mobility;
  if (!m) return false;
  if (m.type === 'grip') {
    m.life -= dt;
    const dx = m.tx - u.x,
      dz = m.tz - u.z,
      d = Math.hypot(dx, dz);
    if (d < 0.05 || m.life <= 0) {
      u.mobility = null;
      u.moving = false;
      return false;
    }
    const st = Math.min(d, m.speed * dt),
      nx = u.x + (dx / d) * st,
      nz = u.z + (dz / d) * st;
    if (!pointWalkable(nx, nz, 0.64)) {
      u.mobility = null;
      u.moving = false;
      return false;
    }
    u.x = nx;
    u.z = nz;
    u.yaw = Math.atan2(-dx, -dz);
    u.moving = false;
    return true;
  }
  if (m.type === 'charge') {
    const t = m.target;
    if (!t?.alive) {
      finishCharge(u, false);
      return false;
    }
    m.life -= dt;
    let dx = t.x - u.x,
      dz = t.z - u.z,
      d = Math.hypot(dx, dz) || 0.001;
    face(u, t);
    if (d <= m.stop) {
      finishCharge(u, true);
      return false;
    }
    const step = Math.min(m.speed * dt, Math.max(0, d - m.stop)),
      nx = u.x + (dx / d) * step,
      nz = u.z + (dz / d) * step;
    if (!pointWalkable(nx, nz, 0.64)) {
      finishCharge(u, false);
      return false;
    }
    const px = u.x,
      pz = u.z;
    u.x = nx;
    u.z = nz;
    u.moving = true;
    u.movePhase += dt * 15;
    m.trailTick -= dt;
    if (m.trailTick <= 0) {
      m.trailTick = 0.035;
      fx('chargeTrail', px, (u.y || 0) + 0.65, pz, CLASS[u.cls].accent, 0.22, 0.24, [u.x, (u.y || 0) + 0.75, u.z]);
    }
    if (m.life <= 0) finishCharge(u, d2(u, t) <= 2.15);
    return true;
  }
  return false;
}
function canPay(u, i) {
  return u.res >= (skillsOf(u)[i]?.c || 0);
}
function pay(u, i) {
  u.res = Math.max(0, u.res - (skillsOf(u)[i]?.c || 0));
}
function action(u, type = 0.32) {
  u.action = type === 'cast' ? 0.52 : type === 'dash' ? 0.38 : 0.36;
  u.actionType = type;
}
const SPELL_QUEUE_WINDOW = 0.18;
function showError(msg) {
  const e = $('errorMsg');
  if (!e || !msg) return;
  e.textContent = msg;
  e.classList.add('show');
  clearTimeout(showError.t);
  showError.t = setTimeout(() => e.classList.remove('show'), 1500);
}
// Raison d'un échec de sort (affichée au joueur)
function skillFailReason(u, i) {
  const C = CLASS[u.cls],
    S = skillsOf(u)[i];
  if (!S || !u.alive) return '';
  if (u.stun > 0 || u.fear > 0 || u.poly > 0 || u.mobility) return "I can't do that right now";
  if (u.cd[i] > 0)
    return u.lockout && now() < u.lockout.until && S.s === u.lockout.school
      ? 'That school is locked'
      : "That ability isn't ready yet";
  if (u.cast) return 'Not ready yet'; // une autre incantation est en cours (sauter ou bouger l'interrompt)
  if (u.gcd > 0) return '';
  if (S.s && u.silence > 0) return "I can't do that while silenced";
  if (!canPay(u, i)) return `I don't have enough ${C.res.toLowerCase()}`;
  const t = hostileTarget(u);
  if (S.t === 'aoe' && !enemies(u).some(e => d2(u, e) < 8)) return "I'm out of range";
  if (S.k === 'ambush' || S.k === 'sap') {
    if (!u.stealth) return 'You must be in stealth';
  }
  if (S.t === 'melee' || S.t === 'ranged' || S.t === 'charge') {
    if (!t) return 'I have no target';
    const d = d2(u, t);
    if (S.t === 'charge' && d < 2.8) return "I'm too close";
    if (d > (S.range || (S.t === 'melee' ? 2.45 : 15))) return "I'm out of range";
    if (!los(u, t)) return 'Target not in line of sight';
  }
  if (S.kick && !t?.cast) return 'Target is not casting';
  return "I can't do that right now";
}
// Message d'erreur pour le joueur qui contrôle l'unité : à l'écran ici, ou chez l'ami en ligne (src/net/online.js).
function unitError(u, text) {
  if (u === state?.player) showError(text);
  else if (u?.remote) netSend({ t: 'err', text });
}
function tryPlayerSkill(i) {
  const p = state?.player;
  if (!p || !skillsOf(p)[i] || p.poly > 0) return false;
  p.pressed = { i, t: now() }; // retour visuel d'appui (barre de sorts)
  updateUI();
  if (window.NET?.role === 'guest') return (netSend({ t: 'skill', i }), true); // l'hôte lance le sort
  if (useSkill(p, i)) {
    p.queuedSkill = null;
    return true;
  }
  const locked = (p.gcd > 0 && p.gcd <= SPELL_QUEUE_WINDOW) || (p.cd[i] > 0 && p.cd[i] <= SPELL_QUEUE_WINDOW);
  if (locked && p.alive && p.stun <= 0 && p.fear <= 0 && !p.cast && canPay(p, i)) {
    p.queuedSkill = { i, until: now() + 0.35 };
    updateUI();
    return true;
  }
  showError(skillFailReason(p, i));
  return false;
}
function spellFx(u, i, t, origin) {
  const c = CLASS[u.cls].accent,
    at = t || u;
  if (i === 4 && u.cls !== 'oracle') {
    if (u.cls === 'arcanist') {
      fx('blinkBurst', origin.x, (u.y || 0) + 0.9, origin.z, c, 0.5, 0.72);
      fx('blinkBurst', u.x, (u.y || 0) + 0.9, u.z, c, 0.6, 0.82);
      fx('blinkRibbon', origin.x, (u.y || 0) + 0.8, origin.z, c, 0.42, 0.18, [u.x, (u.y || 0) + 0.8, u.z]);
    } else if (u.cls === 'sentinel') {
      /* Charge crée son trail pendant la ruée */
    } else fx('trail', origin.x, (u.y || 0) + 0.6, origin.z, c, 0.36, 0.24, [u.x, (u.y || 0) + 0.6, u.z]);
    return;
  }
  if (u.cls === 'arcanist') {
    if (i === 0) fx('castArcane', u.x, (u.y || 0) + 1.25, u.z, c, 0.8, 0.55);
    else if (i === 1) fx('nova', u.x, 0.1, u.z, c, 0.82, 1.65);
    else if (i === 2) fx('silence', at.x, (at.y || 0) + 1.25, at.z, c, 0.52, 0.72);
    else if (i === 3) fx('aura', u.x, 0.08, u.z, c, 1.0, 1.1);
    else if (i === 5) fx('castArcane', u.x, (u.y || 0) + 1.25, u.z, [0.95, 0.8, 1], 0.8, 0.55);
  } else if (u.cls === 'oracle') {
    if (i === 0) fx('healCast', u.x, (u.y || 0) + 1.35, u.z, c, 0.85, 0.5, at ? [at.x, (at.y || 0) + 1.3, at.z] : null);
    else if (i === 1) fx('shield', at.x, (at.y || 0) + 1.1, at.z, c, 0.85, 0.78);
    else if (i === 2) fx('nova', u.x, 0.1, u.z, [0.7, 0.45, 1], 1.4, 1.2);
    else if (i === 3) fx('holyBurst', u.x, 0.12, u.z, c, 1.05, 1.7);
  } else if (u.cls === 'warden') {
    if (i === 0) fx('slash', at.x, (at.y || 0) + 1.1, at.z, c, 0.32, 0.55);
    else if (i === 1) fx('roots', at.x, 0.08, at.z, c, 0.9, 0.85);
    else if (i === 2) fx('shield', u.x, (u.y || 0) + 1.1, u.z, c, 0.85, 0.8);
    else if (i === 3) fx('starfall', u.x, 0.2, u.z, c, 1.05, 1.5, null, { seed: Math.random() * 10 });
  } else if (u.cls === 'warlock') {
    if (i === 0) fx('castShadow', u.x, (u.y || 0) + 1.25, u.z, c, 0.9, 0.55);
    else if (i === 1) fx('fear', at.x, (at.y || 0) + 1.1, at.z, c, 0.85, 0.85);
    else if (i === 2) fx('silence', at.x, (at.y || 0) + 1.25, at.z, c, 0.55, 0.72);
    else if (i === 3) fx('darkAura', u.x, 0.1, u.z, c, 1.1, 1.1);
  } else if (u.cls === 'reaver') {
    if (i === 0) fx('slash', at.x, (at.y || 0) + 1.1, at.z, c, 0.34, 0.65);
    else if (i === 1) fx('chain', u.x, (u.y || 0) + 1.2, u.z, c, 0.42, 0.18, [at.x, (at.y || 0) + 1.2, at.z]);
    else if (i === 2) fx('stun', at.x, (at.y || 0) + 1.45, at.z, c, 0.55, 0.7);
    else if (i === 3) fx('frostAura', u.x, 0.1, u.z, c, 1.1, 1.2);
  } else if (u.cls === 'sentinel') {
    if (i === 0) fx('slash', at.x, (at.y || 0) + 1.1, at.z, c, 0.32, 0.62);
    else if (i === 1) fx('snare', at.x, 0.1, at.z, c, 0.62, 0.75);
    else if (i === 2) fx('silence', at.x, (at.y || 0) + 1.2, at.z, c, 0.38, 0.6);
    else if (i === 3) fx('shield', u.x, (u.y || 0) + 1.05, u.z, c, 0.9, 0.86);
  } else if (u.cls === 'shade') {
    if (i === 0) fx('slash', at.x, (at.y || 0) + 1.0, at.z, c, 0.28, 0.55);
    else if (i === 1) fx('cloak', u.x, (u.y || 0) + 1.0, u.z, c, 0.8, 0.9);
    else if (i === 2) fx('stun', at.x, (at.y || 0) + 1.45, at.z, c, 0.52, 0.65);
    else if (i === 3) fx('darkAura', u.x, 0.1, u.z, c, 0.9, 1.0);
  }
}
function useSkill(u, i) {
  if (!u || !skillsOf(u)[i] || u.poly > 0) return false;
  if (skillsOf(u)[i].k) return useSpecialSkill(u, i);
  const origin = { x: u?.x || 0, z: u?.z || 0 };
  if (!u?.alive || u.stun > 0 || u.fear > 0 || u.gcd > 0 || u.cd[i] > 0 || u.cast || u.mobility || !canPay(u, i))
    return false;
  let t = hostileTarget(u);
  if (u.ai) u.target = t;
  else if (t && !u.target?.alive) setTarget(u, t);
  const c = CLASS[u.cls],
    S = skillsOf(u)[i];
  u.curSchool = S.s || 'physical';
  SPELL_NOW = S.n;
  const selfMobility = i === 4 && ['arcanist', 'warlock'].includes(u.cls),
    selfCC = u.cls === 'arcanist' && i === 1;
  if (!t && u.cls !== 'oracle' && !selfMobility && !selfCC) return false;
  const d = t ? d2(u, t) : 999,
    melee = d < 2.45,
    range = !!t && d < 15 && los(u, t);
  if (t && !(i === 4 && (u.cls === 'arcanist' || u.cls === 'reaver')) && !(u.cls === 'arcanist' && i === 1)) face(u, t);
  let ok = true;
  // emplacement 5 = mobilité, sauf le prêtre (Smite, sort de dégâts)
  if (i === 4 && u.cls !== 'oracle') {
    if (u.cls === 'arcanist') {
      blinkForward(u, S.dist);
      action(u, 'dash');
    } else if (u.cls === 'sentinel') {
      ok = beginCharge(u, t);
    } else if (u.cls === 'oracle') {
      const b = blinkForward(u, S.dist);
      u.root = 0;
      action(u, 'dash');
    } else if (u.cls === 'warlock') {
      blinkForward(u, S.dist);
      action(u, 'dash');
    } else if (u.cls === 'reaver') {
      const b = blinkForward(u, S.dist);
      u.visualSnap = true;
      u.speedBuff = Math.max(u.speedBuff, 3);
      action(u, 'dash');
    } else {
      if (!t || !range) ok = false;
      else {
        dashToward(u, t, 8);
        if (d2(u, t) < 2.7) damage(u, t, S.dmg);
        action(u, 'dash');
      }
    }
    if (ok && u.cls !== 'sentinel') {
      resolveWalls(u);
      fx('ring', u.x, 0.12, u.z, c.accent, 0.5, 0.75);
    }
  } else if (u.cls === 'sentinel') {
    if (i === 0 && melee) {
      damage(u, t, S.dmg, Math.random() < S.crit);
      t.antiheal = Math.min(0.5, t.antiheal + S.antiheal);
      markDebuff(t, 'antiheal');
      action(u, 'melee');
    } else if (i === 1 && melee) {
      applySlow(t, S.slow, S.dur);
      damage(u, t, S.dmg);
      action(u, 'melee');
    } else if (i === 2 && melee) {
      interrupt(u, t);
      action(u, 'melee');
    } else if (i === 3) {
      u.shield += S.shield;
      u.shieldName = S.n;
      fx('ring', u.x, 0.5, u.z, c.accent, 0.8, 1);
      action(u, 'cast');
    } else ok = false;
  } else if (u.cls === 'reaver') {
    if (i === 0 && melee) {
      damage(u, t, S.dmg, Math.random() < S.crit);
      t.antiheal = Math.min(0.5, t.antiheal + S.antiheal);
      markDebuff(t, 'antiheal');
      action(u, 'melee');
    } else if (i === 1 && range) {
      damage(u, t, S.dmg);
      startGrip(u, t);
      action(u, 'cast');
    } else if (i === 2 && range) {
      damage(u, t, S.dmg);
      control(t, 'stun', S.stun);
      action(u, 'cast');
    } else if (i === 3) {
      u.burst = S.burst;
      u.speedBuff = S.burst;
      fx('ring', u.x, 0.1, u.z, [1, 0.25, 0.05], 1, 1.15);
      action(u, 'cast');
    } else ok = false;
  } else if (u.cls === 'arcanist') {
    if (i === 0 && range && u.silence <= 0) {
      u.cast = castOf(u, i, t, 'damage', S.dmg);
      action(u, 'cast');
    } else if (i === 1) {
      const hit = enemies(u).filter(e => d2(u, e) < S.radius && los(u, e));
      if (!hit.length) return false;
      hit.forEach(e => {
        damage(u, e, e === t ? S.dmg : S.dmg2);
        // gel de 6 s qui ne casse pas sous les coups (demande de l'utilisateur)
        if (control(e, 'root', S.root, u)) e.rootKind = 'ice';
        fx('nova', e.x, 0.1, e.z, c.accent, 0.72, 0.75);
      });
      fx('nova', u.x, 0.1, u.z, c.accent, 1.15, 1.8);
      action(u, 'cast');
    } else if (i === 2 && range) {
      interrupt(u, t);
      action(u, 'cast');
    } else if (i === 3) {
      u.burst = S.burst;
      fx('ring', u.x, 0.1, u.z, c.accent, 1, 1.2);
      action(u, 'cast');
    } else if (i === 5 && range && u.silence <= 0) {
      u.cast = castOf(u, i, t, 'poly', S.dur);
      action(u, 'cast');
    } else ok = false;
  } else if (u.cls === 'oracle') {
    const a = u.ai ? lowestAlly(u) : friendlyTarget(u);
    if (i === 0 && a && los(u, a) && u.silence <= 0) {
      u.cast = castOf(u, i, a, 'heal', S.heal);
      action(u, 'cast');
    } else if (i === 1 && a) {
      a.shield += S.shield;
      a.shieldName = S.n;
      fx('ring', a.x, 0.2, a.z, c.accent, 0.8, 0.8);
      action(u, 'cast');
    } else if (i === 2) {
      // Holy Terror : fear instantané de tous les ennemis à portée (rendements décroissants habituels)
      const hit = enemies(u).filter(e => d2(u, e) < S.radius && los(u, e) && !e.stealth);
      if (!hit.length) return false;
      hit.forEach(e => {
        if (control(e, 'fear', S.dur, u)) fx('fear', e.x, (e.y || 0) + 1.15, e.z, c.accent, 1.0, 1.05);
      });
      action(u, 'cast');
    } else if (i === 4 && range && u.silence <= 0) {
      u.cast = castOf(u, i, t, 'damage', S.dmg);
      action(u, 'cast');
    } else if (i === 3) {
      allies(u).forEach(v => heal(u, v, S.heal));
      fx('ring', u.x, 0.1, u.z, c.accent, 1, 2);
      action(u, 'cast');
    } else ok = false;
  } else if (u.cls === 'warden') {
    if (i === 0 && range && u.silence <= 0) {
      u.cast = castOf(u, i, t, 'damage', S.dmg);
      action(u, 'cast');
    } else if (i === 1 && range) {
      if (control(t, 'root', S.root, u)) t.rootKind = 'vines';
      fx('roots', t.x, 0.1, t.z, c.accent, 0.8, 0.7);
      action(u, 'cast');
    } else if (i === 2) {
      u.shield += S.shield;
      u.shieldName = S.n;
      action(u, 'cast');
    } else if (i === 3) {
      enemies(u)
        .filter(e => d2(u, e) < S.radius)
        .forEach(e => damage(u, e, S.dmg));
      fx('ring', u.x, 0.1, u.z, c.accent, 0.85, 1.4);
      action(u, 'cast');
    } else ok = false;
  } else if (u.cls === 'shade') {
    if (i === 0 && melee) {
      damage(u, t, S.dmg, Math.random() < S.crit);
      action(u, 'melee');
    } else if (i === 1) {
      // Cloak of Shadows : immunité aux sorts, libère des racines et ralentissements magiques
      u.spellImmune = S.dur;
      if (u.root > 0 && u.rootSchool !== 'physical') {
        u.root = 0;
        u.rootBreakDamage = 0;
      }
      if (u.slow > 0 && u.slowMagic) u.slow = 0;
      u.cast = null;
      fx('cloak', u.x, (u.y || 0) + 1, u.z, [0.6, 0.4, 0.9], 0.9, 0.7);
      fx('ring', u.x, 0.1, u.z, c.accent, 0.7, 0.9);
      action(u, 'cast');
    } else if (i === 2 && melee) {
      damage(u, t, S.dmg);
      control(t, 'stun', S.stun);
      action(u, 'melee');
    } else if (i === 3) {
      u.burst = S.burst;
      action(u, 'cast');
    } else ok = false;
  } else if (u.cls === 'warlock') {
    if (i === 0 && range && u.silence <= 0) {
      u.cast = castOf(u, i, t, 'damage', S.dmg);
      action(u, 'cast');
    } else if (i === 1 && range && u.silence <= 0) {
      u.cast = castOf(u, i, t, 'fear', S.dur);
      action(u, 'cast');
    } else if (i === 2 && range) {
      interrupt(u, t);
      action(u, 'cast');
    } else if (i === 3) {
      u.burst = S.burst;
      u.shield += S.shield;
      u.shieldName = S.n;
      fx('ring', u.x, 0.1, u.z, c.accent, 1, 1.15);
      action(u, 'cast');
    } else ok = false;
  }
  if (!ok) return false;
  spellFx(u, i, t, origin);
  spellSfx(u, i, t);
  pay(u, i);
  u.cd[i] = S.cd;
  u.gcd = u.gcdMax = i === 4 && u.cls !== 'oracle' ? 0.35 : 1.05; // mobilité : GCD court (pas Smite)
  updateUI();
  return true;
}
function useTrinket(u) {
  if (window.NET?.role === 'guest' && u === state?.player) return netSend({ t: 'trinket' });
  if (!u?.alive || u.trinket > 0) return;
  if (u.stun > 0 || u.root > 0 || u.silence > 0 || u.fear > 0 || u.poly > 0) {
    u.stun = u.root = u.silence = u.fear = u.poly = 0;
    u.polyOwner = null;
    u.fearOwner = null;
    u.rootBreakDamage = 0;
    u.rootMin = 0;
    u.trinket = 90;
    u.shield += 80;
    u.shieldName = 'Trinket';
    fx('ring', u.x, 0.15, u.z, [1, 0.82, 0.28], 0.8, 1);
    addFloat(u, 'Trinket !', '#ffe17d');
    updateUI();
  }
}
// Avance tant qu'on n'est pas revenu à portée, ne repart qu'au-delà d'une marge ; seuls les lanceurs reculent (kite).
function aiMoveDir(u, d, desired, caster) {
  let dir = u.aiDir || 0;
  if (dir === 1 && d <= desired + 0.2) dir = 0;
  else if (dir === -1 && d >= desired) dir = 0;
  if (!dir) {
    if (d > desired + 1.2) dir = 1;
    else if (caster && d < desired - 2.5) dir = -1;
  }
  u.aiDir = dir;
  return dir;
}
