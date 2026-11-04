'use strict';
// Cartes : dimensions, obstacles de ligne de vue / collision (cercles), sanctuaires de soin, salles de départ.
// Le décor 3D de chaque carte est construit par src/render/environment.js (castle) ou src/render/map_<id>.js.
// applyMap(id) recopie la carte choisie dans `arena` et HEALTH_SPOTS, lus partout par le gameplay.
const MAPS = {
  castle: {
    name: 'The Castle',
    desc: 'Moonlit ruins and rune pillars.',
    halfX: 34,
    halfZ: 25,
    pillars: [
      { x: -12, z: -8, r: 1.6, h: 5.0 },
      { x: 12, z: -8, r: 1.6, h: 5.0 },
      { x: -12, z: 8, r: 1.6, h: 5.0 },
      { x: 12, z: 8, r: 1.6, h: 5.0 },
      { x: 0, z: -14, r: 1.1, h: 4.0 },
      { x: 0, z: 14, r: 1.1, h: 4.0 },
      { x: -18, z: 0, r: 1.15, h: 4.1 },
      { x: 18, z: 0, r: 1.15, h: 4.1 }
    ],
    health: [
      { x: 0, z: -20 },
      { x: 0, z: 20 }
    ],
    rooms: { wall: 1, z: [0, 0] }
  },
  bridge: {
    name: 'The Bridge',
    desc: 'A sandy pit under a timber bridge.',
    halfX: 32,
    halfZ: 22,
    // blocs de roche sous le pont, poteaux du pont, rochers latéraux
    pillars: [
      { x: 0, z: 0, r: 2.3, h: 3.2, kind: 'rock' },
      { x: -9, z: 2.6, r: 0.7, h: 4.6, kind: 'post' },
      { x: -9, z: -2.6, r: 0.7, h: 4.6, kind: 'post' },
      { x: 9, z: 2.6, r: 0.7, h: 4.6, kind: 'post' },
      { x: 9, z: -2.6, r: 0.7, h: 4.6, kind: 'post' },
      { x: -15, z: 11, r: 1.7, h: 2.6, kind: 'rock' },
      { x: 15, z: -11, r: 1.7, h: 2.6, kind: 'rock' },
      { x: -15, z: -12, r: 1.3, h: 2.2, kind: 'rock' },
      { x: 15, z: 12, r: 1.3, h: 2.2, kind: 'rock' }
    ],
    health: [
      { x: 0, z: -17 },
      { x: 0, z: 17 }
    ],
    // surfaces praticables en hauteur : le pont (tablier) et 4 rampes (2 à chaque extrémité, de part et d'autre)
    bridge: { y: 5.0, halfW: 2.2, rampX: 27.5, rampW: 3, rampLen: 11 },
    // portes à l'écart du pont (son tablier rejoint le rempart au centre), en symétrie centrale comme la carte
    rooms: { wall: 3.2, z: [9, -9] }
  }
};
// Salles de départ : une de chaque côté, au-delà du rempart ouest (équipe 0) et est (équipe 1), reliée à l'arène
// par une porte percée dans le rempart. Chaque carte donne l'épaisseur de son rempart (wall, la porte le traverse) et
// le centre de chaque salle / porte (z : [ouest, est]). depth = profondeur de la salle, halfW = demi-largeur,
// door = demi-largeur de la porte (m).
const START_ROOM = { depth: 10, halfW: 6, door: 1.9 };
let MAP_ID = (() => {
  try {
    return MAPS[localStorage.getItem('arenaMap')] ? localStorage.getItem('arenaMap') : 'castle';
  } catch (_) {
    return 'castle';
  }
})();
function applyMap(id) {
  if (!MAPS[id]) id = 'castle';
  MAP_ID = id;
  const M = MAPS[id];
  arena.halfX = M.halfX;
  arena.halfZ = M.halfZ;
  arena.pillars = M.pillars.map(p => ({ ...p }));
  arena.bridge = M.bridge || null;
  arena.rooms = M.rooms ? [-1, 1].map((side, i) => ({ side, z: M.rooms.z[i], wall: M.rooms.wall, ...START_ROOM })) : [];
  HEALTH_SPOTS.length = 0;
  HEALTH_SPOTS.push(...M.health);
  try {
    localStorage.setItem('arenaMap', id);
  } catch (_) {}
  if (typeof onMapChanged === 'function') onMapChanged(id);
}
// Le décor 3D et les occultants des personnages suivent la carte courante.
function onMapChanged(id) {
  // au lobby, le décor (lourd) n'est reconstruit qu'au lancement, derrière l'écran de chargement (prepareMatch)
  const inLobby = typeof $ === 'function' && !!$('overlay')?.style && $('overlay').style.display !== 'none';
  if (typeof ENV !== 'undefined' && ENV.ok && window.ArenaEnv?.setMap) {
    if (inLobby) ENV.pendingMap = id;
    else ArenaEnv.setMap(id, arena);
  }
  if (typeof hfRebuildOccluders === 'function') hfRebuildOccluders();
}
applyMap(MAP_ID);

// ---------- Hauteur du terrain (pont + rampes) ----------
// Hauteur de la rampe/du tablier au point (x, z), ou null hors des surfaces surélevées.
function surfaceAt(x, z) {
  const B = arena.bridge;
  if (!B) return null;
  if (Math.abs(x) <= arena.halfX && Math.abs(z) <= B.halfW) return { h: B.y, deck: true };
  if (Math.abs(Math.abs(x) - B.rampX) <= B.rampW / 2) {
    const along = Math.abs(z) - B.halfW;
    if (along > 0 && along <= B.rampLen) return { h: B.y * (1 - along / B.rampLen), deck: false };
  }
  return null;
}
const STEP = 0.75; // hauteur franchissable d'un pas
// Sol sous une unité : la surface si l'unité est dessus (ou presque), sinon le sable (0).
function groundAt(u) {
  const s = surfaceAt(u.x, u.z);
  return s && s.h <= (u.y || 0) + STEP ? s.h : 0;
}
// Rampe pleine : on ne peut pas y entrer par le côté ou par-dessous si elle est plus haute qu'un pas.
function blockedBySurface(u) {
  const s = surfaceAt(u.x, u.z);
  return !!s && !s.deck && s.h > (u.y || 0) + STEP;
}
// Garde-corps du pont : sur le tablier, on ne tombe pas sur les côtés, sauf aux ouvertures des rampes.
function bridgeRail(u) {
  const B = arena.bridge;
  if (!B || (u.y || 0) < B.y - 0.5 || Math.abs(u.z) > B.halfW + 0.6) return;
  const atRamp = Math.abs(Math.abs(u.x) - B.rampX) <= B.rampW / 2 - 0.3;
  if (!atRamp && Math.abs(u.z) > B.halfW - 0.35) u.z = Math.sign(u.z) * (B.halfW - 0.35);
}

// ---------- Salles de départ (géométrie) ----------
// Zone d'un point : 0 = arène, -1 / 1 = salle ouest / est (au-delà du rempart).
const zoneOf = x => (arena.rooms?.length && Math.abs(x) > arena.halfX ? Math.sign(x) : 0);
const roomOf = side => arena.rooms?.find(r => r.side === side) || null;
// Rectangles praticables d'une zone [xMin, xMax, zMin, zMax], à la marge m des murs : l'arène ou la salle, et le
// passage de la porte quand elle est ouverte (il chevauche l'arène et la salle : on passe de l'une à l'autre).
function zoneRects(zone, m, open) {
  const hx = arena.halfX,
    hz = arena.halfZ,
    out = zone ? [] : [[-hx + m, hx - m, -hz + m, hz - m]];
  const span = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
  for (const r of arena.rooms || []) {
    const back = hx + r.wall + r.depth;
    if (zone === r.side) out.push([...span(r.side, hx + r.wall + m, back - m), r.z - r.halfW + m, r.z + r.halfW - m]);
    if (open && (zone === 0 || zone === r.side))
      out.push([...span(r.side, hx - m - 0.05, hx + r.wall + m + 0.05), r.z - r.door + m, r.z + r.door - m]);
  }
  return out;
}
const inRect = (R, x, z) => x >= R[0] && x <= R[1] && z >= R[2] && z <= R[3];
// Dans l'enceinte (arène, salles et, si doors, passages des portes), à m des murs (m < 0 : un peu au-delà) : caméra.
const insideWalls = (x, z, m = 0, doors = true) =>
  [0, -1, 1].some(zone => zoneRects(zone, m, doors).some(R => inRect(R, x, z)));
// Point le plus proche dans l'un des rectangles (collision : on glisse le long du mur).
function nearestInRects(rects, x, z) {
  let best = null;
  for (const R of rects) {
    const p = [Math.min(R[1], Math.max(R[0], x)), Math.min(R[3], Math.max(R[2], z))],
      d = Math.hypot(p[0] - x, p[1] - z);
    if (!best || d < best.d) best = { x: p[0], z: p[1], d };
  }
  return best;
}
// Ligne de vue entre deux zones : le segment doit passer par la porte (ouverte) de chaque salle qu'il quitte.
function seesThroughDoors(a, b, open) {
  const za = zoneOf(a.x),
    zb = zoneOf(b.x);
  if (za === zb) return true;
  if (!open) return false;
  for (const side of [za, zb]) {
    const r = side && roomOf(side);
    if (!r) continue;
    for (const px of [side * arena.halfX, side * (arena.halfX + r.wall)]) {
      const k = (px - a.x) / (b.x - a.x || 1e-9),
        z = a.z + (b.z - a.z) * k;
      if (Math.abs(z - r.z) > r.door - 0.1) return false;
    }
  }
  return true;
}
// Place de départ d'une unité dans la salle de son équipe (face à la porte), ou au bord de l'arène sans salle.
function spawnPoint(team, i, n) {
  const r = roomOf(team ? 1 : -1),
    spot = (i - (n - 1) / 2) * (r ? 2.6 : team ? 6 : 5);
  if (!r) return { x: team ? 26 : -26, z: spot, yaw: team ? Math.PI : 0 };
  const x = r.side * (arena.halfX + r.wall + r.depth * 0.55);
  return { x, z: r.z + spot, yaw: Math.atan2(-r.side, 0) };
}
