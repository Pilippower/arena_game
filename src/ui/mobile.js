'use strict';
// Mobile : plein écran, joystick et boutons tactiles.
// ---------- mobile viewport / fullscreen ----------
function mobileViewportSync() {
  if (!MOBILE.enabled) return;
  const vv = window.visualViewport;
  const h = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  const w = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  if (h) document.documentElement.style.setProperty('--mobile-vh', h + 'px');
  if (w) document.documentElement.style.setProperty('--mobile-vw', w + 'px');
}
// Entrer en plein écran (Play) : jamais en sortir (08/11/2026 : Play basculait, et sortait du plein écran choisi).
async function mobileEnterFullscreen() {
  if (!MOBILE.enabled || document.fullscreenElement) return false;
  return mobileFullscreen(true);
}
// Bouton plein écran du haut : bascule.
async function mobileToggleFullscreen() {
  if (!MOBILE.enabled) return false;
  return mobileFullscreen(!document.fullscreenElement);
}
async function mobileFullscreen(on) {
  try {
    if (on && document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    else if (!on && document.exitFullscreen) await document.exitFullscreen();
    else return false;
    mobileViewportSync();
    return true;
  } catch (_) {
    return false; // le navigateur peut refuser le plein écran (pages locales ou téléchargées)
  }
}
mobileViewportSync();
window.addEventListener('resize', mobileViewportSync);
window.visualViewport?.addEventListener('resize', mobileViewportSync);
window.addEventListener('orientationchange', () => setTimeout(mobileViewportSync, 80));
$('fullscreenBtn')?.addEventListener('click', e => {
  e.preventDefault();
  mobileToggleFullscreen();
});

// ---------- mobile touch controls (desktop controls remain unchanged) ----------
function mobileCycleTarget() {
  if (!state?.player?.alive) return;
  const es = enemies(state.player).filter(e => !e.stealth);
  if (!es.length) return;
  const i = Math.max(-1, es.indexOf(state.player.target));
  setTarget(state.player, es[(i + 1) % es.length]);
  updateUI();
}
function mobileJump() {
  const p = state?.player;
  if (p?.alive && p.stun <= 0 && p.fear <= 0 && p.grounded) {
    p.vy = 7.5;
    p.grounded = false;
    p.cast = null;
  }
}
function setupMobileControls() {
  if (!MOBILE.enabled) return;
  const joy = $('mobileJoystick'),
    stick = $('mobileStick'),
    look = $('mobileLookZone');
  const resetJoy = () => {
    MOBILE.joyPointer = null;
    MOBILE.moveForward = MOBILE.moveRight = 0;
    if (stick) stick.style.transform = 'translate(0px,0px)';
  };
  const setJoy = e => {
    const r = joy.getBoundingClientRect(),
      cx = r.left + r.width / 2,
      cy = r.top + r.height / 2,
      dx = e.clientX - cx,
      dy = e.clientY - cy,
      max = r.width * 0.31,
      len = Math.hypot(dx, dy) || 1,
      k = Math.min(1, max / len),
      sx = dx * k,
      sy = dy * k;
    MOBILE.moveRight = clamp(sx / max, -1, 1);
    MOBILE.moveForward = clamp(-sy / max, -1, 1);
    if (stick) stick.style.transform = `translate(${sx}px,${sy}px)`;
  };
  joy?.addEventListener('pointerdown', e => {
    if (MOBILE.joyPointer !== null) return;
    MOBILE.joyPointer = e.pointerId;
    joy.setPointerCapture?.(e.pointerId);
    setJoy(e);
    e.preventDefault();
  });
  joy?.addEventListener('pointermove', e => {
    if (e.pointerId !== MOBILE.joyPointer) return;
    setJoy(e);
    e.preventDefault();
  });
  joy?.addEventListener('pointerup', e => {
    if (e.pointerId === MOBILE.joyPointer) resetJoy();
  });
  joy?.addEventListener('pointercancel', resetJoy);
  look?.addEventListener('pointerdown', e => {
    if (MOBILE.lookPointer !== null || $('overlay').style.display !== 'none') return;
    MOBILE.lookPointer = e.pointerId;
    MOBILE.lookX = e.clientX;
    MOBILE.lookY = e.clientY;
    MOBILE.tap = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    look.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  look?.addEventListener('pointermove', e => {
    if (e.pointerId !== MOBILE.lookPointer) return;
    const dx = e.clientX - MOBILE.lookX,
      dy = e.clientY - MOBILE.lookY;
    MOBILE.lookX = e.clientX;
    MOBILE.lookY = e.clientY;
    if (MOBILE.tap) MOBILE.tap.moved += Math.abs(dx) + Math.abs(dy);
    const next = GameLogic.applyLook(camera.yaw, camera.pitch, dx, dy, 0.0052, 0.0046);
    camera.yaw = next.yaw;
    camera.pitch = next.pitch;
    if (state?.player?.alive) state.player.yaw = camera.yaw;
    e.preventDefault();
  });
  const stopLook = e => {
    if (e?.pointerId != null && e.pointerId !== MOBILE.lookPointer) return;
    MOBILE.lookPointer = null;
    // appui bref sans glisser = cibler le personnage touché
    const tp = MOBILE.tap;
    MOBILE.tap = null;
    if (e?.type === 'pointerup' && tp && tp.moved < 14 && performance.now() - tp.t < 350) {
      const rc = canvas.getBoundingClientRect();
      pickTargetAt(tp.x - rc.left, tp.y - rc.top);
    }
  };
  look?.addEventListener('pointerup', stopLook);
  look?.addEventListener('pointercancel', stopLook);
  $('mobileTargetBtn')?.addEventListener('pointerdown', e => {
    e.preventDefault();
    mobileCycleTarget();
  });
  $('mobileJumpBtn')?.addEventListener('pointerdown', e => {
    e.preventDefault();
    mobileJump();
  });
  window.addEventListener('blur', () => {
    resetJoy();
    MOBILE.lookPointer = null;
  });
}
setupMobileControls();
