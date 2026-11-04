(function (root) {
  'use strict';
  // Personnages : lueurs et effets magiques (halos, feux follets, armes enchantées, yeux lumineux, orbes, effets de main, crânes flottants).
  // Chargé avant builder.js ; partage ses fonctions par root.CharacterParts.
  const P = (root.CharacterParts = root.CharacterParts || {});
  const { rgbToHsl, mount, handGrip, extremeZ } = P;

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
  // Feu follet : cœur brûlant, langues de flammes qui ondulent vers le haut, braises qui s'échappent, halo qui
  // respire. Uniquement des sprites additifs (aucune lumière ajoutée). update(t) à chaque image.
  const wispTextures = {};
  function wispTexture(THREE, kind) {
    if (wispTextures[kind]) return wispTextures[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (kind === 'flame') {
      // langue de flamme : goutte effilée vers le haut, plus claire à la base
      const gr = g.createRadialGradient(32, 46, 1, 32, 40, 30);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,.8)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(32, 1);
      g.bezierCurveTo(48, 22, 58, 44, 32, 63);
      g.bezierCurveTo(6, 44, 16, 22, 32, 1);
      g.fill();
    } else {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.3, 'rgba(255,255,255,.7)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }
    return (wispTextures[kind] = new THREE.CanvasTexture(c));
  }
  function wispSprite(THREE, kind, color, size, normal = false) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: wispTexture(THREE, kind),
        color,
        // normal : couleur vive même sur fond clair (l'additif blanchit sur l'herbe) ; additif pour ce qui brille
        blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      })
    );
    sp.scale.set(size, size, 1);
    return sp;
  }
  function flameWisp(THREE, c, size) {
    // couleur saturée (flammes vives, pas blanches) ; cœur à peine éclairci
    const fc = c.clone().offsetHSL(0, 0.35, -0.08),
      g = new THREE.Group(),
      hot = fc.clone().lerp(new THREE.Color(1, 1, 1), 0.3),
      halo = glowSprite(THREE, fc, size * 5),
      core = wispSprite(THREE, 'ember', hot, size * 0.9),
      tongues = [0, 1, 2].map(k => wispSprite(THREE, 'flame', k ? fc : hot, size, k > 0)),
      embers = [0, 1, 2, 3].map(() => wispSprite(THREE, 'ember', hot, size * 0.3));
    g.add(halo, ...tongues, core, ...embers);
    // cœur et braises dessinés après les flammes colorées (ils brillent par-dessus)
    tongues.forEach((sp, k) => (sp.renderOrder = k ? 1 : 2));
    for (const sp of [core, ...embers]) sp.renderOrder = 2;
    const update = t => {
      halo.material.opacity = 0.75 + Math.sin(t * 3.1) * 0.2;
      const p = 1 + Math.sin(t * 7) * 0.12;
      core.scale.set(size * 0.9 * p, size * 0.9 * p, 1);
      tongues.forEach((sp, k) => {
        const ph = k * 2.1,
          base = size * (k ? 1.9 : 1.3),
          f = 1 + Math.sin(t * 11 + ph) * 0.18 + Math.sin(t * 17.3 + ph * 1.7) * 0.1;
        sp.scale.set(base * (0.75 + 0.15 * Math.sin(t * 9 + ph)), base * 1.5 * f, 1);
        sp.position.set(Math.sin(t * 6 + ph) * size * 0.15, base * 0.45, 0);
        sp.material.rotation = Math.sin(t * 5 + ph) * 0.3;
        sp.material.opacity = k ? 1 : 0.7;
      });
      // braises : montent en spirale et s'éteignent, puis renaissent
      embers.forEach((sp, k) => {
        const life = (t * 0.85 + k / embers.length) % 1,
          a = k * 2.4 + Math.floor(t * 0.85 + k / embers.length) * 1.3;
        sp.position.set(
          Math.sin(a + life * 3) * size * 0.5,
          size * (0.3 + life * 2.6),
          Math.cos(a + life * 3) * size * 0.5
        );
        const z = size * 0.32 * (1 - life * 0.7);
        sp.scale.set(z, z, 1);
        sp.material.opacity = 1 - life;
      });
    };
    update(0);
    return { g, update, halo };
  }
  // Enchantement d'arme : chapelet de halos le long du tranchant (suit l'arme quelle que soit son orientation, un seul
  // halo allongé resterait vertical à l'écran), pulsation qui court le long de la lame, étincelles d'énergie qui filent
  // vers la pointe. path = points de la lame dans le repère de l'arme ; size = épaisseur de la lueur.
  function weaponEnchant(THREE, w, color, path, size) {
    const P = path.map(p => new THREE.Vector3(...p)),
      seg = P.slice(1).map((p, i) => p.distanceTo(P[i])),
      total = seg.reduce((a, b) => a + b, 0),
      at = f => {
        let d = f * total;
        for (let i = 0; i < seg.length; i++) {
          if (d <= seg[i] || i === seg.length - 1) return P[i].clone().lerp(P[i + 1], Math.min(1, d / seg[i]));
          d -= seg[i];
        }
      },
      hot = color.clone().lerp(new THREE.Color(1, 1, 1), 0.35),
      n = Math.max(3, Math.round(total / (size * 0.55))),
      beads = [],
      sparks = [];
    // sous chaque halo additif, une lueur colorée en mélange normal : la couleur tient même sur l'herbe claire
    const tint = color.clone().offsetHSL(0, 0.3, -0.12);
    for (let i = 0; i < n; i++) {
      const pos = at(i / (n - 1)),
        c = glowSprite(THREE, tint, size * 2.6),
        b = glowSprite(THREE, color, size * 2.2);
      c.material.blending = THREE.NormalBlending;
      c.material.opacity = 0.5;
      c.renderOrder = 1;
      b.renderOrder = 2;
      c.position.copy(pos);
      b.position.copy(pos);
      w.add(c, b);
      beads.push(b);
    }
    for (let i = 0; i < 6; i++) {
      const sp = wispSprite(THREE, 'ember', hot, size * 0.6);
      sp.renderOrder = 2;
      w.add(sp);
      sparks.push(sp);
    }
    beads[0].onBeforeRender = () => {
      const t = performance.now() / 1000;
      beads.forEach((b, i) => {
        const wave = 0.5 + 0.5 * Math.sin(t * 5 - (i / n) * 6);
        b.material.opacity = 0.55 + 0.4 * wave;
        const z = size * (1.9 + 0.7 * wave);
        b.scale.set(z, z, 1);
      });
      sparks.forEach((sp, i) => {
        const life = (t * 0.7 + i / sparks.length) % 1;
        sp.position.copy(at(life));
        sp.position.x += Math.sin(t * 9 + i * 2) * size * 0.25;
        sp.position.z += Math.cos(t * 7 + i * 3) * size * 0.25;
        sp.material.opacity = Math.sin(life * Math.PI);
      });
    };
  }

  // Décharges électriques intermittentes le long d'une arme (path = points de la lame, dans le repère de w ; size = taille
  // d'une perle, spread = écart maximal du zigzag autour de la lame) : toutes les
  // ELECTRIC_GAP[0] à ELECTRIC_GAP[1] s (au hasard), une décharge de ELECTRIC_BURST s fait courir ELECTRIC_ARCS éclairs
  // en zigzag (perles lumineuses additives) d'un bout à l'autre, qui se redessinent toutes les ~40 ms, puis tout s'éteint.
  // Uniquement des sprites (aucune lumière ajoutée) ; un sprite invisible (opacité 0) reste rendu pour cadencer l'effet.
  const ELECTRIC_GAP = [2.5, 6],
    ELECTRIC_BURST = 0.35,
    ELECTRIC_ARCS = 2,
    ELECTRIC_BEADS = 28;
  function electricArcs(THREE, w, path, color, size, spread) {
    const P = path.map(p => new THREE.Vector3(...p)),
      white = color.clone().lerp(new THREE.Color(1, 1, 1), 0.6),
      arcs = [];
    for (let a = 0; a < ELECTRIC_ARCS; a++) {
      const beads = [];
      for (let i = 0; i < ELECTRIC_BEADS; i++) {
        const b = glowSprite(THREE, i % 3 ? color : white, size);
        b.renderOrder = 3;
        b.visible = false;
        w.add(b);
        beads.push(b);
      }
      arcs.push(beads);
    }
    const clock = glowSprite(THREE, color, size);
    clock.material.opacity = 0;
    w.add(clock);
    const rnd = () => Math.random() * 2 - 1,
      along = f => {
        const k = f * (P.length - 1),
          i = Math.min(P.length - 2, Math.floor(k));
        return P[i].clone().lerp(P[i + 1], k - i);
      };
    let next = performance.now() / 1000 + ELECTRIC_GAP[0] * Math.random(),
      end = 0,
      redraw = 0;
    clock.onBeforeRender = () => {
      const t = performance.now() / 1000;
      if (t >= next) {
        end = t + ELECTRIC_BURST;
        next = end + ELECTRIC_GAP[0] + Math.random() * (ELECTRIC_GAP[1] - ELECTRIC_GAP[0]);
      }
      const on = t < end;
      if (!on) {
        if (arcs[0][0].visible) for (const beads of arcs) for (const b of beads) b.visible = false;
        return;
      }
      if (t < redraw) return;
      redraw = t + 0.04;
      for (const beads of arcs) {
        // zigzag : écart aléatoire autour de la lame, nul aux deux bouts
        let off = new THREE.Vector3();
        beads.forEach((b, i) => {
          const f = i / (beads.length - 1),
            amp = spread * Math.sin(Math.PI * f);
          off = off.multiplyScalar(0.4).add(new THREE.Vector3(rnd(), rnd() * 0.3, rnd()).multiplyScalar(amp));
          b.position.copy(along(f)).add(off);
          b.material.opacity = 0.85 + 0.15 * Math.random();
          const z = size * (0.7 + 0.6 * Math.random());
          b.scale.set(z, z, 1);
          b.visible = true;
        });
      }
    };
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

  // Feux follets qui gravitent autour de la taille d'un lanceur de sorts (ils suivent le personnage, pas ses os).
  function buildOrbs(THREE, root, bones, cfg, height) {
    const s = height / 1.8,
      g = new THREE.Group();
    g.name = 'Orbs';
    const c = new THREE.Color(...cfg.color),
      hy = bones.spine_01.getWorldPosition(new THREE.Vector3()).y;
    // feux follets (flammes, braises) suivis d'une traînée de comète le long de leur orbite
    const list = [];
    for (let i = 0; i < cfg.n; i++) {
      const W = flameWisp(THREE, c, 0.16 * s),
        trail = [0, 1, 2, 3, 4].map(k =>
          wispSprite(THREE, 'flame', c.clone().offsetHSL(0, 0.35, -0.08), 0.2 * s * (1 - k * 0.15), true)
        );
      trail.forEach((sp, k) => (sp.material.opacity = 0.55 * (1 - k * 0.18)));
      g.add(W.g, ...trail);
      list.push({ W, trail, ph: (i / cfg.n) * Math.PI * 2 });
    }
    let last = -1;
    const update = () => {
      const t = performance.now() / 1000;
      if (t === last) return;
      last = t;
      for (const L of list) {
        const at = dt => {
          const a = (t - dt) * 1.6 + L.ph;
          return [
            Math.sin(a) * 0.48 * s,
            hy + 0.12 * s + Math.sin((t - dt) * 2.2 + L.ph) * 0.14 * s,
            Math.cos(a) * 0.48 * s
          ];
        };
        L.W.g.position.set(...at(0));
        L.trail.forEach((sp, k) => sp.position.set(...at(0.045 * (k + 1))));
        L.W.update(t + L.ph);
      }
    };
    update();
    for (const L of list) L.W.halo.onBeforeRender = update;
    root.add(g);
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
        const W = flameWisp(THREE, c, 0.13 * s),
          halo = W.halo;
        g.add(W.g);
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
          W.update(t);
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
  Object.assign(P, {
    glowSprite,
    flameWisp,
    weaponEnchant,
    electricArcs,
    glowEyes,
    buildOrbs,
    buildHandFx,
    buildSkulls
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
