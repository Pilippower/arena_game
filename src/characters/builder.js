(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CharacterKit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  // ASSEMBLAGE 3D des personnages (three.js). Les données (classes, races, kits) sont dans src/characters/kits.js.
  const D = root.CharacterKits || (typeof require === 'function' ? require('./kits.js') : null);
  const { ANIMS, CLASSES, RACES, KITS, resolveKit, buildManifest, assetName, kitFor } = D;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rgbToHsl(r, g, b) {
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      l = (mx + mn) / 2;
    let h = 0,
      s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }

  // Recolore une texture de tenue : les tons cuir/bruns deviennent la palette de classe,
  // les tissus clairs désaturés et le métal sont conservés. Réduit aussi la texture à `size`.
  function recolorTexture(THREE, tex, pal, size = 1024, lightIsCloth = false) {
    const img = tex.image,
      c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const id = ctx.getImageData(0, 0, size, size),
      d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255,
        g = d[i + 1] / 255,
        b = d[i + 2] / 255,
        [h, s, l] = rgbToHsl(r, g, b);
      let t = null;
      let ref = 0.5;
      if (s < 0.32 && l > 0.5)
        t = pal.cloth; // tissu clair
      else if (lightIsCloth && s < 0.3 && l > 0.36) {
        t = pal.cloth;
        ref = 0.62;
      } // chemise homme : lin gris-beige plus sombre dans la texture
      else if (s >= 0.18 && (h < 0.16 || h > 0.92)) {
        // bruns / cuir / tan
        t = l > 0.48 ? pal.trim : l > 0.2 ? pal.mid : pal.dark;
      } else if (s >= 0.18 && h > 0.18 && h < 0.48) {
        t = pal.mid;
        ref = 0.3;
      } // verts (tenue Rôdeur), plus sombres : teinte unie, le relief vient de k
      if (!t) continue;
      const k = l / ref; // garde le relief peint (lumière/ombre)
      d[i] = clamp(t[0] * k * 255, 0, 255);
      d[i + 1] = clamp(t[1] * k * 255, 0, 255);
      d[i + 2] = clamp(t[2] * k * 255, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
    const out = new THREE.CanvasTexture(c);
    out.flipY = tex.flipY;
    out.encoding = tex.encoding;
    out.wrapS = tex.wrapS;
    out.wrapT = tex.wrapT;
    return out;
  }

  const comp = (a, v, k) => (k === 0 ? a.getX(v) : k === 1 ? a.getY(v) : k === 2 ? a.getZ(v) : a.getW(v));
  // Ne garde que les triangles dont les sommets sont dominés par l'un des os listés.
  function keepOnlyBones(mesh, names) {
    const geo = mesh.geometry,
      si = geo.attributes.skinIndex,
      sw = geo.attributes.skinWeight,
      idx = geo.index;
    const keep = new Set(names.map(n => mesh.skeleton.bones.findIndex(b => b.name === n)).filter(i => i >= 0));
    const ok = v => {
      let best = 0,
        bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = comp(sw, v, k);
        if (w > bw) {
          bw = w;
          best = comp(si, v, k);
        }
      }
      return keep.has(best);
    };
    const out = [];
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i),
        b = idx.getX(i + 1),
        c = idx.getX(i + 2);
      if (ok(a) && ok(b) && ok(c)) out.push(a, b, c);
    }
    geo.setIndex(out);
  }

  // Les tenues fusionnent plusieurs pièces, chacune avec son squelette : GLTFLoader suffixe alors les doublons (root_1, spine_01_2…).
  // Les pièces qui ont les mêmes os et les mêmes matrices de bind partagent un squelette (`shared`) :
  // three ne recalcule alors les matrices qu'une fois par image au lieu d'une fois par pièce.
  function bindToSkeleton(THREE, mesh, bones, host, shared) {
    const list = mesh.skeleton.bones.map(b => bones[b.name] || bones[b.name.replace(/_\d+$/, '')] || b),
      inv = mesh.skeleton.boneInverses;
    let sk =
      shared &&
      shared.find(
        k =>
          k.bones.length === list.length &&
          k.bones.every((b, i) => b === list[i]) &&
          k.boneInverses.every((m, i) => m.equals(inv[i]))
      );
    if (!sk) {
      sk = new THREE.Skeleton(list, inv);
      if (shared) shared.push(sk);
    }
    host.add(mesh);
    mesh.bind(sk, mesh.bindMatrix);
  }

  // Robe longue procédurale, skinnée bassin + cuisses pour suivre les jambes.
  // Profil réel du corps habillé (pose de bind) : rayon max par secteur angulaire autour du bassin, à une hauteur donnée.
  function bodyProfile(THREE, meshes, inv, center, y, band, seg) {
    const r = new Array(seg).fill(0),
      v = new THREE.Vector3();
    for (const m of meshes) {
      const pos = m.geometry.attributes.position,
        mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        if (Math.abs(v.y - y) > band) continue;
        const dx = v.x - center.x,
          dz = v.z - center.z,
          a = (Math.atan2(dx, dz) + Math.PI * 2) % (Math.PI * 2);
        const k = Math.min(seg - 1, Math.floor((a / (Math.PI * 2)) * seg));
        r[k] = Math.max(r[k], Math.hypot(dx, dz));
      }
    }
    // secteurs vides → voisins, puis lissage circulaire
    for (let pass = 0; pass < seg; pass++)
      for (let k = 0; k < seg; k++) if (!r[k]) r[k] = Math.max(r[(k + seg - 1) % seg], r[(k + 1) % seg]);
    for (let pass = 0; pass < 3; pass++) {
      const c = r.slice();
      for (let k = 0; k < seg; k++) r[k] = Math.max(c[k], (c[(k + seg - 1) % seg] + 2 * c[k] + c[(k + 1) % seg]) / 4);
    }
    return r;
  }

  function buildRobe(THREE, body, bones, cfg, fitMeshes) {
    body.updateMatrixWorld(true);
    fitMeshes.forEach(m => m.updateMatrixWorld(true));
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const P = n => new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(inv);
    const pelvis = P('pelvis'),
      tl = P('thigh_l'),
      tr = P('thigh_r'),
      cl = P('calf_l'),
      fl = P('foot_l');
    const sk = body.skeleton.bones,
      bi = n => sk.findIndex(b => b.name === n);
    const iP = bi('pelvis'),
      iL = bi('thigh_l'),
      iR = bi('thigh_r'),
      iCL = bi('calf_l'),
      iCR = bi('calf_r');
    const hipHalf = Math.abs(tl.x - tr.x) / 2,
      top = pelvis.y + 0.15,
      bottom = fl.y + (cl.y - fl.y) * (1 - cfg.length) + 0.03;
    const lSign = Math.sign(tl.x - tr.x) || 1,
      SEG = 40,
      RINGS = 16;
    const pos = [],
      uv = [],
      si = [],
      sw = [],
      idx = [];
    // La robe épouse le corps habillé en haut (taille/bassin) puis s'évase ; un rayon ne diminue jamais en descendant.
    let prev = null;
    for (let j = 0; j <= RINGS; j++) {
      const t = j / RINGS,
        y = top + (bottom - top) * t,
        prof = bodyProfile(THREE, fitMeshes, inv, pelvis, y, 0.025, SEG);
      const flare = (cfg.flare - 1) * hipHalf * 1.3 * Math.pow(t, 1.5);
      const ring = prof.map((r, k) => Math.max(r + 0.012 + 0.025 * t, prev ? prev[k] : 0));
      prev = ring; // marge croissante vers le genou
      for (let i = 0; i <= SEG; i++) {
        const a = ((i + 0.5) / SEG) * Math.PI * 2,
          rr = ring[i % SEG] + flare,
          x = Math.sin(a) * rr,
          z = Math.cos(a) * rr;
        pos.push(pelvis.x + x, y, pelvis.z + z);
        uv.push(i / SEG, t);
        // Sous la hanche, la robe suit franchement la cuisse de son côté (sinon le genou ressort en course) ;
        // seule une étroite bande devant/derrière se partage entre les deux jambes.
        const leg = clamp(t * 2.4, 0, 1),
          wl = clamp(0.5 + lSign * Math.sin(a) * 1.6, 0, 1);
        const calf = t > 0.6 ? ((t - 0.6) / 0.4) * 0.35 : 0;
        si.push(iP, iL, iR, wl > 0.5 ? iCL : iCR);
        sw.push(1 - leg, (leg - calf) * wl, (leg - calf) * (1 - wl), calf);
      }
    }
    for (let j = 0; j < RINGS; j++)
      for (let i = 0; i < SEG; i++) {
        const a = j * (SEG + 1) + i,
          b = a + SEG + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // Texture : tissu avec plis verticaux, bande dorée en bas et ouverture brodée devant.
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    const col = a => `rgb(${a.map(v => Math.round(clamp(v, 0, 1) * 255)).join(',')})`;
    g.fillStyle = col(cfg.color);
    g.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 32) {
      const gr = g.createLinearGradient(x, 0, x + 32, 0);
      gr.addColorStop(0, 'rgba(0,0,0,.12)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.05)');
      gr.addColorStop(1, 'rgba(0,0,0,.12)');
      g.fillStyle = gr;
      g.fillRect(x, 0, 32, 256);
    }
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.05)`;
      g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
    }
    const vg = g.createLinearGradient(0, 0, 0, 256);
    vg.addColorStop(0, 'rgba(0,0,0,.35)');
    vg.addColorStop(0.3, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = vg;
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = col(cfg.trim);
    g.fillRect(0, 232, 512, 10);
    g.fillRect(0, 222, 512, 3);
    g.fillRect(0, 0, 512, 9);
    g.fillRect(0, 0, 6, 256);
    g.fillRect(506, 0, 6, 256); // bord avant (a=0 → face +z)
    g.fillStyle = col(cfg.color.map(v => v * 0.55));
    g.fillRect(6, 9, 10, 213);
    g.fillRect(496, 9, 10, 213);
    g.fillStyle = col(cfg.trim);
    for (let x = 8; x < 512; x += 32) {
      g.beginPath();
      g.moveTo(x, 222);
      g.lineTo(x + 8, 206);
      g.lineTo(x + 16, 222);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
      skinning: true
    });
    const robe = new THREE.SkinnedMesh(geo, mat);
    robe.name = 'Robe';
    robe.frustumCulled = false;
    body.parent.add(robe);
    robe.position.copy(body.position);
    robe.quaternion.copy(body.quaternion);
    robe.scale.copy(body.scale);
    robe.bind(body.skeleton, body.bindMatrix);
    return robe;
  }

  // Halo lumineux additif (sprite) : donne l'impression de lumière sans post-traitement.
  const haloTextures = new Map();
  function glowSprite(THREE, color, size) {
    if (!haloTextures.has('h')) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      haloTextures.set('h', new THREE.CanvasTexture(c));
    }
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTextures.get('h'),
        color,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      })
    );
    sp.scale.set(size, size, 1);
    return sp;
  }

  // Yeux lumineux : l'iris (zone brune saturée de la texture) est recoloré et rendu émissif.
  function glowEyes(THREE, mesh, color, headBone, inv) {
    const m = (mesh.material = mesh.material.clone()),
      img = m.map && m.map.image;
    if (!img) return;
    const size = img.width || 256,
      c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, size, size);
    const mask = document.createElement('canvas');
    mask.width = mask.height = size;
    const mg = mask.getContext('2d'),
      mid = mg.createImageData(size, size);
    const id = g.getImageData(0, 0, size, size),
      d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const [h, s, l] = rgbToHsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
      const x = (i / 4) % size,
        y = Math.floor(i / 4 / size),
        r = Math.hypot(x - size / 2, y - size / 2) / size;
      if (r < 0.14 && ((s > 0.3 && h < 0.14 && l < 0.55) || l < 0.12)) {
        const k = l < 0.12 ? 0.35 : 1;
        d[i] = color.r * 255 * k;
        d[i + 1] = color.g * 255 * k;
        d[i + 2] = color.b * 255 * k;
        mid.data[i] = mid.data[i + 1] = mid.data[i + 2] = 255 * k;
        mid.data[i + 3] = 255;
      } else mid.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    mg.putImageData(mid, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.flipY = m.map.flipY;
    t.encoding = m.map.encoding;
    m.map = t;
    const e = new THREE.CanvasTexture(mask);
    e.flipY = m.map.flipY;
    m.emissiveMap = e;
    m.emissive = color.clone();
    m.emissiveIntensity = 1.6;
    // petits halos devant chaque œil, attachés à la tête
    const pos = mesh.geometry.attributes.position,
      v = new THREE.Vector3(),
      sides = [[], []];
    mesh.updateMatrixWorld(true);
    const mat = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mat);
      sides[v.x < 0 ? 0 : 1].push(v.clone());
    }
    for (const pts of sides) {
      if (!pts.length) continue;
      const cen = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length),
        front = Math.max(...pts.map(p => p.z));
      const sp = glowSprite(THREE, color, 0.024);
      sp.material.opacity = 0.7;
      sp.name = 'EyeGlow';
      sp.position.set(cen.x, cen.y, front + 0.004);
      headBone.attach(sp);
    }
  }

  // Point d'accroche dans le dos (surface mesurée sur la tenue ; le personnage regarde +z, le dos est vers -z).
  function backMount(THREE, body, bones, fitMeshes) {
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(),
      sp = new THREE.Vector3().setFromMatrixPosition(bones.spine_03.matrixWorld).applyMatrix4(inv);
    let back = sp.z;
    const v = new THREE.Vector3();
    for (const m of fitMeshes) {
      const pos = m.geometry.attributes.position,
        mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        if (Math.abs(v.y - sp.y) < 0.08 && Math.abs(v.x - sp.x) < 0.08) back = Math.min(back, v.z);
      }
    }
    const tl = new THREE.Vector3().setFromMatrixPosition(bones.thigh_l.matrixWorld).applyMatrix4(inv),
      tr = new THREE.Vector3().setFromMatrixPosition(bones.thigh_r.matrixWorld).applyMatrix4(inv);
    return {
      sp,
      back,
      toRight: Math.sign(tr.x - tl.x) || -1,
      hipHalf: Math.abs(tl.x - tr.x) / 2,
      pelvis: new THREE.Vector3().setFromMatrixPosition(bones.pelvis.matrixWorld).applyMatrix4(inv)
    };
  }
  // Fixe un objet placé en coordonnées du corps (pose de bind) sur un os, en conservant sa position.
  function mount(THREE, body, bone, obj) {
    obj.position.applyMatrix4(body.matrixWorld);
    obj.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(body.matrixWorld));
    bone.attach(obj);
    return obj;
  }

  // Bâton porté dans le dos, en diagonale (cristal au-dessus de l'épaule droite), attaché au haut de la colonne.
  function buildStaff(THREE, body, bones, cfg, height, fitMeshes) {
    const s = height / 1.8,
      g = new THREE.Group();
    g.name = 'Staff';
    const wood = new THREE.MeshStandardMaterial({ color: cfg.wood ?? 0x3b2416, roughness: 0.7, metalness: 0.05 });
    const gold = new THREE.MeshStandardMaterial({ color: cfg.metal ?? 0xc9a04a, roughness: 0.32, metalness: 0.85 });
    const cc = new THREE.Color(...cfg.crystal);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: cc,
      emissive: cc,
      emissiveIntensity: 2.8,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.95
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * s, 0.024 * s, 1.55 * s, 10), wood);
    g.add(shaft);
    for (const y of [-0.7, -0.2, 0.55, 0.68]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.035 * s, 12), gold);
      r.position.y = y * s;
      g.add(r);
    }
    // Tête du bâton : deux crochets qui enserrent le cristal
    for (const side of [-1, 1]) {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.085 * s, 0.012 * s, 8, 20, Math.PI * 1.1), gold);
      hook.position.set(side * 0.02 * s, 0.84 * s, 0);
      hook.rotation.set(0, side > 0 ? 0 : Math.PI, -0.5);
      g.add(hook);
    }
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 * s, 0), crystalMat);
    crystal.scale.set(0.8, 1.5, 0.8);
    crystal.position.y = 0.86 * s;
    g.add(crystal);
    const glow = new THREE.PointLight(cc, 1.4, 1.8 * s);
    glow.position.y = 0.86 * s;
    g.add(glow);
    // Halo magique pulsant autour du cristal
    const hc = cc.clone().multiplyScalar(0.85);
    hc.g *= 0.55; // halo plus saturé que le cristal
    const halo = glowSprite(THREE, hc, 0.42 * s),
      core = glowSprite(THREE, cc, 0.13 * s);
    halo.position.y = core.position.y = 0.86 * s;
    halo.name = 'CrystalGlow';
    g.add(halo, core);
    halo.onBeforeRender = () => {
      const t = performance.now() / 1000,
        p = 1 + Math.sin(t * 3.1) * 0.12 + Math.sin(t * 7.3) * 0.05;
      halo.scale.set(0.42 * s * p, 0.42 * s * p, 1);
      glow.intensity = 1.4 * p;
    };
    if (cfg.inHand) {
      const G = handGrip(THREE, bones, 'r');
      g.position.copy(G.pos);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.82, 0.57));
      g.position.addScaledVector(new THREE.Vector3(0, 0.82, 0.57), 0.25 * s);
      return mount(THREE, body, G.bone, g);
    }
    const M = backMount(THREE, body, bones, fitMeshes);
    g.position.set(M.sp.x, M.sp.y - 0.12 * s, M.back - (cfg.behindCape ? 0.17 : 0.04) * s);
    g.rotation.z = -M.toRight * 0.55; // le haut part vers l'épaule droite
    return mount(THREE, body, bones.spine_03, g);
  }

  // Armes de mêlée, rangées comme le bâton : dans le dos ou aux hanches.
  function buildWeapon(THREE, body, bones, kind, height, fitMeshes) {
    const s = height / 1.8,
      M = backMount(THREE, body, bones, fitMeshes);
    const steel = new THREE.MeshStandardMaterial({
      color: 0xaeb6c2,
      roughness: 0.25,
      metalness: 0.85,
      envMap: envMap(THREE),
      envMapIntensity: 1
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x4a5260,
      roughness: 0.25,
      metalness: 0.85,
      envMap: envMap(THREE),
      envMapIntensity: 1.4,
      emissive: 0x0a2a44,
      emissiveIntensity: 0.6
    });
    const leather = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.85 });
    const bronze = new THREE.MeshStandardMaterial({ color: 0xb0843c, roughness: 0.35, metalness: 0.85 });
    const B = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), m);
    const sword = (len, width, bladeMat, guardMat) => {
      const w = new THREE.Group();
      const blade = B(width, len, 0.012, bladeMat);
      blade.position.y = (len / 2) * s;
      w.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(width * 0.72 * s, width * 1.6 * s, 4), bladeMat);
      tip.scale.z = 0.18;
      tip.rotation.y = Math.PI / 4;
      tip.position.y = (len + width * 0.8) * s;
      w.add(tip);
      const guard = B(width * 3.2, 0.035, 0.04, guardMat);
      w.add(guard);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.018 * s, 0.2 * s, 8), leather);
      grip.position.y = -0.11 * s;
      w.add(grip);
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 10, 8), guardMat);
      pommel.position.y = -0.23 * s;
      w.add(pommel);
      return w;
    };
    // Armes tenues en main (les mêlées frappent avec) : poignée dans le poing, lame vers l'avant en T-pose (pouce devant).
    const inHand = (w, side, gripY, tilt = 0.35) => {
      const G = handGrip(THREE, bones, side),
        g = new THREE.Group();
      g.name = w.name;
      w.name = '';
      w.position.y = -gripY;
      if (/Sword|Runeblade/.test(g.name)) w.rotation.y = Math.PI / 2;
      g.add(w);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt)));
      g.position.copy(G.pos);
      mount(THREE, body, G.bone, g);
      return g;
    };
    if (/Shield$/.test(kind)) {
      // Bouclier rond sanglé sur l'avant-bras gauche (face extérieure), épée longue en main droite
      const gold = new THREE.MeshStandardMaterial({ color: 0xe0b050, roughness: 0.3, metalness: 0.9 }),
        gem = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x3399ff, emissiveIntensity: 2 });
      const sh = new THREE.Group();
      sh.name = 'Shield';
      // Pavois bombé : plaque d'acier sombre, bordure dorée rivetée, ombon serti entouré d'une couronne de pointes, pointes le long des bords
      const plateM = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x24262f).convertSRGBToLinear(),
        roughness: 0.45,
        metalness: 0.55
      });
      plateM.userData.stylized = true;
      const bulge = (x, y) => 0.07 * (1 - Math.min(1, (x / 0.24) ** 2)) * (1 - 0.45 * Math.min(1, (y / 0.4) ** 2));
      const rr = (w, h, r) => {
        const p = new THREE.Shape();
        p.moveTo(-w + r, -h);
        p.lineTo(w - r, -h);
        p.quadraticCurveTo(w, -h, w, -h + r);
        p.lineTo(w, h - r);
        p.quadraticCurveTo(w, h, w - r, h);
        p.lineTo(-w + r, h);
        p.quadraticCurveTo(-w, h, -w, h - r);
        p.lineTo(-w, -h + r);
        p.quadraticCurveTo(-w, -h, -w + r, -h);
        return p;
      };
      const ext = (sh2, d, m) => {
        const g2 = new THREE.ExtrudeGeometry(sh2, {
            depth: d,
            bevelEnabled: true,
            bevelSize: 0.008,
            bevelThickness: 0.008,
            bevelSegments: 2,
            curveSegments: 6
          }),
          p = g2.attributes.position;
        // subdivision implicite : on bombe chaque sommet selon sa position
        for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + bulge(p.getX(i), p.getY(i)));
        g2.computeVertexNormals();
        return new THREE.Mesh(g2, m);
      };
      const W2 = 0.24,
        H2 = 0.4,
        at = (x, y, dz) => new THREE.Vector3(x * s, y * s, (bulge(x, y) + dz) * s);
      const border = ext(rr(W2, H2, 0.06), 0.02, gold);
      border.scale.setScalar(s);
      border.position.z = -0.015 * s;
      sh.add(border);
      // la plaque est découpée en bandes pour que le bombé soit lisse
      const plateGeo = new THREE.PlaneGeometry(W2 * 2 - 0.05, H2 * 2 - 0.05, 16, 20),
        pp = plateGeo.attributes.position;
      for (let i = 0; i < pp.count; i++) pp.setZ(i, bulge(pp.getX(i), pp.getY(i)) + 0.03);
      plateGeo.computeVertexNormals();
      const plate = new THREE.Mesh(plateGeo, plateM);
      plate.scale.setScalar(s);
      sh.add(plate);
      const rivetG = new THREE.SphereGeometry(0.011 * s, 8, 6);
      for (const y of [-0.35, 0.35])
        for (let k = -3; k <= 3; k++) {
          const rv = new THREE.Mesh(rivetG, gold);
          rv.position.copy(at(k * 0.055, y, 0.034));
          sh.add(rv);
        }
      const bossP = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.095 * s, 0.035 * s, 8), gold);
      bossP.rotation.x = Math.PI / 2;
      bossP.position.copy(at(0, 0, 0.045));
      sh.add(bossP);
      const spikeG = new THREE.ConeGeometry(0.018 * s, 0.1 * s, 6);
      spikeG.rotateX(Math.PI / 2);
      spikeG.translate(0, 0, 0.05 * s);
      const spike = (x, y, len = 1, tilt = 0) => {
        const sp = new THREE.Mesh(spikeG, dark);
        sp.position.copy(at(x, y, 0.03));
        sp.scale.set(1, 1, len);
        sp.rotation.set(-y * tilt, x * tilt, 0);
        sh.add(sp);
      };
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        spike(Math.sin(a) * 0.13, Math.cos(a) * 0.13, 0.9, 1.2);
      }
      for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) spike(sx * 0.19, -0.3 + k * 0.12, 0.75, 1.6);
      for (const y of [-0.26, 0.26]) for (const x of [-0.08, 0.08]) spike(x, y, 0.7, 0.8);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.001, 0.001, 3, 3), steel);
      sh.add(rim);
      const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.05 * s, 0), gem);
      boss.scale.set(1, 1.3, 0.7);
      boss.position.set(0, 0, (0.07 + 0.06) * s);
      sh.add(boss);
      const la = bones.lowerarm_l.getWorldPosition(new THREE.Vector3()),
        hl = bones.hand_l.getWorldPosition(new THREE.Vector3());
      sh.position
        .copy(la)
        .lerp(hl, 0.5)
        .add(new THREE.Vector3(0, 0.07 * s, 0));
      {
        const inner = new THREE.Group();
        [...sh.children].forEach(c => inner.add(c));
        inner.rotation.z = Math.PI / 2;
        sh.add(inner);
      }
      sh.rotation.x = -Math.PI / 2;
      mount(THREE, body, bones.lowerarm_l, sh);
      if (kind === 'hammerShield') {
        const w = new THREE.Group();
        w.name = 'Hammer';
        const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.022 * s, 0.8 * s, 8), leather);
        hdl.position.y = 0.25 * s;
        w.add(hdl);
        const head = B(0.16, 0.09, 0.09, steel);
        head.position.y = 0.68 * s;
        w.add(head);
        for (const x of [-0.1, 0.1]) {
          const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * s, 0.045 * s, 0.03 * s, 6), steel);
          cap2.rotation.z = Math.PI / 2;
          cap2.position.set(x * s * 0.93, 0.68 * s, 0);
          w.add(cap2);
        }
        for (const x of [-0.05, 0.05]) {
          const band = B(0.02, 0.1, 0.1, gold);
          band.position.set(x * s, 0.68 * s, 0);
          w.add(band);
        }
        const g2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 * s, 0), gem);
        g2.position.set(0, 0.68 * s, 0.09 * s);
        w.add(g2);
        inHand(w, 'r', 0.05 * s, 0.35);
      } else if (kind === 'axeShield') {
        const w = new THREE.Group();
        w.name = 'Axe';
        const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * s, 0.025 * s, 0.9 * s, 8), leather);
        hdl.position.y = 0.3 * s;
        w.add(hdl);
        const sh2 = new THREE.Shape();
        sh2.moveTo(0, 0.12);
        sh2.quadraticCurveTo(0.3, 0.26, 0.34, 0);
        sh2.quadraticCurveTo(0.3, -0.26, 0, -0.12);
        sh2.lineTo(0, 0.12);
        const blade = new THREE.Mesh(
          new THREE.ExtrudeGeometry(sh2, {
            depth: 0.02,
            bevelEnabled: true,
            bevelSize: 0.008,
            bevelThickness: 0.006,
            bevelSegments: 1
          }),
          steel
        );
        blade.scale.setScalar(s * 0.7);
        blade.material = dark;
        blade.position.set(0.02 * s, 0.68 * s, -0.01 * s);
        w.add(blade);
        const back = new THREE.Mesh(new THREE.ConeGeometry(0.04 * s, 0.14 * s, 4), dark);
        back.rotation.z = Math.PI / 2;
        back.position.set(-0.07 * s, 0.68 * s, 0);
        w.add(back);
        const cap = B(0.06, 0.08, 0.06, gold);
        cap.position.y = 0.76 * s;
        w.add(cap);
        inHand(w, 'r', 0.05 * s, 0.35);
      } else {
        const ice = new THREE.MeshStandardMaterial({
          color: 0x4a9cff,
          emissive: 0x1a50ff,
          emissiveIntensity: 1.1,
          metalness: 0.2,
          roughness: 0.1,
          transparent: true,
          opacity: 0.92
        });
        const sw = sword(0.9, 0.065, ice, gold);
        sw.name = 'Sword';
        const g2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.03 * s, 0), gem);
        g2.position.set(0, 0, 0.025 * s);
        sw.add(g2);
        const aura = glowSprite(THREE, new THREE.Color(0.35, 0.6, 1), 0.5 * s);
        aura.scale.set(0.35 * s, 1.1 * s, 1);
        aura.position.y = 0.45 * s;
        aura.material.opacity = 0.7;
        sw.add(aura);
        aura.onBeforeRender = () => {
          aura.material.opacity = 0.55 + Math.sin(performance.now() / 90) * 0.15;
        };
        inHand(sw, 'r', -0.11 * s, 0.3);
      }
    } else if (kind === 'runeblade') {
      const sw = sword(1.0, 0.075, dark, dark);
      sw.name = 'Runeblade';
      const rc = new THREE.Color(0.45, 0.85, 1),
        rune = new THREE.MeshStandardMaterial({ color: rc, emissive: rc, emissiveIntensity: 2.2 });
      for (let i = 0; i < 5; i++) {
        const r = B(0.022, 0.06, 0.016, rune);
        r.position.y = (0.15 + i * 0.17) * s;
        sw.add(r);
      }
      const glow = glowSprite(THREE, rc, 0.35 * s);
      glow.position.y = 0.5 * s;
      glow.scale.set(0.25 * s, 1.1 * s, 1);
      glow.material.opacity = 0.35;
      sw.add(glow);
      inHand(sw, 'r', -0.11 * s, 0.4);
    } else if (kind === 'daggers') {
      // Glaives doubles (design original) : poignée au poing, une lame en croissant de chaque côté de la main
      // (devant et derrière), dents sur le bord inférieur, garde ronde ornée d'un croissant de lune.
      // enchantement vert vif : lame entièrement lumineuse + halo additif autour de la lame
      const fel = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x1f8a12).convertSRGBToLinear(),
        emissive: new THREE.Color(0x2fc80f).convertSRGBToLinear(),
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0
      });
      const felHalo = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.18, 0.75, 0.06),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const grip = new THREE.MeshStandardMaterial({ color: 0x1c1a1e, roughness: 0.6, metalness: 0.5 });
      const silver = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.3, metalness: 0.9 });
      // profil d'une lame : a = le long de la lame (depuis le poing), b = vers le haut
      const blade = () => {
        const p = new THREE.Shape();
        p.moveTo(0.07, -0.03);
        p.quadraticCurveTo(0.32, -0.09, 0.5, 0.0);
        p.quadraticCurveTo(0.6, 0.08, 0.62, 0.26); // pointe relevée
        p.quadraticCurveTo(0.5, 0.06, 0.38, 0.05);
        p.lineTo(0.33, 0.1).lineTo(0.29, 0.04); // dent
        p.quadraticCurveTo(0.18, 0.05, 0.12, 0.1);
        p.lineTo(0.07, 0.05);
        p.lineTo(0.07, -0.03);
        const geo = new THREE.ExtrudeGeometry(p, {
          depth: 0.014,
          bevelEnabled: true,
          bevelSize: 0.006,
          bevelThickness: 0.005,
          bevelSegments: 1
        });
        geo.translate(0, 0, -0.007);
        geo.rotateX(-Math.PI / 2); // (a,b,c) -> (a,c,-b)
        geo.rotateZ(Math.PI / 2); // -> (-c,a,-b) : a le long de y, b vers -z (le haut)
        return geo;
      };
      for (const side of ['l', 'r']) {
        const g = new THREE.Group();
        g.name = 'Dagger';
        for (const dir of [1, -1]) {
          const m = new THREE.Mesh(blade(), fel);
          m.scale.set(s, dir * s, s);
          g.add(m);
          const halo = new THREE.Mesh(m.geometry, felHalo);
          halo.scale.set(s * 1.25, dir * s * 1.08, s * 1.18);
          g.add(halo);
          for (const t of [0.22, 0.4, 0.56]) {
            const aura = glowSprite(THREE, new THREE.Color(0.35, 1, 0.15), 0.28 * s);
            aura.position.set(0, dir * t * s, -0.06 * s);
            aura.material.opacity = 0.55;
            g.add(aura);
          }
        }
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.025 * s, 16), grip);
        guard.rotation.z = Math.PI / 2;
        g.add(guard);
        const moon = new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.01 * s, 6, 20, Math.PI * 1.3), silver);
        moon.rotation.y = Math.PI / 2;
        moon.position.x = 0.016 * s;
        g.add(moon);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.018 * s, 0), fel);
        gem.position.x = 0.02 * s;
        g.add(gem);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.14 * s, 8), grip);
        g.add(handle);
        // tranchant dans le sens de la frappe ; les repères des deux mains sont symétriques → rotation opposée
        g.rotation.y = side === 'l' ? Math.PI / 2 : -Math.PI / 2;
        inHand(g, side, 0, 0.15);
      }
    }
  }
  function handGrip(THREE, bones, side) {
    const H = bones['hand_' + side].getWorldPosition(new THREE.Vector3()),
      L = bones['lowerarm_' + side].getWorldPosition(new THREE.Vector3()),
      dir = H.clone().sub(L).normalize();
    return {
      pos: H.clone()
        .addScaledVector(dir, 0.075)
        .add(new THREE.Vector3(0, -0.028, 0)),
      bone: bones['hand_' + side]
    };
  }

  // Détails raciaux sur la tête : oreilles pointues, défenses, bois de cerf (druide). Mesurés sur la tête réelle.
  function headFeatures(THREE, kit, root, body, bones, skinColor) {
    if (!kit.ears && !kit.tusks && !kit.antlers) return;
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(),
      pts = [],
      v = new THREE.Vector3();
    const geo = body.geometry,
      pos = geo.attributes.position,
      idx = geo.index,
      mat = new THREE.Matrix4().multiplyMatrices(inv, body.matrixWorld);
    const seen = new Set();
    for (let i = 0; i < idx.count; i++) {
      const k = idx.getX(i);
      if (seen.has(k)) continue;
      seen.add(k);
      pts.push(v.fromBufferAttribute(pos, k).applyMatrix4(mat).clone());
    }
    let eyes = null;
    root.traverse(o => {
      if (o.isMesh && o.name === 'Eyes') eyes = o;
    });
    const eye = new THREE.Vector3();
    if (eyes) {
      eyes.geometry.computeBoundingBox();
      eyes.geometry.boundingBox.getCenter(eye);
      eye.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, eyes.matrixWorld));
    }
    const top = Math.max(...pts.map(p => p.y)),
      cx = eye.x;
    const front = pts.filter(p => Math.abs(p.x - cx) < 0.015 && p.y < eye.y - 0.03 && p.y > eye.y - 0.12);
    const chin = Math.min(...front.map(p => p.y)),
      mouthZ = Math.max(...front.filter(p => p.y < eye.y - 0.07).map(p => p.z));
    const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.62, metalness: 0 });
    const ivory = new THREE.MeshStandardMaterial({ color: 0xece0c2, roughness: 0.45 });
    const cone = (r, len, m) => {
      const g = new THREE.ConeGeometry(r, len, 10);
      g.translate(0, len / 2, 0);
      return new THREE.Mesh(g, m);
    };
    const aim = (o, d) => o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    for (const side of [-1, 1]) {
      if (kit.ears) {
        const band = pts.filter(
          p => Math.abs(p.y - (eye.y - 0.01)) < 0.025 && p.z < eye.z - 0.04 && Math.sign(p.x - cx) === side
        );
        const ear = band.reduce((a, b) => (Math.abs(b.x - cx) > Math.abs(a.x - cx) ? b : a), band[0] || eye);
        const e = cone(0.017, kit.ears.len, skin);
        e.geometry.scale(1, 1, 0.38);
        e.name = 'Ear';
        aim(e, new THREE.Vector3(side, kit.ears.up, -0.45));
        e.position.set(ear.x - side * 0.006, ear.y + 0.004, ear.z + 0.004);
        mount(THREE, body, bones.Head, e);
      }
      if (kit.tusks) {
        // défenses inférieures : partent de la lèvre du bas et remontent devant la lèvre supérieure
        const t = cone(0.0068, 0.034, ivory);
        t.name = 'Tusk';
        aim(t, new THREE.Vector3(side * 0.22, 1, 0.12));
        t.position.set(cx + side * 0.02, chin + 0.036, mouthZ - 0.006);
        mount(THREE, body, bones.Head, t);
      }
      if (kit.antlers) {
        const horn = new THREE.MeshStandardMaterial({ color: 0x6e5536, roughness: 0.8 });
        const g = new THREE.Group();
        g.name = 'Antler';
        const seg = (from, dir, len, r) => {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 7), horn);
          c.geometry.translate(0, len / 2, 0);
          aim(c, dir.clone());
          c.position.copy(from);
          g.add(c);
          return from.clone().add(dir.clone().normalize().multiplyScalar(len));
        };
        let p = new THREE.Vector3();
        p = seg(p, new THREE.Vector3(side * 0.8, 1, -0.3), 0.09, 0.012);
        const t1 = p.clone();
        p = seg(p, new THREE.Vector3(side * 0.5, 1, -0.5), 0.1, 0.009);
        const t2 = p.clone();
        seg(p, new THREE.Vector3(side * 0.2, 1, -0.1), 0.07, 0.006);
        seg(t1, new THREE.Vector3(side * 0.15, 1, 0.5), 0.07, 0.006);
        seg(t2, new THREE.Vector3(side, 0.6, 0.1), 0.06, 0.005);
        g.position.set(cx + side * 0.045, top - 0.03, eye.z - 0.07);
        mount(THREE, body, bones.Head, g);
      }
    }
  }

  // Orbes lumineux qui gravitent autour de la taille d'un lanceur de sorts (ils suivent le personnage, pas ses os).
  function buildOrbs(THREE, root, bones, cfg, height) {
    const s = height / 1.8,
      g = new THREE.Group();
    g.name = 'Orbs';
    const c = new THREE.Color(...cfg.color),
      hy = bones.spine_01.getWorldPosition(new THREE.Vector3()).y;
    const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.3, roughness: 0.2 });
    const hc = c.clone();
    hc.offsetHSL(0, 0.2, -0.1);
    const list = [];
    for (let i = 0; i < cfg.n; i++) {
      const o = new THREE.Group(),
        core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 * s, 1), mat),
        halo = glowSprite(THREE, hc, 0.55 * s),
        trail = glowSprite(THREE, hc, 0.28 * s);
      trail.material.opacity = 0.5;
      o.add(core, halo, trail);
      g.add(o);
      list.push({ o, trail, ph: (i / cfg.n) * Math.PI * 2 });
    }
    let last = -1;
    const update = () => {
      const t = performance.now() / 1000;
      if (t === last) return;
      last = t;
      for (const L of list) {
        const a = t * 1.6 + L.ph,
          r = 0.48 * s,
          y = hy + 0.12 * s + Math.sin(t * 2.2 + L.ph) * 0.14 * s;
        L.o.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        L.trail.position.set(-Math.cos(a) * 0.07 * s, 0, Math.sin(a) * 0.07 * s);
        L.o.children[1].material.opacity = 0.75 + Math.sin(t * 5 + L.ph) * 0.2;
      }
    };
    update();
    for (const L of list) L.o.children[1].onBeforeRender = update;
    root.add(g);
  }

  // ---- Capes, tabards et effets de main (style héroïque) ----
  const capeTime = { value: 0 };
  // Emblèmes originaux dessinés au trait (aucun symbole de franchise existante).
  function drawEmblem(g, cx, cy, sz, kind, col) {
    g.save();
    g.translate(cx, cy);
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineWidth = sz * 0.07;
    g.lineJoin = 'round';
    // écu
    g.beginPath();
    g.moveTo(-sz * 0.5, -sz * 0.55);
    g.lineTo(sz * 0.5, -sz * 0.55);
    g.lineTo(sz * 0.5, 0);
    g.quadraticCurveTo(sz * 0.45, sz * 0.45, 0, sz * 0.65);
    g.quadraticCurveTo(-sz * 0.45, sz * 0.45, -sz * 0.5, 0);
    g.closePath();
    g.stroke();
    if (kind === 'sword') {
      g.fillRect(-sz * 0.05, -sz * 0.42, sz * 0.1, sz * 0.75);
      g.fillRect(-sz * 0.24, -sz * 0.12, sz * 0.48, sz * 0.08);
      g.beginPath();
      g.arc(0, -sz * 0.46, sz * 0.07, 0, 7);
      g.fill();
    } else if (kind === 'axes') {
      for (const s of [-1, 1]) {
        g.save();
        g.rotate(s * 0.6);
        g.fillRect(-sz * 0.04, -sz * 0.4, sz * 0.08, sz * 0.8);
        g.beginPath();
        g.moveTo(0, -sz * 0.38);
        g.quadraticCurveTo(s * sz * 0.32, -sz * 0.3, s * sz * 0.04, -sz * 0.12);
        g.fill();
        g.restore();
      }
    } else if (kind === 'hammer') {
      g.fillRect(-sz * 0.05, -sz * 0.3, sz * 0.1, sz * 0.7);
      g.fillRect(-sz * 0.28, -sz * 0.42, sz * 0.56, sz * 0.2);
    } else if (kind === 'tree') {
      g.fillRect(-sz * 0.04, -sz * 0.1, sz * 0.08, sz * 0.45);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(-sz * 0.18 + k * sz * 0.18, -sz * 0.2 - (k % 2) * sz * 0.08, sz * 0.15, 0, 7);
        g.fill();
      }
    } else if (kind === 'star') {
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2,
          r = k % 2 ? sz * 0.12 : sz * 0.38;
        g.lineTo(Math.sin(a) * r, -Math.cos(a) * r);
      }
      g.fill();
    }
    g.restore();
  }
  function clothTexture(THREE, cfg, W = 256, H = 512) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const col = a => `rgb(${a.map(v => Math.round(clamp(v, 0, 1) * 255)).join(',')})`;
    g.fillStyle = col(cfg.color);
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += W / 8) {
      const gr = g.createLinearGradient(x, 0, x + W / 8, 0);
      gr.addColorStop(0, 'rgba(0,0,0,.28)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.1)');
      gr.addColorStop(1, 'rgba(0,0,0,.28)');
      g.fillStyle = gr;
      g.fillRect(x, 0, W / 8, H);
    }
    const vg = g.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,.35)');
    vg.addColorStop(0.25, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    const tr = col(cfg.trim);
    g.fillStyle = tr;
    g.fillRect(0, 0, W, 10);
    g.fillRect(0, 0, 9, H);
    g.fillRect(W - 9, 0, 9, H);
    g.fillRect(0, H - 26, W, 8);
    g.fillRect(0, H - 40, W, 3);
    for (let x = 6; x < W; x += 24) {
      g.beginPath();
      g.moveTo(x, H - 40);
      g.lineTo(x + 7, H - 54);
      g.lineTo(x + 14, H - 40);
      g.fill();
    }
    if (cfg.emblem) drawEmblem(g, W / 2, H * (cfg.emblemY || 0.3), W * 0.45, cfg.emblem, tr);
    if (cfg.tattered) {
      g.globalCompositeOperation = 'destination-out';
      const r = rng(17);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 14) {
        g.lineTo(x, H - r() * H * 0.16 * cfg.tattered - 6);
        g.lineTo(x + W / 28, H);
      }
      g.lineTo(W, H);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  // Pan de tissu skinné : rangées du haut vers le bas, colonnes de gauche à droite ; zAt(x,y,t,prevZ) donne la profondeur.
  function buildClothPanel(THREE, body, name, cfg, rows, cols, frame, zAt, weightsAt) {
    const pos = [],
      uv = [],
      si = [],
      sw = [],
      idx = [],
      prev = new Array(cols + 1).fill(null);
    for (let j = 0; j <= rows; j++) {
      const t = j / rows,
        y = frame.y0 + (frame.y1 - frame.y0) * t,
        hw = frame.hw0 + (frame.hw1 - frame.hw0) * t;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols,
          x = frame.cx + (u * 2 - 1) * hw,
          z = zAt(x, y, t, u, prev[i]);
        prev[i] = z;
        pos.push(x, y, z);
        uv.push(u, t);
        const w = weightsAt(y, t, u);
        si.push(...w.i);
        sw.push(...w.w);
      }
    }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i,
          b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: clothTexture(THREE, cfg),
      roughness: 0.8,
      metalness: 0.02,
      side: THREE.DoubleSide,
      skinning: true,
      alphaTest: 0.5
    });
    const amp = cfg.wave || 0.05,
      dir = frame.out;
    mat.onBeforeCompile = sh => {
      sh.uniforms.time = capeTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float time;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float k=uv.y*uv.y;transformed.z+=${dir.toFixed(1)}*(sin(time*2.3+uv.y*5.+uv.x*2.)*.5+.6)*${amp.toFixed(3)}*k;transformed.x+=sin(time*1.7+uv.y*4.)*.015*k;`
      );
    };
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = name;
    m.frustumCulled = false;
    m.onBeforeRender = () => {
      capeTime.value = performance.now() / 1000;
    };
    body.parent.add(m);
    m.position.copy(body.position);
    m.quaternion.copy(body.quaternion);
    m.scale.copy(body.scale);
    m.bind(body.skeleton, body.bindMatrix);
    return m;
  }
  // Points (pose de bind, repère du corps) des maillages qui comptent pour l'encombrement : tenue, robe, armures.
  function collectPoints(THREE, root, body) {
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(),
      pts = [],
      v = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      if (!/_(Body|Legs)$|^Robe$|^Armor_/.test(o.name)) return;
      const p = o.geometry.attributes.position,
        m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld),
        step = Math.max(1, Math.floor(p.count / 2500));
      for (let i = 0; i < p.count; i += step) {
        v.fromBufferAttribute(p, i).applyMatrix4(m);
        pts.push(v.x, v.y, v.z);
      }
    });
    return pts;
  }
  function extremeZ(pts, x, y, dx, dy, front) {
    let best = null;
    for (let i = 0; i < pts.length; i += 3) {
      if (Math.abs(pts[i + 1] - y) > dy || Math.abs(pts[i] - x) > dx) continue;
      const z = pts[i + 2];
      if (best === null || (front ? z > best : z < best)) best = z;
    }
    return best;
  }
  function buildCape(THREE, root, body, bones, cfg, pts) {
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const P = n => new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(inv);
    const ul = P('upperarm_l'),
      ur = P('upperarm_r'),
      pel = P('pelvis'),
      cl = P('calf_l'),
      fl = P('foot_l'),
      s3 = P('spine_03'),
      s2 = P('spine_02'),
      s1 = P('spine_01');
    const sk = body.skeleton.bones,
      bi = n => sk.findIndex(b => b.name === n),
      I = [bi('spine_03'), bi('spine_02'), bi('spine_01'), bi('pelvis')],
      Y = [s3.y, s2.y, s1.y, pel.y];
    const len = cfg.length ?? 0.7,
      y0 = ul.y + 0.03,
      y1 = pel.y + (fl.y - pel.y) * len,
      hw = Math.abs(ul.x - ur.x) * 0.5 * (cfg.width || 0.85);
    const frame = { y0, y1, cx: (ul.x + ur.x) / 2, hw0: hw, hw1: hw * (cfg.flare || 1.45), out: -1 };
    const zAt = (x, y, t, u, prev) => {
      let z = extremeZ(pts, x, y, 0.07, 0.05, false);
      if (z === null) z = prev ?? s3.z - 0.15;
      z -= 0.05 + 0.22 * Math.pow(t, 1.6) + Math.sin(u * Math.PI) * 0.03;
      return prev === null ? z : Math.min(z, prev);
    };
    const wAt = y => {
      if (y >= Y[0]) return { i: [I[0], 0, 0, 0], w: [1, 0, 0, 0] };
      if (y <= Y[3]) return { i: [I[3], 0, 0, 0], w: [1, 0, 0, 0] };
      for (let k = 0; k < 3; k++)
        if (y <= Y[k] && y >= Y[k + 1]) {
          const f = (Y[k] - y) / (Y[k] - Y[k + 1]);
          return { i: [I[k], I[k + 1], 0, 0], w: [1 - f, f, 0, 0] };
        }
      return { i: [I[3], 0, 0, 0], w: [1, 0, 0, 0] };
    };
    return buildClothPanel(THREE, body, 'Cape', cfg, 16, 12, frame, zAt, wAt);
  }
  function buildTabard(THREE, root, body, bones, cfg, pts) {
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const P = n => new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(inv);
    const pel = P('pelvis'),
      tl = P('thigh_l'),
      tr = P('thigh_r'),
      cl = P('calf_l');
    const sk = body.skeleton.bones,
      bi = n => sk.findIndex(b => b.name === n),
      iP = bi('pelvis'),
      iL = bi('thigh_l'),
      iR = bi('thigh_r');
    const hw = Math.abs(tl.x - tr.x) * 0.62,
      frame = { y0: pel.y + 0.1, y1: cl.y + 0.04, cx: (tl.x + tr.x) / 2, hw0: hw, hw1: hw * 1.1, out: 1 };
    const zAt = (x, y, t, u, prev) => {
      let z = extremeZ(pts, x, y, 0.08, 0.05, true);
      if (z === null) z = prev ?? pel.z + 0.15;
      z += 0.025 + 0.09 * t;
      return prev === null ? z : Math.max(z, prev);
    };
    const wAt = (y, t) => {
      const leg = clamp(t * 1.6, 0, 1) * 0.6;
      return { i: [iP, iL, iR, 0], w: [1 - leg, leg / 2, leg / 2, 0] };
    };
    return buildClothPanel(THREE, body, 'Tabard', { ...cfg, emblemY: 0.32, wave: 0.02 }, 10, 6, frame, zAt, wAt);
  }
  // Effets tenus dans la main gauche (ou droite) : orbe arcanique, étoile sacrée, flamme gangrenée, grimoire.
  function starTexture(THREE, kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (kind === 'star') {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,230,160,.6)');
      gr.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,250,220,1)';
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2,
          r = k % 2 ? 8 : 62;
        g.lineTo(64 + Math.sin(a) * r, 64 - Math.cos(a) * r);
      }
      g.fill();
    } else {
      const gr = g.createRadialGradient(64, 90, 4, 64, 72, 62);
      gr.addColorStop(0, 'rgba(255,255,230,1)');
      gr.addColorStop(0.3, 'rgba(200,255,120,.9)');
      gr.addColorStop(0.7, 'rgba(80,220,40,.4)');
      gr.addColorStop(1, 'rgba(20,120,0,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(64, 4);
      g.bezierCurveTo(116, 56, 108, 124, 64, 124);
      g.bezierCurveTo(20, 124, 12, 56, 64, 4);
      g.fill();
    }
    return new THREE.CanvasTexture(c);
  }
  function buildHandFx(THREE, body, bones, cfg, height) {
    const s = height / 1.8;
    for (const fx of cfg) {
      const G = handGrip(THREE, bones, fx.hand || 'l'),
        g = new THREE.Group();
      g.name = 'HandFx';
      const c = new THREE.Color(...fx.color);
      const H = bones['hand_' + (fx.hand || 'l')].getWorldPosition(new THREE.Vector3());
      g.position
        .copy(H)
        .lerp(G.pos, 1.6)
        .add(new THREE.Vector3(0, 0.04 * s, 0.05 * s));
      if (fx.kind === 'orb') {
        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.055 * s, 2),
          new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2 })
        );
        g.add(core);
        const halo = glowSprite(THREE, c, 0.42 * s);
        g.add(halo);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.12 * s, 0.007 * s, 6, 32),
          new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
        );
        g.add(ring);
        const r2 = ring.clone();
        g.add(r2);
        halo.onBeforeRender = () => {
          const t = performance.now() / 1000;
          ring.rotation.set(t * 2.1, t * 1.3, 0);
          r2.rotation.set(-t * 1.4, 0, t * 2.4);
          halo.material.opacity = 0.8 + Math.sin(t * 4) * 0.15;
        };
      } else if (fx.kind === 'star' || fx.kind === 'flame') {
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: starTexture(THREE, fx.kind),
            color: c,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
          })
        );
        const base = fx.kind === 'star' ? 0.38 * s : 0.3 * s;
        sp.scale.set(base, base * (fx.kind === 'flame' ? 1.4 : 1), 1);
        if (fx.kind === 'flame') sp.position.y = 0.08 * s;
        g.add(sp);
        g.add(glowSprite(THREE, c, 0.45 * s));
        sp.onBeforeRender = () => {
          const t = performance.now() / 1000,
            f =
              fx.kind === 'flame' ? 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.7) * 0.06 : 1 + Math.sin(t * 3) * 0.08;
          sp.scale.set(base * f, base * f * (fx.kind === 'flame' ? 1.4 : 1), 1);
          if (fx.kind === 'star') sp.material.rotation = t * 0.6;
        };
      } else if (fx.kind === 'book') {
        g.position.copy(G.pos);
        const cover = new THREE.Mesh(
          new THREE.BoxGeometry(0.2 * s, 0.03 * s, 0.26 * s),
          new THREE.MeshStandardMaterial({ color: 0x3a1f12, roughness: 0.7 })
        );
        g.add(cover);
        const pages = new THREE.Mesh(
          new THREE.BoxGeometry(0.18 * s, 0.032 * s, 0.24 * s),
          new THREE.MeshStandardMaterial({ color: 0xeee2c0, emissive: c, emissiveIntensity: 0.5 })
        );
        pages.position.y = 0.004 * s;
        g.add(pages);
        const rune = glowSprite(THREE, c, 0.28 * s);
        rune.position.y = 0.08 * s;
        g.add(rune);
      }
      mount(THREE, body, G.bone, g);
    }
  }
  // Crânes (ceinture du démoniste, épaulières du chevalier de la mort).
  function skullMesh(THREE, r) {
    const g = new THREE.Group(),
      bone = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 0.55 }),
      dark = new THREE.MeshBasicMaterial({ color: 0x0c0a0a });
    const head = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), bone);
    head.scale.set(1, 1, 1.1);
    g.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, r * 0.6, r * 0.9), bone);
    jaw.position.set(0, -r * 0.75, r * 0.25);
    g.add(jaw);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(r * 0.26, 8, 6), dark);
      e.position.set(sx * r * 0.38, -r * 0.1, r * 0.92);
      g.add(e);
    }
    return g;
  }
  function buildSkulls(THREE, body, bones, cfg, height, pts) {
    const s = height / 1.8;
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const P = n => new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(inv);
    if (cfg.belt) {
      const pel = P('pelvis'),
        tl = P('thigh_l'),
        tr = P('thigh_r');
      for (const [k, f] of [
        [0, 0.35],
        [1, -0.35]
      ]) {
        const x = pel.x + (tl.x - tr.x) * f,
          y = pel.y + 0.06,
          z = (extremeZ(pts, x, y, 0.05, 0.04, true) ?? pel.z + 0.15) + 0.035;
        const sk = skullMesh(THREE, 0.045 * s);
        sk.name = 'Skull';
        sk.position.set(x, y, z);
        mount(THREE, body, bones.pelvis, sk);
      }
    }
    if (cfg.shoulders) {
      for (const side of ['l', 'r']) {
        const u = P('upperarm_' + side),
          c = P('clavicle_' + side),
          sk = skullMesh(THREE, 0.07 * s);
        sk.name = 'Skull';
        sk.position.set(u.x + (u.x - c.x) * 0.15, u.y + 0.14 * s, u.z + 0.04);
        if (cfg.flame) {
          const fl = glowSprite(THREE, new THREE.Color(...cfg.flame), 0.5 * s);
          fl.position.y = 0.08 * s;
          fl.onBeforeRender = () => {
            fl.material.opacity = 0.6 + Math.sin(performance.now() / 130 + u.x * 9) * 0.2;
          };
          sk.add(fl);
        }
        mount(THREE, body, bones['clavicle_' + side], sk);
      }
    }
  }

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

  // ---- Armures procédurales ------------------------------------------------------------------
  // Pose de bind = T-pose, corps à l'origine, mètres, regard +z ; l'axe long de chaque os est son +y local.
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647; // pseudo-aléatoire stable

  // Reflets des métaux : dégradé ciel/sol équirectangulaire (three le convertit en cubemap).
  let envTex = null;
  function envMap(THREE) {
    if (envTex) return envTex;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#d6e2f2');
    gr.addColorStop(0.42, '#8496b0');
    gr.addColorStop(0.5, '#f0d9b5');
    gr.addColorStop(0.56, '#5a4a3a');
    gr.addColorStop(1, '#16120e');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 6; i++) {
      const x = i * 43 + 10,
        y = 18 + ((i * 37) % 30),
        rg = g.createRadialGradient(x, y, 0, x, y, 18);
      rg.addColorStop(0, 'rgba(255,255,255,.9)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(x - 18, y - 18, 36, 36);
    }
    envTex = new THREE.CanvasTexture(c);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.encoding = THREE.sRGBEncoding;
    return envTex;
  }

  // Texture de plaque/cuir : u fait le tour (avant au centre), v suit le segment.
  const armorTextures = new Map();
  function armorTexture(THREE, st) {
    const key = JSON.stringify(st);
    if (armorTextures.has(key)) return armorTextures.get(key);
    const W = 256,
      H = 256,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const col = a => `rgb(${a.map(v => Math.round(clamp(v, 0, 1) * 255)).join(',')})`,
      rnd = rng(7);
    g.fillStyle = col(st.base);
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${st.grain || 0.06})`;
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 4, 1);
    }
    const n = st.lames || 1;
    for (let k = 1; k < n; k++) {
      const y = (k * H) / n;
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(0, y - 2, W, 3);
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.fillRect(0, y + 1, W, 2);
    }
    if (st.ridge) {
      const gr = g.createLinearGradient(W / 2 - 12, 0, W / 2 + 12, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.45, 'rgba(255,255,255,.35)');
      gr.addColorStop(0.55, 'rgba(0,0,0,.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(W / 2 - 12, 0, 24, H);
    }
    if (st.diamonds) {
      const cw = W / 4,
        ch = H / 3,
        tc = col(st.trim || [0.85, 0.68, 0.3]),
        ic = st.diamonds;
      for (let r = 0; r < 3; r++)
        for (let q = 0; q < 4; q++) {
          const cx = cw * q + cw / 2 + (r % 2 ? cw / 2 : 0),
            cy = ch * r + ch / 2;
          for (const dx of [0, -W]) {
            const x = cx + (cx > W ? dx : 0);
            g.beginPath();
            g.moveTo(x, cy - ch * 0.42);
            g.lineTo(x + cw * 0.42, cy);
            g.lineTo(x, cy + ch * 0.42);
            g.lineTo(x - cw * 0.42, cy);
            g.closePath();
            g.fillStyle = tc;
            g.fill();
            const gr = g.createLinearGradient(x, cy - ch * 0.3, x, cy + ch * 0.3);
            gr.addColorStop(0, col(ic.map(v => Math.min(1, v * 1.5))));
            gr.addColorStop(1, col(ic.map(v => v * 0.45)));
            g.beginPath();
            g.moveTo(x, cy - ch * 0.3);
            g.lineTo(x + cw * 0.3, cy);
            g.lineTo(x, cy + ch * 0.3);
            g.lineTo(x - cw * 0.3, cy);
            g.closePath();
            g.fillStyle = gr;
            g.fill();
            g.fillStyle = 'rgba(255,255,255,.55)';
            g.beginPath();
            g.moveTo(x, cy - ch * 0.3);
            g.lineTo(x + cw * 0.12, cy - ch * 0.18);
            g.lineTo(x, cy - ch * 0.06);
            g.lineTo(x - cw * 0.12, cy - ch * 0.18);
            g.fill();
          }
        }
    }
    if (st.trim) {
      g.fillStyle = col(st.trim);
      g.fillRect(0, 0, W, 18);
      g.fillRect(0, H - 18, W, 18);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(0, 2, W, 3);
      g.fillRect(0, H - 16, W, 3);
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(0, 18, W, 3);
      g.fillRect(0, H - 21, W, 3);
      if (st.rivets)
        for (let x = 6; x < W; x += 16)
          for (const y of [5, H - 5]) {
            g.fillStyle = 'rgba(255,255,255,.75)';
            g.beginPath();
            g.arc(x, y, 2, 0, 7);
            g.fill();
          }
    }
    if (st.trim && !st.plain) {
      const tc = col(st.trim.map(v => Math.min(1, v * 1.25)));
      g.strokeStyle = tc;
      g.lineWidth = 2;
      for (const [y, dir] of [
        [24, 1],
        [H - 24, -1]
      ])
        for (let x = 0; x < W; x += 32) {
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + 8, y - 10 * dir, x + 16, y - 10 * dir, x + 16, y);
          g.bezierCurveTo(x + 16, y + 8 * dir, x + 24, y + 8 * dir, x + 32, y);
          g.stroke();
          g.beginPath();
          g.arc(x + 16, y - 5 * dir, 2.5, 0, 7);
          g.fillStyle = tc;
          g.fill();
        }
      if (st.kindMetal !== false) {
        g.save();
        g.translate(W / 2, H / 2);
        g.strokeStyle = tc;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(0, -28);
        g.lineTo(18, 0);
        g.lineTo(0, 28);
        g.lineTo(-18, 0);
        g.closePath();
        g.stroke();
        g.lineWidth = 1.5;
        for (const sx of [-1, 1]) {
          g.beginPath();
          g.moveTo(sx * 18, 0);
          g.bezierCurveTo(sx * 40, -18, sx * 58, 6, sx * 76, -10);
          g.stroke();
          g.beginPath();
          g.moveTo(sx * 18, 0);
          g.bezierCurveTo(sx * 40, 18, sx * 58, -6, sx * 76, 10);
          g.stroke();
        }
        g.fillStyle = 'rgba(120,200,255,.9)';
        g.beginPath();
        g.arc(0, 0, 6, 0, 7);
        g.fill();
        g.restore();
      }
    }
    if (st.stitch) {
      g.strokeStyle = col(st.stitch);
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      for (const y of [16, H - 16]) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
      g.setLineDash([]);
    }
    let emissiveMap = null;
    if (st.diamonds) {
      const e = document.createElement('canvas');
      e.width = W;
      e.height = H;
      const ge = e.getContext('2d');
      ge.fillStyle = '#000';
      ge.fillRect(0, 0, W, H);
      ge.fillStyle = '#fff';
      const cw = W / 4,
        ch = H / 3;
      for (let r = 0; r < 3; r++)
        for (let q = 0; q < 5; q++) {
          const x = cw * q + cw / 2 + (r % 2 ? cw / 2 : 0) - (q === 4 ? W : 0),
            cy = ch * r + ch / 2;
          ge.beginPath();
          ge.moveTo(x, cy - ch * 0.3);
          ge.lineTo(x + cw * 0.3, cy);
          ge.lineTo(x, cy + ch * 0.3);
          ge.lineTo(x - cw * 0.3, cy);
          ge.fill();
        }
      ge.fillRect(0, 2, W, 5);
      ge.fillRect(0, H - 7, W, 5);
      emissiveMap = new THREE.CanvasTexture(e);
    }
    if (st.glow && !st.rune && !st.diamonds) {
      const e = document.createElement('canvas');
      e.width = W;
      e.height = H;
      const ge = e.getContext('2d');
      ge.fillStyle = '#000';
      ge.fillRect(0, 0, W, H);
      ge.fillStyle = '#fff';
      if (st.trim) {
        ge.fillRect(0, 2, W, 6);
        ge.fillRect(0, H - 8, W, 6);
      }
      if (st.stitch) {
        ge.strokeStyle = '#fff';
        ge.lineWidth = 2;
        ge.setLineDash([5, 4]);
        for (const y of [16, H - 16]) {
          ge.beginPath();
          ge.moveTo(0, y);
          ge.lineTo(W, y);
          ge.stroke();
        }
        ge.setLineDash([]);
      }
      if (st.ridge) {
        ge.fillRect(W / 2 - 2, 0, 4, H);
      }
      emissiveMap = new THREE.CanvasTexture(e);
    }
    if (st.rune) {
      const e = document.createElement('canvas');
      e.width = W;
      e.height = H;
      const ge = e.getContext('2d');
      ge.fillStyle = '#000';
      ge.fillRect(0, 0, W, H);
      for (const ctx of [g, ge]) {
        ctx.strokeStyle = col(st.rune);
        ctx.lineWidth = 3;
        for (let x = 14; x < W; x += 42) {
          const y0 = H * 0.32,
            y1 = H * 0.68,
            ym = (y0 + y1) / 2;
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x + 9, ym);
          ctx.lineTo(x, y1);
          ctx.moveTo(x + 9, ym);
          ctx.lineTo(x + 19, ym - 11);
          ctx.stroke();
        }
      }
      emissiveMap = new THREE.CanvasTexture(e);
    }
    const map = new THREE.CanvasTexture(c);
    map.encoding = THREE.sRGBEncoding;
    map.anisotropy = 4;
    const out = { map, emissiveMap };
    armorTextures.set(key, out);
    return out;
  }
  function armorMaterial(THREE, a) {
    const t = armorTexture(THREE, a.style),
      metal = a.kind === 'metal';
    const m = new THREE.MeshStandardMaterial({
      map: t.map,
      metalness: metal ? 0.82 : 0.04,
      roughness: metal ? 0.3 : a.kind === 'cloth' ? 0.88 : 0.72,
      side: THREE.DoubleSide
    });
    if (metal) {
      m.envMap = envMap(THREE);
      m.envMapIntensity = 1.2;
    }
    if (t.emissiveMap) {
      m.emissiveMap = t.emissiveMap;
      m.emissive = new THREE.Color(...(a.style.rune || a.style.glow || a.style.diamonds));
      m.emissiveIntensity = a.style.rune ? 2.4 : a.style.diamonds ? 0.55 : 1.6;
    }
    return m;
  }

  // Coque rigide ajustée à un segment : rayon max de la tenue autour de l'axe de l'os, par tranche et par angle.
  const SHELLS = {
    chest: {
      bone: 'spine_03',
      from: ['spine_02', 'spine_03'],
      axis: 'neck_01',
      range: [0, 0.97],
      rings: 10,
      margin: 0.016
    },
    cuirass: {
      bone: 'spine_03',
      from: ['spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'],
      axis: 'neck_01',
      range: [0, 0.93],
      rings: 12,
      margin: 0.014
    },
    belt: {
      bone: 'pelvis',
      from: ['pelvis', 'spine_01'],
      axis: 'spine_01',
      range: [0.45, 0.75],
      rings: 2,
      margin: 0.02
    },
    vambrace_l: { bone: 'lowerarm_l', axis: 'hand_l', range: [0.3, 0.95], rings: 5, margin: 0.012 },
    vambrace_r: { bone: 'lowerarm_r', axis: 'hand_r', range: [0.3, 0.95], rings: 5, margin: 0.012 },
    rerebrace_l: { bone: 'upperarm_l', axis: 'lowerarm_l', range: [0.35, 0.85], rings: 4, margin: 0.012 },
    rerebrace_r: { bone: 'upperarm_r', axis: 'lowerarm_r', range: [0.35, 0.85], rings: 4, margin: 0.012 },
    cuisse_l: { bone: 'thigh_l', axis: 'calf_l', range: [0.25, 0.72], rings: 5, margin: 0.014 },
    cuisse_r: { bone: 'thigh_r', axis: 'calf_r', range: [0.25, 0.72], rings: 5, margin: 0.014 },
    greave_l: { bone: 'calf_l', axis: 'foot_l', range: [0.08, 0.7], rings: 5, margin: 0.014 },
    greave_r: { bone: 'calf_r', axis: 'foot_r', range: [0.08, 0.7], rings: 5, margin: 0.014 }
  };
  function fitShell(THREE, bones, fitMeshes, cfg, material, name) {
    const bone = bones[cfg.bone],
      axisBone = bones[cfg.axis];
    if (!bone || !axisBone) return null;
    const set = new Set((cfg.from || [cfg.bone]).map(n => bones[n]).filter(Boolean));
    const bp = new THREE.Vector3(),
      bq = new THREE.Quaternion(),
      bs = new THREE.Vector3();
    bone.matrixWorld.decompose(bp, bq, bs);
    const toLocal = new THREE.Matrix4().compose(bp, bq, new THREE.Vector3(1, 1, 1)).invert();
    const dir = axisBone.getWorldPosition(new THREE.Vector3()).applyMatrix4(toLocal).normalize();
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(toLocal),
      u1 = fwd.addScaledVector(dir, -fwd.dot(dir)).normalize(),
      u2 = new THREE.Vector3().crossVectors(dir, u1);
    const pts = [],
      v = new THREE.Vector3();
    for (const [mi, m] of fitMeshes.entries()) {
      const geo = m.geometry,
        pos = geo.attributes.position,
        si = geo.attributes.skinIndex,
        sw = geo.attributes.skinWeight,
        bl = m.skeleton.bones;
      const mat = new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld),
        used = geo.index ? new Set(geo.index.array) : null;
      for (let i = 0; i < pos.count; i++) {
        if (used && !used.has(i)) continue;
        let best = 0,
          bw = -1;
        for (let k = 0; k < 4; k++) {
          const w = comp(sw, i, k);
          if (w > bw) {
            bw = w;
            best = comp(si, i, k);
          }
        }
        if (!set.has(bl[best])) continue;
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        const x = v.dot(u1),
          y = v.dot(u2);
        pts.push([v.dot(dir), Math.atan2(y, x), Math.hypot(x, y), mi, i]);
      }
    }
    if (pts.length < 30) return null;
    const ts = pts.map(p => p[0]).sort((a, b) => a - b),
      lo = ts[Math.floor(ts.length * 0.02)],
      hi = ts[Math.floor(ts.length * 0.98)];
    const t0 = lo + (hi - lo) * cfg.range[0],
      t1 = lo + (hi - lo) * cfg.range[1],
      RINGS = cfg.rings,
      SEG = 28,
      band = Math.max(((t1 - t0) / RINGS) * 0.75, 0.015);
    // La tenue recouverte par la plaque est retirée : sinon elle la traverse dès que le corps se plie.
    const hidden = fitMeshes.map(() => new Set());
    for (const p of pts) if (p[0] > t0 + 0.01 && p[0] < t1 - 0.01) hidden[p[3]].add(p[4]);
    fitMeshes.forEach((m, mi) => {
      const h = hidden[mi],
        ix = m.geometry.index;
      if (!h.size || !ix) return;
      const out = [];
      for (let i = 0; i < ix.count; i += 3) {
        const a = ix.getX(i),
          b = ix.getX(i + 1),
          c = ix.getX(i + 2);
        if (!(h.has(a) && h.has(b) && h.has(c))) out.push(a, b, c);
      }
      m.geometry.setIndex(out);
    });
    let prev = null;
    const pos = [],
      uv = [],
      idx = [];
    for (let j = 0; j <= RINGS; j++) {
      const tt = t0 + ((t1 - t0) * j) / RINGS,
        r = new Array(SEG).fill(0);
      for (const p of pts)
        if (Math.abs(p[0] - tt) < band) {
          const k = Math.floor(((p[1] + Math.PI) / (Math.PI * 2)) * SEG) % SEG;
          r[k] = Math.max(r[k], p[2]);
        }
      if (!r.some(Boolean) && prev) r.splice(0, SEG, ...prev);
      for (let pass = 0; pass < SEG; pass++)
        for (let k = 0; k < SEG; k++) if (!r[k]) r[k] = Math.max(r[(k + SEG - 1) % SEG], r[(k + 1) % SEG]);
      for (let pass = 0; pass < 2; pass++) {
        const c = r.slice();
        for (let k = 0; k < SEG; k++) r[k] = Math.max(c[k], (c[(k + SEG - 1) % SEG] + 2 * c[k] + c[(k + 1) % SEG]) / 4);
      }
      prev = r;
      const lip = j === 0 || j === RINGS ? 0.006 : 0; // bords roulés
      for (let k = 0; k <= SEG; k++) {
        const a = (((k % SEG) + 0.5) / SEG) * Math.PI * 2 - Math.PI,
          rr = r[k % SEG] + cfg.margin + lip;
        pos.push(
          ...new THREE.Vector3()
            .addScaledVector(dir, tt)
            .addScaledVector(u1, Math.cos(a) * rr)
            .addScaledVector(u2, Math.sin(a) * rr)
            .toArray()
        );
        uv.push(k / SEG, j / RINGS);
      }
    }
    for (let j = 0; j < RINGS; j++)
      for (let k = 0; k < SEG; k++) {
        const a = j * (SEG + 1) + k,
          b = a + SEG + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.position.copy(bp);
    mesh.quaternion.copy(bq);
    bone.attach(mesh);
    return mesh;
  }

  // Feuille découpée (alpha) pour l'armure du druide.
  let leafTex = null;
  function leafTexture(THREE) {
    if (leafTex) return leafTex;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(32, 4);
    g.bezierCurveTo(62, 40, 58, 96, 32, 124);
    g.bezierCurveTo(6, 96, 2, 40, 32, 4);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(32, 8);
    g.lineTo(32, 122);
    g.stroke();
    g.lineWidth = 1;
    for (let y = 30; y < 110; y += 14) {
      g.beginPath();
      g.moveTo(32, y);
      g.lineTo(14, y - 10);
      g.moveTo(32, y);
      g.lineTo(50, y - 10);
      g.stroke();
    }
    leafTex = new THREE.CanvasTexture(c);
    return leafTex;
  }

  // Épaulières à lames superposées, fixées aux clavicules (elles restent sur l'épaule quand le bras bouge).
  function buildPauldrons(THREE, bones, p, height, mat, trimMat) {
    const s = height / 1.8,
      sp = bones.spine_03.getWorldPosition(new THREE.Vector3());
    for (const side of ['l', 'r']) {
      const S = bones['upperarm_' + side].getWorldPosition(new THREE.Vector3()),
        out = Math.sign(S.x - sp.x) || 1,
        rnd = rng(side === 'l' ? 11 : 23);
      const g = new THREE.Group();
      g.name = 'Pauldron';
      const cover = p.cover || 1.2,
        base = (p.size || 0.13) * s;
      for (let i = 0; i < (p.layers || 3); i++) {
        const r = base * (1 - i * 0.13),
          cap = new THREE.Mesh(new THREE.SphereGeometry(r, 30, 12, 0, Math.PI * 2, 0, cover), mat);
        cap.scale.set(1.05, 0.62, 1.12);
        cap.position.set(out * i * 0.03 * s, -i * 0.042 * s, 0);
        cap.rotation.z = -out * (0.2 + i * 0.22);
        g.add(cap);
        if (trimMat) {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(cover), 0.007 * s, 6, 40), trimMat);
          rim.rotation.x = Math.PI / 2;
          rim.position.y = r * Math.cos(cover);
          cap.add(rim);
        }
        if (i === 0 && p.spikes)
          for (let k = 0; k < p.spikes; k++) {
            const sp = new THREE.Mesh(
              new THREE.ConeGeometry(0.018 * s, (0.11 - k * 0.02) * s, 8),
              p.spikeColor ? new THREE.MeshStandardMaterial({ color: p.spikeColor, roughness: 0.5 }) : trimMat || mat
            );
            const a = (k - (p.spikes - 1) / 2) * 0.45;
            sp.position.set(
              Math.sin(a) * r * 0.35,
              r * 0.62,
              Math.cos(a) * r * 0.35 * 0 + (k - (p.spikes - 1) / 2) * 0.045 * s
            );
            sp.rotation.z = -out * 0.35;
            cap.add(sp);
          }
      }
      if (p.bigSpikes) {
        const spikeMat = trimMat
          ? new THREE.MeshStandardMaterial({
              color: 0xd8dde6,
              metalness: 0.9,
              roughness: 0.2,
              envMap: envMap(THREE),
              envMapIntensity: 1.5
            })
          : mat;
        for (let k = 0; k < p.bigSpikes; k++) {
          const f = k / (p.bigSpikes - 1),
            len = (0.2 + 0.16 * Math.sin(f * Math.PI)) * s,
            cone = new THREE.Mesh(new THREE.ConeGeometry(0.032 * s, len, 6), spikeMat);
          cone.geometry.translate(0, len / 2, 0);
          const a = -1.1 + f * 2.2;
          cone.position.set(out * 0.02 * s, base * 0.4, a * base * 0.55);
          cone.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(out * (0.55 + 0.25 * Math.cos(a)), 0.9, Math.sin(a) * 0.55).normalize()
          );
          g.add(cone);
        }
        const plate = new THREE.Mesh(new THREE.SphereGeometry(base * 1.08, 24, 10, 0, Math.PI * 2, 0, 1.25), mat);
        plate.scale.set(1.25, 0.55, 1.2);
        plate.position.y = -0.03 * s;
        g.add(plate);
      }
      if (p.leaves) {
        const leafMat = c =>
          new THREE.MeshStandardMaterial({
            map: leafTexture(THREE),
            color: new THREE.Color(...c),
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            roughness: 0.7
          });
        const greens = [
          [0.3, 0.55, 0.16],
          [0.42, 0.62, 0.18],
          [0.22, 0.42, 0.12],
          [0.55, 0.62, 0.2]
        ].map(leafMat);
        for (let k = 0; k < 34; k++) {
          const th = rnd() * cover * 0.95,
            ph = rnd() * Math.PI * 2,
            r = base * 1.02,
            n = new THREE.Vector3(
              Math.sin(th) * Math.cos(ph) * 1.05,
              Math.cos(th) * 0.62,
              Math.sin(th) * Math.sin(ph) * 1.12
            );
          const leaf = new THREE.Mesh(
            new THREE.PlaneGeometry(0.05 * s, 0.1 * s).translate(0, 0.045 * s, 0),
            greens[k % 4]
          );
          leaf.position.copy(n).multiplyScalar(r);
          leaf.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            n
              .clone()
              .normalize()
              .add(new THREE.Vector3(0, -0.6, 0))
              .normalize()
          );
          leaf.rotateY(rnd() * Math.PI);
          g.add(leaf);
        }
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x7da23a, roughness: 0.8 });
        for (let k = 0; k < 26; k++) {
          const th = rnd() * 0.7,
            ph = rnd() * Math.PI * 2,
            h = (0.05 + rnd() * 0.06) * s,
            bl = new THREE.Mesh(new THREE.ConeGeometry(0.004 * s, h, 4).translate(0, h / 2, 0), grassMat);
          bl.position.set(
            Math.sin(th) * Math.cos(ph) * base,
            Math.cos(th) * base * 0.62,
            Math.sin(th) * Math.sin(ph) * base
          );
          bl.rotation.set((rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.8);
          g.add(bl);
        }
      }
      g.position.set(S.x + out * 0.012 * s, S.y + 0.035 * s, S.z);
      g.rotation.z = -out * 0.12;
      bones['clavicle_' + side].attach(g);
    }
  }

  // Masque de tissu sur le bas du visage (voleur) : copie skinnée du bas du visage, légèrement gonflée.
  function faceMask(THREE, body, L, color, metal) {
    const geo = body.geometry.clone(),
      pos = geo.attributes.position,
      nor = geo.attributes.normal,
      idx = geo.index,
      v = new THREE.Vector3();
    const inZone = i => {
      v.fromBufferAttribute(pos, i);
      return (
        v.y < L.eye.y - 0.028 && v.y > L.chin - 0.06 && v.z > L.eye.z - 0.085 + Math.max(0, L.eye.y - 0.06 - v.y) * 0.4
      );
    };
    const out = [];
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i),
        b = idx.getX(i + 1),
        c = idx.getX(i + 2);
      if (inZone(a) + inZone(b) + inZone(c) >= 2) out.push(a, b, c);
    }
    // le tissu tombe du nez : il ne suit pas les lèvres ni le menton
    let nose = null;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (Math.abs(v.x - L.cx) < 0.01 && v.y < L.eye.y && v.y > L.eye.y - 0.07 && (!nose || v.z > nose.z))
        nose = v.clone();
    }
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).addScaledVector(new THREE.Vector3().fromBufferAttribute(nor, i), 0.006);
      v.y = Math.min(v.y, L.eye.y - 0.03); // bord supérieur net, sous les yeux
      if (nose && v.y < nose.y)
        v.z = Math.max(v.z, nose.z + 0.004 - ((9 * (v.x - L.cx) ** 2) / 0.05) * 0.05 - 0.3 * (nose.y - v.y));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    geo.setIndex(out);
    const mask = new THREE.SkinnedMesh(
      geo,
      metal
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color(...color),
            metalness: 0.9,
            roughness: 0.22,
            envMap: envMap(THREE),
            envMapIntensity: 1.5,
            skinning: true
          })
        : new THREE.MeshStandardMaterial({ color: new THREE.Color(...color), roughness: 0.9, skinning: true })
    );
    mask.name = 'Mask';
    mask.frustumCulled = false;
    body.parent.add(mask);
    mask.bind(body.skeleton, body.bindMatrix);
    return mask;
  }

  // Repères du visage mesurés sur la tête (pose de bind).
  function headLandmarks(THREE, root, body) {
    const pos = body.geometry.attributes.position,
      idx = body.geometry.index,
      pts = [],
      seen = new Set();
    for (let i = 0; i < idx.count; i++) {
      const k = idx.getX(i);
      if (!seen.has(k)) {
        seen.add(k);
        pts.push(new THREE.Vector3().fromBufferAttribute(pos, k));
      }
    }
    let eyes = null;
    root.traverse(o => {
      if (o.isMesh && o.name === 'Eyes') eyes = o;
    });
    const eye = new THREE.Vector3(),
      eyeL = new THREE.Vector3(),
      eyeR = new THREE.Vector3();
    let nl = 0,
      nr = 0;
    if (eyes) {
      const ep = eyes.geometry.attributes.position;
      for (let i = 0; i < ep.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(ep, i);
        if (p.x > 0) {
          eyeL.add(p);
          nl++;
        } else {
          eyeR.add(p);
          nr++;
        }
      }
      eyeL.multiplyScalar(1 / Math.max(1, nl));
      eyeR.multiplyScalar(1 / Math.max(1, nr));
      eye.addVectors(eyeL, eyeR).multiplyScalar(0.5);
    }
    const cx = eye.x,
      top = Math.max(...pts.map(p => p.y));
    const front = pts.filter(p => Math.abs(p.x - cx) < 0.015 && p.y < eye.y - 0.03 && p.y > eye.y - 0.12);
    const chin = Math.min(...front.map(p => p.y)),
      mouthZ = Math.max(...front.filter(p => p.y < eye.y - 0.07).map(p => p.z));
    return { pts, eye, eyeL, eyeR, cx, top, chin, mouthZ, mouthY: chin + (eye.y - chin) * 0.33, eyes };
  }

  // Mort-vivant : la tête devient un crâne (orbites creuses, nez effacé, joues creusées, dents à nu), couleur os.
  function skullFace(THREE, body, L) {
    const geo = body.geometry,
      pos = geo.attributes.position,
      v = new THREE.Vector3(),
      orig = [];
    const isFront = p => p.z > L.eye.z - 0.05;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      orig.push(v.clone());
      if (!isFront(v)) continue;
      for (const e of [L.eyeL, L.eyeR]) {
        const d = Math.hypot(v.x - e.x, v.y - e.y);
        if (d < 0.026) v.z -= Math.pow(1 - d / 0.026, 1.4) * 0.016;
      }
      if (Math.abs(v.x - L.cx) < 0.018 && v.y < L.eye.y - 0.005 && v.y > L.eye.y - 0.06 && v.z > L.eye.z - 0.004)
        v.z -= (v.z - (L.eye.z - 0.004)) * 0.85;
      const ax = Math.abs(v.x - L.cx);
      if (ax > 0.022 && ax < 0.058 && v.y < L.eye.y - 0.03 && v.y > L.mouthY - 0.012) {
        const w = Math.min(1, (ax - 0.022) / 0.012) * Math.min(1, (0.058 - ax) / 0.012);
        v.x -= Math.sign(v.x - L.cx) * 0.007 * w;
        v.z -= 0.006 * w;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // Peinture "3D" de la texture : chaque pixel du visage connaît sa position sur la tête.
    const m = body.material,
      img = m.map && m.map.image;
    if (!img) return;
    const W = img.width || 1024,
      H = img.height || 1024,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, W, H);
    const id = g.getImageData(0, 0, W, H),
      d = id.data,
      src = d.slice(),
      uv = geo.attributes.uv,
      idx = geo.index;
    const bone = [0.88, 0.84, 0.72],
      dark = [0.06, 0.04, 0.04],
      teeth = [0.95, 0.92, 0.82];
    const shade = (p, lum) => {
      let col = bone.map(x => x * (0.5 + 0.62 * lum));
      const mix = (t, k) => {
        k = clamp(k, 0, 1);
        col = col.map((x, i) => x + (t[i] - x) * k);
      };
      if (isFront(p)) {
        for (const e of [L.eyeL, L.eyeR]) {
          const r = Math.hypot(p.x - e.x, p.y - e.y);
          mix(dark, (0.024 - r) / 0.008);
        }
        const ny = L.eye.y - 0.058,
          nh = 0.034;
        if (p.y > ny && p.y < ny + nh && Math.abs(p.x - L.cx) < (p.y - ny) * 0.33 + 0.002) mix(dark, 0.95);
        const ax = Math.abs(p.x - L.cx),
          my = p.y - L.mouthY;
        if (ax < 0.03 && Math.abs(my) < 0.011) {
          col = teeth.map(x => x * (0.75 + 0.3 * lum));
          const f = ((((p.x - L.cx) / 0.0062) % 1) + 1) % 1;
          if (f < 0.2 || Math.abs(my) < 0.0016) mix(dark, 0.9);
          if (Math.abs(my) > 0.008) mix(dark, 0.5);
        }
        if (ax > 0.024 && ax < 0.056 && p.y < L.eye.y - 0.03 && p.y > L.mouthY - 0.012) col = col.map(x => x * 0.72);
      }
      if (p.y < L.chin - 0.01) col = col.map(x => x * 0.62); // cou plus sombre
      return col;
    };
    const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      q = new THREE.Vector3();
    for (let t = 0; t < idx.count; t += 3) {
      const vi = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)],
        px = vi.map(i => [uv.getX(i) * W, uv.getY(i) * H]);
      vi.forEach((i, k) => P[k].copy(orig[i]));
      const x0 = Math.floor(Math.min(...px.map(p => p[0]))) - 1,
        x1 = Math.ceil(Math.max(...px.map(p => p[0]))) + 1,
        y0 = Math.floor(Math.min(...px.map(p => p[1]))) - 1,
        y1 = Math.ceil(Math.max(...px.map(p => p[1]))) + 1;
      const [[ax, ay], [bx, by], [cx2, cy]] = px,
        den = (by - cy) * (ax - cx2) + (cx2 - bx) * (ay - cy);
      if (Math.abs(den) < 1e-9) continue;
      for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
          const X = x + 0.5,
            Y = y + 0.5,
            w0 = ((by - cy) * (X - cx2) + (cx2 - bx) * (Y - cy)) / den,
            w1 = ((cy - ay) * (X - cx2) + (ax - cx2) * (Y - cy)) / den,
            w2 = 1 - w0 - w1;
          if (w0 < -0.08 || w1 < -0.08 || w2 < -0.08) continue;
          q.set(0, 0, 0).addScaledVector(P[0], w0).addScaledVector(P[1], w1).addScaledVector(P[2], w2);
          const o = (y * W + x) * 4,
            lum = (src[o] + src[o + 1] + src[o + 2]) / 765 / 0.62,
            col = shade(q, clamp(lum, 0, 1.3));
          d[o] = clamp(col[0] * 255, 0, 255);
          d[o + 1] = clamp(col[1] * 255, 0, 255);
          d[o + 2] = clamp(col[2] * 255, 0, 255);
        }
    }
    g.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.flipY = m.map.flipY;
    t.encoding = m.map.encoding;
    m.map = t;
    m.color.setRGB(1, 1, 1);
    if (L.eyes) L.eyes.visible = false; // seules les lueurs restent au fond des orbites
  }

  // Casque ouvert ajusté à la tête : calotte, protège-joues, couvre-nuque et nasal.
  function buildHelmet(THREE, bones, L, h, mat, trim) {
    const above = L.pts.filter(p => p.y > L.eye.y - 0.02),
      cz = (Math.min(...above.map(p => p.z)) + Math.max(...above.map(p => p.z))) / 2,
      cx = L.cx;
    const y0 = L.eye.y - 0.085,
      y1 = L.top + 0.018,
      RINGS = 14,
      SEG = 32,
      M = h.margin || 0.016,
      brow = L.eye.y + 0.012;
    const rings = [];
    for (let j = 0; j <= RINGS; j++) {
      const t = j / RINGS,
        y = y0 + (y1 - y0) * (1 - Math.pow(1 - t, 1.6)),
        r = new Array(SEG).fill(0);
      for (const p of L.pts)
        if (Math.abs(p.y - y) < 0.014) {
          const a = Math.atan2(p.x - cx, p.z - cz),
            k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * SEG) % SEG;
          r[k] = Math.max(r[k], Math.hypot(p.x - cx, p.z - cz));
        }
      for (let pass = 0; pass < SEG; pass++)
        for (let k = 0; k < SEG; k++) if (!r[k]) r[k] = Math.max(r[(k + SEG - 1) % SEG], r[(k + 1) % SEG]);
      for (let pass = 0; pass < 3; pass++) {
        const c = r.slice();
        for (let k = 0; k < SEG; k++) r[k] = (c[(k + SEG - 1) % SEG] + 2 * c[k] + c[(k + 1) % SEG]) / 4;
      }
      if (j > 0) for (let k = 0; k < SEG; k++) r[k] = Math.min(r[k] + M, rings[j - 1].r[k] + 0.02);
      else for (let k = 0; k < SEG; k++) r[k] += M;
      if (j === RINGS) r.fill(0); // sommet fermé
      rings.push({ y, r });
    }
    const pos = [],
      uv = [],
      idx = [];
    for (let j = 0; j <= RINGS; j++)
      for (let k = 0; k <= SEG; k++) {
        const a = (((k % SEG) + 0.5) / SEG) * Math.PI * 2 - Math.PI,
          rr = rings[j].r[k % SEG];
        pos.push(cx + Math.sin(a) * rr, rings[j].y, cz + Math.cos(a) * rr);
        uv.push(k / SEG, j / RINGS);
      }
    for (let j = 0; j < RINGS; j++)
      for (let k = 0; k < SEG; k++) {
        const a = ((k + 0.5) / SEG) * Math.PI * 2 - Math.PI,
          y = rings[j].y;
        // ouverture du visage : sous le front, l'avant reste dégagé ; les joues sont couvertes sur les côtés
        if (y < brow && Math.abs(a) < (y < L.eye.y - 0.035 ? 1.05 : 0.85)) continue;
        const i0 = j * (SEG + 1) + k,
          i1 = i0 + SEG + 1;
        idx.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const g = new THREE.Group();
    g.name = 'Helmet';
    g.add(new THREE.Mesh(geo, mat));
    const frontR = rings[Math.round(RINGS * 0.3)].r[(SEG / 2) | 0];
    const nasal = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.01), trim || mat);
    nasal.position.set(cx, L.eye.y - 0.012, cz + frontR - 0.004);
    g.add(nasal);
    bones.Head.attach(g);
    return g;
  }

  // Barbe de nain (demande de l'utilisateur : longue barbe tressée de nain de fantasy, style générique) :
  // masse épaisse des joues à la poitrine (s'écarte du torse en descendant), moustache tombante, grosse tresse
  // centrale en chevrons jusqu'à la ceinture, deux tresses latérales ; anneaux dorés et pointes en pinceau.
  // Tout est construit autour des repères du visage (L) puis attaché à l'os de la tête.
  function hairStrandTexture(THREE) {
    if (hairStrandTexture.tex) return hairStrandTexture.tex;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#d0d0d0';
    g.fillRect(0, 0, 128, 256);
    // mèches : traits verticaux ondulés, clairs et sombres
    for (let k = 0; k < 220; k++) {
      const x = Math.random() * 128,
        l = Math.random() > 0.5 ? 255 : 40;
      g.strokeStyle = `rgba(${l},${l},${l},${0.12 + Math.random() * 0.25})`;
      g.lineWidth = 0.6 + Math.random() * 1.8;
      g.beginPath();
      g.moveTo(x, -10);
      g.bezierCurveTo(x + 6 * Math.random() - 3, 80, x + 8 * Math.random() - 4, 170, x + 6 * Math.random() - 3, 266);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (hairStrandTexture.tex = t);
  }
  function dwarfBeard(THREE, root, bones, L, color) {
    const face = L.eye.y - L.chin, // hauteur œil → menton : unité de la barbe
      top = L.mouthY + face * 0.15,
      len = face * 2.7,
      tint = color
        .clone()
        .lerp(new THREE.Color(0.5, 0.13, 0.02), 0.6)
        .multiplyScalar(0.55), // roux cuivré profond
      hair = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.8, map: hairStrandTexture(THREE) }),
      dark = new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.65), roughness: 0.9 }),
      gold = new THREE.MeshStandardMaterial({ color: 0xd9aa4c, metalness: 0.9, roughness: 0.28 }),
      g = new THREE.Group();
    g.name = 'DwarfBeard';
    // barbe du pack : gardée courte pour couvrir joues et favoris
    root.traverse(o => {
      if (o.isMesh && /Beard/i.test(o.name)) o.material = hair;
    });
    // masse : anneaux elliptiques de haut en bas ; t = 0 sous le nez, 1 = pointe
    const ROWS = 22,
      COLS = 28,
      pos = [],
      uv = [],
      idx = [];
    const ring = t => {
      // large et bombée sur les joues, en pointe arrondie vers la poitrine
      const w = face * (0.95 + 0.3 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5)) * (1 - 0.78 * Math.pow(t, 2)),
        d = face * (0.5 + 0.3 * Math.sin(t * Math.PI)) * (1 - 0.5 * t * t),
        y = top - len * t,
        z = L.mouthZ - face * 0.42 + face * (0.5 * Math.sqrt(t) + 0.55 * t * t);
      return { w, d, y, z };
    };
    for (let r = 0; r <= ROWS; r++) {
      const t = r / ROWS,
        R = ring(t);
      for (let c = 0; c <= COLS; c++) {
        const a = (c / COLS) * Math.PI * 2,
          wav = 1 + 0.06 * Math.sin(a * 7 + t * 9); // mèches en relief
        pos.push(L.cx + Math.sin(a) * R.w * wav, R.y, R.z + Math.cos(a) * R.d * wav);
        uv.push((c / COLS) * 3, t * 2);
      }
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const a = r * (COLS + 1) + c,
          b = a + COLS + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mass = new THREE.Mesh(geo, hair);
    mass.name = 'Beard_Mass';
    g.add(mass);
    // moustache : deux mèches épaisses qui tombent de part et d'autre de la bouche
    const strand = (pts, r0, r1, mat) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))),
        tube = new THREE.TubeGeometry(curve, 24, 1, 10, false),
        tp = tube.attributes.position,
        v = new THREE.Vector3(),
        SEG = 25;
      // rayon dégressif r0 → r1 le long de la mèche
      for (let i = 0; i < tp.count; i++) {
        const k = Math.floor(i / 11) / (SEG - 1),
          c = curve.getPoint(Math.min(1, k));
        v.fromBufferAttribute(tp, i)
          .sub(c)
          .multiplyScalar(r0 + (r1 - r0) * k);
        tp.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
      }
      tube.computeVertexNormals();
      return new THREE.Mesh(tube, mat);
    };
    const zf = t => ring(t).z + ring(t).d * 0.9;
    for (const s of [-1, 1]) {
      g.add(
        strand(
          [
            [L.cx + s * face * 0.05, L.mouthY + face * 0.2, L.mouthZ + face * 0.12],
            [L.cx + s * face * 0.42, L.mouthY + face * 0.12, L.mouthZ + face * 0.12],
            [L.cx + s * face * 0.62, L.mouthY - face * 0.3, zf(0.12)],
            [L.cx + s * face * 0.6, top - len * 0.42, zf(0.42)]
          ],
          face * 0.16,
          face * 0.05,
          hair
        )
      );
    }
    // tresse : maillons en chevrons alternés, anneaux dorés, pointe en pinceau
    const braid = (x, y0, z0, n, size, rings) => {
      const b = new THREE.Group();
      for (let k = 0; k < n; k++) {
        const sz = size * (1 - (k / n) * 0.35),
          y = y0 - k * sz * 1.25,
          z = z0 + Math.min(k, 3) * sz * 0.35 - Math.max(0, k - 6) * sz * 0.12; // revient contre le ventre
        for (const s of [-1, 1]) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(sz, 10, 8), k % 2 ? hair : dark);
          m.scale.set(0.62, 1.15, 0.55);
          m.position.set(x + s * sz * 0.36, y - (s > 0 ? sz * 0.6 : 0), z);
          m.rotation.z = -s * 0.75;
          b.add(m);
        }
        if (rings.includes(k)) {
          const g2 = new THREE.Mesh(new THREE.CylinderGeometry(sz * 0.95, sz * 0.95, sz * 0.75, 14), gold);
          g2.position.set(x, y - sz * 0.3, z);
          b.add(g2);
        }
      }
      const yEnd = y0 - n * size * 1.15,
        tip = new THREE.Mesh(new THREE.ConeGeometry(size * 0.75, size * 2.6, 10), hair);
      tip.rotation.x = Math.PI;
      tip.position.set(x, yEnd - size * 0.9, z0 + 3 * size * 0.35 - Math.max(0, n - 7) * size * 0.1);
      b.add(tip);
      return b;
    };
    // grosse tresse centrale (part de la barbe, descend jusqu'à la ceinture) ; deux tresses latérales plus courtes
    const tipR = ring(0.82);
    g.add(braid(L.cx, tipR.y + face * 0.2, tipR.z + tipR.d * 0.5, 16, face * 0.2, [0, 5, 10, 14]));
    for (const s of [-1, 1]) {
      const R = ring(0.5);
      g.add(braid(L.cx + s * face * 0.62, R.y, zf(0.5) - face * 0.05, 5, face * 0.13, [0]));
    }
    bones.Head.attach(g);
  }

  function buildArmor(THREE, root, body, bones, a, height, fit, L) {
    const mat = armorMaterial(THREE, a.mat),
      trim = a.trim
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color(...a.trim),
            metalness: 0.85,
            roughness: 0.3,
            envMap: envMap(THREE),
            envMapIntensity: 1.2
          })
        : null;
    for (const n of a.shells || [])
      for (const k of [n, n + '_l', n + '_r'])
        if (SHELLS[k])
          fitShell(
            THREE,
            bones,
            fit,
            a.thick ? { ...SHELLS[k], margin: SHELLS[k].margin * a.thick } : SHELLS[k],
            a.shellMat && a.shellMat[n] ? armorMaterial(THREE, a.shellMat[n]) : mat,
            'Armor_' + k
          );
    if (a.pauldron)
      buildPauldrons(
        THREE,
        bones,
        a.pauldron,
        height,
        a.pauldron.mat ? armorMaterial(THREE, a.pauldron.mat) : mat,
        trim
      );
    if (a.mask) faceMask(THREE, body, L, a.mask, a.maskMetal);
    if (a.helmet) buildHelmet(THREE, bones, L, a.helmet, armorMaterial(THREE, a.helmet.mat || a.mat), trim);
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
            recolorTexture(THREE, m.map, kit.palette, 1024, kit.sex === 'M' && /Peasant/i.test(m.name))
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
    const robeMesh = kit.robe ? buildRobe(THREE, body, bones, kit.robe, fit) : null;
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
