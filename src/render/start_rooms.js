'use strict';
// Salles de départ, toutes cartes (three.js) : sol, murs et poterne de chaque porte, herse qui se lève à l'ouverture.
// Géométrie de jeu : arena.rooms et leur repère roomFrame / roomWorld (src/data/maps.js : a le long de l'axe de la
// salle, b le long de son rempart ; tout est construit dans ce repère, salles ouest / est ou sud / nord). Chaque carte (map_<id>.js) habille ses salles avec ses
// matériaux (ArenaEnv.startRooms), laisse l'ouverture dans son rempart (ArenaEnv.doorGap) et écarte son décor
// extérieur des salles (ArenaEnv.inRoomArea). Ouverture de la herse : ArenaEnv.setGates(0..1), donnée à chaque image
// par render/world.js d'après la manche. Aucune lumière ajoutée (nombre de lumières constant).
(function () {
  if (!window.ArenaEnv?.registerMap) return;
  const PASS_H = 2.9, // hauteur libre sous la herse levée / sous la poterne (m)
    LIFT = 2.7, // course de la herse (m)
    ROOM_WALL = 0.8, // épaisseur des murs des salles
    POST = 0.7; // largeur d'un piédroit de la poterne
  let gates = [],
    open = 1;

  // Ouverture à laisser dans le rempart perpendiculaire à l'axe axis ('x' : remparts ouest / est, 'z' : sud / nord),
  // du côté side : [min, max] le long du rempart, ou null sans salle. Le rempart s'arrête au milieu des piédroits :
  // arrêté pile sur leur face intérieure, ses faces se confondaient avec elles et scintillaient (05/11/2026).
  function doorGap(arena, axis, side) {
    const r = arena.rooms?.find(q => q.axis === axis && q.side === side);
    return r ? [r.at - r.door - POST / 2, r.at + r.door + POST / 2] : null;
  }
  // (x, z) dans l'emprise d'une salle et de ses murs, agrandie de pad : arbres, rochers, relief à écarter.
  function inRoomArea(arena, x, z, pad = 0) {
    return (arena.rooms || []).some(r => {
      const { a, b } = roomFrame(r, x, z);
      return (
        r.side * a > r.half - pad &&
        r.side * a < r.half + r.wall + r.depth + ROOM_WALL + pad &&
        Math.abs(b - r.at) < r.halfW + ROOM_WALL + pad
      );
    });
  }
  // Distance d'un point au-delà de l'arène et des salles (0 dedans) : relief et forêt autour s'écartent des salles.
  function outsideDist(arena, x, z) {
    let d = Math.max(Math.abs(x) - arena.halfX, Math.abs(z) - arena.halfZ, 0);
    for (const r of arena.rooms || []) {
      const { a, b } = roomFrame(r, x, z);
      d = Math.min(
        d,
        Math.max(
          r.side * a - (r.half + r.wall + r.depth + ROOM_WALL),
          r.half - r.side * a,
          Math.abs(b - r.at) - (r.halfW + ROOM_WALL),
          0
        )
      );
    }
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
    const T = ROOM_WALL;
    for (const r of arena.rooms || []) {
      const s = r.side,
        h = r.half,
        x1 = h + r.wall + r.depth, // mur du fond
        len = x1 - h,
        z = r.at,
        across = r.axis === 'z',
        // bloc dans le repère de la salle : wa le long de son axe, wb le long de son rempart
        rbox = (wa, hh, wb, a, y, b, mat) => {
          const p = roomWorld(r, a, b);
          return across ? box(wb, hh, wa, p.x, y, p.z, mat) : box(wa, hh, wb, p.x, y, p.z, mat);
        },
        place = (o, a, y, b) => {
          const p = roomWorld(r, a, b);
          o.position.set(p.x, y, p.z);
        };
      // sol de la salle et du passage de la porte
      const fl = new THREE.Mesh(
        across ? new THREE.PlaneGeometry(r.halfW * 2 + T, len + T) : new THREE.PlaneGeometry(len + T, r.halfW * 2 + T),
        floor
      );
      fl.rotation.x = -Math.PI / 2;
      place(fl, s * (h + (len + T) / 2), 0.02, z);
      fl.receiveShadow = true;
      S.add(fl);
      // murs : fond et côtés, avec chaperon
      rbox(T, wallH, r.halfW * 2 + T * 2, s * (x1 + T / 2), wallH / 2, z, wall);
      rbox(T + 0.3, 0.3, r.halfW * 2 + T * 2 + 0.3, s * (x1 + T / 2), wallH + 0.15, z, cap);
      for (const k of [-1, 1]) {
        const b = z + k * (r.halfW + T / 2);
        rbox(len, wallH, T, s * (h + len / 2), wallH / 2, b, wall);
        rbox(len + 0.3, 0.3, T + 0.3, s * (h + len / 2), wallH + 0.15, b, cap);
      }
      // poterne : piédroits et linteau qui dépassent du rempart ; la herse se lève dans le linteau. Le linteau tient
      // entre les piédroits sans les recouvrir : deux blocs superposés ont des faces confondues qui scintillent
      // (« les piliers tremblent », 05/11/2026).
      const top = wallH + 1.4,
        w = r.door * 2;
      for (const k of [-1, 1])
        rbox(r.wall + 0.6, top, POST, s * (h + r.wall / 2), top / 2, z + k * (r.door + POST / 2), wall);
      rbox(r.wall + 0.6, top - PASS_H, w, s * (h + r.wall / 2), (top + PASS_H) / 2, z, wall);
      rbox(r.wall + 0.9, 0.3, w + 1.7, s * (h + r.wall / 2), top + 0.15, z, cap);
      const g = portcullis(THREE, w, PASS_H + 0.2, iron);
      place(g, s * (h - 0.12), 0, z);
      if (across) g.rotation.y = Math.PI / 2; // barreaux le long du rempart sud / nord
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
