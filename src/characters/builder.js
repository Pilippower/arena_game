(function (root, factory) {
  const api = factory(root);
  if (root) root.CharacterKit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // Pièces (chargées avant) : rig.js, glow.js, weapons.js, cloth.js, armor.js, head.js.
  const {
    clamp,
    recolorTexture,
    keepOnlyBones,
    bindToSkeleton,
    buildRobe,
    glowEyes,
    buildStaff,
    buildWeapon,
    headFeatures,
    buildOrbs,
    collectPoints,
    buildCape,
    buildTabard,
    buildHandFx,
    buildSkulls,
    headLandmarks,
    skullFace,
    dwarfBeard,
    buildArmor
  } = root.CharacterParts;
  // ASSEMBLAGE 3D des personnages (three.js). Les données (classes, races, kits) sont dans src/characters/kits.js.
  const D = root.CharacterKits;
  const { ANIMS, CLASSES, RACES, KITS, resolveKit, buildManifest, assetName, kitFor } = D;

  // ---- Rendu « illustration » : liseré de lumière, couleurs saturées, contour sombre ----
  // Chaque matériau du personnage reçoit un éclairage de bord (fresnel) teinté et un léger gain de saturation/contraste ;
  // un contour (coque inversée) dessine la silhouette comme un trait d'encre.
  function stylizeMaterial(THREE, m, rim) {
    if (!m || m.userData.stylized || !m.isMeshStandardMaterial) return;
    m.userData.stylized = true;
    const prev = m.onBeforeCompile,
      u = { rimColor: { value: new THREE.Color(...rim) }, rimStr: { value: 1.7 } };
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;uniform float rimStr;')
        .replace(
          '#include <output_fragment>',
          `{float fr=pow(1.-clamp(dot(normalize(normal),normalize(vViewPosition)),0.,1.),2.2);
          outgoingLight+=rimColor*fr*rimStr;
          float l=dot(outgoingLight,vec3(.299,.587,.114));outgoingLight=mix(vec3(l),outgoingLight,1.4);
          outgoingLight=(outgoingLight-.5*l)*1.06+.5*l*.94;}
          #include <output_fragment>`
        );
    };
    m.needsUpdate = true;
  }
  const OUTLINE_MAT = new Map();
  function outlineMaterial(THREE, skinned, thick) {
    const k = skinned + ':' + thick;
    if (OUTLINE_MAT.has(k)) return OUTLINE_MAT.get(k);
    const m = new THREE.MeshBasicMaterial({ color: 0x0b0710, side: THREE.BackSide, skinning: skinned });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed+=normalize(normal)*' + thick.toFixed(4) + ';'
      );
    };
    OUTLINE_MAT.set(k, m);
    return m;
  }
  function stylize(THREE, root, rim, { outline = globalThis.CHAR_OUTLINE ?? true } = {}) {
    const list = [];
    root.traverse(o => {
      if (o.isMesh && !o.isSprite && o.material && !o.userData.isOutline) list.push(o);
    });
    for (const o of list) {
      for (const m of [].concat(o.material)) stylizeMaterial(THREE, m, rim);
      if (!outline || o.material.transparent || /^(Eyes|Eyebrows|Mask)$/.test(o.name) || !o.geometry.attributes.normal)
        continue;
      const thick = /Hair|Beard/i.test(o.name) ? 0.007 : 0.014;
      if (o.isSkinnedMesh) {
        const ol = new THREE.SkinnedMesh(o.geometry, outlineMaterial(THREE, true, thick));
        ol.userData.isOutline = true;
        ol.frustumCulled = false;
        ol.renderOrder = -1;
        o.parent.add(ol);
        ol.position.copy(o.position);
        ol.quaternion.copy(o.quaternion);
        ol.scale.copy(o.scale);
        ol.bind(o.skeleton, o.bindMatrix);
      } else {
        const ol = new THREE.Mesh(o.geometry, outlineMaterial(THREE, false, thick * 0.8));
        ol.userData.isOutline = true;
        ol.frustumCulled = false;
        o.parent.add(ol);
        ol.position.copy(o.position);
        ol.quaternion.copy(o.quaternion);
        ol.scale.copy(o.scale);
      }
    }
  }

  // Couleur moyenne d'une texture (pour teinter les pièces procédurales comme la peau).
  function averageColor(THREE, tex) {
    const c = new THREE.Color(0.8, 0.6, 0.5);
    if (!tex || !tex.image) return c;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 8;
    const g = cv.getContext('2d');
    g.drawImage(tex.image, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    let r = 0,
      gg = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 765;
      if (l < 0.15) continue;
      r += d[i];
      gg += d[i + 1];
      b += d[i + 2];
      n++;
    }
    if (n) c.setRGB(r / n / 255, gg / n / 255, b / n / 255).convertSRGBToLinear();
    return c;
  }

  // Les modèles sont emballés en .js (tools/build_characters.js) : window.CHAR_ASSETS[nom]=GLB en base64.
  // Un <script> se charge en double-clic (file://), contrairement à un fetch de .glb.
  const scriptLoads = new Map();
  function loadAssetScript(name, baseUrl) {
    const store = globalThis.CHAR_ASSETS || {};
    if (store[name]) return Promise.resolve(store[name]);
    if (!scriptLoads.has(name))
      scriptLoads.set(
        name,
        new Promise((res, rej) => {
          const sc = document.createElement('script');
          sc.src =
            baseUrl + 'assets/characters/' + name + '.js' + (globalThis.ASSET_V ? '?v=' + globalThis.ASSET_V : '');
          sc.async = true;
          sc.onload = () =>
            globalThis.CHAR_ASSETS?.[name] ? res(globalThis.CHAR_ASSETS[name]) : rej(new Error('Asset vide : ' + name));
          sc.onerror = () => {
            scriptLoads.delete(name);
            rej(new Error('Asset introuvable : ' + name));
          };
          document.head.appendChild(sc);
        })
      );
    return scriptLoads.get(name);
  }
  function b64ToBuffer(b64) {
    const bin = atob(b64),
      u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  const parsed = new Map();
  // Les GLB parsés sont mis en cache ; chaque personnage reçoit une copie indépendante (SkeletonUtils-like).
  async function loadAsset(THREE, loader, name, baseUrl) {
    if (!parsed.has(name))
      parsed.set(
        name,
        loadAssetScript(name, baseUrl).then(
          b64 => new Promise((res, rej) => loader.parse(b64ToBuffer(b64), '', res, rej))
        )
      );
    return parsed.get(name);
  }

  // Clone profond d'une scène skinnée (équivalent de SkeletonUtils.clone, absent du build global r128).
  function cloneSkinned(source) {
    const map = new Map(),
      clone = source.clone(true);
    const walk = (a, b) => {
      map.set(a, b);
      for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]);
    };
    walk(source, clone);
    clone.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const src = [...map].find(([k, v]) => v === o)[0];
      o.geometry = src.geometry.clone();
      o.bind(
        new o.skeleton.constructor(
          src.skeleton.bones.map(b => map.get(b)),
          src.skeleton.boneInverses
        ),
        src.bindMatrix
      );
    });
    return clone;
  }

  // Construit un personnage. Résout { root, height, clips }.
  async function build(
    THREE,
    kitId,
    { baseUrl = '', loader = new THREE.GLTFLoader(), withAnims = true, outline = globalThis.CHAR_OUTLINE ?? true } = {}
  ) {
    const kit = resolveKit(kitId);
    const load = f =>
      loadAsset(THREE, loader, assetName(f), baseUrl).then(g => ({
        scene: cloneSkinned(g.scene),
        animations: g.animations
      }));
    const [bodyG, outfitG, ...rest] = await Promise.all([
      load(kit.body),
      load(kit.outfit),
      ...kit.hair.map(load),
      ...(withAnims ? [load('anims')] : [])
    ]);
    const nh = kit.hair.length,
      hairGs = rest.slice(0, nh),
      animG = withAnims ? rest[nh] : null;
    const root = bodyG.scene,
      bones = {};
    root.traverse(o => {
      if (o.isBone) bones[o.name] = o;
    });
    let body = null;
    root.traverse(o => {
      if (o.isSkinnedMesh) {
        if (/^Super/i.test(o.name)) {
          keepOnlyBones(o, ['Head', 'neck_01']);
          body = o;
        }
      }
    });
    const hairColor = new THREE.Color(...kit.hairColor);
    root.traverse(o => {
      if (o.isMesh && o.name === 'Eyebrows') {
        o.material = o.material.clone();
        o.material.color = hairColor;
      }
    });
    const shared = [body.skeleton],
      attach = g => {
        const ms = [];
        g.scene.traverse(o => {
          if (o.isSkinnedMesh) ms.push(o);
        });
        ms.forEach(m => bindToSkeleton(THREE, m, bones, body.parent, shared));
      };
    if (kit.robe)
      outfitG.scene.traverse(o => {
        if (o.isSkinnedMesh && /_Legs$/.test(o.name))
          keepOnlyBones(o, ['calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r']);
      });
    attach(outfitG);
    hairGs.forEach(attach);
    const recolored = new Map(),
      skinTint = new THREE.Color(...kit.skin);
    let skinColor = null;
    root.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const m = (o.material = o.material.clone());
      if (/Hair/i.test(m.name)) m.color = hairColor;
      else if (/Superhero|Regular_(Fe)?male/i.test(m.name)) {
        m.color = skinTint.clone();
        if (/Superhero/i.test(m.name)) skinColor = averageColor(THREE, m.map).multiply(skinTint);
      } else if (/Peasant|Ranger/i.test(m.name) && m.map) {
        if (!recolored.has(m.map))
          recolored.set(
            m.map,
            recolorTexture(
              THREE,
              m.map,
              kit.palette,
              globalThis.document?.body?.classList.contains('mobile-mode') ? 512 : 1024, // mémoire limitée sur mobile
              kit.sex === 'M' && /Peasant/i.test(m.name)
            )
          );
        m.map = recolored.get(m.map);
      }
      o.frustumCulled = false;
    });
    root.updateMatrixWorld(true);
    let height = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
    // Robe, armes et détails sont construits en pose de bind, ajustés sur la tenue réelle.
    const fit = [];
    root.traverse(o => {
      if (o.isSkinnedMesh && /_(Body|Legs)$/.test(o.name)) fit.push(o);
    }); // pièces déjà déplacées sur le squelette du corps
    if (kit.robe) buildRobe(THREE, body, bones, kit.robe, fit);
    if (kit.staff) buildStaff(THREE, body, bones, { ...kit.staff, behindCape: !!kit.cape }, height, fit);
    if (kit.weapon) buildWeapon(THREE, body, bones, kit.weapon, height, fit);
    headFeatures(THREE, kit, root, body, bones, skinColor || new THREE.Color(0.6, 0.45, 0.35));
    if (kit.orbs) buildOrbs(THREE, root, bones, kit.orbs, height);
    if (kit.eyeGlow) {
      const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(),
        col = new THREE.Color(...kit.eyeGlow);
      root.traverse(o => {
        if (o.isMesh && o.name === 'Eyes') glowEyes(THREE, o, col, bones.Head, inv);
      });
    }
    const L = headLandmarks(THREE, root, body);
    if (kit.bigBeard) dwarfBeard(THREE, root, bones, L, hairColor);
    if (kit.skull) {
      skullFace(THREE, body, L);
      root.traverse(o => {
        if (o.name === 'Eyebrows') o.visible = false;
      });
    }
    const outfitMeshes = [];
    root.traverse(o => {
      if (o.isSkinnedMesh && /Ranger|Peasant/.test(o.name)) outfitMeshes.push(o);
    });
    if (kit.armor) buildArmor(THREE, root, body, bones, kit.armor, height, outfitMeshes, L);
    if (kit.cape || kit.tabard || kit.skulls) {
      const pts = collectPoints(THREE, root, body);
      if (kit.tabard) buildTabard(THREE, root, body, bones, kit.tabard, pts);
      if (kit.cape) buildCape(THREE, root, body, bones, kit.cape, pts);
      if (kit.skulls) buildSkulls(THREE, body, bones, kit.skulls, height, pts);
    }
    if (kit.handFx) buildHandFx(THREE, body, bones, kit.handFx, height);
    // Morphologie raciale : échelles uniformes d'os (les animations ne pilotent que les rotations).
    const wy = b => {
      root.updateMatrixWorld(true);
      return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).y;
    };
    const head0 = wy(bones.Head),
      foot0 = wy(bones.foot_l);
    // les objets rigides portés (armes, bouclier, effets de main, crânes) gardent leur taille quand on agrandit les os
    const rigid = [];
    root.traverse(o => {
      if (/^(Hammer|Axe|Sword|Runeblade|Dagger|Shield|HandFx|Staff|Skull)$/.test(o.name) && o.parent?.isBone)
        rigid.push(o);
    });
    root.updateMatrixWorld(true);
    const ws0 = rigid.map(o => o.getWorldScale(new THREE.Vector3()).x);
    for (const [n, k] of Object.entries(kit.bones))
      if (bones[n])
        Array.isArray(k) ? bones[n].scale.multiply(new THREE.Vector3(...k)) : bones[n].scale.multiplyScalar(k);
    root.updateMatrixWorld(true);
    const HERO_SIZE = { Hammer: 1.3, Axe: 1.3, Sword: 1.25, Runeblade: 1.2, Dagger: 1.35, Shield: 1.45 };
    rigid.forEach((o, i) => {
      const k = o.getWorldScale(new THREE.Vector3()).x / ws0[i];
      o.scale.multiplyScalar((HERO_SIZE[o.name] || 1) / k);
    });
    // Jambes raccourcies : on abaisse tout le squelette pour garder les pieds au sol.
    const drop = wy(bones.foot_l) - foot0;
    if (Math.abs(drop) > 1e-4) {
      const rig = new THREE.Group();
      rig.name = 'Rig';
      [...root.children].forEach(c => rig.add(c));
      root.add(rig);
      rig.position.y = -drop;
    }
    height += wy(bones.Head) - head0;
    // Pièces rigides (épaulières, casque, armes, feuilles…) : fusionnées par matériau dans chaque groupe, moins d'appels de dessin.
    const merge = globalThis.ArenaEnv && globalThis.ArenaEnv.mergeMeshes;
    if (merge) {
      root.updateMatrixWorld(true);
      const groups = [];
      root.traverse(o => {
        if (
          o.isGroup &&
          /^(Pauldron|Helmet|Shield|Sword|Runeblade|Dagger|Staff|Antler|Braid|Hammer|Axe|Skull)$/.test(o.name)
        )
          groups.push(o);
      });
      for (const g of groups) {
        const meshes = [];
        g.traverse(o => {
          if (o.isMesh && !o.isSkinnedMesh && !o.material.transparent) meshes.push(o);
        });
        for (const m of merge(THREE, meshes, new THREE.Matrix4().copy(g.matrixWorld).invert())) {
          m.frustumCulled = false;
          g.add(m);
        }
      }
    }
    stylize(THREE, root, kit.rim || [0.8, 0.8, 1], { outline });
    return { root, height, clips: animG ? animG.animations : [] };
  }

  return {
    KITS,
    CLASSES,
    RACES,
    ANIMS,
    build,
    kitFor,
    resolveKit,
    buildManifest,
    assetName,
    keepOnlyBones,
    recolorTexture
  };
});
