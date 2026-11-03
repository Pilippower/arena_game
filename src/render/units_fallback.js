'use strict';
// Personnages de secours dessinés par le moteur WebGL historique (si le modèle three.js n'est pas disponible).
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
  const teamRing =
    u === state.player?.target ? [1, 0.72, 0.1] : u.team === state.player?.team ? [0.08, 0.5, 1] : [1, 0.12, 0.2]; // couleurs relatives au joueur (en ligne : équipe 1)
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
  if (u.stun > 0) stunSwirl(u.x, y + 2.55, u.z, now());
}
// Étourdissement : tourbillon (deux bras en spirale qui tournent, petites étoiles au bout).
// Étourdissement : deux cercles jaunes lumineux au-dessus de la tête (anneaux continus, pas de bulles) qui
// tournent en sens contraire et pulsent ; un éclat plus vif court sur chaque anneau.
