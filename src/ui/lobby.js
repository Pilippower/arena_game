'use strict';
// Lobby (design de l'utilisateur, docs/SPEC.md) : images découpées de sa maquette par tools/build_lobby_assets.js.
// body.lobby suit la visibilité de #overlay : les barres du haut et du bas prennent alors le décor du lobby.
function lobbyCardArt(kind, key) {
  // carte de la panoplie de l'utilisateur (illustration + nom peint) : remplit tout le bouton
  return `<img class="cardArt" src="assets/ui/lobby2/${kind}_${key}.webp" alt="">`;
}
// Vasques des torches dans wall_l / wall_r (images de 690 px de haut, largeurs w) : x = centre de la vasque dans
// l'image, y = bord de la vasque. Les flammes figées y ont été effacées. Largeur affichée des murs = --wallw
// (lobby.css), mesurée sur la sonde .wallProbe : en fenêtre plus large que 16:9 les murs s'élargissent et sont rognés
// en haut et en bas (le feu, calé sur la seule hauteur, flottait au-dessus des vasques hors plein écran).
const LOBBY_WALL = { h: 690, w: { l: 330, r: 328 } };
const TORCHES = [
  { side: 'l', x: 137, y: 380 },
  { side: 'r', x: 192, y: 380 }
];
// Feu animé : particules additives qui montent, ondulent et passent du blanc-jaune au rouge.
// Chaque particule est une image de flamme pré-calculée (une par couleur) : pas de dégradé recalculé à chaque image.
const FLAME_SPRITES = [
  [255, 225, 150],
  [255, 140, 35],
  [210, 55, 12]
].map(col => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'),
    gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${col},1)`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
});
// Position à l'écran du bord d'une vasque (fonction pure, testée) : W, H = taille du lobby, wallW = largeur affichée
// des murs (0 = inconnue : calés sur la hauteur). Mur = image mise à l'échelle sur sa largeur, centrée en hauteur.
function lobbyTorchSpot(t, W, H, wallW) {
  const natW = LOBBY_WALL.w[t.side],
    s = wallW > 0 ? wallW / natW : H / LOBBY_WALL.h,
    top = (H - LOBBY_WALL.h * s) / 2;
  return { s, x: t.side === 'l' ? t.x * s : W - (natW - t.x) * s, y: top + t.y * s };
}
function lobbyTorches(ov) {
  const fires = TORCHES.map(t => {
    const c = document.createElement('canvas');
    c.className = 'torchFire';
    c.setAttribute('aria-hidden', 'true');
    ov.prepend(c);
    return { t, c, g: c.getContext('2d'), parts: [], s: 1 };
  });
  const probe = document.createElement('div');
  probe.className = 'wallProbe';
  ov.prepend(probe);
  const place = () => {
    const H = ov.clientHeight,
      W = ov.clientWidth;
    for (const f of fires) {
      const { s, x, y } = lobbyTorchSpot(f.t, W, H, probe.offsetWidth),
        w = 130 * s,
        h = 190 * s;
      Object.assign(f.c.style, {
        left: x - w / 2 + 'px',
        top: y - h + 8 * s + 'px',
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
  // 30 images/s suffisent à une flamme (moitié moins de calcul qu'à 60)
  const frame = tNow => {
    requestAnimationFrame(frame);
    if (tNow - last < 30) return;
    const dt = Math.min(0.06, (tNow - last) / 1000);
    last = tNow;
    if (!document.body.classList.contains('lobby') || !ov.clientHeight) return;
    for (const f of fires) {
      const { g, c, s, parts } = f,
        w = c.width,
        h = c.height,
        bx = w / 2,
        by = h - 10 * s;
      for (let k = 0; k < 5; k++)
        parts.push({
          x: bx + (Math.random() - 0.5) * 46 * s,
          y: by - Math.random() * 6 * s,
          vx: (Math.random() - 0.5) * 14 * s,
          vy: -(110 + Math.random() * 80) * s,
          life: 0,
          max: 0.6 + Math.random() * 0.5,
          r: (11 + Math.random() * 10) * s,
          ph: Math.random() * 6.28
        });
      g.clearRect(0, 0, w, h);
      // lueur vacillante sur le bois
      const fl = 0.75 + 0.25 * Math.sin(tNow / 90 + f.t.x) * Math.sin(tNow / 37);
      const glow = g.createRadialGradient(bx, by - 30 * s, 0, bx, by - 30 * s, 62 * s);
      glow.addColorStop(0, `rgba(255,150,40,${0.35 * fl})`);
      glow.addColorStop(1, 'rgba(255,90,10,0)');
      g.globalAlpha = 1; // l'opacité des particules ne doit pas déteindre sur la lueur
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
        const r = p.r * (1 - k * 0.75);
        g.globalAlpha = (k < 0.12 ? k / 0.12 : 1 - k) * 0.26;
        g.drawImage(FLAME_SPRITES[k < 0.18 ? 0 : k < 0.5 ? 1 : 2], p.x - r, p.y - r, r * 2, r * 2);
      }
    }
  };
  place();
  requestAnimationFrame(frame);
}
// Fenêtre peu haute (PC) : tout le contenu du cadre est réduit d'un même facteur, comme sur un écran plus grand (bug
// du 06/11/2026, chez un ami : fenêtre large mais basse, la rangée des arènes absorbait le manque de hauteur et leurs
// illustrations devenaient une bande ; à 650 px les classes et PLAY sortaient du cadre). Fonction pure, testée.
const LOBBY_REF_H = 860, // hauteur de fenêtre (px) où le lobby est à sa taille naturelle
  LOBBY_MIN_ZOOM = 0.6;
function lobbyZoom(h) {
  return Math.min(1, Math.max(LOBBY_MIN_ZOOM, h / LOBBY_REF_H));
}
(() => {
  const ov = document.getElementById('overlay');
  if (!ov) return;
  const fit = () => document.documentElement.style.setProperty('--lobby-zoom', lobbyZoom(window.innerHeight));
  window.addEventListener('resize', fit);
  fit();
  const sync = () => document.body.classList.toggle('lobby', ov.style.display !== 'none');
  new MutationObserver(sync).observe(ov, { attributes: true, attributeFilter: ['style'] });
  sync();
  lobbyTorches(ov);
})();
