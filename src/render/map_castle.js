'use strict';
// Décor de la carte « castle » (three.js, procédural) : sol pierre/herbe et cercle runique, herbe animée, piliers,
// remparts, bannières, braseros, forêt, montagnes, château au loin. Moteur commun (scène, ombres, rendu) : environment.js.
// Les obstacles de jeu (cercles) sont dans MAPS.castle (src/data/maps.js) ; ce fichier ne fait que les habiller.
(function () {
  if (!window.ArenaEnv?.registerMap) return;
  const { clamp, rng, canvas, tex, stoneCanvas, grassCanvas, glowTexture, flameTexture, grassAmount, ambientMotes } =
    ArenaEnv.helpers;
  let E = null; // état du décor (environment.js), reçu à chaque construction de la carte

  // Cercle runique au centre de l'arène (or + arcane), avec carte émissive.
  function runeCircle(THREE) {
    const S = 1024,
      c = canvas(S),
      e = canvas(S),
      g = c.getContext('2d'),
      ge = e.getContext('2d'),
      C = S / 2;
    ge.fillStyle = '#000';
    ge.fillRect(0, 0, S, S);
    const ring = (ctx, r, w, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(C, C, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    for (const [ctx, glow] of [
      [g, false],
      [ge, true]
    ]) {
      const gold = glow ? '#4a3410' : '#c99a3e',
        blue = glow ? '#3aa8ff' : '#5fb8ff';
      ring(ctx, 500, 10, gold);
      ring(ctx, 470, 4, gold);
      ring(ctx, 300, 8, blue);
      ring(ctx, 285, 3, blue);
      ring(ctx, 95, 8, gold);
      ctx.strokeStyle = blue;
      ctx.lineWidth = 5;
      ctx.beginPath(); // étoile à 8 branches
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2,
          r = k % 2 ? 140 : 290;
        ctx.lineTo(C + Math.sin(a) * r, C + Math.cos(a) * r);
      }
      ctx.stroke();
      ctx.fillStyle = gold;
      ctx.font = 'bold 34px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        ctx.save();
        ctx.translate(C + Math.sin(a) * 485, C + Math.cos(a) * 485);
        ctx.rotate(-a + Math.PI);
        ctx.fillText(glyphs[k % glyphs.length], 0, 0);
        ctx.restore();
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.fillStyle = blue;
        ctx.beginPath();
        ctx.arc(C + Math.sin(a) * 385, C + Math.cos(a) * 385, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const mat = new THREE.MeshStandardMaterial({
      map: tex(THREE, c, false),
      emissiveMap: tex(THREE, e, false),
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 1.4,
      transparent: true,
      depthWrite: false,
      roughness: 0.4,
      metalness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    // le fond du canvas est transparent : seuls les tracés apparaissent
    return mat;
  }
  function buildCastleMap(THREE, S, arena) {
    const mobile = E.mobile;
    S.fog = new THREE.Fog(0x1c2448, 55, 470);

    // Ciel : dégradé crépuscule, soleil bas, étoiles naissantes
    const sunDir = new THREE.Vector3(0.38, 0.36, -0.85).normalize(); // la grande lune, au-dessus du château
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { sun: { value: sunDir }, time: E.time },
        vertexShader:
          'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec3 vDir;uniform vec3 sun;uniform float time;
        float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
        void main(){float y=vDir.y;
          vec3 zen=vec3(.012,.018,.07),mid=vec3(.05,.07,.2),hor=vec3(.2,.17,.42),low=vec3(.03,.035,.08);
          vec3 c=y>0.?mix(mid,zen,smoothstep(.0,.6,y)):low;c=mix(c,hor,(1.-smoothstep(0.,.25,abs(y)))*.9);
          float ax=atan(vDir.x,vDir.z),band=sin(ax*3.+time*.08+sin(ax*7.+time*.2)*.6)*.5+.5;
          float au=smoothstep(.12,.32,y)*(1.-smoothstep(.45,.75,y))*pow(band,3.)*(.6+.4*sin(ax*13.+time*.5));
          c+=mix(vec3(.1,.9,.6),vec3(.55,.3,1.),smoothstep(.2,.6,y))*au*.55;
          float s=max(dot(vDir,sun),0.);c+=vec3(.6,.75,1.)*pow(s,6.)*.25+vec3(.85,.92,1.)*smoothstep(.9993,.9996,s)*2.5;
          vec3 m2=normalize(vec3(-.6,.45,-.65));float s2=max(dot(vDir,m2),0.);c+=vec3(1.,.6,.85)*smoothstep(.99975,.99985,s2)*1.6+vec3(.8,.4,.7)*pow(s2,40.)*.15;
          vec3 q=floor(vDir*520.);float st=step(.996,h(q))*smoothstep(.05,.4,y);c+=vec3(st)*(.5+.5*sin(time*3.+h(q+1.)*40.));
          gl_FragColor=vec4(c,1.);}`
      })
    );
    sky.renderOrder = -100;
    S.add(sky);
    E.sky = sky;

    // Lumières : soleil couchant chaud (ombres), ciel bleuté, contre-jour froid
    S.add(new THREE.HemisphereLight(0x8fa4ff, 0x1d1a30, 0.85));
    const sun = new THREE.DirectionalLight(0xc4d4ff, 1.9);
    sun.position.copy(sunDir).multiplyScalar(-1).setY(0.8).normalize().multiplyScalar(60);
    sun.position.set(28, 34, 30);
    sun.castShadow = true;
    const sm = mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 140 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    S.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x9f7dff, 0.5);
    fill.position.set(-20, 14, -30);
    S.add(fill);

    buildGround(THREE, S, arena);
    buildGrass(THREE, S, arena);
    buildPillars(THREE, S, arena);
    buildWalls(THREE, S, arena);
    ArenaEnv.castleHorizon(THREE, S, arena, E); // forêt, montagnes, château au loin : map_castle_horizon.js
  }

  // ---- Sol : dallage + herbe mélangés par un masque, cercle runique au centre ----
  function buildGround(THREE, S, arena) {
    const hx = arena.halfX,
      hz = arena.halfZ;
    const stone = tex(
      THREE,
      stoneCanvas({ rows: 5, minW: 0.14, maxW: 0.3, base: [0.5, 0.46, 0.4], vary: 0.16, moss: 0.45, warp: 5 })
    );
    const grass = tex(THREE, grassCanvas());
    const M = 256,
      mc = canvas(M),
      mg = mc.getContext('2d'),
      mid = mg.createImageData(M, M);
    for (let j = 0; j < M; j++)
      for (let i = 0; i < M; i++) {
        const x = ((i + 0.5) / M) * 2 * hx - hx,
          z = ((j + 0.5) / M) * 2 * hz - hz,
          v = grassAmount(arena, x, z) * 255,
          o = (j * M + i) * 4;
        mid.data[o] = mid.data[o + 1] = mid.data[o + 2] = v;
        mid.data[o + 3] = 255;
      }
    mg.putImageData(mid, 0, 0);
    const mask = tex(THREE, mc, false, false);
    const mat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.88, metalness: 0 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.grassMap = { value: grass };
      sh.uniforms.maskMap = { value: mask };
      sh.uniforms.uHalf = { value: new THREE.Vector2(hx, hz) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvWXZ=(modelMatrix*vec4(transformed,1.)).xz;'
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec2 vWXZ;uniform sampler2D grassMap,maskMap;uniform vec2 uHalf;'
        )
        .replace(
          '#include <map_fragment>',
          `
          vec4 st=mapTexelToLinear(texture2D(map,vWXZ/5.5));
          vec4 gr=mapTexelToLinear(texture2D(grassMap,vWXZ/4.5));
          vec2 muv=(vWXZ+uHalf)/(2.*uHalf);float m=texture2D(maskMap,clamp(muv,0.,1.)).r;
          if(muv.x<0.||muv.x>1.||muv.y<0.||muv.y>1.)m=1.;
          diffuseColor*=mix(st,gr,smoothstep(.15,.85,m));`
        );
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2 + 6, hz * 2 + 6), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    S.add(ground);
    const rc = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), runeCircle(THREE));
    rc.rotation.x = -Math.PI / 2;
    rc.position.y = 0.02;
    rc.receiveShadow = true;
    S.add(rc);
    E.rune = rc;
  }

  // ---- Herbe : brins instanciés qui ondulent au vent, fleurs ----
  function buildGrass(THREE, S, arena) {
    const hx = arena.halfX,
      hz = arena.halfZ,
      r = rng(77);
    const blade = new THREE.BufferGeometry(),
      w = 0.06,
      hgt = 1;
    blade.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, -w * 0.38, 0.45, 0, w * 0.38, 0.45, 0, 0, hgt, 0], 3)
    );
    blade.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        [0.06, 0.14, 0.07, 0.06, 0.14, 0.07, 0.18, 0.36, 0.16, 0.18, 0.36, 0.16, 0.42, 0.62, 0.34],
        3
      )
    );
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
    blade.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.time = E.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float time;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
          vec4 ip=instanceMatrix*vec4(0.,0.,0.,1.);float k=position.y*position.y;
          transformed.x+=(sin(time*1.7+ip.x*.35+ip.z*.22)*.10+sin(time*3.1+ip.z*.9)*.03)*k;
          transformed.z+=cos(time*1.3+ip.x*.27)*.05*k;`
      );
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\nnormal=normalize(vec3(0.,1.,0.)*.6+normal*.4);'
      ); // éclairage doux, sans face sombre
    };
    const N = E.mobile ? 7000 : 26000,
      inst = new THREE.InstancedMesh(blade, mat, N),
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      p = new THREE.Vector3(),
      col = new THREE.Color();
    let n = 0,
      tries = 0;
    while (n < N && tries < N * 12) {
      tries++;
      const x = (r() * 2 - 1) * hx,
        z = (r() * 2 - 1) * hz,
        a = grassAmount(arena, x, z);
      if (r() > a * a) continue;
      if (arena.pillars.some(pp => Math.hypot(x - pp.x, z - pp.z) < pp.r + 0.15)) continue;
      const h = (0.28 + r() * 0.42) * (0.5 + 0.6 * a);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2).multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (r() - 0.5) * 0.5)
      );
      m.compose(p.set(x, 0, z), q, s.set(0.8 + r() * 0.6, h, 1));
      inst.setMatrixAt(n, m);
      col.setHSL(0.28 + r() * 0.08, 0.45 + r() * 0.2, 0.34 + r() * 0.16);
      inst.setColorAt(n, col);
      n++;
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    S.add(inst);
    // fleurs
    const fl = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.05, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      900
    );
    let f = 0;
    const fcol = [0xd7b3ff, 0xffe17a, 0xffffff, 0x9ad0ff, 0xff9fb3];
    while (f < 900 && tries < N * 20) {
      tries++;
      const x = (r() * 2 - 1) * hx,
        z = (r() * 2 - 1) * hz;
      if (grassAmount(arena, x, z) < 0.85 || r() < 0.6) continue;
      m.compose(p.set(x, 0.18 + r() * 0.2, z), q.identity(), s.setScalar(0.7 + r() * 0.6));
      fl.setMatrixAt(f, m);
      fl.setColorAt(f, col.set(fcol[f % fcol.length]));
      f++;
    }
    fl.count = f;
    S.add(fl);
  }

  // ---- Piliers : ruines arcaniques en pierre taillée, cerclages d'or, runes et cristal flottant ----
  function buildPillars(THREE, S, arena) {
    const masonry = tex(
      THREE,
      stoneCanvas({
        size: 512,
        rows: 8,
        minW: 0.25,
        maxW: 0.5,
        base: [0.58, 0.56, 0.52],
        moss: 0.25,
        seed: 11,
        warp: 2
      })
    );
    const stoneMat = new THREE.MeshStandardMaterial({ map: masonry, roughness: 0.85 });
    const darkStone = new THREE.MeshStandardMaterial({ map: masonry, color: 0x9a958c, roughness: 0.9 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc89b45, metalness: 0.85, roughness: 0.32 });
    const rc = canvas(512, 64),
      rg = rc.getContext('2d');
    rg.fillStyle = '#000';
    rg.fillRect(0, 0, 512, 64);
    rg.fillStyle = '#7fd0ff';
    rg.font = 'bold 44px serif';
    rg.textBaseline = 'middle';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';
    for (let k = 0; k < 16; k++) rg.fillText(glyphs[k], k * 32 + 4, 34);
    const runeTex = tex(THREE, rc);
    runeTex.repeat.set(2, 1);
    const runeMat = new THREE.MeshStandardMaterial({
      map: masonry,
      color: 0x7a7770,
      emissiveMap: runeTex,
      emissive: new THREE.Color(0.45, 0.8, 1),
      emissiveIntensity: 1.6,
      roughness: 0.85
    });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x8fd8ff,
      emissive: 0x3aa0ff,
      emissiveIntensity: 1.6,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92
    });
    const glow = glowTexture(THREE);
    E.crystals = [];
    for (const p of arena.pillars) {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      const add = (geo, mat, y, cast = true) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.y = y;
        m.castShadow = cast;
        m.receiveShadow = true;
        g.add(m);
        return m;
      };
      const r = p.r,
        h = p.h;
      add(new THREE.CylinderGeometry(r * 1.42, r * 1.5, 0.3, 8), darkStone, 0.15); // socle à degrés
      add(new THREE.CylinderGeometry(r * 1.22, r * 1.3, 0.32, 8), darkStone, 0.46);
      const shaft = add(
        new THREE.CylinderGeometry(r * 0.94, r * 1.02, h - 1.25, 8, 1),
        stoneMat,
        0.62 + (h - 1.25) / 2
      );
      shaft.geometry.attributes.uv.array.forEach((v, i, a) => {
        if (i % 2) a[i] = (v * (h - 1.25)) / 2.2;
        else a[i] = v * 3;
      });
      add(new THREE.CylinderGeometry(r * 1.035, r * 1.035, 0.42, 8, 1, true), runeMat, h * 0.42); // bandeau runique lumineux
      for (const y of [0.66, h * 0.42 - 0.26, h * 0.42 + 0.26, h - 0.66])
        add(new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.08, 8), gold, y);
      add(new THREE.CylinderGeometry(r * 1.3, r * 1.0, 0.4, 8), darkStone, h - 0.42); // chapiteau
      add(new THREE.CylinderGeometry(r * 1.38, r * 1.38, 0.22, 8), stoneMat, h - 0.11);
      // cristal flottant au sommet
      const cr = add(new THREE.OctahedronGeometry(0.42, 0), crystalMat, h + 1.0, false);
      cr.userData.dynamic = true;
      cr.scale.set(0.75, 1.6, 0.75);
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0x56b4ff,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.75
        })
      );
      sp.scale.setScalar(3.2);
      sp.position.y = h + 1.0;
      g.add(sp);
      E.crystals.push({ mesh: cr, sprite: sp, y: h + 1.0, phase: p.x * 0.3 + p.z * 0.2 });
      // pierres tombées et mousse au pied
      const rr = rng(Math.abs(p.x * 13 + p.z * 7) | (0 + 5));
      for (let k = 0; k < 4; k++) {
        const a = rr() * Math.PI * 2,
          d = r * 1.6 + rr() * 0.8,
          b = add(new THREE.DodecahedronGeometry(0.18 + rr() * 0.22, 0), darkStone, 0.12);
        b.position.set(Math.sin(a) * d, 0.1, Math.cos(a) * d);
        b.rotation.set(rr() * 3, rr() * 3, rr() * 3);
      }
      S.add(g);
    }
  }

  // ---- Lierre : tiges feuillues qui pendent du chaperon, face intérieure des remparts (05/11/2026, décor vivant) ----
  // Un seul maillage instancié (une feuille = une instance), qui ondule doucement ; évite portes et bannières.
  const IVY = { leaf: 0.3, step: 0.13, vines: 60 },
    BANNER_Z = [-18, -9, 0, 9, 18]; // bannières d'équipe sur les remparts est / ouest
  function ivyLeafTexture(THREE) {
    const c = canvas(64),
      g = c.getContext('2d');
    for (const [a, r] of [
      [0, 1],
      [-1.1, 0.8],
      [1.1, 0.8]
    ]) {
      g.save();
      g.translate(32, 54);
      g.rotate(a * 0.55);
      g.fillStyle = `rgb(${52 + r * 20},${100 + r * 30},${40 + r * 10})`;
      g.beginPath();
      g.ellipse(0, -22 * r, 11 * r, 22 * r, 0, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(190,230,140,.5)'; // nervure claire peinte
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -40 * r);
      g.stroke();
      g.restore();
    }
    return tex(THREE, c, false);
  }
  function buildIvy(THREE, S, arena, H, banners) {
    const r = rng(41),
      hx = arena.halfX,
      hz = arena.halfZ,
      spots = [];
    for (let i = 0; i < IVY.vines * 4 && spots.length < IVY.vines; i++) {
      const side = Math.floor(r() * 4),
        vert = side >= 2,
        s = side % 2 ? 1 : -1,
        t = (r() * 2 - 1) * ((vert ? hz : hx) - 1.5),
        gap = ArenaEnv.doorGap(arena, vert ? 'x' : 'z', s);
      if (gap && t > gap[0] - 1 && t < gap[1] + 1) continue;
      if (vert && banners.some(z => Math.abs(z - t) < 1.1)) continue;
      spots.push(
        vert
          ? { x: s * (hx - 0.04), z: t, ry: (-s * Math.PI) / 2 }
          : { x: t, z: s * (hz - 0.04), ry: s > 0 ? Math.PI : 0 }
      );
    }
    const leaves = [];
    for (const p of spots) {
      const len = 0.8 + r() * 2.2;
      for (let y = 0; y < len; y += IVY.step * (0.8 + r() * 0.4)) {
        const side = (r() - 0.5) * 0.6 * Math.min(1, y + 0.3); // la tige s'évase en descendant
        leaves.push({ p, y: H - 0.05 - y, side, rot: (r() - 0.5) * 1.6, s: 0.7 + r() * 0.6 });
      }
    }
    const mat = new THREE.MeshStandardMaterial({
      map: ivyLeafTexture(THREE),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.75
    });
    mat.onBeforeCompile = sh => {
      sh.uniforms.time = E.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float time;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvec3 ip=vec3(instanceMatrix[3]);transformed.x+=sin(time*1.6+ip.x*1.3+ip.y*2.+ip.z)*.03*(1.+position.y*4.);'
        );
    };
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(IVY.leaf, IVY.leaf), mat, leaves.length),
      o = new THREE.Object3D();
    leaves.forEach((L, i) => {
      const { p } = L,
        dx = Math.cos(p.ry),
        dz = -Math.sin(p.ry);
      o.position.set(p.x + dx * L.side, L.y, p.z + dz * L.side);
      o.rotation.set(0, p.ry, L.rot);
      o.scale.setScalar(L.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.receiveShadow = true;
    S.add(mesh);
  }

  // ---- Remparts : maçonnerie crénelée, contreforts, bannières d'équipe, braseros ----
  function buildWalls(THREE, S, arena) {
    const hx = arena.halfX,
      hz = arena.halfZ,
      H = 3.4,
      T = 1.0;
    const masonry = tex(
      THREE,
      stoneCanvas({ size: 512, rows: 6, minW: 0.18, maxW: 0.36, base: [0.52, 0.5, 0.47], moss: 0.3, seed: 21, warp: 2 })
    );
    const wallMat = new THREE.MeshStandardMaterial({ map: masonry, roughness: 0.88 });
    const capMat = new THREE.MeshStandardMaterial({ map: masonry, color: 0xb8b2a6, roughness: 0.85 });
    const box = (w, h, d, x, y, z, mat = wallMat, uvScale = 1) => {
      const geo = new THREE.BoxGeometry(w, h, d),
        uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, ((uv.getX(i) * Math.max(w, d)) / 3) * uvScale, ((uv.getY(i) * h) / 3) * uvScale);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      S.add(m);
      return m;
    };
    const sides = [
      [0, -hz - T / 2, hx * 2 + T * 2, T, false],
      [0, hz + T / 2, hx * 2 + T * 2, T, false],
      [-hx - T / 2, 0, T, hz * 2, true],
      [hx + T / 2, 0, T, hz * 2, true]
    ];
    for (const [x, z, w, d, vert] of sides) {
      // ouverture de la porte d'une salle de départ (poterne : start_rooms.js)
      const len = vert ? d : w,
        gap = ArenaEnv.doorGap(arena, vert ? 'x' : 'z', Math.sign(vert ? x : z)),
        free = (t, m) => !gap || t < gap[0] - m || t > gap[1] + m;
      for (const [a, b] of ArenaEnv.roomAround(-len / 2, len / 2, gap)) {
        const c = (a + b) / 2;
        box(vert ? w : b - a, H, vert ? b - a : d, vert ? x : x + c, H / 2, vert ? z + c : z);
        box(vert ? w + 0.3 : b - a, 0.3, vert ? b - a : d + 0.3, vert ? x : x + c, H + 0.15, vert ? z + c : z, capMat);
      }
      for (let t = -len / 2 + 0.8; t < len / 2; t += 1.6) {
        if (!free(t, 0.8)) continue;
        const mx = vert ? x : x + t,
          mz = vert ? z + t : z;
        box(vert ? T * 0.9 : 0.8, 0.7, vert ? 0.8 : T * 0.9, mx, H + 0.65, mz, capMat);
      } // merlons
      for (let t = -len / 2 + 4; t < len / 2 - 2; t += 8) {
        if (!free(t, 1.3)) continue;
        const bx = vert ? x - Math.sign(x) * 0.0 : x + t,
          bz = vert ? z + t : z;
        box(vert ? T + 1.0 : 1.1, H * 0.85, vert ? 1.1 : T + 1.0, bx, H * 0.425, bz);
      } // contreforts
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        // tours d'angle
        const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, H + 2.2, 10), wallMat);
        t.position.set(sx * (hx + 0.6), (H + 2.2) / 2, sz * (hz + 0.6));
        t.castShadow = t.receiveShadow = true;
        S.add(t);
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(2.8, 3.4, 10),
          new THREE.MeshStandardMaterial({ color: 0x2c4a7a, roughness: 0.6 })
        );
        roof.position.set(sx * (hx + 0.6), H + 2.2 + 1.7, sz * (hz + 0.6));
        roof.castShadow = true;
        S.add(roof);
      }
    // salles de départ derrière les remparts est / ouest : même maçonnerie, dallage, herse de fer
    const paving = tex(
      THREE,
      stoneCanvas({ rows: 5, minW: 0.14, maxW: 0.3, base: [0.5, 0.46, 0.4], vary: 0.16, moss: 0.2, warp: 5, seed: 7 })
    );
    paving.repeat.set(4, 4);
    ArenaEnv.startRooms(THREE, S, arena, E, {
      floor: new THREE.MeshStandardMaterial({ map: paving, roughness: 0.9 }),
      wall: wallMat,
      cap: capMat,
      iron: new THREE.MeshStandardMaterial({ color: 0x2b2c33, metalness: 0.75, roughness: 0.45 }),
      wallH: H,
      box
    });
    // bannières d'équipe ondulantes (rouge à gauche, bleu à droite comme avant)
    const bannerMat = (col, emblem) => {
      const c = canvas(128, 256),
        g = c.getContext('2d');
      g.fillStyle = col;
      g.fillRect(0, 0, 128, 256);
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 3, 256);
      g.fillStyle = '#d9b25a';
      g.fillRect(0, 0, 128, 14);
      g.beginPath();
      g.moveTo(0, 220);
      g.lineTo(64, 256);
      g.lineTo(128, 220);
      g.lineTo(128, 256);
      g.lineTo(0, 256);
      g.fill();
      g.fillStyle = '#e8cf8a';
      g.font = 'bold 80px serif';
      g.textAlign = 'center';
      g.fillText(emblem, 64, 140);
      const m = new THREE.MeshStandardMaterial({
        map: tex(THREE, c, false),
        side: THREE.DoubleSide,
        roughness: 0.8,
        alphaTest: 0.5
      });
      m.onBeforeCompile = sh => {
        sh.uniforms.time = E.time;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float time;')
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nfloat k=(1.5-position.y)/3.;transformed.z+=(sin(time*2.2+position.y*1.6+modelMatrix[3].z)*.5+.5)*.16*k;'
          );
      };
      return m;
    };
    const red = bannerMat('#7a1418', '⚔'),
      blue = bannerMat('#143a7a', '✦');
    for (const side of [-1, 1])
      for (const z of BANNER_Z) {
        const gap = ArenaEnv.doorGap(arena, 'x', side);
        if (gap && z > gap[0] - 1.2 && z < gap[1] + 1.2) continue; // porte de la salle de départ
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3, 4, 8), side < 0 ? red : blue);
        b.position.set(side * (hx - 0.14), 2.1, z);
        b.rotation.y = (-side * Math.PI) / 2;
        b.castShadow = true;
        S.add(b);
      }
    buildIvy(THREE, S, arena, H, BANNER_Z);
    // braseros
    const flame = flameTexture(THREE),
      glow = glowTexture(THREE);
    E.flames = [];
    const bowl = new THREE.MeshStandardMaterial({ color: 0x2e2a26, metalness: 0.6, roughness: 0.5 });
    for (const sx of [-1, 1])
      for (const z of [-13.5, 13.5]) {
        const x = sx * (arena.halfX - 1.6),
          g = new THREE.Group();
        g.position.set(x, 0, z);
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.3, 8), capMat);
        ped.position.y = 0.65;
        ped.castShadow = true;
        g.add(ped);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.35, 12), bowl);
        b.position.y = 1.45;
        b.castShadow = true;
        g.add(b);
        for (let k = 0; k < 3; k++) {
          const f = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: flame,
              blending: THREE.AdditiveBlending,
              transparent: true,
              depthWrite: false
            })
          );
          f.position.set((k - 1) * 0.12, 1.95, 0);
          g.add(f);
          E.flames.push({ s: f, k: k + x });
        }
        const gl = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glow,
            color: 0xff9a40,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: 0.55
          })
        );
        gl.scale.setScalar(4);
        gl.position.y = 1.9;
        g.add(gl);
        const light = new THREE.PointLight(0xff8a3c, 1.2, 9, 2);
        light.position.y = 2.1;
        g.add(light);
        E.flames.push({ light, k: x + z });
        S.add(g);
      }
  }

  ArenaEnv.registerMap('castle', (THREE, S, arena, env) => {
    E = env;
    buildCastleMap(THREE, S, arena);
    // lucioles magiques bleu-violet qui scintillent au clair de lune (render/env_ambient.js)
    ambientMotes(THREE, S, E, {
      area: { hx: arena.halfX, hz: arena.halfZ, y0: 0.3, y1: 4.5 },
      count: E.mobile ? 60 : 140,
      color: 0x9fb8ff,
      size: 0.11,
      sway: 0.8,
      twinkle: 0.9,
      alpha: 0.9,
      seed: 23
    });
  });
})();
