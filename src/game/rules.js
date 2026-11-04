'use strict';
// Règles continues : errance du mouton, auto-attaque, choix des cibles.
// Mouton : erre lentement dans un cercle de 2 m de diamètre autour du point de métamorphose, sans rien pouvoir faire.
function updatePolyWander(u, dt) {
  if (!u?.alive || !(u.poly > 0)) return;
  if (u.polyKind === 'sap') {
    endCast(u, 'interrupt');
    u.mobility = null;
    u.moving = false;
    return;
  }
  endCast(u, 'interrupt');
  u.mobility = null;
  u.wanderT = (u.wanderT || 0) - dt;
  if (u.wanderT <= 0 || u.wanderX == null) {
    const a = Math.random() * Math.PI * 2,
      r = Math.random() * 0.9;
    u.wanderX = u.polyX + Math.sin(a) * r;
    u.wanderZ = u.polyZ + Math.cos(a) * r;
    u.wanderT = 1.1 + Math.random() * 1.6;
    u.wanderPause = Math.random() < 0.35;
  }
  const dx = u.wanderX - u.x,
    dz = u.wanderZ - u.z,
    d = Math.hypot(dx, dz);
  if (u.wanderPause || d < 0.05) {
    u.moving = false;
    return;
  }
  const s = Math.min(d, 1.1 * dt);
  u.x += (dx / d) * s;
  u.z += (dz / d) * s;
  u.yaw = Math.atan2(dx, dz);
  u.moving = true;
  u.movePhase += dt * 9;
  resolveWalls(u);
}
function endPoly(u, broken) {
  const sap = u.polyKind === 'sap';
  u.poly = 0;
  u.polyOwner = null;
  u.wanderX = null;
  u.polyKind = null;
  fx('blinkBurst', u.x, (u.y || 0) + 0.8, u.z, [0.95, 0.85, 1], 0.6, 0.6);
  if (broken) addFloat(u, sap ? 'Sap broken' : 'Polymorph broken', '#d8a7ff');
}
// Auto-attaque : les mêlées frappent avec leur arme dès qu'une cible ennemie est au contact (et devant eux pour le joueur).
// [intervalle (s), dégâts] : le voleur frappe deux fois plus vite avec deux lames, même dégâts par seconde.
const SWING = { sentinel: [2.2, 52], reaver: [2.4, 58], shade: [0.65, 15] };
function autoAttack(u, dt) {
  const sw = u.cls === 'warden' ? FORM_INFO[u.form]?.swing : SWING[u.cls];
  if (!sw || !u.alive || u.stealth) return;
  u.swing = Math.max(0, (u.swing || 0) - dt);
  if (u.swing > 0 || u.stun > 0 || u.fear > 0 || u.poly > 0 || u.cast || u.mobility || u.action > 0) return;
  const t = hostileTarget(u, false);
  // los : pas de coup à travers un mur (rempart d'une salle de départ)
  if (!t || (u.ai && t.poly > 0) || d2(u, t) > 2.5 || !los(u, t)) return;
  if (!u.ai) {
    let rel = Math.atan2(t.x - u.x, t.z - u.z) - u.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) > 1.6) return;
  } else face(u, t);
  damage(u, t, sw[1] * (0.9 + Math.random() * 0.2), Math.random() < 0.12, 'physical');
  action(u, 'melee');
  u.swing = sw[0];
  // cri d'effort sur une partie des coups (le voleur frappe toutes les 0,65 s) ; tirage ici, pas dans SFX.effort,
  // pour que l'ami en ligne entende le même cri que l'hôte
  if (Math.random() < (u.cls === 'shade' ? 0.15 : 0.4)) SFX.effort(u);
  SFX.swing(u, false);
  SFX.meleeHit(u, false);
}
// Cible hostile d'une unité (la cible courante si c'est un ennemi, sinon le dernier ennemi ciblé ou le plus proche).
function setTarget(u, t) {
  u.target = t || null;
  // cibler un allié (ou soi) arrête l'auto-attaque et la garde de combat : plus d'« ennemi en cours »
  if (t) u.lastEnemy = t.team !== u.team ? t : null;
  if (window.NET?.role === 'guest' && u === state?.player) netSend({ t: 'target', i: state.units.indexOf(t) });
}
// Cible amie du joueur pour les soins : l'allié ciblé, sinon soi-même.
function friendlyTarget(u) {
  const t = u.target;
  return t?.alive && t.team === u.team ? t : u;
}
// Cible hostile d'une unité : sa cible si c'est un ennemi vivant, sinon le dernier ennemi visé, sinon le plus proche.
function hostileTarget(u, fallback = true) {
  const t = u.target;
  if (t?.alive && t.team !== u.team) return t;
  if (u.lastEnemy?.alive) return u.lastEnemy;
  return fallback ? nearestEnemy(u) : null;
}
// Sanctuaires de soin de la carte (state.shrines) : PV au maximum, réapparition 45 s.
function updateHealthShrines(dt) {
  if (!state?.shrines) return;
  for (const sh of state.shrines) {
    if (!sh.active) {
      sh.respawn = Math.max(0, sh.respawn - dt);
      if (sh.respawn <= 0) sh.active = true;
    }
  }
  // tout personnage blessé qui passe dessus le prend : joueur, amis en ligne, IA alliées et adversaires
  for (const sh of state.shrines) {
    if (!sh.active) continue;
    const p = state.units.find(u => u.alive && u.hp < u.maxHp && Math.hypot(u.x - sh.x, u.z - sh.z) < 1.45);
    if (!p) continue;
    p.hp = p.maxHp;
    p.shield = 0;
    sh.active = false;
    sh.respawn = 45;
    fx('holyBurst', sh.x, 0.55, sh.z, [0.25, 1, 0.42], 1.25, 1.35);
    addFloat(p, 'FULL HP', '#8dff9d');
    updateUI();
  }
}
