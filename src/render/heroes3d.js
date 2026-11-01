'use strict';
// Personnages 3D (three.js) : prévisualisation de sélection, chargement des kits, animations, bêtes, mouton, portraits, racines.
// ---------- Artist-made 3D character layer (CC0 assets) ----------
// This layer is deliberately isolated from GameLogic: camera/movement controls stay frozen.
const characterCanvas = $('character3d');
const HF = {
  enabled: false,
  attempted: false,
  renderer: null,
  scene: null,
  camera: null,
  loader: null,
  records: new Map(),
  last: 0,
  loadErrors: new Set()
};
const PREVIEW = {
  renderer: null,
  scene: null,
  camera: null,
  loader: null,
  group: null,
  mixer: null,
  action: null,
  clips: [],
  canvas: null,
  currentKey: '',
  animId: 0,
  requestId: 0,
  loaded: false,
  loadTimer: null
};
let renderAlpha = 1;
const HF_ASSET_BASE_JEV = 'https://cdn.jsdelivr.net/gh/kikoncuo/jevfire@main/web/public/assets/';
const HF_ASSET_BASE_HOLLOW = 'https://cdn.jsdelivr.net/gh/euuuuuuan/hollowmere-public@main/public/models/char/';
function hfClassBaseAsset(u) {
  if (u.race === 'undead') {
    if (u.cls === 'shade') return HF_ASSET_BASE_HOLLOW + 'Skeleton_Rogue.glb';
    if (u.cls === 'arcanist' || u.cls === 'oracle' || u.cls === 'warden' || u.cls === 'warlock')
      return HF_ASSET_BASE_HOLLOW + 'Skeleton_Mage.glb';
    return HF_ASSET_BASE_HOLLOW + 'Skeleton_Warrior.glb';
  }
  if (u.cls === 'shade') return HF_ASSET_BASE_JEV + 'rogue.glb';
  if (u.cls === 'sentinel') return HF_ASSET_BASE_JEV + 'knight.glb';
  if (u.cls === 'reaver') return HF_ASSET_BASE_JEV + 'barbarian.glb';
  return HF_ASSET_BASE_HOLLOW + 'Mage.glb';
}
function hfAssetCandidatesFor(u) {
  // Keep the class silhouette first. Orc/Elf are race treatments on a proven class model,
  // not separate external models that can disappear or break CORS.
  const primary = hfClassBaseAsset(u),
    fallbacks = [];
  if (u.cls === 'arcanist' || u.cls === 'oracle' || u.cls === 'warden' || u.cls === 'warlock')
    fallbacks.push(HF_ASSET_BASE_JEV + 'knight.glb');
  else fallbacks.push(HF_ASSET_BASE_HOLLOW + 'Mage.glb');
  return [primary, ...fallbacks.filter(x => x !== primary)];
}
function hfAssetFor(u) {
  return hfAssetCandidatesFor(u)[0];
}

function previewEnsure() {
  if (!window.THREE || !THREE.GLTFLoader) return false;
  const canvas = $('preview3d');
  if (!canvas) return false;
  THREE.Cache.enabled = true;
  if (PREVIEW.renderer && PREVIEW.canvas === canvas) return true;
  if (PREVIEW.animId) {
    cancelAnimationFrame(PREVIEW.animId);
    PREVIEW.animId = 0;
  }
  if (PREVIEW.renderer) {
    try {
      PREVIEW.renderer.dispose();
    } catch (e) {}
  }
  PREVIEW.canvas = canvas;
  try {
    PREVIEW.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    });
    PREVIEW.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    PREVIEW.renderer.setClearColor(0x000000, 0);
    PREVIEW.renderer.outputEncoding = THREE.sRGBEncoding;
    PREVIEW.scene = new THREE.Scene();
    PREVIEW.camera = new THREE.PerspectiveCamera(36, 1, 0.08, 40);
    PREVIEW.camera.position.set(0, 1.42, 5.1);
    PREVIEW.camera.lookAt(0, 1.15, 0);
    PREVIEW.loader = HF.loader || new THREE.GLTFLoader();
    PREVIEW.scene.add(new THREE.HemisphereLight(0xdbe6ff, 0x3a2a1b, 1.28));
    const key = new THREE.DirectionalLight(0xffe4ba, 1.7);
    key.position.set(-4, 6, 4);
    PREVIEW.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86b6ff, 0.95);
    rim.position.set(4, 5, -6);
    PREVIEW.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.95, 0.22, 48),
      new THREE.MeshStandardMaterial({ color: 0x534432, roughness: 0.95, metalness: 0.02 })
    );
    floor.position.y = -0.12;
    PREVIEW.scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.045, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0xd7a44b, transparent: true, opacity: 0.65 })
    );
    ring.rotation.x = Math.PI / 2;
    PREVIEW.scene.add(ring);
    const loop = () => {
      if (!PREVIEW.renderer || PREVIEW.canvas !== $('preview3d')) return;
      const w = Math.max(1, canvas.clientWidth || 300),
        h = Math.max(1, canvas.clientHeight || 360);
      PREVIEW.renderer.setSize(w, h, false);
      PREVIEW.camera.aspect = w / h;
      PREVIEW.camera.updateProjectionMatrix();
      if (PREVIEW.group && PREVIEW.loaded) PREVIEW.group.rotation.y += 0.0045;
      if (PREVIEW.mixer) PREVIEW.mixer.update(1 / 60);
      PREVIEW.renderer.render(PREVIEW.scene, PREVIEW.camera);
      PREVIEW.animId = requestAnimationFrame(loop);
    };
    PREVIEW.animId = requestAnimationFrame(loop);
    return true;
  } catch (e) {
    console.warn('Preview renderer indisponible', e);
    PREVIEW.renderer = null;
    return false;
  }
}
function previewSetAnim() {
  if (!PREVIEW.mixer || !PREVIEW.group) return;
  const rec = { mixer: PREVIEW.mixer, clips: PREVIEW.clips || [], action: PREVIEW.action, animKey: PREVIEW.currentKey };
  const fake = { alive: true, grounded: true, moving: false, stun: 0, fear: 0, action: 0, actionType: '', cast: null };
  hfSetAnim(rec, fake);
  PREVIEW.action = rec.action;
  PREVIEW.currentKey = rec.animKey;
}
function previewClearGroup() {
  if (PREVIEW.group && PREVIEW.scene) PREVIEW.scene.remove(PREVIEW.group);
  PREVIEW.group = null;
  PREVIEW.mixer = null;
  PREVIEW.action = null;
  PREVIEW.currentKey = '';
  PREVIEW.loaded = false;
}
function previewFallbackModel(fake, group) {
  // Guaranteed local Three.js fallback: never leave the selection panel empty.
  const skin =
    fake.race === 'orc' ? 0x4b8b42 : fake.race === 'undead' ? 0x9aa7a6 : fake.race === 'elf' ? 0xdab092 : 0xd2a477;
  const C = CLASS[fake.cls],
    accent = new THREE.Color(C.accent[0], C.accent[1], C.accent[2]);
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.82, metalness: 0.01 });
  const cloth = new THREE.MeshStandardMaterial({
    color: new THREE.Color(C.color[0], C.color[1], C.color[2]),
    roughness: 0.78,
    metalness: 0.03
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.4, metalness: 0.65 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.78, 6, 14), cloth);
  torso.position.y = 1.02;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), skinMat);
  head.position.y = 1.79;
  head.scale.set(fake.race === 'orc' ? 1.15 : 0.96, fake.race === 'orc' ? 1.05 : 1, 1);
  group.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.62, 5, 12), skinMat);
    arm.position.set(side * 0.44, 1.12, 0);
    arm.rotation.z = side * 0.12;
    group.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 5, 12), cloth);
    leg.position.set(side * 0.17, 0.38, 0);
    group.add(leg);
  }
  if (fake.race === 'orc') {
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(
        new THREE.ConeGeometry(0.028, 0.13, 10),
        new THREE.MeshStandardMaterial({ color: 0xeee1bd, roughness: 0.85 })
      );
      tusk.rotation.x = Math.PI;
      tusk.position.set(side * 0.075, 1.69, 0.205);
      group.add(tusk);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.23, 9), skinMat);
      ear.rotation.z = (side * Math.PI) / 2;
      ear.position.set(side * 0.28, 1.82, 0);
      group.add(ear);
    }
    head.scale.x = 1.22;
    torso.scale.x = 1.18;
  }
  if (fake.race === 'elf') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.3, 9), skinMat);
      ear.rotation.z = (side * Math.PI) / 2;
      ear.position.set(side * 0.27, 1.82, 0);
      group.add(ear);
    }
  }
  const rec = { group, decor: null, aura: null };
  hfRaceDecor(rec, fake, null);
  group.scale.set(...hfRaceScale(fake.race));
  PREVIEW.loaded = true;
  PREVIEW.clips = [];
  PREVIEW.mixer = null;
  PREVIEW.action = null;
}
function updateSelectPreview3D(rk, ck) {
  const load = $('previewLoading');
  if (load) {
    load.style.display = 'block';
    load.textContent = 'Chargement du personnage…';
  }
  if (!previewEnsure()) {
    if (load) load.textContent = 'Prévisualisation 3D indisponible';
    return;
  }
  const requestId = ++PREVIEW.requestId;
  previewClearGroup();
  if (PREVIEW.loadTimer) clearTimeout(PREVIEW.loadTimer);
  PREVIEW.loadTimer = setTimeout(() => {
    if (requestId === PREVIEW.requestId && !PREVIEW.loaded && load) {
      load.textContent = 'Chargement lent — vérifie ta connexion';
    }
  }, 6500);
  const fake = makeUnit(ck || 'sentinel', 0, 0, 0, 'Preview', false, rk || 'human', 0),
    group = new THREE.Group();
  PREVIEW.group = group;
  PREVIEW.scene.add(group);
  const loader = HF.loader || PREVIEW.loader,
    candidates = hfAssetCandidatesFor(fake);
  const tryCandidate = index => {
    const url = candidates[index];
    loader.load(
      url,
      gltf => {
        if (requestId !== PREVIEW.requestId || PREVIEW.group !== group) return;
        try {
          const model = gltf.scene;
          model.userData.hdRaceVisual = false;
          hfNormalizeModel(model, fake);
          group.add(model);
          const rs = hfRaceScale(fake.race);
          group.scale.set(rs[0], rs[1], rs[2]);
          PREVIEW.clips = gltf.animations || [];
          if (PREVIEW.clips.length) {
            PREVIEW.mixer = new THREE.AnimationMixer(model);
            previewSetAnim();
          }
          const rec = { group, decor: null, aura: null };
          hfRaceDecor(rec, fake, model);
          group.position.set(0, 0, 0);
          group.rotation.y = 0.2;
          PREVIEW.loaded = true;
          if (PREVIEW.loadTimer) {
            clearTimeout(PREVIEW.loadTimer);
            PREVIEW.loadTimer = null;
          }
          if (load) {
            load.textContent = '';
            load.style.display = 'none';
          }
        } catch (e) {
          console.warn('Erreur preview modèle', e);
          if (index + 1 < candidates.length) tryCandidate(index + 1);
          else {
            previewClearGroup();
            PREVIEW.group = group;
            PREVIEW.scene.add(group);
            previewFallbackModel(fake, group);
            if (load) {
              load.textContent = '';
              load.style.display = 'none';
            }
          }
        }
      },
      undefined,
      err => {
        if (requestId !== PREVIEW.requestId) return;
        console.warn('preview load failed', url, err);
        if (index + 1 < candidates.length) {
          tryCandidate(index + 1);
          return;
        }
        if (PREVIEW.loadTimer) {
          clearTimeout(PREVIEW.loadTimer);
          PREVIEW.loadTimer = null;
        }
        previewClearGroup();
        PREVIEW.group = group;
        PREVIEW.scene.add(group);
        previewFallbackModel(fake, group);
        if (load) {
          load.textContent = '';
          load.style.display = 'none';
        }
      }
    );
  };
  const kit = hfKitFor(fake);
  if (kit)
    hfLoadKit(
      kit,
      loader,
      (model, clips) => {
        if (requestId !== PREVIEW.requestId || PREVIEW.group !== group) return;
        group.add(model);
        const rs = hfRaceScale(fake.race, true);
        group.scale.set(rs[0], rs[1], rs[2]);
        PREVIEW.clips = clips;
        PREVIEW.mixer = new THREE.AnimationMixer(model);
        previewSetAnim();
        group.position.set(0, 0, 0);
        group.rotation.y = 0.2;
        PREVIEW.loaded = true;
        if (PREVIEW.loadTimer) {
          clearTimeout(PREVIEW.loadTimer);
          PREVIEW.loadTimer = null;
        }
        if (load) {
          load.textContent = '';
          load.style.display = 'none';
        }
      },
      () => {
        if (requestId === PREVIEW.requestId) tryCandidate(0);
      }
    );
  else tryCandidate(0);
}
function hfInit() {
  if (!window.THREE || !THREE.GLTFLoader || !characterCanvas) return false;
  try {
    THREE.Cache.enabled = true;
    HF.renderer = new THREE.WebGLRenderer({
      canvas: characterCanvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true
    });
    HF.renderer.setClearColor(0x000000, 0);
    HF.renderer.setPixelRatio(
      Math.min(document.body.classList.contains('mobile-mode') ? 1.5 : 2.0, window.devicePixelRatio || 1)
    );
    HF.renderer.outputEncoding = THREE.sRGBEncoding;
    HF.renderer.shadowMap.enabled = false;
    HF.scene = new THREE.Scene();
    HF.camera = new THREE.PerspectiveCamera(60, 1, 0.08, 130);
    HF.loader = new THREE.GLTFLoader();
    try {
      window.SpellFX && SpellFX.init(THREE, HF.scene, HF.renderer, HF.camera);
    } catch (e) {
      console.warn('Effets 3D indisponibles', e);
    }
    HF.scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x2a2440, 1.1));
    const key = new THREE.DirectionalLight(0xfff0dc, 1.45);
    key.position.set(-5, 10, 4);
    key.castShadow = false;
    HF.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7f9cff, 1.15);
    rim.position.set(8, 5, -8);
    HF.scene.add(rim);
    // Invisible depth-only arena geometry occludes characters behind pillars/walls.
    const occMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      colorWrite: false,
      depthWrite: true,
      side: THREE.DoubleSide
    });
    for (const pp of arena.pillars) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(pp.r + 0.02, pp.r + 0.02, pp.h, 24), occMat);
      m.position.set(pp.x, pp.h / 2, pp.z);
      m.renderOrder = -10;
      HF.scene.add(m);
    }
    const wallSpecs = [
      [0, 2.45, -arena.halfZ - 0.15, arena.halfX * 2 + 0.6, 4.9, 0.3],
      [0, 2.45, arena.halfZ + 0.15, arena.halfX * 2 + 0.6, 4.9, 0.3],
      [-arena.halfX - 0.15, 2.45, 0, 0.3, 4.9, arena.halfZ * 2 + 0.6],
      [arena.halfX + 0.15, 2.45, 0, 0.3, 4.9, arena.halfZ * 2 + 0.6]
    ];
    for (const w of wallSpecs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w[3], w[4], w[5]), occMat);
      m.position.set(w[0], w[1], w[2]);
      m.renderOrder = -10;
      HF.scene.add(m);
    }
    HF.enabled = true;
    return true;
  } catch (e) {
    console.warn('Renderer personnages HD indisponible', e);
    HF.enabled = false;
    return false;
  }
}
function hfRaceScale(race, kit = false) {
  // Personnages assemblés : le nain a déjà ses proportions (jambes courtes, torse large), pas d'écrasement.
  if (race === 'dwarf') return kit ? [0.98, 0.86, 0.98] : [1.13, 0.84, 1.13];
  if (race === 'elf') return [0.98, 1.06, 0.98];
  if (race === 'orc') return [1.1, 1.05, 1.08];
  if (race === 'undead') return [0.96, 1.0, 0.96];
  return [1, 1, 1];
}
function hfHeadAnchor(model, group) {
  const p = new THREE.Vector3();
  let head = null;
  model?.traverse?.(o => {
    if (!head && o.isBone && /(^|[_ .-])head($|[_ .-])/i.test(o.name || '')) head = o;
  });
  group.updateMatrixWorld(true);
  model?.updateMatrixWorld?.(true);
  if (head) {
    head.getWorldPosition(p);
    group.worldToLocal(p);
    p.y += 0.035;
    return p;
  }
  const box = new THREE.Box3().setFromObject(model),
    size = new THREE.Vector3(),
    center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  group.worldToLocal(center);
  return new THREE.Vector3(center.x, box.min.y + size.y * 0.78, center.z);
}
function hfClassDecor(rec, u, anchorGroup) {
  if (!window.THREE || !rec?.group) return;
  const g = anchorGroup || rec.decor || rec.group,
    C = CLASS[u.cls],
    accent = new THREE.Color(C.accent[0], C.accent[1], C.accent[2]);
  const metal = new THREE.MeshStandardMaterial({ color: 0x4f5660, roughness: 0.36, metalness: 0.72 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.42, metalness: 0.68 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x5a321d, roughness: 0.82, metalness: 0.02 });
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.55,
    roughness: 0.22,
    metalness: 0.12
  });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xd9c89a, roughness: 0.82, metalness: 0.02 });
  const addStaff = (crystalColor = accent) => {
    const staff = new THREE.Group();
    staff.position.set(0.54, 1.08, 0.04);
    staff.rotation.z = -0.1;
    g.add(staff);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.72, 14), leather);
    shaft.position.y = 0;
    staff.add(shaft);
    const orbMat = glow.clone();
    orbMat.color = crystalColor;
    orbMat.emissive = crystalColor;
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 2), orbMat);
    orb.position.y = 0.91;
    staff.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 10, 24), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.9;
    staff.add(ring);
  };
  if (u.cls === 'sentinel') {
    const pad = new THREE.Group();
    pad.position.set(-0.48, 1.54, 0.0);
    g.add(pad);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 28, 18), darkMetal);
    shell.scale.set(1.22, 0.62, 0.98);
    pad.add(shell);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 12), ivory);
      sp.position.set(-0.16 + i * 0.16, 0.17, -0.01);
      sp.rotation.z = (i - 1) * 0.18;
      pad.add(sp);
    }
    const axe = new THREE.Group();
    axe.position.set(0.55, 0.9, -0.1);
    axe.rotation.z = -0.18;
    g.add(axe);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.15, 12), leather);
    axe.add(h);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 4), metal);
    blade.position.set(0.09, 0.55, 0);
    blade.rotation.z = -Math.PI / 2;
    axe.add(blade);
  } else if (u.cls === 'arcanist') {
    addStaff(accent);
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.31, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x5d2f72, roughness: 0.68, metalness: 0.02 })
    );
    book.position.set(-0.33, 1.05, 0.18);
    book.rotation.y = 0.28;
    g.add(book);
  } else if (u.cls === 'oracle') {
    addStaff(new THREE.Color(1, 0.88, 0.48));
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.015, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe89c, transparent: true, opacity: 0.85 })
    );
    halo.position.set(0, 2.23, 0);
    halo.rotation.x = Math.PI / 2;
    g.add(halo);
  } else if (u.cls === 'reaver') {
    const sword = new THREE.Group();
    sword.position.set(0.55, 1.02, -0.08);
    sword.rotation.z = -0.12;
    g.add(sword);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 12), leather);
    h.position.y = -0.46;
    sword.add(h);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.08, 0.035), darkMetal);
    blade.position.y = 0.18;
    sword.add(blade);
    for (let i = -2; i <= 2; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.018, 0.042), glow);
      rune.position.set(0, i * 0.16 + 0.18, 0.03);
      sword.add(rune);
    }
  } else if (u.cls === 'warden') {
    const antlerMat = new THREE.MeshStandardMaterial({ color: 0x7a5b32, roughness: 0.88 });
    for (const side of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.42, 10), antlerMat);
      a.position.set(side * 0.16, 2.13, 0);
      a.rotation.z = side * 0.42;
      g.add(a);
    }
  } else if (u.cls === 'shade') {
    for (const side of [-1, 1]) {
      const dagger = new THREE.Group();
      dagger.position.set(side * 0.42, 0.98, 0.15);
      dagger.rotation.z = side * 0.18;
      g.add(dagger);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 10), leather);
      grip.position.y = -0.1;
      dagger.add(grip);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.38, 4), metal);
      blade.position.y = 0.18;
      dagger.add(blade);
    }
  } else if (u.cls === 'warlock') {
    addStaff(new THREE.Color(0.32, 1, 0.12));
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), ivory);
    skull.position.set(-0.33, 1.12, 0.17);
    skull.scale.set(1, 0.78, 0.82);
    g.add(skull);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x62ff3c })
      );
      eye.position.set(-0.33 + side * 0.035, 1.13, 0.25);
      g.add(eye);
    }
  }
}
function hfRaceDecor(rec, u, model = null) {
  if (!window.THREE) return;
  const g = (rec.decor = new THREE.Group());
  rec.group.add(g);
  const skin = u.race === 'orc' ? 0x4c8b42 : u.race === 'undead' ? 0x9aa7a6 : u.race === 'elf' ? 0xdab092 : 0xd2a477;
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.72, metalness: 0.01 });
  const darkMat = new THREE.MeshStandardMaterial({
    color: u.race === 'orc' ? 0x261c16 : 0x624a3c,
    roughness: 0.9,
    metalness: 0.03
  });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xeee0bd, roughness: 0.82 });
  const headPos = model ? hfHeadAnchor(model, rec.group) : new THREE.Vector3(0, 1.78, 0);
  const face = new THREE.Group();
  face.position.copy(headPos);
  g.add(face);
  if (u.race === 'elf') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 10), skinMat);
      ear.rotation.z = (side * Math.PI) / 2;
      ear.rotation.y = -side * 0.1;
      ear.position.set(side * 0.24, 0.01, 0.0);
      face.add(ear);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x85eaff, transparent: true, opacity: 0.82 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeMat);
      eye.position.set(side * 0.055, 0.015, 0.175);
      face.add(eye);
    }
  } else if (u.race === 'orc') {
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 18), skinMat);
    mask.scale.set(0.92, 1.02, 0.84);
    mask.position.set(0, -0.015, 0.015);
    face.add(mask);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), skinMat);
    jaw.scale.set(1.22, 0.55, 0.76);
    jaw.position.set(0, -0.13, 0.105);
    face.add(jaw);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24, 9), skinMat);
      ear.rotation.z = (side * Math.PI) / 2;
      ear.position.set(side * 0.235, 0.0, -0.005);
      face.add(ear);
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.13, 9), ivory);
      tusk.rotation.x = Math.PI;
      tusk.position.set(side * 0.072, -0.115, 0.19);
      face.add(tusk);
    }
  } else if (u.race === 'dwarf') {
    const beardMat = new THREE.MeshStandardMaterial({ color: 0x6b3d1e, roughness: 1 });
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 10), beardMat);
    beard.rotation.x = Math.PI;
    beard.position.set(0, -0.16, 0.08);
    face.add(beard);
  }
  // Extra heroic styling inspired by the supplied reference, only on the HD orc.
  if (u.race === 'orc') {
    const leather = new THREE.MeshStandardMaterial({ color: 0x4a2b1c, roughness: 0.84, metalness: 0.02 }),
      iron = new THREE.MeshStandardMaterial({ color: 0x3c454c, roughness: 0.38, metalness: 0.72 });
    const necklace = new THREE.Group();
    necklace.position.set(0, 1.53, 0.18);
    g.add(necklace);
    for (let i = -2; i <= 2; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 10), ivory);
      tooth.position.set(i * 0.07, -Math.abs(i) * 0.008, 0.02);
      tooth.rotation.x = Math.PI;
      necklace.add(tooth);
    }
    if (u.cls === 'sentinel' || u.cls === 'reaver') {
      const bracerL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.34, 18), leather);
      bracerL.position.set(-0.48, 0.92, 0.02);
      bracerL.rotation.z = 0.1;
      g.add(bracerL);
      const bracerR = bracerL.clone();
      bracerR.position.x = 0.48;
      bracerR.rotation.z = -0.1;
      g.add(bracerR);
      for (const side of [-1, 1])
        for (let j = 0; j < 3; j++) {
          const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 8, 24), iron);
          band.position.set(side * 0.48, 0.81 + j * 0.11, 0.02);
          band.rotation.x = Math.PI / 2;
          g.add(band);
        }
    }
  }
  hfClassDecor(rec, u, g);
  hfAddAura(rec, u, g);
}
function hfAddAura(rec, u, g) {
  const c = CLASS[u.cls].accent,
    col = new THREE.Color(c[0], c[1], c[2]);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.035;
  g.add(ring);
  rec.aura = ring;
}
// Personnages CC0 assemblés (characters.js) : prioritaires quand un kit existe pour la race+classe,
// sinon (ou en cas d'échec de chargement) on garde les modèles historiques.
function hfKitFor(u) {
  return window.CharacterKit ? CharacterKit.kitFor(u.race, u.cls) : null;
}
function hfLoadKit(kitId, loader, onModel, onFail) {
  CharacterKit.build(THREE, kitId, { loader, outline: !document.body.classList.contains('mobile-mode') })
    .then(k => {
      k.root.scale.setScalar(2.18 / k.height);
      onModel(k.root, k.clips);
    })
    .catch(e => {
      console.warn('Personnage indisponible, modèle de secours :', kitId, e);
      onFail();
    });
}
function hfNormalizeModel(root, u) {
  const maxAniso = HF.renderer?.capabilities?.getMaxAnisotropy
    ? Math.min(8, HF.renderer.capabilities.getMaxAnisotropy())
    : 4;
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.material) {
        o.material = o.material.clone();
        o.material.side = THREE.FrontSide;
        const maps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
        for (const k of maps) {
          const tex = o.material[k];
          if (tex) {
            tex.anisotropy = maxAniso;
            tex.needsUpdate = true;
          }
        }
      }
    }
  });
  const box = new THREE.Box3().setFromObject(root),
    size = new THREE.Vector3();
  box.getSize(size);
  const base = size.y > 0 ? 2.18 / size.y : 1;
  root.scale.setScalar(base);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  // Most KayKit/Quaternius humanoids face +Z; keep yaw convention identical to GameLogic.
}
function hfFindClip(rec, names) {
  const clips = rec.clips || [];
  for (const n of names) {
    const x = clips.find(c => c.name.toLowerCase() === n.toLowerCase());
    if (x) return x;
  }
  for (const n of names) {
    const x = clips.find(c => c.name.toLowerCase().includes(n.toLowerCase()));
    if (x) return x;
  }
  return clips[0] || null;
}
function hfSetAnim(rec, u) {
  if (!rec.mixer || !rec.clips?.length || u.poly > 0) return;
  // course « tenue » 0,18 s après l'arrêt : pas de bascule course/repos à chaque pas de simulation
  const t = now();
  if (u.moving) rec.lastMove = t;
  const moving = u.moving || t - (rec.lastMove || 0) < 0.18;
  let key = 'idle',
    names = ['Idle_Loop', 'Idle'];
  if (!u.alive) {
    key = 'death';
    names = ['Death01', 'Death_A', 'Death', 'Die'];
  } else if (u.stun > 0 || u.mobility?.type === 'grip') {
    key = 'cc';
    names = ['Hit_Chest', 'Hit_A', 'Hit', 'Idle'];
  } else if (!u.grounded && !u.mobility) {
    key = 'air';
    names = ['Jump_Loop', 'Jump_Idle', 'Jump'];
  } else if (u.fear > 0) {
    key = 'run';
    names = ['Jog_Fwd_Loop', 'Running_A', 'Run', 'Walking_A', 'Walk'];
  } else if (u.action > 0 && u.actionType === 'melee') {
    key = 'attack';
    names = ['Sword_Attack', '1H_Melee_Attack_Chop', 'Unarmed_Melee_Attack_Punch_A', 'Attack'];
  } else if (u.cast || (u.action > 0 && u.actionType === 'cast')) {
    key = 'cast';
    names = ['Spell_Simple_Shoot', 'Spellcast_Long', 'Spellcast', 'Cast', 'Interact', 'Spell'];
  } else if (moving && rec.back) {
    key = 'back';
    names = ['Walk_Loop', 'Jog_Fwd_Loop'];
  } else if (moving) {
    key = 'run';
    names = ['Jog_Fwd_Loop', 'Running_A', 'Run', 'Walking_A', 'Walk'];
  }
  // réception de saut : brève animation d'atterrissage si on ne repart pas en courant
  if (key === 'idle' && rec.animKey === 'air' && hfFindClip(rec, ['Jump_Land'])?.name === 'Jump_Land') {
    key = 'land';
    names = ['Jump_Land'];
    rec.landUntil = t + 0.45;
  }
  if (key === 'idle' && rec.animKey === 'land' && t < rec.landUntil) return;
  if (rec.animKey === key) return;
  const clip = hfFindClip(rec, names);
  if (!clip) return;
  const next = rec.mixer.clipAction(clip);
  next.reset();
  if (key === 'death' || key === 'land') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.fadeIn(key === 'air' ? 0.08 : 0.1).play();
  next.timeScale = key === 'run' ? 1.12 : key === 'attack' ? 1.08 : key === 'land' ? 1.6 : 1;
  if (rec.action && rec.action !== next) rec.action.fadeOut(0.1);
  rec.action = next;
  rec.animKey = key;
  rec.footPhase = null;
}
function hfCreateRecord(u) {
  if (!HF.enabled || HF.records.has(u.id)) return;
  const group = new THREE.Group();
  group.userData.unitId = u.id;
  HF.scene.add(group);
  const rec = {
    unitId: u.id,
    group,
    loaded: false,
    failed: false,
    hdRace: false,
    mixer: null,
    clips: [],
    action: null,
    animKey: '',
    decor: null,
    aura: null,
    vx: u.x,
    vz: u.z,
    vyaw: u.yaw,
    footPhase: null,
    footSide: 0
  };
  HF.records.set(u.id, rec);
  const candidates = hfAssetCandidatesFor(u);
  const tryCandidate = index => {
    const url = candidates[index];
    HF.loader.load(
      url,
      gltf => {
        if (!HF.records.has(u.id)) return;
        try {
          const model = gltf.scene;
          model.userData.hdRaceVisual = false;
          rec.hdRace = false;
          hfNormalizeModel(model, u);
          rec.model = model;
          rec.group.add(model);
          rec.clips = gltf.animations || [];
          if (rec.clips.length) rec.mixer = new THREE.AnimationMixer(model);
          hfRaceDecor(rec, u, model);
          rec.loaded = true;
          rec.failed = false;
        } catch (e) {
          console.warn('Modèle chargé mais invalide:', url, e);
          if (index + 1 < candidates.length) tryCandidate(index + 1);
          else rec.failed = true;
        }
      },
      undefined,
      err => {
        console.warn('Modèle 3D non chargé:', url, err);
        HF.loadErrors.add(url);
        if (index + 1 < candidates.length) tryCandidate(index + 1);
        else rec.failed = true;
      }
    );
  };
  const kit = hfKitFor(u);
  if (kit)
    hfLoadKit(
      kit,
      HF.loader,
      (model, clips) => {
        if (!HF.records.has(u.id)) return;
        rec.model = model;
        rec.kit = true;
        rec.group.add(model);
        rec.clips = clips;
        rec.mixer = new THREE.AnimationMixer(model);
        rec.decor = new THREE.Group();
        rec.group.add(rec.decor);
        hfAddAura(rec, u, rec.decor);
        rec.loaded = true;
        rec.failed = false;
      },
      () => tryCandidate(0)
    );
  else tryCandidate(0);
}
function hfSyncUnits() {
  if (!HF.enabled || !state?.units) return;
  const ids = new Set(state.units.map(u => u.id));
  for (const [id, rec] of HF.records)
    if (!ids.has(id)) {
      HF.scene.remove(rec.group);
      HF.records.delete(id);
    }
  for (const u of state.units) if (!HF.records.has(u.id)) hfCreateRecord(u);
}
function hfHasModel(u) {
  const r = HF.records.get(u.id);
  return !!(r && r.loaded && !r.failed);
}
function hfRender() {
  if (!HF.enabled || !state) return;
  hfSyncUnits();
  const r = canvas.getBoundingClientRect(),
    w = Math.max(1, Math.floor(r.width)),
    h = Math.max(1, Math.floor(r.height));
  HF.renderer.setSize(w, h, false);
  HF.camera.aspect = w / h;
  HF.camera.updateProjectionMatrix();
  const p = state.player || { x: 0, y: 0, z: 0 };
  HF.camera.position.set(camPos[0], camPos[1], camPos[2]);
  HF.camera.lookAt(p.rx ?? p.x, (p.ry ?? p.y ?? 0) + 1.25, p.rz ?? p.z);
  const t = now(),
    dt = Math.min(0.05, t - HF.last);
  HF.last = t;
  for (const u of state.units) {
    const rec = HF.records.get(u.id);
    if (!rec?.loaded) continue;
    const sc = hfRaceScale(u.race, rec.kit);
    let rx, rz, ryaw;
    const snapped = !!u.visualSnap;
    if (u.visualSnap) {
      rx = u.x;
      rz = u.z;
      ryaw = u.yaw;
      u.prevX = u.x;
      u.prevZ = u.z;
      u.prevYaw = u.yaw;
      u.visualSnap = false;
    } else {
      const a = renderAlpha;
      rx = lerp(u.prevX ?? u.x, u.x, a);
      rz = lerp(u.prevZ ?? u.z, u.z, a);
      const py = u.prevYaw ?? u.yaw,
        da = ((u.yaw - py + Math.PI) % (Math.PI * 2)) - Math.PI;
      ryaw = py + da * a;
    }
    {
      let off = 0,
        back = false;
      if (
        u.alive &&
        u.moving &&
        !(u.poly > 0) &&
        !u.mobility &&
        (rec.animKey === 'run' || rec.animKey === 'back' || rec.animKey === 'air')
      ) {
        const mdx = u.x - (u.prevX ?? u.x),
          mdz = u.z - (u.prevZ ?? u.z);
        if (mdx * mdx + mdz * mdz > 1e-9) {
          let rel = Math.atan2(mdx, mdz) - u.yaw;
          rel = Math.atan2(Math.sin(rel), Math.cos(rel));
          if (Math.abs(rel) > 1.75) {
            back = true;
            rel = Math.atan2(Math.sin(rel - Math.PI), Math.cos(rel - Math.PI));
          }
          off = clamp(rel, -1.57, 1.57);
        }
      }
      rec.moveOff = (rec.moveOff || 0) + (off - (rec.moveOff || 0)) * Math.min(1, dt * 12);
      rec.back = back;
      ryaw += rec.moveOff;
    }
    // orientation affichée lissée (vitesse de rotation max) : plus de demi-tour instantané quand l'unité se tourne pour frapper
    if (rec.dispYaw == null || snapped) rec.dispYaw = ryaw;
    else {
      const dy = Math.atan2(Math.sin(ryaw - rec.dispYaw), Math.cos(ryaw - rec.dispYaw)),
        mx = 18 * dt;
      rec.dispYaw += clamp(dy, -mx, mx);
    }
    ryaw = rec.dispYaw;
    rec.vx = rx;
    rec.vz = rz;
    rec.vyaw = ryaw;
    rec.group.position.set(rx, (u.y || 0) + (rec.hdRace && !u.alive ? 0.05 : 0), rz);
    const deathTilt = rec.hdRace && !u.alive ? 1.18 : 0,
      castLean = rec.hdRace && u.alive && (u.cast || u.actionType === 'cast') ? Math.sin(now() * 8) * 0.025 : 0;
    rec.group.rotation.set(castLean, ryaw, deathTilt);
    rec.group.scale.set(sc[0], sc[1], sc[2]);
    if (rec.aura) {
      rec.aura.material.opacity = u === state.player?.target ? 0.95 : 0.38;
      rec.aura.scale.setScalar(u === state.player?.target ? 1.35 : 1);
    }
    hfSetAnim(rec, u);
    if (rec.action && rec.animKey === 'run')
      rec.action.timeScale = clamp(moveSpeed(u) / CLASS[u.cls].speed, 0.45, 1.18);
    if (rec.action && rec.animKey === 'back') rec.action.timeScale = -1.25;
    if (rec.mixer) rec.mixer.update(dt);
    if (
      rec.action &&
      (rec.animKey === 'run' || rec.animKey === 'back') &&
      u.alive &&
      u.grounded &&
      u.moving &&
      !u.mobility
    ) {
      const clip = rec.action.getClip?.(),
        dur = clip?.duration || 0;
      if (dur > 0.05) {
        const phase = (((rec.action.time % dur) + dur) % dur) / dur,
          prev = rec.footPhase;
        if (prev != null) {
          const crossed = m => (phase >= prev ? prev < m && phase >= m : prev < m || phase >= m);
          if (crossed(0.16)) {
            footstepSfx(u, rec.footSide++ & 1);
          }
          if (crossed(0.66)) {
            footstepSfx(u, rec.footSide++ & 1);
          }
        }
        rec.footPhase = phase;
      }
    } else rec.footPhase = null;
    hfUpdateRootFx(rec, u, t);
    const poly = u.poly > 0 && u.alive;
    if (poly && !rec.sheep) {
      rec.sheep = hfMakeSheep();
      rec.group.add(rec.sheep);
    }
    const sheepOn = poly && u.polyKind !== 'sap';
    if (rec.sheep) {
      rec.sheep.visible = sheepOn;
      if (sheepOn) hfAnimateSheep(rec.sheep, u, t);
    }
    const form = u.alive && !sheepOn ? u.form : null;
    if (form && !rec.beasts?.[form]) {
      rec.beasts = rec.beasts || {};
      rec.beasts[form] = hfMakeBeast(form);
      rec.group.add(rec.beasts[form]);
    }
    for (const k in rec.beasts || {}) {
      const b = rec.beasts[k];
      b.visible = k === form;
      if (b.visible) hfAnimateBeast(b, u, t);
    }
    if (rec.model) rec.model.visible = !sheepOn && !form;
    const op = u.stealth && u.alive ? (u.team === state.player.team ? 0.35 : 0.07) : 1;
    if (rec.opacity !== op) {
      rec.opacity = op;
      hfSetOpacity(rec.group, op);
    }
    if (!rec.clips.length && rec.model) {
      rec.model.position.y = u.moving && u.grounded ? Math.abs(Math.sin(u.movePhase * 2)) * 0.035 : 0;
    }
  }
  hfMakePortraits();
  if (window.SpellFX?.ok) SpellFX.update(dt, state.units, hfHandPos);
  HF.renderer.render(HF.scene, HF.camera);
}
// Mouton de la Métamorphose : laine en boules, tête et pattes sombres ; les pattes s'animent quand il marche.
// Bêtes du druide : félin (panthère sombre) et ours, avec pattes animées et yeux lumineux.
function hfMakeBeast(kind) {
  const cat = kind === 'cat',
    g = new THREE.Group();
  // fourrure : bruit fin + marques druidiques lumineuses (vert pour le félin, ambre pour l'ours)
  const fc = document.createElement('canvas');
  fc.width = fc.height = 128;
  const fg = fc.getContext('2d');
  fg.fillStyle = '#808080';
  fg.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = (90 + Math.random() * 90) | 0;
    fg.strokeStyle = `rgb(${v},${v},${v})`;
    const x = Math.random() * 128,
      y = Math.random() * 128;
    fg.beginPath();
    fg.moveTo(x, y);
    fg.lineTo(x + (Math.random() - 0.5) * 2, y + 3 + Math.random() * 4);
    fg.stroke();
  }
  const ec = document.createElement('canvas');
  ec.width = ec.height = 128;
  const eg = ec.getContext('2d');
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, 128, 128);
  eg.strokeStyle = '#fff';
  eg.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    eg.beginPath();
    const x = 12 + k * 25;
    eg.moveTo(x, 20);
    eg.quadraticCurveTo(x + 10, 64, x - 4, 108);
    eg.stroke();
  }
  const furTex = new THREE.CanvasTexture(fc);
  furTex.wrapS = furTex.wrapT = THREE.RepeatWrapping;
  furTex.repeat.set(3, 3);
  const glowTex = new THREE.CanvasTexture(ec);
  const lin = c => new THREE.Color(c).convertSRGBToLinear(),
    glowC = cat ? new THREE.Color(0.35, 1, 0.45) : new THREE.Color(1, 0.62, 0.2);
  const fur = new THREE.MeshStandardMaterial({
      color: lin(cat ? 0x2b2433 : 0x5a3a22),
      map: furTex,
      roughness: 0.92,
      emissiveMap: glowTex,
      emissive: glowC,
      emissiveIntensity: 1.2
    }),
    dark = new THREE.MeshStandardMaterial({ color: lin(cat ? 0x120e16 : 0x26170c), roughness: 0.9 });
  const eyeM = new THREE.MeshBasicMaterial({ color: cat ? 0x9dff6a : 0xffb23a });
  const H = cat ? 0.5 : 0.72;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 22, 14), fur);
  body.scale.set(cat ? 0.5 : 1.15, cat ? 0.52 : 1.0, cat ? 1.5 : 1.5);
  body.position.y = H + (cat ? 0.12 : 0.3);
  g.add(body);
  if (!cat) {
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), fur);
    hump.position.set(0, H + 0.72, 0.25);
    hump.scale.set(1.15, 0.7, 1);
    g.add(hump);
  } else {
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), fur);
    chest.position.set(0, H + 0.2, 0.48);
    chest.scale.set(1, 1.1, 1.1);
    g.add(chest);
  }
  const head = new THREE.Group();
  head.position.set(0, H + (cat ? 0.36 : 0.55), cat ? 0.82 : 1.0);
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(cat ? 0.24 : 0.36, 16, 12), fur);
  skull.scale.set(1, 0.9, cat ? 1.1 : 1.15);
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(cat ? 0.13 : 0.2, 12, 8), dark);
  muzzle.position.set(0, -0.06, cat ? 0.22 : 0.32);
  muzzle.scale.set(1, 0.75, 1);
  head.add(muzzle);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(cat ? new THREE.ConeGeometry(0.08, 0.2, 6) : new THREE.SphereGeometry(0.1, 8, 6), fur);
    ear.position.set(s * (cat ? 0.14 : 0.24), cat ? 0.22 : 0.27, -0.02);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(cat ? 0.035 : 0.045, 8, 6), eyeM);
    eye.position.set(s * (cat ? 0.09 : 0.14), 0.06, cat ? 0.2 : 0.3);
    head.add(eye);
  }
  if (cat) {
    const tail = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, H + 0.25, -0.72),
          new THREE.Vector3(0, H + 0.15, -1.1),
          new THREE.Vector3(0, H + 0.35, -1.45)
        ]),
        16,
        0.045,
        6
      ),
      fur
    );
    g.add(tail);
  }
  g.userData.legs = [];
  for (const [x, z] of [
    [0.22, 0.5],
    [-0.22, 0.5],
    [0.22, -0.5],
    [-0.22, -0.5]
  ]) {
    const pv = new THREE.Group();
    pv.position.set(x * (cat ? 0.75 : 1.5), H + (cat ? 0.05 : 0.1), z * (cat ? 1.1 : 1.25));
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(cat ? 0.075 : 0.2, cat ? 0.06 : 0.17, H, 8), fur);
    leg.position.y = -H / 2;
    pv.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(cat ? 0.09 : 0.17, 8, 6), dark);
    paw.scale.set(1, 0.55, 1.3);
    paw.position.set(0, -H, 0.05);
    pv.add(paw);
    g.add(pv);
    g.userData.legs.push(pv);
  }
  g.userData.head = head;
  g.userData.body = body;
  g.userData.kind = kind;
  g.scale.setScalar(cat ? 1.35 : 1.25);
  g.traverse(o => {
    if (o.isMesh) o.castShadow = false;
  });
  return g;
}
function hfAnimateBeast(g, u, t) {
  const run = u.moving ? Math.sin(u.movePhase * 1.4) : 0,
    atk = u.action > 0 && u.actionType === 'melee' ? Math.sin((1 - u.action / 0.36) * Math.PI) : 0;
  g.userData.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? run : -run) * 0.7 - (i < 2 ? atk * 0.9 : 0)));
  g.position.y = u.moving ? Math.abs(run) * 0.05 : 0;
  g.userData.head.position.z = (g.userData.kind === 'cat' ? 0.82 : 0.95) + atk * 0.25;
  g.rotation.x = -atk * 0.15;
  g.userData.body.scale.y = (g.userData.kind === 'cat' ? 0.52 : 1.0) * (1 + Math.sin(t * 2) * 0.02);
}
function hfSetOpacity(root, op) {
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.baseOp === undefined) {
        m.userData.baseOp = m.opacity;
        m.userData.baseTr = m.transparent;
      }
      m.opacity = m.userData.baseOp * op;
      m.transparent = op < 1 || m.userData.baseTr;
      m.depthWrite = op >= 1;
      m.needsUpdate = true;
    }
  });
}
function hfMakeSheep() {
  const g = new THREE.Group(),
    wool = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 1 }),
    dark = new THREE.MeshStandardMaterial({ color: 0x2f2a30, roughness: 0.8 });
  for (const [x, y, z, r] of [
    [0, 0.62, 0, 0.3],
    [0, 0.66, 0.22, 0.24],
    [0, 0.66, -0.22, 0.25],
    [0.15, 0.6, 0.05, 0.2],
    [-0.15, 0.6, 0.05, 0.2],
    [0.12, 0.7, -0.15, 0.18],
    [-0.12, 0.7, -0.15, 0.18],
    [0, 0.8, 0, 0.2]
  ]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), wool);
    b.position.set(x, y, z);
    g.add(b);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.42);
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), dark);
  skull.scale.set(0.9, 1, 1.25);
  head.add(skull);
  const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), wool);
  tuft.position.set(0, 0.1, -0.02);
  head.add(tuft);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), dark);
    ear.scale.set(1.6, 0.5, 0.8);
    ear.position.set(s * 0.13, 0.04, -0.03);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(s * 0.06, 0.04, 0.12);
    head.add(eye);
  }
  g.userData.legs = [];
  for (const [x, z] of [
    [0.12, 0.2],
    [-0.12, 0.2],
    [0.12, -0.2],
    [-0.12, -0.2]
  ]) {
    const pv = new THREE.Group();
    pv.position.set(x, 0.45, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.45, 8), dark);
    leg.position.y = -0.225;
    pv.add(leg);
    g.add(pv);
    g.userData.legs.push(pv);
  }
  g.userData.head = head;
  g.scale.setScalar(1.4);
  return g;
}
function hfAnimateSheep(g, u, t) {
  const w = u.moving ? Math.sin(u.movePhase * 1.6) : 0;
  g.userData.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? w : -w) * 0.55));
  g.position.y = u.moving ? Math.abs(w) * 0.03 : 0;
  g.userData.head.rotation.x = u.moving ? 0 : Math.sin(t * 1.3) * 0.25 + 0.25;
}
// Position de la main droite (lueur d'incantation)
function hfHandPos(u) {
  const rec = HF.records.get(u.id);
  if (!rec?.model) return null;
  u.castColor = u.castColor || CLASS[u.cls].accent;
  if (rec.handBone === undefined) rec.handBone = rec.model.getObjectByName('hand_r') || null;
  if (rec.handBone) return rec.handBone.getWorldPosition(new THREE.Vector3());
  return new THREE.Vector3(rec.group.position.x, rec.group.position.y + 1.4, rec.group.position.z);
}
// ---------- Portraits 3D de la sélection (race / classe) ----------
// Chaque bouton montre le vrai personnage (buste, pose de repos), rendu une fois hors écran puis mis en cache.
// La race montre un archétype marquant ; les classes montrent la race choisie dans chaque classe.
const PICK_ART = { cache: new Map(), queue: [], busy: false, rt: null, scene: null, cam: null };
const RACE_SHOWCASE = { human: 'arcanist', dwarf: 'reaver', elf: 'oracle', orc: 'reaver', undead: 'oracle' };
function pickArt(race, cls, cb) {
  const key = race + '_' + cls;
  if (PICK_ART.cache.has(key)) return cb(PICK_ART.cache.get(key));
  PICK_ART.queue.push({ key, cb });
  pickArtNext();
}
async function pickArtNext() {
  if (PICK_ART.busy || !PICK_ART.queue.length || !window.CharacterKit || !PREVIEW.renderer) return;
  PICK_ART.busy = true;
  const job = PICK_ART.queue.shift();
  try {
    if (PICK_ART.cache.has(job.key)) {
      job.cb(PICK_ART.cache.get(job.key));
      return;
    }
    const R = PREVIEW.renderer,
      S = 192;
    if (!PICK_ART.rt) {
      PICK_ART.rt = new THREE.WebGLRenderTarget(S, S);
      PICK_ART.rt.texture.encoding = THREE.sRGBEncoding;
      const sc = (PICK_ART.scene = new THREE.Scene());
      sc.add(new THREE.HemisphereLight(0xdfe6ff, 0x302040, 1.1));
      const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
      key.position.set(1.5, 2.5, 3);
      sc.add(key);
      const rim = new THREE.DirectionalLight(0x8f7dff, 2.4);
      rim.position.set(-2.5, 1.5, -2.5);
      sc.add(rim);
      PICK_ART.cam = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
    }
    const k = await CharacterKit.build(THREE, job.key, { loader: PREVIEW.loader || new THREE.GLTFLoader() });
    const root = k.root;
    root.scale.setScalar(1.8 / k.height);
    root.rotation.y = 0.35;
    const mixer = new THREE.AnimationMixer(root),
      clip = k.clips.find(c => c.name === 'Idle_Loop');
    if (clip) {
      mixer.clipAction(clip).play();
      mixer.update(clip.duration * 0.3);
    }
    PICK_ART.scene.add(root);
    root.updateMatrixWorld(true);
    const head = root.getObjectByName('Head'),
      hp = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.6, 0);
    const cam = PICK_ART.cam;
    cam.position.set(hp.x + 0.4, hp.y + 0.05, hp.z + 1.85);
    cam.lookAt(hp.x, hp.y - 0.13, hp.z);
    const cc = new THREE.Color();
    R.getClearColor(cc);
    const ca = R.getClearAlpha();
    R.setRenderTarget(PICK_ART.rt);
    R.setClearColor(0, 0);
    R.clear();
    R.render(PICK_ART.scene, cam);
    const px = new Uint8Array(S * S * 4);
    R.readRenderTargetPixels(PICK_ART.rt, 0, 0, S, S, px);
    R.setRenderTarget(null);
    R.setClearColor(cc, ca);
    PICK_ART.scene.remove(root);
    root.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
      }
    });
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d'),
      id = g.createImageData(S, S);
    for (let y = 0; y < S; y++) id.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    g.putImageData(id, 0, 0);
    const url = c.toDataURL();
    PICK_ART.cache.set(job.key, url);
    job.cb(url);
  } catch (e) {
    console.warn('Portrait de sélection indisponible', job.key, e);
  } finally {
    PICK_ART.busy = false;
    setTimeout(pickArtNext, 0);
  }
}
// Place l'image dans un bouton (le pictogramme reste tant que le portrait n'est pas prêt).
function setPickArt(btn, url) {
  if (!btn) return;
  let img = btn.querySelector('img.pickArt');
  if (!img) {
    img = document.createElement('img');
    img.className = 'pickArt';
    img.alt = '';
    const svg = btn.querySelector('svg');
    if (svg) svg.replaceWith(img);
    else btn.prepend(img);
  }
  img.src = url;
}
function refreshPickArt(race) {
  if (!PREVIEW.renderer && !previewEnsure()) return;
  PICK_ART.race = race || 'human';
  document
    .querySelectorAll('#raceChoices button[data-r]')
    .forEach(b => pickArt(b.dataset.r, RACE_SHOWCASE[b.dataset.r] || 'sentinel', u => setPickArt(b, u)));
  const r = race || 'human';
  PICK_ART.queue = PICK_ART.queue.filter(
    j => !/_/.test(j.key) || Object.keys(RACE_SHOWCASE).some(k => j.key === k + '_' + RACE_SHOWCASE[k])
  );
  document.querySelectorAll('#classChoices button[data-c]').forEach(b =>
    pickArt(r, b.dataset.c, u => {
      if (PICK_ART.race === r) setPickArt(b, u);
    })
  );
}
function hfMakePortraits() {
  const u = state.units.find(v => {
    const r = HF.records.get(v.id);
    return r?.loaded && r.model && !r.portrait && v.alive && !(v.poly > 0);
  });
  if (!u) return;
  const rec = HF.records.get(u.id),
    R = HF.renderer,
    S = 128;
  if (!HF.prt) {
    HF.prt = new THREE.WebGLRenderTarget(S, S);
    HF.prt.texture.encoding = THREE.sRGBEncoding;
    HF.pcam = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  }
  rec.group.updateMatrixWorld(true);
  const head = rec.model.getObjectByName('Head'),
    hp = new THREE.Vector3();
  if (head) head.getWorldPosition(hp);
  else {
    const b = new THREE.Box3().setFromObject(rec.model);
    hp.set((b.min.x + b.max.x) / 2, b.max.y - 0.3, (b.min.z + b.max.z) / 2);
  }
  hp.y += 0.07 * rec.group.scale.y;
  const yaw = rec.group.rotation.y,
    cam = HF.pcam;
  cam.position.set(hp.x + Math.sin(yaw + 0.35) * 0.82, hp.y + 0.06, hp.z + Math.cos(yaw + 0.35) * 0.82);
  cam.lookAt(hp.x, hp.y - 0.02, hp.z);
  const hidden = [];
  for (const o of HF.scene.children)
    if (o !== rec.group && !o.isLight && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  const cc = new THREE.Color();
  R.getClearColor(cc);
  const ca = R.getClearAlpha();
  R.setRenderTarget(HF.prt);
  R.setClearColor(0x000000, 0);
  R.clear();
  R.render(HF.scene, cam);
  const px = new Uint8Array(S * S * 4);
  R.readRenderTargetPixels(HF.prt, 0, 0, S, S, px);
  R.setRenderTarget(null);
  R.setClearColor(cc, ca);
  for (const o of hidden) o.visible = true;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'),
    id = g.createImageData(S, S);
  for (let y = 0; y < S; y++) id.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  g.putImageData(id, 0, 0);
  rec.portrait = c.toDataURL();
}
// Racines (druide) ou glace (Frost Nova) qui enserrent les jambes d'une unité immobilisée.
function hfMakeRootFx(kind) {
  const g = new THREE.Group();
  if (kind === 'ice') {
    const m = new THREE.MeshStandardMaterial({
      color: 0xbfeaff,
      emissive: 0x3aa8ff,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.75,
      flatShading: true
    });
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2,
        c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + Math.random() * 0.1, 0), m);
      c.scale.set(0.6, 1.8 + Math.random(), 0.6);
      c.position.set(Math.sin(a) * 0.32, 0.25, Math.cos(a) * 0.32);
      c.rotation.set((Math.random() - 0.5) * 0.6, a, (Math.random() - 0.5) * 0.6);
      g.add(c);
    }
  } else {
    const bark = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 }),
      leaf = new THREE.MeshStandardMaterial({
        color: 0x5fae3a,
        emissive: 0x1d5a10,
        emissiveIntensity: 0.6,
        roughness: 0.7
      });
    for (let k = 0; k < 6; k++) {
      const pts = [],
        a0 = (k / 6) * Math.PI * 2,
        r0 = 0.55;
      for (let j = 0; j <= 14; j++) {
        const t = j / 14,
          a = a0 + t * Math.PI * 2.2,
          r = r0 - t * 0.3;
        pts.push(new THREE.Vector3(Math.sin(a) * r, t * 1.15, Math.cos(a) * r));
      }
      g.add(
        new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045 - k * 0.003, 6, false), bark)
      );
      for (let j = 3; j < 14; j += 3) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), leaf);
        l.scale.set(1.4, 0.4, 0.8);
        l.position.copy(pts[j]);
        g.add(l);
      }
    }
  }
  g.userData.kind = kind;
  return g;
}
function hfUpdateRootFx(rec, u, t) {
  const want = u.alive && u.root > 0 && u.rootKind ? u.rootKind : null;
  if (rec.rootFx && rec.rootFx.userData.kind !== want) {
    rec.group.remove(rec.rootFx);
    rec.rootFx = null;
  }
  if (want && !rec.rootFx) {
    rec.rootFx = hfMakeRootFx(want);
    rec.group.add(rec.rootFx);
    rec.rootT = t;
  }
  if (rec.rootFx) {
    const k = Math.min(1, (t - rec.rootT) / 0.35),
      out = Math.min(1, u.root / 0.3);
    rec.rootFx.scale.set(1 / rec.group.scale.x, (k * out) / rec.group.scale.y, 1 / rec.group.scale.z);
    rec.rootFx.rotation.y = -rec.group.rotation.y;
  }
}
function hfEnsureInit() {
  if (HF.attempted) return HF.enabled;
  HF.attempted = true;
  HF.last = performance.now() / 1000;
  const ok = hfInit();
  if (!ok) characterCanvas.style.display = 'none';
  return ok;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  now = () => performance.now() / 1000,
  lerp = (a, b, t) => a + (b - a) * t;
PREFS = loadPrefs();
const css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
