(function (root) {
  'use strict';
  // Personnages : épaulières sculptées par classe (mage, démoniste, voleur, prêtre), d'après les planches de référence
  // de l'utilisateur (assets_src/ui/refs/ref_shoulders_*.png). Une épaulière = coque d'épaule + rangs de lames
  // (feuilles extrudées et courbées, bordées d'une copie dorée / cuivrée) en éventail + gemmes lumineuses (+ col).
  // Choisie par `pauldron.style` dans characters/kits.js ; sans style, armor.js garde ses épaulières à lames rondes.
  // Chargé après armor.js, avant builder.js ; partage ses fonctions par root.CharacterParts.
  const P = (root.CharacterParts = root.CharacterParts || {});
  const { envMap } = P;

  // couleurs [r, g, b] ; tiers : rangs de lames (mode 'scale' / 'wing' : voir bladeFrame ; n lames, longueur / largeur
  // en m pour 1,8 m, hauteur sur la coque th ou inclinaison lean, éventail spread et centre a0 en radians (a0 négatif =
  // vers l'arrière), courbure curl, matière du rang)
  const SHOULDER_STYLES = {
    // grandes épaulières bleu roi à pointes dorées superposées, cristaux bleus lumineux
    mage: {
      base: [0.06, 0.1, 0.46],
      trim: [0.95, 0.72, 0.3],
      gem: [0.35, 0.78, 1],
      dome: 0.135,
      tiers: [
        { mode: 'scale', n: 4, len: 0.12, wid: 0.08, th: 1.2, spread: 1.7, curl: 0.1, mat: 'trim' },
        { mode: 'scale', n: 5, len: 0.15, wid: 0.09, th: 0.75, spread: 1.9, curl: 0.15 },
        { mode: 'wing', n: 5, len: 0.2, wid: 0.075, lean: 0.6, spread: 1.3, curl: 0.3 }
      ],
      gems: 2
    },
    // épaulières violettes bordées de cuivre, deux pointes recourbées en crochet, motif vert lumineux
    warlock: {
      base: [0.18, 0.045, 0.23],
      trim: [0.76, 0.43, 0.25],
      gem: [0.45, 1, 0.22],
      dome: 0.15,
      domeCover: 1.4,
      tiers: [
        { mode: 'scale', n: 3, len: 0.15, wid: 0.13, th: 0.85, spread: 1.5 },
        { mode: 'wing', n: 2, len: 0.15, wid: 0.07, lean: 0.95, spread: 0.9, curl: 0.9 }
      ],
      runes: 1
    },
    // cuir sombre en lames superposées, liserés dorés, dessous bordeaux, gemme rouge
    rogue: {
      base: [0.07, 0.05, 0.06],
      metal: 0.1,
      rough: 0.85,
      trim: [0.86, 0.62, 0.26],
      under: [0.48, 0.05, 0.08],
      gem: [1, 0.12, 0.08],
      dome: 0.12,
      tiers: [
        { mode: 'scale', n: 5, len: 0.14, wid: 0.06, th: 1.25, spread: 2.0, curl: -0.2, mat: 'under' },
        { mode: 'scale', n: 5, len: 0.13, wid: 0.07, th: 0.85, spread: 1.9, curl: 0.3 },
        { mode: 'scale', n: 4, len: 0.11, wid: 0.07, th: 0.45, spread: 1.6, curl: 0.35 }
      ],
      gems: 1
    },
    // grandes épaulières dorées en ailes nacrées balayées vers l'arrière, gemmes bleues, col haut
    priest: {
      base: [0.96, 0.94, 0.9],
      nacre: true,
      trim: [0.95, 0.74, 0.3],
      gem: [0.4, 0.72, 1],
      dome: 0.14,
      tiers: [
        { mode: 'scale', n: 4, len: 0.14, wid: 0.1, th: 0.95, spread: 1.7, mat: 'trim' },
        { mode: 'wing', n: 4, len: 0.18, wid: 0.08, lean: 0.75, spread: 1.2, a0: -0.2, curl: 0.35, mat: 'trim' },
        { mode: 'wing', n: 5, len: 0.26, wid: 0.09, lean: 0.4, spread: 1.1, a0: -0.35, curl: 0.5 }
      ],
      gems: 2,
      collar: true
    }
  };

  const rgb = (THREE, c) => new THREE.Color(...c);
  // matières d'un style (créées une fois par personnage)
  function styleMaterials(THREE, st) {
    const metal = (c, m = 0.85, r = 0.3) =>
      new THREE.MeshStandardMaterial({
        color: rgb(THREE, c),
        metalness: m,
        roughness: r,
        envMap: envMap(THREE),
        envMapIntensity: 0.7
      });
    const base = metal(st.base, st.metal ?? 0.25, st.rough ?? (st.nacre ? 0.22 : 0.5));
    if (st.nacre) base.emissive = rgb(THREE, [0.18, 0.16, 0.13]); // nacre : reflet clair même à l'ombre
    const glow = c =>
      new THREE.MeshStandardMaterial({ color: rgb(THREE, c), emissive: rgb(THREE, c), emissiveIntensity: 1.3 });
    return {
      base,
      trim: metal(st.trim),
      under: st.under ? metal(st.under, 0.1, 0.7) : base,
      gem: glow(st.gem)
    };
  }
  // lame : feuille pointue de longueur L (axe +Y), largeur W, pointe déportée de curl × L (courbure)
  function bladeGeometry(THREE, L, W, curl) {
    const sh = new THREE.Shape();
    sh.moveTo(-W / 2, 0);
    sh.quadraticCurveTo(-W * 0.55 + curl * L * 0.15, L * 0.55, curl * L * 0.32, L);
    sh.quadraticCurveTo(W * 0.5 + curl * L * 0.25, L * 0.45, W / 2, 0);
    sh.lineTo(-W / 2, 0);
    return new THREE.ExtrudeGeometry(sh, {
      depth: W * 0.12,
      bevelEnabled: true,
      bevelThickness: W * 0.05,
      bevelSize: W * 0.05,
      bevelSegments: 1,
      curveSegments: 8
    });
  }
  // repère d'une lame du rang (f de -0,5 à 0,5 dans l'éventail) : pied, axes (largeur X, pointe Y, face Z).
  //   'scale' : plaque couchée sur la coque, pointe vers le bas et l'extérieur (écailles qui se recouvrent) ;
  //   'wing'  : plaque dressée sur le haut de l'épaule, face vers l'avant (couronne de pointes, ailes).
  function bladeFrame(THREE, t, f, out, R) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z),
      a = (t.a0 || 0) + f * t.spread;
    if (t.mode === 'wing') {
      const Y = V(out * Math.sin(t.lean), Math.cos(t.lean), Math.sin(a) * 0.8).normalize(),
        X = V()
          .crossVectors(Y, V(0, 0, 1))
          .normalize(),
        Z = V().crossVectors(X, Y);
      return { pos: V(out * R * 0.35, R * 0.5, Math.sin(a) * R * 0.45), X, Y, Z };
    }
    const n = V(out * Math.sin(t.th) * Math.cos(a), Math.cos(t.th), Math.sin(t.th) * Math.sin(a)),
      Y = V(out * Math.cos(t.th) * Math.cos(a), -Math.sin(t.th), Math.cos(t.th) * Math.sin(a)),
      X = V().crossVectors(Y, n);
    return { pos: V(n.x * R * 0.95, n.y * R * 0.62, n.z * R), X, Y, Z: n };
  }
  // rang de lames en éventail autour de l'épaule ; out = côté (+1 / -1), s = échelle de la taille
  function bladeTier(THREE, g, t, s, out, st, mats) {
    const L = t.len * s,
      W = t.wid * s,
      body = bladeGeometry(THREE, L, W, (t.curl || 0) * out),
      edge = bladeGeometry(THREE, L * 1.08, W * 1.25, (t.curl || 0) * out),
      mat = mats[t.mat || 'base'],
      edgeMat = t.mat === 'trim' ? mats.base : mats.trim;
    for (let k = 0; k < t.n; k++) {
      const F = bladeFrame(THREE, t, t.n > 1 ? k / (t.n - 1) - 0.5 : 0, out, st.dome * s),
        blade = new THREE.Group();
      blade.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.X, F.Y, F.Z));
      blade.position.copy(F.pos);
      const e = new THREE.Mesh(edge, edgeMat);
      e.position.z = -W * 0.3; // la bordure dépasse derrière la lame (jamais devant)
      blade.add(new THREE.Mesh(body, mat), e);
      g.add(blade);
    }
  }
  // coque d'épaule (demi-sphère aplatie) avec liseré
  function shoulderDome(THREE, g, st, s, out, mats) {
    const r = st.dome * s,
      cover = st.domeCover || 1.25,
      cap = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, cover), mats.base);
    cap.scale.set(1.08, 0.6, 1.12);
    cap.rotation.z = -out * 0.25;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(cover), 0.008 * s, 6, 40), mats.trim);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = r * Math.cos(cover);
    cap.add(rim);
    g.add(cap);
  }
  // gemmes sur le devant de la coque ; runes = croissants lumineux (démoniste)
  function shoulderJewels(THREE, g, st, s, out, mats) {
    const r = st.dome * s,
      // point de la coque (hauteur th, azimut a : 0 = dehors, + = devant), sorti au-dessus des plaques
      onTop = (th, a, lift) =>
        new THREE.Vector3(
          out * Math.sin(th) * Math.cos(a) * r * lift,
          Math.cos(th) * r * 0.62 * lift,
          Math.sin(th) * Math.sin(a) * r * lift
        );
    for (let k = 0; k < (st.gems || 0); k++) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.028 * s), mats.gem);
      gem.scale.set(0.7, 1.5, 0.55);
      gem.position.copy(onTop(0.8, 0.7 - k * 0.9, 1.3));
      gem.rotation.z = -out * 0.6;
      g.add(gem);
    }
    for (let k = 0; k < (st.runes || 0); k++) {
      const rune = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, 0.013 * s, 5, 18, 2.2), mats.gem);
      rune.position.copy(onTop(0.75, 0.25, 1.32));
      rune.rotation.set(-1.0, out * 0.7, out * 0.5);
      g.add(rune);
    }
  }
  // col haut ouvert devant (prêtre), autour du cou
  function highCollar(THREE, bones, s, mats) {
    const neck = bones.neck_01 || bones.Head;
    if (!neck) return;
    const n = neck.getWorldPosition(new THREE.Vector3()),
      geo = new THREE.CylinderGeometry(0.085 * s, 0.075 * s, 0.09 * s, 28, 1, true, Math.PI * 0.32, Math.PI * 1.36),
      collar = new THREE.Mesh(geo, mats.base);
    collar.material = mats.base.clone();
    collar.material.side = THREE.DoubleSide;
    collar.position.set(n.x, n.y - 0.01 * s, n.z - 0.008 * s);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085 * s, 0.006 * s, 5, 36, Math.PI * 1.36), mats.trim);
    rim.rotation.set(Math.PI / 2, 0, Math.PI * 0.32 - Math.PI / 2);
    rim.position.y = 0.045 * s;
    collar.add(rim);
    collar.name = 'Collar';
    (bones.spine_03 || neck).attach(collar);
  }
  // point d'entrée (armor.js) : épaulières du style, fixées aux clavicules comme les autres
  function buildStyledPauldrons(THREE, bones, style, height) {
    const st = SHOULDER_STYLES[style];
    if (!st) return false;
    const s = height / 1.8,
      sp = bones.spine_03.getWorldPosition(new THREE.Vector3()),
      mats = styleMaterials(THREE, st);
    for (const side of ['l', 'r']) {
      const S = bones['upperarm_' + side].getWorldPosition(new THREE.Vector3()),
        out = Math.sign(S.x - sp.x) || 1,
        g = new THREE.Group();
      g.name = 'Pauldron';
      shoulderDome(THREE, g, st, s, out, mats);
      for (const t of st.tiers) bladeTier(THREE, g, t, s, out, st, mats);
      shoulderJewels(THREE, g, st, s, out, mats);
      g.position.set(S.x + out * 0.012 * s, S.y + 0.035 * s, S.z);
      g.rotation.z = -out * 0.12;
      bones['clavicle_' + side].attach(g);
    }
    if (st.collar) highCollar(THREE, bones, s, mats);
    return true;
  }
  Object.assign(P, { SHOULDER_STYLES, buildStyledPauldrons });
})(typeof globalThis !== 'undefined' ? globalThis : this);
