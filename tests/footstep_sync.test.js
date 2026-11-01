'use strict';
// Les pas suivent la phase réelle de l'animation de course et utilisent un bruit filtré (pas de bip).
const { flat } = require('./sources.js');
const html = flat();
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}
ok(html.includes('rec.footPhase=null'), 'foot phase reset missing');
ok(/crossed\(0?\.16\)/.test(html) && /crossed\(0?\.66\)/.test(html), 'foot contacts not tied to animation phase');
ok(html.includes('rec.action.getClip?.()'), 'footsteps do not read actual animation clip');
ok(!/u\.stepCd=clamp\(0?\.34-moveSpeed\(u\)\*0?\.028/.test(html), 'old timer-based footsteps still active');
ok(html.includes('functionfootstepNoiseLayer'), 'natural noise footstep layer missing');
const fn = html.slice(html.indexOf('functionfootstepSfx'), html.indexOf('functionspellFlavorLayer'));
ok(!fn.includes('sfxTone('), 'footstep still uses oscillator tone/beep');
ok(fn.includes("kind:'lowpass'") && fn.includes("kind:'bandpass'"), 'footstep texture layers missing');
console.log('OK - pas synchronisés à l’animation + bruit naturel sans bip');
