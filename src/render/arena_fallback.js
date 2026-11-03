'use strict';
// Arène : décor three.js (ENV, environment.js) ou arène de secours WebGL, sanctuaires de soin.
function renderHealthShrines() {
  if (!state?.shrines) return;
  const tt = now();
  for (const sh of state.shrines) {
    if (sh.active) {
      const pulse = 1 + Math.sin(tt * 3) * 0.08;
      part(
        'torus',
        [sh.x, 0.08, sh.z],
        [0, tt * 0.5, 0],
        [1.05 * pulse, 0.07, 1.05 * pulse],
        [0.25, 1, 0.42],
        [0.05, 0.65, 0.2],
        0.88
      );
      part('cube', [sh.x, 0.85, sh.z], [0, tt * 0.35, 0], [0.18, 0.72, 0.18], [0.72, 1, 0.76], [0.2, 1, 0.38], 0.94);
      part('cube', [sh.x, 0.85, sh.z], [0, tt * 0.35, 0], [0.65, 0.18, 0.18], [0.72, 1, 0.76], [0.2, 1, 0.38], 0.94);
      part('sphere', [sh.x, 0.85, sh.z], [0, 0, 0], [0.62, 0.62, 0.62], [0.25, 1, 0.42], [0.05, 0.85, 0.28], 0.18);
    } else {
      const k = clamp(sh.respawn / 45, 0, 1);
      part('torus', [sh.x, 0.06, sh.z], [0, 0, 0], [0.72, 0.035, 0.72], [0.22, 0.3, 0.24], [0.05, 0.1, 0.06], 0.28);
    }
  }
}
// Décor three.js (environment.js) dessiné sous ce canevas ; en cas d'échec, l'arène historique ci-dessous reste affichée.
const ENV = { attempted: false, ok: false };
function envEnsureInit() {
  if (ENV.attempted) return ENV.ok;
  ENV.attempted = true;
  try {
    ENV.ok = !!(
      window.THREE &&
      window.ArenaEnv &&
      ArenaEnv.init(THREE, $('env3d'), arena, { mobile: document.body.classList.contains('mobile-mode'), map: MAP_ID })
    );
  } catch (e) {
    console.warn('Décor 3D indisponible, arène simplifiée :', e);
    ENV.ok = false;
  }
  if (!ENV.ok) $('env3d').style.display = 'none';
  return ENV.ok;
}
function renderArena() {
  if (ENV.ok) {
    // le décor est sur le canevas du dessous : ici, seulement la profondeur des piliers/murs (les effets passent derrière) et les sanctuaires
    const hx = arena.halfX,
      hz = arena.halfZ;
    gl.colorMask(false, false, false, false);
    for (const p of arena.pillars) part('cyl', [p.x, p.h / 2, p.z], [0, 0, 0], [p.r, p.h / 2, p.r], [0, 0, 0]);
    part('cube', [0, 1.7, -hz - 0.5], [0, 0, 0], [hx + 1.2, 1.7, 0.5], [0, 0, 0]);
    part('cube', [0, 1.7, hz + 0.5], [0, 0, 0], [hx + 1.2, 1.7, 0.5], [0, 0, 0]);
    part('cube', [-hx - 0.5, 1.7, 0], [0, 0, 0], [0.5, 1.7, hz + 1.2], [0, 0, 0]);
    part('cube', [hx + 0.5, 1.7, 0], [0, 0, 0], [0.5, 1.7, hz + 1.2], [0, 0, 0]);
    gl.colorMask(true, true, true, true);
    renderHealthShrines();
    return;
  }
  const hx = arena.halfX,
    hz = arena.halfZ;
  // Broad arena floor with greener, less toy-like materials.
  part('cube', [0, -0.26, 0], [0, 0, 0], [hx + 4, 0.24, hz + 4], [0.12, 0.14, 0.11]);
  const tileStep = 4;
  for (let x = -hx + 2; x <= hx - 2; x += tileStep)
    for (let z = -hz + 2; z <= hz - 2; z += tileStep) {
      const nx = x / hx,
        nz = z / hz,
        edge = Math.max(Math.abs(nx), Math.abs(nz));
      const moss = (Math.sin(x * 0.37) + Math.cos(z * 0.41) + Math.sin((x + z) * 0.17)) * 0.5;
      let col;
      if (edge > 0.78) col = [0.16 + 0.03 * moss, 0.24 + 0.04 * moss, 0.15 + 0.02 * moss];
      else if ((Math.round(x / tileStep) + Math.round(z / tileStep)) % 2 === 0) col = [0.24, 0.25, 0.23];
      else col = [0.2, 0.22, 0.2];
      part('cube', [x, -0.015, z], [0, 0, 0], [1.9, 0.03, 1.9], col);
      if (edge > 0.62 && Math.sin(x * 1.7 + z * 2.1) > 0.35)
        part('cube', [x, 0.02, z], [0, 0, 0], [1.6, 0.012, 1.6], [0.16, 0.24, 0.13]);
    }
  // central runes / inlays
  part('torus', [0, 0.038, 0], [0, 0, 0], [12.8, 0.07, 12.8], [0.65, 0.49, 0.17], [0.22, 0.09, 0.01], 0.92);
  part('torus', [0, 0.044, 0], [0, 0, 0], [7.8, 0.06, 7.8], [0.18, 0.52, 0.86], [0.03, 0.16, 0.48], 0.82);
  part('torus', [0, 0.049, 0], [0, 0, 0], [2.4, 0.055, 2.4], [0.66, 0.48, 0.17], [0.2, 0.08, 0.01], 0.9);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      r = i % 2 ? 10.0 : 5.7;
    part(
      'cube',
      [Math.sin(a) * r, 0.04, Math.cos(a) * r],
      [0, -a, 0],
      [0.17, 0.035, 0.92],
      [0.56, 0.43, 0.17],
      [0.12, 0.05, 0.01],
      0.7
    );
  }
  // outer walls
  const wall = [0.24, 0.26, 0.23],
    trim = [0.38, 0.36, 0.29];
  part('cube', [0, 1.7, -hz - 0.78], [0, 0, 0], [hx + 1.2, 0.82, 0.78], wall);
  part('cube', [0, 1.7, hz + 0.78], [0, 0, 0], [hx + 1.2, 0.82, 0.78], wall);
  part('cube', [-hx - 0.78, 1.7, 0], [0, 0, 0], [0.78, 0.82, hz + 1.2], wall);
  part('cube', [hx + 0.78, 1.7, 0], [0, 0, 0], [0.78, 0.82, hz + 1.2], wall);
  for (let x = -hx + 1; x <= hx - 1; x += 3) {
    part('cube', [x, 2.92, -hz - 0.78], [0, 0, 0], [0.56, 0.42, 0.76], trim);
    part('cube', [x, 2.92, hz + 0.78], [0, 0, 0], [0.56, 0.42, 0.76], trim);
  }
  for (let z = -hz + 1; z <= hz - 1; z += 3) {
    part('cube', [-hx - 0.78, 2.92, z], [0, 0, 0], [0.76, 0.42, 0.56], trim);
    part('cube', [hx + 0.78, 2.92, z], [0, 0, 0], [0.76, 0.42, 0.56], trim);
  }
  // line-of-sight pillars
  for (const p of arena.pillars) {
    part('cyl', [p.x, p.h / 2, p.z], [0, 0, 0], [p.r, p.h / 2, p.r], [0.31, 0.34, 0.31]);
    part('cyl', [p.x, 0.18, p.z], [0, 0, 0], [p.r * 1.28, 0.18, p.r * 1.28], [0.4, 0.41, 0.34]);
    part('cyl', [p.x, p.h - 0.18, p.z], [0, 0, 0], [p.r * 1.18, 0.18, p.r * 1.18], [0.42, 0.43, 0.38]);
    part(
      'torus',
      [p.x, 0.45, p.z],
      [0, 0, 0],
      [p.r * 1.09, 0.07, p.r * 1.09],
      [0.24, 0.48, 0.2],
      [0.04, 0.18, 0.03],
      0.76
    );
    part(
      'torus',
      [p.x, p.h - 0.48, p.z],
      [0, 0, 0],
      [p.r * 1.04, 0.055, p.r * 1.04],
      [0.22, 0.55, 0.95],
      [0.03, 0.15, 0.48],
      0.7
    );
    part(
      'cone',
      [p.x, p.h + 0.52, p.z],
      [0, now() * 0.18, 0],
      [0.3, 0.66, 0.3],
      [0.22, 0.75, 1],
      [0.05, 0.32, 0.85],
      0.88
    );
  }
  // grass / weeds / flowers around outer lanes for a more WoW-like arena feel.
  function grassClump(x, z, s = 1) {
    const g1 = [0.18, 0.45, 0.14],
      g2 = [0.28, 0.62, 0.18],
      g3 = [0.36, 0.7, 0.24];
    for (let i = 0; i < 5; i++) {
      const a = i * 0.72 + Math.sin(x * 1.7 + z * 1.1),
        h = (0.26 + (i % 3) * 0.08) * s;
      part(
        'cube',
        [x + Math.sin(a) * 0.16 * s, h * 0.5, z + Math.cos(a) * 0.16 * s],
        [0, a, 0.22 + Math.sin(a) * 0.25],
        [0.03 * s, h, 0.012 * s],
        i % 3 === 0 ? g3 : i % 2 ? g2 : g1
      );
    }
    if ((Math.floor(x) + Math.floor(z)) % 7 === 0) {
      part('sphere', [x, 0.12, z], [0, 0, 0], [0.035, 0.035, 0.035], [0.76, 0.45, 0.82]);
      part('sphere', [x + 0.06, 0.1, z - 0.04], [0, 0, 0], [0.028, 0.028, 0.028], [0.93, 0.86, 0.3]);
    }
  }
  for (let i = 0; i < 120; i++) {
    const a = i * 2.3999632297;
    const ring = i % 3 === 0 ? 0.74 : i % 3 === 1 ? 0.84 : 0.92;
    const x = Math.sin(a) * (hx * ring),
      z = Math.cos(a) * (hz * ring);
    if (Math.abs(x) < 15 && Math.abs(z) < 12) continue;
    grassClump(x, z, 0.9 + (i % 4) * 0.16);
    if (i % 5 === 0) part('sphere', [x + 0.22, 0.1, z - 0.15], [0, 0, 0], [0.15, 0.1, 0.12], [0.18, 0.24, 0.14]);
  }
  // scenery outside combat lanes: banners, trees, braziers.
  for (const side of [-1, 1]) {
    const teamCol = side < 0 ? [0.48, 0.09, 0.12] : [0.08, 0.22, 0.58];
    for (const z of [-18, -9, 0, 9, 18]) {
      part('cube', [side * (hx - 0.65), 2.25, z], [0, 0, 0], [0.06, 0.96, 0.76], teamCol);
      part('cyl', [side * (hx - 1.4), 1.0, z + 0.95], [0, 0, 0], [0.085, 0.7, 0.085], [0.19, 0.13, 0.07]);
      part(
        'sphere',
        [side * (hx - 1.4), 1.86, z + 0.95],
        [0, 0, 0],
        [0.22, 0.22, 0.22],
        [1, 0.38, 0.04],
        [1, 0.12, 0.01],
        0.95
      );
    }
    for (const z of [-20.0, 20.0]) {
      const x = side * (hx - 7.0);
      part('cyl', [x, 1.2, z], [0, 0, 0], [0.3, 1.2, 0.3], [0.24, 0.15, 0.08]);
      part('sphere', [x, 2.85, z], [0, 0, 0], [1.45, 1.8, 1.45], [0.15, 0.34, 0.12], [0.04, 0.16, 0.03], 0.96);
      part(
        'sphere',
        [x + 0.7 * side, 2.38, z + 0.2],
        [0, 0, 0],
        [1.05, 1.18, 1.05],
        [0.18, 0.39, 0.13],
        [0.04, 0.16, 0.03],
        0.94
      );
      for (let g = 0; g < 6; g++) grassClump(x + Math.sin(g * 1.2) * 1.1, z + Math.cos(g * 1.2) * 1.0, 0.9);
    }
  }
  // ruined arches and broken walls
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * (hx - 10.5),
        z = sz * (hz - 8.8);
      part('cyl', [x, 1.9, z], [0, 0, 0], [0.45, 1.9, 0.45], [0.34, 0.34, 0.3]);
      part('cyl', [x + sx * 2.4, 1.9, z], [0, 0, 0], [0.45, 1.9, 0.45], [0.34, 0.34, 0.3]);
      part('cube', [x + sx * 1.2, 3.7, z], [0, 0, 0], [1.7, 0.3, 0.52], [0.4, 0.39, 0.33]);
      part(
        'sphere',
        [x + sx * 1.2, 4.06, z],
        [0, 0, 0],
        [0.24, 0.24, 0.24],
        [0.18, 0.55, 0.94],
        [0.04, 0.18, 0.55],
        0.88
      );
      for (let s = 0; s < 4; s++)
        part(
          'cube',
          [x + sx * (3.8 + s * 0.75), 0.35, z + sz * (0.5 + s * 0.55)],
          [0, s * 0.3, 0],
          [0.32, 0.22, 0.26],
          [0.27, 0.29, 0.24]
        );
    }
  // rocks, moss and extra grass around the perimeter.
  for (let i = 0; i < 28; i++) {
    const a = i * 2.173,
      rx = hx - 2.0,
      rz = hz - 1.8,
      x = Math.sin(a) * rx,
      z = Math.cos(a) * rz;
    part('sphere', [x, 0.18, z], [0, 0, 0], [0.46 + (i % 3) * 0.12, 0.24, 0.38 + (i % 2) * 0.14], [0.24, 0.28, 0.22]);
    if (i % 2 === 0) part('sphere', [x + 0.28, 0.31, z - 0.18], [0, 0, 0], [0.34, 0.34, 0.34], [0.16, 0.36, 0.13]);
    for (let g = 0; g < 3; g++) grassClump(x + Math.sin(g * 2.1) * 0.42, z + Math.cos(g * 2.1) * 0.42, 0.72);
  }
  renderHealthShrines();

  // distant castle skyline and fantasy horizon
  for (const side of [-1, 1]) {
    part('cube', [side * 9, 4.4, -hz - 8.5], [0, 0, 0], [7.2, 2.8, 2.2], [0.3, 0.34, 0.43]);
    part('cube', [side * 9, 7.3, -hz - 8.5], [0, 0, 0], [2.5, 0.55, 2.2], [0.44, 0.49, 0.62]);
    part('cyl', [side * 13.6, 5.6, -hz - 8.8], [0, 0, 0], [1.6, 4.8, 1.6], [0.32, 0.36, 0.45]);
    part('cyl', [side * 4.4, 5.0, -hz - 8.6], [0, 0, 0], [1.4, 4.3, 1.4], [0.32, 0.36, 0.45]);
    part('cone', [side * 13.6, 10.4, -hz - 8.8], [0, 0, 0], [1.5, 1.8, 1.5], [0.5, 0.56, 0.72]);
    part('cone', [side * 4.4, 9.1, -hz - 8.6], [0, 0, 0], [1.3, 1.6, 1.3], [0.5, 0.56, 0.72]);
    part('sphere', [side * 9, 6.4, -hz - 7.2], [0, 0, 0], [0.3, 0.3, 0.3], [1, 0.78, 0.34], [1, 0.58, 0.12], 0.94);
  }
  part('cube', [0, 3.7, -hz - 9.0], [0, 0, 0], [6.0, 2.3, 2.4], [0.34, 0.38, 0.48]);
  part('cyl', [0, 6.9, -hz - 9.0], [0, 0, 0], [1.4, 3.1, 1.4], [0.34, 0.38, 0.48]);
  part('cone', [0, 10.0, -hz - 9.0], [0, 0, 0], [1.35, 1.7, 1.35], [0.55, 0.6, 0.76]);
}
