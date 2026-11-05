'use strict';
// Décor vivant (05/11/2026) : particules d'ambiance animées entièrement par la carte graphique (un appel de dessin
// par nuée, rien à calculer par image côté processeur) et braises au-dessus de chaque flamme du décor.
// Chargé après environment.js : ajoute `ambientMotes` aux outils des cartes (ArenaEnv.helpers) et les braises à
// chaque carte construite (ArenaEnv.afterBuild). Utilisé par map_castle.js (lucioles) et map_bridge.js (poussière).
(function () {
  if (!window.ArenaEnv?.helpers) return;
  const { rng, glowTexture } = ArenaEnv.helpers;
  // Nuée de particules : chaque point part d'un émetteur (ou d'un point de la zone), dérive, monte, scintille.
  //  area : { hx, hz, y0, y1 } (zone centrée sur 0) ou emitters : [[x, y, z], …] avec spread (m) autour ;
  //  rise (m/s) et height (m) : montée puis retour en bas ; sway (m) : balancement ; twinkle : 0 (fixe) à 1.
  function ambientMotes(THREE, S, E, o) {
    const r = rng(o.seed || 17),
      n = o.count,
      pos = new Float32Array(n * 3),
      seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const em = o.emitters?.[i % o.emitters.length],
        sp = o.spread || 0.3;
      pos[i * 3] = em ? em[0] + (r() * 2 - 1) * sp : (r() * 2 - 1) * o.area.hx;
      pos[i * 3 + 1] = em ? em[1] : o.area.y0 + r() * (o.area.y1 - o.area.y0);
      pos[i * 3 + 2] = em ? em[2] + (r() * 2 - 1) * sp : (r() * 2 - 1) * o.area.hz;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    const c = new THREE.Color(o.color),
      mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          time: E.time,
          px: E.px,
          map: { value: glowTexture(THREE) },
          col: { value: new THREE.Vector3(c.r, c.g, c.b) },
          size: { value: o.size || 0.12 },
          rise: { value: o.rise || 0 },
          height: { value: o.height || 1 },
          sway: { value: o.sway ?? 0.4 },
          twinkle: { value: o.twinkle ?? 0.6 },
          alpha: { value: o.alpha ?? 0.8 }
        },
        vertexShader: `uniform float time,px,size,rise,height,sway,twinkle;attribute float seed;varying float vA;
          void main(){float t=time*(.6+seed*.8)+seed*50.;
          float up=rise>0.?mod(t*rise*.5+seed*height,height):0.;
          vec3 p=position+vec3(sin(t*.7+seed*9.)*sway,up+sin(t*.5+seed*4.)*sway*.4,cos(t*.6+seed*7.)*sway);
          float life=rise>0.?sin(3.1416*up/height):1.;
          vA=life*mix(1.,.5+.5*sin(t*3.+seed*20.),twinkle);
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(size*px/max(.1,-mv.z),18.);vA*=smoothstep(.8,2.5,-mv.z);gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `uniform sampler2D map;uniform vec3 col;uniform float alpha;varying float vA;
          void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(col*t.a*vA*alpha,1.);}`
      });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.userData.dynamic = true; // pas de fusion des maillages fixes
    S.add(pts);
    return pts;
  }
  // Braises : quelques étincelles orangées qui montent de chaque flamme du décor (torches, braseros).
  function flameEmbers(THREE, S, arena, E) {
    const at = (E.flames || []).filter(f => f.s).map(f => f.s.position.toArray());
    if (!at.length) return;
    ambientMotes(THREE, S, E, {
      emitters: at,
      count: at.length * (E.mobile ? 3 : 7),
      spread: 0.12,
      color: 0xffa040,
      size: 0.07,
      rise: 1.1,
      height: 1.6,
      sway: 0.12,
      twinkle: 0.4,
      seed: 5
    });
  }
  ArenaEnv.helpers.ambientMotes = ambientMotes;
  ArenaEnv.afterBuild(flameEmbers);
})();
