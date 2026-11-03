(function (root) {
  'use strict';
  // Personnages : robes, capes et tabards (tissu procédural, emblèmes, mouvement de la cape).
  // Chargé avant builder.js ; partage ses fonctions par root.CharacterParts.
  const P = (root.CharacterParts = root.CharacterParts || {});
  const { clamp, bodyProfile, extremeZ, rng } = P;

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
  Object.assign(P, { buildRobe, buildCape, buildTabard });
})(typeof globalThis !== 'undefined' ? globalThis : this);
