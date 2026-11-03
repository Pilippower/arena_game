'use strict';
// Tests unitaires des règles de jeu : le vrai code (src/) est chargé dans un contexte vm avec des stubs minimaux,
// et l'on vérifie le résultat (position, PV, état), pas le texte du code. Rapide : quelques millisecondes.
const assert = require('node:assert/strict');
const { sandbox } = require('./sources.js');
const GameLogic = require('../game_logic.js');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ---------- Déplacement du joueur (src/game/player.js) ----------
function playerWorld() {
  const S = sandbox({
    GameLogic,
    camera: { yaw: 0, pitch: 0 },
    orbiting: false,
    looking: false,
    MOUSE_BTN: 0,
    PREFS: { cameraReturn: true },
    MOBILE: { enabled: false, moveForward: 0, moveRight: 0, lookPointer: null },
    keyboardTurn() {},
    resolveWalls() {},
    moveSpeed: () => 7
  });
  S.load('src/game/player.js');
  const p = { alive: true, grounded: true, x: 0, z: 0, yaw: 0, movePhase: 0, stun: 0, fear: 0, poly: 0, root: 0 };
  S.ctx.state = { player: p, keys: {} };
  return { ...S, p };
}
{
  const { ctx } = playerWorld();
  // joystick mobile : au-delà de 35 % de déviation, vitesse pleine ; en dessous, vitesse réduite
  assert.ok(near(0.4 * ctx.mobileStickBoost(0.4, 0), 1), 'joystick : vitesse pleine à 40 %');
  assert.ok(0.2 * ctx.mobileStickBoost(0.2, 0) < 1, 'joystick : vitesse réduite à 20 %');
}
{
  // glisser au clic gauche : la trajectoire garde l'orientation d'avant le glisser ; au relâchement la caméra revient
  const { ctx } = playerWorld();
  ctx.orbiting = true;
  ctx.camera.yaw = 1;
  assert.equal(ctx.moveBaseYaw(1 / 120), 1, 'début du glisser : base = caméra');
  ctx.camera.yaw = 2;
  assert.equal(ctx.moveBaseYaw(1 / 120), 1, 'pendant le glisser : base figée');
  ctx.orbiting = false;
  for (let i = 0; i < 600; i++) ctx.moveBaseYaw(1 / 120);
  assert.ok(near(ctx.camera.yaw, 1, 0.02), 'relâchement : la caméra revient derrière le personnage');
  assert.equal(ctx.orbitBase, null, 'caméra revenue : plus de base figée');
}
{
  // réglage « Camera returns behind you » désactivé : la caméra reste, le personnage garde sa direction
  const { ctx } = playerWorld();
  ctx.PREFS.cameraReturn = false;
  ctx.orbiting = true;
  ctx.camera.yaw = 1;
  ctx.moveBaseYaw(1 / 120);
  ctx.camera.yaw = 2;
  ctx.orbiting = false;
  for (let i = 0; i < 120; i++) assert.equal(ctx.moveBaseYaw(1 / 120), 1, 'retour désactivé : direction gardée');
  assert.equal(ctx.camera.yaw, 2, 'retour désactivé : la caméra reste où on l’a laissée');
  ctx.looking = true;
  assert.equal(ctx.moveBaseYaw(1 / 120), 2, 'glisser au clic droit : réaligne personnage et caméra');
}
{
  // en l'air : la trajectoire du décollage est gardée, les touches ne la changent plus
  const { ctx, p } = playerWorld();
  p.grounded = false;
  p.lastVel = { x: 3, z: 0 };
  ctx.state.keys = { z: true };
  ctx.playerMove(0.5);
  assert.ok(near(p.x, 1.5) && near(p.z, 0), 'saut : trajectoire figée');
}
{
  // clic gauche + droit enfoncés = avancer (vers la caméra), au sol
  const { ctx, p } = playerWorld();
  ctx.MOUSE_BTN = 3;
  ctx.playerMove(0.1);
  const fw = GameLogic.forward(0);
  assert.ok(p.moving && p.x * fw.x + p.z * fw.z > 0.6, 'gauche + droit : avance');
}

// ---------- IA de mêlée : suit la cible qui recule (src/game/ai.js) ----------
{
  const S = sandbox();
  S.fn('src/game/ai.js', 'aiMoveDir');
  const melee = { aiDir: 0 };
  assert.equal(S.ctx.aiMoveDir(melee, 2.5, 2, false), 1, 'mêlée : repart dès que la cible sort de l’allonge');
  const caster = { aiDir: 0 };
  assert.equal(S.ctx.aiMoveDir(caster, 20.5, 20, true), 0, 'lanceur : reste en place près de sa portée');
  assert.equal(S.ctx.aiMoveDir(caster, 17, 20, true), -1, 'lanceur : recule (kite) si trop près');
}

// ---------- Cibles et sanctuaires (src/game/rules.js) ----------
{
  const S = sandbox({ nearestEnemy: () => 'nearest' });
  S.fn('src/game/rules.js', 'hostileTarget');
  const foe = { alive: true, team: 2 },
    friend = { alive: true, team: 1 };
  assert.equal(S.ctx.hostileTarget({ team: 1, target: foe }), foe, 'cible ennemie gardée');
  assert.equal(S.ctx.hostileTarget({ team: 1, target: friend, lastEnemy: foe }), foe, 'cible alliée : dernier ennemi');
  assert.equal(S.ctx.hostileTarget({ team: 1, target: friend }), 'nearest', 'sinon : ennemi le plus proche');
  assert.equal(S.ctx.hostileTarget({ team: 1, target: friend }, false), null, 'sans repli : aucune');
}
{
  const S = sandbox({ fx() {}, addFloat() {}, updateUI() {} });
  S.fn('src/game/rules.js', 'updateHealthShrines');
  const shrine = { x: 0, z: 0, active: true, respawn: 0 },
    enemyAi = { alive: true, team: 2, hp: 100, maxHp: 400, shield: 50, x: 0.5, z: 0 };
  S.ctx.state = { shrines: [shrine], units: [{ alive: true, hp: 400, maxHp: 400, x: 0, z: 0 }, enemyAi] };
  S.ctx.updateHealthShrines(1 / 120);
  assert.equal(enemyAi.hp, 400, 'sanctuaire : tout personnage blessé (adversaire compris) remonte au maximum');
  assert.ok(!shrine.active && shrine.respawn === 45, 'sanctuaire : réapparition 45 s');
  S.ctx.updateHealthShrines(45);
  assert.ok(shrine.active, 'sanctuaire : de retour après 45 s');
}

// ---------- Fear = fuite réelle (src/game/combat.js) ----------
{
  const S = sandbox({ CLASS: { sentinel: { speed: 7 } }, resolveWalls() {} });
  S.fn('src/game/combat.js', 'updateFearMovement');
  S.ctx.state = { elapsed: 0 };
  const u = { alive: true, cls: 'sentinel', fear: 3, x: 1, z: 0, fearSourceX: 0, fearSourceZ: 0, movePhase: 0 };
  for (let i = 0; i < 120; i++) S.ctx.updateFearMovement(u, 1 / 120);
  assert.ok(Math.hypot(u.x, u.z) > 6, 'fear : l’unité s’éloigne de la source');
  const rooted = { ...u, x: 1, z: 0, root: 2 };
  S.ctx.updateFearMovement(rooted, 1);
  assert.equal(rooted.x, 1, 'fear sous racines : immobile');
}
console.log('OK - règles de jeu (tests unitaires : déplacement, IA, cibles, sanctuaires, fear)');
