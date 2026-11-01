'use strict';
// IA stratégique et profils de difficulté.
// ---------- IA stratégique ----------
// Profils de difficulté. react = délai avant d'interrompre une incantation ; think = intervalle de décision ;
// kick/cc/defensive/burst = probabilité d'utiliser ces outils quand la situation s'y prête ; dmg/heal = puissance.
const AI_PROFILES = {
  easy: {
    react: 1.0,
    think: 0.75,
    kick: 0.12,
    cc: 0.2,
    defensive: 0.35,
    burst: 0.3,
    focus: 0.25,
    peel: 0.2,
    trinket: 0.3,
    idle: 0.18,
    dmg: 0.75,
    heal: 0.8
  },
  medium: {
    react: 0.55,
    think: 0.4,
    kick: 0.5,
    cc: 0.55,
    defensive: 0.75,
    burst: 0.7,
    focus: 0.7,
    peel: 0.6,
    trinket: 0.7,
    idle: 0.05,
    dmg: 1,
    heal: 1
  },
  hard: {
    react: 0.28,
    think: 0.2,
    kick: 0.9,
    cc: 0.9,
    defensive: 0.95,
    burst: 0.95,
    focus: 1,
    peel: 0.9,
    trinket: 0.95,
    idle: 0,
    dmg: 1.04,
    heal: 1.04
  }
};
// Rôle de chaque sort dans la stratégie.
const AI_ROLE = {
  sentinel: { melee: 1, dmg: 0, slow: 1, kick: 2, def: 3, gap: 4 },
  arcanist: { dmg: 0, peel: 1, kick: 2, burst: 3, escape: 4, cc: 5, ccHealer: 1 },
  oracle: { healer: 1, heal: 0, shield: 1, kick: 2, mass: 3, escape: 4 },
  reaver: { melee: 1, dmg: 0, grip: 1, stun: 2, kickStun: 1, burst: 3, gap: 4 },
  warden: {},
  warden_cat: { melee: 1, dmg: 0, slow: 1, stun: 2, kickStun: 2, gap: 3 },
  warden_bear: { melee: 1, dmg: 0, aoe: 1, def: 2, gap: 3 },
  shade_stealth: { melee: 1 },
  shade: { melee: 1, dmg: 0, def: 1, stun: 2, kickStun: 1, burst: 3, gap: 4 },
  warlock: { dmg: 0, cc: 1, ccHealer: 1, kick: 2, burst: 3, escape: 4 }
};
let DIFFICULTY = (() => {
  try {
    return localStorage.getItem('arenaDifficulty') || 'medium';
  } catch (_) {
    return 'medium';
  }
})();
// Ennemis au niveau choisi ; alliés toujours compétents (très bons en Easy pour porter le joueur).
function applyDifficulty() {
  const d = AI_PROFILES[DIFFICULTY] ? DIFFICULTY : 'medium',
    ally = d === 'easy' ? 'hard' : 'medium';
  state.difficulty = d;
  for (const u of state.units) {
    const enemy = u.team !== state.player.team,
      P = AI_PROFILES[enemy ? d : ally];
    u.aiP = P;
    u.aiDmg = enemy ? P.dmg : 1;
    u.aiHeal = enemy ? P.heal : 1;
    u.aiNext = Math.random() * P.think;
  }
}
const aiCanUse = (u, i) =>
  i != null && i >= 0 && skillsOf(u)[i] && u.cd[i] <= 0 && u.gcd <= 0 && canPay(u, i) && !u.cast;
function aiCastOn(u, i, t) {
  if (!aiCanUse(u, i)) return false;
  const keep = u.target;
  u.target = t;
  const ok = useSkill(u, i);
  if (!ok) u.target = keep;
  return ok;
}
const isHealer = u => u.cls === 'oracle';
const hpPct = u => (u.hp + (u.shield || 0) * 0.5) / u.maxHp;
const ccd = u => u.stun > 0 || u.fear > 0 || u.poly > 0;
// Cible de l'équipe : les IA d'une même équipe se concentrent sur la même cible (recalculée régulièrement).
function teamFocus(u) {
  state.aiFocus = state.aiFocus || {};
  const f = state.aiFocus[u.team],
    P = u.aiP || AI_PROFILES.medium;
  if (f && f.t?.alive && !(f.t.poly > 0) && !f.t.stealth && now() < f.until) return f.t;
  const foes = enemies(u).filter(e => !(e.poly > 0) && !e.stealth);
  if (!foes.length) return null;
  let best = null,
    bs = 1e9;
  for (const e of foes) {
    const s =
      hpPct(e) -
      (isHealer(e) && foes.length === 1 ? 0.3 : 0) +
      (isHealer(e) ? 0.12 : 0) +
      d2(u, e) * 0.012 +
      (los(u, e) ? 0 : 0.25) +
      Math.random() * (1 - P.focus) * 0.6;
    if (s < bs) {
      bs = s;
      best = e;
    }
  }
  state.aiFocus[u.team] = { t: best, until: now() + 2.5 + Math.random() * 2 };
  return best;
}
// Interruption : une incantation ennemie à portée, après le temps de réaction du profil.
function aiTryKick(u, P, R) {
  const kicks = [R.kick, R.kickStun].filter(i => i != null && aiCanUse(u, i));
  if (!kicks.length) return false;
  for (const e of enemies(u)) {
    const c = e.cast;
    if (!c || e.stealth) continue;
    const el = c.dur - (c.end - now());
    c.react = c.react || {};
    if (c.react[u.id] == null) c.react[u.id] = Math.random() < P.kick ? P.react * (0.75 + Math.random() * 0.5) : 99;
    if (el < c.react[u.id] || c.end - now() < 0.08) continue;
    const important = c.type === 'heal' || c.type === 'poly' || c.type === 'fear' || e.hp < e.maxHp * 2;
    for (const i of kicks) {
      const S = skillsOf(u)[i],
        d = d2(u, e);
      if (d > (S.t === 'melee' ? 2.45 : 15) || !los(u, e) || !important) continue;
      if (aiCastOn(u, i, e)) return true;
    }
  }
  return false;
}
function ai(u, dt) {
  if (!u.alive) {
    u.moving = false;
    return;
  }
  if (u.mobility) {
    u.moving = true;
    return;
  }
  const P = u.aiP || AI_PROFILES.medium,
    R = AI_ROLE[u.cls + (barKey(u) ? '_' + barKey(u) : '')] || AI_ROLE[u.cls] || {};
  // bijou : se libérer d'un contrôle long quand c'est utile
  if (
    u.trinket <= 0 &&
    (u.stun > 0.9 || u.fear > 1.3 || u.poly > 1.6 || (u.root > 1.4 && R.melee) || u.silence > 1.8) &&
    Math.random() < P.trinket * dt * 4 &&
    (hpPct(u) < 0.7 || Math.random() < 0.5)
  )
    useTrinket(u);
  if (u.poly > 0) return;
  if (u.stun > 0 || u.fear > 0 || u.cast) {
    u.moving = false;
    return;
  }
  const foes = enemies(u).filter(e => !e.stealth),
    friends = allies(u);
  if (!foes.length) {
    u.moving = false;
    return;
  }
  if (Math.random() > P.idle * 0.5 && aiSpecial(u, P)) return;
  // 1. interrompre (réaction rapide, vérifiée à chaque pas)
  if (aiTryKick(u, P, R)) return;
  // 2. décisions « réfléchies » à intervalle du profil
  u.aiNext = (u.aiNext || 0) - dt;
  const think = u.aiNext <= 0;
  if (think) u.aiNext = P.think * (0.7 + Math.random() * 0.6);
  const healer = isHealer(u);
  let t = healer ? foes.filter(e => !(e.poly > 0)).sort((a, b) => d2(a, u) - d2(b, u))[0] : teamFocus(u);
  if (!t) {
    u.moving = false;
    return;
  }
  u.target = t;
  const d = d2(u, t),
    caster = !R.melee,
    meleeOnMe = foes.filter(e => AI_ROLE[e.cls]?.melee && d2(e, u) < 3.2 && !ccd(e));
  if (think && Math.random() > P.idle) {
    // défensif quand on est en danger
    if (R.def != null && hpPct(u) < 0.45 && Math.random() < P.defensive && aiCanUse(u, R.def) && useSkill(u, R.def))
      return;
    if (R.escape != null && meleeOnMe.length && hpPct(u) < 0.6 && Math.random() < P.peel && aiCanUse(u, R.escape)) {
      u.yaw = Math.atan2(u.x - meleeOnMe[0].x, u.z - meleeOnMe[0].z);
      if (useSkill(u, R.escape)) return;
    }
    if (R.peel != null && meleeOnMe.length && Math.random() < P.peel && aiCanUse(u, R.peel) && useSkill(u, R.peel))
      return;
    // soigneur
    if (healer) {
      const low = friends.slice().sort((a, b) => hpPct(a) - hpPct(b))[0],
        hurt = friends.filter(a => hpPct(a) < 0.55).length;
      if (R.mass != null && hurt >= 2 && aiCanUse(u, R.mass) && useSkill(u, R.mass)) return;
      if (low && hpPct(low) < 0.9 && !(low.shield > 0) && aiCanUse(u, R.shield) && los(u, low) && useSkill(u, R.shield))
        return;
      if (
        low &&
        hpPct(low) < 0.82 &&
        los(u, low) &&
        d2(u, low) < 15 &&
        !meleeOnMe.length &&
        aiCanUse(u, R.heal) &&
        useSkill(u, R.heal)
      )
        return;
      if (low && hpPct(low) < 0.6 && los(u, low) && aiCanUse(u, R.heal) && useSkill(u, R.heal)) return;
    }
    // contrôle : le soigneur adverse pendant qu'on presse la cible, ou une menace sur nous
    if (Math.random() < P.cc) {
      const theirHealer = foes.find(e => isHealer(e) && !ccd(e) && e !== t && (e.dr.poly ?? 1) > 0);
      const pressure = hpPct(t) < 0.7;
      if (
        R.cc != null &&
        theirHealer &&
        pressure &&
        d2(u, theirHealer) < 15 &&
        los(u, theirHealer) &&
        !(theirHealer.dr[u.cls === 'warlock' ? 'fear' : 'poly'] === 0) &&
        aiCanUse(u, R.cc) &&
        aiCastOn(u, R.cc, theirHealer)
      )
        return;
      if (
        R.stun != null &&
        pressure &&
        !ccd(t) &&
        (t.dr.stun ?? 1) > 0 &&
        aiCanUse(u, R.stun) &&
        d < (skillsOf(u)[R.stun].t === 'melee' ? 2.45 : 15) &&
        useSkill(u, R.stun)
      )
        return;
      if (R.root != null && meleeOnMe.length === 0) {
        const threat = foes.find(
          e => AI_ROLE[e.cls]?.melee && friends.some(a => a !== u && d2(e, a) < 3) && (e.dr.root ?? 1) > 0
        );
        if (threat && d2(u, threat) < 15 && aiCastOn(u, R.root, threat)) return;
      }
      if (R.grip != null && (isHealer(t) || d > 6) && d < 15 && aiCanUse(u, R.grip) && useSkill(u, R.grip)) return;
    }
    // gros dégâts quand la cible faiblit
    if (R.burst != null && hpPct(t) < 0.7 && Math.random() < P.burst && aiCanUse(u, R.burst) && useSkill(u, R.burst))
      return;
    if (R.slow != null && !(t.slow > 0) && d < 2.45 && aiCanUse(u, R.slow) && useSkill(u, R.slow)) return;
    if (
      R.aoe != null &&
      foes.filter(e => d2(u, e) < 5.3 && !(e.poly > 0)).length >= 1 &&
      aiCanUse(u, R.aoe) &&
      useSkill(u, R.aoe)
    )
      return;
    if (R.gap != null && R.melee && d > 6 && d < 15 && aiCanUse(u, R.gap) && useSkill(u, R.gap)) return;
    if (R.dmg != null && !healer && aiCanUse(u, R.dmg) && !(t.poly > 0) && useSkill(u, R.dmg)) return;
    if (healer && R.kick != null && hpPct(t) < 0.5 && !ccd(t) && aiCastOn(u, R.kick, t)) return;
  }
  // 3. déplacement : mêlées au contact ; lanceurs à distance, en ligne de vue, en reculant face aux mêlées
  let desired = caster ? (healer ? 10 : 11) : 1.9,
    goal = t;
  if (healer) {
    const low = friends.slice().sort((a, b) => hpPct(a) - hpPct(b))[0];
    if (low && low !== u && (d2(u, low) > 13 || !los(u, low))) {
      goal = low;
      desired = 6;
    }
  }
  if (caster && !los(u, goal)) desired = Math.min(desired, Math.max(2, d2(u, goal) - 3));
  const gd = d2(u, goal),
    ang = Math.atan2(goal.x - u.x, goal.z - u.z);
  let dir = aiMoveDir(u, gd, desired, caster);
  if (caster && meleeOnMe.length && !u.root) {
    dir = -1;
    u.aiDir = -1;
  }
  u.moving = !!dir && u.root <= 0;
  if (u.moving) {
    const sp = moveSpeed(u) * (dir < 0 ? 0.7 : 1);
    let a = ang;
    if (dir < 0 && meleeOnMe.length) a = Math.atan2(meleeOnMe[0].x - u.x, meleeOnMe[0].z - u.z);
    u.x += Math.sin(a) * sp * dt * dir;
    u.z += Math.cos(a) * sp * dt * dir;
    u.yaw = a;
    u.movePhase += dt * 8.5;
    resolveWalls(u);
  } else if (!u.cast) u.yaw = Math.atan2(t.x - u.x, t.z - u.z);
}
function playerMove(dt) {
  const p = state.player;
  if (p.poly > 0) return;
  if (!p.alive || p.stun > 0 || p.fear > 0) {
    p.moving = false;
    return;
  }
  if (p.mobility) {
    p.moving = true;
    return;
  }
  let mv = GameLogic.moveVector(state.keys, camera.yaw);
  if ((MOUSE_BTN & 3) === 3) mv = GameLogic.moveVector({ ...state.keys, z: true }, camera.yaw); // clic gauche + droit = avancer
  let dx = mv.x,
    dz = mv.z;
  if (MOBILE.enabled && (Math.abs(MOBILE.moveForward) > 0.04 || Math.abs(MOBILE.moveRight) > 0.04)) {
    const fw = GameLogic.forward(camera.yaw),
      rt = GameLogic.screenRight(camera.yaw),
      f = MOBILE.moveForward,
      r = MOBILE.moveRight;
    dx = fw.x * f + rt.x * r;
    dz = fw.z * f + rt.z * r;
  }
  if (p.root > 0) {
    dx = dz = 0;
  }
  p.moving = !!(dx || dz);
  if (!p.moving) return;
  if (p.cast) p.cast = null;
  const fw = GameLogic.forward(camera.yaw),
    back = (dx * fw.x + dz * fw.z) / (Math.hypot(dx, dz) || 1) < -0.5; // recul : on garde le regard vers l'avant
  const sp = moveSpeed(p) * (back ? 0.62 : 1);
  p.x += dx * sp * dt;
  p.z += dz * sp * dt;
  p.yaw = looking || MOBILE.lookPointer !== null || back ? camera.yaw : Math.atan2(dx, dz);
  p.movePhase += dt * 9.2;
  resolveWalls(p);
}
