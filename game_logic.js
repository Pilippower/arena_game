(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GameLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function forward(yaw) {
    return { x: Math.sin(yaw), z: Math.cos(yaw) };
  }

  // IMPORTANT: in the current camera/view convention, screen-right is NOT +world-X
  // at yaw=0. This basis is defined from what the player actually sees on screen.
  function screenRight(yaw) {
    return { x: -Math.cos(yaw), z: Math.sin(yaw) };
  }

  function axesFromKeys(keys = {}) {
    const f = (keys.z || keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const r = (keys.d || keys.arrowright ? 1 : 0) - (keys.q || keys.a || keys.arrowleft ? 1 : 0);
    return { forward: f, right: r };
  }

  function moveVector(keys, yaw) {
    let { forward: f, right: r } = axesFromKeys(keys);
    if (!f && !r) return { x: 0, z: 0, forward: 0, right: 0 };
    const len = Math.hypot(f, r) || 1;
    f /= len;
    r /= len;
    const fw = forward(yaw),
      rt = screenRight(yaw);
    return {
      x: fw.x * f + rt.x * r,
      z: fw.z * f + rt.z * r,
      forward: f,
      right: r
    };
  }

  function applyLook(yaw, pitch, dx, dy, hSens = 0.0045, vSens = 0.0042) {
    // Contract locked by tests:
    // mouse right => character/camera turn right on screen
    // mouse up    => camera looks up in setupCamera's orbit convention
    // (dy < 0 must LOWER pitch because positive pitch raises the camera above the target)
    return {
      yaw: yaw - dx * hSens,
      pitch: clamp(pitch + dy * vSens, -0.45, 1.04)
    };
  }

  function dot(a, b) {
    return a.x * b.x + a.z * b.z;
  }

  function selfCheck() {
    const angles = [0, Math.PI / 6, Math.PI / 2, Math.PI, Math.PI * 1.5, -Math.PI / 3];
    for (const yaw of angles) {
      const rt = screenRight(yaw);
      const q = moveVector({ q: true }, yaw);
      const d = moveVector({ d: true }, yaw);
      if (!(dot(q, rt) < -0.999)) throw new Error('Regression input: Q doit aller à gauche');
      if (!(dot(d, rt) > 0.999)) throw new Error('Regression input: D doit aller à droite');
      const next = applyLook(yaw, 0, 20, 0);
      const newForward = forward(next.yaw);
      if (!(dot(newForward, rt) > 0)) throw new Error('Regression caméra: souris droite doit tourner à droite');
      const up = applyLook(yaw, 0.2, 0, -20);
      const down = applyLook(yaw, 0.2, 0, 20);
      if (!(up.pitch < 0.2))
        throw new Error('Regression caméra verticale: souris haut doit réduire le pitch (regarder vers le haut)');
      if (!(down.pitch > 0.2))
        throw new Error('Regression caméra verticale: souris bas doit augmenter le pitch (regarder vers le bas)');
    }
    return true;
  }

  return { clamp, forward, screenRight, axesFromKeys, moveVector, applyLook, dot, selfCheck };
});
