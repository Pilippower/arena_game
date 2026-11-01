'use strict';
// Décor de la carte « The Bridge » (three.js, procédural) : fosse de sable au crépuscule, pont de bois cerclé de fer
// au-dessus de l'arène, blocs de roche, palissade de rondins hérissée de pointes en os, bannières, braseros, pics rocheux.
// Les obstacles de jeu (cercles) sont dans MAPS.bridge (src/data/maps.js) ; ce fichier ne fait que les habiller.
(function () {
  if (!window.ArenaEnv?.registerMap) return;
  const { rng, noise, noise2, canvas, tex, glowTexture, flameTexture, clamp } = ArenaEnv.helpers;

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
  function woodCanvas(w = 256, h = 512, base = [110, 70, 42]) {
    const c = canvas(w, h),
      g = c.getContext('2d'),
      id = g.createImageData(w, h),
      d = id.data;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const grain = Math.sin(x * 0.35 + noise2((x / w) * 3, (y / h) * 12, 12, 3) * 9) * 0.5 + 0.5,
          k = 0.62 + 0.3 * grain + 0.12 * noise((x / w) * 8, (y / h) * 8, 8, 2);
        const o = (y * w + x) * 4;
        d[o] = base[0] * k;
        d[o + 1] = base[1] * k;
        d[o + 2] = base[2] * k;
        d[o + 3] = 255;
      }
    g.putImageData(id, 0, 0);
    return c;
  }
  function rockCanvas(size = 256) {
    const c = canvas(size),
      g = c.getContext('2d'),
      id = g.createImageData(size, size),
      d = id.data;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const n = noise((x / size) * 6, (y / size) * 6, 6, 5),
          s = Math.abs(Math.sin((y / size) * 30 + n * 6)),
          k = 0.55 + 0.4 * n - 0.12 * (s > 0.97 ? 1 : 0);
        const o = (y * size + x) * 4;
        d[o] = 128 * k;
        d[o + 1] = 104 * k;
        d[o + 2] = 92 * k;
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
    for (let i = 0; i < sp.count; i++)
      sp.setZ(i, (noise2(sp.getX(i) * 0.08 + 9, sp.getY(i) * 0.08, 256, 3) - 0.5) * 0.35);
    sand.geometry.computeVertexNormals();
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    S.add(sand);

    const woodT = tex(THREE, woodCanvas()),
      darkWoodT = tex(THREE, woodCanvas(256, 512, [70, 44, 28])),
      rockT = tex(THREE, rockCanvas());
    const wood = new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.85 }),
      darkWood = new THREE.MeshStandardMaterial({ map: darkWoodT, roughness: 0.9 }),
      rock = new THREE.MeshStandardMaterial({ map: rockT, roughness: 0.95, flatShading: true }),
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
      add(new THREE.BoxGeometry(len, 0.18, 0.2), darkWood, 0, bridgeY + 1.15, sz * (W / 2 - 0.1)); // main courante
    }
    const plankG = new THREE.BoxGeometry(0.55, 0.16, W - 0.3),
      plankMats = [wood, darkWood];
    for (let x = -len / 2 + 0.3, k = 0; x < len / 2; x += 0.6, k++) {
      const pl = add(plankG, plankMats[k % 5 === 0 ? 1 : 0], x, bridgeY + 0.14 + (r() - 0.5) * 0.03, 0);
      pl.rotation.y = (r() - 0.5) * 0.04;
      pl.receiveShadow = true;
    }
    for (let x = -len / 2 + 1.6; x < len / 2; x += 3.2) {
      for (const sz of [-1, 1]) {
        add(new THREE.BoxGeometry(0.24, 1.2, 0.24), darkWood, x, bridgeY + 0.65, sz * (W / 2 - 0.1)); // balustre
        strap(0.3, 0.6, x, bridgeY - 0.1, sz * (W / 2 + 0.03));
      }
      add(new THREE.BoxGeometry(0.12, 0.05, W - 0.2), iron, x, bridgeY + 0.24, 0, false); // sangle sur le tablier
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
        inward = vert ? -Math.sign(x) : -Math.sign(z);
      // blocs de falaise sur 2 rangées
      for (let t = -len2 / 2; t < len2 / 2;) {
        const bw = 2 + r() * 2.2;
        for (let row = 0; row < 2; row++) {
          const bh = wallH / 2 + r() * 0.4,
            cx = vert ? x : x + t + bw / 2,
            cz = vert ? z + t + bw / 2 : z;
          stoneBlock(vert ? d : bw, bh, vert ? bw : d, cx, row * (wallH / 2) + bh / 2, cz, rock, 0.18);
        }
        t += bw;
      }
      // palissade
      for (let t = -len2 / 2 + 0.5; t < len2 / 2; t += 0.85) {
        const lh = 2.4 + r() * 1.4,
          lx = vert ? x - inward * 0.6 : x + t,
          lz = vert ? z + t : z - inward * 0.6;
        const lg = add(logG, darkWood, lx, wallH + lh / 2 - 0.3, lz);
        lg.scale.y = lh;
        add(logTipG, wood, lx, wallH + lh - 0.3 + 0.45, lz);
      }
      // ceinture de fer qui lie la palissade
      add(
        new THREE.BoxGeometry(vert ? 0.9 : len2, 0.18, vert ? len2 : 0.9),
        iron,
        vert ? x - inward * 0.6 : x,
        wallH + 1.2,
        vert ? z : z - inward * 0.6,
        false
      );
      // défenses d'os inclinées vers l'arène
      for (let t = -len2 / 2 + 3; t < len2 / 2 - 2; t += 6) {
        const sx = vert ? x + inward * 0.9 : x + t,
          sz = vert ? z + t : z + inward * 0.9,
          s = add(new THREE.ConeGeometry(0.5, 3.2, 8), bone, sx, wallH + 0.6, sz);
        s.rotation.set(vert ? 0 : -inward * 0.9, 0, vert ? inward * 0.9 : 0);
      }
      // porte grillagée au milieu des grands côtés
      if (!vert) {
        const gz = z + inward * (d / 2 + 0.02);
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
        if (k === 0) continue;
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2, 4, 8), bannerMat);
        if (vert) {
          b.position.set(x + inward * (d / 2 + 0.05), wallH - 1.2, k * (d / 6));
          b.rotation.y = (inward * Math.PI) / 2;
        } else {
          b.position.set(k * (w / 6), wallH - 1.2, z + inward * (d / 2 + 0.05));
          if (inward < 0) b.rotation.y = Math.PI;
        }
        b.castShadow = true;
        S.add(b);
      }
    }
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
    ground.position.y = -0.05;
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
