'use strict';
// Curseurs du jeu (SVG originaux) : gantelet de plaque par défaut, épée au-dessus d'un ennemi, gantelet lumineux sur un allié.
const CURSOR_SVG = {
  gauntlet: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f5fb"/><stop offset="1" stop-color="#6d7891"/></linearGradient></defs>
    <path d="M3.2 1.5 C4.6 1 6 1.6 6.4 3 L8.6 11 L10 10.2 C11 9.7 12.2 10.1 12.6 11.1 L13 12 C14 11.4 15.3 11.8 15.7 12.9 L16 13.6 C17 13.1 18.2 13.6 18.5 14.6 L20 19.5 C20.8 22.5 19.8 25.2 17.4 26.4 L13 28.2 C10.6 29 8.2 28 7.2 25.8 L4.6 19.6 C4.2 18.6 4.7 17.5 5.7 17.1 L7 16.7 L2.6 3.6 C2.3 2.7 2.5 1.8 3.2 1.5 Z" fill="url(#m)" stroke="#1a1208" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M4.4 5 L6.6 4.4 M5.4 8 L7.6 7.4 M10.2 12.6 L11.6 16 M13.2 13.8 L14.6 17.2 M16.2 15.2 L17.4 18.4" stroke="#1a1208" stroke-width="1" opacity=".7"/>
    <path d="M8.6 25.4 L17.8 21.8 L19.6 25 L10.6 28.8 Z" fill="#d9a441" stroke="#1a1208" stroke-width="1"/>
    <path d="M4 2.6 L6 8.6" stroke="#ffffff" stroke-width=".9" opacity=".7"/>
  </svg>`,
  sword: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M2 2 L6 3 L22 19 L19 22 L3 6 Z" fill="#e9eef7" stroke="#2a0a0a" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M4 3.5 L20.5 20" stroke="#ffffff" stroke-width=".8" opacity=".8"/>
    <path d="M17 23 L23 17 L25 19 L19 25 Z" fill="#d9a441" stroke="#2a0a0a" stroke-width="1.1"/>
    <path d="M21 23 L27 29" stroke="#5a2a14" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="28" cy="30" r="2" fill="#d9a441" stroke="#2a0a0a" stroke-width="1"/>
    <path d="M2 2 L6 3 L3 6 Z" fill="#ff4a3a"/>
  </svg>`,
  ally: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8ffd8"/><stop offset="1" stop-color="#3fb86a"/></linearGradient></defs>
    <path d="M3.2 1.5 C4.6 1 6 1.6 6.4 3 L8.6 11 L10 10.2 C11 9.7 12.2 10.1 12.6 11.1 L13 12 C14 11.4 15.3 11.8 15.7 12.9 L16 13.6 C17 13.1 18.2 13.6 18.5 14.6 L20 19.5 C20.8 22.5 19.8 25.2 17.4 26.4 L13 28.2 C10.6 29 8.2 28 7.2 25.8 L4.6 19.6 C4.2 18.6 4.7 17.5 5.7 17.1 L7 16.7 L2.6 3.6 C2.3 2.7 2.5 1.8 3.2 1.5 Z" fill="url(#m)" stroke="#0a2a14" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M4.4 5 L6.6 4.4 M5.4 8 L7.6 7.4 M10.2 12.6 L11.6 16 M13.2 13.8 L14.6 17.2 M16.2 15.2 L17.4 18.4" stroke="#0a2a14" stroke-width="1" opacity=".7"/>
    <path d="M8.6 25.4 L17.8 21.8 L19.6 25 L10.6 28.8 Z" fill="#d9a441" stroke="#0a2a14" stroke-width="1"/>
    <path d="M4 2.6 L6 8.6" stroke="#ffffff" stroke-width=".9" opacity=".7"/><path d="M24 3 v7 M20.5 6.5 h7" stroke="#5dff8a" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`
};
const CURSORS = Object.fromEntries(
  Object.entries(CURSOR_SVG).map(([k, svg]) => [k, `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 2, auto`])
);
document.documentElement.style.cursor = CURSORS.gauntlet;
let cursorKind = 'gauntlet';
function setGameCursor(kind) {
  if (kind === cursorKind) return;
  cursorKind = kind;
  canvas.style.cursor = CURSORS[kind];
}
setGameCursor('ally');
setGameCursor('gauntlet');
// Ciblage façon MMO, par priorité : la barre de nom flottante (nom + barre de vie), puis la boîte invisible qui va
// du haut de cette barre jusqu'au sol (largeur de la barre, ou de la silhouette si plus large : un clic entre la barre
// et le personnage le cible), puis la silhouette (des pieds à la tête, personnage sans barre affichée), enfin la
// proximité du torse (clic approximatif). Entre deux candidats, le plus proche de la caméra (z le plus petit).
// Fonction pure : items = [{ u, plate: { l, t, r, b } | null, feet, head, chest }] en pixels.
const BODY_HALF_WIDTH = 0.22; // demi-largeur de la silhouette, en fraction de sa hauteur à l'écran
const BODY_MIN_HALF_WIDTH = 12; // px : un personnage lointain reste cliquable
function bodyHalfWidth(i) {
  return Math.max(BODY_MIN_HALF_WIDTH, BODY_HALF_WIDTH * Math.hypot(i.head.x - i.feet.x, i.head.y - i.feet.y));
}
// boîte barre de nom → sol (null sans barre affichée)
function plateBox(i) {
  if (!i.plate) return null;
  const half = bodyHalfWidth(i);
  return {
    l: Math.min(i.plate.l, i.feet.x - half, i.head.x - half),
    r: Math.max(i.plate.r, i.feet.x + half, i.head.x + half),
    t: Math.min(i.plate.t, i.head.y),
    b: Math.max(i.plate.b, i.feet.y)
  };
}
function pickUnitAt(sx, sy, items, nearPx) {
  const front = list => list.reduce((a, b) => (b.chest.z < a.chest.z ? b : a)).u,
    inside = (sx, sy, r) => r && sx >= r.l && sx <= r.r && sy >= r.t && sy <= r.b;
  const inPlate = items.filter(i => inside(sx, sy, i.plate));
  if (inPlate.length) return front(inPlate);
  const inBox = items.filter(i => inside(sx, sy, plateBox(i)));
  if (inBox.length) return front(inBox);
  const onBody = items.filter(i => {
    const dx = i.head.x - i.feet.x,
      dy = i.head.y - i.feet.y,
      len2 = dx * dx + dy * dy || 1,
      k = Math.max(0, Math.min(1, ((sx - i.feet.x) * dx + (sy - i.feet.y) * dy) / len2));
    return Math.hypot(sx - (i.feet.x + k * dx), sy - (i.feet.y + k * dy)) <= bodyHalfWidth(i);
  });
  if (onBody.length) return front(onBody);
  let best = null,
    bestD = nearPx;
  for (const i of items) {
    const d = Math.hypot(sx - i.chest.x, sy - i.chest.y);
    if (d < bestD) ((best = i.u), (bestD = d));
  }
  return best;
}
// Unité sous le curseur (même règle que le ciblage au clic) : positions à l'écran des personnages ciblables.
function unitAtScreen(sx, sy) {
  if (!state?.units) return null;
  const cr = canvas.getBoundingClientRect(),
    items = [];
  for (const u of state.units) {
    if (!u.alive || (u.stealth && u.team !== state.player.team)) continue;
    const x = u.rx ?? u.x,
      y = u.ry ?? u.y ?? 0,
      z = u.rz ?? u.z,
      chest = projectScreen(x, y + 1.35, z),
      feet = projectScreen(x, y, z),
      head = projectScreen(x, y + 2.0, z);
    if (!chest || !feet || !head) continue;
    const e = OVERLAY.plates.get(u),
      r = e && e.style.display !== 'none' ? e.getBoundingClientRect() : null,
      plate =
        r && r.width > 0
          ? { l: r.left - cr.left, t: r.top - cr.top, r: r.right - cr.left, b: r.bottom - cr.top }
          : null;
    items.push({ u, plate, feet, head, chest });
  }
  return pickUnitAt(sx, sy, items, MOBILE.enabled ? 90 : 62); // doigt moins précis que la souris
}
canvas.addEventListener('mousemove', e => {
  if (document.pointerLockElement) return;
  const r = canvas.getBoundingClientRect(),
    u = unitAtScreen(e.clientX - r.left, e.clientY - r.top);
  if (pveLeverAtScreen(e.clientX - r.left, e.clientY - r.top)) return setGameCursor('ally'); // levier : main
  setGameCursor(!u || u === state?.player ? 'gauntlet' : u.team !== state.player.team ? 'sword' : 'ally');
});
canvas.addEventListener('mouseleave', () => setGameCursor('gauntlet'));
