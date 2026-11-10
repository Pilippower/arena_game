'use strict';
// Décor du monde PVE « The Mistvale Road » (three.js, procédural) : vallée brumeuse au clair de lune, relief et route
// pavée suivant PVE_WORLD (src/pve/world.js, reçu par arena.world), forêts de pins sombres, arbres morts, rochers,
// pierres runiques, lanternes d'esprits, feux de camp (points de reprise), camps de monstres ; le château au bout de
// la route : render/map_pve_castle.js (PveDecor.castle, chargé après ce fichier, avec les outils PveDecor). Les
// obstacles de jeu viennent de arena.pillars ; ce fichier ne fait que les habiller. Carte enregistrée sous l'id 'pve'
// (ArenaEnv.registerMap) ; jamais utilisée en PvP.
(function () {
  if (!window.ArenaEnv?.registerMap) return;
  const { rng, noise, tex, glowTexture, flameTexture, stoneCanvas, grassCanvas, ambientMotes, smooth } =
    ArenaEnv.helpers;
  // couleur choisie à l'œil (sRGB) → valeur linéaire du moteur : sans cela, les teintes sombres ressortaient très claires
  const lin = (THREE, hex) => new THREE.Color(hex).convertSRGBToLinear();
  // outils partagés avec le décor du château (render/map_pve_castle.js) ; complétés plus bas
  const PveDecor = (window.PveDecor = { lin });
  const SHADOW_SPAN = 46, // m : demi-côté de la zone d'ombres portées, recentrée sur le joueur
    SHADOW_MOVE = 14; // m parcourus avant de recalculer la carte d'ombres
  const MOON_DIR = [-0.45, 0.62, 0.64]; // direction de la lune (vers le nord-ouest, haute)

  // ---- Ciel nocturne : dégradé bleu nuit / turquoise, lune et halo, étoiles ----
  function buildSky(THREE, S) {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { md: { value: new THREE.Vector3(...MOON_DIR).normalize() } },
        vertexShader:
          'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform vec3 md;varying vec3 vDir;
          float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
          void main(){float y=vDir.y;
          vec3 hor=vec3(.2,.32,.4),mid=vec3(.08,.12,.24),zen=vec3(.02,.03,.09);
          vec3 c=mix(hor,mid,smoothstep(-.02,.22,y));c=mix(c,zen,smoothstep(.22,.8,y));
          float m=max(dot(vDir,md),0.);c+=vec3(.55,.7,.9)*pow(m,24.)*.5+vec3(.9,.95,1.)*smoothstep(.9985,.999,m);
          vec3 q=floor(vDir*380.);float s=h(q);c+=vec3(.8,.85,1.)*step(.9965,s)*smoothstep(.05,.3,y)*(.5+.5*h(q+1.));
          gl_FragColor=vec4(c,1.);}`
      })
    );
    sky.renderOrder = -100;
    S.add(sky);
  }
  // ---- Lumières : lune (ombres portées autour du joueur), ciel froid, contre-jour violet ----
  function buildLights(THREE, S, E) {
    S.add(new THREE.HemisphereLight(0x7d96c8, 0x161a2a, 0.5));
    const moon = new THREE.DirectionalLight(0xb8ceff, 0.62);
    moon.castShadow = true;
    const sm = E.mobile ? 1024 : 2048;
    moon.shadow.mapSize.set(sm, sm);
    Object.assign(moon.shadow.camera, {
      left: -SHADOW_SPAN,
      right: SHADOW_SPAN,
      top: SHADOW_SPAN,
      bottom: -SHADOW_SPAN,
      near: 1,
      far: 260
    });
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.04;
    S.add(moon, moon.target);
    const rim = new THREE.DirectionalLight(0x9a7cff, 0.3);
    rim.position.set(30, 18, -60);
    S.add(rim);
    // ombres recentrées quand le joueur s'éloigne (carte d'ombres fixe sinon : décor immobile)
    let cx = null,
      cz = null;
    const follow = () => {
      const p = state?.player;
      if (!p) return;
      if (cx != null && Math.hypot(p.x - cx, p.z - cz) < SHADOW_MOVE) return;
      cx = p.x;
      cz = p.z;
      const y = (p.y || 0) + 0;
      moon.target.position.set(cx, y, cz);
      moon.position.set(cx + MOON_DIR[0] * 120, y + MOON_DIR[1] * 120, cz + MOON_DIR[2] * 120);
      moon.target.updateMatrixWorld();
      E.renderer.shadowMap.needsUpdate = true;
    };
    follow();
    E.anim.push(follow);
  }

  // ---- Sol : relief de PVE_WORLD, herbe sombre, route pavée (mélange par sommet), roche sur les pentes ----
  function roadCanvas(size = 512) {
    return stoneCanvas({
      size,
      rows: 7,
      minW: 0.1,
      maxW: 0.2,
      base: [0.46, 0.43, 0.4],
      vary: 0.14,
      grout: [0.13, 0.12, 0.1],
      moss: 0.3,
      seed: 61,
      warp: 7
    });
  }
  function terrainMaterial(THREE, E) {
    const grass = tex(THREE, grassCanvas(E.mobile ? 256 : 512)),
      road = tex(THREE, roadCanvas(E.mobile ? 256 : 512));
    const m = new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 1 });
    m.onBeforeCompile = sh => {
      sh.uniforms.roadMap = { value: road };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aRoad;varying float vRoad;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad=aRoad;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D roadMap;varying float vRoad;')
        .replace(
          '#include <map_fragment>',
          `vec4 texelColor=mix(texture2D(map,vUv),texture2D(roadMap,vUv*.55),vRoad);
           texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;`
        );
    };
    return m;
  }
  // Dans l'emprise du château, le terrain passe juste sous ses dalles (render/map_pve_castle.js) ; pas de terrain plus
  // grand qu'une épaisseur de mur (3 m) : la pente entre deux sommets reste cachée dans les murs.
  const CASTLE_SINK = 0.08;
  function buildTerrain(THREE, S, W, E) {
    const south = -W.valleyZ - 190,
      north = W.halfZ + 100,
      w = (W.halfX + 150) * 2,
      d = north - south,
      step = E.mobile ? 3 : 2.4,
      C = W.castle,
      geo = new THREE.PlaneGeometry(w, d, Math.round(w / step), Math.round(d / step));
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, (south + north) / 2);
    const P = geo.attributes.position,
      uv = geo.attributes.uv,
      col = new Float32Array(P.count * 3),
      roadW = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i),
        z = P.getZ(i),
        inCastle = C.inFootprint(x, z),
        h = inCastle ? C.base - CASTLE_SINK : W.heightAt(x, z),
        rd = Math.abs(x - W.roadX(z)),
        onRoad = z < W.gate.z + 6 ? smooth(W.roadHalf + 0.9, W.roadHalf - 0.6, rd) : 0,
        plaza = smooth(130, 140, z) * smooth(26, 18, Math.abs(x)) * (z < 160 ? 1 : 0);
      P.setY(i, h);
      uv.setXY(i, x / 5, z / 5);
      roadW[i] = Math.max(onRoad, plaza * 0.85);
      // herbe bleu-vert sombre, plaques de mousse claire et de terre, plus froide en altitude
      const n = noise(x * 0.03 + 40, z * 0.03 + 40, 256, 3),
        m = noise(x * 0.11, z * 0.11, 256, 2);
      col[i * 3] = 0.3 + 0.14 * n + 0.08 * m;
      col[i * 3 + 1] = 0.29 + 0.13 * n;
      col[i * 3 + 2] = 0.55 + 0.16 * m;
    }
    geo.computeVertexNormals();
    // roche sur les pentes fortes
    const N = geo.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const steep = smooth(0.86, 0.7, N.getY(i));
      for (let k = 0; k < 3; k++) col[i * 3 + k] = col[i * 3 + k] * (1 - steep) + [0.5, 0.5, 0.58][k] * steep;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aRoad', new THREE.BufferAttribute(roadW, 1));
    const ground = new THREE.Mesh(geo, terrainMaterial(THREE, E));
    ground.receiveShadow = true;
    S.add(ground);
  }

  // ---- Végétation et rochers : maillages instanciés (un appel de dessin par pièce) ----
  // pièces d'un modèle (géométrie, matériau, matrice locale) → une InstancedMesh par pièce, placée à chaque matrice
  function instanced(THREE, S, parts, mats, { shadow = true } = {}) {
    const m4 = new THREE.Matrix4();
    for (const [geo, mat, local] of parts) {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((M, i) => im.setMatrixAt(i, local ? m4.multiplyMatrices(M, local) : M));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = shadow;
      im.receiveShadow = true;
      im.frustumCulled = false; // instances réparties sur tout le monde (la sphère englobante est celle du modèle)
      S.add(im);
    }
  }
  const at = (THREE, x, y, z, s = 1, yaw = 0, sy = s, tilt = 0) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, tilt * 0.6)),
      new THREE.Vector3(s, sy, s)
    );
  const local = (THREE, x, y, z, rx = 0, rz = 0, s = 1) =>
    at(THREE, x, y, z, s, 0, s, 0).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
  Object.assign(PveDecor, { at, instanced });
  // branches irrégulières : sommets décalés au hasard (graine fixe), pointe et base gardées
  function rugged(geo, amp, seed = 3) {
    const P = geo.attributes.position,
      r = rng(seed);
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i);
      if (Math.abs(P.getX(i)) + Math.abs(P.getZ(i)) < 0.01) continue;
      P.setX(i, P.getX(i) * (1 + (r() - 0.5) * amp * 2));
      P.setZ(i, P.getZ(i) * (1 + (r() - 0.5) * amp * 2));
      P.setY(i, y + (r() - 0.5) * amp);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function pineParts(THREE) {
    const bark = new THREE.MeshStandardMaterial({ color: lin(THREE, 0x3b2d28), roughness: 1 }),
      needles = new THREE.MeshStandardMaterial({ color: lin(THREE, 0x1b3a36), roughness: 1, flatShading: true });
    return [
      [new THREE.CylinderGeometry(0.16, 0.3, 3, 6), bark, local(THREE, 0, 1.5, 0)],
      [rugged(new THREE.ConeGeometry(1.9, 3.6, 9, 2), 0.22), needles, local(THREE, 0, 3.4, 0)],
      [rugged(new THREE.ConeGeometry(1.45, 3, 9, 2), 0.2), needles, local(THREE, 0, 5.2, 0)],
      [rugged(new THREE.ConeGeometry(0.95, 2.6, 8, 2), 0.16), needles, local(THREE, 0, 6.9, 0)]
    ];
  }
  function deadTreeParts(THREE) {
    const wood = new THREE.MeshStandardMaterial({ color: lin(THREE, 0x5d5566), roughness: 1, flatShading: true });
    return [
      [new THREE.CylinderGeometry(0.12, 0.34, 4.2, 6), wood, local(THREE, 0, 2.1, 0, 0, 0.06)],
      [new THREE.CylinderGeometry(0.05, 0.12, 2.2, 5), wood, local(THREE, 0.55, 3.4, 0, 0, -0.9)],
      [new THREE.CylinderGeometry(0.05, 0.11, 1.9, 5), wood, local(THREE, -0.45, 3.0, 0.2, 0.3, 0.95)],
      [new THREE.CylinderGeometry(0.04, 0.09, 1.5, 5), wood, local(THREE, 0.1, 3.9, -0.45, -0.85, 0.1)]
    ];
  }
  function buildFlora(THREE, S, W, arena, E) {
    const r = rng(77),
      pines = [],
      dead = [],
      rocks = [],
      stones = [],
      farPines = [];
    for (const p of arena.pillars) {
      const sc = p.h - p.base;
      if (p.kind === 'pine') pines.push(at(THREE, p.x, p.base - 0.2, p.z, sc / 8.2, p.seed * 6.28));
      else if (p.kind === 'deadTree') dead.push(at(THREE, p.x, p.base - 0.2, p.z, sc / 5, p.seed * 6.28));
      else if (p.kind === 'rock')
        rocks.push(at(THREE, p.x, p.base + p.r * 0.2, p.z, p.r * 1.05, p.seed * 6.28, p.r * 0.8));
      else if (p.kind === 'runeStone') stones.push({ p, m: at(THREE, p.x, p.base + 1.4, p.z, 1, p.seed * 6.28) });
    }
    // forêt dense hors des limites du monde (crêtes) : décor seul, sans collision ni ombre portée
    const n = E.mobile ? 900 : 2200;
    for (let k = 0; k < n; k++) {
      const side = r() < 0.5 ? -1 : 1,
        x = side * (W.halfX + 2 + r() * 120),
        z = -W.valleyZ - 40 + r() * (W.valleyZ * 2 + 60),
        s = 1 + r() * 0.9;
      if (z > 120 && Math.abs(x) < 95) continue; // la colline du château reste dégagée
      farPines.push(at(THREE, x, W.heightAt(x, z) - 0.3, z, s, r() * 6.28));
    }
    for (let k = 0; k < (E.mobile ? 160 : 380); k++) {
      const x = (r() * 2 - 1) * (W.halfX + 30),
        z = -W.valleyZ - 20 - r() * 70;
      farPines.push(at(THREE, x, W.heightAt(x, z) - 0.3, z, 1 + r() * 0.8, r() * 6.28));
    }
    instanced(THREE, S, pineParts(THREE), pines);
    instanced(THREE, S, pineParts(THREE), farPines, { shadow: false });
    instanced(THREE, S, deadTreeParts(THREE), dead);
    const rockT = tex(
      THREE,
      stoneCanvas({ size: 256, rows: 3, minW: 0.3, maxW: 0.5, base: [0.5, 0.5, 0.56], vary: 0.2, moss: 0.5, seed: 8 })
    );
    instanced(
      THREE,
      S,
      [
        [
          new THREE.DodecahedronGeometry(1, 0),
          new THREE.MeshStandardMaterial({ map: rockT, flatShading: true, roughness: 1 })
        ]
      ],
      rocks
    );
    buildRuneStones(THREE, S, stones, E);
  }
  // pierres levées gravées de runes qui luisent (turquoise), pulsation lente
  function buildRuneStones(THREE, S, stones, E) {
    const stoneMat = new THREE.MeshStandardMaterial({
      color: lin(THREE, 0x55607a),
      roughness: 0.9,
      flatShading: true,
      emissive: 0x2fd8c8,
      emissiveIntensity: 0.0
    });
    instanced(
      THREE,
      S,
      [[new THREE.BoxGeometry(0.9, 2.8, 0.5, 1, 3, 1), stoneMat]],
      stones.map(s => s.m)
    );
    const glow = glowTexture(THREE);
    for (const { p } of stones) {
      const g = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0x3cf0dc,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.55
        })
      );
      g.position.set(p.x, p.base + 1.8, p.z);
      g.scale.setScalar(2.4);
      S.add(g);
      const ph = p.seed * 9;
      E.anim.push(t => (g.material.opacity = 0.35 + 0.25 * Math.sin(t * 1.3 + ph)));
    }
  }
  // champignons lumineux en touffes au pied des arbres
  function buildMushrooms(THREE, S, W, arena, E) {
    const r = rng(5),
      caps = [],
      stems = [];
    for (const p of arena.pillars) {
      if (p.kind !== 'pine' && p.kind !== 'deadTree') continue;
      if (r() > 0.45) continue;
      for (let k = 0; k < 3 + r() * 4; k++) {
        const a = r() * 6.28,
          d = p.r + 0.4 + r() * 1.2,
          x = p.x + Math.sin(a) * d,
          z = p.z + Math.cos(a) * d,
          y = W.heightAt(x, z),
          s = 0.12 + r() * 0.16;
        stems.push(at(THREE, x, y + s * 0.8, z, s));
        caps.push(at(THREE, x, y + s * 1.7, z, s * 1.6, 0, s * 0.9));
      }
    }
    const capMat = new THREE.MeshStandardMaterial({ color: 0x5ad8ff, emissive: 0x2a9cff, emissiveIntensity: 1.3 }),
      stemMat = new THREE.MeshStandardMaterial({ color: 0xbfd4e6, roughness: 0.8 });
    instanced(THREE, S, [[new THREE.CylinderGeometry(0.35, 0.45, 1.6, 6), stemMat]], stems, { shadow: false });
    instanced(THREE, S, [[new THREE.SphereGeometry(1, 8, 5, 0, 6.29, 0, 1.6), capMat]], caps, { shadow: false });
  }

  // ---- Route : lanternes d'esprits flottantes, bornes ----
  function buildLanterns(THREE, S, W, E) {
    const glow = glowTexture(THREE),
      postMat = new THREE.MeshStandardMaterial({ color: lin(THREE, 0x3c3640), roughness: 0.9 }),
      posts = [];
    for (let z = W.start.z + 14, i = 0; z < W.gate.z - 8; z += 19, i++) {
      const side = i % 2 ? 1 : -1,
        x = W.roadX(z) + side * (W.roadHalf + 1.2),
        y = W.heightAt(x, z);
      posts.push(at(THREE, x, y, z));
      const orb = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0x8fd8ff,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false
        })
      );
      orb.position.set(x, y + 2.6, z);
      orb.scale.setScalar(1.6);
      S.add(orb);
      const ph = i * 1.7;
      E.anim.push(t => {
        orb.position.y = y + 2.6 + Math.sin(t * 1.1 + ph) * 0.12;
        orb.material.opacity = 0.75 + 0.2 * Math.sin(t * 2.3 + ph);
      });
    }
    instanced(
      THREE,
      S,
      [
        [new THREE.CylinderGeometry(0.09, 0.14, 2.2, 6), postMat, local(THREE, 0, 1.1, 0)],
        [new THREE.TorusGeometry(0.28, 0.04, 5, 10), postMat, local(THREE, 0, 2.55, 0, Math.PI / 2)]
      ],
      posts
    );
  }
  // ---- Feux de camp (points de reprise) : bûches, pierres, flammes, lumière qui vacille ----
  function buildCampfires(THREE, S, W, E) {
    const flame = flameTexture(THREE),
      glow = glowTexture(THREE),
      log = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 1 }),
      stone = new THREE.MeshStandardMaterial({ color: 0x5c5a62, roughness: 1, flatShading: true });
    for (const c of W.checkpoints) {
      const y = W.heightAt(c.x, c.z),
        g = new THREE.Group();
      g.position.set(c.x, y, c.z);
      for (let k = 0; k < 3; k++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 6), log);
        l.position.y = 0.15;
        l.rotation.set(Math.PI / 2, (k / 3) * Math.PI, 0.25);
        l.castShadow = true;
        g.add(l);
      }
      for (let k = 0; k < 8; k++) {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), stone),
          a = (k / 8) * 6.28;
        s.position.set(Math.sin(a) * 0.85, 0.08, Math.cos(a) * 0.85);
        g.add(s);
      }
      S.add(g);
      for (let k = 0; k < 3; k++) {
        const f = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: flame,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
          })
        );
        f.position.set(c.x + (k - 1) * 0.16, y + 0.62, c.z);
        S.add(f);
        E.flames.push({ s: f, k: k + c.z });
      }
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xff9440,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.4
        })
      );
      halo.position.set(c.x, y + 0.9, c.z);
      halo.scale.setScalar(4);
      S.add(halo);
      const light = new THREE.PointLight(0xff8a3c, 1.4, 16, 2);
      light.position.set(c.x, y + 1.3, c.z);
      S.add(light);
      E.flames.push({ light, k: c.x + c.z });
    }
  }
  // ---- Camps de monstres : braseros à flamme verte spectrale, ossements, pieux ----
  function buildCamps(THREE, S, W, E) {
    const glow = glowTexture(THREE),
      flame = flameTexture(THREE),
      iron = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.5 }),
      bone = new THREE.MeshStandardMaterial({ color: 0xd9d0bc, roughness: 0.8 }),
      wood = new THREE.MeshStandardMaterial({ color: 0x3b2c24, roughness: 1 }),
      r = rng(31);
    const bones = [],
      stakes = [];
    for (const c of W.camps) {
      const n = c.boss ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const side = c.boss ? (k ? 1 : -1) * 7 : 0,
          bx = c.x + side + (c.boss ? 0 : -3.2),
          bz = c.z + (c.boss ? 4 : 2.5),
          y = W.heightAt(bx, bz),
          bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.45, 8), iron),
          leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.1, 6), iron);
        bowl.position.set(bx, y + 1.3, bz);
        leg.position.set(bx, y + 0.55, bz);
        S.add(bowl, leg);
        const f = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: flame,
            color: 0x7dffb0,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
          })
        );
        f.position.set(bx, y + 1.85, bz);
        S.add(f);
        E.flames.push({ s: f, k: bx });
        const h = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glow,
            color: 0x46ff9a,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: 0.45
          })
        );
        h.position.set(bx, y + 1.9, bz);
        h.scale.setScalar(4);
        S.add(h);
      }
      if (c.indoor) continue; // dans le château : ni ossements ni pieux (dalles, murs proches)
      for (let k = 0; k < 6; k++) {
        const a = r() * 6.28,
          d = 3 + r() * 3,
          x = c.x + Math.sin(a) * d,
          z = c.z + Math.cos(a) * d;
        bones.push(at(THREE, x, W.heightAt(x, z) + 0.05, z, 0.5 + r() * 0.4, r() * 6.28, 0.5, 1.4));
      }
      for (let k = 0; k < 4; k++) {
        const a = r() * 6.28,
          d = 4.5 + r() * 2,
          x = c.x + Math.sin(a) * d,
          z = c.z + Math.cos(a) * d;
        stakes.push(at(THREE, x, W.heightAt(x, z), z, 1, r() * 6.28, 1 + r() * 0.5, (r() - 0.5) * 0.4));
      }
    }
    instanced(THREE, S, [[new THREE.CylinderGeometry(0.06, 0.08, 0.8, 5), bone]], bones, { shadow: false });
    instanced(
      THREE,
      S,
      [
        [new THREE.CylinderGeometry(0.07, 0.1, 1.8, 5), wood, local(THREE, 0, 0.9, 0)],
        [new THREE.SphereGeometry(0.17, 6, 5), bone, local(THREE, 0, 1.92, 0)]
      ],
      stakes
    );
  }

  // ---- Brume basse : grands voiles pâles qui dérivent lentement au ras du sol de la vallée ----
  function buildMist(THREE, S, W, E) {
    const r = rng(19),
      map = glowTexture(THREE),
      n = E.mobile ? 40 : 90;
    for (let k = 0; k < n; k++) {
      const z = W.start.z + r() * (W.gate.z - W.start.z - 10),
        x = W.roadX(z) + (r() * 2 - 1) * 34,
        y = W.heightAt(x, z) + 0.8 + r() * 1.2,
        m = new THREE.Sprite(
          new THREE.SpriteMaterial({ map, color: 0xa8c4e8, transparent: true, depthWrite: false, opacity: 0.09 })
        );
      m.position.set(x, y, z);
      m.scale.set(16 + r() * 14, 5 + r() * 3, 1);
      S.add(m);
      const ph = r() * 6.28,
        x0 = x;
      E.anim.push(t => (m.position.x = x0 + Math.sin(t * 0.05 + ph) * 3));
    }
  }
  // ---- Montagnes lointaines (silhouettes dans la brume) ----
  function buildMountains(THREE, S, W, E) {
    const r = rng(12),
      mat = new THREE.MeshStandardMaterial({ color: lin(THREE, 0x2b3654), roughness: 1, flatShading: true }),
      cone = new THREE.ConeGeometry(1, 1, 6),
      list = [];
    for (let k = 0; k < (E.mobile ? 30 : 60); k++) {
      const a = r() * Math.PI * 2,
        d = 380 + r() * 300,
        h = 60 + r() * 140,
        w = h * (0.7 + r() * 0.6);
      list.push(at(THREE, Math.sin(a) * d, h / 2 - 20, Math.cos(a) * d + 40, w, r() * 6, h));
    }
    instanced(THREE, S, [[cone, mat]], list, { shadow: false });
  }

  ArenaEnv.registerMap('pve', (THREE, S, arena, E) => {
    const W = arena.world;
    if (!W) return; // carte PVE demandée sans monde PVE : rien (jamais en arène)
    S.fog = new THREE.Fog(0x24304a, 18, 230);
    buildSky(THREE, S);
    buildLights(THREE, S, E);
    buildTerrain(THREE, S, W, E);
    buildFlora(THREE, S, W, arena, E);
    buildMushrooms(THREE, S, W, arena, E);
    buildLanterns(THREE, S, W, E);
    buildCampfires(THREE, S, W, E);
    buildCamps(THREE, S, W, E);
    PveDecor.castle(THREE, S, W, E);
    buildMountains(THREE, S, W, E);
    buildMist(THREE, S, W, E);
    // brume lumineuse et lucioles le long de la route
    const emitters = [];
    for (let z = W.start.z; z < W.gate.z; z += 5) {
      const x = W.roadX(z) + Math.sin(z) * 8;
      emitters.push([x, W.heightAt(x, z) + 1.4, z]);
    }
    ambientMotes(THREE, S, E, {
      emitters,
      count: E.mobile ? 300 : 900,
      spread: 9,
      color: 0x9fe8ff,
      size: 0.08,
      sway: 0.9,
      twinkle: 0.8,
      alpha: 0.7,
      seed: 23
    });
  });
})();
