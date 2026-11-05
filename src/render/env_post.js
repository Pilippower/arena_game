'use strict';
// Post-traitement du décor (#env3d, PC seulement) : bloom (halo des lumières vives : torches, cristaux, runes, ciel)
// et étalonnage (saturation, contraste, vignette). Utilisé par environment.js (render) quand il est disponible ;
// les personnages et les sorts (canevas #character3d, au-dessus) ne passent pas par ici.
// Chaîne : scène → texture pleine résolution (anticrénelage WebGL2) → extraction des zones claires à 1/4 → flou
// séparable (2 passes aller-retour) → composition + étalonnage à l'écran. Tout en espace d'affichage (sRGB), comme
// l'image d'origine : la texture de scène est encodée sRGB, les shaders de passe écrivent les valeurs telles quelles.
const ENV_POST = {
  threshold: 0.86, // luminance à partir de laquelle un pixel rayonne
  strength: 0.5, // force du halo
  saturation: 1.08,
  contrast: 1.06,
  vignette: 0.22
};
function createEnvPost(THREE, renderer) {
  const webgl2 = renderer.capabilities.isWebGL2,
    RT = (w, h, msaa) => {
      const t =
        msaa && webgl2 && THREE.WebGLMultisampleRenderTarget
          ? new THREE.WebGLMultisampleRenderTarget(w, h)
          : new THREE.WebGLRenderTarget(w, h);
      t.texture.encoding = THREE.sRGBEncoding;
      t.texture.generateMipmaps = false;
      return t;
    };
  const scene = RT(1, 1, true),
    ping = RT(1, 1, false),
    pong = RT(1, 1, false),
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)),
    qScene = new THREE.Scene(),
    qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  qScene.add(quad);
  const vert = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    pass = (frag, uniforms) =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false
      });
  const bright = pass(
      `uniform sampler2D src;uniform float th;varying vec2 vUv;
      void main(){vec3 c=texture2D(src,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));
      gl_FragColor=vec4(c*smoothstep(th,th+.12,l),1.);}`,
      { src: { value: null }, th: { value: ENV_POST.threshold } }
    ),
    blur = pass(
      `uniform sampler2D src;uniform vec2 dir;varying vec2 vUv;
      void main(){vec3 s=texture2D(src,vUv).rgb*.227;
      s+=(texture2D(src,vUv+dir*1.385).rgb+texture2D(src,vUv-dir*1.385).rgb)*.316;
      s+=(texture2D(src,vUv+dir*3.231).rgb+texture2D(src,vUv-dir*3.231).rgb)*.07;
      gl_FragColor=vec4(s,1.);}`,
      { src: { value: null }, dir: { value: new THREE.Vector2() } }
    ),
    final = pass(
      `uniform sampler2D src;uniform sampler2D glow;uniform float k,sat,con,vig;varying vec2 vUv;
      void main(){vec3 c=texture2D(src,vUv).rgb+texture2D(glow,vUv).rgb*k;
      float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,sat);c=(c-.5)*con+.5;
      vec2 d=vUv-.5;c*=1.-vig*dot(d,d)*2.;gl_FragColor=vec4(c,1.);}`,
      {
        src: { value: scene.texture },
        glow: { value: null },
        k: { value: ENV_POST.strength },
        sat: { value: ENV_POST.saturation },
        con: { value: ENV_POST.contrast },
        vig: { value: ENV_POST.vignette }
      }
    );
  const draw = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(qScene, qCam);
  };
  let W = 0,
    H = 0;
  function render(world, camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== W || size.y !== H) {
      W = size.x;
      H = size.y;
      scene.setSize(W, H);
      ping.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2));
      pong.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2));
    }
    renderer.setRenderTarget(scene);
    renderer.render(world, camera);
    bright.uniforms.src.value = scene.texture;
    draw(bright, ping);
    for (let i = 0; i < 2; i++) {
      blur.uniforms.src.value = ping.texture;
      blur.uniforms.dir.value.set(1 / ping.width, 0);
      draw(blur, pong);
      blur.uniforms.src.value = pong.texture;
      blur.uniforms.dir.value.set(0, 1 / ping.height);
      draw(blur, ping);
    }
    final.uniforms.glow.value = ping.texture;
    draw(final, null);
  }
  return { render };
}
