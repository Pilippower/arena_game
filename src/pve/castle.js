'use strict';
// Château du monde PVE (données, aucune règle ni dessin), au bout de la route de PVE_WORLD (src/pve/world.js, qui
// l'assemble) : on tire le levier à côté de la porte (la herse se lève), on traverse la cour et la grande salle en
// ruine, on monte le grand escalier jusqu'à la galerie haute, puis l'escalier du donjon jusqu'à son sommet, où attend
// le roi. Tout est à ciel ouvert (pas de plafond : la caméra suit partout). Lu par la mécanique (sols dans heightAt,
// murs = arena.walls : collision, ligne de vue, caméra, data/maps.js) et par le décor (src/render/map_pve_castle.js).
// Une seule hauteur de sol par point (x, z) : les niveaux se suivent vers le nord, séparés par des murs.
const PVE_CASTLE = (() => {
  const BASE = 16, // sol de la cour = haut de la colline (PVE_WORLD.hill.h)
    GALLERY = 27, // galerie haute
    SUMMIT = 38, // sommet du donjon
    PARAPET = 2.2; // parapet au-dessus d'un sol : plus haut qu'un saut (1,5 m), on ne tombe pas
  // Sols praticables : rectangle [x0, x1, z0, z1], hauteur y, ou rampe y0 → y1 le long de z (escalier dessiné en
  // marches). Ils couvrent aussi l'épaisseur des portes ; le premier qui contient le point fait foi.
  const FLOORS = [
    { id: 'courtyard', r: [-30, 30, 157, 191.5], y: BASE, tile: 'flag' },
    { id: 'hall', r: [-21.5, 21.5, 191.5, 219], y: BASE, tile: 'hall' },
    { id: 'grandStair', r: [-7.5, 7.5, 219, 249], y0: BASE, y1: GALLERY },
    { id: 'gallery', r: [-25.5, 25.5, 249, 263.5], y: GALLERY, tile: 'flag' },
    { id: 'keepStair', r: [-5.5, 5.5, 263.5, 285], y0: GALLERY, y1: SUMMIT },
    { id: 'summit', r: [-15.5, 15.5, 285, 304.5], y: SUMMIT, tile: 'hall' }
  ];
  // Murs : segment (ax, az) → (bx, bz), demi-épaisseur t, sommet h (absolu). crenel : créneaux ; gate : herse (ouverte
  // quand le levier LEVER est tiré) ; fill : massif de maçonnerie plein (toit plat) qui comble un vide hors des sols ;
  // ghost : limite invisible (sans dessin) ; id : nom lu par le décor.
  const wall = (ax, az, bx, bz, h, o = {}) => ({ ax, az, bx, bz, t: 1.5, h, ...o });
  const pair = (ax, az, bx, bz, h, o) => [wall(ax, az, bx, bz, h, o), wall(-bx, bz, -ax, az, h, o)]; // symétrique en x
  const WALLS = [
    // façade : de crête en crête, la porte au centre (les côtés du monde au nord sont ainsi fermés)
    ...pair(2.6, 157, 60, 157, BASE + 10, { crenel: true }),
    wall(-2.6, 157, 2.6, 157, BASE + 8, { t: 0.35, gate: true }),
    // cour, puis mur de la grande salle (porte de 6 m)
    ...pair(30, 157, 30, 193, BASE + 10, { crenel: true }),
    ...pair(3, 191.5, 30, 191.5, BASE + 9, { crenel: true }),
    // grande salle et son mur nord
    ...pair(21.5, 190, 21.5, 222, BASE + 9, { crenel: true, id: 'hallSide' }), // bannières (décor)
    ...pair(3, 220.5, 21.5, 220.5, BASE + 9, { crenel: true }),
    // grand escalier entre deux massifs (au niveau de la galerie)
    ...pair(7.5, 219, 7.5, 249, GALLERY + PARAPET),
    ...pair(9, 233.25, 27, 233.25, GALLERY, { t: 14.25, fill: true }),
    // galerie haute : parapets, puis la tour du donjon
    ...pair(7.5, 247.5, 27, 247.5, GALLERY + PARAPET, { crenel: true }),
    ...pair(25.5, 246, 25.5, 265, GALLERY + PARAPET, { crenel: true }),
    ...pair(3, 263.5, 27, 263.5, GALLERY + 8, { crenel: true }),
    // escalier du donjon, entre deux massifs (au niveau du sommet)
    ...pair(5.5, 262, 5.5, 286.5, SUMMIT + PARAPET),
    ...pair(7, 274.25, 17, 274.25, SUMMIT, { t: 10.75, fill: true }),
    // sommet du donjon : parapets crénelés
    ...pair(5.5, 285, 17, 285, SUMMIT + PARAPET, { crenel: true }),
    ...pair(15.5, 283.5, 15.5, 306, SUMMIT + PARAPET, { crenel: true }),
    wall(-17, 304.5, 17, 304.5, SUMMIT + PARAPET, { crenel: true }),
    // limite sud du monde (derrière le départ) : l'arène du monde va jusqu'au château, au nord
    wall(-60, -156.5, 60, -156.5, 99, { t: 0.5, ghost: true })
  ];
  // Tours (décor + obstacle rond, comme les piliers) : coins de l'enceinte, châtelet, flèches du donjon.
  const tower = (x, z, r, h, roof) => ({ x, z, r, h, roof });
  const TOWERS = [
    ...[-1, 1].flatMap(s => [
      tower(s * 30, 157, 4.2, BASE + 16, 9),
      tower(s * 6.2, 156.5, 3.4, BASE + 18, 8), // châtelet
      tower(s * 30, 193, 3.6, BASE + 14, 8),
      tower(s * 21.5, 222, 3.2, BASE + 15, 7),
      tower(s * 25.5, 263.5, 3.4, GALLERY + 10, 8),
      tower(s * 17, 262, 3.6, SUMMIT + 10, 10),
      tower(s * 17, 306, 3.6, SUMMIT + 14, 12)
    ])
  ];
  // Levier de la herse, dehors contre le châtelet (côté est de la porte) : on le clique, à portée, pour lever la herse.
  const LEVER = { x: 4.6, z: 151.6, reach: 5, name: 'Gate lever' }; // reach : m, distance max pour le tirer
  // Colonnes de la grande salle (obstacles : on s'en sert pour couper la vue).
  const COLUMNS = [-10, 10].flatMap(x => [197, 203, 209, 215].map(z => ({ x, z, r: 0.8, h: BASE + 8 })));
  // Camps de monstres (types : PVE_WORLD.mobs), du gardien de la porte (dans la vallée, PVE_WORLD) au roi.
  const CAMPS = [
    { x: -12, z: 172, mobs: ['knight', 'thrall'] },
    { x: 13, z: 182, mobs: ['cultist', 'knight'] },
    { x: 0, z: 206, mobs: ['reaver', 'knight', 'thrall'] },
    { x: 0, z: 236, mobs: ['knight', 'wraith'] },
    { x: -13, z: 256, mobs: ['wraith', 'thrall'] },
    { x: 0, z: 296, mobs: ['king'] }
  ];
  // Feux de reprise dans le château (braseros) : on revient à côté après une mort.
  const CHECKPOINTS = [
    { x: 10, z: 162, spawn: { x: 4, z: 162 }, name: 'Castle Courtyard' },
    { x: 20, z: 252, spawn: { x: 16, z: 255 }, name: 'Upper Gallery' }
  ];
  // Emprise du château : le relief de la colline y est aplani sous les sols (décor seulement).
  const FOOTPRINT = [
    [-31.5, 31.5, 157, 193],
    [-23, 23, 190, 222],
    [-27, 27, 219, 265],
    [-17, 17, 262, 306]
  ];
  const inR = (R, x, z) => x >= R[0] && x <= R[1] && z >= R[2] && z <= R[3];
  // Hauteur du sol du château en (x, z), ou null hors de ses sols.
  function floorAt(x, z) {
    for (const F of FLOORS) {
      if (!inR(F.r, x, z)) continue;
      if (F.y != null) return F.y;
      const t = Math.max(0, Math.min(1, (z - F.r[2]) / (F.r[3] - F.r[2])));
      return F.y0 + (F.y1 - F.y0) * t;
    }
    return null;
  }
  return {
    base: BASE,
    gallery: GALLERY,
    summit: SUMMIT,
    gate: { x: 0, z: 157 },
    lever: LEVER,
    top: { x: 0, z: 296, name: 'Keep Summit' }, // but final (cadre du bas)
    floors: FLOORS,
    walls: WALLS,
    towers: TOWERS,
    columns: COLUMNS,
    camps: CAMPS,
    checkpoints: CHECKPOINTS,
    footprint: FOOTPRINT,
    inFootprint: (x, z) => FOOTPRINT.some(R => inR(R, x, z)),
    floorAt
  };
})();
