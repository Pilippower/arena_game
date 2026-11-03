'use strict';
// Prévisualisation 3D du lobby (un seul canevas) : socle, chargement du modèle choisi, modèle de secours previewFallbackModel.
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

// Dessus du socle : dalles rayonnantes, joints sombres, lumière dorée au centre.
function previewPedestalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d'),
    R = 128;
  g.fillStyle = '#5a5047';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#231d18';
  g.lineWidth = 3;
  for (const r of [R * 0.55, R * 0.8]) {
    g.beginPath();
    g.arc(R, R, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + (k % 2) * 0.1;
    g.beginPath();
    g.moveTo(R + Math.cos(a) * R * 0.8, R + Math.sin(a) * R * 0.8);
    g.lineTo(R + Math.cos(a) * R, R + Math.sin(a) * R);
    g.stroke();
  }
  const glow = g.createRadialGradient(R, R, 0, R, R, R);
  glow.addColorStop(0, '#ffe3a0f0');
  glow.addColorStop(0.45, '#e0a64ab0');
  glow.addColorStop(0.75, '#8a5a2240');
  glow.addColorStop(1, '#00000000');
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
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
    // socle de pierre du lobby (maquette de l'utilisateur) : flanc en blocs sombres, dessus éclairé d'un halo doré
    const side = new THREE.MeshStandardMaterial({ color: 0x3e3833, roughness: 0.95, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.32, 24), [
      side,
      new THREE.MeshBasicMaterial({ map: previewPedestalTexture() }),
      side
    ]);
    floor.position.y = -0.17;
    PREVIEW.scene.add(floor);
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
    load.textContent = 'Loading hero…';
  }
  if (!previewEnsure()) {
    if (load) load.textContent = '3D preview unavailable';
    return;
  }
  const requestId = ++PREVIEW.requestId;
  previewClearGroup();
  if (PREVIEW.loadTimer) clearTimeout(PREVIEW.loadTimer);
  PREVIEW.loadTimer = setTimeout(() => {
    if (requestId === PREVIEW.requestId && !PREVIEW.loaded && load) {
      load.textContent = 'Slow loading — check your connection';
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
