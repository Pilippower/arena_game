(function (root) {
  'use strict';
  // Personnages : armures procédurales ajustées par os (textures de métal, coques, épaulières, masque, casque).
  // Chargé avant builder.js ; partage ses fonctions par root.CharacterParts.
  const P = (root.CharacterParts = root.CharacterParts || {});
  const { clamp, comp, rng, envMap } = P;

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
  Object.assign(P, { buildArmor });
})(typeof globalThis !== 'undefined' ? globalThis : this);
