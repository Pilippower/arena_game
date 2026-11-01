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
    // obstacles de la carte
    for (const p of arena.pillars) {
      if (p.kind === 'rock') {
        const b = add(new THREE.BoxGeometry(p.r * 1.7, p.h, p.r * 1.7), rock, p.x, p.h / 2, p.z);
        b.rotation.y = r() * 0.6;
        boulder(p.x + p.r * 0.6, p.z - p.r * 0.5, p.r * 0.45, p.h * 0.5);
      } else {
        add(new THREE.CylinderGeometry(p.r * 0.85, p.r, p.h, 10), darkWood, p.x, p.h / 2, p.z);
        for (const y of [0.6, p.h - 0.8])
          add(new THREE.CylinderGeometry(p.r * 1.05, p.r * 1.05, 0.25, 10), iron, p.x, y, p.z);
        const tip = add(new THREE.ConeGeometry(p.r * 0.7, 1.4, 8), bone, p.x, p.h + 0.7 + 0.6, p.z);
        tip.rotation.z = (r() - 0.5) * 0.2;
      }
    }
    // le pont : tablier de planches cerclé de fer, au-dessus du centre, d'un rempart à l'autre
    const bridgeY = 4.8,
      len = hx * 2 + 4;
    const deck = add(new THREE.BoxGeometry(len, 0.35, 4.6), wood, 0, bridgeY, 0);
    woodT.repeat.set(1, 1);
    for (let x = -len / 2 + 1; x < len / 2; x += 3.2) {
      add(new THREE.BoxGeometry(0.22, 0.42, 4.8), iron, x, bridgeY + 0.02, 0, false);
      if (Math.abs(x) > 3) add(new THREE.BoxGeometry(0.25, 0.9, 0.25), darkWood, x, bridgeY + 0.6, 2.3);
      if (Math.abs(x) > 3) add(new THREE.BoxGeometry(0.25, 0.9, 0.25), darkWood, x, bridgeY + 0.6, -2.3);
    }
    add(new THREE.BoxGeometry(len, 0.18, 0.2), darkWood, 0, bridgeY + 1.0, 2.3);
    add(new THREE.BoxGeometry(len, 0.18, 0.2), darkWood, 0, bridgeY + 1.0, -2.3);
    deck.receiveShadow = true;
    // remparts : roche + palissade de rondins hérissée de pointes
    const wallH = 4.2;
    const sides = [
      [0, -hz - 1.2, hx * 2 + 6, 2.4, false],
      [0, hz + 1.2, hx * 2 + 6, 2.4, false],
      [-hx - 1.2, 0, 2.4, hz * 2, true],
      [hx + 1.2, 0, 2.4, hz * 2, true]
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
    for (const [x, z, w, d, vert] of sides) {
      add(new THREE.BoxGeometry(w, wallH, d), rock, x, wallH / 2, z);
      const n = Math.floor((vert ? d : w) / 1.1);
      for (let k = 0; k < n; k++) {
        const t = -((vert ? d : w) / 2) + 0.55 + k * 1.1,
          lx = vert ? x + Math.sign(x) * -0.6 : x + t,
          lz = vert ? z + t : z + Math.sign(z) * -0.6,
          lh = 2.2 + r() * 1.2;
        add(new THREE.CylinderGeometry(0.42, 0.48, lh, 7), darkWood, lx, wallH + lh / 2 - 0.3, lz);
        if (k % 4 === 0) {
          const s = add(new THREE.ConeGeometry(0.45, 2.2, 7), bone, lx, wallH + lh + 0.6, lz);
          s.rotation.set(vert ? 0 : Math.sign(z) * -0.45, 0, vert ? Math.sign(x) * 0.45 : 0);
        }
      }
      // bannières vers l'arène
      for (let k = -2; k <= 2; k++) {
        if (k === 0) continue;
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2, 4, 8), bannerMat);
        if (vert) {
          b.position.set(x - Math.sign(x) * 1.25, wallH - 1.2, k * (d / 6));
          b.rotation.y = (-Math.sign(x) * Math.PI) / 2;
        } else {
          b.position.set(k * (w / 6), wallH - 1.2, z - Math.sign(z) * 1.25);
          if (z > 0) b.rotation.y = Math.PI;
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
