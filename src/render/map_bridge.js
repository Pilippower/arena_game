'use strict';
// Décor de la carte « The Bridge » (three.js, procédural) : fosse de sable au crépuscule, pont de bois cerclé de fer
// au-dessus de l'arène, blocs de roche, palissade de rondins hérissée de pointes en os, bannières, braseros, pics rocheux.
// Les obstacles de jeu (cercles) sont dans MAPS.bridge (src/data/maps.js) ; ce fichier ne fait que les habiller.
(function () {
  if (!window.ArenaEnv?.registerMap) return;
  const { rng, noise, noise2, canvas, tex, glowTexture, flameTexture, clamp, stoneCanvas } = ArenaEnv.helpers;

  function sandCanvas(size = 512) {
    const c = canvas(size),
      g = c.getContext('2d'),
      id = g.createImageData(size, size),
      d = id.data;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const ripple = Math.sin(((x + noise((x / size) * 4, (y / size) * 4, 4, 2) * 90) / size) * 60) * 0.5 + 0.5;
        const n = noise((x / size) * 16, (y / size) * 16, 16, 4),
          k = 0.78 + 0.18 * n + 0.08 * ripple;
        const o = (y * size + x) * 4;
        d[o] = clamp(178 * k, 0, 255);
        d[o + 1] = clamp(128 * k, 0, 255);
        d[o + 2] = clamp(84 * k, 0, 255);
        d[o + 3] = 255;
      }
    g.putImageData(id, 0, 0);
    return c;
  }
  // Bois « fantasy » peint à la main : planches séparées par des joints sombres, arêtes éclairées, fil du bois
  // qui contourne les nœuds, aboutements et clous de fer. Le fil court le long de v (axe long des planches).
  function woodCanvas(w = 256, h = 512, base = [134, 84, 46], boards = 2, seed = 3) {
    const c = canvas(w, h),
      g = c.getContext('2d'),
      id = g.createImageData(w, h),
      d = id.data,
      r = rng(seed),
      bw = w / boards;
    const B = [];
    for (let i = 0; i < boards; i++)
      B.push({
        tint: 0.82 + r() * 0.3,
        warm: (r() - 0.5) * 0.12,
        joint: Math.floor(r() * h),
        knots: Array.from({ length: 1 + Math.floor(r() * 2) }, () => ({
          x: 6 + r() * (bw - 12),
          y: r() * h,
          r: 3 + r() * 5
        }))
      });
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const bi = Math.floor(x / bw),
          b = B[bi],
          lx = x - bi * bw;
        let gx = lx + noise2((x / w) * 3, (y / h) * 10, 10, 3) * 10,
          knot = 1;
        for (const kn of b.knots) {
          let dy = y - kn.y;
          if (dy > h / 2) dy -= h;
          if (dy < -h / 2) dy += h;
          const dd = Math.hypot(lx - kn.x, dy * 0.45);
          gx += ((kn.r * 9) / (dd + kn.r)) * Math.sign(lx - kn.x || 1);
          if (dd < kn.r) knot = 0.45 + 0.4 * (dd / kn.r) + 0.12 * Math.sin(dd * 2.4);
        }
        const line = Math.pow(Math.abs(Math.sin(gx * 0.42)), 8),
          fine = noise((x / w) * 40, (y / h) * 6, 40, 2);
        let k = (0.8 + 0.14 * noise((x / w) * 6, (y / h) * 3, 6, 2) - 0.28 * line + 0.08 * fine) * b.tint * knot;
        k *= 0.92 + 0.14 * Math.sin((lx / bw) * Math.PI); // planche bombée, centre plus clair
        if (lx < 1.5 || lx > bw - 2)
          k *= 0.35; // joint entre planches
        else if (lx < 4) k *= 1.18; // arête éclairée
        const jd = Math.abs(y - b.joint);
        if (jd < 1.5)
          k *= 0.35; // aboutement
        else if (jd < 4) k *= 1.12;
        // clous de part et d'autre de l'aboutement
        for (const nx of [bw * 0.28, bw * 0.72]) {
          const nd = Math.hypot(lx - nx, jd - 7);
          if (nd < 2.6) k = nd < 1.6 ? 0.25 : 1.35;
        }
        const o = (y * w + x) * 4;
        d[o] = clamp(base[0] * k * (1 + b.warm), 0, 255);
        d[o + 1] = clamp(base[1] * k, 0, 255);
        d[o + 2] = clamp(base[2] * k * (1 - b.warm), 0, 255);
        d[o + 3] = 255;
      }
    g.putImageData(id, 0, 0);
    return c;
  }
  // Bannière rouge déchirée, emblème original : trois griffes.
  function bannerCanvas() {
    const c = canvas(128, 256),
      g = c.getContext('2d');
    g.fillStyle = '#8a1a14';
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let x = 0; x < 128; x += 14) g.fillRect(x, 0, 3, 256);
    g.strokeStyle = '#1d0b08';
    g.lineWidth = 9;
    g.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(64 + k * 22 - 10, 70);
      g.quadraticCurveTo(64 + k * 22 + 8, 110, 64 + k * 22 - 4, 150);
      g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    const r = rng(5);
    g.beginPath();
    g.moveTo(0, 256);
    for (let x = 0; x <= 128; x += 10) g.lineTo(x, 214 + r() * 30);
    g.lineTo(128, 256);
    g.fill();
    return c;
  }

  ArenaEnv.registerMap('bridge', (THREE, S, arena, E) => {
    const hx = arena.halfX,
      hz = arena.halfZ,
      r = rng(42),
      mobile = E.mobile;
    S.fog = new THREE.Fog(0x8a5a78, 60, 380);
    // ciel de crépuscule violet / orangé
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader:
          'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec3 vDir;void main(){float y=vDir.y;
          vec3 zen=vec3(.16,.12,.32),mid=vec3(.55,.32,.55),hor=vec3(1.,.62,.42);
          vec3 c=mix(hor,mid,smoothstep(0.,.25,y));c=mix(c,zen,smoothstep(.25,.75,y));if(y<0.)c=vec3(.3,.18,.2);
          vec3 sd=normalize(vec3(.7,.12,-.7));float s=max(dot(vDir,sd),0.);c+=vec3(1.,.7,.4)*pow(s,10.)*.6;
          gl_FragColor=vec4(c,1.);}`
      })
    );
    sky.renderOrder = -100;
    S.add(sky);
    S.add(new THREE.HemisphereLight(0xffc9a8, 0x4a2a2a, 0.9));
    const sun = new THREE.DirectionalLight(0xffb27a, 2.3);
    sun.position.set(34, 26, -30);
    sun.castShadow = true;
    const sm = mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    S.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x9d7dff, 0.45);
    fill.position.set(-25, 12, 30);
    S.add(fill);

    const sandT = tex(THREE, sandCanvas());
    sandT.repeat.set(9, 7);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(hx * 2 + 30, hz * 2 + 30, 40, 30),
      new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })
    );
    const sp = sand.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const out = ArenaEnv.outsideDist(arena, sp.getX(i), -sp.getY(i)); // sable plat dans l'arène et les salles
      sp.setZ(i, out > 0 ? noise2(sp.getX(i) * 0.08 + 9, sp.getY(i) * 0.08, 256, 3) * 0.5 * Math.min(1, out / 3) : 0);
    }
    sand.geometry.computeVertexNormals();
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    S.add(sand);

    const woodT = tex(THREE, woodCanvas()),
      darkWoodT = tex(THREE, woodCanvas(256, 512, [92, 56, 32], 1, 11)),
      rockT = tex(
        THREE,
        stoneCanvas({
          size: 512,
          rows: 4,
          minW: 0.22,
          maxW: 0.42,
          base: [0.62, 0.48, 0.38],
          vary: 0.18,
          grout: [0.18, 0.12, 0.1],
          seed: 7,
          warp: 4
        })
      );
    const wood = new THREE.MeshStandardMaterial({ map: woodT, bumpMap: woodT, bumpScale: 0.035, roughness: 0.78 }),
      darkWood = new THREE.MeshStandardMaterial({
        map: darkWoodT,
        bumpMap: darkWoodT,
        bumpScale: 0.035,
        roughness: 0.82
      }),
      bronze = new THREE.MeshStandardMaterial({ color: 0xb8863a, roughness: 0.35, metalness: 0.85 }),
      rock = new THREE.MeshStandardMaterial({ map: rockT, roughness: 0.95 }),
      iron = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.45, metalness: 0.8 }),
      bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 });
    const add = (geo, mat, x, y, z, cast = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      S.add(m);
      return m;
    };
    const boulder = (x, z, rr, h) => {
      const geo = new THREE.DodecahedronGeometry(1, 1),
        p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 0.85 + r() * 0.3;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
      }
      geo.computeVertexNormals();
      const m = add(geo, rock, x, h * 0.45, z);
      m.scale.set(rr, h * 0.6, rr);
      m.rotation.y = r() * 6;
      return m;
    };
    // Bloc de pierre irrégulier (boîte subdivisée, sommets bruités) : remplace les cubes lisses.
    const stoneBlock = (w, h, d, x, y, z, mat = rock, jit = 0.12) => {
      const geo = new THREE.BoxGeometry(w, h, d, 3, 3, 3),
        p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = noise(p.getX(i) * 0.9 + x, p.getY(i) * 0.9 + z, 256, 2) - 0.5;
        p.setXYZ(i, p.getX(i) * (1 + k * jit), p.getY(i) * (1 + k * jit * 0.6), p.getZ(i) * (1 + k * jit));
      }
      geo.computeVertexNormals();
      const m = add(geo, mat, x, y, z);
      m.rotation.y = (r() - 0.5) * 0.3;
      return m;
    };
    const masonry = new THREE.MeshStandardMaterial({ map: rockT, color: 0xc8b6a4, roughness: 0.95 });
    const strap = (geoW, h, x, y, z, rot = 0) => {
      const s = add(new THREE.BoxGeometry(geoW, h, 0.06), iron, x, y, z, false);
      s.rotation.y = rot;
      return s;
    };
    // poteau de bois massif : écorce, cerclages de fer rivetés, pointe d'os
    const post = (x, z, rr, h, tip = true) => {
      add(new THREE.CylinderGeometry(rr * 0.9, rr * 1.05, h, 12), darkWood, x, h / 2, z);
      for (const y of [0.5, h * 0.5, h - 0.5]) {
        add(new THREE.CylinderGeometry(rr * 1.1, rr * 1.1, 0.22, 12), iron, x, y, z);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          add(
            new THREE.SphereGeometry(0.05, 6, 4),
            iron,
            x + Math.sin(a) * rr * 1.12,
            y,
            z + Math.cos(a) * rr * 1.12,
            false
          );
        }
      }
      if (tip) {
        const t = add(new THREE.ConeGeometry(rr * 0.75, 1.6, 8), bone, x, h + 0.75, z);
        t.rotation.z = (r() - 0.5) * 0.25;
      }
    };
    // obstacles de la carte (mêmes cercles de collision que MAPS.bridge)
    for (const p of arena.pillars) {
      if (p.kind === 'rock') {
        // empilement de blocs taillés + éboulis au pied
        stoneBlock(p.r * 1.9, p.h * 0.55, p.r * 1.7, p.x, p.h * 0.27, p.z, masonry);
        stoneBlock(p.r * 1.5, p.h * 0.5, p.r * 1.4, p.x + 0.1, p.h * 0.75, p.z - 0.05, masonry);
        for (let k = 0; k < 4; k++) {
          const a = r() * Math.PI * 2;
          boulder(p.x + Math.sin(a) * p.r * 1.2, p.z + Math.cos(a) * p.r * 1.2, 0.25 + r() * 0.35, 0.6 + r() * 0.5);
        }
      } else post(p.x, p.z, p.r, p.h, false);
    }
    // le pont : deux longerons, planches individuelles, sangles de fer, garde-corps, chevalets sous le tablier
    const bridgeY = 4.8,
      len = hx * 2 + 4,
      W = 4.6;
    for (const sz of [-1, 1]) {
      add(new THREE.BoxGeometry(len, 0.5, 0.45), darkWood, 0, bridgeY - 0.15, sz * (W / 2 - 0.2));
    }
    // main courante en segments : ouverte au débouché de chaque rampe
    const RB = arena.bridge,
      opening = x => RB && Math.abs(Math.abs(x) - RB.rampX) < RB.rampW / 2 + 0.1;
    const cuts = RB
      ? [
          -len / 2,
          -RB.rampX - RB.rampW / 2,
          -RB.rampX + RB.rampW / 2,
          RB.rampX - RB.rampW / 2,
          RB.rampX + RB.rampW / 2,
          len / 2
        ]
      : [-len / 2, len / 2];
    for (let k = 0; k < cuts.length - 1; k += 2)
      for (const sz of [-1, 1]) {
        const a = cuts[k],
          b = cuts[k + 1];
        add(new THREE.BoxGeometry(b - a, 0.18, 0.2), darkWood, (a + b) / 2, bridgeY + 1.15, sz * (W / 2 - 0.1));
      }
    const plankG = new THREE.BoxGeometry(0.55, 0.16, W - 0.3),
      plankMats = [wood, darkWood];
    for (let x = -len / 2 + 0.3, k = 0; x < len / 2; x += 0.6, k++) {
      const pl = add(plankG, plankMats[k % 5 === 0 ? 1 : 0], x, bridgeY + 0.14 + (r() - 0.5) * 0.03, 0);
      pl.rotation.y = (r() - 0.5) * 0.04;
      pl.receiveShadow = true;
    }
    const lanterns = [];
    for (let x = -len / 2 + 1.6; x < len / 2; x += 3.2) {
      for (const sz of [-1, 1]) {
        if (!opening(x)) {
          const bz = sz * (W / 2 - 0.1);
          add(new THREE.BoxGeometry(0.24, 1.2, 0.24), darkWood, x, bridgeY + 0.65, bz); // balustre
          add(new THREE.ConeGeometry(0.2, 0.28, 4), bronze, x, bridgeY + 1.38, bz).rotation.y = Math.PI / 4; // chapeau de bronze
          if (Math.round((x + len / 2) / 3.2) % 3 === 1) lanterns.push([x, bridgeY + 1.85, bz]);
        }
        strap(0.3, 0.6, x, bridgeY - 0.1, sz * (W / 2 + 0.03));
      }
      add(new THREE.BoxGeometry(0.12, 0.05, W - 0.2), iron, x, bridgeY + 0.24, 0, false); // sangle sur le tablier
    }
    // lanternes sur les balustres : cage de bronze, flamme émissive, halo additif
    const lanternGlow = new THREE.SpriteMaterial({
      map: glowTexture(THREE),
      color: 0xffb257,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a2a, emissiveIntensity: 2 });
    for (const [lx, ly, lz] of lanterns) {
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), bronze, lx, ly - 0.32, lz, false);
      add(new THREE.SphereGeometry(0.1, 10, 8), flameMat, lx, ly, lz, false);
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ])
        add(new THREE.BoxGeometry(0.025, 0.36, 0.025), bronze, lx + dx * 0.11, ly, lz + dz * 0.11, false);
      add(new THREE.ConeGeometry(0.2, 0.18, 4), bronze, lx, ly + 0.26, lz, false).rotation.y = Math.PI / 4;
      const sp = new THREE.Sprite(lanternGlow);
      sp.position.set(lx, ly, lz);
      sp.scale.set(1.3, 1.3, 1);
      S.add(sp);
    }
    // chevalets : traverses et croix de Saint-André entre les poteaux qui portent le pont
    const posts = arena.pillars.filter(p => p.kind === 'post');
    for (const p of posts) {
      add(new THREE.BoxGeometry(0.5, 0.45, W + 0.6), darkWood, p.x, bridgeY - 0.55, 0); // traverse
      add(new THREE.CylinderGeometry(p.r * 0.9, p.r * 0.95, 1.2, 12), darkWood, p.x, bridgeY - 1.0, p.z); // tête de poteau
    }
    for (const sx of [-1, 1]) {
      const a = posts.find(p => Math.sign(p.x) === sx && p.z > 0),
        b = posts.find(p => Math.sign(p.x) === sx && p.z < 0);
      if (!a || !b) continue;
      const dz = a.z - b.z,
        L = Math.hypot(dz, bridgeY - 1.2);
      for (const s of [-1, 1]) {
        const br = add(new THREE.BoxGeometry(0.2, L, 0.26), darkWood, a.x, (bridgeY - 0.6) / 2 + 0.3, 0);
        br.rotation.x = s * Math.atan2(dz, bridgeY - 1.2);
      }
    }
    // rampes : 2 à chaque extrémité, de part et d'autre du pont (pente de planches, limons, poteaux de soutien)
    if (RB) {
      const L = RB.rampLen,
        H = RB.y,
        ang = Math.atan2(H, L),
        hyp = Math.hypot(H, L);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const cx = sx * RB.rampX,
            zMid = sz * (RB.halfW + L / 2);
          const g = new THREE.Group();
          g.position.set(cx, H / 2, zMid);
          g.rotation.x = sz * ang; // monte vers le pont
          S.add(g);
          const deckR = new THREE.Mesh(new THREE.BoxGeometry(RB.rampW, 0.2, hyp), wood);
          deckR.receiveShadow = deckR.castShadow = true;
          g.add(deckR);
          for (let t = -hyp / 2 + 0.4; t < hyp / 2; t += 0.65) {
            const pl = new THREE.Mesh(new THREE.BoxGeometry(RB.rampW + 0.1, 0.06, 0.08), darkWood);
            pl.position.set(0, 0.12, t);
            g.add(pl);
          }
          for (const ex of [-1, 1]) {
            const lim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, hyp), darkWood);
            lim.position.set((ex * RB.rampW) / 2, 0.15, 0);
            lim.castShadow = true;
            g.add(lim);
          }
          // poteaux de soutien sous la pente
          for (const f of [0.25, 0.55, 0.85]) {
            const h = H * f;
            add(
              new THREE.CylinderGeometry(0.16, 0.2, h, 8),
              darkWood,
              cx - (RB.rampW / 2 - 0.2),
              h / 2,
              sz * (RB.halfW + L * (1 - f))
            );
            add(
              new THREE.CylinderGeometry(0.16, 0.2, h, 8),
              darkWood,
              cx + (RB.rampW / 2 - 0.2),
              h / 2,
              sz * (RB.halfW + L * (1 - f))
            );
          }
        }
    }
    // remparts : falaise de blocs empilés, palissade de rondins taillés en pointe, grandes défenses d'os
    const wallH = 4.2;
    const sides = [
      [0, -hz - 1.6, hx * 2 + 7, 3.2, false],
      [0, hz + 1.6, hx * 2 + 7, 3.2, false],
      [-hx - 1.6, 0, 3.2, hz * 2 + 1, true],
      [hx + 1.6, 0, 3.2, hz * 2 + 1, true]
    ];
    const bannerT = tex(THREE, bannerCanvas(), false);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerT,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
      roughness: 0.9
    });
    bannerMat.onBeforeCompile = sh => {
      sh.uniforms.time = E.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float time;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nfloat k=(1.5-position.y)/3.;transformed.z+=(sin(time*2.+position.y*1.7+modelMatrix[3].x)*.5+.5)*.18*k;'
        );
    };
    const logG = new THREE.CylinderGeometry(0.4, 0.46, 1, 8),
      logTipG = new THREE.ConeGeometry(0.4, 0.9, 8);
    for (const [x, z, w, d, vert] of sides) {
      const len2 = vert ? d : w,
        th = vert ? w : d, // épaisseur du rempart
        inward = vert ? -Math.sign(x) : -Math.sign(z),
        // remparts est / ouest : ouverture de la porte de la salle de départ (poterne : start_rooms.js). Les tirages
        // au hasard restent les mêmes (le reste du décor ne change pas)
        gap = vert ? ArenaEnv.doorGap(arena, Math.sign(x)) : null,
        free = (t, m) => !gap || t < gap[0] - m || t > gap[1] + m,
        clip = (a, b) =>
          (gap
            ? [
                [a, Math.min(b, gap[0])],
                [Math.max(a, gap[1]), b]
              ]
            : [[a, b]]
          ).filter(([p, q]) => q - p > 0.05);
      // blocs de falaise sur 2 rangées
      for (let t = -len2 / 2; t < len2 / 2;) {
        const bw = 2 + r() * 2.2;
        for (let row = 0; row < 2; row++) {
          const bh = wallH / 2 + r() * 0.4;
          for (const [a, b] of clip(t, t + bw)) {
            const cx = vert ? x : x + (a + b) / 2,
              cz = vert ? z + (a + b) / 2 : z;
            stoneBlock(vert ? th : b - a, bh, vert ? b - a : th, cx, row * (wallH / 2) + bh / 2, cz, rock, 0.18);
          }
        }
        t += bw;
      }
      // palissade
      for (let t = -len2 / 2 + 0.5; t < len2 / 2; t += 0.85) {
        const lh = 2.4 + r() * 1.4;
        if (!free(t, 0.4)) continue;
        const lx = vert ? x - inward * 0.6 : x + t,
          lz = vert ? z + t : z - inward * 0.6;
        const lg = add(logG, darkWood, lx, wallH + lh / 2 - 0.3, lz);
        lg.scale.y = lh;
        add(logTipG, wood, lx, wallH + lh - 0.3 + 0.45, lz);
      }
      // ceinture de fer qui lie la palissade
      for (const [a, b] of clip(-len2 / 2, len2 / 2))
        add(
          new THREE.BoxGeometry(vert ? 0.9 : b - a, 0.18, vert ? b - a : 0.9),
          iron,
          vert ? x - inward * 0.6 : x + (a + b) / 2,
          wallH + 1.2,
          vert ? z + (a + b) / 2 : z - inward * 0.6,
          false
        );
      // défenses d'os inclinées vers l'arène
      for (let t = -len2 / 2 + 3; t < len2 / 2 - 2; t += 6) {
        if (!free(t, 1)) continue;
        const sx = vert ? x + inward * 0.9 : x + t,
          sz = vert ? z + t : z + inward * 0.9,
          tusk = new THREE.ConeGeometry(0.42, 3, 10, 1, true);
        tusk.translate(0, 1.5, 0); // base à l'origine, pointe vers +y
        const s = add(tusk, bone, sx - (vert ? inward * 0.6 : 0), wallH + 0.9, sz - (vert ? 0 : inward * 0.6));
        s.rotation.set(vert ? 0 : inward * 1.0, 0, vert ? -inward * 1.0 : 0);
        const collar = add(
          new THREE.CylinderGeometry(0.5, 0.5, 0.45, 12),
          iron,
          s.position.x,
          s.position.y,
          s.position.z
        );
        collar.rotation.copy(s.rotation);
      }
      // porte grillagée au milieu des grands côtés
      if (!vert) {
        const gz = z + inward * (th / 2 + 0.02);
        add(
          new THREE.BoxGeometry(4.2, 3.4, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1 }),
          0,
          1.7,
          gz,
          false
        );
        for (let k = -1.8; k <= 1.8; k += 0.45)
          add(new THREE.BoxGeometry(0.1, 3.3, 0.1), iron, k, 1.65, gz + inward * 0.12, false);
        for (const y of [0.9, 2.2]) add(new THREE.BoxGeometry(4, 0.1, 0.1), iron, 0, y, gz + inward * 0.12, false);
        stoneBlock(5.4, 0.9, 1.2, 0, 3.8, gz - inward * 0.3, masonry);
      }
      // bannières vers l'arène
      for (let k = -2; k <= 2; k++) {
        if (k === 0 || !free(k * (len2 / 6), 1.2)) continue;
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2, 4, 8), bannerMat);
        if (vert) {
          b.position.set(x + inward * (th / 2 + 0.05), wallH - 1.2, k * (len2 / 6));
          b.rotation.y = (inward * Math.PI) / 2;
        } else {
          b.position.set(k * (len2 / 6), wallH - 1.2, z + inward * (th / 2 + 0.05));
          if (inward < 0) b.rotation.y = Math.PI;
        }
        b.castShadow = true;
        S.add(b);
      }
    }
    // salles de départ derrière les remparts est / ouest : roche de falaise, sol de sable, herse de fer (aucun tirage
    // au hasard ici : le reste du décor ne change pas)
    ArenaEnv.startRooms(THREE, S, arena, E, {
      floor: sand.material,
      wall: rock,
      cap: masonry,
      iron,
      wallH,
      box: (w, h, d, x, y, z, mat) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z)
    });
    // braseros
    const flame = flameTexture(THREE),
      glow = glowTexture(THREE);
    for (const [x, z] of [
      [-hx + 2, -hz + 2],
      [hx - 2, -hz + 2],
      [-hx + 2, hz - 2],
      [hx - 2, hz - 2],
      [-6, -hz + 1.6],
      [6, hz - 1.6]
    ]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.45, 10), iron);
      bowl.position.y = 1.3;
      g.add(bowl);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.1, 6), darkWood);
      ped.position.y = 0.55;
      g.add(ped);
      for (let k = 0; k < 3; k++) {
        const f = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: flame,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
          })
        );
        f.position.set((k - 1) * 0.14, 1.85, 0);
        g.add(f);
        E.flames.push({ s: f, k: k + x });
      }
      const gl = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0xff8a3a,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.6
        })
      );
      gl.scale.setScalar(4.5);
      gl.position.y = 1.9;
      g.add(gl);
      const light = new THREE.PointLight(0xff8a3c, 1.3, 11, 2);
      light.position.y = 2;
      g.add(light);
      E.flames.push({ light, k: x + z });
      S.add(g);
    }
    // extérieur : grands pics rocheux inclinés, rochers flottants, terrain rouge
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshStandardMaterial({ color: 0x8a4e38, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4; // sous le sable : plus de scintillement (z-fighting)
    S.add(ground);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x6e4a46, roughness: 1, flatShading: true });
    for (let k = 0; k < (mobile ? 30 : 60); k++) {
      const a = r() * Math.PI * 2,
        d = 55 + r() * 220,
        h = 25 + r() * 70,
        sp = new THREE.Mesh(new THREE.ConeGeometry(4 + r() * 8, h, 5), spireMat);
      sp.position.set(Math.sin(a) * d * 1.2, h / 2 - 3, Math.cos(a) * d);
      sp.rotation.set((r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5);
      S.add(sp);
    }
    for (let k = 0; k < 8; k++) {
      const a = r() * Math.PI * 2,
        d = 120 + r() * 150,
        m = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + r() * 10, 0), spireMat);
      m.position.set(Math.sin(a) * d, 50 + r() * 50, Math.cos(a) * d);
      m.userData.dynamic = true;
      S.add(m);
      const y0 = m.position.y,
        ph = r() * 6;
      E.anim.push(t => (m.position.y = y0 + Math.sin(t * 0.3 + ph) * 2));
    }
    // poussière qui flotte dans la lumière
    const N = mobile ? 120 : 300,
      pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (r() * 2 - 1) * hx;
      pos[i * 3 + 1] = 0.5 + r() * 6;
      pos[i * 3 + 2] = (r() * 2 - 1) * hz;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.08, transparent: true, opacity: 0.6, depthWrite: false })
    );
    dust.userData.dynamic = true;
    S.add(dust);
    E.anim.push(t => (dust.rotation.y = t * 0.01));
  });
})();
