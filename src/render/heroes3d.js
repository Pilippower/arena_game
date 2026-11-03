'use strict';
// Personnages 3D (three.js) en arène : état HF, chargement des kits, création et synchronisation des modèles, rendu
// (hfRender), occultants et silhouettes sous le pont. Prévisualisation, animations, détails, bêtes et portraits :
// preview3d.js, hero_anim.js, hero_decor.js, beasts.js, portraits.js (chargés juste après).
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
function hfPixelRatio() {
  return (
    Math.min(document.body.classList.contains('mobile-mode') ? 1.5 : 2.0, window.devicePixelRatio || 1) * PERF.scale
  );
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
    HF.renderer.setPixelRatio(hfPixelRatio());
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
    HF.enabled = true;
    hfRebuildOccluders();
    return true;
  } catch (e) {
    console.warn('Renderer personnages HD indisponible', e);
    HF.enabled = false;
    return false;
  }
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
function hfRender() {
  if (!HF.enabled || !state) return;
  hfSyncUnits();
  const r = canvas.getBoundingClientRect(),
    w = Math.max(1, Math.floor(r.width)),
    h = Math.max(1, Math.floor(r.height));
  if (HF.renderer.getPixelRatio() !== hfPixelRatio()) HF.renderer.setPixelRatio(hfPixelRatio());
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
    let turn = 0;
    if (rec.dispYaw == null || snapped) rec.dispYaw = ryaw;
    else {
      const dy = Math.atan2(Math.sin(ryaw - rec.dispYaw), Math.cos(ryaw - rec.dispYaw)),
        mx = 18 * dt;
      turn = clamp(dy, -mx, mx);
      rec.dispYaw += turn;
    }
    // inclinaison du corps dans les virages en courant (visuel seulement)
    const leanTo =
      u.alive && u.moving && u.grounded && !u.mobility && !(u.poly > 0) && dt > 0
        ? clamp((-turn / dt) * 0.018, -0.13, 0.13)
        : 0;
    rec.lean = (rec.lean || 0) + (leanTo - (rec.lean || 0)) * Math.min(1, dt * 10);
    ryaw = rec.dispYaw;
    rec.vx = rx;
    rec.vz = rz;
    rec.vyaw = ryaw;
    rec.group.position.set(rx, (u.y || 0) + (rec.hdRace && !u.alive ? 0.05 : 0), rz);
    const deathTilt = rec.hdRace && !u.alive ? 1.18 : 0,
      castLean = rec.hdRace && u.alive && (u.cast || u.actionType === 'cast') ? Math.sin(now() * 8) * 0.025 : 0;
    rec.group.rotation.set(castLean, ryaw, deathTilt || rec.lean);
    rec.group.scale.set(sc[0], sc[1], sc[2]);
    if (rec.aura) {
      rec.aura.material.opacity = u === state.player?.target ? 0.95 : 0.38;
      rec.aura.scale.setScalar(u === state.player?.target ? 1.35 : 1);
    }
    hfSetAnim(rec, u);
    if (rec.action && rec.animKey === 'run')
      rec.action.timeScale = clamp(moveSpeed(u) / CLASS[u.cls].speed, 0.45, 1.18);
    if (rec.action && rec.animKey === 'back') rec.action.timeScale = -1.25;
    // joie : l'arme levée « pompe » vers le ciel en rythme, avec un petit rebond (pas de pose figée)
    if (rec.action && rec.animKey === 'cheer') {
      const b = Math.sin(now() * 7 + u.id * 6);
      rec.action.timeScale = 0;
      rec.action.time = rec.action.getClip().duration * (0.13 + 0.035 * b);
      rec.group.position.y += Math.max(0, b) * 0.07;
    }
    if (rec.mixer) rec.mixer.update(dt);
    if (u.cls === 'reaver' && rec.kit && u.alive && !u.form) hfTwoHandIK(rec);
    if (u.cls === 'shade' && rec.kit && u.alive) hfBladeSlash(rec);
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
          // sens de lecture : le recul joue Walk_Loop à l'envers (la phase diminue)
          const fwd = rec.action.timeScale >= 0,
            crossed = m =>
              fwd
                ? phase >= prev
                  ? prev < m && phase >= m
                  : prev < m || phase >= m
                : phase <= prev
                  ? phase < m && prev >= m
                  : prev >= m || phase < m;
          for (const m of FOOT_CONTACTS[clip.name] || FOOT_CONTACTS.default)
            if (crossed(m)) footstepSfx(u, rec.footSide++ & 1);
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
  hfRenderGhosts();
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
// Position de la main droite (lueur d'incantation)
function hfHandPos(u) {
  const rec = HF.records.get(u.id);
  if (!rec?.model) return null;
  u.castColor = u.castColor || CLASS[u.cls].accent;
  if (rec.handBone === undefined) rec.handBone = rec.model.getObjectByName('hand_r') || null;
  if (rec.handBone) return rec.handBone.getWorldPosition(new THREE.Vector3());
  return new THREE.Vector3(rec.group.position.x, rec.group.position.y + 1.4, rec.group.position.z);
}
function hfEnsureInit() {
  if (HF.attempted) return HF.enabled;
  HF.attempted = true;
  HF.last = performance.now() / 1000;
  const ok = hfInit();
  if (!ok) characterCanvas.style.display = 'none';
  return ok;
}

// Géométrie invisible (profondeur seule) des piliers et murs de la carte courante : cache les personnages derrière.
function hfRebuildOccluders() {
  if (!HF.enabled || !HF.scene) return;
  if (HF.occluders) {
    HF.scene.remove(HF.occluders);
    HF.occluders.traverse(o => o.geometry?.dispose());
  }
  const g = (HF.occluders = new THREE.Group());
  const occMat = new THREE.MeshBasicMaterial({ color: 0, colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
  const add = (geo, x, y, z) => {
    const m = new THREE.Mesh(geo, occMat);
    m.position.set(x, y, z);
    m.renderOrder = -10;
    g.add(m);
  };
  for (const pp of arena.pillars)
    add(new THREE.CylinderGeometry(pp.r + 0.02, pp.r + 0.02, pp.h, 24), pp.x, pp.h / 2, pp.z);
  const hx = arena.halfX,
    hz = arena.halfZ;
  add(new THREE.BoxGeometry(hx * 2 + 0.6, 4.9, 0.3), 0, 2.45, -hz - 0.15);
  add(new THREE.BoxGeometry(hx * 2 + 0.6, 4.9, 0.3), 0, 2.45, hz + 0.15);
  add(new THREE.BoxGeometry(0.3, 4.9, hz * 2 + 0.6), -hx - 0.15, 2.45, 0);
  add(new THREE.BoxGeometry(0.3, 4.9, hz * 2 + 0.6), hx + 0.15, 2.45, 0);
  HF.scene.add(g);
  // tablier et rampes du pont : groupe à part, les personnages qu'ils cachent sont dessinés en silhouette (hfRenderGhosts)
  if (HF.bridgeOcc) {
    HF.scene.remove(HF.bridgeOcc);
    HF.bridgeOcc.traverse(o => o.geometry?.dispose());
    HF.bridgeOcc = null;
  }
  const B = arena.bridge;
  if (!B) return;
  const bg = (HF.bridgeOcc = new THREE.Group());
  const deck = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 4, 0.4, B.halfW * 2 + 0.2), occMat);
  deck.position.set(0, B.y - 0.25, 0);
  bg.add(deck);
  const ang = Math.atan2(B.y, B.rampLen),
    hyp = Math.hypot(B.y, B.rampLen);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(B.rampW, 0.2, hyp), occMat);
      ramp.position.set(sx * B.rampX, B.y / 2 - 0.15, sz * (B.halfW + B.rampLen / 2));
      ramp.rotation.x = sz * ang;
      bg.add(ramp);
    }
  bg.traverse(o => (o.renderOrder = -10));
  HF.scene.add(bg);
}
// Le pont (tablier ou rampe) passe-t-il entre la caméra et l'unité ? Segment échantillonné : changement de côté
// de la surface du pont entre deux points consécutifs situés au-dessus d'elle.
function hfBridgeHides(u) {
  const ux = u.rx ?? u.x,
    uy = u.ry ?? (u.y || 0),
    uz = u.rz ?? u.z;
  for (const hh of [0.3, 1.1, 1.9]) {
    let prev = null;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20,
        x = lerp(camPos[0], ux, t),
        y = lerp(camPos[1], uy + hh, t),
        z = lerp(camPos[2], uz, t),
        s = surfaceAt(x, z),
        side = s ? Math.sign(y - (s.deck ? s.h - 0.25 : s.h)) : 0;
      if (side && prev && side !== prev) return true;
      prev = side || null;
    }
  }
  return false;
}
// Personnages cachés par le pont : silhouette translucide visible à travers le tablier (pas les camouflés).
// Passe 1 : profondeur du pont seul ; passe 2 : personnages là où ils sont derrière (GreaterDepth), sans écrire la profondeur.
function hfRenderGhosts() {
  if (!HF.bridgeOcc) return;
  const R = HF.renderer,
    sc = HF.scene;
  HF.ghostMat =
    HF.ghostMat ||
    new THREE.MeshBasicMaterial({
      color: 0xa9c8ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
      skinning: true
    });
  const groups = new Set();
  for (const u of state.units) {
    const rec = HF.records.get(u.id);
    if (rec?.group && (rec.opacity ?? 1) >= 1 && hfBridgeHides(u)) groups.add(rec.group);
  }
  // personne n'est caché par le pont : pas de seconde passe (économise un rendu complet des personnages)
  if (!groups.size) return;
  const hidden = [];
  const only = keep => {
    for (const o of sc.children)
      if (o.visible && !keep(o)) {
        o.visible = false;
        hidden.push(o);
      }
  };
  const restore = () => hidden.splice(0).forEach(o => (o.visible = true));
  R.autoClear = false;
  try {
    R.clearDepth();
    only(o => o === HF.bridgeOcc);
    R.render(sc, HF.camera);
    restore();
    only(o => groups.has(o));
    sc.overrideMaterial = HF.ghostMat;
    R.render(sc, HF.camera);
  } finally {
    sc.overrideMaterial = null;
    restore();
    R.autoClear = true;
  }
}
