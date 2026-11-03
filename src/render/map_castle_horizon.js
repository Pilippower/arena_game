'use strict';
// Horizon de la carte « castle » : prairie et forêt hors de l'arène, montagnes, château au loin, décor fantasy
// (cristaux, îles flottantes, feux follets). Appelé par map_castle.js (ArenaEnv.castleHorizon), chargé avant lui.
(function () {
  if (!window.ArenaEnv?.registerMap) return;
  const { smooth, rng, noise2, tex, stoneCanvas, grassCanvas, glowTexture } = ArenaEnv.helpers;
  let E = null; // état du décor (environment.js)

  // ---- Extérieur : collines herbeuses, forêt de conifères, montagnes bleutées ----
  function buildOutside(THREE, S, arena) {
    const hx = arena.halfX,
      hz = arena.halfZ,
      r = rng(99);
    const grass = tex(THREE, grassCanvas(256));
    grass.repeat.set(160, 160);
    const terr = new THREE.PlaneGeometry(1400, 1400, 120, 120);
    terr.rotateX(-Math.PI / 2);
    const pos = terr.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        d = Math.max(Math.abs(x) - hx, Math.abs(z) - hz, 0);
      pos.setY(
        i,
        -0.05 +
          smooth(4, 60, d) * (noise2(x * 0.006 + 9, z * 0.006 + 9, 256, 4) * 26 - 6) +
          smooth(200, 600, Math.hypot(x, z)) * 40
      );
    }
    terr.computeVertexNormals();
    const tm = new THREE.Mesh(terr, new THREE.MeshStandardMaterial({ map: grass, color: 0x8aa2c8, roughness: 0.95 }));
    tm.receiveShadow = true;
    tm.position.y = -0.03;
    S.add(tm);
    E.terrainY = (x, z) => {
      const d = Math.max(Math.abs(x) - hx, Math.abs(z) - hz, 0);
      return (
        -0.08 +
        smooth(4, 60, d) * (noise2(x * 0.006 + 9, z * 0.006 + 9, 256, 4) * 26 - 6) +
        smooth(200, 600, Math.hypot(x, z)) * 40
      );
    };
    // conifères instanciés (tronc + 3 étages de feuillage)
    const N = E.mobile ? 220 : 520,
      trunk = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.18, 0.3, 2, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 }),
        N
      );
    // étages de branches irréguliers (silhouette moins géométrique)
    const tierGeo = k => {
      const gg = new THREE.ConeGeometry(2.3 - k * 0.55, 3.3 - k * 0.4, 11, 2),
        gp = gg.attributes.position,
        rj = rng(k + 3);
      for (let i = 0; i < gp.count; i++) {
        const y = gp.getY(i);
        if (y < 0) {
          const f = 1 + (rj() - 0.5) * 0.45;
          gp.setX(i, gp.getX(i) * f);
          gp.setZ(i, gp.getZ(i) * f);
          gp.setY(i, y - rj() * 0.35);
        }
      }
      gg.computeVertexNormals();
      return gg;
    };
    const tiers = [0, 1, 2, 3].map(
      k => new THREE.InstancedMesh(tierGeo(k), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), N)
    );
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      p = new THREE.Vector3(),
      col = new THREE.Color();
    let n = 0;
    while (n < N) {
      const a = r() * Math.PI * 2,
        d = 48 + Math.pow(r(), 1.4) * 190,
        x = Math.sin(a) * d * 1.2,
        z = Math.cos(a) * d;
      if (Math.abs(x) < hx + 8 && Math.abs(z) < hz + 8) continue;
      if (z < -hz - 4 && Math.abs(x) < 75) continue; // dégagement : le château reste visible
      const sc = 1.4 + r() * 1.8,
        y = E.terrainY(x, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6);
      m.compose(p.set(x, y + sc, z), q, s.setScalar(sc));
      trunk.setMatrixAt(n, m);
      col.setHSL(0.4 + r() * 0.08, 0.32 + r() * 0.2, 0.08 + r() * 0.06);
      tiers.forEach((t, k) => {
        m.compose(p.set(x, y + sc * (2.4 + k * 1.35), z), q, s.setScalar(sc * (1 - k * 0.06)));
        t.setMatrixAt(n, m);
        t.setColorAt(n, col);
      });
      n++;
    }
    for (const t of [trunk, ...tiers]) S.add(t);
    // chaîne de montagnes au loin (brume)
    const mMat = new THREE.MeshStandardMaterial({ color: 0x2a3264, roughness: 1, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xaabaf0, roughness: 0.9, flatShading: true });
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 + r() * 0.1,
        d = 520 + r() * 160,
        h = 90 + r() * 170,
        w = 90 + r() * 90;
      const geo = new THREE.ConeGeometry(w, h, 9, 4);
      const gp = geo.attributes.position;
      for (let i = 0; i < gp.count; i++) {
        const y = gp.getY(i);
        if (y < h / 2 - 1) {
          gp.setX(i, gp.getX(i) * (1 + (r() - 0.5) * 0.25));
          gp.setZ(i, gp.getZ(i) * (1 + (r() - 0.5) * 0.25));
        }
      }
      geo.computeVertexNormals();
      const mt = new THREE.Mesh(geo, mMat);
      mt.position.set(Math.sin(a) * d, h / 2 - 20, Math.cos(a) * d);
      S.add(mt);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.28, h * 0.28, 9), snow);
      cap.position.set(mt.position.x, h - 20 - h * 0.14 + 0.5, mt.position.z);
      S.add(cap);
    }
  }

  // ---- Château sur un promontoire, au-delà du rempart nord ----
  function buildCastle(THREE, S, arena) {
    const cz = -arena.halfZ - 230,
      base = 0,
      g = new THREE.Group();
    g.position.set(0, 0, cz);
    g.scale.setScalar(1.25);
    const masonry = tex(
      THREE,
      stoneCanvas({ size: 512, rows: 10, minW: 0.15, maxW: 0.3, base: [0.66, 0.64, 0.62], seed: 31, warp: 2 })
    );
    const wall = new THREE.MeshStandardMaterial({ map: masonry, roughness: 0.9 }),
      roof = new THREE.MeshStandardMaterial({ color: 0x2b4f8f, roughness: 0.55, metalness: 0.15 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8ae58, metalness: 0.8, roughness: 0.35 }),
      win = new THREE.MeshBasicMaterial({ color: 0xffc56a });
    const rock = new THREE.MeshStandardMaterial({ color: 0x121119, roughness: 1, flatShading: true });
    // promontoire rocheux
    const hill = new THREE.CylinderGeometry(66, 96, 30, 18, 4);
    const hp = hill.attributes.position,
      rr = rng(5);
    for (let i = 0; i < hp.count; i++) {
      const y = hp.getY(i);
      if (y > -14 && y < 10) {
        hp.setX(i, hp.getX(i) * (1 + (rr() - 0.5) * 0.18));
        hp.setZ(i, hp.getZ(i) * (1 + (rr() - 0.5) * 0.18));
      }
    }
    hill.computeVertexNormals();
    const hm = new THREE.Mesh(hill, rock);
    hm.position.y = base + 12;
    g.add(hm);
    const turf = new THREE.Mesh(
      new THREE.CylinderGeometry(67, 67, 1.2, 18),
      new THREE.MeshStandardMaterial({ color: 0x22382f, roughness: 1 })
    );
    turf.position.y = base + 27.2;
    g.add(turf);
    const top = base + 27;
    const uvScale = (geo, sx, sy) => {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
      return geo;
    };
    const tower = (x, z, r, h, roofH, flag) => {
      const t = new THREE.Mesh(uvScale(new THREE.CylinderGeometry(r, r * 1.08, h, 14), r * 2, h / 6), wall);
      t.position.set(x, top + h / 2, z);
      g.add(t);
      const cr = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 1.6, 14), wall);
      cr.position.set(x, top + h + 0.8, z);
      g.add(cr);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, roofH, 14), roof);
      rf.position.set(x, top + h + 1.6 + roofH / 2, z);
      g.add(rf);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), gold);
      sp.position.set(x, top + h + 1.6 + roofH + 2, z);
      g.add(sp);
      if (flag) {
        const f = new THREE.Mesh(
          new THREE.PlaneGeometry(4, 2.2),
          new THREE.MeshStandardMaterial({ color: 0x8a1c22, side: THREE.DoubleSide })
        );
        f.position.set(x + 2.1, top + h + 1.6 + roofH + 3, z);
        g.add(f);
      }
      for (let k = 0; k < Math.floor(h / 7); k++) {
        const a = k * 1.7,
          w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), win);
        w.position.set(x + Math.sin(a) * (r + 0.06), top + 5 + k * 6.5, z + Math.cos(a) * (r + 0.06));
        w.rotation.y = a;
        g.add(w);
      }
    };
    const block = (x, z, w, d, h) => {
      const b = new THREE.Mesh(uvScale(new THREE.BoxGeometry(w, h, d), Math.max(w, d) / 6, h / 6), wall);
      b.position.set(x, top + h / 2, z);
      g.add(b);
      for (let t = -w / 2 + 1; t < w / 2; t += 2.4) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, d + 0.3), wall);
        m.position.set(x + t, top + h + 0.7, z);
        g.add(m);
      }
      return b;
    };
    // enceinte + tours d'angle
    block(0, 32, 90, 4, 14);
    block(0, -32, 90, 4, 14);
    const side = new THREE.Mesh(uvScale(new THREE.BoxGeometry(4, 14, 64), 10, 2.3), wall);
    side.position.set(-45, top + 7, 0);
    g.add(side);
    const s2 = side.clone();
    s2.position.x = 45;
    g.add(s2);
    for (const [x, z] of [
      [-45, 32],
      [45, 32],
      [-45, -32],
      [45, -32]
    ])
      tower(x, z, 6, 22, 12, false);
    // châtelet d'entrée
    tower(-9, 34, 4.5, 24, 9, true);
    tower(9, 34, 4.5, 24, 9, true);
    block(0, 34, 14, 6, 18);
    // donjon et flèches
    block(0, -4, 38, 30, 30);
    const roofKeep = new THREE.Mesh(new THREE.ConeGeometry(26, 16, 4), roof);
    roofKeep.rotation.y = Math.PI / 4;
    roofKeep.scale.z = 0.8;
    roofKeep.position.set(0, top + 30 + 1.4 + 8, -4);
    g.add(roofKeep);
    tower(-16, 8, 5, 46, 18, true);
    tower(16, 8, 5, 46, 18, true);
    tower(0, -16, 7, 62, 24, true);
    tower(-22, -20, 4, 38, 14, false);
    tower(22, -20, 4, 38, 14, false);
    for (let k = 0; k < 10; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3), win);
      w.position.set(-15 + k * 3.4, top + 12 + (k % 2) * 8, 11.05);
      g.add(w);
    }
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 2.2, 260, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8a6cff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      })
    );
    beam.position.set(0, top + 62 + 24 + 130, -16);
    beam.userData.dynamic = true;
    g.add(beam);
    const bg = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(THREE),
        color: 0xb090ff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false
      })
    );
    bg.position.set(0, top + 62 + 24 + 4, -16);
    bg.scale.setScalar(40);
    g.add(bg);
    g.traverse(o => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    S.add(g);
    E.castle = g;
  }

  // ---- Merveilles du monde extérieur : cristaux lumineux, îles flottantes, champignons, lucioles ----
  function buildFantasy(THREE, S, arena) {
    const hx = arena.halfX,
      hz = arena.halfZ,
      r = rng(321),
      glow = glowTexture(THREE);
    E.floaters = [];
    const ty = (x, z) => (E.terrainY ? E.terrainY(x, z) : 0);
    // cristaux géants (instanciés) dans la forêt et sur les collines
    const N = E.mobile ? 40 : 90,
      cg = new THREE.OctahedronGeometry(1, 0);
    cg.scale(0.45, 1.6, 0.45);
    const cm = new THREE.MeshStandardMaterial({
      color: 0x9fd8ff,
      emissive: 0x3b7dff,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.1,
      flatShading: true
    });
    const cry = new THREE.InstancedMesh(cg, cm, N * 3),
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      p = new THREE.Vector3(),
      col = new THREE.Color();
    let n = 0;
    const sprites = [];
    for (let k = 0; k < N; k++) {
      const a = r() * Math.PI * 2,
        d = 55 + Math.pow(r(), 1.2) * 170,
        x = Math.sin(a) * d * 1.2,
        z = Math.cos(a) * d;
      if (z < -hz - 4 && Math.abs(x) < 75) continue;
      const y = ty(x, z),
        sc = 1 + r() * 2.6,
        violet = r() < 0.4;
      for (let j = 0; j < 3; j++) {
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.8, r() * 6, (r() - 0.5) * 0.8));
        m.compose(
          p.set(x + (r() - 0.5) * 1.5 * sc, y + sc * (j ? 0.6 : 1.1), z + (r() - 0.5) * 1.5 * sc),
          q,
          s.setScalar(sc * (j ? 0.55 : 1))
        );
        cry.setMatrixAt(n, m);
        cry.setColorAt(n, col.set(violet ? 0xd9a8ff : 0x9fe4ff));
        n++;
      }
      if (k % 3 === 0) {
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glow,
            color: violet ? 0xa070ff : 0x4aa8ff,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: 0.55
          })
        );
        sp.position.set(x, y + sc * 1.2, z);
        sp.scale.setScalar(sc * 5);
        S.add(sp);
        sprites.push(sp);
      }
    }
    cry.count = n;
    S.add(cry);
    // champignons bioluminescents au pied des remparts (extérieur)
    const mush = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x70e8ff, emissive: 0x1fb8ff, emissiveIntensity: 1.4, roughness: 0.5 }),
      E.mobile ? 60 : 160
    );
    const stem = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8e6ff, emissive: 0x203050, roughness: 0.8 }),
      E.mobile ? 60 : 160
    );
    let mn = 0;
    while (mn < mush.count) {
      const side = (r() * 4) | 0,
        t = r() * 2 - 1,
        o = 3 + r() * 14,
        x = side < 2 ? (side ? 1 : -1) * (hx + o) : t * (hx + o),
        z = side < 2 ? t * (hz + o) : (side === 2 ? 1 : -1) * (hz + o);
      const sc = 0.4 + r() * 1.1,
        y = ty(x, z);
      m.compose(p.set(x, y + 0.6 * sc, z), q.identity(), s.setScalar(sc));
      mush.setMatrixAt(mn, m);
      m.compose(p.set(x, y + 0.3 * sc, z), q, s.setScalar(sc));
      stem.setMatrixAt(mn, m);
      mush.setColorAt(mn, col.setHSL(0.52 + r() * 0.25, 0.8, 0.6));
      mn++;
    }
    S.add(mush, stem);
    // îles flottantes (roche, gazon, sapins, cristal), qui dérivent doucement
    const rock = new THREE.MeshStandardMaterial({ color: 0x3a3a52, roughness: 1, flatShading: true }),
      turf = new THREE.MeshStandardMaterial({ color: 0x2c5a52, roughness: 1 });
    const pine = new THREE.MeshStandardMaterial({ color: 0x1f4a4a, roughness: 0.9, flatShading: true });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4,
        d = 150 + r() * 120,
        g = new THREE.Group(),
        R = 8 + r() * 12;
      const geo = new THREE.ConeGeometry(R, R * 1.6, 9, 3);
      geo.rotateX(Math.PI);
      const gp = geo.attributes.position;
      for (let i = 0; i < gp.count; i++) {
        gp.setX(i, gp.getX(i) * (1 + (r() - 0.5) * 0.3));
        gp.setZ(i, gp.getZ(i) * (1 + (r() - 0.5) * 0.3));
      }
      geo.computeVertexNormals();
      const rk = new THREE.Mesh(geo, rock);
      rk.position.y = -R * 0.8;
      g.add(rk);
      const tf = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.8, 9), turf);
      g.add(tf);
      for (let j = 0; j < 4; j++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.5, 7), pine);
        t.position.set((r() - 0.5) * R, 2.4, (r() - 0.5) * R);
        g.add(t);
      }
      const c = new THREE.Mesh(cg, cm);
      c.scale.setScalar(1.8);
      c.position.set((r() - 0.5) * R * 0.5, 3, (r() - 0.5) * R * 0.5);
      g.add(c);
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0x6ab0ff,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.6
        })
      );
      sp.position.copy(c.position);
      sp.scale.setScalar(16);
      g.add(sp);
      g.position.set(Math.sin(a) * d * 1.2, 45 + r() * 55, Math.cos(a) * d);
      if (g.position.z < -hz - 60 && Math.abs(g.position.x) < 90) g.position.x += Math.sign(g.position.x || 1) * 110;
      S.add(g);
      E.floaters.push({ g, y: g.position.y, ph: r() * 6 });
    }
    // lucioles : points lumineux qui flottent autour de l'arène et dans la forêt
    const FN = E.mobile ? 160 : 420,
      fp = new Float32Array(FN * 3),
      fo = new Float32Array(FN);
    for (let i = 0; i < FN; i++) {
      const inside = i < FN * 0.35,
        a = r() * Math.PI * 2,
        d = inside ? 0 : hx + 6 + r() * 60;
      const x = inside ? (r() * 2 - 1) * hx * 0.95 : Math.sin(a) * d * 1.1,
        z = inside ? (r() * 2 - 1) * hz * 0.95 : Math.cos(a) * d;
      fp[i * 3] = x;
      fp[i * 3 + 1] = 0.4 + r() * 3.5 + (inside ? 0 : ty(x, z));
      fp[i * 3 + 2] = z;
      fo[i] = r() * 100;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    fg.setAttribute('ph', new THREE.BufferAttribute(fo, 1));
    const fm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: E.time, map: { value: glow } },
      vertexShader:
        'attribute float ph;uniform float time;varying float vA;void main(){vec3 p=position+vec3(sin(time*.5+ph)*.8,sin(time*.9+ph*1.7)*.4,cos(time*.4+ph)*.8);vA=.4+.6*max(0.,sin(time*2.3+ph*3.));vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(26.,90./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}',
      fragmentShader:
        'uniform sampler2D map;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vec3(.75,1.,.55)*t.rgb*vA,t.a*vA);}'
    });
    const ff = new THREE.Points(fg, fm);
    ff.frustumCulled = false;
    S.add(ff);
  }

  ArenaEnv.castleHorizon = (THREE, S, arena, env) => {
    E = env;
    buildOutside(THREE, S, arena);
    buildCastle(THREE, S, arena);
    buildFantasy(THREE, S, arena);
  };
})();
