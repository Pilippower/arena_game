'use strict';
// Les pas suivent la phase réelle de l'animation de course et utilisent un bruit filtré (pas de bip).
const { flat } = require('./sources.js');
const html = flat();
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}
ok(html.includes('rec.footPhase=null'), 'foot phase reset missing');
ok(
  html.includes('FOOT_CONTACTS[clip.name]') && html.includes('Jog_Fwd_Loop:[0.01,0.51]'),
  'foot contacts not tied to measured foot strikes'
);
ok(html.includes('constfwd=rec.action.timeScale>=0'), 'reversed walk (back) must not spam footsteps');
ok(
  /functionfootstepSpatial[\s\S]*FOOT_HEAR/.test(html) && html.includes('if(a.level<0.01)return;'),
  'distant footsteps must fade out to silence'
);
ok(html.includes('rec.action.getClip?.()'), 'footsteps do not read actual animation clip');
ok(!/u\.stepCd=clamp\(0?\.34-moveSpeed\(u\)\*0?\.028/.test(html), 'old timer-based footsteps still active');
ok(html.includes('functionfootstepNoiseLayer'), 'natural noise footstep layer missing');
const fn = html.slice(html.indexOf('functionfootstepSfx'), html.indexOf('functionopenSettings'));
ok(!fn.includes('sfxTone('), 'footstep still uses oscillator tone/beep');
ok(fn.includes("kind:'lowpass'") && fn.includes("kind:'bandpass'"), 'footstep texture layers missing');
console.log('OK - pas synchronisés à l’animation + bruit naturel sans bip');
