'use strict';
// Rendu du monde à chaque image : taille des canevas, caméra (zoom lissé, anti-mur), interpolation des unités, ordre
// de dessin (render). Le reste est dans : arena_fallback.js, units_fallback.js, cc_marks.js, fx_webgl.js, overlay.js.
// ---------- 3D renderer ----------
function resize() {
  if (!gl) return;
  const r = canvas.getBoundingClientRect(),
    d = Math.min(1.8, devicePixelRatio || 1) * PERF.scale,
    w = Math.max(1, Math.floor(r.width * d)),
    h = Math.max(1, Math.floor(r.height * d));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
}
const CAM_DOOR_H = 2.5; // m : la caméra passe sous la poterne d'une salle de départ, pas à travers son linteau
function cameraSafe(target, desired) {
  let safe = 1;
  for (let i = 1; i <= 30; i++) {
    const t = i / 30,
      x = lerp(target[0], desired[0], t),
      y = lerp(target[1], desired[1], t),
      z = lerp(target[2], desired[2], t);
    // remparts de l'arène et murs des salles de départ ; le passage d'une porte seulement sous sa poterne
    let hit = !insideWalls(x, z, -0.05, y < CAM_DOOR_H) || y < 0.32;
    for (const p of arena.pillars) if (Math.hypot(x - p.x, z - p.z) < p.r + 0.28 && y < p.h + 0.25) hit = true;
    if (hit) {
      safe = (i - 1) / 30;
      break;
    }
  }
  return safe;
}
// Caméra affichée : le zoom glisse vers camera.dist (molette par crans) ; derrière un pilier elle se rapproche
// tout de suite (jamais de mur entre elle et le joueur) et ne se recule ensuite qu'en douceur.
const CAM_VIEW = { dist: null, safe: 1, t: 0 };
function setupCamera() {
  const t = now(),
    dt = clamp(t - CAM_VIEW.t, 0, 0.1);
  CAM_VIEW.t = t;
  CAM_VIEW.dist = CAM_VIEW.dist == null ? camera.dist : lerp(CAM_VIEW.dist, camera.dist, 1 - Math.exp(-14 * dt));
  const dist = CAM_VIEW.dist,
    p = state?.player || { x: 0, y: 0, z: 0 },
    target = [p.rx ?? p.x, (p.ry ?? p.y ?? 0) + 1.25, p.rz ?? p.z],
    cp = Math.cos(camera.pitch),
    sp = Math.sin(camera.pitch),
    h = cp * dist,
    desired = [target[0] - Math.sin(camera.yaw) * h, target[1] + sp * dist + 1.0, target[2] - Math.cos(camera.yaw) * h],
    safe = cameraSafe(target, desired);
  CAM_VIEW.safe = safe < CAM_VIEW.safe ? safe : lerp(CAM_VIEW.safe, safe, 1 - Math.exp(-6 * dt));
  camPos = [0, 1, 2].map(i => lerp(target[i], desired[i], CAM_VIEW.safe));
  viewProj = mul(perspective(Math.PI / 3, canvas.width / canvas.height, 0.08, 130), lookAt(camPos, target));
  gl.uniformMatrix4fv(loc.vp, false, viewProj);
  gl.uniform3fv(loc.cam, camPos);
  gl.uniform1f(loc.time, now());
}
// Herses des salles de départ : fermées pendant la préparation, levées en GATE_LIFT_T s à l'ouverture (state.gatesAt).
const GATE_LIFT_T = 2.2;
function gateOpening() {
  if (!state || (!(state.prep > 0) && state.gatesAt == null)) return 1;
  return state.prep > 0 ? 0 : clamp((now() - state.gatesAt) / GATE_LIFT_T, 0, 1);
}
function interpolateUnits() {
  if (!state?.units) return;
  const a = renderAlpha;
  for (const u of state.units) {
    if (u.visualSnap || u.prevX == null) {
      u.rx = u.x;
      u.ry = u.y || 0;
      u.rz = u.z;
    } else {
      u.rx = lerp(u.prevX, u.x, a);
      u.ry = lerp(u.prevY ?? (u.y || 0), u.y || 0, a);
      u.rz = lerp(u.prevZ, u.z, a);
    }
  }
}
function render() {
  if (!gl) return;
  // lobby affiché : l'arène est entièrement cachée, on ne la dessine pas (aucun calcul ni compilation inutile)
  if ($('overlay').style.display !== 'none') return;
  resize();
  interpolateUnits();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  const envOn = envEnsureInit();
  if (envOn) gl.clearColor(0, 0, 0, 0);
  else gl.clearColor(0.1, 0.14, 0.22, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  setupCamera();
  if (envOn) {
    const p = state?.player || { x: 0, y: 0, z: 0 },
      r = canvas.getBoundingClientRect();
    ArenaEnv.setGates?.(gateOpening());
    perfTime('env', () =>
      ArenaEnv.render(camPos, [p.rx ?? p.x, (p.ry ?? p.y ?? 0) + 1.25, p.rz ?? p.z], state?.units, r.width, r.height)
    );
  }
  if (typeof renderArena !== 'function') throw Error('renderArena manquant');
  const hfOn = hfEnsureInit();
  perfTime('world', () => {
    renderArena();
    renderPersistentCC();
    if (state?.units)
      for (const u of state.units) {
        const rec = hfOn ? HF.records.get(u.id) : null;
        if (!hfOn || (rec && rec.failed)) renderCharacter(u);
      }
    renderFx();
    renderOverlayWorld();
  });
  if (hfOn) perfTime('heroes', hfRender);
}
