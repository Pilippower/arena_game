'use strict';
// Bruitages procéduraux (sorts, coups, pas).
// ---------- Original fantasy spell SFX (procedural; no Blizzard/WoW audio files) ----------
function sfxCtx(){const ctx=musicEnsure();if(ctx?.state==='suspended')ctx.resume();return ctx}
// ---------- Sons de combat par catégorie ----------
// Bruit filtré qui balaie une plage de fréquences (souffle d'une lame, d'un sort).
function sfxSweep(dur,vol,f0,f1,delay=0,pan=0,kind='bandpass',q=1.2){const ctx=sfxCtx();if(!ctx||!MUSIC.noise)return;const t=ctx.currentTime+delay,n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
 n.buffer=MUSIC.noise;n.loop=true;f.type=kind;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+dur*.3);g.gain.exponentialRampToValueAtTime(.0001,t+dur);n.connect(f);f.connect(g);audioPan(g,pan).connect(MUSIC.sfxMaster);n.start(t);n.stop(t+dur+.05)}
// Partiels inharmoniques qui décroissent vite : impact métallique.
function sfxMetal(vol,pan,delay=0,base=420){[1,2.76,5.4,8.93].forEach((k,i)=>sfxTone(base*k*(.97+Math.random()*.06),.22-i*.035,'sine',vol/(1+i*.6),null,delay,pan,0,.22))}
const SFX={
 swing(u,heavy){const a=sfxSpatial(u);sfxSweep(heavy?.2:.15,(heavy?.16:.12)*a.level,600,3200,0,a.pan,'bandpass',1.5)},
 meleeHit(u,heavy){const a=sfxSpatial(u),L=a.level,P=a.pan;sfxMetal((heavy?.09:.065)*L,P,.06,heavy?360:470);sfxTone(heavy?95:120,.16,'sine',(heavy?.2:.14)*L,45,.06,P);sfxNoise(.07,.16*L,2600,.06,P)},
 holy(u,big){const a=sfxSpatial(u),L=a.level,P=a.pan;const ch=big?[523.25,659.25,783.99,1046.5,1318.5]:[659.25,830.6,987.77,1318.5];
  ch.forEach((f,i)=>{sfxTone(f,big?1.4:1.0,'sine',.06*L/(1+i*.3),null,i*.045,P+(i-2)*.08,0,.4);sfxTone(f*2.01,.6,'sine',.018*L,null,i*.045+.01,P,0,.4)});
  sfxSweep(big?1.2:.8,.05*L,2500,9000,0,P,'highpass',.7)},
 shield(u){const a=sfxSpatial(u),L=a.level,P=a.pan;sfxSweep(.5,.07*L,400,2400,0,P,'bandpass',4);[880,1320,1760].forEach((f,i)=>sfxTone(f,.5,'triangle',.035*L,f*1.5,i*.05,P,0,.4))},
 castStart(u,school){const a=sfxSpatial(u),L=a.level,P=a.pan;const base=school==='shadow'?110:school==='holy'?440:school==='nature'?220:school==='frost'?330:260;
  sfxTone(base,1.0,'sawtooth',.03*L,base*2,0,P,900,.3);sfxTone(base*1.5,1.0,'sine',.035*L,base*3,0,P,0,.3);sfxSweep(1.0,.035*L,300,2000,0,P,'bandpass',3)},
 spellHit(u,school){const a=sfxSpatial(u),L=a.level,P=a.pan;
  if(school==='shadow'){sfxTone(90,.45,'sawtooth',.11*L,40,0,P,600,.35);sfxSweep(.4,.1*L,1800,200,0,P,'lowpass',.8);sfxTone(55,.4,'sine',.14*L,30,0,P)}
  else if(school==='nature'){sfxSweep(.35,.11*L,800,4000,0,P,'bandpass',2);sfxTone(300,.3,'triangle',.07*L,150,0,P,0,.3);sfxNoise(.2,.08*L,900,.03,P,'lowpass')}
  else{sfxSweep(.3,.12*L,5000,800,0,P,'bandpass',1.5);sfxTone(1200,.25,'triangle',.07*L,300,0,P,0,.35);sfxTone(70,.3,'sine',.13*L,35,0,P);sfxNoise(.06,.09*L,6000,.01,P,'highpass')}},
 frost(u){const a=sfxSpatial(u),L=a.level,P=a.pan;sfxSweep(.6,.13*L,6000,1200,0,P,'highpass',.8);for(let i=0;i<6;i++)sfxTone(1800+Math.random()*2400,.18,'sine',.03*L,null,.05+i*.04,P+(Math.random()-.5)*.6,0,.3);sfxTone(80,.35,'sine',.12*L,40,0,P)},
 cc(u){const a=sfxSpatial(u),L=a.level,P=a.pan;sfxTone(220,.5,'triangle',.06*L,110,0,P,0,.4);sfxTone(330,.5,'sine',.04*L,140,.05,P,0,.4);sfxSweep(.5,.06*L,1500,300,0,P,'bandpass',3)},
 kick(u){const a=sfxSpatial(u),L=a.level,P=a.pan;sfxTone(1400,.12,'square',.06*L,500,0,P,2500,.15);sfxMetal(.05*L,P,0,700);sfxNoise(.08,.12*L,3000,0,P)},
 whoosh(u){const a=sfxSpatial(u),L=a.level,P=a.pan;sfxSweep(.35,.13*L,300,3000,0,P,'bandpass',1.2);sfxTone(200,.3,'sine',.05*L,600,0,P)},
 power(u){const a=sfxSpatial(u),L=a.level,P=a.pan;[146.8,220,293.7,440].forEach((f,i)=>sfxTone(f,.9,'sawtooth',.03*L,f*1.5,i*.06,P,1800,.4));sfxSweep(.9,.06*L,200,4000,0,P,'bandpass',2)},
 charge(u){const a=sfxSpatial(u),L=a.level,P=a.pan;sfxSweep(.5,.15*L,200,1500,0,P,'lowpass',.8);sfxTone(70,.5,'sawtooth',.08*L,45,0,P,400,.3)}
};
// Sort lancé : son choisi d'après ce que fait le sort (corps à corps, soin, incantation, contrôle…).
function sfxForSkill(u,S,i){if(!u||!S)return;const n=S.n||'',k=S.k;
 if(S.kick)return SFX.kick(u);
 if(/Heal|Hymn|Frenzied/.test(n))return SFX.holy(u,/Hymn/.test(n));
 if(/Shield|Barkskin|Cloak|Shield Wall/.test(n))return SFX.shield(u);
 if(/Charge/.test(n))return SFX.charge(u);
 if(/Frost Nova/.test(n))return SFX.frost(u);
 if(/Blink|Step|Advance|Gate|Shadowstep/.test(n)||k==='stealth'||k==='cat'||k==='bear'||k==='human')return SFX.whoosh(u);
 if(/Power|Pillar|Vendetta|Dark Soul/.test(n))return SFX.power(u);
 if(S.t==='melee'||k==='swipe'){SFX.swing(u,true);if(!/Sap/.test(n))SFX.meleeHit(u,true);return}
 if(/Sap|Maim|Kidney|Asphyx|Silence|Roots|Grip/.test(n))return SFX.cc(u);
 if(/Starfall|Swipe/.test(n))return SFX.spellHit(u,'arcane');
 if(u.cast)return SFX.castStart(u,S.s);
 SFX.spellHit(u,S.s);
}
function spellSfx(u,i){sfxForSkill(u,skillsOf(u)[i],i)}
function spellSfxKind(u,S){sfxForSkill(u,S)}
function spellImpactSfx(u,kind='damage'){if(kind==='heal')return SFX.holy(u,false);if(kind==='fear')return SFX.cc(u);const S=CLASS[u.cls].skills[0];SFX.spellHit(u,S?.s)}
function sfxSpatial(u){if(!state?.player||!u)return{pan:0,level:1};const dx=u.x-state.player.x,dz=u.z-state.player.z,dist=Math.hypot(dx,dz);return{pan:clamp(dx/18,-.78,.78),level:u===state.player?1:clamp(1-dist/38,.28,.68)}}
function sfxTone(freq,dur=.18,type='sine',vol=.14,slide=null,delay=0,pan=0,filterFreq=0,rev=.12){const ctx=sfxCtx();if(!ctx)return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);let inp=o;if(filterFreq){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=filterFreq;o.connect(f);f.connect(g)}else o.connect(g);const out=audioPan(g,pan);out.connect(MUSIC.sfxMaster);if(MUSIC.reverb&&rev>0){const rg=ctx.createGain();rg.gain.value=rev;out.connect(rg);rg.connect(MUSIC.reverb)}o.start(t);o.stop(t+dur+.03)}
function sfxNoise(dur=.16,vol=.10,filterFreq=1200,delay=0,pan=0,kind='bandpass'){const ctx=sfxCtx();if(!ctx||!MUSIC.noise)return;const t=ctx.currentTime+delay,n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=MUSIC.noise;f.type=kind;f.frequency.value=filterFreq;f.Q.value=.7;g.gain.setValueAtTime(Math.max(.0002,vol),t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);n.connect(f);f.connect(g);const out=audioPan(g,pan);out.connect(MUSIC.sfxMaster);n.start(t);n.stop(t+dur+.02)}
function sfxChord(freqs,dur,type,vol,pan=0,delay=0){freqs.forEach((f,i)=>sfxTone(f,dur,type,vol/(1+i*.22),null,delay+i*.008,pan+(i-1)*.05,2200,.18))}

