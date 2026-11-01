(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpellFX = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Effets de sorts lumineux (three.js, dans la scène des personnages) : particules additives en un seul
  // appel de dessin, anneaux au sol, bulles, éclairs de lumière. Reçoit les mêmes appels que fx() du jeu.
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp = (a, b, t) => a + (b - a) * t,
    rnd = (a = 1) => (Math.random() * 2 - 1) * a;
  const X = { ok: false };
  const MAXP = 3600,
    GROW = 1.5,
    DENSE = 1.5;

  function glowTex(THREE) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d'),
      gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,.85)');
    gr.addColorStop(0.45, 'rgba(255,255,255,.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function ringTex(THREE, runes) {
    const S = 256,
      c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d'),
      C = S / 2;
    const gr = g.createRadialGradient(C, C, C * 0.62, C, C, C);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.38, 'rgba(255,255,255,.25)');
    gr.addColorStop(0.6, 'rgba(255,255,255,1)');
    gr.addColorStop(0.78, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    if (runes) {
      g.strokeStyle = 'rgba(255,255,255,.8)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(C, C, C * 0.5, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 2 * 3,
          r = C * 0.48;
        g.lineTo(C + Math.sin(a) * r, C + Math.cos(a) * r);
      }
      g.stroke();
      g.font = 'bold 20px serif';
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const gl = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.save();
        g.translate(C + Math.sin(a) * C * 0.66, C + Math.cos(a) * C * 0.66);
        g.rotate(-a);
        g.fillText(gl[k], 0, 0);
        g.restore();
      }
    }
    return new THREE.CanvasTexture(c);
  }

  function init(THREE, scene, renderer, camera) {
    X.THREE = THREE;
    X.scene = scene;
    X.renderer = renderer;
    X.camera = camera;
    const geo = new THREE.BufferGeometry();
    X.pos = new Float32Array(MAXP * 3);
    X.col = new Float32Array(MAXP * 3);
    X.siz = new Float32Array(MAXP);
    X.alp = new Float32Array(MAXP);
    geo.setAttribute('position', new THREE.BufferAttribute(X.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(X.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(X.siz, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(X.alp, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    X.uScale = { value: 400 };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { map: { value: glowTex(THREE) }, scale: X.uScale },
      vertexShader: `attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vC;varying float vA;uniform float scale;
        void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*scale/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform sampler2D map;varying vec3 vC;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);vec3 hot=mix(vC,vec3(1.),smoothstep(.55,1.,t.r)*.6);gl_FragColor=vec4(hot*t.rgb*vA*2.4,t.a*vA);}`
    });
    X.points = new THREE.Points(geo, mat);
    X.points.frustumCulled = false;
    X.points.renderOrder = 20;
    scene.add(X.points);
    X.parts = [];
    X.meshes = [];
    X.lights = [];
    X.casting = new Map();
    X.glow = glowTex(THREE);
    X.ringT = ringTex(THREE, false);
    X.runeT = ringTex(THREE, true);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 7, 2);
      l.visible = false;
      scene.add(l);
      X.lights.push({ l, life: 0, max: 1, power: 0 });
    }
    X.ok = true;
    return true;
  }

  // ---- primitives ----
  function emit(o) {
    if (X.parts.length >= MAXP) X.parts.shift();
    const p = Object.assign(
      {
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        g: 0,
        drag: 0,
        size: 0.2,
        size1: null,
        life: 0.6,
        age: 0,
        r: 1,
        gg: 1,
        b: 1,
        a: 1
      },
      o
    );
    p.size *= GROW;
    if (p.size1 != null) p.size1 *= GROW;
    X.parts.push(p);
  }
  const C3 = c => ({ r: c[0], gg: c[1], b: c[2] });
  function burst(x, y, z, c, n, speed, size, life, { up = 0, g = -2, spread = 1, white = 0.25 } = {}) {
    n = Math.round(n * DENSE);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2,
        ph = Math.acos(rnd()),
        s = speed * (0.4 + Math.random() * 0.8);
      const w = Math.random() < white;
      emit({
        x,
        y,
        z,
        vx: Math.sin(ph) * Math.cos(th) * s * spread,
        vy: Math.cos(ph) * s + up,
        vz: Math.sin(ph) * Math.sin(th) * s * spread,
        g,
        drag: 2.2,
        size: size * (0.6 + Math.random() * 0.8),
        size1: 0,
        life: life * (0.6 + Math.random() * 0.6),
        ...(w ? { r: 1, gg: 1, b: 1 } : C3(c))
      });
    }
  }
  function flash(x, y, z, c, power = 2.5, life = 0.35) {
    const L = X.lights.reduce((a, b) => (a.life < b.life ? a : b));
    L.l.position.set(x, y, z);
    L.l.color.setRGB(c[0], c[1], c[2]);
    L.life = L.max = life;
    L.power = power;
    L.l.visible = true;
    emit({ x, y, z, size: (2.2 * power) / 2.5, size1: (3.2 * power) / 2.5, life: life * 0.8, ...C3(c), a: 0.55 });
  }
  function ring(x, y, z, c, r0, r1, life, { runes = false, flat = true, rot = 0, tex = null } = {}) {
    const T = X.THREE,
      m = new T.Mesh(
        new T.PlaneGeometry(1, 1),
        new T.MeshBasicMaterial({
          map: tex || (runes ? X.runeT : X.ringT),
          color: new T.Color(c[0], c[1], c[2]),
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
          side: T.DoubleSide
        })
      );
    if (flat) m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 19;
    X.scene.add(m);
    X.meshes.push({ m, r0, r1, life, max: life, spin: rot, kind: 'ring' });
  }
  function bubble(x, y, z, c, size, life, ref = null) {
    const T = X.THREE,
      mat = new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: { c: { value: new T.Color(c[0], c[1], c[2]) }, a: { value: 1 } },
        vertexShader:
          'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
        fragmentShader:
          'uniform vec3 c;uniform float a;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),2.2);gl_FragColor=vec4(c*(f*1.5+.08)*a,1.);}'
      });
    const m = new T.Mesh(new T.SphereGeometry(1, 24, 16), mat);
    m.scale.set(size, size * 1.25, size);
    m.position.set(x, y, z);
    m.renderOrder = 18;
    X.scene.add(m);
    X.meshes.push({ m, life, max: life, kind: 'bubble', ref, size });
  }
  function orb(from, to, c, size, life) {
    X.meshes.push({ kind: 'orb', from, to, c, size, life, max: life, emitT: 0 });
  }

  // ---- traduction des effets du jeu ----
  function spawn(f) {
    if (!X.ok) return false;
    const c = f.color || [1, 1, 1],
      x = f.x,
      y = f.y,
      z = f.z,
      s = f.size || 0.4,
      L = f.life || 0.6,
      t = f.type;
    switch (t) {
      case 'arcaneProjectile':
      case 'shadowProjectile':
      case 'projectile':
        if (f.to) {
          orb([x, y, z], f.to, c, s, L);
          return true;
        }
        return false;
      case 'arcaneImpact':
      case 'shadowImpact':
      case 'burst':
        burst(x, y, z, c, t === 'burst' ? 14 : 34, t === 'burst' ? 2.2 : 4.2, t === 'burst' ? 0.22 : 0.32, 0.55, {
          g: -1
        });
        if (t !== 'burst') flash(x, y, z, c, 4, 0.45);
        return true;
      case 'nova':
      case 'frostAura':
        ring(x, 0.06, z, c, 0.4, s * 4.2, L * 1.1, { runes: true, rot: 0.8 });
        burst(x, 0.3, z, c, 60, 6, 0.3, 0.7, { up: 1.5, spread: 1.3, g: -3 });
        flash(x, 1, z, c, 3, 0.45);
        return true;
      case 'holyBurst':
        ring(x, 0.06, z, c, 0.3, s * 3.6, L, { runes: true, rot: -0.6 });
        burst(x, 0.5, z, c, 50, 3.5, 0.3, 1, { up: 3, g: 0.5, white: 0.4 });
        flash(x, 1.2, z, c, 3, 0.5);
        return true;
      case 'aura':
      case 'darkAura':
        ring(x, 0.06, z, c, 0.6, s * 2.6, L, { runes: true, rot: 1.4 });
        burst(x, 0.4, z, c, 30, 1.8, 0.26, 1.1, { up: 2.5, g: 0.6 });
        return true;
      case 'ring':
        ring(x, Math.max(0.05, y), z, c, 0.3, s * 2.4, L * 0.9);
        burst(x, Math.max(0.2, y), z, c, 14, 2, 0.18, 0.5, { up: 1 });
        return true;
      case 'castArcane':
      case 'castShadow':
      case 'healCast':
        ring(x, 0.05, z, c, 1.1, 1.4, L * 1.2, { runes: true, rot: 2 });
        return true;
      case 'healBeam':
        if (f.to) {
          orb([x, y, z], f.to, [c[0] * 0.6 + 0.4, c[1] * 0.6 + 0.4, c[2] * 0.6 + 0.4], 0.22, L);
          burst(f.to[0], f.to[1] - 0.6, f.to[2], c, 26, 1.2, 0.22, 1.1, { up: 2.2, g: 0.4, white: 0.4 });
          return true;
        }
        return false;
      case 'shield':
        bubble(x, y, z, c, Math.max(0.7, s * 1.1), L * 1.4);
        burst(x, y, z, c, 24, 2, 0.2, 0.6);
        return true;
      case 'cloak':
        bubble(x, y, z, c, 0.85, L * 1.2);
        burst(x, y, z, [0.3, 0.3, 0.35], 30, 1.6, 0.3, 0.8, { up: 0.6, g: 0.2 });
        return true;
      case 'blinkBurst':
        burst(x, y, z, c, 40, 4.5, 0.26, 0.5, { g: 0, white: 0.4 });
        flash(x, y, z, c, 2, 0.3);
        return true;
      case 'blinkRibbon':
      case 'trail':
      case 'chargeTrail':
      case 'chain':
        if (f.to) {
          const n = t === 'chain' ? 22 : 14;
          for (let i = 0; i < n; i++) {
            const q = i / (n - 1);
            emit({
              x: lerp(x, f.to[0], q) + rnd(0.08),
              y: lerp(y, f.to[1], q) + rnd(0.08),
              z: lerp(z, f.to[2], q) + rnd(0.08),
              vy: 0.3,
              size: s * (t === 'chain' ? 0.5 : 0.7),
              size1: 0,
              life: L * (0.6 + q * 0.6),
              ...C3(c)
            });
          }
          return true;
        }
        return false;
      case 'chargeStart':
      case 'chargeImpact':
        burst(x, 0.3, z, [0.75, 0.65, 0.5], 30, 3.5, 0.32, 0.6, { up: 1, g: -4, spread: 1.4, white: 0.1 });
        burst(x, y, z, c, 20, 3, 0.25, 0.45);
        if (t === 'chargeImpact') flash(x, y, z, c, 2, 0.3);
        return true;
      case 'silence':
      case 'fear':
      case 'stun':
        ring(x, y + 0.9, z, c, 0.5, 0.75, L, { runes: true, rot: 3 });
        burst(x, y + 0.9, z, c, 20, 1.2, 0.2, 0.8, { up: 0.4, g: 0 });
        return true;
      case 'roots':
      case 'snare':
        ring(x, 0.05, z, c, 0.4, s * 1.6, L * 1.3, { runes: true, rot: -1 });
        burst(x, 0.2, z, c, 30, 1.4, 0.22, 1, { up: 1.2, g: -0.5, spread: 0.6 });
        return true;
      case 'starfall':
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2,
            r = Math.random() * 2.6,
            h = 4 + Math.random() * 2;
          emit({
            x: x + Math.sin(a) * r,
            y: h,
            z: z + Math.cos(a) * r,
            vy: -9 - Math.random() * 3,
            size: 0.35,
            life: 0.45 + Math.random() * 0.25,
            ...C3(c)
          });
        }
        ring(x, 0.05, z, c, 0.5, 3, L * 1.4, { runes: true, rot: 0.5 });
        return true;
      case 'slash': {
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = -1 + (i / (n - 1)) * 2,
            r = s * 1.6;
          emit({
            x: x + Math.sin(a) * r,
            y: y + Math.cos(a * 0.8) * 0.2,
            z: z + Math.cos(a) * r * 0.4,
            size: 0.22,
            size1: 0,
            life: 0.25 + i * 0.01,
            ...C3(c)
          });
        }
        return true;
      }
      default:
        return false;
    }
  }

  // Lueur pendant l'incantation : main qui rayonne, particules qui convergent.
  function casting(units, handPos, dt) {
    for (const u of units) {
      if (!u.alive || !u.cast) continue;
      const h = handPos(u);
      if (!h) continue;
      const c = u.castColor || [0.7, 0.6, 1];
      const k = clamp(1 - (u.cast.end - performance.now() / 1000) / u.cast.dur, 0, 1);
      for (let e = 0; e < Math.ceil(dt * 90); e++) {
        const a = Math.random() * Math.PI * 2,
          r = 0.5 + Math.random() * 0.4;
        emit({
          x: h.x + Math.sin(a) * r,
          y: h.y + rnd(0.4),
          z: h.z + Math.cos(a) * r,
          vx: -Math.sin(a) * r * 2.2,
          vy: rnd(0.3),
          vz: -Math.cos(a) * r * 2.2,
          size: 0.14,
          size1: 0.02,
          life: 0.42,
          ...C3(c)
        });
      }
      emit({ x: h.x, y: h.y, z: h.z, size: 0.55 + k * 0.75, size1: 0.55 + k * 0.75, life: 0.05, ...C3(c), a: 0.6 });
      emit({
        x: h.x,
        y: h.y,
        z: h.z,
        size: 0.1 + k * 0.12,
        size1: 0.1 + k * 0.12,
        life: 0.05,
        r: 1,
        gg: 1,
        b: 1,
        a: 0.7
      });
    }
  }

  function update(dt, units, handPos) {
    if (!X.ok) return;
    const R = X.renderer,
      cam = X.camera,
      H = R.getDrawingBufferSize ? R.getDrawingBufferSize(new X.THREE.Vector2()).y : 600;
    X.uScale.value = H / (2 * Math.tan((cam.fov * Math.PI) / 360));
    if (units && handPos) casting(units, handPos, dt);
    for (const o of X.meshes) {
      o.life -= dt;
      const k = clamp(1 - o.life / o.max, 0, 1);
      if (o.kind === 'ring') {
        const r = lerp(o.r0, o.r1, 1 - Math.pow(1 - k, 2.2));
        o.m.scale.set(r * 2, r * 2, 1);
        o.m.rotation.z += o.spin * dt;
        o.m.material.opacity = Math.pow(1 - k, 1.3);
      } else if (o.kind === 'bubble') {
        o.m.material.uniforms.a.value = Math.min(1, o.life * 3) * (0.8 + Math.sin(k * 20) * 0.08);
      } else if (o.kind === 'orb') {
        const q = k,
          px = lerp(o.from[0], o.to[0], q),
          py = lerp(o.from[1], o.to[1], q) + Math.sin(q * Math.PI) * 0.35,
          pz = lerp(o.from[2], o.to[2], q);
        emit({ x: px, y: py, z: pz, size: o.size * 2.4, size1: o.size * 2.4, life: 0.03, ...C3(o.c), a: 0.8 });
        emit({ x: px, y: py, z: pz, size: o.size * 0.9, size1: o.size * 0.9, life: 0.03, r: 1, gg: 1, b: 1 });
        if (!o.light) {
          o.light = X.lights.reduce((a, b) => (a.life < b.life ? a : b));
          o.light.l.color.setRGB(o.c[0], o.c[1], o.c[2]);
        }
        o.light.l.visible = true;
        o.light.l.position.set(px, py, pz);
        o.light.life = o.light.max = 0.12;
        o.light.power = 2.5;
        for (let i = 0; i < 6; i++)
          emit({
            x: px + rnd(0.06),
            y: py + rnd(0.06),
            z: pz + rnd(0.06),
            vx: rnd(0.4),
            vy: rnd(0.4),
            vz: rnd(0.4),
            size: o.size * 0.7,
            size1: 0,
            life: 0.35,
            ...C3(o.c)
          });
        if (o.life <= 0) {
          burst(o.to[0], o.to[1], o.to[2], o.c, 30, 3.8, 0.3, 0.5, { g: -1 });
          flash(o.to[0], o.to[1], o.to[2], o.c, 2.2, 0.3);
        }
      }
    }
    X.meshes = X.meshes.filter(o => {
      if (o.life > 0) return true;
      if (o.m) {
        X.scene.remove(o.m);
        o.m.geometry.dispose();
        o.m.material.dispose();
      }
      return false;
    });
    for (const L of X.lights) {
      if (L.life <= 0) {
        L.l.visible = false;
        continue;
      }
      L.life -= dt;
      L.l.intensity = L.power * clamp(L.life / L.max, 0, 1);
    }
    // particules
    const P = X.parts;
    let n = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy = p.vy * dr + p.g * dt;
      p.vz *= dr;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = p.age / p.life,
        a = p.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      X.pos[n * 3] = p.x;
      X.pos[n * 3 + 1] = p.y;
      X.pos[n * 3 + 2] = p.z;
      X.col[n * 3] = p.r;
      X.col[n * 3 + 1] = p.gg;
      X.col[n * 3 + 2] = p.b;
      X.siz[n] = p.size1 == null ? p.size : lerp(p.size, p.size1, k);
      X.alp[n] = Math.max(0, a);
      P[n] = p;
      n++;
    }
    P.length = n;
    const g = X.points.geometry;
    g.setDrawRange(0, n);
    for (const k of ['position', 'color', 'size', 'alpha']) g.attributes[k].needsUpdate = true;
  }
  return {
    init,
    spawn,
    update,
    get ok() {
      return X.ok;
    }
  };
});
