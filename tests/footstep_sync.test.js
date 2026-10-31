const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
function ok(cond,msg){if(!cond)throw new Error(msg)}
ok(html.includes("rec.footPhase=null"),'foot phase reset missing');
ok(html.includes("crossed(.16)")&&html.includes("crossed(.66)"),'foot contacts not tied to animation phase');
ok(html.includes("rec.action.getClip?.()"),'footsteps do not read actual animation clip');
ok(!html.includes("u.stepCd=clamp(.34-moveSpeed(u)*.028"),'old timer-based footsteps still active');
ok(html.includes('function footstepNoiseLayer'),'natural noise footstep layer missing');
const fn=html.slice(html.indexOf('function footstepSfx'),html.indexOf('function spellFlavorLayer'));
ok(!fn.includes('sfxTone('),'footstep still uses oscillator tone/beep');
ok(fn.includes("kind:'lowpass'")&&fn.includes("kind:'bandpass'"),'footstep texture layers missing');
console.log('OK - pas synchronisés à l’animation + bruit naturel sans bip');
