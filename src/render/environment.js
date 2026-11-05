(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ArenaEnv = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Décor 3D de l'arène (three.js), dessiné dans un canevas SOUS le jeu : sol pierre/herbe, herbe animée,
  // piliers, remparts, bannières, braseros, forêt, montagnes, château au loin, ciel de crépuscule.
  // Tout est procédural (textures en canvas) : rien à télécharger, fonctionne en double-clic (file://).
  // Les dimensions de jeu (piliers, murs) viennent de `arena` : le décor suit la collision existante.

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    smooth = (a, b, x) => {
      const t = clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    };
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Bruit de valeur périodique (textures qui se répètent sans couture).
  function makeNoise(seed) {
    const N = 256,
      g = new Float32Array(N * N),
      r = rng(seed);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const at = (i, j, p) => g[((((i % p) + p) % p) % N) + ((((j % p) + p) % p) % N) * N];
    const n = (x, y, p) => {
      const xi = Math.floor(x),
        yi = Math.floor(y),
        xf = x - xi,
        yf = y - yi,
        u = xf * xf * (3 - 2 * xf),
        v = yf * yf * (3 - 2 * yf);
      const a = at(xi, yi, p),
        b = at(xi + 1, yi, p),
        c = at(xi, yi + 1, p),
        d = at(xi + 1, yi + 1, p);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y, p = 256, oct = 4) => {
      let s = 0,
        amp = 0.5,
        f = 1,
        tot = 0;
      for (let o = 0; o < oct; o++) {
        s += n(x * f, y * f, p * f) * amp;
        tot += amp;
        amp *= 0.5;
        f *= 2;
      }
      return s / tot;
    };
  }
  const noise = makeNoise(1337),
    noise2 = makeNoise(4242);

  function canvas(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function tex(THREE, c, repeat = true, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    // une fois sur le GPU, le canevas n'est plus utile : on libère sa mémoire (Safari iOS plafonne la mémoire totale
    // des canevas ; au-delà, les canevas deviennent vides → textures noires, ex. le sol). Un canevas = une texture.
    t.onUpdate = () => {
      c.width = c.height = 1;
      t.onUpdate = null;
    };
    return t;
  }

  // Appareil de pierres (dallage ou maçonnerie) : pierres irrégulières, joints sombres, biseaux, grain, mousse.
  function stoneCanvas({
    size = E.mobile ? 512 : 1024, // mobile : 4× moins de mémoire
    rows = 6,
    minW = 0.12,
    maxW = 0.26,
    base = [0.5, 0.48, 0.44],
    vary = 0.1,
    grout = [0.12, 0.11, 0.1],
    moss = 0,
    seed = 3,
    warp = 6
  }) {
    const c = canvas(size),
      g = c.getContext('2d'),
      id = g.createImageData(size, size),
      d = id.data,
      r = rng(seed);
    const rowH = size / rows,
      stones = [];
    for (let j = 0; j < rows; j++) {
      let x = -r() * size * maxW;
      const row = [];
      while (x < size) {
        const w = size * (minW + r() * (maxW - minW));
        row.push({ x0: x, x1: x + w, t: r(), m: r() });
        x += w;
      }
      stones.push(row);
    }
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const wx = x + (noise((x / size) * 8, (y / size) * 8, 8, 2) - 0.5) * warp * 2,
          wy = y + (noise2((x / size) * 8, (y / size) * 8, 8, 2) - 0.5) * warp * 2;
        const j = ((Math.floor(wy / rowH) % rows) + rows) % rows,
          yy = ((wy % rowH) + rowH) % rowH,
          row = stones[j];
        let xx = ((wx % size) + size) % size,
          s = row.find(q => xx >= q.x0 && xx < q.x1);
        if (!s) {
          s = row.find(q => xx + size >= q.x0 && xx + size < q.x1) || row[0];
          xx += size;
        }
        const dx = Math.min(xx - s.x0, s.x1 - xx),
          dy = Math.min(yy, rowH - yy),
          e = Math.min(dx, dy);
        const grain = noise((x / size) * 24, (y / size) * 24, 24, 4),
          big = noise2((x / size) * 4, (y / size) * 4, 4, 3);
        // style peint : grain doux, chaque pierre a sa nuance chaude ou froide et un volume (claire en haut à gauche)
        const k = 1 - vary + vary * 2 * s.t,
          hue = (((s.t * 7.3 + s.m * 3.1) % 1) - 0.5) * 0.16,
          volume = 1 + 0.14 * (0.5 - yy / rowH) + 0.08 * (0.5 - (xx - s.x0) / (s.x1 - s.x0)),
          tint = [1 + hue, 1, 1 - hue];
        let col = base.map((v, i) => v * k * tint[i] * volume * (0.84 + 0.26 * grain) * (0.85 + 0.3 * big));
        const bevW = Math.max(6, (14 * size) / 1024);
        if (e < bevW) {
          const bev = e < 3 ? 0 : (e - 3) / (bevW - 3),
            lit = (yy < rowH / 2 && dy === e) || xx - s.x0 === e,
            chip = noise((x / size) * 60, (y / size) * 60, 60, 2) > 0.66; // arêtes ébréchées
          const light = chip ? 0.62 : lit ? 1.3 : 0.72;
          col = col.map(v => v * (bev + (1 - bev) * light));
        }
        if (moss && s.m < moss) {
          const mm = smooth(0.55, 0.75, noise((x / size) * 10, (y / size) * 10, 10, 3)) * (1 - smooth(4, 30, e));
          col = col.map((v, i) => v + ([0.2, 0.3, 0.12][i] - v) * mm * 0.8);
        }
        if (e < 3) {
          const gk = 0.7 + 0.6 * grain;
          col = grout.map(v => v * gk);
        }
        const o = (y * size + x) * 4;
        d[o] = clamp(col[0] * 255, 0, 255);
        d[o + 1] = clamp(col[1] * 255, 0, 255);
        d[o + 2] = clamp(col[2] * 255, 0, 255);
        d[o + 3] = 255;
      }
    g.putImageData(id, 0, 0);
    g.strokeStyle = 'rgba(20,18,16,.55)';
    g.lineWidth = 1.2; // fissures
    for (let i = 0; i < rows * 3; i++) {
      let x = r() * size,
        y = r() * size;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 40;
        y += (r() - 0.3) * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return c;
  }

  function grassCanvas(size = 512) {
    const c = canvas(size),
      g = c.getContext('2d'),
      id = g.createImageData(size, size),
      d = id.data;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const n = noise((x / size) * 6, (y / size) * 6, 6, 5),
          m = noise2((x / size) * 3, (y / size) * 3, 3, 3),
          f = noise((x / size) * 64, (y / size) * 64, 64, 1);
        let col = [0.17 + 0.1 * n, 0.32 + 0.16 * n, 0.09 + 0.05 * n];
        col = col.map((v, i) => v * (0.8 + 0.4 * m));
        if (m < 0.35) col = col.map((v, i) => v + ([0.3, 0.26, 0.15][i] - v) * smooth(0.35, 0.2, m) * 0.6); // terre
        col = col.map(v => v * (0.85 + 0.3 * f));
        const o = (y * size + x) * 4;
        d[o] = col[0] * 255;
        d[o + 1] = col[1] * 255;
        d[o + 2] = col[2] * 255;
        d[o + 3] = 255;
      }
    g.putImageData(id, 0, 0);
    const r = rng(9);
    for (let i = 0; i < 5000; i++) {
      const x = r() * size,
        y = r() * size,
        l = 2 + r() * 5;
      g.strokeStyle = `rgba(${(120 + r() * 80) | 0},${(170 + r() * 60) | 0},${(60 + r() * 40) | 0},.35)`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - l);
      g.stroke();
    }
    return c;
  }

  function glowTexture(THREE) {
    const c = canvas(64),
      g = c.getContext('2d'),
      gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function flameTexture(THREE) {
    const c = canvas(64, 128),
      g = c.getContext('2d'),
      gr = g.createRadialGradient(32, 92, 2, 32, 80, 60);
    gr.addColorStop(0, 'rgba(255,250,220,1)');
    gr.addColorStop(0.25, 'rgba(255,190,70,.9)');
    gr.addColorStop(0.6, 'rgba(230,80,20,.45)');
    gr.addColorStop(1, 'rgba(120,20,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(32, 4);
    g.bezierCurveTo(60, 60, 58, 120, 32, 124);
    g.bezierCurveTo(6, 120, 4, 60, 32, 4);
    g.fill();
    return new THREE.CanvasTexture(c);
  }

  // Quantité d'herbe (0 = dallage, 1 = herbe) : partagé entre la texture de mélange et le placement des brins.
  function grassAmount(arena, x, z) {
    const e = Math.max(Math.abs(x) / arena.halfX, Math.abs(z) / arena.halfZ),
      n = noise(x * 0.07 + 50, z * 0.07 + 50, 256, 4);
    let m = smooth(0.56, 0.84, e + (n - 0.5) * 0.4);
    for (const p of arena.pillars) {
      const d = Math.hypot(x - p.x, z - p.z) - p.r;
      m = Math.max(m, smooth(2.2, 0.3, d) * smooth(0.4, 0.6, n));
    } // herbe au pied des piliers
    return m;
  }

  // Fusionne des maillages statiques qui partagent un matériau (transformations appliquées) : des centaines
  // d'appels de dessin deviennent quelques-uns, ce qui soulage beaucoup le processeur sur mobile.
  function mergeMeshes(THREE, meshes, toLocal) {
    const groups = new Map();
    for (const m of meshes) {
      const k = m.material.uuid + '|' + m.castShadow + '|' + m.receiveShadow;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    const out = [];
    for (const list of groups.values()) {
      if (list.length < 2) {
        out.push(null);
        continue;
      }
      const pos = [],
        nor = [],
        uv = [],
        idx = [];
      let base = 0;
      for (const m of list) {
        const g = m.geometry,
          mat = new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld),
          nm = new THREE.Matrix3().getNormalMatrix(mat);
        const P = g.attributes.position,
          N = g.attributes.normal,
          U = g.attributes.uv,
          v = new THREE.Vector3();
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(mat);
          pos.push(v.x, v.y, v.z);
          if (N) {
            v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
            nor.push(v.x, v.y, v.z);
          } else nor.push(0, 1, 0);
          if (U) uv.push(U.getX(i), U.getY(i));
          else uv.push(0, 0);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
        else for (let i = 0; i < P.count; i++) idx.push(base + i);
        base += P.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const mm = new THREE.Mesh(geo, list[0].material);
      mm.castShadow = list[0].castShadow;
      mm.receiveShadow = list[0].receiveShadow;
      for (const m of list) {
        m.parent.remove(m);
        m.geometry.dispose();
      }
      out.push(mm);
    }
    return out.filter(Boolean);
  }
  function mergeStatic(THREE, S) {
    S.updateMatrixWorld(true);
    const list = [];
    S.traverse(o => {
      if (
        o.isMesh &&
        !o.isInstancedMesh &&
        !o.isSkinnedMesh &&
        !o.userData.dynamic &&
        !o.material.isShaderMaterial &&
        !o.material.transparent &&
        !o.material.onBeforeCompile.toString().includes('time')
      )
        list.push(o);
    });
    for (const m of mergeMeshes(THREE, list, new THREE.Matrix4())) S.add(m);
  }

  // Lumière « peinte » du décor (05/11/2026, style des MMO peints à la main) : lumière directe en plages douces,
  // ombres teintées bleu-violet, lumières chaudes, couleurs plus saturées. Appliquée à chaque matériau standard de la
  // carte après mergeStatic (qui lit le texte de onBeforeCompile). Ancrages three r128 : dotNL et la ligne gl_FragColor.
  const PAINT = {
    nl: 'float dotNL = saturate( dot( geometry.normal, directLight.direction ) );',
    softNL:
      'float nlRaw = dot( geometry.normal, directLight.direction ); float dotNL = mix( saturate( nlRaw ), smoothstep( -0.05, 0.4, nlRaw ), 0.6 );',
    out: 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
    grade: `{float pl=dot(outgoingLight,vec3(.299,.587,.114));
      outgoingLight*=mix(vec3(.9,.92,1.05),vec3(1.05,1.01,.95),smoothstep(.03,.4,pl));
      outgoingLight=mix(vec3(pl),outgoingLight,1.15);}`
  };
  function paintMaterial(THREE, m) {
    if (!m?.isMeshStandardMaterial || m.userData.painted) return;
    m.userData.painted = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <lights_physical_pars_fragment>',
          THREE.ShaderChunk.lights_physical_pars_fragment.replace(PAINT.nl, PAINT.softNL)
        )
        .replace(PAINT.out, PAINT.grade + PAINT.out);
    };
    m.needsUpdate = true;
  }
  function paintScene(THREE, S) {
    S.traverse(o => {
      for (const m of [].concat(o.material || [])) paintMaterial(THREE, m);
    });
  }

  const E = { ok: false, THREE: null };

  function init(THREE, canvasEl, arena, { mobile = false, map = 'castle' } = {}) {
    E.mapId = E.mapId || map;
    E.THREE = THREE;
    E.arena = arena;
    E.mobile = mobile;
    const R = (E.renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: !mobile,
      powerPreference: 'high-performance'
    }));
    R.setPixelRatio(Math.min(mobile ? 1 : 1.5, devicePixelRatio || 1));
    R.outputEncoding = THREE.sRGBEncoding;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.15;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    E.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1600);
    // bloom + étalonnage (render/env_post.js) : PC seulement ; ?post=0 pour comparer
    E.post =
      !mobile && typeof createEnvPost === 'function' && !/[?&]post=0/.test(globalThis.location?.search || '')
        ? createEnvPost(THREE, R)
        : null;
    E.time = { value: 0 };
    E.px = { value: 600 }; // pixels par unité à 1 m de la caméra (taille des particules d'ambiance)
    E.ok = true;
    return setMap(E.mapId || 'castle', arena);
  }
  // Cartes : constructeur de scène par identifiant, chacun dans src/render/map_<id>.js (ArenaEnv.registerMap).
  const MAP_BUILDERS = {};
  function registerMap(id, fn) {
    MAP_BUILDERS[id] = fn;
  }
  // Ajouts communs à toutes les cartes, après leur constructeur (même contrat : (THREE, S, arena, E)) : braises des
  // flammes (render/env_ambient.js).
  const AFTER_BUILD = [];
  function afterBuild(fn) {
    AFTER_BUILD.push(fn);
  }
  function disposeScene(S) {
    S.traverse(o => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) {
        for (const k in m) if (m[k]?.isTexture) m[k].dispose();
        m.dispose?.();
      }
    });
  }
  function setMap(id, arena) {
    if (!E.renderer) {
      E.mapId = id;
      return true;
    }
    if (E.scene && E.mapId === id) return true;
    if (E.scene) disposeScene(E.scene);
    E.mapId = id;
    E.arena = arena;
    E.crystals = [];
    E.flames = [];
    E.floaters = [];
    E.rune = null;
    E.anim = [];
    const S = (E.scene = new E.THREE.Scene());
    (MAP_BUILDERS[id] || MAP_BUILDERS.castle)(E.THREE, S, arena, E);
    for (const fn of AFTER_BUILD) fn(E.THREE, S, arena, E);
    buildShadows(E.THREE, S);
    mergeStatic(E.THREE, S);
    paintScene(E.THREE, S);
    // décor immobile : la carte d'ombres est calculée une fois, pas à chaque image
    E.renderer.shadowMap.autoUpdate = false;
    E.renderer.shadowMap.needsUpdate = true;
    return true;
  }

  // ---- Ombres de contact sous les personnages (dessinés sur un autre canevas) ----
  function buildShadows(THREE, S) {
    const c = canvas(64),
      g = c.getContext('2d'),
      gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)');
    gr.addColorStop(0.6, 'rgba(0,0,0,.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const mat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4
    });
    E.blobs = [];
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), mat);
      b.rotation.x = -Math.PI / 2;
      b.position.y = 0.03;
      b.visible = false;
      S.add(b);
      E.blobs.push(b);
    }
  }

  function render(camPos, target, units, w, h) {
    if (!E.ok) return;
    const R = E.renderer,
      t = performance.now() / 1000;
    E.time.value = t;
    const cw = Math.max(1, Math.floor(w)),
      ch = Math.max(1, Math.floor(h)),
      pr = Math.min(E.mobile ? 1 : 1.5, devicePixelRatio || 1) * (window.PERF ? PERF.scale : 1);
    if (R.getPixelRatio() !== pr) {
      R.setPixelRatio(pr);
      E.w = 0;
    }
    if (E.w !== cw || E.h !== ch) {
      R.setSize(cw, ch, false);
      E.camera.aspect = cw / ch;
      E.camera.updateProjectionMatrix();
      E.px.value = (ch * R.getPixelRatio()) / (2 * Math.tan((E.camera.fov * Math.PI) / 360));
      E.w = cw;
      E.h = ch;
    }
    E.camera.position.set(camPos[0], camPos[1], camPos[2]);
    E.camera.lookAt(target[0], target[1], target[2]);
    for (const c of E.crystals) {
      c.mesh.position.y = c.y + Math.sin(t * 1.3 + c.phase) * 0.18;
      c.mesh.rotation.y = t * 0.6 + c.phase;
      c.sprite.position.y = c.mesh.position.y;
      c.sprite.material.opacity = 0.6 + Math.sin(t * 2.1 + c.phase) * 0.15;
    }
    for (const f of E.flames) {
      const k = f.k;
      if (f.s) {
        const fl = 0.9 + Math.sin(t * 13 + k * 3) * 0.12 + Math.sin(t * 7.7 + k) * 0.08;
        f.s.scale.set(0.6 * fl, 1.1 * fl, 1);
      } else f.light.intensity = 1.1 + Math.sin(t * 11 + k) * 0.15 + Math.sin(t * 5.3 + k) * 0.1;
    }
    for (const f of E.floaters || []) f.g.position.y = f.y + Math.sin(t * 0.35 + f.ph) * 1.6;
    for (const fn of E.anim || []) fn(t);
    if (E.rune) E.rune.material.emissiveIntensity = 1.25 + Math.sin(t * 1.5) * 0.25;
    (units || []).forEach((u, i) => {
      const b = E.blobs[i];
      if (!b) return;
      b.visible = !!u.alive;
      b.position.set(u.rx ?? u.x, 0.03 + (u.grounded ? u.y || 0 : 0), u.rz ?? u.z);
      const k = 1 / (1 + Math.max(0, u.y || 0) * 0.6);
      b.scale.setScalar(k);
    });
    for (let i = (units || []).length; i < E.blobs.length; i++) E.blobs[i].visible = false;
    if (E.post) E.post.render(E.scene, E.camera);
    else R.render(E.scene, E.camera);
  }

  const stats = () =>
    E.renderer ? { calls: E.renderer.info.render.calls, triangles: E.renderer.info.render.triangles } : null;
  return {
    init,
    setMap,
    registerMap,
    afterBuild,
    helpers: {
      clamp,
      smooth,
      rng,
      noise,
      noise2,
      canvas,
      tex,
      stoneCanvas,
      glowTexture,
      flameTexture,
      mergeMeshes,
      grassAmount,
      grassCanvas
    },
    render,
    stats,
    mergeMeshes,
    get ok() {
      return E.ok;
    },
    get mapId() {
      return E.mapId;
    },
    get postFx() {
      return !!E.post;
    },
    // diagnostic (programmes compilés, limites du GPU)
    get renderer() {
      return E.renderer;
    },
    grassAmount
  };
});
