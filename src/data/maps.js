'use strict';
// Cartes : dimensions, obstacles de ligne de vue / collision (cercles), sanctuaires de soin.
// Le décor 3D de chaque carte est construit par src/render/environment.js (castle) ou src/render/map_<id>.js.
// applyMap(id) recopie la carte choisie dans `arena` et HEALTH_SPOTS, lus partout par le gameplay.
const MAPS = {
  castle: {
    name: 'The Castle',
    desc: 'Moonlit ruins, rune pillars and a castle on the horizon.',
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
    desc: 'A sandy pit under a timber bridge, ringed by spiked palisades at dusk.',
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
    ]
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
