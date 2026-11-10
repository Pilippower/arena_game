'use strict';
// Chemins des monstres dans le monde PVE (10/11/2026, « quand ils reset et qu'il y a un mur, ils ne savent pas faire le
// tour ; pareil quand ils attaquent mon ami derrière le mur ») : grille de PVE_NAV.cell m sur le monde ; une case est
// praticable si pointWalkable (game/combat.js : murs du château, arbres, rochers, limites) au sol de la case. Les
// cases sont calculées à la demande puis gardées jusqu'à un changement des murs (herse : pveNavReset). Ligne droite
// libre de murs (test exact le long du segment, pveNavClear : la grille, trop grossière, laissait viser en travers d'un
// angle de porte où la collision bloquait) : on y va, les arbres sont contournés par aiSteer ; sinon A* de case en case
// (8 voisins, sans couper un coin ni franchir plus de PVE_NAV.climb de dénivelé), et l'on vise le point le plus loin
// du chemin encore atteignable en ligne droite (sinon le plus proche, pour rejoindre le chemin).
// Appelé par aiWaypoint (game/ai.js : poursuite) et pveWalkHome (src/pve/pve.js : retour au camp) ; jamais en arène.
const PVE_NAV = {
  cell: 1, // m
  margin: 1, // m : corps d'un monstre (collision : 0,6 m des murs, WALL_PAD) + de quoi ne pas raser les angles
  climb: 1.2, // m : dénivelé max entre deux cases voisines (marches et rampes passent ; un bord de mur non)
  repath: 0.5, // s : chemin recalculé au plus à ce rythme par monstre quand son but change de case
  maxVisit: 40000, // cases examinées au plus par recherche (but injoignable : on abandonne)
  ahead: 12, // nœuds du chemin regardés pour couper au plus court
  clearPad: 0.8, // m : marge du test de ligne droite contre les murs (collision : WALL_PAD = 0,6 m)
  sample: 0.4, // m : pas de ce test
  reached: 0.6, // m : nœud du chemin atteint
  think: 0.1, // s : point de passage recalculé à ce rythme au plus (coût chez l'hôte)
  grid: null
};
function pveNavReset() {
  PVE_NAV.grid = null;
}
function pveNavGrid() {
  if (PVE_NAV.grid) return PVE_NAV.grid;
  const c = PVE_NAV.cell,
    nx = Math.ceil((2 * arena.halfX) / c) + 1,
    nz = Math.ceil((2 * arena.halfZ) / c) + 1,
    n = nx * nz;
  return (PVE_NAV.grid = {
    nx,
    nz,
    x0: -arena.halfX,
    z0: -arena.halfZ,
    state: new Uint8Array(n), // 0 pas encore vue, 1 praticable, 2 bloquée
    y: new Float32Array(n),
    g: new Float32Array(n),
    from: new Int32Array(n),
    seen: new Uint32Array(n), // numéro de la recherche qui a touché la case (pas de remise à zéro)
    run: 0
  });
}
const navX = (G, id) => G.x0 + (id % G.nx) * PVE_NAV.cell;
const navZ = (G, id) => G.z0 + Math.floor(id / G.nx) * PVE_NAV.cell;
function navCell(G, x, z) {
  const ix = Math.max(0, Math.min(G.nx - 1, Math.round((x - G.x0) / PVE_NAV.cell))),
    iz = Math.max(0, Math.min(G.nz - 1, Math.round((z - G.z0) / PVE_NAV.cell)));
  return ix + iz * G.nx;
}
function navOpen(G, id) {
  if (!G.state[id]) {
    const x = navX(G, id),
      z = navZ(G, id),
      y = terrainY(x, z);
    G.y[id] = y;
    G.state[id] = pointWalkable(x, z, PVE_NAV.margin, y) ? 1 : 2;
  }
  return G.state[id] === 1;
}
// Case praticable la plus proche (un héros collé à un mur est dans la marge d'un monstre).
function navNear(G, id) {
  if (navOpen(G, id)) return id;
  const ix = id % G.nx,
    iz = Math.floor(id / G.nx);
  for (let r = 1; r <= 3; r++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const x = ix + dx,
          z = iz + dz;
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || x < 0 || z < 0 || x >= G.nx || z >= G.nz) continue;
        if (navOpen(G, x + z * G.nx)) return x + z * G.nx;
      }
  return -1;
}
// Ligne droite de a à b sans mur (marge clearPad) ni marche plus haute que climb.
function pveNavClear(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z),
    steps = Math.max(1, Math.ceil(d / PVE_NAV.sample));
  let py = terrainY(a.x, a.z);
  for (let k = 1; k <= steps; k++) {
    const x = a.x + ((b.x - a.x) * k) / steps,
      z = a.z + ((b.z - a.z) * k) / steps,
      y = terrainY(x, z);
    if (Math.abs(y - py) > PVE_NAV.climb || wallAt(x, z, PVE_NAV.clearPad, y)) return false;
    py = y;
  }
  return true;
}
// A* (tas binaire) ; renvoie la liste des cases du départ au but, ou null.
function pveNavPath(G, start, goal) {
  const run = ++G.run,
    gx = goal % G.nx,
    gz = Math.floor(goal / G.nx),
    h = id => {
      const dx = Math.abs((id % G.nx) - gx),
        dz = Math.abs(Math.floor(id / G.nx) - gz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    },
    heap = [[h(start), start]];
  G.seen[start] = run;
  G.g[start] = 0;
  G.from[start] = -1;
  let visits = 0;
  while (heap.length && visits++ < PVE_NAV.maxVisit) {
    const [, cur] = navPop(heap);
    if (cur === goal) {
      const path = [];
      for (let id = cur; id >= 0; id = G.from[id]) path.push(id);
      return path.reverse();
    }
    const cx = cur % G.nx,
      cz = Math.floor(cur / G.nx);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = cx + dx,
          z = cz + dz;
        if (x < 0 || z < 0 || x >= G.nx || z >= G.nz) continue;
        const nb = x + z * G.nx;
        if (!navOpen(G, nb) || Math.abs(G.y[nb] - G.y[cur]) > PVE_NAV.climb) continue;
        if (dx && dz && !(navOpen(G, cx + dx + cz * G.nx) && navOpen(G, cx + (cz + dz) * G.nx))) continue; // coin
        const g = G.g[cur] + (dx && dz ? 1.414 : 1);
        if (G.seen[nb] === run && g >= G.g[nb]) continue;
        G.seen[nb] = run;
        G.g[nb] = g;
        G.from[nb] = cur;
        navPush(heap, [g + h(nb), nb]);
      }
  }
  return null;
}
function navPush(heap, e) {
  heap.push(e);
  for (let i = heap.length - 1; i > 0;) {
    const p = (i - 1) >> 1;
    if (heap[p][0] <= heap[i][0]) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}
function navPop(heap) {
  const top = heap[0],
    last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    for (let i = 0; ;) {
      const l = 2 * i + 1,
        r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}
// Prochain point où aller pour rejoindre goal ({ x, z }) : goal lui-même si la ligne droite est libre (ou s'il n'y a
// pas de chemin), sinon un point du chemin. Chemin et dernier point gardés sur l'unité (u.nav, u.navWp).
function pveNavWaypoint(u, goal) {
  const W = u.navWp;
  if (W && now() - W.t < PVE_NAV.think && W.goal === goal && Math.hypot(W.p.x - u.x, W.p.z - u.z) > PVE_NAV.reached)
    return W.p;
  const p = pveNavPick(u, goal);
  u.navWp = { t: now(), goal, p };
  return p;
}
function pveNavPick(u, goal) {
  if (pveNavClear(u, goal)) {
    u.nav = null;
    return goal;
  }
  const G = pveNavGrid(),
    target = navCell(G, goal.x, goal.z);
  if (!u.nav || (u.nav.target !== target && now() - u.nav.t > PVE_NAV.repath)) {
    const from = navNear(G, navCell(G, u.x, u.z)),
      to = navNear(G, target),
      path = from >= 0 && to >= 0 ? pveNavPath(G, from, to) : null;
    u.nav = { target, t: now(), path: path && path.map(id => ({ x: navX(G, id), z: navZ(G, id), y: G.y[id] })) };
  }
  const P = u.nav.path;
  if (!P?.length) return goal;
  const dist = q => Math.hypot(q.x - u.x, q.z - u.z);
  while (P.length > 1 && dist(P[0]) < PVE_NAV.reached) P.shift();
  for (let k = Math.min(P.length, PVE_NAV.ahead) - 1; k >= 0; k--)
    if (pveNavClear(u, P[k])) {
      P.splice(0, k); // les nœuds d'avant sont coupés au plus court
      return P[0];
    }
  // aucun nœud en ligne droite (poussé contre un mur) : rejoindre le plus proche
  let near = 0;
  for (let k = 1; k < Math.min(P.length, PVE_NAV.ahead); k++) if (dist(P[k]) < dist(P[near])) near = k;
  P.splice(0, near);
  return P[0];
}
