'use strict';
// Déplacement du joueur à chaque pas de simulation : clavier (GameLogic), souris (gauche + droit = avancer),
// joystick mobile, base de trajectoire pendant / après un glisser de caméra (orbitBase, lu par input/controls.js).
// Joystick mobile : au-delà de 35 % de déviation, vitesse pleine (sinon on avançait à vitesse réduite).
function mobileStickBoost(f, r) {
  const m = Math.hypot(f, r);
  return m > 0.35 ? 1 / m : 1 / 0.35;
}
let orbitBase = null,
  camReturn = false;
function moveBaseYaw(dt) {
  if (orbiting) {
    if (orbitBase === null) orbitBase = camera.yaw;
    camReturn = true;
    return orbitBase;
  }
  // réglage « Camera returns behind you » désactivé : au relâchement, la caméra reste où on l'a laissée et le
  // personnage garde sa direction (déplacements comme si le clic gauche était encore tenu) ; un glisser au clic droit
  // les réaligne
  if (PREFS.cameraReturn === false && orbitBase !== null && !looking) return orbitBase;
  if (camReturn && orbitBase !== null && !looking) {
    const d = Math.atan2(Math.sin(orbitBase - camera.yaw), Math.cos(orbitBase - camera.yaw));
    if (Math.abs(d) < 0.01) camReturn = false;
    else {
      camera.yaw += d * Math.min(1, dt * 6);
      return orbitBase;
    }
  }
  orbitBase = null;
  camReturn = false;
  return camera.yaw;
}
// Sort qui tourne le personnage vers sa cible (Shadowstep) : la caméra se replace derrière lui, et la base de
// trajectoire d'un glisser en cours suit (sinon Z partait dans l'ancienne direction). Joueur local seulement.
function viewBehind(u) {
  if (u !== state.player) return;
  camera.yaw = u.yaw;
  if (orbitBase !== null) orbitBase = u.yaw;
  camReturn = false;
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
  keyboardTurn(dt);
  // En l'air (saut ou chute) : la trajectoire du décollage est gardée jusqu'à l'atterrissage, les touches ne la
  // changent plus (seul le regard peut tourner).
  if (!p.grounded) {
    if (!p.airVel) p.airVel = p.lastVel || { x: 0, z: 0 };
    p.x += p.airVel.x * dt;
    p.z += p.airVel.z * dt;
    p.moving = false;
    resolveWalls(p);
    return;
  }
  p.airVel = null;
  p.lastVel = { x: 0, z: 0 };
  // Base de trajectoire : la caméra, sauf pendant un glisser au clic gauche (orbiting) où elle reste figée
  // sur l'orientation d'avant le glisser ; au relâchement, la caméra revient doucement derrière le personnage.
  const base = moveBaseYaw(dt);
  let mv = GameLogic.moveVector(state.keys, camera.yaw);
  if (base !== camera.yaw) mv = GameLogic.moveVector(state.keys, base);
  if ((MOUSE_BTN & 3) === 3) mv = GameLogic.moveVector({ ...state.keys, z: true }, base); // clic gauche + droit = avancer
  let dx = mv.x,
    dz = mv.z;
  if (MOBILE.enabled && (Math.abs(MOBILE.moveForward) > 0.04 || Math.abs(MOBILE.moveRight) > 0.04)) {
    const fw = GameLogic.forward(base),
      rt = GameLogic.screenRight(base),
      k = mobileStickBoost(MOBILE.moveForward, MOBILE.moveRight),
      f = MOBILE.moveForward * k,
      r = MOBILE.moveRight * k;
    dx = fw.x * f + rt.x * r;
    dz = fw.z * f + rt.z * r;
  }
  if (p.root > 0) {
    dx = dz = 0;
  }
  p.moving = !!(dx || dz);
  if (!p.moving) return;
  endCast(p, 'cancel');
  const fw = GameLogic.forward(base),
    back = (dx * fw.x + dz * fw.z) / (Math.hypot(dx, dz) || 1) < -0.5; // recul : on garde le regard vers l'avant
  const sp = moveSpeed(p) * (back ? 0.62 : 1);
  p.x += dx * sp * dt;
  p.z += dz * sp * dt;
  p.lastVel = { x: dx * sp, z: dz * sp }; // vitesse reprise telle quelle si l'on saute
  p.yaw = looking || MOBILE.lookPointer !== null || back ? base : Math.atan2(dx, dz);
  p.movePhase += dt * 9.2;
  resolveWalls(p);
}
