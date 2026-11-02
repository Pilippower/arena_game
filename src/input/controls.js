'use strict';
// Contrôles desktop validés (ZQSD, caméra clic droit, ciblage) — ne pas modifier les conventions.
// ---------- controls: exact requested spec ----------
// Déplacements : touches réglables (PREFS.keybinds.move, codes physiques : ZQSD en AZERTY = WASD en QWERTY)
// + flèches. Traduites vers les touches logiques de GameLogic (w avant, s arrière, a gauche, d droite).
function setMoveKey(e, down) {
  if (!state) return false;
  const mv = PREFS.keybinds.move,
    m = {
      [mv.forward]: 'w',
      [mv.back]: 's',
      [mv.left]: 'a',
      [mv.right]: 'd',
      ...(mv.turnLeft && { [mv.turnLeft]: 'turnleft' }),
      ...(mv.turnRight && { [mv.turnRight]: 'turnright' }),
      ArrowUp: 'arrowup',
      ArrowDown: 'arrowdown',
      ArrowLeft: 'arrowleft',
      ArrowRight: 'arrowright'
    },
    k = e.code ? m[e.code] : null;
  if (k) {
    state.keys[k] = down;
    e.preventDefault();
    return true;
  }
  return false;
}
window.addEventListener('keydown', e => {
  if (captureBind) {
    e.preventDefault();
    if (e.code === 'Escape') {
      captureBind = null;
      $('bindStatus').textContent = 'Change cancelled.';
      renderBindGrid();
      return;
    }
    // modificateur seul : on attend la touche (Shift + E…) ; déplacements : touche simple (tenue en continu)
    if (isModifierCode(e.code)) {
      if (captureBind.type !== 'move') $('bindStatus').textContent = `${e.code.replace(/(Left|Right)$/, '')} + …`;
      return;
    }
    assignCapturedBind(captureBind.type === 'move' ? e.code : bindCombo(e));
    return;
  }
  if (settingsOpen) return;
  // une combinaison réglée (ex. Shift + W) passe avant le déplacement de la touche seule
  const comboSkill = e.ctrlKey || e.altKey || e.shiftKey ? PREFS.keybinds.skills.indexOf(bindCombo(e)) : -1,
    comboTrinket = (e.ctrlKey || e.altKey || e.shiftKey) && bindCombo(e) === PREFS.keybinds.trinket;
  if (comboSkill < 0 && !comboTrinket && setMoveKey(e, true)) return;
  if (!state || $('overlay').style.display !== 'none') return;
  if (e.code === 'Tab') {
    e.preventDefault();
    const es = enemies(state.player).filter(e => !e.stealth);
    if (es.length) {
      const i = Math.max(-1, es.indexOf(state.player.target));
      setTarget(state.player, es[(i + 1) % es.length]);
      updateUI();
    }
    return;
  }
  const skillIndex = bindIndex(PREFS.keybinds.skills, e);
  if (skillIndex >= 0) {
    e.preventDefault();
    const o = slotOrder(state.player);
    if (o[skillIndex] != null) tryPlayerSkill(o[skillIndex]);
    return;
  }
  if (bindIndex([PREFS.keybinds.trinket], e) === 0) {
    e.preventDefault();
    useTrinket(state.player);
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    const p = state.player;
    if (p.alive && p.stun <= 0 && p.fear <= 0 && !(p.poly > 0) && p.grounded) {
      p.vy = 7.5;
      p.grounded = false;
      p.cast = null;
    }
  }
});
window.addEventListener('keyup', e => setMoveKey(e, false));
window.addEventListener('blur', () => {
  if (state) state.keys = {};
});
// Tourner au clavier (Turn left / Turn right, non réglés par défaut) : même rotation qu'un glisser au clic droit
// (GameLogic.applyLook, convention validée), personnage et caméra ensemble ; ~180°/s.
const TURN_PX_PER_S = Math.PI / 0.0045;
function keyboardTurn(dt) {
  const k = state?.keys,
    dir = (k?.turnright ? 1 : 0) - (k?.turnleft ? 1 : 0);
  if (!dir) return;
  const next = GameLogic.applyLook(camera.yaw, camera.pitch, dir * TURN_PX_PER_S * dt, 0),
    delta = next.yaw - camera.yaw;
  camera.yaw = next.yaw;
  // caméra laissée de côté (glisser au clic gauche) : le personnage tourne du même angle, sans se recaler sur elle
  if (orbitBase !== null) orbitBase += delta;
  state.player.yaw = orbitBase ?? camera.yaw;
}
// Rotation de la caméra. `looking` (clic droit) tourne aussi le personnage ; `orbiting` (glisser au clic gauche) tourne la caméra seule.
let orbiting = false;
function applyLook(dx, dy) {
  if (!looking && !orbiting) return;
  const next = GameLogic.applyLook(camera.yaw, camera.pitch, dx, dy);
  camera.yaw = next.yaw;
  camera.pitch = next.pitch;
  if (looking && state?.player?.alive) state.player.yaw = camera.yaw;
}
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerdown', e => {
  const row = e.target.closest?.('[data-uid]');
  if (!row || !state?.player || uiEditMode) return;
  const u = state.units[+row.dataset.uid];
  if (u?.alive && !(u.stealth && u.team !== state.player.team)) {
    setTarget(state.player, u);
    updateUI();
  }
  e.preventDefault();
});
$('selfFrame').addEventListener('pointerdown', e => {
  if (!state?.player || uiEditMode) return;
  setTarget(state.player, state.player);
  updateUI();
});
// boutons souris enfoncés (gauche+droit ensemble = avancer, comme dans les MMO)
let MOUSE_BTN = 0;
for (const ev of ['mousedown', 'mouseup', 'mousemove'])
  window.addEventListener(
    ev,
    e => {
      MOUSE_BTN = e.buttons | 0;
    },
    true
  );
window.addEventListener('blur', () => {
  MOUSE_BTN = 0;
});
function pickTargetAt(sx, sy) {
  if (!state?.player?.alive) return false;
  const best = unitAtScreen(sx, sy);
  if (!best) return false;
  setTarget(state.player, best);
  updateUI();
  return true;
}
// Souris style MMO :
//  - clic gauche OU droit sans glisser = cibler l'unité sous le curseur ;
//  - glisser au clic gauche = tourner la caméra seule ; glisser au clic droit = caméra + personnage ;
//  - gauche + droit enfoncés (dans n'importe quel ordre) = avancer (voir playerMove, MOUSE_BTN).
const DRAG_PX = 5;
const MOUSE = { down: 0, x: 0, y: 0, moved: 0, dragging: false, both: false };
const fromTouch = e => e.sourceCapabilities?.firesTouchEvents;
function lockPointer() {
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock)
    try {
      canvas.requestPointerLock();
    } catch (_) {}
}
function unlockPointer() {
  if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
}
canvas.addEventListener('mousedown', e => {
  canvas.focus();
  if (fromTouch(e) || (e.button !== 0 && e.button !== 2)) return;
  if (!MOUSE.down) Object.assign(MOUSE, { x: e.clientX, y: e.clientY, moved: 0, dragging: false, both: false });
  MOUSE.down |= e.button === 0 ? 1 : 2;
  if (MOUSE.down === 3) MOUSE.both = true;
  if (e.button === 2) {
    looking = true;
    orbiting = false;
    if (state?.player?.alive) state.player.yaw = camera.yaw;
  }
  e.preventDefault();
});
document.addEventListener('mousemove', e => {
  if (!MOUSE.down) return;
  const dx = e.movementX || 0,
    dy = e.movementY || 0;
  MOUSE.moved += Math.abs(dx) + Math.abs(dy);
  if (!MOUSE.dragging && MOUSE.moved > DRAG_PX) {
    MOUSE.dragging = true;
    if (MOUSE.down & 1 && !looking) {
      orbiting = true;
      if (orbitBase === null) orbitBase = camera.yaw; // direction d'avant le glisser (avant toute rotation)
    }
    lockPointer();
  }
  if (MOUSE.dragging) applyLook(dx, dy);
});
window.addEventListener('mouseup', e => {
  const bit = e.button === 0 ? 1 : e.button === 2 ? 2 : 0;
  if (!bit || !(MOUSE.down & bit)) return;
  MOUSE.down &= ~bit;
  if (bit === 2) looking = false;
  if (bit === 1) orbiting = false;
  if (!MOUSE.down) {
    // clic simple (sans glisser, sans combinaison gauche+droit) : ciblage
    if (!MOUSE.dragging && !MOUSE.both) {
      const r = canvas.getBoundingClientRect();
      pickTargetAt(MOUSE.x - r.left, MOUSE.y - r.top);
    }
    MOUSE.dragging = false;
    unlockPointer();
  } else if (MOUSE.down & 1 && MOUSE.dragging) orbiting = true;
});
window.addEventListener('blur', () => {
  MOUSE.down = 0;
  looking = orbiting = false;
  unlockPointer();
});
canvas.addEventListener(
  'wheel',
  e => {
    camera.dist = clamp(camera.dist + Math.sign(e.deltaY) * 0.65, 4.5, 12.5);
    e.preventDefault();
  },
  { passive: false }
);
