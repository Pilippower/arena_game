'use strict';
// Lobby (design de l'utilisateur, docs/SPEC.md) : images découpées de sa maquette par tools/build_lobby_assets.js.
// body.lobby suit la visibilité de #overlay : les barres du haut et du bas prennent alors le décor du lobby.
function lobbyCardArt(kind, key) {
  return `<img class="cardArt" src="assets/ui/lobby/${kind}_${key}.webp" alt="">`;
}
// Vasques des torches dans wall_l / wall_r (images de 690 px de haut, calées en hauteur sur #overlay) :
// x = centre de la vasque dans l'image, y = bord de la vasque. Les flammes figées y ont été effacées.
const LOBBY_WALL = { h: 690, rw: 328 };
const TORCHES = [
  { side: 'l', x: 137, y: 380 },
  { side: 'r', x: 192, y: 380 }
];
// Feu animé : particules additives qui montent, ondulent et passent du blanc-jaune au rouge.
function lobbyTorches(ov) {
  const fires = TORCHES.map(t => {
    const c = document.createElement('canvas');
    c.className = 'torchFire';
    c.setAttribute('aria-hidden', 'true');
    ov.prepend(c);
    return { t, c, g: c.getContext('2d'), parts: [], s: 1 };
  });
  const place = () => {
    const H = ov.clientHeight,
      W = ov.clientWidth,
      s = H / LOBBY_WALL.h;
    for (const f of fires) {
      const w = 130 * s,
        h = 190 * s,
        bx = f.t.side === 'l' ? f.t.x * s : W - (LOBBY_WALL.rw - f.t.x) * s;
      Object.assign(f.c.style, {
        left: bx - w / 2 + 'px',
        top: f.t.y * s - h + 8 * s + 'px',
        width: w + 'px',
        height: h + 'px'
      });
      f.c.width = Math.max(1, Math.round(w));
      f.c.height = Math.max(1, Math.round(h));
      f.s = s;
    }
  };
  new ResizeObserver(place).observe(ov);
  let last = performance.now();
  const frame = tNow => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (tNow - last) / 1000);
    last = tNow;
    if (!document.body.classList.contains('lobby') || !ov.clientHeight) return;
    for (const f of fires) {
      const { g, c, s, parts } = f,
        w = c.width,
        h = c.height,
        bx = w / 2,
        by = h - 10 * s;
      for (let k = 0; k < 6; k++)
        parts.push({
          x: bx + (Math.random() - 0.5) * 46 * s,
          y: by - Math.random() * 6 * s,
          vx: (Math.random() - 0.5) * 14 * s,
          vy: -(110 + Math.random() * 80) * s,
          life: 0,
          max: 0.6 + Math.random() * 0.5,
          r: (9 + Math.random() * 9) * s,
          ph: Math.random() * 6.28
        });
      g.clearRect(0, 0, w, h);
      // lueur vacillante sur le bois
      const fl = 0.75 + 0.25 * Math.sin(tNow / 90 + f.t.x) * Math.sin(tNow / 37);
      const glow = g.createRadialGradient(bx, by - 30 * s, 0, bx, by - 30 * s, 62 * s);
      glow.addColorStop(0, `rgba(255,150,40,${0.35 * fl})`);
      glow.addColorStop(1, 'rgba(255,90,10,0)');
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life >= p.max) {
          parts.splice(i, 1);
          continue;
        }
        const k = p.life / p.max;
        // la flamme se resserre vers le haut
        p.vx += (bx - p.x) * 5 * dt;
        p.x += (p.vx + Math.sin(tNow / 120 + p.ph) * 10 * s) * dt;
        p.y += p.vy * dt;
        const r = p.r * (1 - k * 0.75),
          col = k < 0.18 ? [255, 225, 150] : k < 0.5 ? [255, 140, 35] : [210, 55, 12],
          a = (k < 0.12 ? k / 0.12 : 1 - k) * 0.2;
        const pg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        pg.addColorStop(0, `rgba(${col},${a})`);
        pg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = pg;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }
  };
  place();
  requestAnimationFrame(frame);
}
(() => {
  const ov = document.getElementById('overlay');
  if (!ov) return;
  const sync = () => document.body.classList.toggle('lobby', ov.style.display !== 'none');
  new MutationObserver(sync).observe(ov, { attributes: true, attributeFilter: ['style'] });
  sync();
  lobbyTorches(ov);
})();
