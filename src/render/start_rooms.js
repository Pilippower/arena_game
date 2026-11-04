'use strict';
// Salles de départ, toutes cartes (three.js) : sol, murs et poterne de chaque porte, herse qui se lève à l'ouverture.
// Géométrie de jeu : arena.rooms (src/data/maps.js). Chaque carte (map_<id>.js) habille ses salles avec ses
// matériaux (ArenaEnv.startRooms), laisse l'ouverture dans son rempart (ArenaEnv.doorGap) et écarte son décor
// extérieur des salles (ArenaEnv.inRoomArea). Ouverture de la herse : ArenaEnv.setGates(0..1), donnée à chaque image
// par render/world.js d'après la manche. Aucune lumière ajoutée (nombre de lumières constant).
(function () {
  if (!window.ArenaEnv?.registerMap) return;
  const PASS_H = 2.9, // hauteur libre sous la herse levée / sous la poterne (m)
    LIFT = 2.7, // course de la herse (m)
    ROOM_WALL = 0.8; // épaisseur des murs des salles
  let gates = [],
    open = 1;

  // Ouverture de la porte dans le rempart est (side 1) ou ouest (-1) : [zMin, zMax], ou null sans salle.
  function doorGap(arena, side) {
    const r = arena.rooms?.find(q => q.side === side);
    return r ? [r.z - r.door, r.z + r.door] : null;
  }
  // (x, z) dans l'emprise d'une salle et de ses murs, agrandie de pad : arbres, rochers, relief à écarter.
  function inRoomArea(arena, x, z, pad = 0) {
    return (arena.rooms || []).some(
      r =>
        r.side * x > arena.halfX - pad &&
        r.side * x < arena.halfX + r.wall + r.depth + ROOM_WALL + pad &&
        Math.abs(z - r.z) < r.halfW + ROOM_WALL + pad
    );
  }
  // Distance d'un point au-delà de l'arène et des salles (0 dedans) : relief et forêt autour s'écartent des salles.
  function outsideDist(arena, x, z) {
    let d = Math.max(Math.abs(x) - arena.halfX, Math.abs(z) - arena.halfZ, 0);
    for (const r of arena.rooms || [])
      d = Math.min(
        d,
        Math.max(
          r.side * x - (arena.halfX + r.wall + r.depth + ROOM_WALL),
          arena.halfX - r.side * x,
          Math.abs(z - r.z) - (r.halfW + ROOM_WALL),
          0
        )
      );
    return d;
  }
  // Segments [a, b] d'un mur de longueur [from, to] qui évitent l'ouverture gap (marge m).
  function around(from, to, gap, m = 0) {
    if (!gap) return [[from, to]];
    return [
      [from, gap[0] - m],
      [gap[1] + m, to]
    ].filter(([a, b]) => b - a > 0.05);
  }
  // Herse : barreaux de fer verticaux et traverses, pointes en bas ; groupe animé (exclu de la fusion du décor).
  function portcullis(THREE, width, height, iron) {
    const g = new THREE.Group(),
      bars = Math.max(4, Math.round(width / 0.32)),
      bar = new THREE.CylinderGeometry(0.045, 0.045, height, 6),
      tip = new THREE.ConeGeometry(0.07, 0.22, 6),
      rail = new THREE.BoxGeometry(0.09, 0.09, width);
    const add = (geo, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(geo, iron);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      m.userData.dynamic = true;
      g.add(m);
    };
    for (let i = 0; i < bars; i++) {
      const z = -width / 2 + ((i + 0.5) * width) / bars;
      add(bar, 0, height / 2, z);
      add(tip, 0, -0.08, z, Math.PI);
    }
    for (const y of [0.45, height * 0.5, height - 0.25]) add(rail, 0, y, 0);
    return g;
  }
  // Construit les deux salles : sol (floor), murs et chaperons (wall, cap), poterne dans le rempart de hauteur wallH,
  // herse (iron). box(w, h, d, x, y, z, mat) : bloc texturé de la carte (ajouté à la scène). Chaque carte garde son
  // rempart percé : doorGap.
  function startRooms(THREE, S, arena, E, { floor, wall, cap, iron, wallH, box }) {
    gates = [];
    const hx = arena.halfX,
      T = ROOM_WALL;
    for (const r of arena.rooms || []) {
      const s = r.side,
        x0 = hx + r.wall, // début de la salle (face extérieure du rempart)
        x1 = x0 + r.depth, // mur du fond
        len = x1 - hx;
      // sol de la salle et du passage de la porte
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(len + T, r.halfW * 2 + T), floor);
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(s * (hx + (len + T) / 2), 0.02, r.z);
      fl.receiveShadow = true;
      S.add(fl);
      // murs : fond et côtés, avec chaperon
      box(T, wallH, r.halfW * 2 + T * 2, s * (x1 + T / 2), wallH / 2, r.z, wall);
      box(T + 0.3, 0.3, r.halfW * 2 + T * 2 + 0.3, s * (x1 + T / 2), wallH + 0.15, r.z, cap);
      for (const k of [-1, 1]) {
        const z = r.z + k * (r.halfW + T / 2);
        box(len, wallH, T, s * (hx + len / 2), wallH / 2, z, wall);
        box(len + 0.3, 0.3, T + 0.3, s * (hx + len / 2), wallH + 0.15, z, cap);
      }
      // poterne : piédroits et linteau qui dépassent du rempart ; la herse se lève dans le linteau
      const top = wallH + 1.4,
        w = r.door * 2;
      for (const k of [-1, 1])
        box(r.wall + 0.6, top, 0.7, s * (hx + r.wall / 2), top / 2, r.z + k * (r.door + 0.35), wall);
      box(r.wall + 0.6, top - PASS_H, w + 1.4, s * (hx + r.wall / 2), (top + PASS_H) / 2, r.z, wall);
      box(r.wall + 0.9, 0.3, w + 1.7, s * (hx + r.wall / 2), top + 0.15, r.z, cap);
      const g = portcullis(THREE, w, PASS_H + 0.2, iron);
      g.position.set(s * (hx - 0.12), 0, r.z);
      S.add(g);
      gates.push(g);
    }
    // herse : montée amortie (lente au départ, freinée en haut)
    E.anim.push(() => {
      const k = open * open * (3 - 2 * open);
      for (const g of gates) g.position.y = k * LIFT;
    });
  }
  // Ouverture des portes, 0 = fermées, 1 = levées.
  function setGates(v) {
    open = Math.min(1, Math.max(0, v));
  }
  Object.assign(ArenaEnv, { startRooms, doorGap, inRoomArea, outsideDist, setGates, roomAround: around });
})();
