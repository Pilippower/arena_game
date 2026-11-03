'use strict';
// Portraits des cadres d'unité, rendus depuis les modèles 3D des personnages.
function hfMakePortraits() {
  const u = state.units.find(v => {
    const r = HF.records.get(v.id);
    return r?.loaded && r.model && !r.portrait && v.alive && !(v.poly > 0);
  });
  if (!u) return;
  const rec = HF.records.get(u.id),
    R = HF.renderer,
    S = 128;
  if (!HF.prt) {
    HF.prt = new THREE.WebGLRenderTarget(S, S);
    HF.prt.texture.encoding = THREE.sRGBEncoding;
    HF.pcam = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  }
  rec.group.updateMatrixWorld(true);
  const head = rec.model.getObjectByName('Head'),
    hp = new THREE.Vector3();
  if (head) head.getWorldPosition(hp);
  else {
    const b = new THREE.Box3().setFromObject(rec.model);
    hp.set((b.min.x + b.max.x) / 2, b.max.y - 0.3, (b.min.z + b.max.z) / 2);
  }
  hp.y += 0.07 * rec.group.scale.y;
  const yaw = rec.group.rotation.y,
    cam = HF.pcam;
  cam.position.set(hp.x + Math.sin(yaw + 0.35) * 0.82, hp.y + 0.06, hp.z + Math.cos(yaw + 0.35) * 0.82);
  cam.lookAt(hp.x, hp.y - 0.02, hp.z);
  const hidden = [];
  for (const o of HF.scene.children)
    if (o !== rec.group && !o.isLight && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  const cc = new THREE.Color();
  R.getClearColor(cc);
  const ca = R.getClearAlpha();
  R.setRenderTarget(HF.prt);
  R.setClearColor(0x000000, 0);
  R.clear();
  R.render(HF.scene, cam);
  const px = new Uint8Array(S * S * 4);
  R.readRenderTargetPixels(HF.prt, 0, 0, S, S, px);
  R.setRenderTarget(null);
  R.setClearColor(cc, ca);
  for (const o of hidden) o.visible = true;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'),
    id = g.createImageData(S, S);
  for (let y = 0; y < S; y++) id.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  g.putImageData(id, 0, 0);
  rec.portrait = c.toDataURL();
}
