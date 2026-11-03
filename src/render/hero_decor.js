'use strict';
// Détails ajoutés aux personnages : échelle et traits de race, ornements de classe, aura, racines (Entangling Roots / Frost Nova).
function hfRaceScale(race, kit = false) {
  // Personnages assemblés : le nain a déjà ses proportions (jambes courtes, torse large), pas d'écrasement.
  if (race === 'dwarf') return kit ? [0.98, 0.86, 0.98] : [1.13, 0.84, 1.13];
  if (race === 'elf') return [0.98, 1.06, 0.98];
  if (race === 'orc') return [1.1, 1.05, 1.08];
  if (race === 'undead') return [0.96, 1.0, 0.96];
  return [1, 1, 1];
}
function hfHeadAnchor(model, group) {
  const p = new THREE.Vector3();
  let head = null;
  model?.traverse?.(o => {
    if (!head && o.isBone && /(^|[_ .-])head($|[_ .-])/i.test(o.name || '')) head = o;
  });
  group.updateMatrixWorld(true);
  model?.updateMatrixWorld?.(true);
  if (head) {
    head.getWorldPosition(p);
    group.worldToLocal(p);
    p.y += 0.035;
    return p;
  }
  const box = new THREE.Box3().setFromObject(model),
    size = new THREE.Vector3(),
    center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  group.worldToLocal(center);
  return new THREE.Vector3(center.x, box.min.y + size.y * 0.78, center.z);
}
function hfClassDecor(rec, u, anchorGroup) {
  if (!window.THREE || !rec?.group) return;
  const g = anchorGroup || rec.decor || rec.group,
    C = CLASS[u.cls],
    accent = new THREE.Color(C.accent[0], C.accent[1], C.accent[2]);
  const metal = new THREE.MeshStandardMaterial({ color: 0x4f5660, roughness: 0.36, metalness: 0.72 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.42, metalness: 0.68 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x5a321d, roughness: 0.82, metalness: 0.02 });
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.55,
    roughness: 0.22,
    metalness: 0.12
  });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xd9c89a, roughness: 0.82, metalness: 0.02 });
  const addStaff = (crystalColor = accent) => {
    const staff = new THREE.Group();
    staff.position.set(0.54, 1.08, 0.04);
    staff.rotation.z = -0.1;
    g.add(staff);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.72, 14), leather);
    shaft.position.y = 0;
    staff.add(shaft);
    const orbMat = glow.clone();
    orbMat.color = crystalColor;
    orbMat.emissive = crystalColor;
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 2), orbMat);
    orb.position.y = 0.91;
    staff.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 10, 24), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.9;
    staff.add(ring);
  };
  if (u.cls === 'sentinel') {
    const pad = new THREE.Group();
    pad.position.set(-0.48, 1.54, 0.0);
    g.add(pad);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 28, 18), darkMetal);
    shell.scale.set(1.22, 0.62, 0.98);
    pad.add(shell);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 12), ivory);
      sp.position.set(-0.16 + i * 0.16, 0.17, -0.01);
      sp.rotation.z = (i - 1) * 0.18;
      pad.add(sp);
    }
    const axe = new THREE.Group();
    axe.position.set(0.55, 0.9, -0.1);
    axe.rotation.z = -0.18;
    g.add(axe);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.15, 12), leather);
    axe.add(h);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 4), metal);
    blade.position.set(0.09, 0.55, 0);
    blade.rotation.z = -Math.PI / 2;
    axe.add(blade);
  } else if (u.cls === 'arcanist') {
    addStaff(accent);
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.31, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x5d2f72, roughness: 0.68, metalness: 0.02 })
    );
    book.position.set(-0.33, 1.05, 0.18);
    book.rotation.y = 0.28;
    g.add(book);
  } else if (u.cls === 'oracle') {
    addStaff(new THREE.Color(1, 0.88, 0.48));
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.015, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe89c, transparent: true, opacity: 0.85 })
    );
    halo.position.set(0, 2.23, 0);
    halo.rotation.x = Math.PI / 2;
    g.add(halo);
  } else if (u.cls === 'reaver') {
    const sword = new THREE.Group();
    sword.position.set(0.55, 1.02, -0.08);
    sword.rotation.z = -0.12;
    g.add(sword);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 12), leather);
    h.position.y = -0.46;
    sword.add(h);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.08, 0.035), darkMetal);
    blade.position.y = 0.18;
    sword.add(blade);
    for (let i = -2; i <= 2; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.018, 0.042), glow);
      rune.position.set(0, i * 0.16 + 0.18, 0.03);
      sword.add(rune);
    }
  } else if (u.cls === 'warden') {
    const antlerMat = new THREE.MeshStandardMaterial({ color: 0x7a5b32, roughness: 0.88 });
    for (const side of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.42, 10), antlerMat);
      a.position.set(side * 0.16, 2.13, 0);
      a.rotation.z = side * 0.42;
      g.add(a);
    }
  } else if (u.cls === 'shade') {
    for (const side of [-1, 1]) {
      const dagger = new THREE.Group();
      dagger.position.set(side * 0.42, 0.98, 0.15);
      dagger.rotation.z = side * 0.18;
      g.add(dagger);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 10), leather);
      grip.position.y = -0.1;
      dagger.add(grip);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.38, 4), metal);
      blade.position.y = 0.18;
      dagger.add(blade);
    }
  } else if (u.cls === 'warlock') {
    addStaff(new THREE.Color(0.32, 1, 0.12));
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), ivory);
    skull.position.set(-0.33, 1.12, 0.17);
    skull.scale.set(1, 0.78, 0.82);
    g.add(skull);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x62ff3c })
      );
      eye.position.set(-0.33 + side * 0.035, 1.13, 0.25);
      g.add(eye);
    }
  }
}
function hfRaceDecor(rec, u, model = null) {
  if (!window.THREE) return;
  const g = (rec.decor = new THREE.Group());
  rec.group.add(g);
  const skin = u.race === 'orc' ? 0x4c8b42 : u.race === 'undead' ? 0x9aa7a6 : u.race === 'elf' ? 0xdab092 : 0xd2a477;
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.72, metalness: 0.01 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xeee0bd, roughness: 0.82 });
  const headPos = model ? hfHeadAnchor(model, rec.group) : new THREE.Vector3(0, 1.78, 0);
  const face = new THREE.Group();
  face.position.copy(headPos);
  g.add(face);
  if (u.race === 'elf') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 10), skinMat);
      ear.rotation.z = (side * Math.PI) / 2;
      ear.rotation.y = -side * 0.1;
      ear.position.set(side * 0.24, 0.01, 0.0);
      face.add(ear);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x85eaff, transparent: true, opacity: 0.82 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeMat);
      eye.position.set(side * 0.055, 0.015, 0.175);
      face.add(eye);
    }
  } else if (u.race === 'orc') {
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 18), skinMat);
    mask.scale.set(0.92, 1.02, 0.84);
    mask.position.set(0, -0.015, 0.015);
    face.add(mask);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), skinMat);
    jaw.scale.set(1.22, 0.55, 0.76);
    jaw.position.set(0, -0.13, 0.105);
    face.add(jaw);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24, 9), skinMat);
      ear.rotation.z = (side * Math.PI) / 2;
      ear.position.set(side * 0.235, 0.0, -0.005);
      face.add(ear);
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.13, 9), ivory);
      tusk.rotation.x = Math.PI;
      tusk.position.set(side * 0.072, -0.115, 0.19);
      face.add(tusk);
    }
  } else if (u.race === 'dwarf') {
    const beardMat = new THREE.MeshStandardMaterial({ color: 0x6b3d1e, roughness: 1 });
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 10), beardMat);
    beard.rotation.x = Math.PI;
    beard.position.set(0, -0.16, 0.08);
    face.add(beard);
  }
  // Extra heroic styling inspired by the supplied reference, only on the HD orc.
  if (u.race === 'orc') {
    const leather = new THREE.MeshStandardMaterial({ color: 0x4a2b1c, roughness: 0.84, metalness: 0.02 }),
      iron = new THREE.MeshStandardMaterial({ color: 0x3c454c, roughness: 0.38, metalness: 0.72 });
    const necklace = new THREE.Group();
    necklace.position.set(0, 1.53, 0.18);
    g.add(necklace);
    for (let i = -2; i <= 2; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 10), ivory);
      tooth.position.set(i * 0.07, -Math.abs(i) * 0.008, 0.02);
      tooth.rotation.x = Math.PI;
      necklace.add(tooth);
    }
    if (u.cls === 'sentinel' || u.cls === 'reaver') {
      const bracerL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.34, 18), leather);
      bracerL.position.set(-0.48, 0.92, 0.02);
      bracerL.rotation.z = 0.1;
      g.add(bracerL);
      const bracerR = bracerL.clone();
      bracerR.position.x = 0.48;
      bracerR.rotation.z = -0.1;
      g.add(bracerR);
      for (const side of [-1, 1])
        for (let j = 0; j < 3; j++) {
          const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 8, 24), iron);
          band.position.set(side * 0.48, 0.81 + j * 0.11, 0.02);
          band.rotation.x = Math.PI / 2;
          g.add(band);
        }
    }
  }
  hfClassDecor(rec, u, g);
  hfAddAura(rec, u, g);
}
function hfAddAura(rec, u, g) {
  const c = CLASS[u.cls].accent,
    col = new THREE.Color(c[0], c[1], c[2]);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.035;
  g.add(ring);
  rec.aura = ring;
}
// Racines (druide) ou glace (Frost Nova) qui enserrent les jambes d'une unité immobilisée.
function hfMakeRootFx(kind) {
  const g = new THREE.Group();
  if (kind === 'ice') {
    const m = new THREE.MeshStandardMaterial({
      color: 0xbfeaff,
      emissive: 0x3aa8ff,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.75,
      flatShading: true
    });
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2,
        c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + Math.random() * 0.1, 0), m);
      c.scale.set(0.6, 1.8 + Math.random(), 0.6);
      c.position.set(Math.sin(a) * 0.32, 0.25, Math.cos(a) * 0.32);
      c.rotation.set((Math.random() - 0.5) * 0.6, a, (Math.random() - 0.5) * 0.6);
      g.add(c);
    }
  } else {
    const bark = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 }),
      leaf = new THREE.MeshStandardMaterial({
        color: 0x5fae3a,
        emissive: 0x1d5a10,
        emissiveIntensity: 0.6,
        roughness: 0.7
      });
    for (let k = 0; k < 6; k++) {
      const pts = [],
        a0 = (k / 6) * Math.PI * 2,
        r0 = 0.55;
      for (let j = 0; j <= 14; j++) {
        const t = j / 14,
          a = a0 + t * Math.PI * 2.2,
          r = r0 - t * 0.3;
        pts.push(new THREE.Vector3(Math.sin(a) * r, t * 1.15, Math.cos(a) * r));
      }
      g.add(
        new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045 - k * 0.003, 6, false), bark)
      );
      for (let j = 3; j < 14; j += 3) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), leaf);
        l.scale.set(1.4, 0.4, 0.8);
        l.position.copy(pts[j]);
        g.add(l);
      }
    }
  }
  g.userData.kind = kind;
  return g;
}
function hfUpdateRootFx(rec, u, t) {
  const want = u.alive && u.root > 0 && u.rootKind ? u.rootKind : null;
  if (rec.rootFx && rec.rootFx.userData.kind !== want) {
    rec.group.remove(rec.rootFx);
    rec.rootFx = null;
  }
  if (want && !rec.rootFx) {
    rec.rootFx = hfMakeRootFx(want);
    rec.group.add(rec.rootFx);
    rec.rootT = t;
  }
  if (rec.rootFx) {
    const k = Math.min(1, (t - rec.rootT) / 0.35),
      out = Math.min(1, u.root / 0.3);
    rec.rootFx.scale.set(1 / rec.group.scale.x, (k * out) / rec.group.scale.y, 1 / rec.group.scale.z);
    rec.rootFx.rotation.y = -rec.group.rotation.y;
  }
}
