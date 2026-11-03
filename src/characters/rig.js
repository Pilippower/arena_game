(function (root) {
  'use strict';
  // Personnages : outils de base partagés (couleurs, recoloration des tenues, squelette, fixation d'objets sur un os, profils du corps, pseudo-aléatoire, reflets métalliques).
  // Chargé avant builder.js ; partage ses fonctions par root.CharacterParts.
  const P = (root.CharacterParts = root.CharacterParts || {});

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
  Object.assign(P, {
    rgbToHsl,
    mount,
    handGrip,
    extremeZ,
    backMount,
    envMap,
    clamp,
    bodyProfile,
    rng,
    comp,
    recolorTexture,
    keepOnlyBones,
    bindToSkeleton,
    collectPoints
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
