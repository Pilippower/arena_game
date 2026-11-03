'use strict';
// Marques de contrôle au-dessus des personnages : étourdissement (tourbillon), icônes de peur, mouton, racines, silence.
function stunSwirl(x, y, z, t) {
  const N = 40;
  for (let ring = 0; ring < 2; ring++) {
    const R = (ring ? 0.42 : 0.6) * (1 + Math.sin(t * 6 + ring) * 0.06),
      h = y + (ring ? 0.14 : 0),
      spin = (ring ? -1 : 1) * t * 3.2;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2,
        head = ((((a - spin) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2), // 0 = éclat
        hot = Math.max(0, 1 - head * 5),
        sz = 0.028 + hot * 0.02;
      part(
        'sphere',
        [x + Math.sin(a) * R, h, z + Math.cos(a) * R],
        [0, 0, 0],
        [sz, sz * 0.7, sz],
        [1, 0.88 + hot * 0.1, 0.25 + hot * 0.5],
        [1, 0.7 + hot * 0.3, 0.1 + hot * 0.5],
        0.9
      );
    }
  }
}
// Icône animée au-dessus de la tête pour chaque contrôle (même principe que le tourbillon d'étourdissement).
// Priorité : mouton / assommé > fear > silence > racines.
function ccIcon(u, x, y, z, t) {
  const P = (p, s, c, e, a = 0.92, shape = 'sphere', r = [0, 0, 0]) => part(shape, p, r, s, c, e, a);
  if (u.poly > 0 && u.polyKind === 'sap') {
    // assommé : trois « z » (petits losanges) qui montent en zigzag
    for (let k = 0; k < 3; k++) {
      const f = (t * 0.6 + k / 3) % 1,
        sz = 0.06 + f * 0.07;
      P(
        [x + Math.sin(f * 6 + k) * 0.18, y + f * 0.6, z],
        [sz, sz * 0.25, sz * 0.4],
        [0.85, 0.85, 1],
        [0.5, 0.5, 0.9],
        1 - f,
        'cube',
        [0, 0, 0.5]
      );
    }
  } else if (u.poly > 0) {
    // mouton : nuage de laine qui flotte + étincelles roses en orbite
    const bob = Math.sin(t * 3) * 0.05;
    for (const [dx, dy, r] of [
      [0, 0, 0.17],
      [-0.16, -0.03, 0.12],
      [0.16, -0.03, 0.12],
      [-0.08, 0.1, 0.11],
      [0.09, 0.1, 0.11]
    ])
      P([x + dx, y + dy + bob, z], [r, r * 0.85, r], [1, 0.97, 1], [0.6, 0.55, 0.7], 0.95);
    for (let k = 0; k < 4; k++) {
      const a = t * 2.4 + (k * Math.PI) / 2;
      P(
        [x + Math.sin(a) * 0.38, y + bob + Math.sin(a * 2) * 0.08, z + Math.cos(a) * 0.38],
        [0.04, 0.04, 0.04],
        [1, 0.6, 0.95],
        [1, 0.4, 0.9],
        0.95
      );
    }
  } else if (u.fear > 0) {
    // fear : crâne spectral violet qui oscille, volutes en orbite
    const sw = Math.sin(t * 4) * 0.08;
    P([x + sw, y + 0.05, z], [0.17, 0.16, 0.15], [0.82, 0.55, 1], [0.6, 0.15, 1], 0.9);
    P([x + sw, y - 0.1, z + 0.03], [0.1, 0.06, 0.09], [0.82, 0.55, 1], [0.6, 0.15, 1], 0.9);
    for (const sx of [-1, 1])
      P([x + sw + sx * 0.065, y + 0.06, z + 0.14], [0.045, 0.05, 0.03], [0.05, 0, 0.1], [0, 0, 0], 1);
    for (let k = 0; k < 5; k++) {
      const a = t * 3.2 + k * 1.26,
        r = 0.32 + Math.sin(t * 2 + k) * 0.05;
      P(
        [x + Math.sin(a) * r, y + Math.sin(a * 1.5) * 0.12, z + Math.cos(a) * r],
        [0.05, 0.05, 0.05],
        [0.7, 0.3, 1],
        [0.5, 0.1, 1],
        0.8
      );
    }
  } else if (u.silence > 0) {
    // silence : croix violette barrée qui tourne lentement
    for (const r of [0.75, -0.75])
      P([x, y, z], [0.05, 0.3, 0.05], [0.78, 0.5, 1], [0.5, 0.15, 1], 0.95, 'cube', [0, t * 1.5, r]);
    P([x, y, z], [0.22, 0.03, 0.22], [0.78, 0.5, 1], [0.5, 0.15, 1], 0.6, 'torus', [Math.PI / 2, t, 0]);
  } else if (u.root > 0) {
    // racines : couronne d'épines verte qui tourne
    for (let k = 0; k < 7; k++) {
      const a = t * 1.2 + (k * Math.PI * 2) / 7;
      P(
        [x + Math.sin(a) * 0.26, y, z + Math.cos(a) * 0.26],
        [0.035, 0.13, 0.035],
        [0.45, 0.85, 0.3],
        [0.15, 0.5, 0.05],
        0.95,
        'cone',
        [Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5]
      );
    }
    P([x, y - 0.05, z], [0.27, 0.03, 0.27], [0.35, 0.6, 0.2], [0.1, 0.35, 0.05], 0.9, 'torus', [Math.PI / 2, 0, 0]);
  }
}
function renderPersistentCC() {
  if (!state?.units) return;
  const tt = now();
  for (const u of state.units) {
    if (!u.alive) continue;
    const yy = u.ry ?? (u.y || 0),
      ux = u.rx ?? u.x,
      uz = u.rz ?? u.z;
    if (u.root > 0 && !u.rootKind) {
      part('torus', [ux, 0.1, uz], [0, 0, 0], [0.92, 0.055, 0.92], [0.34, 0.76, 1], [0.05, 0.35, 0.9], 0.82);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.256;
        part(
          'cone',
          [ux + Math.sin(a) * 0.52, 0.28, uz + Math.cos(a) * 0.52],
          [0.2 * Math.sin(a), -a, 0.2 * Math.cos(a)],
          [0.07, 0.34, 0.07],
          [0.3, 0.78, 1],
          [0.05, 0.35, 0.9],
          0.8
        );
      }
    }
    if (u.stun > 0) stunSwirl(ux, yy + 2.55, uz, tt);
    ccIcon(u, ux, yy + 2.55, uz, tt);
    if (u.slow > 0) {
      part('torus', [ux, 0.07, uz], [0, 0, 0], [0.7, 0.035, 0.7], [0.35, 0.72, 1], [0.05, 0.32, 0.88], 0.42);
    }
  }
}
