(function (root) {
  'use strict';
  // Personnages : armes et bâtons (modèles procéduraux, prise en main, port dans le dos).
  // Chargé avant builder.js ; partage ses fonctions par root.CharacterParts.
  const P = (root.CharacterParts = root.CharacterParts || {});
  const { glowSprite, flameWisp, weaponEnchant, backMount, mount, handGrip, envMap } = P;

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
      emissiveIntensity: 1.4, // assez pour briller sans virer au blanc
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
    // pas de lumière ponctuelle : elle apparaissait et disparaissait avec le personnage, ce qui recompilait tous les
    // matériaux de la scène (gel) ; l'éclat vient du cristal émissif et du halo ci-dessous
    // Feu magique qui brûle autour du cristal (flammes, braises, halo qui respire)
    const W = flameWisp(THREE, cc, 0.12 * s);
    W.g.position.y = 0.84 * s;
    W.halo.name = 'CrystalGlow';
    g.add(W.g);
    W.halo.onBeforeRender = () => W.update(performance.now() / 1000);
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
  // bladeLength : longueur de lame relative (donnée de race, kits.js weaponLength) ; la poignée ne change pas.
  function buildWeapon(THREE, body, bones, kind, height, fitMeshes, bladeLength = 1) {
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
        // Masse runique du nain (demande de l'utilisateur : plus grosse, plus lumineuse, un peu plus courte) :
        // manche gainé de cuir et cerclé d'or, tête à six ailettes d'acier autour d'un cœur de rune bleu lumineux,
        // couronne en pointe, pommeau à gemme.
        const w = new THREE.Group();
        w.name = 'Hammer';
        const glowM = new THREE.MeshStandardMaterial({
          color: 0x7fe0ff,
          emissive: 0x2fa8ff,
          emissiveIntensity: 3.2,
          roughness: 0.2
        });
        const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * s, 0.025 * s, 0.62 * s, 10), leather);
        hdl.position.y = 0.17 * s;
        w.add(hdl);
        for (const y of [-0.1, 0.12, 0.36]) {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.029 * s, 0.029 * s, 0.025 * s, 12), gold);
          band.position.y = y * s;
          w.add(band);
        }
        const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.04 * s, 0), gold);
        pommel.position.y = -0.16 * s;
        w.add(pommel);
        const pg = new THREE.Mesh(new THREE.OctahedronGeometry(0.022 * s, 0), glowM);
        pg.position.y = -0.2 * s;
        w.add(pg);
        const HY = 0.58 * s; // centre de la tête
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.035 * s, 0.07 * s, 12), gold);
        collar.position.y = HY - 0.13 * s;
        w.add(collar);
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085 * s, 1), dark);
        core.scale.y = 1.25;
        core.position.y = HY;
        w.add(core);
        // fentes de rune lumineuses entre les ailettes
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6,
            slit = new THREE.Mesh(new THREE.BoxGeometry(0.018 * s, 0.16 * s, 0.018 * s), glowM);
          slit.position.set(Math.sin(a) * 0.083 * s, HY, Math.cos(a) * 0.083 * s);
          w.add(slit);
        }
        // six ailettes en trapèze, biseautées
        const fin = new THREE.Shape();
        fin.moveTo(0, -0.11);
        fin.lineTo(0.085, -0.06);
        fin.lineTo(0.1, 0.06);
        fin.lineTo(0, 0.13);
        fin.lineTo(0, -0.11);
        const finGeo = new THREE.ExtrudeGeometry(fin, {
          depth: 0.016,
          bevelEnabled: true,
          bevelThickness: 0.006,
          bevelSize: 0.006,
          bevelSegments: 1
        });
        finGeo.translate(0, 0, -0.008);
        finGeo.scale(s, s, s);
        for (let k = 0; k < 6; k++) {
          const f = new THREE.Mesh(finGeo, steel),
            a = (k / 6) * Math.PI * 2;
          f.position.set(Math.sin(a) * 0.06 * s, HY, Math.cos(a) * 0.06 * s);
          f.rotation.y = a - Math.PI / 2;
          w.add(f);
        }
        for (const dy of [-0.095, 0.11]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075 * s, 0.012 * s, 6, 18), gold);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = HY + dy * s;
          w.add(ring);
        }
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.035 * s, 0.13 * s, 6), steel);
        crown.position.y = HY + 0.19 * s;
        w.add(crown);
        const cg = new THREE.Mesh(new THREE.OctahedronGeometry(0.028 * s, 0), glowM);
        cg.position.y = HY + 0.125 * s;
        w.add(cg);
        // halo de rune autour de la tête (additif, ne masque rien)
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.13 * s, 16, 12),
          new THREE.MeshBasicMaterial({
            color: 0x3fb4ff,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        halo.scale.y = 1.3;
        halo.position.y = HY;
        w.add(halo);
        // tête plus grosse : tout ce qui est au-dessus du manche est agrandi autour du centre de la tête
        for (const c of w.children)
          if (c.position.y > HY - 0.16 * s) {
            c.position.y = HY + (c.position.y - HY) * 1.35;
            c.scale.multiplyScalar(1.35);
          }
        weaponEnchant(
          THREE,
          w,
          new THREE.Color(0.25, 0.7, 1),
          [
            [0, HY - 0.12 * s, 0],
            [0, HY + 0.3 * s, 0]
          ],
          0.13 * s
        );
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
        weaponEnchant(
          THREE,
          w,
          new THREE.Color(1, 0.42, 0.08),
          [
            [0.17 * s, 0.53 * s, 0],
            [0.25 * s, 0.68 * s, 0],
            [0.17 * s, 0.83 * s, 0]
          ],
          0.09 * s
        );
        inHand(w, 'r', 0.05 * s, 0.35);
      } else {
        const ice = new THREE.MeshStandardMaterial({
          color: 0x4a9cff,
          emissive: 0x1a50ff,
          emissiveIntensity: 2.2,
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
        weaponEnchant(
          THREE,
          sw,
          new THREE.Color(0.3, 0.6, 1),
          [
            [0, 0.05 * s, 0],
            [0, 0.98 * s, 0]
          ],
          0.09 * s
        );
        inHand(sw, 'r', -0.11 * s, 0.3);
      }
    } else if (kind === 'runeblade') {
      const L = bladeLength,
        sw = sword(L, 0.075, dark, dark);
      sw.name = 'Runeblade';
      const rc = new THREE.Color(0.45, 0.85, 1),
        rune = new THREE.MeshStandardMaterial({ color: rc, emissive: rc, emissiveIntensity: 3.6 });
      for (let i = 0; i < 5; i++) {
        const r = B(0.022, 0.06, 0.016, rune);
        r.position.y = (0.15 + i * 0.17) * L * s;
        sw.add(r);
      }
      const glow = glowSprite(THREE, rc, 0.35 * s);
      glow.position.y = 0.5 * L * s;
      glow.scale.set(0.25 * s, 1.1 * L * s, 1);
      glow.material.opacity = 0.35;
      sw.add(glow);
      weaponEnchant(
        THREE,
        sw,
        new THREE.Color(0.35, 0.8, 1),
        [
          [0, 0.05 * s, 0],
          [0, 1.08 * L * s, 0]
        ],
        0.1 * s
      );
      inHand(sw, 'r', -0.11 * s, 0.4);
    } else if (kind === 'daggers') {
      // Glaives doubles (design original) : poignée au poing, une lame en croissant de chaque côté de la main
      // (devant et derrière), dents sur le bord inférieur, garde ronde ornée d'un croissant de lune.
      // enchantement vert vif : lame entièrement lumineuse + halo additif autour de la lame
      const fel = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x1f8a12).convertSRGBToLinear(),
        emissive: new THREE.Color(0x2fc80f).convertSRGBToLinear(),
        emissiveIntensity: 1.8,
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
          weaponEnchant(
            THREE,
            g,
            new THREE.Color(0.3, 1, 0.12),
            [
              [0, dir * 0.1 * s, -0.02 * s],
              [0, dir * 0.4 * s, -0.04 * s],
              [0, dir * 0.6 * s, -0.16 * s]
            ],
            0.07 * s
          );
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
  Object.assign(P, { buildStaff, buildWeapon });
})(typeof globalThis !== 'undefined' ? globalThis : this);
