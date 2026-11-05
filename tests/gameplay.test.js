'use strict';
// Tests unitaires des règles de jeu : le vrai code (src/) est chargé dans un contexte vm avec des stubs minimaux,
// et l'on vérifie le résultat (position, PV, état), pas le texte du code. Rapide : quelques millisecondes.
const assert = require('node:assert/strict');
const { sandbox } = require('./sources.js');
const GameLogic = require('../game_logic.js');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ---------- Déplacement du joueur (src/game/player.js) ----------
function playerWorld() {
  const ended = []; // incantations arrêtées (endCast, combat.js) et leur raison
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
    moveSpeed: () => 7,
    endCast: (u, reason) => (ended.push(reason), (u.cast = null))
  });
  S.load('src/game/player.js');
  const p = { alive: true, grounded: true, x: 0, z: 0, yaw: 0, movePhase: 0, stun: 0, fear: 0, poly: 0, root: 0 };
  S.ctx.state = { player: p, keys: {} };
  return { ...S, p, ended };
}
{
  // Shadowstep : la caméra se replace derrière le joueur, tourné vers sa cible ; un glisser en cours suit ; rien
  // pour une autre unité
  const { ctx, p } = playerWorld();
  p.yaw = 2.5;
  ctx.viewBehind(p);
  assert.equal(ctx.camera.yaw, 2.5, 'caméra derrière le joueur');
  ctx.viewBehind({ yaw: -1 });
  assert.equal(ctx.camera.yaw, 2.5, 'autre unité : caméra inchangée');
  ctx.orbiting = true;
  ctx.playerMove(1 / 120); // glisser au clic gauche : base de trajectoire figée sur 2,5
  p.yaw = 1;
  ctx.viewBehind(p);
  ctx.state.keys = { z: true };
  const x0 = p.x,
    z0 = p.z,
    want = GameLogic.moveVector({ z: true }, 1);
  ctx.playerMove(0.1);
  const len = Math.hypot(want.x, want.z),
    dl = Math.hypot(p.x - x0, p.z - z0);
  assert.ok(
    near((p.x - x0) / dl, want.x / len, 1e-6) && near((p.z - z0) / dl, want.z / len, 1e-6),
    'glisser en cours : Z avance vers la cible, pas dans l’ancienne direction'
  );
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
{
  // bouger pendant une incantation l'annule (son d'échec : raison « cancel ») ; immobile, elle continue
  const { ctx, p, ended } = playerWorld();
  p.cast = { name: 'Frost Bolt' };
  ctx.playerMove(0.1);
  assert.ok(p.cast && !ended.length, 'immobile : incantation gardée');
  ctx.state.keys = { KeyW: true, w: true, z: true };
  ctx.MOUSE_BTN = 3;
  ctx.playerMove(0.1);
  assert.deepEqual(ended, ['cancel'], 'bouger : incantation annulée');
  assert.equal(p.cast, null, 'bouger : plus d’incantation');
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
  for (const f of ['bodyHalfWidth', 'plateBox', 'pickUnitAt']) S.fn('src/ui/cursor.js', f);
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
  // boîte invisible de la barre de nom (incluse) jusqu'au sol, aussi large que la barre ou la silhouette
  assert.equal(pick(400, 290, [at(A, 400, 10, plate)]), A, 'entre la barre et la tête : cible');
  assert.equal(pick(447, 470, [at(A, 400, 10, plate)]), A, 'sous le bord de la barre, à côté des jambes : cible');
  assert.equal(pick(447, 470, [at(A, 400)]), null, 'sans barre affichée : pas de boîte');
  assert.equal(pick(455, 420, [at(A, 400, 10, plate)]), null, 'à côté de la boîte : rien');
  assert.equal(pick(447, 503, [at(A, 400, 10, plate)]), null, 'sous le sol de la boîte : rien');
  const wide = { l: 300, t: 250, r: 500, b: 280 };
  assert.equal(pick(495, 480, [at(A, 400, 10, wide)]), A, 'barre plus large que la silhouette : largeur de la barre');
  const narrow = { l: 395, t: 250, r: 405, b: 280 };
  for (const x of [358, 442])
    assert.equal(pick(x, 262, [at(A, 400, 10, narrow)]), A, 'barre plus étroite : largeur de la silhouette');
  // deux boîtes superposées : la plus proche de la caméra
  const plateB = { l: 380, t: 240, r: 480, b: 270 };
  assert.equal(
    pick(420, 285, [at(A, 400, 10, plate), at(B, 430, 4, plateB)]),
    B,
    'boîtes superposées : la plus proche'
  );
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
// ---------- Frappes propres à chaque race (src/render/hero_anim.js) ----------
{
  const THREE = require('three');
  const S = sandbox({ THREE, clamp: (v, a, b) => Math.max(a, Math.min(b, v)) });
  S.load('src/render/hero_anim.js');
  const { RACE_STRIKE, strikePose, hfFromAnimPose, hfKeepOutput } = S.ctx;
  for (const r of ['human', 'orc', 'dwarf', 'elf', 'undead']) assert.ok(RACE_STRIKE[r], 'style de frappe : ' + r);
  // chaque frappe part de la pose du clip et y revient, sans à-coup d'une image à l'autre (60 images/s)
  for (const [r, P] of Object.entries(RACE_STRIKE)) {
    const steps = Math.round((0.62 / P.speed) * 60),
      poses = Array.from({ length: steps + 1 }, (_, i) => strikePose(i / steps, P));
    for (const k of ['twist', 'lean', 'tilt']) {
      assert.ok(Math.abs(poses[0][k]) < 1e-9 && Math.abs(poses[steps][k]) < 1e-9, `${r} : ${k} part de 0 et y revient`);
      // à-coup = changement brusque de vitesse (dérivée seconde), rapporté à l'amplitude du mouvement : une marche
      // d'escalier donne 100 %, les courbes actuelles 13 % au plus ; seuil 25 %
      const vals = poses.map(p => p[k]),
        amp = Math.max(...vals) - Math.min(...vals);
      if (!amp) continue;
      const jerk = Math.max(...vals.slice(2).map((v, i) => Math.abs(v - 2 * vals[i + 1] + vals[i])));
      assert.ok(jerk / amp < 0.25, `${r} : ${k} sans à-coup (${Math.round((100 * jerk) / amp)} % de l'amplitude)`);
    }
  }
  // des styles vraiment différents : elfe souple et ample, nain ramassé qui se jette en avant, mort-vivant raide
  const peak = (P, k) => Math.max(...Array.from({ length: 101 }, (_, i) => Math.abs(strikePose(i / 100, P)[k])));
  const E = RACE_STRIKE.elf,
    D = RACE_STRIKE.dwarf;
  assert.ok(peak(E, 'twist') > 2 * peak(D, 'twist'), 'elfe : buste plus souple que le nain');
  assert.ok(peak(D, 'lean') > 2 * peak(E, 'lean'), 'nain : se jette davantage en avant');
  assert.ok(E.speed > RACE_STRIKE.human.speed && D.speed < RACE_STRIKE.human.speed, 'elfe plus vif, nain plus lent');
  assert.ok(peak(RACE_STRIKE.undead, 'tilt') > 0, 'mort-vivant : tête qui bascule');
  // la surcouche repart de la pose du clip à chaque image (pas d'accumulation si le clip n'a pas réécrit l'os)
  const bone = new THREE.Bone(),
    store = {};
  bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2); // pose du clip
  hfFromAnimPose(store, [bone]);
  bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3)); // surcouche
  hfKeepOutput(store, [bone]);
  hfFromAnimPose(store, [bone]); // image suivante, le clip n'a pas réécrit l'os
  assert.ok(
    bone.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2)) < 1e-6,
    'pose du clip restaurée'
  );
  bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5); // le clip avance
  hfFromAnimPose(store, [bone]);
  assert.ok(store.anim[0].angleTo(bone.quaternion) < 1e-6, 'nouvelle pose du clip mémorisée');
}
// ---------- Lobby : feu des torches posé dans les vasques à toute taille de fenêtre (src/ui/lobby.js) ----------
{
  const { read } = require('./sources.js');
  const wall = read('src/ui/lobby.js').match(/const LOBBY_WALL = (\{[^;]*\});/)[1];
  const S = sandbox();
  require('node:vm').runInContext(`var LOBBY_WALL = ${wall};`, S.ctx);
  S.fn('src/ui/lobby.js', 'lobbyTorchSpot');
  const L = { side: 'l', x: 137, y: 380 },
    Rt = { side: 'r', x: 192, y: 380 };
  // plein écran 1920×1080 (lobby 938 px de haut) : murs calés sur la hauteur, comme avant
  const H = 938,
    full = S.ctx.lobbyTorchSpot(L, 1920, H, (H * 330) / 690);
  assert.ok(Math.abs(full.y - (380 * H) / 690) < 1e-6 && Math.abs(full.x - (137 * H) / 690) < 1e-6, 'F11 : inchangé');
  // fenêtre large 2560×1271 (lobby 1129 px) : murs élargis à 726 px, rognés en haut et en bas
  const s = 726 / 330,
    wide = S.ctx.lobbyTorchSpot(L, 2560, 1129, 726);
  assert.ok(Math.abs(wide.y - ((1129 - 690 * s) / 2 + 380 * s)) < 1e-6, 'fenêtre large : vasque suivie en hauteur');
  assert.ok(Math.abs(wide.x - 137 * s) < 1e-6, 'fenêtre large : vasque gauche suivie');
  const right = S.ctx.lobbyTorchSpot(Rt, 2560, 1129, 726);
  assert.ok(Math.abs(right.x - (2560 - (328 - 192) * (726 / 328))) < 1e-6, 'mur droit : sa propre largeur (328 px)');
}
// ---------- Bouclier d'absorption sur les barres de vie (src/ui/hud.js) ----------
{
  const S = sandbox({ clamp: (v, a, b) => Math.max(a, Math.min(b, v)) });
  S.fn('src/ui/hud.js', 'shieldSpan');
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.equal(S.ctx.shieldSpan(500, 1000, 0), null, 'sans bouclier : rien');
  // vie 50 %, bouclier 20 % : portion juste après la vie, dans la partie vide
  const a = S.ctx.shieldSpan(500, 1000, 200);
  assert.ok(near(a.left, 50) && near(a.width, 20) && !a.over, 'bouclier dans la vie manquante');
  // vie 90 %, bouclier 30 % : 10 % dans le vide, 20 % de surplus posé sur la fin de la vie
  const b = S.ctx.shieldSpan(900, 1000, 300);
  assert.ok(near(b.left, 70) && near(b.width, 30) && b.over, 'surplus sur la fin de la barre de vie');
  // pleine vie : tout le bouclier recouvre la fin de la vie ; jamais plus large que la barre
  const c = S.ctx.shieldSpan(1000, 1000, 5000);
  assert.ok(near(c.left, 0) && near(c.width, 100) && c.over, 'bouclier énorme : toute la barre, pas plus');
}
// ---------- Effets de sorts : impacts travaillés (src/render/effects.js, 05/11/2026) ----------
// Un impact = éclair, onde de choc au sol, trace sombre qui s'efface lentement, étincelles qui laissent une traînée.
{
  const THREE = require('three');
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}) });
  const S = sandbox({
    THREE,
    performance: { now: () => 0 },
    fxAim() {},
    document: { createElement: () => ({ getContext: () => ctx2d }) }
  });
  S.ctx.globalThis = S.ctx;
  S.load('src/render/effects.js');
  const FX = S.ctx.SpellFX,
    scene = new THREE.Scene(),
    renderer = { getDrawingBufferSize: v => v.set(800, 600) };
  FX.init(THREE, scene, renderer, new THREE.PerspectiveCamera(60, 1, 0.1, 100));
  const before = scene.children.length;
  assert.ok(FX.spawn({ type: 'shadowImpact', x: 0, y: 1.2, z: 0, color: [0.6, 0.3, 1], life: 0.6, size: 0.4 }));
  const added = scene.children.slice(before),
    dark = added.filter(m => m.material.blending === THREE.NormalBlending),
    glow = added.filter(m => m.material.blending === THREE.AdditiveBlending);
  assert.ok(dark.length === 1 && dark[0].position.y < 0.1, 'impact : une trace sombre au sol');
  assert.ok(glow.some(m => m.position.y < 0.1), 'impact : onde de choc au sol');
  // étincelles à traînée : le nombre de points visibles grandit pendant qu'elles volent
  const pts = scene.children.find(o => o.isPoints),
    count = () => pts.geometry.drawRange.count;
  FX.update(1 / 60);
  const n1 = count();
  FX.update(1 / 60);
  assert.ok(count() > n1, `traînées des étincelles (${n1} → ${count()})`);
  // la trace reste après l'éclair et l'onde (lisible après le coup), puis disparaît
  for (let i = 0; i < 50; i++) FX.update(1 / 60);
  assert.ok(scene.children.includes(dark[0]) && dark[0].material.opacity > 0.45, 'trace encore bien visible à 0,85 s');
  for (let i = 0; i < 60; i++) FX.update(1 / 60);
  assert.ok(!scene.children.includes(dark[0]), 'trace retirée après 1,6 s');
  // pas de bulle éphémère au lancement d'un bouclier ou d'un camouflage (jugée moche, 05/11/2026) : seuls les éclats
  // de lumière (points) ; la bulle qui dure est render/shield_aura.js
  for (const type of ['shield', 'cloak']) {
    const n0 = scene.children.length;
    assert.ok(FX.spawn({ type, x: 0, y: 1, z: 0, color: [1, 0.8, 0.4], life: 0.9, size: 0.85 }));
    assert.equal(scene.children.length, n0, `${type} : pas de bulle éphémère`);
  }
}
// ---------- Caméra contre un mur : recul continu, sans à-coups (src/render/world.js) ----------
// Bug du 05/11/2026 : en salle de préparation, caméra reculée contre le mur, elle vibrait (point de contact cherché par
// pas fixes de 1/30 : jusqu'à 0,5 m de saut pour 5 mm de déplacement).
{
  const { combatWorld } = require('./combat_world.js');
  const { read } = require('./sources.js');
  const { ctx } = combatWorld();
  const src = read('src/render/world.js').match(/^const CAM_DOOR_H[\s\S]*?^function cameraSafe[\s\S]*?\n\}/m)[0];
  require('node:vm').runInContext(src.replace(/^const /gm, 'var '), ctx);
  ctx.lerp = (a, b, t) => a + (b - a) * t;
  for (const map of ['castle', 'bridge']) {
    ctx.applyMap(map);
    const R = ctx.roomOf(-1);
    let prev = null,
      worst = 0,
      cut = false;
    for (let k = 0; k < 300; k++) {
      // dans la salle ouest, recul de 16 m en biais : la caméra bute sur un mur de la salle
      const T = ctx.roomWorld(R, R.side * (R.half + R.wall + 4 + k * 0.005), R.at),
        fwd = ctx.roomWorld(R, -R.side * Math.cos(0.4), -Math.sin(0.4)),
        target = [T.x, 1.25, T.z],
        yaw = Math.atan2(fwd.x, fwd.z),
        h = Math.cos(0.3) * 16,
        desired = [target[0] - Math.sin(yaw) * h, target[1] + Math.sin(0.3) * 16 + 1, target[2] - Math.cos(yaw) * h],
        s = ctx.cameraSafe(target, desired),
        cam = [0, 1, 2].map(i => target[i] + (desired[i] - target[i]) * s);
      if (s < 1) cut = true;
      if (prev) worst = Math.max(worst, Math.hypot(cam[0] - prev[0], cam[2] - prev[2]));
      prev = cam;
      assert.ok(ctx.insideWalls(cam[0], cam[2], 0.25), `${map} : caméra devant le mur, pas dedans`);
    }
    assert.ok(cut, `${map} : le mur arrête bien la caméra`);
    assert.ok(worst < 0.03, `${map} : caméra continue (saut max ${worst.toFixed(3)} m pour 5 mm)`);
  }
}
// ---------- Blocs maçonnés : texture à l'échelle de chaque face (environment.js boxUV) ----------
// Bug du 05/11/2026 : murs des salles de départ en « barres verticales » (pierres étirées sur 12 m à The Bridge,
// écrasées sur les faces étroites au château).
{
  const THREE = require('three'),
    { boxUV } = require('../src/render/environment.js').helpers,
    [w, h, d, tile] = [12, 4, 0.8, 3],
    geo = boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, tile),
    uv = geo.attributes.uv,
    n = geo.attributes.normal;
  for (let f = 0; f < 6; f++) {
    const idx = [0, 1, 2, 3].map(k => f * 4 + k),
      span = get => Math.max(...idx.map(get)) - Math.min(...idx.map(get)),
      i = idx[0],
      [su, sv] = n.getX(i) ? [d, h] : n.getY(i) ? [w, d] : [w, h];
    assert.ok(Math.abs(span(j => uv.getX(j)) - su / tile) < 1e-6, `face ${f} : largeur de texture = largeur de la face`);
    assert.ok(Math.abs(span(j => uv.getY(j)) - sv / tile) < 1e-6, `face ${f} : hauteur de texture = hauteur de la face`);
  }
}
// ---------- Bulle de bouclier : visible tant que le bouclier tient (render/shield_aura.js) ----------
// Demande du 05/11/2026 : Power Shield / Arcane Barrier / Shield Wall gardent une bulle autour de l'unité jusqu'à la fin.
{
  const THREE = require('three'),
    A = require('../src/render/shield_aura.js'),
    added = [];
  A.init(THREE, { add: m => added.push(m) });
  const me = { id: 1, team: 'ally', alive: true, shield: 300, shieldName: 'Arcane Barrier' },
    foe = { id: 2, team: 'enemy', alive: true, shield: 300, shieldName: 'Power Shield', stealth: true },
    body = { position: { x: 2, y: 0, z: 3 }, scale: { y: 1 } },
    step = (s, t = 0.05) => {
      for (let k = 0; k < s / t; k++) A.update(t, [me, foe], () => body, me, 0);
    },
    bub = id => added[id - 1],
    U = id => bub(id).material.uniforms;
  step(0.3);
  assert.ok(bub(1).visible && bub(1).position.x === 2 && bub(1).position.z === 3, "bulle autour de l'unité protégée");
  assert.deepEqual(U(1).c.value.toArray(), A.SHIELD_LOOK['Arcane Barrier'].c, 'aspect du sort qui protège');
  assert.ok(U(1).a.value > 0.9, 'bouclier entier : bulle pleine');
  assert.equal(U(2).a.value, 0, 'ennemi camouflé : la bulle ne le trahit pas');
  me.shield = 100;
  step(0.05);
  assert.ok(U(1).hit.value > 0.5, "coup absorbé : la bulle s'éclaire");
  step(1);
  assert.ok(bub(1).visible && U(1).a.value < 0.9, 'bouclier usé : bulle plus pâle, toujours là');
  me.shield = 0;
  step(0.1);
  assert.ok(bub(1).visible, 'bouclier cassé : la bulle éclate (visible un instant)');
  step(0.5);
  assert.ok(!bub(1).visible, 'bouclier disparu : plus de bulle');
  foe.alive = false;
  step(0.6);
  assert.ok(!bub(2).visible, 'unité morte : plus de bulle');
}
// ---------- Sol peint : ombres de contact, halos des braseros (render/ground_paint.js groundShadeAt) ----------
// Demande du 06/11/2026 (graphismes « peints à la main ») : la lumière et l'ombre sont peintes une fois dans le sol.
{
  const env = require('../src/render/environment.js'),
    S = sandbox({ ArenaEnv: env, window: { ArenaEnv: env } });
  S.ctx.roomFrame = (r, x, z) => (r.axis === 'z' ? { a: z, b: x } : { a: x, b: z }); // data/maps.js
  S.load('src/render/ground_paint.js');
  const shade = env.helpers.groundShadeAt,
    lum = c => (c[0] + c[1] + c[2]) / 3,
    open = { halfX: 30, halfZ: 20, pillars: [] },
    at = (arena, x, z, opt) => lum(shade(arena, x, z, opt));
  // même point, même bruit : seul l'obstacle change
  const pil = { ...open, pillars: [{ x: 5, z: 0, r: 1.5 }] },
    post = { ...open, pillars: [{ x: 5, z: 0, r: 1.5, los: false }] };
  assert.ok(at(pil, 6.7, 0) / at(open, 6.7, 0) < 0.6, 'ombre de contact au pied d’un pilier');
  assert.ok(at(post, 6.7, 0) > at(pil, 6.7, 0), 'obstacle mince (los: false) : ombre plus légère');
  assert.ok(at(pil, 14, 9) / at(open, 14, 9) > 0.97, 'loin du pilier : pas d’ombre');
  const wide = { ...open, halfX: 40 };
  assert.ok(at(open, 29.9, 3) / at(wide, 29.9, 3) < 0.6, 'ombre de contact au pied d’un rempart');
  const fire = { lights: [{ x: 10, z: 5, r: 5, c: [1, 0.5, 0.2], k: 0.6 }] },
    lit = shade(open, 10.5, 5, fire),
    dim = shade(open, 10.5, 5);
  assert.ok(lit[0] - dim[0] > 0.4 && lit[0] - dim[0] > 2 * (lit[2] - dim[2]), 'halo chaud d’un brasero');
  assert.ok(at(open, 0, 0, { shade: () => 0.5 }) / at(open, 0, 0) === 0.5, 'ombre propre à la carte (shade)');
  // salle de départ (06/11/2026, sol de la salle « trop fake ») : ombre au pied de ses murs, pas au milieu
  const room = { ...open, rooms: [{ side: 1, axis: 'z', half: 20, at: 0, wall: 3, depth: 10, halfW: 6 }] };
  assert.ok(at(room, 0, 32.8) / at(open, 0, 32.8) < 0.6, 'salle : ombre au pied du mur du fond');
  assert.ok(at(room, 5.8, 28) / at(open, 5.8, 28) < 0.6, 'salle : ombre au pied d’un mur de côté');
  assert.ok(at(room, 0, 28) / at(open, 0, 28) > 0.9, 'salle : milieu clair');
}
// ---------- Pas chassé : le corps pivote vite mais pas d'un coup (render/heroes3d.js hfBodyTurn) ----------
// Demande du 06/11/2026 : « quand je change de gauche à droite ça change directement » ; déplacement et regard restent
// immédiats, seul l'angle du corps par rapport au regard suit en ~0,15 s.
{
  const S = sandbox({ BODY_TURN: 20 });
  S.fn('src/render/heroes3d.js', 'hfBodyTurn');
  const turn = S.ctx.hfBodyTurn,
    L = Math.PI / 2;
  let a = turn(L, -L, 1 / 60);
  assert.ok(a < L - 0.3 && a > 0, `gauche → droite : le corps commence à pivoter (${a.toFixed(2)})`);
  for (let i = 0; i < 9; i++) a = turn(a, -L, 1 / 60);
  assert.ok(Math.abs(a + L) < 0.15 * L, `gauche → droite : pivot fini en 0,17 s (${a.toFixed(2)})`);
  assert.equal(turn(0.4, 0.4, 1 / 60), 0.4, 'direction inchangée : rien ne bouge');
}
// ---------- Rendu peint : un programme par retouche de shader (environment.js, builder.js) ----------
// Bug du 05/11/2026 : three r128 partage un programme compilé entre matériaux au même texte de onBeforeCompile ; la
// retouche peinte, identique pour tous, donnait aux remparts du château le shader du sol (texture en bandes verticales).
{
  const THREE = require('three');
  const S = sandbox({ THREE });
  S.ctx.globalThis = S.ctx;
  for (const f of ['rig', 'glow', 'weapons', 'cloth', 'armor', 'shoulders', 'head', 'kits', 'builder'])
    S.load(`src/characters/${f}.js`);
  const env = require('../src/render/environment.js'),
    paints = {
      décor: m => env.paintMaterial(THREE, m),
      personnages: m => S.ctx.CharacterKit.stylizeMaterial(THREE, m, [0.5, 0.5, 0.5])
    };
  for (const [who, paint] of Object.entries(paints)) {
    const plain = new THREE.MeshStandardMaterial(),
      floor = new THREE.MeshStandardMaterial();
    floor.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;');
    };
    paint(plain);
    paint(floor);
    // three r128 (WebGLPrograms.getProgramCacheKey) : la clé du programme est customProgramCacheKey()
    assert.notEqual(plain.customProgramCacheKey(), floor.customProgramCacheKey(), `${who} : programmes distincts`);
    const twin = new THREE.MeshStandardMaterial();
    paint(twin);
    assert.equal(plain.customProgramCacheKey(), twin.customProgramCacheKey(), `${who} : même retouche, même programme`);
  }
}
// ---------- Décor vivant : particules d'ambiance et braises des flammes (src/render/env_ambient.js) ----------
{
  const THREE = require('three');
  const hooks = [],
    helpers = { rng: s => () => (s = (s * 16807) % 2147483647) / 2147483647, glowTexture: () => new THREE.Texture() },
    S = sandbox({ THREE, window: { ArenaEnv: { helpers, afterBuild: fn => hooks.push(fn) } } });
  S.ctx.ArenaEnv = S.ctx.window.ArenaEnv;
  S.load('src/render/env_ambient.js');
  const E = { time: { value: 0 }, px: { value: 600 }, mobile: false, flames: [] },
    scene = new THREE.Scene();
  helpers.ambientMotes(THREE, scene, E, { area: { hx: 10, hz: 8, y0: 0.5, y1: 4 }, count: 50, color: 0xffffff });
  const pts = scene.children[0];
  assert.ok(pts.isPoints && pts.geometry.attributes.position.count === 50, 'une nuée = un seul appel de dessin');
  assert.equal(pts.material.uniforms.time, E.time, 'animée par la carte graphique (horloge du décor)');
  // braises : ajoutées à chaque carte, au-dessus de chaque flamme du décor
  for (const x of [0, 5, 9]) {
    const s = new THREE.Sprite();
    s.position.set(x, 3, 0);
    E.flames.push({ s });
  }
  E.flames.push({ light: {} }); // lumière de brasero sans flamme dessinée : pas d'émetteur
  assert.equal(hooks.length, 1, 'braises ajoutées à toutes les cartes (afterBuild)');
  hooks[0](THREE, scene, {}, E);
  const embers = scene.children[1],
    P = embers.geometry.attributes.position;
  assert.equal(P.count, 3 * 7, '7 braises par flamme');
  assert.ok(Array.from({ length: P.count }, (_, i) => P.getY(i)).every(y => y === 3), 'les braises partent des flammes');
}
// ---------- Vivant à l'arrêt : respiration, regard qui se promène, poids, clignements (src/render/hero_anim.js) ----------
{
  const THREE = require('three');
  const S = sandbox({
    THREE,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    now: () => 0,
    state: {},
    performance: { now: () => 0 }
  });
  S.load('src/render/hero_anim.js');
  const { idleLifePose, hfBodyPose, BREATH } = S.ctx;
  const nums = p => Object.values(p).filter(v => typeof v === 'number');
  assert.ok(nums(idleLifePose(2.3, 0.4, 0, false)).every(v => v === 0), 'poids nul : pose du clip');
  const T = Array.from({ length: 2000 }, (_, i) => i / 100), // 20 s
    P = T.map(t => idleLifePose(t, 0.4, 1, false)),
    span = k => Math.max(...P.map(p => p[k])) - Math.min(...P.map(p => p[k]));
  assert.ok(span('chest') > 0.03 && span('chest') < 0.08, `respiration visible mais discrète (${span('chest').toFixed(3)})`);
  assert.ok(span('headYaw') > 0.1 && Math.max(...P.map(p => Math.abs(p.headYaw))) < 0.2, 'regard qui se promène, peu');
  assert.ok(span('sway') > 0.02, 'transfert du poids');
  const blinks = P.filter((p, i) => p.blink && !P[i - 1]?.blink).length;
  assert.ok(blinks >= 4 && blinks <= 7, `clignements toutes les 3 à 5 s (${blinks} en 20 s)`);
  // garde : respiration plus rapide, regard plus fixe ; deux personnages ne respirent pas ensemble
  const crossings = (seed, guard) =>
    T.filter((t, i) => i && Math.sign(idleLifePose(t, seed, 1, guard).chest) !== Math.sign(idleLifePose(T[i - 1], seed, 1, guard).chest)).length;
  assert.ok(crossings(0.4, true) > crossings(0.4, false) && BREATH.guard < BREATH.idle, 'garde : souffle plus court');
  assert.ok(Math.abs(idleLifePose(5, 0.1, 1, false).chest - idleLifePose(5, 0.6, 1, false).chest) > 0.005, 'phases propres');
  // squelette : la tête bouge à l'arrêt, retour exact à la pose du clip en course ; paupières qui clignent
  const model = new THREE.Group();
  let parent = model;
  for (const n of ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head']) {
    const b = Object.assign(new THREE.Bone(), { name: n });
    b.position.y = n === 'spine_01' ? 1 : 0.15;
    parent.add(b);
    parent = b;
  }
  const head = parent,
    lid = Object.assign(new THREE.Mesh(), { name: 'Eyelid', visible: false }),
    glow = Object.assign(new THREE.Sprite(), { name: 'EyeGlow' });
  head.add(lid, glow);
  const rec = { model, kit: true, animKey: 'idle' },
    u = { id: 3, cls: 'arcanist', race: 'human', alive: true, stun: 0 },
    up = () => new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld),
    track = [];
  for (let f = 0; f < 8 * 60; f++) {
    rec.animKey = f < 6 * 60 ? 'idle' : 'run';
    hfBodyPose(rec, u, 1 / 60);
    model.updateMatrixWorld(true);
    track.push({ up: up(), closed: lid.visible && !glow.visible });
  }
  const moved = track.slice(60, 360).map(x => x.up.distanceTo(new THREE.Vector3(0, 1, 0)));
  assert.ok(Math.max(...moved) > 0.03, `à l'arrêt, la tête bouge (${Math.max(...moved).toFixed(3)})`);
  assert.ok(track.slice(60, 360).some(x => x.closed), 'clignement des yeux à l’arrêt');
  assert.ok(track[7 * 60].up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9 && !track[7 * 60].closed, 'en course : pose du clip');
  const v = track.slice(1).map((x, i) => x.up.clone().sub(track[i].up)),
    jerk = Math.max(...v.slice(1).map((x, i) => x.distanceTo(v[i])));
  assert.ok(jerk < 0.004, `mouvements doux, sans à-coup (${jerk.toFixed(4)})`);
}
// ---------- Étourdi : tête penchée en avant qui tourne lentement, yeux fermés (src/render/hero_anim.js) ----------
// Bug du 04/11/2026 : le clip Hit_Chest en boucle rejetait la tête en arrière à chaque tour (« on dirait qu'il bug »).
{
  const THREE = require('three');
  const S = sandbox({
    THREE,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    now: () => 0,
    state: {},
    performance: { now: () => 0 }
  });
  S.load('src/render/hero_anim.js');
  const { stunPose, hfBodyPose, hfSetAnim, STUN_CIRCLE } = S.ctx;
  // courbe : rien sans poids, penché vers l'avant (cou + tête), petits cercles lents et réguliers
  assert.ok(
    Object.values(stunPose(1.3, 0)).every(v => v === 0),
    'poids nul : pose du clip'
  );
  const P = Array.from({ length: 261 }, (_, i) => stunPose(i / 100, 1));
  assert.ok(
    P.every(p => p.neck > 0.05 && p.head > 0.08 && p.neck + p.head < 0.45),
    'tête légèrement penchée en avant'
  );
  const roll = P.map(p => p.roll),
    pitch = P.map(p => p.head);
  assert.ok(Math.max(...roll) - Math.min(...roll) > 0.1, 'la tête décrit un cercle (sur le côté)');
  assert.ok(Math.max(...pitch) - Math.min(...pitch) > 0.06, 'la tête décrit un cercle (avant / arrière)');
  assert.ok(Math.max(...roll.map(Math.abs)) < 0.12, 'petits cercles');
  assert.ok(STUN_CIRCLE >= 2, `cercles lents (${STUN_CIRCLE} s par tour)`);
  // squelette minimal : buste, cou, tête (+ paupières cachées, lueur des yeux)
  const model = new THREE.Group(),
    names = ['spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head'];
  let parent = model;
  for (const n of names) {
    const b = new THREE.Bone();
    b.name = n;
    b.position.y = n === 'spine_01' ? 1 : 0.15;
    parent.add(b);
    parent = b;
  }
  const head = parent,
    lid = Object.assign(new THREE.Mesh(), { name: 'Eyelid', visible: false }),
    glow = Object.assign(new THREE.Sprite(), { name: 'EyeGlow' });
  head.add(lid, glow);
  const rec = { model, kit: true, animKey: 'stun' }, // clip de l'étourdi (pas la surcouche du repos)
    u = { cls: 'arcanist', race: 'human', alive: true, stun: 0 },
    face = () => new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld), // haut de la tête
    track = [];
  for (let f = 0; f < 6 * 60; f++) {
    u.stun = f >= 60 && f < 4 * 60 ? 1 : 0; // étourdi de 1 s à 4 s
    hfBodyPose(rec, u, 1 / 60);
    model.updateMatrixWorld(true);
    track.push({ f, up: face(), closed: lid.visible && !glow.visible });
  }
  assert.ok(track[59].up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9, 'avant : pose du clip');
  assert.ok(track[150].up.z > 0.15, `tête penchée vers l'avant (${track[150].up.z.toFixed(2)})`);
  assert.ok(track[150].closed && !track[59].closed, 'yeux fermés pendant l’étourdissement seulement');
  assert.ok(track[5 * 60].up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9, 'après : retour exact à la pose du clip');
  assert.ok(!track[5 * 60].closed && glow.visible, 'yeux rouverts, lueur rallumée');
  // départ et fin en douceur, cercles sans à-coup : vitesse de la tête qui change peu d'une image à l'autre
  const v = track.slice(1).map((x, i) => x.up.clone().sub(track[i].up)),
    jerk = Math.max(...v.slice(1).map((x, i) => x.distanceTo(v[i])));
  assert.ok(jerk < 0.004, `aucun à-coup (${jerk.toFixed(4)})`);
  assert.ok(Math.max(...v.slice(120, 230).map(x => x.length())) < 0.006, 'cercles lents une fois la tête penchée');
  // clip : repos (plus de Hit_Chest qui rejette la tête en arrière) ; Death Grip garde son clip de choc
  const clips = ['Idle_Loop', 'Hit_Chest'].map(name => ({ name })),
    action = c => ({
      c,
      reset() {},
      setLoop() {},
      fadeIn() {
        return this;
      },
      fadeOut() {},
      play() {},
      getClip: () => c
    }),
    anim = unit => {
      const r = { clips, mixer: { clipAction: action } };
      hfSetAnim(r, { alive: true, grounded: true, action: 0, ...unit });
      return r.action.getClip().name;
    };
  assert.equal(anim({ stun: 2 }), 'Idle_Loop', 'étourdi : clip de repos');
  assert.equal(anim({ stun: 0, mobility: { type: 'grip' } }), 'Hit_Chest', 'Death Grip : clip de choc');
  // repos → étourdi : même clip, il continue (le relancer depuis le début faisait sauter la tête)
  const cache = {},
    r = { clips, mixer: { clipAction: c => (cache[c.name] = cache[c.name] || { ...action(c), resets: 0 }) } };
  cache.Idle_Loop = {
    ...action(clips[0]),
    resets: 0,
    reset() {
      this.resets++;
    }
  };
  hfSetAnim(r, { alive: true, grounded: true, action: 0, stun: 0 });
  hfSetAnim(r, { alive: true, grounded: true, action: 0, stun: 2 });
  assert.equal(r.animKey, 'stun');
  assert.equal(cache.Idle_Loop.resets, 1, 'repos → étourdi : le clip de repos n’est pas relancé');
}
// ---------- Épaulières sculptées : mage, démoniste, voleur, prêtre (src/characters/shoulders.js) ----------
// Demande du 04/11/2026 : au plus près des planches de référence ; seules les épaulières changent.
{
  const THREE = require('three');
  const S = sandbox({ THREE });
  S.ctx.globalThis = S.ctx;
  S.ctx.CharacterParts = { envMap: () => null }; // seul outil de rig.js utilisé (reflets du métal)
  S.load('src/characters/shoulders.js');
  const P = S.ctx.CharacterParts;
  const skeleton = () => {
    const bones = {},
      bone = (name, x, y, parent) => {
        const b = (bones[name] = new THREE.Bone());
        b.position.set(x, y, 0);
        (parent || root).add(b);
        return b;
      },
      root = new THREE.Group();
    const spine = bone('spine_03', 0, 1.4);
    bone('neck_01', 0, 0.15, spine);
    for (const [side, x] of [
      ['l', 0.08],
      ['r', -0.08]
    ])
      bone('upperarm_' + side, x * 1.6, 0.05, bone('clavicle_' + side, x, 0.08, spine));
    root.updateMatrixWorld(true);
    return bones;
  };
  for (const [style, st] of Object.entries(P.SHOULDER_STYLES)) {
    const bones = skeleton();
    assert.ok(P.buildStyledPauldrons(THREE, bones, style, 1.8), style + ' : construit');
    for (const side of ['l', 'r']) {
      const g = bones['clavicle_' + side].children.find(o => o.name === 'Pauldron');
      assert.ok(g, `${style} : épaulière ${side} attachée à la clavicule (suit l'épaule)`);
      let blades = 0,
        gems = 0,
        base = false;
      g.traverse(o => {
        if (o.isMesh && o.geometry.type === 'ExtrudeGeometry') blades++;
        if (o.isMesh && o.material.emissiveIntensity > 1) gems++;
        if (o.isMesh && o.material.color.equals(new THREE.Color(...st.base))) base = true;
      });
      const want = st.tiers.reduce((n, t) => n + t.n, 0) * 2; // lame + bordure
      assert.equal(blades, want, `${style} : ${want / 2} lames bordées`);
      assert.equal(gems, (st.gems || 0) + (st.runes || 0), `${style} : gemmes et runes lumineuses`);
      assert.ok(base, `${style} : couleur de la planche`);
    }
    assert.equal(!!bones.spine_03.children.find(o => o.name === 'Collar'), !!st.collar, `${style} : col haut`);
  }
  assert.equal(P.buildStyledPauldrons(THREE, skeleton(), 'inconnu', 1.8), false, 'style inconnu : épaulières rondes');
}
// ---------- Nain : la barbe suit la tête (src/characters/head.js) ----------
// Bug du 04/11/2026 : la barbe skinnée du pack (Hair_Beard) recevait un matériau sans `skinning` (three r128) : elle
// restait figée en pose de repos quand la tête bougeait. Tout le reste de la barbe est attaché à l'os de la tête.
{
  const THREE = require('three');
  const ctx2d = { fillRect() {}, beginPath() {}, moveTo() {}, bezierCurveTo() {}, stroke() {} };
  const S = sandbox({ THREE, document: { createElement: () => ({ getContext: () => ctx2d }) } });
  S.ctx.globalThis = S.ctx;
  S.load('src/characters/rig.js');
  S.load('src/characters/head.js');
  const root = new THREE.Group(),
    neck = new THREE.Bone(),
    head = new THREE.Bone();
  head.name = 'Head';
  head.position.y = 0.1;
  neck.position.y = 1.4;
  neck.add(head);
  root.add(neck);
  const packBeard = new THREE.SkinnedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial());
  packBeard.name = 'Hair_Beard';
  root.add(packBeard);
  root.updateMatrixWorld(true);
  const L = { eye: new THREE.Vector3(0, 1.62, 0.08), chin: 1.5, cx: 0, mouthY: 1.54, mouthZ: 0.1 };
  S.ctx.CharacterParts.dwarfBeard(THREE, root, { Head: head }, L, new THREE.Color(0.5, 0.3, 0.2));
  assert.equal(packBeard.material.skinning, true, 'barbe du pack : matériau skinné (suit la tête)');
  const beard = root.getObjectByName('DwarfBeard');
  assert.ok(beard.parent === head, 'barbe tressée attachée à l’os de la tête');
  // la tête bascule (étourdi, frappe) : la pointe de la barbe tourne avec elle, à la même distance du menton
  const mass = beard.getObjectByName('Beard_Mass'),
    last = mass.geometry.attributes.position.count - 1, // pointe de la barbe
    tip = () => {
      root.updateMatrixWorld(true);
      return new THREE.Vector3()
        .fromBufferAttribute(mass.geometry.attributes.position, last)
        .applyMatrix4(mass.matrixWorld);
    };
  const t0 = tip(),
    local0 = head.worldToLocal(t0.clone());
  head.rotation.x = -0.5; // tête en arrière
  const t1 = tip();
  assert.ok(t1.distanceTo(t0) > 0.1, 'la barbe bouge avec la tête');
  assert.ok(head.worldToLocal(t1.clone()).distanceTo(local0) < 1e-3, 'même place dans le repère de la tête');
}
// ---------- Voleur : les glaives tranchent en arc, pas en coup de poing (src/render/hero_anim.js) ----------
// Régression du 04/11/2026 : la main gauche de Punch_Jab n'a qu'une pose fixe, le mixeur ne la réécrit jamais ; la
// surcouche repartait de son propre résultat et le glaive tournoyait au hasard (selon la cadence d'images) au lieu de
// trancher. Squelette minimal : bras pendants, glaive (axe y) le long de l'avant-bras, comme au repos.
{
  const THREE = require('three');
  const S = sandbox({ THREE, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), performance: { now: () => S.ctx.ms } });
  S.load('src/render/hero_anim.js');
  const rig = () => {
    const model = new THREE.Group();
    for (const [side, x] of [
      ['l', 0.2],
      ['r', -0.2]
    ]) {
      const up = new THREE.Bone(),
        lo = new THREE.Bone(),
        hand = new THREE.Bone(),
        glaive = new THREE.Object3D();
      up.name = 'upperarm_' + side;
      hand.name = 'hand_' + side;
      glaive.name = 'Dagger';
      up.position.set(x, 1.4, 0);
      up.rotation.x = Math.PI; // bras vers le bas
      lo.position.y = 0.3;
      hand.position.y = 0.25;
      model.add(up);
      up.add(lo);
      lo.add(hand);
      hand.add(glaive);
    }
    model.rotation.y = 0.7; // personnage tourné : tout se mesure dans son repère
    model.updateMatrixWorld(true);
    return model;
  };
  // une frappe de la main gauche (Punch_Jab) vue à `fps` images/s ; direction de la lame dans le repère du personnage
  const strike = (race, fps, clip = 'Punch_Jab') => {
    const model = rig(),
      rec = { model, animKey: 'idle', action: { time: 0, getClip: () => ({ name: clip, duration: 0.87 }) } },
      u = { race, cls: 'shade' },
      glaive = model.getObjectByName(clip === 'Punch_Jab' ? 'hand_l' : 'hand_r').children[0],
      inv = () => new THREE.Quaternion().copy(model.quaternion).invert(),
      dirs = [];
    S.ctx.ms = 1000;
    S.ctx.hfBladeSlash(rec, u); // pose de repos mémorisée
    rec.animKey = 'attack';
    for (let f = 0; f <= Math.round(0.5 * fps); f++) {
      S.ctx.ms = 1000 + (f * 1000) / fps;
      rec.action.time = (f / fps) * 1.6;
      S.ctx.hfBladeSlash(rec, u);
      model.updateMatrixWorld(true);
      dirs.push({
        t: f / fps,
        d: new THREE.Vector3(0, 1, 0).transformDirection(glaive.matrixWorld).applyQuaternion(inv())
      });
    }
    // glaive à deux lames symétriques : on suit la moitié couchée vers l'extérieur à l'armé
    const out = clip === 'Punch_Jab' ? 1 : -1,
      sign = Math.sign(dirs.find(x => x.t >= 0.07).d.x * out);
    return dirs.map(x => ({ t: x.t, d: x.d.multiplyScalar(sign) }));
  };
  const at = (dirs, t) => dirs.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)).d;
  const yaw = d => Math.atan2(d.z, d.x); // 0 = vers sa gauche (extérieur de la main gauche), π/2 = devant
  for (const race of ['human', 'elf', 'dwarf', 'orc', 'undead']) {
    const D = strike(race, 60),
      tp = p => (p * 0.36) / S.ctx.RACE_STRIKE[race].speed; // instant d'une avancée du coup (vitesse de la race)
    // lame couchée (presque horizontale) et pointée vers l'extérieur à l'armé, devant au milieu, à l'intérieur à la fin
    const mid = D.filter(x => x.t > tp(0.15) && x.t < tp(0.6));
    assert.ok(
      mid.every(x => Math.abs(x.d.y) < 0.6),
      `${race} : lame couchée pendant le coup (pas dressée comme un poing)`
    );
    const yaws = mid.map(x => Math.abs(yaw(x.d)));
    const sweep = Math.max(...yaws) - Math.min(...yaws);
    assert.ok(sweep > 1.5, `${race} : la lame balaie un arc horizontal (${sweep.toFixed(2)} rad)`);
    assert.ok(at(D, tp(0.12)).x > 0.3 && at(D, tp(0.6)).x < -0.3, `${race} : de l'extérieur vers l'intérieur`);
    // retour exact à la pose du clip après le coup (rien ne s'accumule)
    assert.ok(Math.abs(D[D.length - 1].d.y) > 1 - 1e-3, `${race} : retour à la pose du clip`);
    // même pose à 30 et à 120 images/s : la frappe ne dépend pas de la cadence d'images (l'ancienne surcouche
    // ajoutait son roulis à chaque image)
    const slow = strike(race, 30),
      fast = strike(race, 120);
    for (const t of [3 / 30, 5 / 30, 6 / 30])
      assert.ok(
        at(slow, t).distanceTo(at(fast, t)) < 0.03,
        `${race} : même pose à 30 et 120 images/s (t=${t.toFixed(2)})`
      );
    // sans à-coup : à 120 images/s, la vitesse de la lame (angle parcouru par image) change en douceur ; un saut ou
    // une bascule donne un pic isolé (mesuré : 0,06 au plus, vitesse max 0,2)
    const steps = fast.slice(1).map((x, i) => x.d.angleTo(fast[i].d)),
      jerk = Math.max(...steps.slice(1).map((v, i) => Math.abs(v - steps[i])));
    assert.ok(jerk < 0.1, `${race} : lame sans saut (variation de vitesse ${jerk.toFixed(3)} rad par image)`);
  }
  // main droite (Punch_Cross) : arc symétrique, de sa droite vers sa gauche
  const R = strike('human', 60, 'Punch_Cross');
  assert.ok(at(R, 0.04).x < -0.3 && at(R, 0.2).x > 0.3, 'main droite : de l’extérieur vers l’intérieur');
  // l'elfe trace un plus grand arc que le nain
  const span = race => {
    const y = strike(race, 60).map(x => Math.abs(yaw(x.d)));
    return Math.max(...y) - Math.min(...y);
  };
  assert.ok(span('elf') > span('dwarf'), 'arc plus ample pour l’elfe que pour le nain');
  // la surcouche est bien appelée à chaque image pour le voleur, après le mixeur
  const h3 = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/render/heroes3d.js'), 'utf8');
  assert.match(
    h3,
    /mixer\.update\(dt\);[\s\S]{0,200}u\.cls === 'shade'[^\n]*hfBladeSlash\(rec, u\)/,
    'hfBladeSlash appelé'
  );
}
console.log(
  'OK - règles de jeu (tests unitaires : déplacement, IA, cibles, sanctuaires, fear, ciblage au clic, contrôles, IK, glaives, frappe des glaives en arc, frappes par race, étourdi, barbe, torches du lobby, bouclier sur les barres)'
);
