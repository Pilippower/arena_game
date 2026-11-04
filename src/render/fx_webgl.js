'use strict';
// Effets de sorts du moteur WebGL historique (types non gérés par render/effects.js).
function renderFx() {
  if (!state) return;
  for (const f of state.fx) {
    if (f.fx3d) continue; // dessiné par effects.js
    fxAim(f); // projectile qui suit sa cible
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
