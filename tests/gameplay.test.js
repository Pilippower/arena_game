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

// ---------- Ciblage au clic façon MMO (src/ui/cursor.js) ----------
{
  const { read } = require('./sources.js');
  const src = read('src/ui/cursor.js'),
    num = n => +src.match(new RegExp(`const ${n} = ([\\d.]+)`))[1];
  const S = sandbox({ BODY_HALF_WIDTH: num('BODY_HALF_WIDTH'), BODY_MIN_HALF_WIDTH: num('BODY_MIN_HALF_WIDTH') });
  S.fn('src/ui/cursor.js', 'pickUnitAt');
  // personnage debout : pieds en (400, 500), tête en (400, 300), torse en (400, 365) ; barre de nom au-dessus
  const at = (u, x, z = 10, plate = null) => ({
    u,
    plate,
    feet: { x, y: 500, z },
    head: { x, y: 300, z },
    chest: { x, y: 365, z }
  });
  const A = { n: 'A' },
    B = { n: 'B' };
  const pick = (sx, sy, items) => S.ctx.pickUnitAt(sx, sy, items, 62);
  assert.equal(pick(400, 490, [at(A, 400)]), A, 'clic sur les pieds : cible');
  assert.equal(pick(400, 305, [at(A, 400)]), A, 'clic sur la tête : cible');
  assert.equal(pick(430, 420, [at(A, 400)]), A, 'clic sur le flanc : cible');
  assert.equal(pick(520, 420, [at(A, 400)]), null, 'clic à côté : rien');
  const plate = { l: 350, t: 250, r: 450, b: 280 };
  assert.equal(pick(445, 255, [at(A, 400, 10, plate)]), A, 'clic sur la barre de vie flottante : cible');
  // la barre de nom passe avant la silhouette d'un autre personnage devant
  assert.equal(pick(400, 265, [at(B, 400, 5), at(A, 400, 10, plate)]), A, 'barre de nom prioritaire');
  // deux silhouettes superposées : la plus proche de la caméra
  assert.equal(pick(400, 400, [at(A, 400, 10), at(B, 405, 4)]), B, 'silhouettes superposées : la plus proche');
  // clic approximatif près du torse : ancienne règle (62 px) gardée
  assert.equal(pick(400 + 55, 340, [{ ...at(A, 400), head: { x: 400, y: 360, z: 10 } }]), A, 'près du torse : cible');
}

// ---------- Contrôle affiché sur les portraits (src/ui/hud.js) ----------
{
  const { read } = require('./sources.js');
  const order = read('src/ui/hud.js').match(/const CC_ORDER = (\[[^\]]*\]);/)[1];
  const S = sandbox();
  require('node:vm').runInContext(`var CC_ORDER = ${order};`, S.ctx);
  S.fn('src/ui/hud.js', 'activeCC');
  const u = { alive: true, stun: 0, poly: 0, fear: 0, silence: 0, root: 0 };
  assert.equal(S.ctx.activeCC(u), null, 'sans contrôle : rien');
  Object.assign(u, {
    root: 4,
    fear: 2.5,
    ccTotal: { fear: 6, root: 6 },
    debuffSpell: { fear: 'Fear', root: 'Frost Nova' }
  });
  const c = S.ctx.activeCC(u);
  assert.ok(
    c.kind === 'fear' && c.spell === 'Fear' && c.left === 2.5 && c.total === 6,
    'peur avant racines, sort et durées'
  );
  u.stun = 1;
  assert.equal(S.ctx.activeCC(u).kind, 'stun', 'étourdi : prioritaire');
  assert.equal(S.ctx.activeCC({ ...u, alive: false }), null, 'mort : rien');
}
// ---------- Arme à deux mains du DK : orientation exacte avec des os étirés (src/render/hero_anim.js) ----------
{
  const THREE = require('three');
  const S = sandbox({ THREE });
  S.fn('src/render/hero_anim.js', 'hfTurnLocal');
  // bras du nain : échelle non uniforme [1,28 ; 0,88 ; 1,28], avant-bras tourné, main, lame vers +y de la main
  const arm = new THREE.Bone(),
    fore = new THREE.Bone(),
    hand = new THREE.Bone(),
    blade = new THREE.Object3D();
  arm.scale.set(1.281, 0.882, 1.281);
  arm.rotation.set(0.4, 0.3, -0.7);
  fore.position.set(0, 0.3, 0);
  fore.rotation.set(-0.9, 0.2, 0.5);
  hand.position.set(0, 0.25, 0);
  hand.scale.set(0.98, 1.38, 0.98);
  arm.add(fore);
  fore.add(hand);
  hand.add(blade);
  arm.updateMatrixWorld(true);
  const dir = () => new THREE.Vector3(0, 1, 0).transformDirection(blade.matrixWorld);
  const want = new THREE.Vector3(-0.25, 0.05, 0.97).normalize();
  S.ctx.hfTurnLocal(hand, dir(), want);
  assert.ok(dir().angleTo(want) < 1e-6, 'lame orientée exactement malgré les os étirés');
  // une 2e fois sur une pose déjà juste : plus rien ne bouge (pas d'oscillation d'une image à l'autre)
  const q = hand.quaternion.clone();
  S.ctx.hfTurnLocal(hand, dir(), want);
  assert.ok(hand.quaternion.angleTo(q) < 1e-6, 'pose stable d’une image à l’autre');
}
// ---------- Glaives du voleur : décharges électriques « de temps en temps » (src/characters/glow.js) ----------
{
  const THREE = require('three');
  const ctx2d = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  const S = sandbox({
    THREE,
    performance: { now: () => S.ctx.clockMs },
    document: { createElement: () => ({ getContext: () => ctx2d }) }
  });
  S.ctx.clockMs = 0;
  S.ctx.globalThis = S.ctx;
  S.load('src/characters/rig.js');
  S.load('src/characters/glow.js');
  const w = new THREE.Group();
  S.ctx.CharacterParts.electricArcs(
    THREE,
    w,
    [
      [0, 0, 0],
      [0, 0.5, 0],
      [0, 0.6, -0.1]
    ],
    new THREE.Color(0.4, 0.7, 1),
    0.06,
    0.07
  );
  const clock = w.children.find(o => o.onBeforeRender && o.material.opacity === 0),
    beads = w.children.filter(o => o.renderOrder === 3),
    lit = () => beads.some(b => b.visible);
  // 20 s simulées à 60 images/s : on note les instants de début de chaque décharge et leur durée
  const starts = [];
  let litFor = 0,
    was = false;
  for (let f = 0; f < 1200; f++) {
    S.ctx.clockMs = (f * 1000) / 60;
    clock.onBeforeRender();
    const on = lit();
    if (on && !was) starts.push(S.ctx.clockMs / 1000);
    if (on) litFor += 1 / 60;
    was = on;
  }
  assert.ok(starts.length >= 3 && starts.length <= 9, `décharges de temps en temps (${starts.length} en 20 s)`);
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  assert.ok(
    gaps.every(g => g >= 2.5 && g <= 6.5),
    'pause de 2,5 à 6 s entre deux décharges'
  );
  assert.ok(litFor / starts.length < 0.45, 'décharge brève (~0,35 s)');
}
console.log(
  'OK - règles de jeu (tests unitaires : déplacement, IA, cibles, sanctuaires, fear, ciblage au clic, contrôles, IK, glaives)'
);
