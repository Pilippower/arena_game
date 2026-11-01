'use strict';
// Contrôles desktop validés (ZQSD, caméra clic droit, ciblage) — ne pas modifier les conventions.
// ---------- controls: exact requested spec ----------
function setMoveKey(e, down) {
  if (!state) return false;
  const m = {
      keyz: 'z',
      keyw: 'w',
      keys: 's',
      keyq: 'q',
      keya: 'a',
      keyd: 'd',
      arrowup: 'arrowup',
      arrowdown: 'arrowdown',
      arrowleft: 'arrowleft',
      arrowright: 'arrowright'
    },
    k = m[(e.code || '').toLowerCase()];
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
      $('bindStatus').textContent = 'Modification annulée.';
      renderBindGrid();
      return;
    }
    assignCapturedBind(e.code);
    return;
  }
  if (settingsOpen) return;
  if (setMoveKey(e, true)) return;
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
  const skillIndex = PREFS.keybinds.skills.indexOf(e.code);
  if (skillIndex >= 0) {
    e.preventDefault();
    const o = slotOrder(state.player);
    if (o[skillIndex] != null) tryPlayerSkill(o[skillIndex]);
    return;
  }
  if (e.code === PREFS.keybinds.trinket) {
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
  let best = null,
    bestD = 1e9;
  for (const u of state.units.filter(v => v.alive && !(v.stealth && v.team !== state.player.team))) {
    const p = projectScreen(u.rx ?? u.x, (u.ry ?? u.y ?? 0) + 1.35, u.rz ?? u.z);
    if (!p) continue;
    const d = Math.hypot(sx - p.x, sy - p.y);
    if (d < 62 && d < bestD) {
      best = u;
      bestD = d;
    }
  }
  if (best) {
    setTarget(state.player, best);
    updateUI();
    return true;
  }
  return false;
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
    if (MOUSE.down & 1 && !looking) orbiting = true;
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
