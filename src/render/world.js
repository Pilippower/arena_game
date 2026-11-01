'use strict';
// Rendu du monde : décor (environment.js), arène de secours, personnages de secours, effets, noms flottants.
// ---------- 3D renderer ----------
function resize() {
  if (!gl) return;
  const r = canvas.getBoundingClientRect(),
    d = Math.min(1.8, devicePixelRatio || 1),
    w = Math.max(1, Math.floor(r.width * d)),
    h = Math.max(1, Math.floor(r.height * d));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
}
function cameraSafe(target, desired) {
  let safe = 1;
  for (let i = 1; i <= 30; i++) {
    const t = i / 30,
      x = lerp(target[0], desired[0], t),
      y = lerp(target[1], desired[1], t),
      z = lerp(target[2], desired[2], t);
    let hit =
      x < -arena.halfX - 0.05 ||
      x > arena.halfX + 0.05 ||
      z < -arena.halfZ - 0.05 ||
      z > arena.halfZ + 0.05 ||
      y < 0.32;
    for (const p of arena.pillars) if (Math.hypot(x - p.x, z - p.z) < p.r + 0.28 && y < p.h + 0.25) hit = true;
    if (hit) {
      safe = (i - 1) / 30;
      break;
    }
  }
  return [lerp(target[0], desired[0], safe), lerp(target[1], desired[1], safe), lerp(target[2], desired[2], safe)];
}
function setupCamera() {
  const p = state?.player || { x: 0, y: 0, z: 0 },
    target = [p.rx ?? p.x, (p.ry ?? p.y ?? 0) + 1.25, p.rz ?? p.z],
    cp = Math.cos(camera.pitch),
    sp = Math.sin(camera.pitch),
    h = cp * camera.dist,
    desired = [
      target[0] - Math.sin(camera.yaw) * h,
      target[1] + sp * camera.dist + 1.0,
      target[2] - Math.cos(camera.yaw) * h
    ];
  camPos = cameraSafe(target, desired);
  viewProj = mul(perspective(Math.PI / 3, canvas.width / canvas.height, 0.08, 130), lookAt(camPos, target));
  gl.uniformMatrix4fv(loc.vp, false, viewProj);
  gl.uniform3fv(loc.cam, camPos);
  gl.uniform1f(loc.time, now());
}
function renderCharacter(u) {
  if (!u.alive) return;
  const C = CLASS[u.cls],
    col = C.color,
    acc = C.accent;
  const walk = u.moving && u.grounded ? Math.sin(u.movePhase) : 0;
  const bob = u.moving && u.grounded ? Math.abs(Math.sin(u.movePhase * 2)) * 0.042 : 0;
  const y = (u.y || 0) + bob,
    atk = u.action > 0 ? Math.sin((u.action / 0.5) * Math.PI) : 0;
  const race = RACE[u.race] || RACE.human;
  const H = race.height,
    B = race.bulk,
    shoulderScale = race.shoulder;
  const lp2 = (x, yy, z) => local(u, x * B, (y + yy) * H, z * B);
  const lp = (x, yy, z) => lp2(x, yy, z);
  const bulky = u.cls === 'sentinel' || u.cls === 'reaver' || race.bulk > 1.1;
  const caster = u.cls === 'arcanist' || u.cls === 'oracle' || u.cls === 'warlock';
  const robed = caster || u.cls === 'warden';
  const skin = race.skin,
    dark = [0.055, 0.045, 0.05],
    metal = [0.48, 0.52, 0.58],
    gold = [0.86, 0.66, 0.25];
  const teamRing = u === state.player?.target ? [1, 0.72, 0.1] : u.team === 0 ? [0.08, 0.5, 1] : [1, 0.12, 0.2];
  // Ground shadow + selection rings
  part('cyl', [u.x, 0.022, u.z], [0, 0, 0], [0.78, 0.012, 0.78], [0.012, 0.012, 0.016], [0, 0, 0], 0.42);
  part(
    'torus',
    [u.x, 0.07, u.z],
    [0, 0, 0],
    [(u === state.player?.target ? 0.98 : 0.76) * B, 0.05, (u === state.player?.target ? 0.98 : 0.76) * B],
    teamRing,
    hexish(teamRing, 0.42),
    0.88
  );

  // Body proportions: large fantasy torso / smaller waist / strong legs
  const hip = 0.19,
    legSwing = walk * 0.48,
    armSwing = walk * 0.38;
  // thighs and calves are stretched spheres = rounded limbs, not blocks
  part('sphere', lp(-hip, 0.55, 0), [legSwing * 0.55, u.yaw, 0], [0.155, 0.34, 0.155], hexish(col, 0.5));
  part('sphere', lp(hip, 0.55, 0), [-legSwing * 0.55, u.yaw, 0], [0.155, 0.34, 0.155], hexish(col, 0.5));
  part('sphere', lp(-hip, 0.27, 0.025), [-legSwing * 0.32, u.yaw, 0], [0.135, 0.29, 0.135], hexish(col, 0.4));
  part('sphere', lp(hip, 0.27, 0.025), [legSwing * 0.32, u.yaw, 0], [0.135, 0.29, 0.135], hexish(col, 0.4));
  // boots: heel + toe for a more sculpted silhouette
  for (const side of [-1, 1]) {
    part('sphere', lp(side * hip, 0.08, 0.04), [0, u.yaw, 0], [0.17, 0.115, 0.17], dark);
    part('sphere', lp(side * hip, 0.075, 0.18), [0, u.yaw, 0], [0.16, 0.095, 0.25], hexish(dark, 1.35));
  }
  // waist / robe
  if (robed) {
    part('robe', lp(0, 0.78, -0.01), [0, u.yaw, 0], [0.41, 0.43, 0.37], hexish(col, 0.58));
    part('sphere', lp(0, 0.88, 0), [0, u.yaw, 0], [0.34, 0.16, 0.26], hexish(col, 0.73));
  } else {
    part('sphere', lp(0, 0.88, 0), [0, u.yaw, 0], [0.35, 0.19, 0.27], hexish(col, 0.58));
  }
  // belt, buckle, hanging tabard
  part('cyl', lp(0, 0.91, 0), [0, u.yaw, 0], [0.36, 0.045, 0.28], [0.22, 0.13, 0.06]);
  part('sphere', lp(0, 0.92, 0.285), [0, 0, 0], [0.075, 0.065, 0.04], gold, gold, 0.36);
  if (u.cls === 'sentinel' || u.cls === 'oracle' || u.cls === 'reaver')
    part('robe', lp(0, 0.68, 0.22), [0, u.yaw, 0], [0.16, 0.26, 0.055], hexish(acc, 0.72));

  // torso: layered organic chest + breastplate
  part('sphere', lp(0, 1.31, 0), [0, u.yaw, 0], [bulky ? 0.48 : 0.41, 0.49, 0.31], hexish(col, 0.78));
  part('sphere', lp(0, 1.39, 0.18), [0, u.yaw, 0], [bulky ? 0.4 : 0.35, 0.34, 0.21], col);
  // abdomen taper
  part('sphere', lp(0, 1.1, 0.01), [0, u.yaw, 0], [0.31, 0.25, 0.25], hexish(col, 0.62));
  // emblem / gem
  part('sphere', lp(0, 1.43, 0.36), [0, 0, 0], [0.105, 0.125, 0.045], acc, hexish(acc, 0.25), 0.96);

  // cape with shoulder clasp
  if (u.cls !== 'shade') {
    part('robe', lp(0, 1.2, -0.3), [Math.PI, u.yaw, 0], [0.37, 0.49, 0.065], hexish(col, 0.29), [0, 0, 0], 0.94);
    part('sphere', lp(-0.25, 1.57, -0.25), [0, 0, 0], [0.07, 0.07, 0.05], gold);
    part('sphere', lp(0.25, 1.57, -0.25), [0, 0, 0], [0.07, 0.07, 0.05], gold);
  }

  // layered pauldrons: big, Warcraft-like heroic silhouette, original geometry
  const sh = bulky ? 0.36 : u.cls === 'warden' ? 0.33 : 0.29,
    sx = bulky ? 0.55 : 0.51;
  for (const side of [-1, 1]) {
    part('sphere', lp(side * sx, 1.61, -0.01), [0, u.yaw, side * 0.08], [sh, 0.23, sh * 1.04], hexish(col, 1.22));
    part(
      'sphere',
      lp(side * (sx + 0.02), 1.67, 0.015),
      [0, u.yaw, side * 0.14],
      [sh * 0.78, 0.17, sh * 0.86],
      hexish(acc, 0.68)
    );
    if (u.cls === 'sentinel' || u.cls === 'reaver' || u.cls === 'warlock') {
      part(
        'cone',
        lp(side * (sx + 0.08), 1.86, -0.03),
        [side * 0.32, u.yaw, side * 0.24],
        [0.09, 0.22, 0.09],
        acc,
        hexish(acc, 0.32),
        0.9
      );
      part(
        'cone',
        lp(side * (sx + 0.2), 1.73, -0.04),
        [side * 0.72, u.yaw, side * 0.12],
        [0.065, 0.19, 0.065],
        hexish(acc, 0.88)
      );
    }
  }

  // arms: two rounded segments + elbow + oversized gloves/hands
  for (const side of [-1, 1]) {
    const sw = (side < 0 ? armSwing : -armSwing) + (side > 0 ? atk * 0.62 : -atk * 0.15);
    part('sphere', lp(side * 0.49, 1.31, 0.01), [sw, u.yaw, side * 0.04], [0.145, 0.29, 0.145], hexish(col, 0.78));
    part('sphere', lp(side * 0.53, 1.08, 0.07), [sw * 0.55, u.yaw, side * 0.03], [0.13, 0.24, 0.13], hexish(col, 0.58));
    part('sphere', lp(side * 0.52, 1.17, 0.05), [0, 0, 0], [0.145, 0.13, 0.145], hexish(acc, 0.44));
    part('sphere', lp(side * 0.55, 0.86, 0.12), [0, 0, 0], [0.135, 0.13, 0.13], skin);
    if (bulky) part('sphere', lp(side * 0.56, 0.89, 0.12), [0, 0, 0], [0.16, 0.145, 0.15], hexish(col, 0.7));
  }

  // neck, head, jaw, ears
  part('sphere', lp(0, 1.77, 0), [0, u.yaw, 0], [0.13, 0.115, 0.13], skin);
  part('sphere', lp(0, 2.04, 0), [0, u.yaw, 0], [0.27, 0.31, 0.255], skin);
  part('sphere', lp(0, 1.94, 0.13), [0, u.yaw, 0], [0.22, 0.17, 0.15], hexish(skin, 0.94));
  part('sphere', lp(-0.255, 2.04, 0), [0, 0, 0], [0.045, 0.075, 0.035], skin);
  part('sphere', lp(0.255, 2.04, 0), [0, 0, 0], [0.045, 0.075, 0.035], skin);
  // eyes and eyebrows (tiny real geometry)
  part('sphere', lp(-0.085, 2.08, 0.238), [0, 0, 0], [0.035, 0.022, 0.018], [0.8, 0.93, 1], acc, 0.55);
  part('sphere', lp(0.085, 2.08, 0.238), [0, 0, 0], [0.035, 0.022, 0.018], [0.8, 0.93, 1], acc, 0.55);
  part('sphere', lp(-0.085, 2.145, 0.235), [0, 0, 0.12], [0.065, 0.015, 0.012], dark);
  part('sphere', lp(0.085, 2.145, 0.235), [0, 0, -0.12], [0.065, 0.015, 0.012], dark);

  // Hair / helmets / hoods by class
  if (u.cls === 'sentinel') {
    part('sphere', lp(0, 2.13, -0.015), [0, u.yaw, 0], [0.31, 0.24, 0.3], hexish(col, 0.42));
    part('sphere', lp(0, 2.06, 0.23), [0, u.yaw, 0], [0.25, 0.12, 0.08], metal);
    part('cone', lp(0, 2.43, -0.025), [0, u.yaw, 0], [0.065, 0.23, 0.065], acc, acc, 0.72);
    for (const side of [-1, 1])
      part('cone', lp(side * 0.22, 2.28, -0.05), [side * 0.5, u.yaw, 0], [0.045, 0.16, 0.045], gold);
  } else if (u.cls === 'reaver') {
    part('sphere', lp(0, 2.13, -0.02), [0, u.yaw, 0], [0.315, 0.245, 0.31], [0.075, 0.1, 0.15]);
    part('sphere', lp(0, 2.05, 0.22), [0, u.yaw, 0], [0.26, 0.105, 0.08], [0.14, 0.2, 0.26]);
    for (const side of [-1, 1]) {
      part(
        'cone',
        lp(side * 0.19, 2.34, -0.03),
        [side * 0.45, u.yaw, 0],
        [0.085, 0.25, 0.085],
        acc,
        hexish(acc, 0.4),
        0.82
      );
      part('cone', lp(side * 0.29, 2.28, -0.08), [side * 0.8, u.yaw, 0], [0.055, 0.18, 0.055], metal);
    }
  } else if (u.cls === 'shade') {
    // hood + mask + scarf
    part('sphere', lp(0, 2.15, -0.025), [0, u.yaw, 0], [0.32, 0.28, 0.31], hexish(col, 0.35));
    part('sphere', lp(0, 2.02, 0.205), [0, u.yaw, 0], [0.245, 0.12, 0.09], hexish(col, 0.23));
    part('robe', lp(0, 1.82, -0.1), [0, u.yaw, 0], [0.24, 0.23, 0.15], hexish(col, 0.3));
  } else if (u.cls === 'warden') {
    // druid: hair + antler crown
    part('sphere', lp(0, 2.16, -0.05), [0, u.yaw, 0], [0.31, 0.21, 0.3], [0.27, 0.16, 0.07]);
    part('sphere', lp(0, 2.02, -0.2), [0, u.yaw, 0], [0.28, 0.23, 0.12], [0.2, 0.11, 0.05]);
    for (const side of [-1, 1]) {
      part('cone', lp(side * 0.14, 2.39, -0.04), [side * 0.42, u.yaw, 0], [0.045, 0.28, 0.045], [0.31, 0.21, 0.09]);
      part('cone', lp(side * 0.28, 2.47, -0.06), [side * 0.78, u.yaw, 0], [0.035, 0.21, 0.035], [0.31, 0.21, 0.09]);
      part('cone', lp(side * 0.34, 2.34, -0.02), [side * 1.02, u.yaw, 0], [0.03, 0.16, 0.03], [0.31, 0.21, 0.09]);
    }
  } else if (u.cls === 'warlock') {
    part('sphere', lp(0, 2.16, -0.04), [0, u.yaw, 0], [0.32, 0.29, 0.31], hexish(col, 0.3));
    part('sphere', lp(0, 2.02, 0.19), [0, u.yaw, 0], [0.25, 0.12, 0.1], hexish(col, 0.2));
    for (const side of [-1, 1]) {
      part(
        'cone',
        lp(side * 0.17, 2.4, -0.05),
        [side * 0.48, u.yaw, 0],
        [0.075, 0.27, 0.075],
        acc,
        hexish(acc, 0.42),
        0.92
      );
      part(
        'cone',
        lp(side * 0.34, 2.39, -0.08),
        [side * 0.88, u.yaw, 0],
        [0.05, 0.2, 0.05],
        hexish(acc, 0.8),
        hexish(acc, 0.3),
        0.86
      );
    }
  } else if (u.cls === 'oracle') {
    // priest: gold circlet / hood back
    part('sphere', lp(0, 2.16, -0.07), [0, u.yaw, 0], [0.3, 0.2, 0.29], hexish(col, 0.75));
    part('torus', lp(0, 2.16, 0.0), [Math.PI / 2, u.yaw, 0], [0.29, 0.024, 0.29], gold, gold, 0.66);
  } else {
    // mage: elegant hood + white/violet robe accents, inspired by fantasy archmages but original
    part('sphere', lp(0, 2.16, -0.045), [0, u.yaw, 0], [0.31, 0.22, 0.3], [0.42, 0.18, 0.62]);
    part(
      'cone',
      lp(0, 2.38, -0.03),
      [-0.13, u.yaw, 0.08],
      [0.09, 0.26, 0.09],
      [0.3, 0.82, 0.95],
      [0.18, 0.95, 1],
      0.82
    );
    part('robe', lp(0, 1.06, 0.22), [0, u.yaw, 0], [0.22, 0.5, 0.07], [0.88, 0.88, 0.92], [0.75, 0.66, 0.28], 0.95);
    part(
      'robe',
      lp(-0.16, 1.06, 0.18),
      [0, u.yaw, 0.12],
      [0.11, 0.42, 0.05],
      [0.88, 0.88, 0.92],
      [0.75, 0.66, 0.28],
      0.95
    );
    part(
      'robe',
      lp(0.16, 1.06, 0.18),
      [0, u.yaw, -0.12],
      [0.11, 0.42, 0.05],
      [0.88, 0.88, 0.92],
      [0.75, 0.66, 0.28],
      0.95
    );
    part(
      'torus',
      lp(0, 1.48, 0.31),
      [Math.PI / 2, u.yaw, 0],
      [0.15, 0.018, 0.15],
      [0.8, 0.64, 0.24],
      [0.8, 0.64, 0.24],
      0.9
    );
    for (const side of [-1, 1]) {
      part(
        'sphere',
        lp(side * 0.26, 1.56, 0.28),
        [0, 0, 0],
        [0.055, 0.055, 0.03],
        [0.18, 0.8, 0.86],
        [0.18, 0.95, 1],
        0.86
      );
    }
  }

  // Weapons and class identity
  if (u.cls === 'sentinel') {
    // shield with boss + sword
    part('cyl', lp(-0.69, 1.22, 0.19), [Math.PI / 2, u.yaw, 0], [0.39, 0.055, 0.39], [0.15, 0.23, 0.35]);
    part('torus', lp(-0.69, 1.22, 0.2), [Math.PI / 2, u.yaw, 0], [0.31, 0.055, 0.31], gold, hexish(gold, 0.3), 0.86);
    part('sphere', lp(-0.69, 1.22, 0.25), [0, 0, 0], [0.1, 0.1, 0.055], acc, acc, 0.82);
    part('cube', lp(0.68, 1.26, 0.16), [-0.18 + atk * 0.8, u.yaw, 0], [0.045, 0.49, 0.06], metal, [0.08, 0.1, 0.12], 1);
    part('cone', lp(0.68, 1.77, 0.16), [-0.18 + atk * 0.8, u.yaw, 0], [0.07, 0.18, 0.07], metal);
  } else if (u.cls === 'reaver') {
    part('cyl', lp(0.62, 1.17, 0.08), [0.22 - atk * 0.75, u.yaw, 0], [0.06, 0.38, 0.06], [0.18, 0.13, 0.11]);
    part('cube', lp(0.7, 1.62, 0.08), [0.22 - atk * 0.75, u.yaw, 0], [0.085, 0.57, 0.1], [0.27, 0.34, 0.42], acc, 0.32);
    part('cone', lp(0.72, 2.2, 0.08), [0.22 - atk * 0.75, u.yaw, 0], [0.1, 0.22, 0.1], acc, acc, 0.78);
    // runes along blade
    for (const yy of [1.38, 1.57, 1.76])
      part('sphere', lp(0.7, yy, 0.13), [0, 0, 0], [0.027, 0.04, 0.018], acc, acc, 0.92);
  } else if (u.cls === 'shade') {
    for (const side of [-1, 1]) {
      part(
        'cube',
        lp(side * 0.62, 1.02, 0.2),
        [0, u.yaw, side * (0.55 + atk * 0.65)],
        [0.035, 0.3, 0.055],
        metal,
        acc,
        0.18
      );
      part('cone', lp(side * 0.67, 1.31, 0.22), [0, u.yaw, side * 0.65], [0.045, 0.15, 0.045], acc, acc, 0.55);
    }
  } else {
    const staffCol =
      u.cls === 'oracle'
        ? [0.64, 0.48, 0.24]
        : u.cls === 'warden'
          ? [0.25, 0.16, 0.07]
          : u.cls === 'arcanist'
            ? [0.13, 0.54, 0.62]
            : [0.16, 0.1, 0.09];
    part(
      'cyl',
      lp(0.66, 1.25, 0.03),
      [0.36 - atk * 0.35, u.yaw, 0],
      [0.05, u.cls === 'arcanist' ? 0.8 : 0.68, 0.05],
      staffCol
    );
    part(
      'sphere',
      lp(0.78, u.cls === 'arcanist' ? 2.02 : 1.9, 0.05),
      [0, 0, 0],
      [u.cls === 'arcanist' ? 0.12 : 0.17, u.cls === 'arcanist' ? 0.22 : 0.17, u.cls === 'arcanist' ? 0.12 : 0.17],
      acc,
      acc,
      0.95
    );
    if (u.cls === 'oracle') {
      part('torus', lp(0.78, 1.9, 0.05), [Math.PI / 2, 0, 0], [0.27, 0.04, 0.27], gold, gold, 0.82);
      part('sphere', lp(0.78, 1.9, 0.05), [0, 0, 0], [0.09, 0.09, 0.09], [1, 0.97, 0.72], [1, 0.85, 0.3], 0.95);
    }
    if (u.cls === 'warden')
      for (const side of [-1, 1]) {
        part('cone', lp(0.78 + side * 0.11, 2.08, 0.04), [side * 0.47, 0, 0], [0.04, 0.19, 0.04], [0.3, 0.21, 0.08]);
        part(
          'sphere',
          lp(0.78 + side * 0.16, 2.12, 0.04),
          [0, 0, 0],
          [0.055, 0.055, 0.055],
          [0.35, 0.7, 0.18],
          [0.15, 0.5, 0.05],
          0.76
        );
      }
    if (u.cls === 'warlock')
      for (const side of [-1, 1])
        part('cone', lp(0.78 + side * 0.11, 2.06, 0.04), [side * 0.43, 0, 0], [0.045, 0.19, 0.045], acc, acc, 0.8);
    if (u.cls === 'arcanist') {
      part('torus', lp(0.78, 1.9, 0.05), [0, 0, 0], [0.25, 0.035, 0.25], acc, acc, 0.72);
      for (let k = 0; k < 3; k++) {
        const a = now() * 1.5 + k * 2.094;
        part(
          'sphere',
          lp(0.78 + Math.sin(a) * 0.22, 1.9 + Math.cos(a) * 0.08, 0.05 + Math.cos(a) * 0.16),
          [0, 0, 0],
          [0.035, 0.035, 0.035],
          acc,
          acc,
          0.88
        );
      }
    }
  }

  // class auras / combat states
  if (u.cls === 'oracle') part('torus', lp(0, 2.47, 0), [0, 0, 0], [0.35, 0.035, 0.35], gold, gold, 0.46);
  if (u.cls === 'warlock') part('torus', [u.x, y + 0.1, u.z], [0, 0, 0], [0.7, 0.035, 0.7], acc, acc, 0.28);
  if (u.shield > 0)
    part('sphere', lp(0, 1.34, 0), [0, 0, 0], [0.82, 1.14, 0.82], [0.1, 0.42, 1], [0.08, 0.3, 0.8], 0.16);
  if (u.cast) {
    const q = 1 - clamp((u.cast.end - now()) / u.cast.dur, 0, 1);
    part('sphere', lp(0.45, 1.55, 0.18), [0, 0, 0], [0.14 + q * 0.1, 0.14 + q * 0.1, 0.14 + q * 0.1], acc, acc, 0.94);
    part(
      'torus',
      [u.x, y + 0.1, u.z],
      [0, 0, 0],
      [0.64 + q * 0.26, 0.045, 0.64 + q * 0.26],
      acc,
      hexish(acc, 0.55),
      0.58
    );
  }
  if (u.burst > 0)
    part('torus', [u.x, y + 0.1, u.z], [0, 0, 0], [1.06, 0.075, 1.06], [1, 0.28, 0.05], [0.7, 0.13, 0.01], 0.68);
  if (u.stun > 0) {
    for (let k = 0; k < 3; k++) {
      const a = now() * 3 + k * 2.094;
      part(
        'sphere',
        [u.x + Math.sin(a) * 0.45, y + 2.58, u.z + Math.cos(a) * 0.45],
        [0, 0, 0],
        [0.07, 0.07, 0.07],
        [1, 0.78, 0.08],
        [0.8, 0.5, 0.02],
        0.9
      );
    }
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
    if (u.stun > 0) {
      for (let i = 0; i < 4; i++) {
        const a = tt * 3.2 + (i * Math.PI) / 2;
        part(
          'sphere',
          [ux + Math.sin(a) * 0.52, yy + 2.62, uz + Math.cos(a) * 0.52],
          [0, 0, 0],
          [0.085, 0.085, 0.085],
          [1, 0.82, 0.12],
          [1, 0.55, 0.02],
          0.94
        );
      }
      part(
        'torus',
        [ux, yy + 2.58, uz],
        [Math.PI / 2, 0, 0],
        [0.56, 0.045, 0.56],
        [1, 0.75, 0.12],
        [1, 0.45, 0.02],
        0.7
      );
    }
    if (u.silence > 0) {
      part(
        'torus',
        [ux, yy + 2.2, uz],
        [Math.PI / 2, tt * 1.7, 0],
        [0.42, 0.045, 0.42],
        [0.75, 0.52, 1],
        [0.46, 0.12, 1],
        0.78
      );
      part(
        'torus',
        [ux, yy + 1.65, uz],
        [Math.PI / 2, -tt * 1.3, 0],
        [0.52, 0.035, 0.52],
        [0.62, 0.38, 0.95],
        [0.32, 0.05, 0.85],
        0.5
      );
    }
    if (u.fear > 0) {
      part(
        'torus',
        [ux, yy + 2.4, uz],
        [Math.PI / 2, tt * 2.4, 0],
        [0.6, 0.055, 0.6],
        [0.62, 0.2, 0.95],
        [0.42, 0.02, 0.9],
        0.86
      );
      for (let i = 0; i < 3; i++) {
        const a = tt * 2.8 + i * 2.094;
        part(
          'sphere',
          [ux + Math.sin(a) * 0.45, yy + 2.25 + Math.sin(a * 2) * 0.18, uz + Math.cos(a) * 0.45],
          [0, 0, 0],
          [0.11, 0.07, 0.06],
          [0.75, 0.3, 1],
          [0.55, 0.05, 0.95],
          0.9
        );
      }
    }
    if (u.slow > 0) {
      part('torus', [ux, 0.07, uz], [0, 0, 0], [0.7, 0.035, 0.7], [0.35, 0.72, 1], [0.05, 0.32, 0.88], 0.42);
    }
  }
}
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
      ArenaEnv.init(THREE, $('env3d'), arena, { mobile: document.body.classList.contains('mobile-mode') })
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
function renderFx() {
  if (!state) return;
  for (const f of state.fx) {
    if (f.fx3d) continue; // dessiné par effects.js
    const k = clamp(f.life / f.max, 0, 1),
      t = 1 - k,
      grow = f.size * (1.65 - k * 0.65),
      em = hexish(f.color, 0.75);
    const P = (x, y, z, sz = 0.08, a = 0.9) => part('sphere', [x, y, z], [0, 0, 0], [sz, sz, sz], f.color, em, a),
      G = (name, p, r, s, a = 0.38) => glowPart(name, p, r, s, f.color, a);
    if (f.type === 'ring') {
      part('torus', [f.x, f.y, f.z], [0, 0, 0], [grow, 0.06, grow], f.color, hexish(f.color, 0.55), k * 0.7);
      G('torus', [f.x, f.y + 0.01, f.z], [0, 0, 0], [grow * 1.08, 0.1, grow * 1.08], k * 0.24);
    } else if (f.type === 'arcaneProjectile' || f.type === 'shadowProjectile' || f.type === 'projectile') {
      if (!f.to) continue;
      for (let j = 0; j < 6; j++) {
        const q = clamp(t - j * 0.055, 0, 1),
          x = lerp(f.from[0], f.to[0], q),
          y = lerp(f.from[1], f.to[1], q) + Math.sin(q * Math.PI) * 0.22,
          z = lerp(f.from[2], f.to[2], q),
          sz = f.size * (1 - j * 0.1);
        P(x, y, z, sz, k * (0.95 - j * 0.1));
      }
      const q = t,
        x = lerp(f.from[0], f.to[0], q),
        y = lerp(f.from[1], f.to[1], q) + Math.sin(q * Math.PI) * 0.22,
        z = lerp(f.from[2], f.to[2], q);
      part('torus', [x, y, z], [Math.PI / 2, 0, 0], [f.size * 1.25, 0.035, f.size * 1.25], f.color, em, 0.75 * k);
      G('sphere', [x, y, z], [0, 0, 0], [f.size * 1.9, f.size * 1.9, f.size * 1.9], k * 0.3);
      G('sphere', [x, y, z], [0, 0, 0], [f.size * 0.72, f.size * 0.72, f.size * 0.72], k * 0.7);
      if (t > 0.72) {
        const hit = (t - 0.72) / 0.28,
          tx = f.to[0],
          ty = f.to[1],
          tz = f.to[2];
        G(
          'sphere',
          [tx, ty, tz],
          [0, 0, 0],
          [f.size * (1.2 + hit * 2.1), f.size * (1.2 + hit * 2.1), f.size * (1.2 + hit * 2.1)],
          (1 - hit) * 0.44
        );
        G(
          'torus',
          [tx, ty, tz],
          [Math.PI / 2, hit * 3, 0],
          [f.size * (0.8 + hit * 2.2), 0.08, f.size * (0.8 + hit * 2.2)],
          (1 - hit) * 0.52
        );
      }
    } else if (f.type === 'healBeam' || f.type === 'chain' || f.type === 'trail') {
      if (!f.to) continue;
      const n = f.type === 'chain' ? 9 : 7;
      for (let j = 0; j < n; j++) {
        const q = j / (n - 1),
          x = lerp(f.from[0], f.to[0], q),
          y =
            lerp(f.from[1], f.to[1], q) +
            (f.type === 'chain' ? Math.sin(q * Math.PI * 4) * 0.06 : Math.sin(q * Math.PI) * 0.12),
          z = lerp(f.from[2], f.to[2], q);
        P(x, y, z, f.size * (f.type === 'chain' ? 0.55 : 1 - q * 0.35), k * (0.35 + 0.55 * (1 - q)));
      }
    } else if (f.type === 'slash') {
      for (let j = 0; j < 3; j++)
        part(
          'torus',
          [f.x, f.y + j * 0.11, f.z],
          [Math.PI / 2, 0.5 + j * 0.28, 0.55],
          [grow * (0.72 + j * 0.12), 0.035, grow * (0.72 + j * 0.12)],
          f.color,
          em,
          k * (0.8 - j * 0.15)
        );
    } else if (
      f.type === 'nova' ||
      f.type === 'holyBurst' ||
      f.type === 'frostAura' ||
      f.type === 'aura' ||
      f.type === 'darkAura'
    ) {
      const mult = f.type === 'nova' ? 1.8 : f.type === 'holyBurst' ? 2.0 : 1.35;
      part('torus', [f.x, f.y, f.z], [0, 0, 0], [grow * mult, 0.055, grow * mult], f.color, em, k * 0.72);
      G('torus', [f.x, f.y + 0.02, f.z], [0, 0, 0], [grow * mult * 1.04, 0.12, grow * mult * 1.04], k * 0.28);
      part(
        'torus',
        [f.x, f.y + 0.18 + t * 0.9, f.z],
        [0, 0, 0],
        [grow * (0.65 + t * 0.25), 0.035, grow * (0.65 + t * 0.25)],
        f.color,
        em,
        k * 0.48
      );
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4 + t * 1.8;
        P(
          f.x + Math.sin(a) * grow * (0.5 + t),
          f.y + 0.25 + Math.sin(a * 2 + t * 5) * 0.25,
          f.z + Math.cos(a) * grow * (0.5 + t),
          0.045 + 0.025 * k,
          k * 0.65
        );
      }
    } else if (f.type === 'shield' || f.type === 'cloak') {
      part(
        'sphere',
        [f.x, f.y, f.z],
        [0, 0, 0],
        [grow, grow * 1.28, grow],
        f.color,
        em,
        k * (f.type === 'cloak' ? 0.18 : 0.25)
      );
      G(
        'sphere',
        [f.x, f.y, f.z],
        [0, 0, 0],
        [grow * 1.06, grow * 1.34, grow * 1.06],
        k * (f.type === 'cloak' ? 0.1 : 0.18)
      );
      for (let j = 0; j < 3; j++)
        part(
          'torus',
          [f.x, f.y - 0.55 + j * 0.5, f.z],
          [0, 0, 0],
          [grow * (0.75 + j * 0.08), 0.025, grow * (0.75 + j * 0.08)],
          f.color,
          em,
          k * 0.55
        );
    } else if (f.type === 'roots' || f.type === 'snare') {
      part('torus', [f.x, 0.08, f.z], [0, 0, 0], [grow, 0.05, grow], f.color, em, k * 0.75);
      for (let j = 0; j < 7; j++) {
        const a = j * 0.9 + t * 0.4;
        part(
          'cone',
          [f.x + Math.sin(a) * grow * 0.65, 0.18 + grow * 0.16, f.z + Math.cos(a) * grow * 0.65],
          [Math.sin(a) * 0.35, -a, Math.cos(a) * 0.35],
          [0.04, 0.22 + grow * 0.18, 0.04],
          f.color,
          em,
          k * 0.9
        );
      }
    } else if (f.type === 'silence' || f.type === 'fear' || f.type === 'stun') {
      part('torus', [f.x, f.y, f.z], [Math.PI / 2, 0, t * 4], [grow, 0.05, grow], f.color, em, k * 0.8);
      part(
        'torus',
        [f.x, f.y + 0.28, f.z],
        [Math.PI / 2, 1.57, -t * 3],
        [grow * 0.72, 0.035, grow * 0.72],
        f.color,
        em,
        k * 0.55
      );
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2 + t * 5;
        P(
          f.x + Math.sin(a) * grow * 0.7,
          f.y + 0.35 + Math.sin(a * 2) * 0.18,
          f.z + Math.cos(a) * grow * 0.7,
          0.065,
          k * 0.85
        );
      }
    } else if (f.type === 'castArcane' || f.type === 'castShadow' || f.type === 'healCast') {
      part('torus', [f.x, 0.1, f.z], [0, 0, 0], [grow, 0.04, grow], f.color, em, k * 0.65);
      G('torus', [f.x, 0.11, f.z], [0, 0, 0], [grow * 1.1, 0.1, grow * 1.1], k * 0.32);
      G('sphere', [f.x, f.y + 0.15, f.z], [0, 0, 0], [grow * 0.5, grow * 0.5, grow * 0.5], k * 0.16);
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3 - t * 5,
          r = 0.35 + 0.32 * t;
        P(f.x + Math.sin(a) * r, f.y + Math.sin(a * 2 + t * 4) * 0.2, f.z + Math.cos(a) * r, 0.055, k * 0.75);
      }
    } else if (f.type === 'arcaneImpact' || f.type === 'shadowImpact') {
      G('sphere', [f.x, f.y, f.z], [0, 0, 0], [grow * 1.35, grow * 1.35, grow * 1.35], k * 0.42);
      G('torus', [f.x, f.y, f.z], [Math.PI / 2, t * 3, 0], [grow * 1.15, 0.11, grow * 1.15], k * 0.48);
      G('torus', [f.x, f.y, f.z], [0, t * 2, Math.PI / 2], [grow * 0.82, 0.08, grow * 0.82], k * 0.38);
      for (let j = 0; j < 5; j++) {
        const a = j * 1.256 + t * 2.4;
        P(
          f.x + Math.sin(a) * grow * (0.55 + t),
          f.y + (j - 2) * 0.1 + t * 0.35,
          f.z + Math.cos(a) * grow * (0.55 + t),
          0.055,
          k * 0.8
        );
      }
    } else if (f.type === 'blinkBurst') {
      G('sphere', [f.x, f.y, f.z], [0, 0, 0], [grow * 1.65, grow * 1.9, grow * 1.65], k * 0.34);
      for (let j = 0; j < 3; j++) {
        const a = t * 6 + j * 2.094;
        G(
          'torus',
          [f.x, f.y + (j - 1) * 0.18, f.z],
          [Math.PI / 2, a, a * 0.45],
          [grow * (0.62 + j * 0.14), 0.08, grow * (0.62 + j * 0.14)],
          k * 0.46
        );
      }
      for (let j = 0; j < 7; j++) {
        const a = j * 0.897 + t * 3;
        P(
          f.x + Math.sin(a) * grow * 0.85,
          f.y + ((j % 3) - 0.7) * 0.22,
          f.z + Math.cos(a) * grow * 0.85,
          0.045,
          k * 0.75
        );
      }
    } else if (f.type === 'blinkRibbon') {
      if (!f.to) continue;
      for (let j = 0; j < 9; j++) {
        const q = j / 8,
          x = lerp(f.from[0], f.to[0], q),
          y = lerp(f.from[1], f.to[1], q) + Math.sin(q * Math.PI) * 0.18,
          z = lerp(f.from[2], f.to[2], q);
        G(
          'sphere',
          [x, y, z],
          [0, 0, 0],
          [f.size * (1.1 - q * 0.45), f.size * (1.1 - q * 0.45), f.size * (1.1 - q * 0.45)],
          k * (0.22 + 0.28 * (1 - q))
        );
      }
    } else if (f.type === 'chargeStart' || f.type === 'chargeImpact') {
      G('torus', [f.x, 0.1, f.z], [0, 0, 0], [grow * 1.35, 0.12, grow * 1.35], k * 0.4);
      G('sphere', [f.x, f.y, f.z], [0, 0, 0], [grow * 0.85, grow * 0.85, grow * 0.85], k * 0.24);
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3 + t * 4;
        P(
          f.x + Math.sin(a) * grow * 0.7,
          f.y + 0.15 + Math.sin(a * 2) * 0.18,
          f.z + Math.cos(a) * grow * 0.7,
          0.05,
          k * 0.7
        );
      }
    } else if (f.type === 'chargeTrail') {
      if (!f.to) continue;
      for (let j = 0; j < 4; j++) {
        const q = j / 3,
          x = lerp(f.from[0], f.to[0], q),
          y = lerp(f.from[1], f.to[1], q),
          z = lerp(f.from[2], f.to[2], q);
        G(
          'sphere',
          [x, y, z],
          [0, 0, 0],
          [f.size * (1 - q * 0.35), f.size * (1 - q * 0.35), f.size * (1 - q * 0.35)],
          k * 0.26
        );
      }
    } else if (f.type === 'starfall') {
      for (let j = 0; j < 6; j++) {
        const a = j * 2.399 + (f.extra?.seed || 0),
          r = 0.6 + (j % 3) * 0.55,
          drop = (t * 2.2 + j * 0.17) % 1;
        P(f.x + Math.sin(a) * r, 0.35 + (1 - drop) * 3.2, f.z + Math.cos(a) * r, 0.09 + drop * 0.05, k * 0.9);
        part(
          'torus',
          [f.x + Math.sin(a) * r, 0.06, f.z + Math.cos(a) * r],
          [0, 0, 0],
          [0.16 + drop * 0.2, 0.025, 0.16 + drop * 0.2],
          f.color,
          em,
          k * 0.35
        );
      }
    } else part('sphere', [f.x, f.y, f.z], [0, 0, 0], [grow, grow, grow], f.color, hexish(f.color, 0.7), k * 0.55);
  }
}
// Positions affichées = interpolation entre les deux derniers pas de simulation (120 Hz) : caméra, décor, noms et marqueurs
// suivent exactement les modèles, sans à-coups quand le nombre de pas varie d'une image à l'autre.
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
    ArenaEnv.render(camPos, [p.rx ?? p.x, (p.ry ?? p.y ?? 0) + 1.25, p.rz ?? p.z], state?.units, r.width, r.height);
  }
  if (typeof renderArena !== 'function') throw Error('renderArena manquant');
  renderArena();
  renderPersistentCC();
  const hfOn = hfEnsureInit();
  if (state?.units)
    for (const u of state.units) {
      const rec = hfOn ? HF.records.get(u.id) : null;
      if (!hfOn || (rec && rec.failed)) renderCharacter(u);
    }
  renderFx();
  renderOverlayWorld();
  if (hfOn) hfRender();
}
function projectScreen(x, y, z) {
  if (!viewProj) return null;
  const q = tf(viewProj, [x, y, z, 1]);
  if (q[3] <= 0.01) return null;
  const nx = q[0] / q[3],
    ny = q[1] / q[3];
  return { x: (nx * 0.5 + 0.5) * canvas.clientWidth, y: (1 - (ny * 0.5 + 0.5)) * canvas.clientHeight, z: q[2] / q[3] };
}
// Noms et chiffres flottants : éléments réutilisés et déplacés par transform (pas de reconstruction HTML à chaque image).
const OVERLAY = { plates: new Map(), floaters: [] };
function renderOverlayWorld() {
  if (!state) return;
  const np = $('nameplates'),
    W = canvas.clientWidth,
    H = canvas.clientHeight,
    seen = new Set();
  for (const u of state.units) {
    let e = OVERLAY.plates.get(u);
    if (!e) {
      e = document.createElement('div');
      e.className = 'nameplate';
      e.innerHTML =
        '<div class="npName"></div><div class="npBar"><div class="npFill"></div></div><div class="npCast"><span class="npIcon"></span><div class="npTrack"><div></div><span></span></div></div>';
      e.style.left = e.style.top = '0';
      np.appendChild(e);
      e._name = e.firstChild;
      e._fill = e.children[1].firstChild;
      e._cast = e.children[2];
      e._castIcon = e._cast.firstChild;
      e._castFill = e._cast.lastChild.firstChild;
      e._castName = e._cast.lastChild.lastChild;
      e._k = {};
      OVERLAY.plates.set(u, e);
    }
    seen.add(u);
    const p =
        u.alive && !(u.stealth && u.team !== state.player.team)
          ? projectScreen(u.rx ?? u.x, (u.ry ?? u.y ?? 0) + 2.65, u.rz ?? u.z)
          : null,
      vis = !!p && p.x > -60 && p.x < W + 60 && p.y > -30 && p.y < H + 30;
    if (e._k.vis !== vis) {
      e.style.display = vis ? '' : 'none';
      e._k.vis = vis;
    }
    if (!vis) continue;
    e.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-100%)`;
    if (e._k.name !== u.name) {
      e._name.textContent = u.name;
      e._k.name = u.name;
    }
    const w = ((100 * u.hp) / u.maxHp).toFixed(1);
    if (e._k.w !== w) {
      e._fill.style.width = w + '%';
      e._k.w = w;
    }
    const c = u.team === 0 ? '#58c3ff' : '#ff6976';
    if (e._k.c !== c) {
      e._fill.style.background = c;
      e._k.c = c;
    }
    const t = u === state.player.target;
    if (e._k.t !== t) {
      e.classList.toggle('target', t);
      e._k.t = t;
    }
    const cs = !!u.cast;
    if (e._k.cs !== cs) {
      e._cast.style.display = cs ? 'flex' : 'none';
      e._k.cs = cs;
    }
    if (cs) {
      const ck = u.cls + ':' + u.cast.i;
      if (e._k.ck !== ck) {
        e._castIcon.innerHTML = skillIconSVG(u.cls, u.cast.i ?? 0);
        e._castName.textContent = u.cast.name;
        e._k.ck = ck;
      }
    }
    if (cs) e._castFill.style.width = (clamp(1 - (u.cast.end - now()) / u.cast.dur, 0, 1) * 100).toFixed(1) + '%';
  }
  for (const [u, e] of OVERLAY.plates)
    if (!seen.has(u)) {
      e.remove();
      OVERLAY.plates.delete(u);
    }
  const fl = $('floaters'),
    pool = OVERLAY.floaters;
  let n = 0;
  for (const f of state.floaters) {
    const p = projectScreen(f.x + f.off, f.y, f.z);
    if (!p) continue;
    let e = pool[n];
    if (!e) {
      e = document.createElement('div');
      e.className = 'floater';
      e.style.left = e.style.top = '0';
      fl.appendChild(e);
      e._k = {};
      pool.push(e);
    }
    n++;
    if (e._k.vis !== true) {
      e.style.display = '';
      e._k.vis = true;
    }
    e.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%)`;
    e.style.opacity = clamp(f.life / f.max, 0, 1).toFixed(2);
    if (e._k.text !== f.text) {
      e.textContent = f.text;
      e._k.text = f.text;
    }
    if (e._k.color !== f.color) {
      e.style.color = f.color;
      e._k.color = f.color;
    }
  }
  for (let i = n; i < pool.length; i++)
    if (pool[i]._k.vis !== false) {
      pool[i].style.display = 'none';
      pool[i]._k.vis = false;
    }
}
