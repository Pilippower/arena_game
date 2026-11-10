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
    rooms: { wall: 1, axis: 'x', at: [0, 0] }
  },
  bridge: {
    name: 'The Bridge',
    desc: 'A sandy pit under a timber bridge.',
    halfX: 32,
    halfZ: 22,
    // blocs de roche sous le pont, poteaux du pont, rochers latéraux (+ poteaux de soutien des rampes : rampPosts).
    // pad des poteaux : leurs anneaux de fer (r × 1,1) + le corps, sans marge invisible (05/11/2026)
    pillars: [
      { x: 0, z: 0, r: 2.3, h: 3.2, kind: 'rock' },
      { x: -9, z: 2.6, r: 0.7, h: 4.6, kind: 'post', pad: 0.52 },
      { x: -9, z: -2.6, r: 0.7, h: 4.6, kind: 'post', pad: 0.52 },
      { x: 9, z: 2.6, r: 0.7, h: 4.6, kind: 'post', pad: 0.52 },
      { x: 9, z: -2.6, r: 0.7, h: 4.6, kind: 'post', pad: 0.52 },
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
    // salles au milieu des grands côtés (nord / sud), à la place des portes grillagées : le tablier du pont rejoint les
    // remparts est / ouest et leurs rampes encombraient les anciennes portes (05/11/2026)
    rooms: { wall: 3.2, axis: 'z', at: [0, 0] }
  }
};
// Salles de départ : une de chaque côté, au-delà d'un rempart (équipe 0 du côté négatif de l'axe, équipe 1 du côté
// positif), reliée à l'arène par une porte percée dans le rempart. Chaque carte donne l'épaisseur de son rempart (wall,
// la porte le traverse), l'axe des salles (axis 'x' : remparts ouest / est, 'z' : remparts sud / nord) et la position
// de chaque salle / porte le long de son rempart (at : [équipe 0, équipe 1]). depth = profondeur de la salle,
// halfW = demi-largeur, door = demi-largeur de la porte (m).
const START_ROOM = { depth: 10, halfW: 6, door: 1.9 };
// Obstacles (cercles) : un corps reste à r + pad du centre (pad par défaut : socles des piliers du château).
const PILLAR_PAD = 0.66;
const pillarReach = (p, extra = 0) => p.r + (p.pad ?? PILLAR_PAD) + extra;
// Poteaux de soutien sous les rampes du pont (2 rangées, aux fractions RAMP_POSTS de la hauteur) : de vrais obstacles,
// car on passe sous le haut des rampes ; minces, ils ne coupent pas la ligne de vue (los: false).
const RAMP_POSTS = [0.25, 0.55, 0.85];
function rampPosts(B) {
  const out = [];
  if (!B) return out;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (const f of RAMP_POSTS)
        for (const ex of [-1, 1])
          out.push({
            x: sx * B.rampX + ex * (B.rampW / 2 - 0.2),
            z: sz * (B.halfW + B.rampLen * (1 - f)),
            r: 0.2,
            h: B.y * f,
            kind: 'rampPost',
            pad: 0.45,
            los: false
          });
  return out;
}
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
  arena.pillars = [...M.pillars.map(p => ({ ...p })), ...rampPosts(M.bridge)];
  arena.bridge = M.bridge || null;
  arena.heightAt = null; // relief : seulement le monde PVE (src/pve/pve.js, pveApplyWorld)
  arena.world = null;
  arena.walls = null; // murs : seulement le château du monde PVE
  arena.rooms = M.rooms
    ? [-1, 1].map((side, i) => ({
        side,
        axis: M.rooms.axis,
        half: M.rooms.axis === 'z' ? M.halfZ : M.halfX, // demi-côté de l'arène jusqu'au rempart de la salle
        at: M.rooms.at[i],
        wall: M.rooms.wall,
        ...START_ROOM
      }))
    : [];
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
// Hauteur libre à garder au-dessus de soi sous une rampe (tête + épaisseur de la rampe) : on passe sous le haut des
// rampes, entre leurs poteaux (05/11/2026, plus de mur invisible sous la pente), on bute là où elle est trop basse.
const HEADROOM = 2.45;
// Hauteur du terrain : 0 dans les arènes (sol plat), relief du monde PVE (arena.heightAt, src/pve/world.js).
const terrainY = (x, z) => (arena.heightAt ? arena.heightAt(x, z) : 0);
// Sol sous une unité : la surface si l'unité est dessus (ou presque), sinon le terrain (sable plat en arène).
function groundAt(u) {
  const s = surfaceAt(u.x, u.z);
  return s && s.h <= (u.y || 0) + STEP ? s.h : terrainY(u.x, u.z);
}
// Flanc d'une rampe : on n'y entre pas par le côté s'il est plus haut qu'un pas, sauf en passant dessous (assez haut).
function blockedBySurface(u) {
  const s = surfaceAt(u.x, u.z),
    y = u.y || 0;
  return !!s && !s.deck && s.h > y + STEP && s.h < y + HEADROOM;
}
// Plafond d'une unité sous une rampe ou sous le tablier (saut), ou Infinity à découvert.
function ceilingAt(u) {
  const s = surfaceAt(u.x, u.z),
    y = u.y || 0;
  return s && s.h > y + STEP ? s.h - HEADROOM : Infinity;
}
// Garde-corps du pont : sur le tablier, on ne tombe pas sur les côtés, sauf aux ouvertures des rampes.
function bridgeRail(u) {
  const B = arena.bridge;
  if (!B || (u.y || 0) < B.y - 0.5 || Math.abs(u.z) > B.halfW + 0.6) return;
  const atRamp = Math.abs(Math.abs(u.x) - B.rampX) <= B.rampW / 2 - 0.3;
  if (!atRamp && Math.abs(u.z) > B.halfW - 0.35) u.z = Math.sign(u.z) * (B.halfW - 0.35);
}

// ---------- Murs (monde PVE : château, arena.walls ; aucun en arène) ----------
// Mur = segment (ax, az) → (bx, bz), demi-épaisseur t, sommet h (hauteur absolue : on passe au-dessus si plus haut) ;
// open : passage ouvert (herse levée). Collision en rectangle, sans arrondi aux extrémités : une porte entre deux pans
// garde toute sa largeur.
const wallStops = (w, y) => !w.open && y < w.h;
// Repère d'un mur : s le long du segment (0 → L), n en travers (épaisseur : |n| < t).
function wallFrame(w, x, z) {
  const dx = w.bx - w.ax,
    dz = w.bz - w.az,
    L = Math.hypot(dx, dz) || 1,
    ux = dx / L,
    uz = dz / L;
  return { L, ux, uz, s: (x - w.ax) * ux + (z - w.az) * uz, n: (z - w.az) * ux - (x - w.ax) * uz };
}
// Sortie la plus courte d'un mur (marge m), ou null si (x, z) n'y est pas : par le côté, ou par un bout.
function wallExit(w, x, z, m) {
  const { L, ux, uz, s, n } = wallFrame(w, x, z),
    t = w.t + m;
  if (s <= -m || s >= L + m || Math.abs(n) >= t) return null;
  const side = t - Math.abs(n),
    back = s + m,
    fwd = L + m - s;
  if (side <= back && side <= fwd) {
    const k = (n < 0 ? -1 : 1) * side;
    return { x: x - uz * k, z: z + ux * k };
  }
  return back < fwd ? { x: x - ux * back, z: z - uz * back } : { x: x + ux * fwd, z: z + uz * fwd };
}
// Une unité à la hauteur y, en (x, z), toucherait-elle un mur (à m près) ?
const wallAt = (x, z, m, y = 0) => !!arena.walls?.some(w => wallStops(w, y) && wallExit(w, x, z, m));
// Repousse une unité hors des murs (deux passes : coins où deux murs se rejoignent).
function pushOutOfWalls(u, m) {
  for (let pass = 0; pass < 2; pass++)
    for (const w of arena.walls) {
      if (!wallStops(w, u.y || 0)) continue;
      const p = wallExit(w, u.x, u.z, m);
      if (p) {
        u.x = p.x;
        u.z = p.z;
      }
    }
}
// Le segment a → b passe-t-il dans un mur plus haut que low (ligne de vue) ? Découpe du segment par le rectangle du
// mur dans son repère (Liang-Barsky).
function segmentInWall(w, a, b) {
  const A = wallFrame(w, a.x, a.z),
    B = wallFrame(w, b.x, b.z);
  let t0 = 0,
    t1 = 1;
  for (const [p, q] of [
    [A.s - B.s, A.s],
    [B.s - A.s, A.L - A.s],
    [A.n - B.n, A.n + w.t],
    [B.n - A.n, w.t - A.n]
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}
const wallCuts = (a, b, low) => arena.walls.some(w => !w.open && w.h > low && segmentInWall(w, a, b));

// ---------- Salles de départ (géométrie) ----------
// Repère d'une salle : a = le long de son axe (vers la salle : side × a > 0), b = le long de son rempart. Toute la
// géométrie des salles s'écrit dans ce repère ; roomFrame / roomWorld passent du monde (x, z) au repère et retour.
const roomFrame = (r, x, z) => (r.axis === 'z' ? { a: z, b: x } : { a: x, b: z });
const roomWorld = (r, a, b) => (r.axis === 'z' ? { x: b, z: a } : { x: a, z: b });
// rectangle [aMin, aMax, bMin, bMax] du repère d'une salle → [xMin, xMax, zMin, zMax]
const roomRect = (r, R) => (r.axis === 'z' ? [R[2], R[3], R[0], R[1]] : R);
// Zone d'un point : 0 = arène, sinon side de la salle (au-delà de son rempart).
function zoneOf(x, z) {
  for (const r of arena.rooms || []) if (r.side * roomFrame(r, x, z).a > r.half) return r.side;
  return 0;
}
const roomOf = side => arena.rooms?.find(r => r.side === side) || null;
// Rectangles praticables d'une zone [xMin, xMax, zMin, zMax], à la marge m des murs : l'arène ou la salle, et le
// passage de la porte quand elle est ouverte (il chevauche l'arène et la salle : on passe de l'une à l'autre).
function zoneRects(zone, m, open) {
  const hx = arena.halfX,
    hz = arena.halfZ,
    out = zone ? [] : [[-hx + m, hx - m, -hz + m, hz - m]];
  const span = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
  for (const r of arena.rooms || []) {
    const h = r.half,
      back = h + r.wall + r.depth;
    if (zone === r.side)
      out.push(roomRect(r, [...span(r.side, h + r.wall + m, back - m), r.at - r.halfW + m, r.at + r.halfW - m]));
    if (open && (zone === 0 || zone === r.side))
      out.push(roomRect(r, [...span(r.side, h - m - 0.05, h + r.wall + m + 0.05), r.at - r.door + m, r.at + r.door - m]));
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
  const za = zoneOf(a.x, a.z),
    zb = zoneOf(b.x, b.z);
  if (za === zb) return true;
  if (!open) return false;
  for (const side of [za, zb]) {
    const r = side && roomOf(side);
    if (!r) continue;
    const A = roomFrame(r, a.x, a.z),
      B = roomFrame(r, b.x, b.z),
      h = r.half;
    for (const pa of [side * h, side * (h + r.wall)]) {
      const k = (pa - A.a) / (B.a - A.a || 1e-9),
        pb = A.b + (B.b - A.b) * k;
      if (Math.abs(pb - r.at) > r.door - 0.1) return false;
    }
  }
  return true;
}
// Place de départ d'une unité dans la salle de son équipe (face à la porte), ou au bord de l'arène sans salle.
function spawnPoint(team, i, n) {
  const r = roomOf(team ? 1 : -1),
    spot = (i - (n - 1) / 2) * (r ? 2.6 : team ? 6 : 5);
  if (!r) return { x: team ? 26 : -26, z: spot, yaw: team ? Math.PI : 0 };
  const p = roomWorld(r, r.side * (r.half + r.wall + r.depth * 0.55), r.at + spot),
    face = roomWorld(r, -r.side, 0); // vers la porte
  return { x: p.x, z: p.z, yaw: Math.atan2(face.x, face.z) };
}
