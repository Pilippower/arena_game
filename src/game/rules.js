'use strict';
// Règles continues : errance du mouton, auto-attaque, choix des cibles.
// Mouton : erre lentement dans un cercle de 2 m de diamètre autour du point de métamorphose, sans rien pouvoir faire.
function updatePolyWander(u, dt) {
  if (!u?.alive || !(u.poly > 0)) return;
  if (u.polyKind === 'sap') {
    u.cast = null;
    u.mobility = null;
    u.moving = false;
    return;
  }
  u.cast = null;
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
  if (broken) addFloat(u, sap ? 'Assommer brisé' : 'Métamorphose brisée', '#d8a7ff');
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
  if (!t || (u.ai && t.poly > 0) || d2(u, t) > 2.5) return;
  if (!u.ai) {
    let rel = Math.atan2(t.x - u.x, t.z - u.z) - u.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    if (Math.abs(rel) > 1.6) return;
  } else face(u, t);
  damage(u, t, sw[1] * (0.9 + Math.random() * 0.2), Math.random() < 0.12, 'physical');
  action(u, 'melee');
  u.swing = sw[0];
  SFX.swing(u, false);
  SFX.meleeHit(u, false);
}
// Cible hostile d'une unité (la cible courante si c'est un ennemi, sinon le dernier ennemi ciblé ou le plus proche).
function setTarget(u, t) {
  u.target = t || null;
  if (t && t.team !== u.team) u.lastEnemy = t;
}
// Cible amie du joueur pour les soins : l'allié ciblé, sinon soi-même.
function friendlyTarget(u) {
  const t = u.target;
  return t?.alive && t.team === u.team ? t : u;
}
