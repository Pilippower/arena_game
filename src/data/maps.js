'use strict';
// Cartes : dimensions, obstacles de ligne de vue / collision (cercles), sanctuaires de soin.
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
    ]
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
    bridge: { y: 5.0, halfW: 2.2, rampX: 27.5, rampW: 3, rampLen: 11 }
  }
};
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
  HEALTH_SPOTS.length = 0;
  HEALTH_SPOTS.push(...M.health);
  try {
    localStorage.setItem('arenaMap', id);
  } catch (_) {}
  if (typeof onMapChanged === 'function') onMapChanged(id);
}
// Le décor 3D et les occultants des personnages suivent la carte courante.
function onMapChanged(id) {
  if (typeof ENV !== 'undefined' && ENV.ok && window.ArenaEnv?.setMap) ArenaEnv.setMap(id, arena);
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
