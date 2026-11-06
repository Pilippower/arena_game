(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShieldAura = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Bulle de bouclier (05/11/2026, demande de l'utilisateur) : tant qu'une unité a un bouclier d'absorption
  // (u.shield > 0 : Power Shield, Arcane Barrier, Shield Wall, trinket), une bulle magique l'entoure, à l'aspect du sort
  // (SHIELD_LOOK, lu par u.shieldName). Elle apparaît d'un coup, s'éclaire à chaque coup absorbé, pâlit quand le bouclier
  // s'use et éclate quand il disparaît. Scène des personnages (render/heroes3d.js : init + update à chaque image,
  // compilée au chargement par warm, core/loading.js). Rendu seul : la règle du bouclier est dans damage() (combat.js).
  const SHIELD_LOOK = {
    'Power Shield': { c: [1, 0.78, 0.32], hex: 0.45, runes: 0.9 }, // lumière sacrée dorée, anneau de runes
    'Arcane Barrier': { c: [0.66, 0.42, 1], hex: 0.35, runes: 1 }, // arcanes violettes
    'Shield Wall': { c: [0.42, 0.72, 1], hex: 1, runes: 0 }, // plaques d'acier bleuté en nid d'abeille
    Trinket: { c: [1, 0.7, 0.28], hex: 0.3, runes: 0 }
  };
  const DEFAULT_LOOK = { c: [0.4, 0.78, 1], hex: 0.5, runes: 0.3 },
    POP = 0.25, // s : apparition
    BREAK = 0.4, // s : éclatement
    RADIUS = 0.95, // m, rayon horizontal ; hauteur × VSTRETCH
    VSTRETCH = 1.2,
    CENTER_Y = 1.1;
  const S = { ok: false, rec: new Map() },
    WARM_ID = 'warm'; // bulle compilée au chargement (warm), hors des unités

  const VERT = `varying vec3 vN;varying vec3 vV;varying vec3 vP;
    void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);
    vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`;
  // nid d'abeille en projection triplanaire (pas de pincement aux pôles, vus d'en haut par la caméra), anneau de runes
  // qui tourne, reflet qui monte, éclair des coups absorbés (hit)
  const FRAG = `uniform vec3 c;uniform float a;uniform float t;uniform float hit;uniform float hex;uniform float runes;
    varying vec3 vN;varying vec3 vV;varying vec3 vP;
    vec2 hcell(vec2 p){const vec2 s=vec2(1.,1.732);vec2 q=mod(p,s)-s*.5;vec2 r=mod(p-s*.5,s)-s*.5;return dot(q,q)<dot(r,r)?q:r;}
    float hedge(vec2 p){vec2 h=abs(hcell(p*5.));return smoothstep(.36,.47,max(dot(h,vec2(.5,.866)),h.x));}
    void main(){
      vec3 n=normalize(vP);vec3 w=pow(abs(n),vec3(4.));w/=w.x+w.y+w.z;
      float e=hedge(vP.yz)*w.x+hedge(vP.xz)*w.y+hedge(vP.xy)*w.z;
      float f=pow(1.-abs(dot(vN,vV)),2.4);
      float ang=atan(vP.z,vP.x);
      float band=smoothstep(.07,.02,abs(n.y-.12*sin(ang*2.+t*1.3)))*step(.45,fract(ang*3.82+t*.35));
      float sweep=smoothstep(.12,0.,abs(n.y-(fract(t*.4)*2.4-1.2)));
      float l=f*1.3+.015+e*hex*(.05+f*.55)+band*runes*.55*(.3+f)+sweep*.1+hit*(.25+e*.6+f);
      vec3 g=min((c*l+vec3(hit*f*.6))*a,vec3(1.));gl_FragColor=vec4(g,max(g.r,max(g.g,g.b)));}`;

  function material(THREE) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      // lueur en couleur prémultipliée (opacité = intensité) : le calque des personnages est un canevas transparent posé
      // sur le décor ; en mélange additif, l'opacité 1 rendait la bulle noire et opaque (06/11/2026, « orbes noires »)
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        c: { value: new THREE.Color() },
        a: { value: 0 },
        t: { value: 0 },
        hit: { value: 0 },
        hex: { value: 0 },
        runes: { value: 0 }
      },
      vertexShader: VERT,
      fragmentShader: FRAG
    });
  }
  function init(THREE, scene) {
    S.THREE = THREE;
    S.scene = scene;
    S.geo = new THREE.SphereGeometry(1, 32, 20);
    S.ok = true;
  }
  function bubbleOf(id) {
    let b = S.rec.get(id);
    if (!b) {
      const m = new S.THREE.Mesh(S.geo, material(S.THREE));
      m.renderOrder = 17;
      m.visible = false;
      S.scene.add(m);
      S.rec.set(id, (b = { m, show: 0, brk: 0, hit: 0, max: 0, last: 0, look: DEFAULT_LOOK }));
    }
    return b;
  }
  // Une bulle à compiler pendant le chargement (même shader pour toutes) : renvoyée pour être montrée le temps de
  // renderer.compile.
  function warm() {
    return S.ok ? bubbleOf(WARM_ID).m : null;
  }
  // Opacité selon le camouflage : alliés à demi visibles, ennemis camouflés invisibles (la bulle ne les trahit pas).
  function stealthAlpha(u, viewer) {
    if (!u.stealth) return 1;
    return u.team === viewer?.team ? 0.35 : 0;
  }
  const easeOutBack = k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

  // units : toutes les unités ; holder(u) : objet three.js du personnage (position, échelle) ou null ; viewer : joueur.
  function update(dt, units, holder, viewer, time) {
    if (!S.ok) return;
    for (const u of units || []) {
      const g = holder(u);
      if (!g) {
        if (S.rec.has(u.id)) S.rec.get(u.id).m.visible = false;
        continue;
      }
      const b = bubbleOf(u.id),
        sh = u.alive ? u.shield || 0 : 0;
      if (sh > 0) {
        if (b.last <= 0) Object.assign(b, { show: 0, brk: 0, max: sh });
        else if (sh < b.last - 0.5) b.hit = 1;
        b.max = Math.max(b.max, sh);
        b.look = SHIELD_LOOK[u.shieldName] || DEFAULT_LOOK;
        b.show = Math.min(1, b.show + dt / POP);
      } else if (b.last > 0) {
        b.brk = BREAK;
        b.hit = 1;
      }
      b.last = sh;
      b.hit = Math.max(0, b.hit - dt * 3.5);
      b.brk = Math.max(0, b.brk - dt);
      const breaking = sh <= 0 && b.brk > 0,
        on = sh > 0 || breaking;
      b.m.visible = on;
      if (!on) continue;
      const k = breaking ? 1 - b.brk / BREAK : 0,
        wear = sh > 0 ? 0.55 + (0.45 * sh) / b.max : 0.8,
        sc = (g.scale?.y || 1) * (breaking ? 1 + k * 0.35 : 0.7 + 0.3 * easeOutBack(b.show)),
        U = b.m.material.uniforms;
      b.m.position.set(g.position.x, g.position.y + CENTER_Y * (g.scale?.y || 1), g.position.z);
      b.m.scale.set(RADIUS * sc, RADIUS * VSTRETCH * sc, RADIUS * sc);
      U.c.value.setRGB(...b.look.c);
      U.hex.value = b.look.hex;
      U.runes.value = b.look.runes;
      U.hit.value = b.hit;
      U.t.value = time;
      U.a.value = (breaking ? 1 - k : Math.min(1, b.show * 2)) * wear * stealthAlpha(u, viewer);
    }
    dropGone(units);
  }
  // Bulles des unités disparues (nouvelle manche ou nouveau match : unités recréées avec un autre id) : retirées. Bug
  // du 06/11/2026 : un bouclier encore actif en fin de manche laissait sa bulle figée « au hasard » dans la carte.
  function dropGone(units) {
    const live = new Set((units || []).map(u => u.id));
    for (const [id, b] of S.rec) {
      if (id === WARM_ID || live.has(id)) continue;
      S.scene.remove(b.m);
      b.m.material.dispose();
      S.rec.delete(id);
    }
  }
  return {
    init,
    update,
    warm,
    SHIELD_LOOK,
    get ok() {
      return S.ok;
    }
  };
});
