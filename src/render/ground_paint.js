'use strict';
// Sol peint (06/11/2026, style des arènes peintes à la main) : une texture posée sur tout le sol de l'arène qui
// multiplie sa couleur. Lumière et ombre « peintes » une fois pour toutes : ombre de contact au pied des remparts, des
// piliers et rochers (arena.pillars), grandes taches chaudes / froides, centre plus clair, halos chauds des braseros,
// fissures et taches. Chaque carte (map_<id>.js) appelle ArenaEnv.helpers.groundPaint et colle paint.decl / paint.apply
// dans le shader de son sol (variable vWXZ = position monde xz). Règle pure, testée : groundShadeAt.
(function () {
  if (!window.ArenaEnv?.helpers) return;
  const { canvas, tex, noise2, rng, clamp, smooth } = ArenaEnv.helpers;
  const MARGIN = 16, // m peints au-delà des remparts (sol vu par-dessus les murs, sable de The Bridge)
    WALL_AO = 0.5, // assombrissement au pied d'un rempart
    WALL_FALL = 2.4, // m : distance où l'ombre de contact retombe à 37 %
    PILLAR_AO = 0.6,
    POST_AO = 0.3, // obstacles minces (los: false) : ombre légère
    LOW_RES = 4,
    COOL = [0.82, 0.9, 1.12],
    WARM = [1.16, 1.0, 0.8];

  // Ombre de contact au pied des murs d'une salle de départ (repère de la salle : roomFrame, data/maps.js).
  function roomShade(arena, x, z) {
    for (const r of arena.rooms || []) {
      const { a, b } = roomFrame(r, x, z),
        sa = r.side * a,
        front = r.half + r.wall,
        d = Math.min(front + r.depth - sa, r.halfW - Math.abs(b - r.at), sa - front);
      if (d > 0 && sa > front) return 1 - WALL_AO * Math.exp(-d / WALL_FALL);
    }
    return 1;
  }
  // Multiplicateur [r, g, b] du sol en (x, z) (1 = couleur de la texture). opt.lights : [{ x, z, r, c: [r,g,b], k }],
  // opt.shade(x, z) : ombre propre à la carte (0..1, 1 = rien).
  function groundShadeAt(arena, x, z, opt = {}) {
    const dw = Math.min(arena.halfX - Math.abs(x), arena.halfZ - Math.abs(z));
    let ao = 1 - WALL_AO * Math.exp(-Math.abs(dw) / WALL_FALL); // des deux côtés du rempart
    for (const p of arena.pillars || []) {
      const d = Math.max(0, Math.hypot(x - p.x, z - p.z) - p.r);
      ao *= 1 - (p.los === false ? POST_AO : PILLAR_AO) * Math.exp(-d / (0.8 + 0.6 * p.r));
    }
    ao *= roomShade(arena, x, z);
    if (opt.shade) ao *= opt.shade(x, z);
    const t = smooth(0.32, 0.68, noise2(x * 0.045 + 3, z * 0.045 + 7, 256, 3)),
      v = 0.86 + 0.28 * noise2(x * 0.18 + 1, z * 0.18 + 2, 256, 2),
      e = Math.min(1, Math.max(Math.abs(x) / arena.halfX, Math.abs(z) / arena.halfZ)),
      focus = 1.1 - 0.2 * e * e,
      k = v * focus * ao;
    const out = [0, 1, 2].map(i => (COOL[i] + (WARM[i] - COOL[i]) * t) * k);
    for (const L of opt.lights || []) {
      const f = Math.exp(-((Math.hypot(x - L.x, z - L.z) / L.r) ** 2));
      for (let i = 0; i < 3; i++) out[i] += L.c[i] * L.k * f;
    }
    return out;
  }

  // Fissures : traits brisés sombres, bord clair ébréché (à l'échelle px du canevas).
  function drawCracks(g, r, n, toPx, ok, ppm) {
    for (let c = 0; c < n; c++) {
      const x = (r() * 2 - 1) * 0.92,
        z = (r() * 2 - 1) * 0.92,
        [x0, z0] = ok.at(x, z);
      if (!ok.fn(x0, z0)) continue;
      let px = toPx(x0, z0),
        a = r() * Math.PI * 2;
      const seg = 3 + Math.floor(r() * 5),
        pts = [px];
      for (let s = 0; s < seg; s++) {
        a += (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7); // brisures anguleuses
        const L = (0.15 + r() * 0.3) * ppm;
        px = [px[0] + Math.cos(a) * L, px[1] + Math.sin(a) * L];
        pts.push(px);
      }
      for (const [col, w, off] of [
        ['rgba(255,236,210,0.3)', 0.08, 0.06],
        ['rgba(36,30,34,0.75)', 0.08, 0]
      ]) {
        g.strokeStyle = col;
        g.lineWidth = Math.max(1, w * ppm);
        g.beginPath();
        pts.forEach(([u, v], i) => (i ? g.lineTo(u + off * ppm, v + off * ppm) : g.moveTo(u, v)));
        g.stroke();
      }
    }
  }
  // Taches douces (mousse, terre, sable plus sombre) : disques flous.
  function drawStains(g, r, n, toPx, ok, ppm, colors) {
    for (let c = 0; c < n; c++) {
      const [x, z] = ok.at((r() * 2 - 1) * 0.95, (r() * 2 - 1) * 0.95);
      if (!ok.fn(x, z)) continue;
      const [u, v] = toPx(x, z),
        R = (1.5 + r() * 3) * ppm,
        gr = g.createRadialGradient(u, v, 0, u, v, R);
      gr.addColorStop(0, colors[c % colors.length]);
      gr.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = gr;
      g.fillRect(u - R, v - R, R * 2, R * 2);
    }
  }

  // Texture peinte + morceaux de shader. opt : lights, shade, cracks (nombre), crackOK(x, z), stains (nombre),
  // stainOK(x, z), stainColors (rgba, 128 = neutre), size (px de large), seed.
  function groundPaint(THREE, arena, opt = {}) {
    const rx = arena.halfX + MARGIN,
      rz = arena.halfZ + MARGIN,
      W = opt.size || 1024,
      H = Math.round((W * rz) / rx),
      ppm = W / (2 * rx),
      c = canvas(W, H),
      g = c.getContext('2d');
    // lumière et ombres douces calculées à 1/LOW_RES de la résolution puis agrandies en lissant (1,8 s → ~0,1 s sur
    // The Bridge, 33 obstacles) ; fissures et taches dessinées ensuite à pleine résolution
    const w = Math.ceil(W / LOW_RES),
      h = Math.ceil(H / LOW_RES),
      low = canvas(w, h),
      lg = low.getContext('2d'),
      img = lg.createImageData(w, h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const m = groundShadeAt(arena, ((i + 0.5) / w) * 2 * rx - rx, ((j + 0.5) / h) * 2 * rz - rz, opt),
          o = (j * w + i) * 4;
        for (let k = 0; k < 3; k++) img.data[o + k] = clamp(m[k] * 127.5, 0, 255);
        img.data[o + 3] = 255;
      }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(low, 0, 0, W, H);
    low.width = low.height = 1; // mémoire des canevas limitée sur iOS (voir tex, environment.js)
    const r = rng(opt.seed || 99),
      toPx = (x, z) => [(x + rx) * ppm, (z + rz) * ppm],
      inside = (fx, fz) => [fx * arena.halfX, fz * arena.halfZ];
    if (opt.stains)
      drawStains(g, r, opt.stains, toPx, { at: inside, fn: opt.stainOK || (() => true) }, ppm, opt.stainColors);
    if (opt.cracks) drawCracks(g, r, opt.cracks, toPx, { at: inside, fn: opt.crackOK || (() => true) }, ppm);
    const t = tex(THREE, c, false, false);
    t.flipY = false; // ligne 0 du canevas = z le plus petit
    return {
      uniforms: {
        paintMap: { value: t },
        paintRect: { value: new THREE.Vector4(-rx, -rz, 2 * rx, 2 * rz) }
      },
      decl: 'uniform sampler2D paintMap;uniform vec4 paintRect;',
      // multiplie (0.5 = neutre), puis désature un peu le sol : les personnages ressortent
      apply: `diffuseColor.rgb*=texture2D(paintMap,clamp((vWXZ-paintRect.xy)/paintRect.zw,0.,1.)).rgb*2.;
        {float gl=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=mix(vec3(gl),diffuseColor.rgb,.88);}`
    };
  }
  Object.assign(ArenaEnv.helpers, { groundPaint, groundShadeAt });
})();
