'use strict';
// Monde PVE « The Mistvale Road » (données, aucune règle ni dessin) : relief (heightAt), route sinueuse (roadX), arbres
// et rochers (obstacles = cercles comme les piliers de l'arène, data/maps.js), camps de monstres, feux de camp (points
// de reprise) et porte du château en haut de la colline. Lu par la mécanique (src/pve/pve.js) et le décor
// (src/render/map_pve.js, via arena.world). Le château (sols, murs, tours, camps intérieurs) : src/pve/castle.js,
// chargé avant. Le mode PvP n'utilise rien de ce fichier.
// Repère : on part au sud (z < 0) et l'on monte vers le château, au nord (z > 0).
const PVE_WORLD = (() => {
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const C = PVE_CASTLE,
    HALF_X = 60,
    HALF_Z = 156, // vallée (de la falaise du départ à la porte) ; le monde continue au nord dans le château
    WORLD_Z = 312, // demi-longueur des limites du monde (jusqu'au fond du château ; au sud : mur invisible du château)
    HILL = { h: C.base, from: 80, to: 138 }, // colline du château : montée de 16 m entre z = 80 et z = 138
    GATE = C.gate; // porte du château (fin de la route)
  // Centre de la route : grandes courbes dans la vallée, lacets dans la montée, droite devant la porte.
  function roadX(z) {
    const sway = 16 * Math.sin(z * 0.019 + 0.4) + 7 * Math.sin(z * 0.043 + 1.7),
      climb = 12 * Math.sin((z - HILL.from) * 0.11) * smooth(HILL.from - 6, HILL.from + 8, z);
    return (sway + climb) * (1 - smooth(128, 146, z));
  }
  const ROAD_HALF = 3.2; // demi-largeur de la route (m)
  // Hauteur du sol : colline au nord, bosses douces hors de la route (aplanie), crêtes boisées sur les bords (limites
  // naturelles du monde), falaise derrière le départ, esplanade plate devant la porte ; dans le château, ses sols.
  function heightAt(x, z) {
    const floor = z >= GATE.z ? C.floorAt(x, z) : null;
    if (floor != null) return floor;
    const ax = Math.abs(x),
      hill = HILL.h * smooth(HILL.from, HILL.to, z) * (1 - 0.55 * smooth(28, 60, ax)),
      off = smooth(ROAD_HALF + 0.8, ROAD_HALF + 7, Math.abs(x - roadX(z))),
      plaza = smooth(128, 138, z) * (1 - smooth(24, 34, ax)),
      bumps =
        (1.4 * Math.sin(x * 0.09 + 0.5) * Math.sin(z * 0.071) +
          0.8 * Math.sin(x * 0.19 + z * 0.13) +
          0.5 * Math.cos(x * 0.05 - z * 0.11)) *
        (1 - plaza),
      ridge = 15 * smooth(36, 66, ax) ** 2 + 0.5 * Math.max(0, ax - 66),
      back = 14 * smooth(-150, -172, z);
    return hill + off * (bumps + ridge) + back;
  }
  // Monstres : modèle de héros existant (classe + race, ou forme du druide), PV et dégâts relatifs à la classe (mesurés le
  // 09/11/2026 : chaque classe, jouée par l'IA, bat chaque camp ; camps de 3 et gardien exigeants, 25 à 60 % de PV restants),
  // distance à laquelle ils remarquent le joueur. Noms originaux.
  const MOBS = {
    prowler: { name: 'Mistfang Prowler', cls: 'warden', race: 'orc', form: 'cat', hp: 0.33, dmg: 0.28, aggro: 15 },
    thrall: { name: 'Grave Thrall', cls: 'sentinel', race: 'undead', hp: 0.3, dmg: 0.28, aggro: 13 },
    cultist: { name: 'Ash Cultist', cls: 'warlock', race: 'undead', hp: 0.33, dmg: 0.28, aggro: 17 },
    wraith: { name: 'Rune Wraith', cls: 'arcanist', race: 'elf', hp: 0.33, dmg: 0.28, aggro: 17 },
    bear: { name: 'Hollow Bear', cls: 'warden', race: 'dwarf', form: 'bear', hp: 0.36, dmg: 0.33, aggro: 13 },
    reaver: { name: 'Bone Reaver', cls: 'reaver', race: 'undead', hp: 0.4, dmg: 0.33, aggro: 14 },
    knight: { name: 'Ashen Knight', cls: 'sentinel', race: 'human', hp: 0.36, dmg: 0.3, aggro: 14 },
    // gardien de la porte (gate) : il garde le levier de la herse. escort : monstre ajouté par héros en plus dans le
    // groupe (src/pve/pve.js, pveCampMobs)
    gatekeeper: {
      name: 'Morvain the Hollow',
      cls: 'reaver',
      race: 'orc',
      hp: 1.2,
      dmg: 0.5,
      aggro: 20,
      scale: 1.3,
      gate: true,
      escort: 'thrall'
    },
    // roi du château, au sommet du donjon : sa mort termine l'aventure (boss)
    king: {
      name: 'Varkhul the Ashen King',
      cls: 'warlock',
      race: 'undead',
      hp: 1.6,
      dmg: 0.45,
      aggro: 22,
      scale: 1.5,
      boss: true,
      escort: 'knight'
    }
  };
  // Camps le long de la route (z, côté = décalage depuis le centre de la route, m, monstres), puis ceux du château.
  // guardian : camp d'un gardien (porte ou roi) ; indoor : dans le château (décor sans pieux ni ossements).
  const guardian = mobs => mobs.some(t => MOBS[t].gate || MOBS[t].boss);
  const CAMPS = [
    { z: -112, side: 6, mobs: ['prowler', 'prowler'] },
    { z: -74, side: -7, mobs: ['thrall', 'cultist'] },
    { z: -36, side: 7, mobs: ['wraith', 'thrall'] },
    { z: 4, side: -6, mobs: ['bear'] },
    { z: 42, side: 7, mobs: ['reaver', 'cultist', 'prowler'] },
    { z: 86, side: -6, mobs: ['thrall', 'thrall', 'wraith'] },
    { z: 118, side: 6, mobs: ['cultist', 'reaver'] },
    { z: 142, side: 0, mobs: ['gatekeeper'] }
  ]
    .map(c => ({ x: roadX(c.z) + c.side, z: c.z, mobs: c.mobs }))
    .concat(C.camps.map(c => ({ ...c, indoor: true })))
    .map((c, i) => ({ ...c, id: i, boss: guardian(c.mobs) }));
  // Feux de camp : points de reprise, au bord de la route (on revient au milieu de la route, à côté du feu, après une
  // mort), le premier au départ.
  const CHECKPOINTS = [-148, -52, 22, 66, 104]
    .map((z, i) => ({
      x: roadX(z) + ROAD_HALF + 2.2,
      z,
      spawn: { x: roadX(z), z },
      name: ['Wayfarer’s Camp', 'Old Mill Fire', 'Hollow Oak', 'Foot of the Hill', 'Watchman’s Rest'][i]
    }))
    .concat(C.checkpoints.map(c => ({ ...c, indoor: true })))
    .map((c, i) => ({ ...c, id: i }));
  const START = { x: roadX(-146), z: -146, yaw: 0 };
  // Obstacles : arbres, rochers, pierres levées, tirés au hasard (graine fixe) hors de la route, des camps et des feux.
  function obstacles() {
    let seed = 20261109;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647,
      out = [],
      clear = (x, z) =>
        Math.abs(x - roadX(z)) > ROAD_HALF + 4.5 &&
        CAMPS.every(c => Math.hypot(x - c.x, z - c.z) > (c.boss ? 16 : 9)) &&
        CHECKPOINTS.every(c => Math.hypot(x - c.x, z - c.z) > 6) &&
        out.every(o => Math.hypot(x - o.x, z - o.z) > o.r + 3.4);
    for (let k = 0; k < 2600 && out.length < 150; k++) {
      const x = (rnd() * 2 - 1) * (HALF_X - 2),
        z = -HALF_Z + 4 + rnd() * (HALF_Z * 2 - 22),
        roll = rnd();
      if (!clear(x, z)) continue;
      const base = heightAt(x, z),
        kind = roll < 0.62 ? 'pine' : roll < 0.78 ? 'deadTree' : roll < 0.93 ? 'rock' : 'runeStone',
        r = kind === 'rock' ? 1.1 + rnd() * 1.3 : kind === 'runeStone' ? 0.55 : 0.42 + rnd() * 0.18,
        tall = kind === 'pine' ? 9 + rnd() * 7 : kind === 'deadTree' ? 6 + rnd() * 3 : kind === 'rock' ? r * 1.4 : 3.2;
      out.push({ x, z, r, h: base + tall, base, kind, pad: kind === 'rock' ? 0.5 : 0.45, seed: rnd() });
    }
    return out;
  }
  // Tours et colonnes du château : obstacles ronds comme les arbres (collision, ligne de vue).
  const structures = () => [
    ...C.towers.map(t => ({ ...t, base: C.base, kind: 'tower', pad: 0.5 })),
    ...C.columns.map(c => ({ ...c, base: C.base, kind: 'column', pad: 0.5 }))
  ];
  return {
    id: 'mistvale',
    name: 'The Mistvale Road',
    desc: 'Follow the misty road to the castle on the hill.',
    halfX: HALF_X,
    halfZ: WORLD_Z,
    valleyZ: HALF_Z,
    roadHalf: ROAD_HALF,
    hill: HILL,
    gate: GATE,
    lever: C.lever,
    top: C.top,
    castle: C,
    start: START,
    roadX,
    heightAt,
    mobs: MOBS,
    camps: CAMPS,
    checkpoints: CHECKPOINTS,
    obstacles: obstacles(),
    structures: structures(),
    walls: C.walls
  };
})();
