'use strict';
const assert=require('node:assert/strict');
const G=require('../game_logic.js');

const angles=[0,Math.PI/8,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5,-Math.PI/2,-1.1,2.3];
const dot=(a,b)=>a.x*b.x+a.z*b.z;

for(const yaw of angles){
  const rt=G.screenRight(yaw);
  const fw=G.forward(yaw);

  const q=G.moveVector({q:true},yaw);
  const d=G.moveVector({d:true},yaw);
  const z=G.moveVector({z:true},yaw);
  const s=G.moveVector({s:true},yaw);

  assert.ok(dot(q,rt)<-0.999999,`Q doit être gauche à yaw=${yaw}`);
  assert.ok(dot(d,rt)> 0.999999,`D doit être droite à yaw=${yaw}`);
  assert.ok(dot(z,fw)> 0.999999,`Z doit avancer à yaw=${yaw}`);
  assert.ok(dot(s,fw)<-0.999999,`S doit reculer à yaw=${yaw}`);

  const rightLook=G.applyLook(yaw,0,25,0);
  assert.ok(dot(G.forward(rightLook.yaw),rt)>0,`Souris droite doit tourner à droite à yaw=${yaw}`);

  const leftLook=G.applyLook(yaw,0,-25,0);
  assert.ok(dot(G.forward(leftLook.yaw),rt)<0,`Souris gauche doit tourner à gauche à yaw=${yaw}`);
}

const up=G.applyLook(0,.2,0,-20);
const down=G.applyLook(0,.2,0,20);
assert.ok(up.pitch<.2,'Souris vers le haut doit regarder vers le haut');
assert.ok(down.pitch>.2,'Souris vers le bas doit regarder vers le bas');

assert.equal(G.selfCheck(),true);
console.log(`OK - ${angles.length} angles testés, Q/D/Z/S + caméra horizontal/vertical`);
