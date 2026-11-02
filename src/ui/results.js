'use strict';
// Écran de fin de match (design de l'utilisateur, src/ui/results.css) : tout ce qui brille est vivant.
// Canevas par-dessus le panneau (mélange additif) : flammes des deux torches du cadre, étincelles dorées qui
// montent autour du cadre (victoire) ou braises rouges (défaite) ; la lueur du cadre respire (CSS).
// Torches : base de la flamme dans l'image du cadre (pixels de l'image ; w = largeur du cadre, fo = décalage du
// cadre sous le bandeau, mêmes valeurs que results.css).
const RESULT_FRAMES = {
  win: {
    w: 896,
    fo: 150,
    torches: [
      [38, 172],
      [858, 172]
    ],
    spark: [255, 214, 120]
  },
  loss: {
    w: 726,
    fo: 112,
    torches: [
      [18, 172],
      [705, 172]
    ],
    spark: [255, 90, 40]
  }
};
const RESULTS_FX = { raf: 0, parts: [], kind: null };
function resultsFxStart(win) {
  resultsFxStop();
  const box = $('results'),
    c = $('resultsFx'),
    panel = box.querySelector('.resPanel');
  if (!c || !panel || MOBILE.enabled) return;
  const g = c.getContext('2d'),
    F = RESULT_FRAMES[win ? 'win' : 'loss'],
    parts = (RESULTS_FX.parts = []);
  RESULTS_FX.kind = win ? 'win' : 'loss';
  let last = performance.now();
  const frame = tNow => {
    RESULTS_FX.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (tNow - last) / 1000);
    last = tNow;
    const W = (c.width = box.clientWidth),
      H = (c.height = box.clientHeight),
      br = box.getBoundingClientRect(),
      pr = panel.getBoundingClientRect(),
      u = pr.width / F.w,
      ox = pr.left - br.left,
      oy = pr.top - br.top + F.fo * u; // haut du cadre (sous le bandeau)
    // flammes des torches
    for (const [tx, ty] of F.torches)
      for (let k = 0; k < 3; k++)
        parts.push({
          fire: true,
          x: ox + tx * u + (Math.random() - 0.5) * 12 * u,
          y: oy + ty * u,
          bx: ox + tx * u,
          vx: (Math.random() - 0.5) * 8 * u,
          vy: -(55 + Math.random() * 45) * u,
          life: 0,
          max: 0.45 + Math.random() * 0.35,
          r: (5 + Math.random() * 5) * u,
          ph: Math.random() * 6.28
        });
    // étincelles (victoire) ou braises (défaite) qui montent autour du cadre
    if (Math.random() < dt * (win ? 26 : 18)) {
      const side = Math.random(),
        edge = side < 0.5 ? (side < 0.25 ? pr.left : pr.right) : pr.left + Math.random() * pr.width;
      parts.push({
        x: edge - br.left + (Math.random() - 0.5) * 40 * u,
        y: side < 0.5 ? oy + Math.random() * pr.height : oy + pr.height - Math.random() * 30 * u,
        vx: (Math.random() - 0.5) * 18 * u,
        vy: -(14 + Math.random() * 26) * u,
        life: 0,
        max: 1.6 + Math.random() * 1.6,
        r: (1.2 + Math.random() * 1.8) * u,
        ph: Math.random() * 6.28
      });
    }
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) {
        parts.splice(i, 1);
        continue;
      }
      const k = p.life / p.max;
      if (p.fire) {
        p.vx += (p.bx - p.x) * 6 * dt; // la flamme se resserre vers le haut
        p.x += (p.vx + Math.sin(tNow / 110 + p.ph) * 6 * u) * dt;
        p.y += p.vy * dt;
        const r = p.r * (1 - k * 0.7),
          col = k < 0.2 ? [255, 230, 160] : k < 0.55 ? [255, 150, 40] : [220, 60, 14],
          a = (k < 0.15 ? k / 0.15 : 1 - k) * 0.32,
          pg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        pg.addColorStop(0, `rgba(${col},${a})`);
        pg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = pg;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      } else {
        p.x += (p.vx + Math.sin(tNow / 400 + p.ph) * 8 * u) * dt;
        p.y += p.vy * dt;
        const a = Math.sin(Math.PI * k) * (0.55 + 0.45 * Math.sin(tNow / 90 + p.ph)),
          r = p.r * 3;
        const pg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        pg.addColorStop(0, `rgba(255,250,225,${a})`);
        pg.addColorStop(0.3, `rgba(${F.spark},${a * 0.7})`);
        pg.addColorStop(1, `rgba(${F.spark},0)`);
        g.fillStyle = pg;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }
  };
  RESULTS_FX.raf = requestAnimationFrame(frame);
}
function resultsFxStop() {
  cancelAnimationFrame(RESULTS_FX.raf);
  RESULTS_FX.raf = 0;
  RESULTS_FX.parts = [];
}
