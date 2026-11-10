'use strict';
// Décor du château du monde PVE (three.js, procédural), dessiné d'après ses données (PVE_CASTLE, src/pve/castle.js,
// reçu par arena.world.castle) : sols dallés et escaliers en marches, murs et créneaux, massifs de maçonnerie, tours à
// toit pointu, châtelet et herse (levée quand state.pve.gateOpen) avec son levier, colonnes de la grande salle, bannières, torches,
// trône et faisceau au sommet du donjon. La collision vient des mêmes données (arena.walls, arena.pillars) : ce
// fichier ne fait que les habiller. Appelé par la carte 'pve' (render/map_pve.js, PveDecor.castle) ; jamais en PvP.
(function () {
  if (!window.PveDecor) return;
  const { tex, glowTexture, flameTexture, stoneCanvas, boxUV, rng } = ArenaEnv.helpers;
  const { lin, at, instanced } = PveDecor;
  const STEP_RISE = 0.32, // m : hauteur d'une marche des escaliers (la pente du jeu passe au milieu de chaque marche)
    CRENEL_H = 1.3, // m : hauteur des merlons (le haut du mur de collision passe à mi-merlon)
    SLAB = 1.5, // m : épaisseur des dalles sous les sols
    WALL_TILE = 3, // m couverts par la texture de maçonnerie (vue de près dans le château : pierres à taille humaine)
    FLOOR_TILE = 3;

  function materials(THREE, E) {
    const size = E.mobile ? 256 : 512,
      stone = (o = {}) =>
        tex(
          THREE,
          stoneCanvas({
            size,
            rows: 9,
            minW: 0.14,
            maxW: 0.28,
            base: [0.5, 0.5, 0.56],
            moss: 0.25,
            seed: 33,
            warp: 2,
            ...o
          })
        );
    return {
      wall: new THREE.MeshStandardMaterial({ map: stone(), color: lin(THREE, 0xa89c92), roughness: 0.92 }),
      flag: new THREE.MeshStandardMaterial({
        map: stone({ rows: 5, minW: 0.18, maxW: 0.34, base: [0.44, 0.42, 0.42], moss: 0.4, seed: 71 }),
        color: lin(THREE, 0xb8a898),
        roughness: 0.95
      }),
      hall: new THREE.MeshStandardMaterial({
        map: stone({ rows: 6, minW: 0.24, maxW: 0.26, base: [0.36, 0.34, 0.4], vary: 0.08, moss: 0.1, seed: 9 }),
        color: lin(THREE, 0xa8a0b8),
        roughness: 0.85
      }),
      roof: new THREE.MeshStandardMaterial({ color: 0x2c2448, roughness: 0.6, metalness: 0.2 }),
      win: new THREE.MeshBasicMaterial({ color: lin(THREE, 0xc87a30) }),
      iron: new THREE.MeshStandardMaterial({ color: 0x1d1d24, metalness: 0.7, roughness: 0.45 }),
      banner: new THREE.MeshStandardMaterial({ color: lin(THREE, 0x5a1c2a), roughness: 0.9, side: THREE.DoubleSide }),
      gold: new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.7, roughness: 0.4 }),
      wood: new THREE.MeshStandardMaterial({ color: lin(THREE, 0x6b4a2e), roughness: 0.8 })
    };
  }
  // boîte texturée (texture à l'échelle de chaque face), ombres portées et reçues
  function boxer(THREE, S, M) {
    return (x, y, z, w, h, d, mat = M.wall, yaw = 0, tile = WALL_TILE) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      boxUV(geo, w, h, d, tile);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.y = yaw;
      m.castShadow = m.receiveShadow = true;
      S.add(m);
      return m;
    };
  }

  // ---- Sols : dalles (cour, galerie), carrelage (grande salle, sommet), escaliers en marches ----
  function buildFloors(THREE, S, C, M, box) {
    for (const F of C.floors) {
      const [x0, x1, z0, z1] = F.r,
        w = x1 - x0,
        cx = (x0 + x1) / 2;
      if (F.y != null) {
        box(cx, F.y - SLAB / 2, (z0 + z1) / 2, w, SLAB, z1 - z0, M[F.tile], 0, FLOOR_TILE);
        continue;
      }
      const n = Math.max(1, Math.round((F.y1 - F.y0) / STEP_RISE)),
        rise = (F.y1 - F.y0) / n,
        d = (z1 - z0) / n,
        geo = boxUV(new THREE.BoxGeometry(w, 0.7, d), w, 0.7, d, FLOOR_TILE),
        steps = [];
      for (let k = 0; k < n; k++) steps.push(at(THREE, cx, F.y0 + (k + 0.5) * rise - 0.35, z0 + (k + 0.5) * d));
      instanced(THREE, S, [[geo, M.flag]], steps);
    }
  }
  // ---- Murs : maçonnerie jusque sous le relief, créneaux, massifs pleins ----
  function buildWalls(THREE, S, W, C, M, box) {
    const merlons = [];
    for (const w of C.walls) {
      if (w.ghost || w.gate) continue;
      const L = Math.hypot(w.bx - w.ax, w.bz - w.az),
        yaw = -Math.atan2(w.bz - w.az, w.bx - w.ax),
        ux = (w.bx - w.ax) / L,
        uz = (w.bz - w.az) / L;
      // pied du mur sous le terrain le plus bas qui le longe (pas de vide sous les pierres)
      let low = C.base - SLAB;
      for (let s = 0; s <= L; s += 3)
        for (const k of [-1, 1])
          low = Math.min(
            low,
            W.heightAt(w.ax + ux * s - uz * k * (w.t + 0.5), w.az + uz * s + ux * k * (w.t + 0.5)) - 2
          );
      const top = w.crenel ? w.h - CRENEL_H / 2 : w.h;
      box(
        (w.ax + w.bx) / 2,
        (low + top) / 2,
        (w.az + w.bz) / 2,
        L + (w.fill ? 0 : 0.02),
        top - low,
        w.t * 2,
        M.wall,
        yaw
      );
      if (!w.crenel) continue;
      for (let s = 0.9; s < L - 0.4; s += 2.3)
        merlons.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(w.ax + ux * s, top + CRENEL_H / 2, w.az + uz * s),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
            new THREE.Vector3(1, 1, w.t * 2 + 0.2)
          )
        );
    }
    instanced(
      THREE,
      S,
      [[boxUV(new THREE.BoxGeometry(1.1, CRENEL_H, 1), 1.1, CRENEL_H, 1, WALL_TILE), M.wall]],
      merlons
    );
  }
  // cylindre texturé : la maçonnerie garde la taille de ses pierres (tour, colonne)
  function stoneCylinder(THREE, r, h, M) {
    const geo = new THREE.CylinderGeometry(r, r * 1.1, h, 14),
      uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (uv.getX(i) * 2 * Math.PI * r) / WALL_TILE, (uv.getY(i) * h) / WALL_TILE);
    const m = new THREE.Mesh(geo, M.wall);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  // ---- Tours : fût jusque sous le relief, toit pointu, fenêtres éclairées tournées vers la vallée ----
  function buildTowers(THREE, S, C, M) {
    for (const t of C.towers) {
      const h = t.h - (C.base - 8),
        body = stoneCylinder(THREE, t.r, h, M);
      body.position.set(t.x, C.base - 8 + h / 2, t.z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(t.r * 1.3, t.roof, 14), M.roof);
      roof.position.set(t.x, t.h + t.roof / 2, t.z);
      roof.castShadow = true;
      S.add(body, roof);
      for (let k = 0; k < Math.floor((t.h - C.base) / 6); k++) {
        const a = Math.PI + (k % 2 ? 0.5 : -0.4),
          w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), M.win);
        w.position.set(t.x + Math.sin(a) * (t.r + 0.05), C.base + 4 + k * 5.5, t.z + Math.cos(a) * (t.r + 0.05));
        w.rotation.y = a;
        S.add(w);
      }
    }
  }
  // ---- Châtelet : linteau au-dessus de la porte, herse levée par le levier (state.pve.gateOpen) ----
  function buildGate(THREE, S, C, M, box, E) {
    const G = C.gate,
      gw = C.walls.find(w => w.gate),
      span = gw.bx - gw.ax;
    box(G.x, gw.h + 1, G.z, span + 1, 2, 3.4);
    const gate = new THREE.Group();
    for (let k = -3; k <= 3; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, gw.h - C.base, 0.16), M.iron);
      bar.position.set((k * span) / 7.4, (gw.h - C.base) / 2, 0);
      gate.add(bar);
    }
    for (let k = 0; k < 5; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(span, 0.16, 0.16), M.iron);
      bar.position.set(0, 0.8 + k * 1.7, 0);
      gate.add(bar);
    }
    gate.position.set(G.x, C.base, G.z);
    gate.traverse(o => (o.userData.dynamic = true));
    S.add(gate);
    let lift = 0;
    E.anim.push(() => {
      lift += ((state?.pve?.gateOpen ? 1 : 0) - lift) * 0.02;
      gate.position.y = C.base + lift * (gw.h - C.base - 0.4);
    });
  }
  // ---- Levier de la herse (W.lever) : socle de pierre, manche basculé vers le nord quand la herse se lève ; lueur
  // dorée qui pulse sur la poignée tant qu'il reste à tirer (objet cliquable, pve_ui.js pveLeverAtScreen) ----
  const LEVER_TILT = 0.75, // rad, de chaque côté de la verticale
    LEVER_LEN = 1.6; // m, longueur du manche
  function buildLever(THREE, S, W, M, box, E) {
    const L = W.lever,
      y = W.heightAt(L.x, L.z);
    box(L.x, y + 0.45, L.z, 1, 1.1, 1, M.wall, 0);
    box(L.x, y + 1.02, L.z, 1.2, 0.14, 1.2, M.wall, 0);
    const pivot = new THREE.Group(),
      rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, LEVER_LEN, 8), M.wood),
      knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), M.gold),
      axle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 10), M.iron),
      glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture(THREE),
          color: 0xffc860,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false
        })
      );
    rod.position.y = LEVER_LEN / 2;
    knob.position.y = glow.position.y = LEVER_LEN;
    axle.rotation.z = Math.PI / 2; // axe le long du rempart (x) : le manche bascule du sud vers le nord
    pivot.add(rod, knob, axle, glow);
    pivot.position.set(L.x, y + 1.15, L.z);
    pivot.traverse(o => {
      o.castShadow = !o.isSprite;
      o.userData.dynamic = true;
    });
    S.add(pivot);
    let pull = 0;
    E.anim.push(t => {
      pull += ((state?.pve?.gateOpen ? 1 : 0) - pull) * 0.12;
      pivot.rotation.x = -LEVER_TILT + pull * 2 * LEVER_TILT;
      glow.material.opacity = (1 - pull) * (0.55 + 0.35 * Math.sin(t * 3));
      glow.scale.setScalar(1.1 + 0.25 * Math.sin(t * 3));
    });
  }
  // ---- Grande salle en ruine : colonnes, bannières sur les murs ----
  function buildHall(THREE, S, C, M, box) {
    for (const c of C.columns) {
      const h = c.h - C.base,
        shaft = stoneCylinder(THREE, c.r * 0.8, h, M);
      shaft.position.set(c.x, C.base + h / 2, c.z);
      S.add(shaft);
      box(c.x, C.base + 0.3, c.z, c.r * 2.4, 0.6, c.r * 2.4);
      box(c.x, c.h - 0.3, c.z, c.r * 2.4, 0.6, c.r * 2.4);
    }
    const hall = C.floors.find(f => f.id === 'hall'),
      inner = C.walls.find(w => w.ax === 21.5 && w.az === 190);
    for (const sx of [-1, 1])
      for (const z of [200, 212]) {
        const x = sx * (inner.ax - inner.t - 0.06),
          cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.5), M.banner);
        cloth.position.set(x, hall.y + 5, z);
        cloth.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), M.gold);
        rod.rotation.x = Math.PI / 2;
        rod.position.set(x - sx * 0.05, hall.y + 7.8, z);
        S.add(cloth, rod);
      }
  }
  // ---- Torches le long des murs (flammes et halos animés par le moteur) ; une lumière chaude par grande pièce (leur
  // nombre est fixé à la construction : jamais de recompilation en jeu) ----
  const WARM_LIGHTS = [
    [0, 4.5, 205, 1.3, 26], // grande salle
    [0, 9, 236, 1.1, 20] // grand escalier
  ];
  function buildTorches(THREE, S, C, E) {
    for (const [x, dy, z, power, range] of WARM_LIGHTS) {
      const light = new THREE.PointLight(0xff9a50, power, range, 2);
      light.position.set(x, C.base + dy, z);
      S.add(light);
      E.flames.push({ light, k: x + z });
    }
    const flame = flameTexture(THREE),
      glow = glowTexture(THREE),
      spots = [
        ...[-1, 1].flatMap(s => [
          [s * 28.4, C.base, 168],
          [s * 28.4, C.base, 182],
          [s * 19.9, C.base, 197],
          [s * 19.9, C.base, 214],
          [s * 5.9, C.base + 4, 229],
          [s * 5.9, C.base + 8.5, 241],
          [s * 3.9, C.gallery + 4, 271],
          [s * 3.9, C.gallery + 8, 280]
        ])
      ];
    for (const [x, y, z] of spots) {
      const f = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flame,
          color: 0xffb070,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false
        })
      );
      f.position.set(x, y + 3.2, z);
      f.scale.setScalar(0.8);
      const h = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xff9a4a,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.35
        })
      );
      h.position.set(x, y + 3.2, z);
      h.scale.setScalar(3.4);
      S.add(f, h);
      E.flames.push({ s: f, k: x + z });
    }
  }
  // ---- Sommet du donjon : trône du roi, lumière violette et faisceau visible de toute la vallée ----
  function buildSummit(THREE, S, C, M, box) {
    const T = C.top,
      y = C.summit,
      z = T.z + 6;
    box(T.x, y + 0.3, z, 4.4, 0.6, 3);
    box(T.x, y + 1.0, z, 2.2, 1.0, 1.6, M.hall);
    box(T.x, y + 2.6, z + 0.7, 2.4, 4.2, 0.4, M.hall);
    for (const sx of [-1, 1]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 6), M.gold);
      spike.position.set(T.x + sx * 1.05, y + 5.4, z + 0.7);
      S.add(spike);
    }
    const light = new THREE.PointLight(0x9a7cff, 1.6, 30, 2);
    light.position.set(T.x, y + 4, T.z);
    S.add(light);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 2, 220, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x9a7cff,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      })
    );
    beam.position.set(T.x, y + 8 + 110, T.z);
    beam.userData.dynamic = true;
    S.add(beam);
  }
  // fenêtres éclairées sur la façade sud du donjon (vue depuis la vallée)
  function buildKeepWindows(THREE, S, C, M) {
    const r = rng(4);
    for (let k = 0; k < 6; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.5), M.win);
      w.position.set(-20 + k * 8, C.gallery + 3.5 + r() * 2, 262 - 0.04);
      w.rotation.y = Math.PI;
      S.add(w);
    }
  }

  PveDecor.castle = (THREE, S, W, E) => {
    const C = W.castle,
      M = materials(THREE, E),
      box = boxer(THREE, S, M);
    buildFloors(THREE, S, C, M, box);
    buildWalls(THREE, S, W, C, M, box);
    buildTowers(THREE, S, C, M);
    buildGate(THREE, S, C, M, box, E);
    buildLever(THREE, S, W, M, box, E);
    buildHall(THREE, S, C, M, box);
    buildTorches(THREE, S, C, E);
    buildSummit(THREE, S, C, M, box);
    buildKeepWindows(THREE, S, C, M);
  };
})();
