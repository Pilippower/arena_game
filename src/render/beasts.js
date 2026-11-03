'use strict';
// Formes animales du druide (panthère d'ombre, ours de givre : maillage, fourrure, runes, animation) et mouton du Polymorph.
// Mouton de la Métamorphose : laine en boules, tête et pattes sombres ; les pattes s'animent quand il marche.
// Bêtes du druide (designs originaux dans le style des références de l'utilisateur) :
// - félin : panthère d'ombre, fourrure indigo, yeux violets lumineux, croissant de lune sur l'épaule, collier
//   de perles violettes, bracelets de cuir, longue queue ;
// - ours : ours de givre massif, fourrure blanche qui fonce vers le bas des pattes, cristaux de glace bleus,
//   runes bleues lumineuses, crinière en pointes, griffes de glace, tresses de fourrure.
// Corps, cou, tête, pattes et queue sont des « lofts » (sections arrondies le long d'un trajet) : silhouette
// continue. Couleurs par sommet (dos, ventre, bas des pattes) × texture de poils ; runes en carte émissive.
// Structure lue par hfAnimateBeast : userData.legs (pivot + knee + front), head, headZ, body, tail, kind.
// Sections lissées : interpolation Catmull-Rom (centre, largeur, hauteurs) entre les sections données, pour des
// volumes arrondis (sans arêtes entre deux sections).
function beastSmooth(secs, sub = 4) {
  const num = s => [...s.c, s.w, s.h, s.ht ?? s.h, s.hb ?? s.h, s.e || 2],
    A = secs.map(num),
    cr = (a, b, c, d, t) =>
      0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t),
    out = [];
  for (let i = 0; i < A.length - 1; i++)
    for (let k = 0; k < sub; k++) {
      const t = k / sub,
        a = A[Math.max(0, i - 1)],
        b = A[i],
        c = A[i + 1],
        d = A[Math.min(A.length - 1, i + 2)],
        v = b.map((_, j) => cr(a[j], b[j], c[j], d[j], t));
      out.push({
        c: v.slice(0, 3),
        w: Math.max(0.003, v[3]),
        h: Math.max(0.003, v[4]),
        ht: Math.max(0.003, v[5]),
        hb: Math.max(0.003, v[6]),
        e: v[7]
      });
    }
  const L = A[A.length - 1];
  out.push({ c: L.slice(0, 3), w: L[3], h: L[4], ht: L[5], hb: L[6], e: L[7] });
  return out;
}
function beastLoft(secs, mat, opt = {}) {
  secs = beastSmooth(secs, opt.sub || 4);
  const N = opt.n || 28,
    V = THREE.Vector3,
    C = secs.map(s => new V(...s.c)),
    pos = [],
    col = [],
    uv = [],
    idx = [];
  for (let i = 0; i < secs.length; i++) {
    const t = C[Math.min(i + 1, C.length - 1)]
        .clone()
        .sub(C[Math.max(i - 1, 0)])
        .normalize(),
      ref = Math.abs(t.y) < 0.9 ? new V(0, 1, 0) : new V(0, 0, 1),
      sd = new V().crossVectors(ref, t).normalize(),
      up = new V().crossVectors(t, sd),
      s = secs[i],
      e = s.e || 2;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2,
        ca = Math.cos(a),
        sa = Math.sin(a),
        x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e) * s.w,
        y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e) * (sa > 0 ? (s.ht ?? s.h) : (s.hb ?? s.h)),
        p = C[i].clone().addScaledVector(sd, x).addScaledVector(up, y);
      pos.push(p.x, p.y, p.z);
      col.push(...(opt.color ? opt.color(p, sa, i / (secs.length - 1)) : [1, 1, 1]));
      uv.push(k / N, i / (secs.length - 1));
    }
  }
  for (let i = 0; i < secs.length - 1; i++)
    for (let k = 0; k < N; k++) {
      const a = i * (N + 1) + k,
        b = a + N + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  // extrémités bouchées (sinon un trou laissait voir à travers la bête, ex. l'arrière de l'ours)
  for (const ring of [0, secs.length - 1]) {
    const c = pos.length / 3;
    pos.push(...C[ring].toArray());
    col.push(...col.slice(ring * (N + 1) * 3, ring * (N + 1) * 3 + 3));
    uv.push(0.5, ring ? 1 : 0);
    for (let k = 0; k < N; k++) {
      const a = ring * (N + 1) + k;
      if (ring) idx.push(c, a, a + 1);
      else idx.push(c, a + 1, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nr = geo.attributes.normal;
  for (let i = 0; i < secs.length; i++) {
    const a = i * (N + 1),
      b = a + N,
      x = nr.getX(a) + nr.getX(b),
      y = nr.getY(a) + nr.getY(b),
      z = nr.getZ(a) + nr.getZ(b),
      l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l);
    nr.setXYZ(b, x / l, y / l, z / l);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.loft = true;
  return mesh;
}
// Fourrure en « coques » : copies de chaque volume poussées le long des normales, découpées en mèches par une carte
// de bruit (alphaTest croissant vers l'extérieur) : vrai relief de poils, sans tri de transparence.
function beastStrandTexture() {
  if (beastStrandTexture.t) return beastStrandTexture.t;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d'),
    id = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = Math.random() ** 0.7 * 255;
    id.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 14);
  t.magFilter = THREE.NearestFilter;
  return (beastStrandTexture.t = t);
}
function beastFurShells(root, len, layers = 4) {
  const lofts = [];
  root.traverse(o => o.userData?.loft && lofts.push(o));
  for (const m of lofts)
    for (let k = 1; k <= layers; k++) {
      const f = k / layers,
        geo = m.geometry.clone(),
        pos = geo.attributes.position,
        nr = geo.attributes.normal;
      for (let i = 0; i < pos.count; i++)
        pos.setXYZ(
          i,
          pos.getX(i) + nr.getX(i) * len * f,
          pos.getY(i) + nr.getY(i) * len * f,
          pos.getZ(i) + nr.getZ(i) * len * f
        );
      const mat = m.material.clone();
      mat.alphaMap = beastStrandTexture();
      mat.alphaTest = 0.25 + f * 0.6;
      mat.color = new THREE.Color(1, 1, 1).multiplyScalar(0.9 + f * 0.25); // pointes des poils plus claires
      mat.emissiveMap = null;
      mat.emissive = new THREE.Color(0);
      const sh = new THREE.Mesh(geo, mat);
      sh.userData.shell = true;
      m.add(sh);
    }
}
// Couleur unie par sommet pour une géométrie simple (oreilles, pattes, touffes) portée par un matériau à couleurs de sommets.
function beastTint(geo, c) {
  const n = geo.attributes.position.count,
    a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(c, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
// Texture de poils (traits fins dans le sens du loft).
function beastFurTexture() {
  if (beastFurTexture.t) return beastFurTexture.t;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const v = (150 + Math.random() * 105) | 0,
      x = Math.random() * 512,
      y = Math.random() * 512;
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    g.lineWidth = 0.6 + Math.random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y + 6 + Math.random() * 10);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (beastFurTexture.t = t);
}
// Runes lumineuses (glyphes anguleux originaux) aux positions [u, v, taille] de la carte du loft.
function beastRuneTexture(spots) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#fff';
  g.lineCap = 'square';
  for (const [u, v, s] of spots) {
    const x = u * 512,
      y = v * 512,
      k = s * 512;
    g.lineWidth = Math.max(2, k * 0.12);
    g.beginPath();
    g.moveTo(x, y - k * 0.5);
    g.lineTo(x, y + k * 0.5);
    g.moveTo(x, y - k * 0.2);
    g.lineTo(x + k * 0.35, y - k * 0.45);
    g.moveTo(x, y + k * 0.05);
    g.lineTo(x - k * 0.35, y - k * 0.2);
    g.moveTo(x - k * 0.3, y + k * 0.5);
    g.lineTo(x + k * 0.3, y + k * 0.5);
    g.lineTo(x + k * 0.3, y + k * 0.25);
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
// Halo additif (yeux, perles, croissant).
function beastGlow(color, size) {
  if (!beastGlow.tex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'),
      gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    beastGlow.tex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: beastGlow.tex,
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    })
  );
  s.scale.setScalar(size);
  return s;
}
function hfMakeBeast(kind) {
  const cat = kind === 'cat',
    g = new THREE.Group(),
    lin = c => new THREE.Color(c).convertSRGBToLinear(),
    rgb = c => lin(c).toArray(),
    mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
    V = (...a) => new THREE.Vector3(...a),
    // double face : aucune surface ne disparaît selon l'angle de vue
    fur = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: beastFurTexture(),
      roughness: 0.85,
      side: THREE.DoubleSide
    });
  // fourrure : dos (haut), flancs, ventre (bas), bas des pattes (selon la hauteur au sol)
  const P = cat
    ? { back: rgb(0x3b3366), side: rgb(0x241f3e), belly: rgb(0x2e2948), low: rgb(0x18142a), glow: 0xc77dff }
    : { back: rgb(0xf4f8ff), side: rgb(0xd8e2f2), belly: rgb(0xb4bfd6), low: rgb(0x2a2d3c), glow: 0x3d9bff };
  const furColor =
    (y0 = 0, lowFrom = cat ? 0.22 : 0.55) =>
    (p, sa) => {
      let c = sa > 0 ? mix(P.side, P.back, sa) : mix(P.side, P.belly, -sa);
      const h = p.y + y0;
      if (h < lowFrom) c = mix(c, P.low, Math.min(1, (lowFrom - h) / (cat ? 0.25 : 0.35)));
      return c;
    };
  const dark = new THREE.MeshStandardMaterial({ color: lin(cat ? 0x15111f : 0x1d1f29), roughness: 0.6 }),
    bone = new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.4 }),
    leather = new THREE.MeshStandardMaterial({ color: lin(0x3a2616), roughness: 0.75 }),
    glowM = new THREE.MeshBasicMaterial({ color: cat ? 0xb45cff : P.glow }),
    ice = new THREE.MeshStandardMaterial({
      color: lin(0x3a8dff),
      emissive: lin(0x1550ff),
      emissiveIntensity: 0.9,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.92,
      flatShading: true
    });
  const add = (m, parent = g) => (parent.add(m), m),
    mesh = (geo, mat, [x, y, z], parent = g) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      return add(m, parent);
    },
    glow = (pos, color, size, parent = g) => {
      const h = beastGlow(color, size);
      h.position.copy(pos);
      return add(h, parent);
    };
  // ---------- corps (axe z vers l'avant) ----------
  const body = new THREE.Group();
  g.add(body);
  const S = (z, y, w, h, o = {}) => ({ c: [0, y, z], w, h, ...o });
  const bodySecs = cat
    ? [
        S(-0.8, 0.8, 0.02, 0.02),
        S(-0.76, 0.8, 0.11, 0.11),
        S(-0.64, 0.8, 0.19, 0.19, { hb: 0.21 }),
        S(-0.46, 0.78, 0.16, 0.15, { hb: 0.17 }),
        S(-0.24, 0.77, 0.15, 0.13, { hb: 0.14 }),
        S(0, 0.79, 0.17, 0.16, { hb: 0.22 }),
        S(0.22, 0.82, 0.21, 0.19, { hb: 0.3 }),
        S(0.4, 0.86, 0.19, 0.18, { hb: 0.26 }),
        S(0.55, 0.9, 0.15, 0.15),
        S(0.66, 0.93, 0.13, 0.13),
        S(0.72, 0.95, 0.02, 0.02)
      ]
    : [
        S(-0.82, 1.0, 0.05, 0.05),
        S(-0.76, 1.0, 0.3, 0.3),
        S(-0.58, 1.0, 0.42, 0.4, { hb: 0.44 }),
        S(-0.32, 1.03, 0.45, 0.42, { hb: 0.48 }),
        S(-0.05, 1.1, 0.5, 0.47, { hb: 0.5 }),
        S(0.2, 1.18, 0.56, 0.54, { ht: 0.62 }),
        S(0.42, 1.18, 0.5, 0.5, { hb: 0.52 }),
        S(0.6, 1.16, 0.4, 0.42),
        S(0.74, 1.18, 0.3, 0.32),
        S(0.84, 1.2, 0.06, 0.06)
      ];
  const bodyFur = fur.clone();
  if (!cat) {
    // runes sur les flancs (u ≈ 0 et 0,5 : côtés) au niveau des épaules et des hanches
    bodyFur.emissiveMap = beastRuneTexture([
      [0.04, 0.62, 0.09],
      [0.96, 0.62, 0.09],
      [0.46, 0.62, 0.09],
      [0.54, 0.62, 0.09],
      [0.03, 0.3, 0.07],
      [0.47, 0.3, 0.07]
    ]);
    bodyFur.emissive = new THREE.Color(P.glow);
    bodyFur.emissiveIntensity = 0.85;
  }
  add(beastLoft(bodySecs, bodyFur, { color: furColor() }), body);
  // ---------- tête (groupe à la base du crâne, avance pendant les coups) ----------
  const hp = cat ? V(0, 0.97, 0.78) : V(0, 1.28, 0.86),
    head = new THREE.Group();
  head.position.copy(hp);
  g.add(head);
  const H = (z, y, w, h, o = {}) => ({ c: [0, y - hp.y, z - hp.z], w, h, ...o });
  const headSecs = cat
    ? [
        H(0.68, 0.98, 0.02, 0.02),
        H(0.7, 0.985, 0.12, 0.11),
        H(0.76, 0.99, 0.16, 0.13, { hb: 0.13 }),
        H(0.83, 0.985, 0.15, 0.12, { hb: 0.115 }),
        H(0.88, 0.97, 0.12, 0.1, { hb: 0.09 }),
        H(0.92, 0.945, 0.08, 0.06, { hb: 0.07 }),
        H(0.955, 0.935, 0.06, 0.045),
        H(0.97, 0.935, 0.02, 0.02)
      ]
    : [
        H(0.74, 1.3, 0.05, 0.05),
        H(0.78, 1.31, 0.26, 0.24),
        H(0.9, 1.31, 0.3, 0.26, { hb: 0.28 }),
        H(1.02, 1.27, 0.23, 0.2),
        H(1.12, 1.21, 0.15, 0.13, { hb: 0.14 }),
        H(1.21, 1.19, 0.12, 0.1),
        H(1.26, 1.19, 0.04, 0.04)
      ];
  const headFur = fur.clone();
  if (!cat) {
    headFur.emissiveMap = beastRuneTexture([[0.25, 0.42, 0.14]]); // rune au front (u = 0,25 : dessus)
    headFur.emissive = new THREE.Color(P.glow);
    headFur.emissiveIntensity = 0.9;
  }
  const headMesh = add(beastLoft(headSecs, headFur, { color: furColor(hp.y) }), head);
  // point de la surface du visage devant (x, y) : rayon lancé de l'avant sur la géométrie de la tête
  const faceZ = (x, y) => {
    const hit = new THREE.Raycaster(V(x, y, 2), V(0, 0, -1)).intersectObject(
      new THREE.Mesh(headMesh.geometry),
      false
    )[0];
    return hit ? hit.point.z : 0;
  };
  const nose = mesh(
    new THREE.SphereGeometry(cat ? 0.022 : 0.045, 10, 8),
    dark,
    cat ? [0, -0.03, 0.185] : [0, -0.09, 0.39],
    head
  );
  nose.scale.set(1.3, 0.8, 1);
  for (const s of [-1, 1]) {
    // yeux en amande lumineux + halo
    const ex = s * (cat ? 0.058 : 0.11),
      ey = cat ? 0.04 : 0.06,
      ez = faceZ(ex, ey),
      // orbite sombre (contraste sur la fourrure) puis œil en amande lumineux, et un halo discret
      socket = mesh(new THREE.SphereGeometry(cat ? 0.03 : 0.04, 12, 8), dark, [ex, ey, ez], head),
      eye = mesh(new THREE.SphereGeometry(cat ? 0.026 : 0.032, 12, 8), glowM, [ex, ey, ez + 0.012], head);
    socket.scale.set(1.45, 0.75, 0.6);
    socket.rotation.z = eye.rotation.z = s * (cat ? -0.35 : -0.2);
    eye.scale.set(cat ? 1.05 : 1.25, cat ? 0.32 : 0.5, 0.55); // félin : fente
    glow(eye.position.clone().add(V(0, 0, 0.02)), P.glow, cat ? 0.09 : 0.1, head);
    if (cat) {
      const ear = mesh(beastTint(new THREE.ConeGeometry(0.055, 0.1, 6), P.back), fur, [s * 0.1, 0.12, -0.02], head);
      ear.scale.set(1, 1, 0.5);
      ear.rotation.set(-0.3, 0, -s * 0.45);
      // touffes des joues
      for (let k = 0; k < 3; k++) {
        const tuft = mesh(
          beastTint(new THREE.ConeGeometry(0.025, 0.09, 5), P.side),
          fur,
          [s * (0.15 + k * 0.01), -0.01 - k * 0.025, 0],
          head
        );
        tuft.rotation.set(0.6, 0, s * (1.6 + k * 0.25));
      }
      const fang = mesh(new THREE.ConeGeometry(0.008, 0.04, 6), bone, [s * 0.022, -0.07, 0.165], head);
      fang.rotation.x = Math.PI;
    } else {
      const ear = mesh(beastTint(new THREE.SphereGeometry(0.08, 12, 8), P.back), fur, [s * 0.2, 0.22, -0.02], head);
      ear.scale.set(1, 1, 0.55);
      const fang = mesh(new THREE.ConeGeometry(0.018, 0.08, 6), bone, [s * 0.06, -0.15, 0.33], head);
      fang.rotation.x = Math.PI;
    }
  }
  // ---------- pattes : pivot à l'épaule / la hanche, genou ; deux lofts ----------
  g.userData.legs = [];
  const D = cat
    ? {
        front: {
          x: 0.11,
          y: 0.8,
          z: 0.26,
          up: 0.32,
          low: 0.43,
          sec: [0.1, 0.15, 0.075, 0.085, 0.075, 0.085, 0.055, 0.062]
        },
        hind: {
          x: 0.1,
          y: 0.8,
          z: -0.6,
          up: 0.34,
          low: 0.41,
          sec: [0.105, 0.2, 0.075, 0.09, 0.075, 0.09, 0.05, 0.056]
        },
        paw: [0.075, 0.04, 0.095]
      }
    : {
        front: { x: 0.3, y: 1.12, z: 0.38, up: 0.5, low: 0.52, sec: [0.24, 0.28, 0.17, 0.19, 0.17, 0.19, 0.14, 0.15] },
        hind: { x: 0.3, y: 1.0, z: -0.56, up: 0.45, low: 0.47, sec: [0.26, 0.34, 0.16, 0.2, 0.16, 0.2, 0.13, 0.15] },
        paw: [0.17, 0.075, 0.21]
      };
  const legSec = (y, w, h) => ({ c: [0, y, 0], w, h });
  for (const [front, s] of [
    [true, 1],
    [true, -1],
    [false, 1],
    [false, -1]
  ]) {
    const L = front ? D.front : D.hind,
      [w0, h0, w1, h1, w2, h2, w3, h3] = L.sec,
      pv = new THREE.Group();
    pv.position.set(s * L.x, L.y, L.z);
    g.add(pv);
    // ours : rune sur l'extérieur de l'avant-bras (u = 0 côté +x, 0,5 côté -x)
    let legFur = fur;
    if (!cat && front) {
      legFur = fur.clone();
      legFur.emissiveMap = beastRuneTexture([[s > 0 ? 0.02 : 0.48, 0.5, 0.18]]);
      legFur.emissive = new THREE.Color(P.glow);
      legFur.emissiveIntensity = 0.85;
    }
    add(
      beastLoft(
        // part de l'intérieur du corps (épaule / cuisse musclée), finit en boule au genou
        [
          legSec(cat ? 0.1 : 0.2, 0.01, 0.01),
          legSec(cat ? 0.09 : 0.18, w0 * 0.45, h0 * 0.45),
          legSec(cat ? 0.06 : 0.14, w0 * 0.85, h0 * 0.85),
          legSec(0.02, w0, h0),
          legSec(-L.up * 0.5, (w0 + w1) / 2, (h0 + h1) / 2),
          legSec(-L.up, w1, h1),
          legSec(-L.up - w1 * 0.6, w1 * 0.8, h1 * 0.8),
          legSec(-L.up - w1, 0.01, 0.01)
        ],
        legFur,
        { n: 16, color: furColor(L.y) }
      ),
      pv
    );
    const knee = new THREE.Group();
    knee.position.y = -L.up;
    pv.add(knee);
    add(
      beastLoft(
        [
          legSec(w2, 0.01, 0.01),
          legSec(w2 * 0.6, w2 * 0.8, h2 * 0.8),
          legSec(0, w2, h2),
          legSec(-L.low * 0.6, (w2 + w3) / 2, (h2 + h3) / 2),
          legSec(-L.low * 0.92, w3, h3),
          legSec(-L.low, w3 * 1.05, h3 * 1.1)
        ],
        fur,
        { n: 16, color: furColor(L.y - L.up) }
      ),
      knee
    );
    const paw = mesh(
      beastTint(new THREE.SphereGeometry(1, 14, 10), P.low),
      fur,
      [0, -L.low - D.paw[1] * 0.4, D.paw[2] * 0.25],
      knee
    );
    paw.scale.set(...D.paw);
    // griffes (os pour le félin, glace lumineuse pour l'ours)
    for (let c = -1.5; c <= 1.5; c++) {
      const claw = mesh(
        new THREE.ConeGeometry(D.paw[0] * 0.13, D.paw[2] * (cat ? 0.45 : 0.55), 5),
        cat ? bone : ice,
        [c * D.paw[0] * 0.5, -L.low - D.paw[1] * 0.6, D.paw[2] * 1.1],
        knee
      );
      claw.rotation.x = Math.PI / 2 + 0.5;
    }
    if (cat && front) {
      // bracelet de cuir au-dessus de la patte
      const band = mesh(
        new THREE.CylinderGeometry(w3 * 1.18, w3 * 1.18, 0.045, 14),
        leather,
        [0, -L.low * 0.8, 0],
        knee
      );
      band.scale.z = h3 / w3;
    }
    if (!cat) {
      // éclats de glace sur l'extérieur des avant-bras et des cuisses
      for (let k = 0; k < 3; k++) {
        const c = mesh(
          new THREE.OctahedronGeometry(1, 0),
          ice,
          front
            ? [s * (w2 + 0.02), -L.low * (0.35 + k * 0.15), -0.03 + k * 0.05]
            : [s * (w0 + 0.02), -0.05 - k * 0.1, -0.05 + k * 0.05],
          front ? knee : pv
        );
        c.scale.set(0.05, 0.2 - k * 0.04, 0.05);
        c.rotation.set(0.4, 0, -s * (0.9 + k * 0.2));
      }
    }
    pv.userData.knee = knee;
    pv.userData.front = front;
    g.userData.legs.push(pv);
  }
  if (cat) {
    // ---------- queue longue, croissant de lune, collier de perles ----------
    const tail = new THREE.Group();
    tail.position.set(0, 0.82, -0.76);
    g.add(tail);
    const secs = [];
    for (let k = 0; k <= 12; k++) {
      const q = k / 12;
      secs.push({
        c: [0, -0.35 * Math.sin(q * 2.2) + (q > 0.75 ? (q - 0.75) * 0.9 : 0), -q * 0.9],
        w: 0.05 - q * 0.025,
        h: 0.05 - q * 0.025,
        e: 2
      });
    }
    secs.push({ c: [0, 0.09, -0.93], w: 0.005, h: 0.005 });
    add(beastLoft(secs, fur, { n: 12, color: () => P.side }), tail);
    g.userData.tail = tail;
    for (const s of [-1, 1]) {
      const moon = mesh(
        new THREE.TorusGeometry(0.055, 0.011, 6, 20, Math.PI * 1.25),
        new THREE.MeshBasicMaterial({ color: 0xe8d8ff }),
        [s * 0.205, 0.87, 0.22]
      );
      moon.rotation.set(0, s * Math.PI * 0.5, Math.PI * 0.85);
      glow(moon.position.clone().add(V(s * 0.02, 0, 0)), 0xb48cff, 0.16);
    }
    const ring = mesh(new THREE.TorusGeometry(0.145, 0.014, 8, 28), leather, [0, 0.9, 0.6]);
    ring.rotation.x = -0.3;
    const beadM = new THREE.MeshBasicMaterial({ color: 0xd59bff });
    for (let k = -1; k <= 1; k++) {
      const top = V(k * 0.055, 0.77, 0.63 - Math.abs(k) * 0.02),
        len = k === 0 ? 0.12 : 0.08;
      mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 4), leather, [top.x, top.y - len / 2, top.z]);
      const bead = mesh(new THREE.SphereGeometry(0.02, 12, 8), beadM, [top.x, top.y - len - 0.015, top.z + 0.01]);
      glow(bead.position, P.glow, 0.09);
    }
  } else {
    // ---------- crinière en pointes, cristaux de glace dorsaux, tresses de fourrure ----------
    const maneM = new THREE.MeshStandardMaterial({ color: lin(0xe9effa), map: beastFurTexture(), roughness: 0.85 });
    for (let k = 0; k < 22; k++) {
      const a = ((k * 0.618) % 1) * 2 - 1, // réparti sans motif régulier
        z = 0.32 + ((k * 0.381) % 1) * 0.5,
        tuft = mesh(new THREE.ConeGeometry(0.09, 0.38, 6), maneM, [
          a * 0.42,
          1.62 - a * a * 0.25 + (z - 0.5) * 0.15,
          z
        ]);
      tuft.rotation.set(-1.35, 0, -a * 0.7);
    }
    for (const [x, y, z, l, rz] of [
      [0.14, 1.78, 0.2, 1.0, -0.25],
      [-0.16, 1.76, 0.14, 0.9, 0.3],
      [0.32, 1.66, 0.36, 0.62, -0.65],
      [-0.33, 1.64, 0.34, 0.6, 0.65],
      [0.06, 1.62, -0.16, 0.6, -0.1],
      [0.36, 1.5, 0.06, 0.48, -0.85],
      [-0.36, 1.48, 0.02, 0.46, 0.85],
      [0, 1.5, -0.45, 0.4, 0]
    ]) {
      const c = mesh(new THREE.OctahedronGeometry(1, 0), ice, [x, y, z]);
      c.scale.set(0.085, l / 2, 0.085);
      c.rotation.set(-0.85, 0, rz);
    }
    for (const s of [-1, 1]) {
      const b = new THREE.Group();
      b.position.set(s * 0.3, 1.38, 0.78);
      g.add(b);
      for (let k = 0; k < 6; k++)
        mesh(new THREE.SphereGeometry(0.055 - k * 0.004, 10, 8), maneM, [0, -k * 0.075, 0.02 * k], b).scale.set(
          1,
          1.3,
          1
        );
      for (const k of [1, 4])
        mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.035, 12), leather, [0, -k * 0.075, 0.02 * k], b);
      mesh(new THREE.ConeGeometry(0.05, 0.16, 8), maneM, [0, -0.52, 0.13], b).rotation.x = Math.PI;
    }
  }
  // aura druidique sous la bête
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(cat ? 0.55 : 0.75, cat ? 0.78 : 1.0, 40),
    new THREE.MeshBasicMaterial({
      color: P.glow,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.03;
  g.add(aura);
  if (!cat) head.scale.setScalar(1.2); // tête large de l'ours
  if (cat) g.scale.setScalar(1.15); // panthère : un peu plus grande que nature, lisible à distance
  g.userData.head = head;
  g.userData.headZ = head.position.z;
  g.userData.body = body;
  g.userData.kind = kind;
  g.userData.ice = cat ? null : ice;
  beastFurShells(g, cat ? 0.014 : 0.03);
  g.traverse(o => {
    if (o.isMesh) o.castShadow = false;
  });
  return g;
}
// Animation des bêtes (procédurale, à chaque image) :
// - repos : respiration (cage thoracique qui gonfle), tête qui regarde autour, transfert de poids, queue qui ondule ;
// - course : foulée en diagonale (avant gauche avec arrière droite), genou plié pendant le retour de la patte,
//   corps qui monte et descend deux fois par cycle et tangue, tête qui compense ;
// - attaque : le félin bondit les deux pattes en avant, l'ours se cabre et frappe d'une patte (en alternance) ;
// - étourdi : tête basse qui oscille.
function hfAnimateBeast(g, u, t) {
  const cat = g.userData.kind === 'cat',
    D = g.userData,
    mv = u.moving && !(u.stun > 0),
    ph = u.movePhase * (cat ? 1.25 : 1.05),
    atkT = u.action > 0 && u.actionType === 'melee' ? 1 - u.action / 0.36 : -1,
    atk = atkT >= 0 ? Math.sin(Math.min(1, atkT) * Math.PI) : 0,
    stun = u.stun > 0;
  if (atkT >= 0 && !D.atkOn) D.paw = (D.paw || 0) ^ 1;
  D.atkOn = atkT >= 0;
  // vitesse de transition entre repos et course (pas de saut brusque)
  D.mvK = (D.mvK || 0) + ((mv ? 1 : 0) - (D.mvK || 0)) * 0.15;
  const k = D.mvK,
    breath = Math.sin(t * (cat ? 2.4 : 1.7));
  D.legs.forEach((l, i) => {
    const front = l.userData.front,
      // diagonale : 0 = avant +x, 1 = avant -x, 2 = arrière +x, 3 = arrière -x
      p = ph + (i === 0 || i === 3 ? 0 : Math.PI),
      swing = Math.sin(p),
      lift = Math.max(0, Math.cos(p)); // phase de retour : la patte se plie
    let rx = swing * (cat ? 0.7 : 0.48) * k,
      knee = lift * (front ? -0.9 : 0.8) * k;
    // repos : légère flexion qui suit la respiration
    rx += (1 - k) * (front ? 0.03 : -0.03) * breath;
    if (atk) {
      if (cat && front) {
        rx -= atk * 1.5;
        knee += atk * -0.6;
      } else if (!cat && front && i % 2 === D.paw) {
        rx -= atk * 1.9;
        knee -= atk * 0.9;
      } else if (!front) rx += atk * (cat ? 0.5 : 0.25); // appui des pattes arrière
    }
    l.rotation.x = rx;
    l.rotation.z = !cat && front && atk && i % 2 === D.paw ? (i ? -1 : 1) * atk * 0.4 : 0;
    l.userData.knee.rotation.x = knee;
  });
  // corps : rebond de la foulée, tangage, respiration
  const bob = Math.abs(Math.sin(ph)) * (cat ? 0.07 : 0.045) * k;
  g.position.y = bob + (cat ? atk * 0.18 : 0);
  g.position.z = cat ? atk * 0.35 : atk * 0.08;
  g.rotation.x = Math.sin(ph * 2) * 0.035 * k - atk * (cat ? 0.2 : 0.32);
  g.rotation.z = (1 - k) * Math.sin(t * 0.55) * (cat ? 0.012 : 0.02); // transfert de poids au repos
  D.body.scale.set(1 + breath * 0.012, 1 + breath * (cat ? 0.025 : 0.035), 1 + breath * 0.008);
  // tête : regarde autour au repos, compense la foulée, s'avance à l'attaque, basse si étourdi
  const h = D.head;
  h.position.z = D.headZ + atk * (cat ? 0.12 : 0.18);
  h.position.y = D.headY ?? (D.headY = h.position.y);
  h.position.y = D.headY - bob * 0.6 + breath * 0.008;
  h.rotation.y = (1 - k) * (Math.sin(t * 0.37) * 0.32 + Math.sin(t * 1.3) * 0.05);
  h.rotation.x = stun
    ? 0.45 + Math.sin(t * 3) * 0.1
    : -Math.sin(ph * 2) * 0.05 * k - atk * 0.25 + (1 - k) * breath * 0.02;
  // queue qui ondule, glace qui scintille
  if (D.tail) {
    D.tail.rotation.y = Math.sin(t * (mv ? 5 : 1.4)) * (mv ? 0.18 : 0.35);
    D.tail.rotation.x = mv ? -0.15 : Math.sin(t * 0.8) * 0.08;
  }
  if (D.ice) D.ice.emissiveIntensity = 0.8 + Math.sin(t * 2.4) * 0.25;
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
