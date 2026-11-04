(function (root) {
  'use strict';
  // Personnages : tête et traits de race (oreilles, défenses, repères du visage, crâne du mort-vivant, barbe du nain).
  // Chargé avant builder.js ; partage ses fonctions par root.CharacterParts.
  const P = (root.CharacterParts = root.CharacterParts || {});
  const { clamp, mount } = P;

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
    // barbe du pack : gardée courte pour couvrir joues et favoris. Elle est skinnée : son matériau doit l'être aussi
    // (three r128), sinon elle reste figée en pose de repos pendant que la tête bouge (« barbe dans le vide »).
    const skinnedHair = Object.assign(hair.clone(), { skinning: true });
    root.traverse(o => {
      if (o.isMesh && /Beard/i.test(o.name)) o.material = o.isSkinnedMesh ? skinnedHair : hair;
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
  // Paupières fermées (étourdi) : une coque couleur de peau sur chaque œil, attachée à la tête, cachée par défaut ; le
  // rendu l'affiche pendant l'étourdissement (hfCloseEyes, render/hero_anim.js). Mesurées sur le maillage des yeux.
  function eyelids(THREE, root, body, bones, skinColor) {
    let eyes = null;
    root.traverse(o => {
      if (o.isMesh && o.name === 'Eyes') eyes = o;
    });
    if (!eyes || !bones.Head) return;
    root.updateMatrixWorld(true);
    const toBody = new THREE.Matrix4().copy(body.matrixWorld).invert().multiply(eyes.matrixWorld),
      pos = eyes.geometry.attributes.position,
      sides = [[], []];
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toBody);
      sides[v.x < 0 ? 0 : 1].push(v);
    }
    const lid = new THREE.MeshStandardMaterial({ color: skinColor.clone().multiplyScalar(0.9), roughness: 0.85 });
    for (const pts of sides) {
      if (!pts.length) continue;
      const cen = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length),
        r = Math.max(...pts.map(p => p.distanceTo(cen))),
        m = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 16, 10), lid);
      m.name = 'Eyelid';
      m.scale.set(1.05, 0.95, 0.9);
      m.position.copy(cen);
      m.visible = false;
      bones.Head.attach(m);
    }
  }
  Object.assign(P, { headFeatures, headLandmarks, skullFace, dwarfBeard, eyelids });
})(typeof globalThis !== 'undefined' ? globalThis : this);
