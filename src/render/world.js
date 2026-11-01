'use strict';
// Rendu du monde : décor (environment.js), arène de secours, personnages de secours, effets, noms flottants.
// ---------- 3D renderer ----------
function resize(){if(!gl)return;const r=canvas.getBoundingClientRect(),d=Math.min(1.8,devicePixelRatio||1),w=Math.max(1,Math.floor(r.width*d)),h=Math.max(1,Math.floor(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h)}
function cameraSafe(target,desired){let safe=1;for(let i=1;i<=30;i++){const t=i/30,x=lerp(target[0],desired[0],t),y=lerp(target[1],desired[1],t),z=lerp(target[2],desired[2],t);let hit=x<-arena.halfX-.05||x>arena.halfX+.05||z<-arena.halfZ-.05||z>arena.halfZ+.05||y<.32;for(const p of arena.pillars)if(Math.hypot(x-p.x,z-p.z)<p.r+.28&&y<p.h+.25)hit=true;if(hit){safe=(i-1)/30;break}}return[lerp(target[0],desired[0],safe),lerp(target[1],desired[1],safe),lerp(target[2],desired[2],safe)]}
function setupCamera(){const p=state?.player||{x:0,y:0,z:0},target=[p.rx??p.x,(p.ry??p.y??0)+1.25,p.rz??p.z],cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch),h=cp*camera.dist,desired=[target[0]-Math.sin(camera.yaw)*h,target[1]+sp*camera.dist+1.0,target[2]-Math.cos(camera.yaw)*h];camPos=cameraSafe(target,desired);viewProj=mul(perspective(Math.PI/3,canvas.width/canvas.height,.08,130),lookAt(camPos,target));gl.uniformMatrix4fv(loc.vp,false,viewProj);gl.uniform3fv(loc.cam,camPos);gl.uniform1f(loc.time,now())}
function renderCharacter(u){
 if(!u.alive)return;
 const C=CLASS[u.cls],col=C.color,acc=C.accent;
 const walk=(u.moving&&u.grounded)?Math.sin(u.movePhase):0;
 const bob=(u.moving&&u.grounded)?Math.abs(Math.sin(u.movePhase*2))*.042:0;
 const y=(u.y||0)+bob,atk=u.action>0?Math.sin((u.action/.5)*Math.PI):0;
 const race=RACE[u.race]||RACE.human;
 const H=race.height,B=race.bulk, shoulderScale=race.shoulder;
 const lp2=(x,yy,z)=>local(u,x*B,((y+yy)*H),z*B);
 const lp=(x,yy,z)=>lp2(x,yy,z);
 const bulky=(u.cls==='sentinel'||u.cls==='reaver'||race.bulk>1.1);
 const caster=u.cls==='arcanist'||u.cls==='oracle'||u.cls==='warlock';
 const robed=caster||u.cls==='warden';
 const skin=race.skin, dark=[.055,.045,.05], metal=[.48,.52,.58], gold=[.86,.66,.25];
 const teamRing=u===state.player?.target?[1,.72,.1]:u.team===0?[.08,.50,1]:[1,.12,.2];
 // Ground shadow + selection rings
 part('cyl',[u.x,.022,u.z],[0,0,0],[.78,.012,.78],[.012,.012,.016],[0,0,0],.42);
 part('torus',[u.x,.07,u.z],[0,0,0],[(u===state.player?.target?.98:.76)*B,.05,(u===state.player?.target?.98:.76)*B],teamRing,hexish(teamRing,.42),.88);

 // Body proportions: large fantasy torso / smaller waist / strong legs
 const hip=.19, legSwing=walk*.48, armSwing=walk*.38;
 // thighs and calves are stretched spheres = rounded limbs, not blocks
 part('sphere',lp(-hip,.55,0),[legSwing*.55,u.yaw,0],[.155,.34,.155],hexish(col,.50));
 part('sphere',lp( hip,.55,0),[-legSwing*.55,u.yaw,0],[.155,.34,.155],hexish(col,.50));
 part('sphere',lp(-hip,.27,.025),[-legSwing*.32,u.yaw,0],[.135,.29,.135],hexish(col,.40));
 part('sphere',lp( hip,.27,.025),[ legSwing*.32,u.yaw,0],[.135,.29,.135],hexish(col,.40));
 // boots: heel + toe for a more sculpted silhouette
 for(const side of [-1,1]){
   part('sphere',lp(side*hip,.08,.04),[0,u.yaw,0],[.17,.115,.17],dark);
   part('sphere',lp(side*hip,.075,.18),[0,u.yaw,0],[.16,.095,.25],hexish(dark,1.35));
 }
 // waist / robe
 if(robed){
   part('robe',lp(0,.78,-.01),[0,u.yaw,0],[.41,.43,.37],hexish(col,.58));
   part('sphere',lp(0,.88,0),[0,u.yaw,0],[.34,.16,.26],hexish(col,.73));
 }else{
   part('sphere',lp(0,.88,0),[0,u.yaw,0],[.35,.19,.27],hexish(col,.58));
 }
 // belt, buckle, hanging tabard
 part('cyl',lp(0,.91,0),[0,u.yaw,0],[.36,.045,.28],[.22,.13,.06]);
 part('sphere',lp(0,.92,.285),[0,0,0],[.075,.065,.04],gold,gold,.36);
 if(u.cls==='sentinel'||u.cls==='oracle'||u.cls==='reaver')part('robe',lp(0,.68,.22),[0,u.yaw,0],[.16,.26,.055],hexish(acc,.72));

 // torso: layered organic chest + breastplate
 part('sphere',lp(0,1.31,0),[0,u.yaw,0],[bulky?.48:.41,.49,.31],hexish(col,.78));
 part('sphere',lp(0,1.39,.18),[0,u.yaw,0],[bulky?.40:.35,.34,.21],col);
 // abdomen taper
 part('sphere',lp(0,1.10,.01),[0,u.yaw,0],[.31,.25,.25],hexish(col,.62));
 // emblem / gem
 part('sphere',lp(0,1.43,.36),[0,0,0],[.105,.125,.045],acc,hexish(acc,.25),.96);

 // cape with shoulder clasp
 if(u.cls!=='shade'){
   part('robe',lp(0,1.20,-.30),[Math.PI,u.yaw,0],[.37,.49,.065],hexish(col,.29),[0,0,0],.94);
   part('sphere',lp(-.25,1.57,-.25),[0,0,0],[.07,.07,.05],gold);
   part('sphere',lp(.25,1.57,-.25),[0,0,0],[.07,.07,.05],gold);
 }

 // layered pauldrons: big, Warcraft-like heroic silhouette, original geometry
 const sh=bulky?.36:(u.cls==='warden'?.33:.29),sx=bulky?.55:.51;
 for(const side of [-1,1]){
   part('sphere',lp(side*sx,1.61,-.01),[0,u.yaw,side*.08],[sh,.23,sh*1.04],hexish(col,1.22));
   part('sphere',lp(side*(sx+.02),1.67,.015),[0,u.yaw,side*.14],[sh*.78,.17,sh*.86],hexish(acc,.68));
   if(u.cls==='sentinel'||u.cls==='reaver'||u.cls==='warlock'){
     part('cone',lp(side*(sx+.08),1.86,-.03),[side*.32,u.yaw,side*.24],[.09,.22,.09],acc,hexish(acc,.32),.90);
     part('cone',lp(side*(sx+.20),1.73,-.04),[side*.72,u.yaw,side*.12],[.065,.19,.065],hexish(acc,.88));
   }
 }

 // arms: two rounded segments + elbow + oversized gloves/hands
 for(const side of [-1,1]){
   const sw=(side<0?armSwing:-armSwing)+(side>0?atk*.62:-atk*.15);
   part('sphere',lp(side*.49,1.31,.01),[sw,u.yaw,side*.04],[.145,.29,.145],hexish(col,.78));
   part('sphere',lp(side*.53,1.08,.07),[sw*.55,u.yaw,side*.03],[.13,.24,.13],hexish(col,.58));
   part('sphere',lp(side*.52,1.17,.05),[0,0,0],[.145,.13,.145],hexish(acc,.44));
   part('sphere',lp(side*.55,.86,.12),[0,0,0],[.135,.13,.13],skin);
   if(bulky)part('sphere',lp(side*.56,.89,.12),[0,0,0],[.16,.145,.15],hexish(col,.70));
 }

 // neck, head, jaw, ears
 part('sphere',lp(0,1.77,0),[0,u.yaw,0],[.13,.115,.13],skin);
 part('sphere',lp(0,2.04,0),[0,u.yaw,0],[.27,.31,.255],skin);
 part('sphere',lp(0,1.94,.13),[0,u.yaw,0],[.22,.17,.15],hexish(skin,.94));
 part('sphere',lp(-.255,2.04,0),[0,0,0],[.045,.075,.035],skin);
 part('sphere',lp(.255,2.04,0),[0,0,0],[.045,.075,.035],skin);
 // eyes and eyebrows (tiny real geometry)
 part('sphere',lp(-.085,2.08,.238),[0,0,0],[.035,.022,.018],[.80,.93,1],acc,.55);
 part('sphere',lp(.085,2.08,.238),[0,0,0],[.035,.022,.018],[.80,.93,1],acc,.55);
 part('sphere',lp(-.085,2.145,.235),[0,0,.12],[.065,.015,.012],dark);
 part('sphere',lp(.085,2.145,.235),[0,0,-.12],[.065,.015,.012],dark);

 // Hair / helmets / hoods by class
 if(u.cls==='sentinel'){
   part('sphere',lp(0,2.13,-.015),[0,u.yaw,0],[.31,.24,.30],hexish(col,.42));
   part('sphere',lp(0,2.06,.23),[0,u.yaw,0],[.25,.12,.08],metal);
   part('cone',lp(0,2.43,-.025),[0,u.yaw,0],[.065,.23,.065],acc,acc,.72);
   for(const side of [-1,1])part('cone',lp(side*.22,2.28,-.05),[side*.50,u.yaw,0],[.045,.16,.045],gold);
 }else if(u.cls==='reaver'){
   part('sphere',lp(0,2.13,-.02),[0,u.yaw,0],[.315,.245,.31],[.075,.10,.15]);
   part('sphere',lp(0,2.05,.22),[0,u.yaw,0],[.26,.105,.08],[.14,.20,.26]);
   for(const side of [-1,1]){
     part('cone',lp(side*.19,2.34,-.03),[side*.45,u.yaw,0],[.085,.25,.085],acc,hexish(acc,.4),.82);
     part('cone',lp(side*.29,2.28,-.08),[side*.80,u.yaw,0],[.055,.18,.055],metal);
   }
 }else if(u.cls==='shade'){
   // hood + mask + scarf
   part('sphere',lp(0,2.15,-.025),[0,u.yaw,0],[.32,.28,.31],hexish(col,.35));
   part('sphere',lp(0,2.02,.205),[0,u.yaw,0],[.245,.12,.09],hexish(col,.23));
   part('robe',lp(0,1.82,-.10),[0,u.yaw,0],[.24,.23,.15],hexish(col,.30));
 }else if(u.cls==='warden'){
   // druid: hair + antler crown
   part('sphere',lp(0,2.16,-.05),[0,u.yaw,0],[.31,.21,.30],[.27,.16,.07]);
   part('sphere',lp(0,2.02,-.20),[0,u.yaw,0],[.28,.23,.12],[.20,.11,.05]);
   for(const side of [-1,1]){
     part('cone',lp(side*.14,2.39,-.04),[side*.42,u.yaw,0],[.045,.28,.045],[.31,.21,.09]);
     part('cone',lp(side*.28,2.47,-.06),[side*.78,u.yaw,0],[.035,.21,.035],[.31,.21,.09]);
     part('cone',lp(side*.34,2.34,-.02),[side*1.02,u.yaw,0],[.03,.16,.03],[.31,.21,.09]);
   }
 }else if(u.cls==='warlock'){
   part('sphere',lp(0,2.16,-.04),[0,u.yaw,0],[.32,.29,.31],hexish(col,.30));
   part('sphere',lp(0,2.02,.19),[0,u.yaw,0],[.25,.12,.10],hexish(col,.20));
   for(const side of [-1,1]){
     part('cone',lp(side*.17,2.40,-.05),[side*.48,u.yaw,0],[.075,.27,.075],acc,hexish(acc,.42),.92);
     part('cone',lp(side*.34,2.39,-.08),[side*.88,u.yaw,0],[.05,.20,.05],hexish(acc,.8),hexish(acc,.3),.86);
   }
 }else if(u.cls==='oracle'){
   // priest: gold circlet / hood back
   part('sphere',lp(0,2.16,-.07),[0,u.yaw,0],[.30,.20,.29],hexish(col,.75));
   part('torus',lp(0,2.16,.00),[Math.PI/2,u.yaw,0],[.29,.024,.29],gold,gold,.66);
 }else{
   // mage: elegant hood + white/violet robe accents, inspired by fantasy archmages but original
   part('sphere',lp(0,2.16,-.045),[0,u.yaw,0],[.31,.22,.30],[.42,.18,.62]);
   part('cone',lp(0,2.38,-.03),[-.13,u.yaw,.08],[.09,.26,.09],[.30,.82,.95],[.18,.95,1],.82);
   part('robe',lp(0,1.06,.22),[0,u.yaw,0],[.22,.50,.07],[.88,.88,.92],[.75,.66,.28],.95);
   part('robe',lp(-.16,1.06,.18),[0,u.yaw,.12],[.11,.42,.05],[.88,.88,.92],[.75,.66,.28],.95);
   part('robe',lp(.16,1.06,.18),[0,u.yaw,-.12],[.11,.42,.05],[.88,.88,.92],[.75,.66,.28],.95);
   part('torus',lp(0,1.48,.31),[Math.PI/2,u.yaw,0],[.15,.018,.15],[.80,.64,.24],[.80,.64,.24],.9);
   for(const side of [-1,1]){part('sphere',lp(side*.26,1.56,.28),[0,0,0],[.055,.055,.03],[.18,.80,.86],[.18,.95,1],.86);}
 }

 // Weapons and class identity
 if(u.cls==='sentinel'){
   // shield with boss + sword
   part('cyl',lp(-.69,1.22,.19),[Math.PI/2,u.yaw,0],[.39,.055,.39],[.15,.23,.35]);
   part('torus',lp(-.69,1.22,.20),[Math.PI/2,u.yaw,0],[.31,.055,.31],gold,hexish(gold,.3),.86);
   part('sphere',lp(-.69,1.22,.25),[0,0,0],[.10,.10,.055],acc,acc,.82);
   part('cube',lp(.68,1.26,.16),[-.18+atk*.80,u.yaw,0],[.045,.49,.06],metal,[.08,.10,.12],1);
   part('cone',lp(.68,1.77,.16),[-.18+atk*.80,u.yaw,0],[.07,.18,.07],metal);
 }else if(u.cls==='reaver'){
   part('cyl',lp(.62,1.17,.08),[.22-atk*.75,u.yaw,0],[.06,.38,.06],[.18,.13,.11]);
   part('cube',lp(.70,1.62,.08),[.22-atk*.75,u.yaw,0],[.085,.57,.10],[.27,.34,.42],acc,.32);
   part('cone',lp(.72,2.20,.08),[.22-atk*.75,u.yaw,0],[.10,.22,.10],acc,acc,.78);
   // runes along blade
   for(const yy of [1.38,1.57,1.76])part('sphere',lp(.70,yy,.13),[0,0,0],[.027,.04,.018],acc,acc,.92);
 }else if(u.cls==='shade'){
   for(const side of [-1,1]){
     part('cube',lp(side*.62,1.02,.20),[0,u.yaw,side*(.55+atk*.65)],[.035,.30,.055],metal,acc,.18);
     part('cone',lp(side*.67,1.31,.22),[0,u.yaw,side*.65],[.045,.15,.045],acc,acc,.55);
   }
 }else{
   const staffCol=u.cls==='oracle'?[.64,.48,.24]:u.cls==='warden'?[.25,.16,.07]:u.cls==='arcanist'?[.13,.54,.62]:[.16,.10,.09];
   part('cyl',lp(.66,1.25,.03),[.36-atk*.35,u.yaw,0],[.05,u.cls==='arcanist'?.80:.68,.05],staffCol);
   part('sphere',lp(.78,u.cls==='arcanist'?2.02:1.90,.05),[0,0,0],[u.cls==='arcanist'?.12:.17,u.cls==='arcanist'?.22:.17,u.cls==='arcanist'?.12:.17],acc,acc,.95);
   if(u.cls==='oracle'){
     part('torus',lp(.78,1.90,.05),[Math.PI/2,0,0],[.27,.04,.27],gold,gold,.82);
     part('sphere',lp(.78,1.90,.05),[0,0,0],[.09,.09,.09],[1,.97,.72],[1,.85,.30],.95);
   }
   if(u.cls==='warden')for(const side of [-1,1]){
     part('cone',lp(.78+side*.11,2.08,.04),[side*.47,0,0],[.04,.19,.04],[.30,.21,.08]);
     part('sphere',lp(.78+side*.16,2.12,.04),[0,0,0],[.055,.055,.055],[.35,.70,.18],[.15,.50,.05],.76);
   }
   if(u.cls==='warlock')for(const side of [-1,1])part('cone',lp(.78+side*.11,2.06,.04),[side*.43,0,0],[.045,.19,.045],acc,acc,.80);
   if(u.cls==='arcanist'){
     part('torus',lp(.78,1.90,.05),[0,0,0],[.25,.035,.25],acc,acc,.72);
     for(let k=0;k<3;k++){const a=now()*1.5+k*2.094;part('sphere',lp(.78+Math.sin(a)*.22,1.90+Math.cos(a)*.08,.05+Math.cos(a)*.16),[0,0,0],[.035,.035,.035],acc,acc,.88)}
   }
 }

 // class auras / combat states
 if(u.cls==='oracle')part('torus',lp(0,2.47,0),[0,0,0],[.35,.035,.35],gold,gold,.46);
 if(u.cls==='warlock')part('torus',[u.x,y+.10,u.z],[0,0,0],[.70,.035,.70],acc,acc,.28);
 if(u.shield>0)part('sphere',lp(0,1.34,0),[0,0,0],[.82,1.14,.82],[.10,.42,1],[.08,.30,.8],.16);
 if(u.cast){const q=1-clamp((u.cast.end-now())/u.cast.dur,0,1);part('sphere',lp(.45,1.55,.18),[0,0,0],[.14+q*.10,.14+q*.10,.14+q*.10],acc,acc,.94);part('torus',[u.x,y+.10,u.z],[0,0,0],[.64+q*.26,.045,.64+q*.26],acc,hexish(acc,.55),.58)}
 if(u.burst>0)part('torus',[u.x,y+.10,u.z],[0,0,0],[1.06,.075,1.06],[1,.28,.05],[.7,.13,.01],.68);
 if(u.stun>0){for(let k=0;k<3;k++){const a=now()*3+k*2.094;part('sphere',[u.x+Math.sin(a)*.45,y+2.58,u.z+Math.cos(a)*.45],[0,0,0],[.07,.07,.07],[1,.78,.08],[.8,.5,.02],.9)}}
}
function renderPersistentCC(){
 if(!state?.units)return;
 const tt=now();
 for(const u of state.units){if(!u.alive)continue;const yy=u.ry??(u.y||0),ux=u.rx??u.x,uz=u.rz??u.z;
   if(u.root>0&&!u.rootKind){part('torus',[ux,.10,uz],[0,0,0],[.92,.055,.92],[.34,.76,1],[.05,.35,.9],.82);for(let i=0;i<5;i++){const a=i*1.256;part('cone',[ux+Math.sin(a)*.52,.28,uz+Math.cos(a)*.52],[.2*Math.sin(a),-a,.2*Math.cos(a)],[.07,.34,.07],[.30,.78,1],[.05,.35,.9],.80)}}
   if(u.stun>0){for(let i=0;i<4;i++){const a=tt*3.2+i*Math.PI/2;part('sphere',[ux+Math.sin(a)*.52,yy+2.62,uz+Math.cos(a)*.52],[0,0,0],[.085,.085,.085],[1,.82,.12],[1,.55,.02],.94)}part('torus',[ux,yy+2.58,uz],[Math.PI/2,0,0],[.56,.045,.56],[1,.75,.12],[1,.45,.02],.70)}
   if(u.silence>0){part('torus',[ux,yy+2.20,uz],[Math.PI/2,tt*1.7,0],[.42,.045,.42],[.75,.52,1],[.46,.12,1],.78);part('torus',[ux,yy+1.65,uz],[Math.PI/2,-tt*1.3,0],[.52,.035,.52],[.62,.38,.95],[.32,.05,.85],.50)}
   if(u.fear>0){part('torus',[ux,yy+2.40,uz],[Math.PI/2,tt*2.4,0],[.60,.055,.60],[.62,.20,.95],[.42,.02,.90],.86);for(let i=0;i<3;i++){const a=tt*2.8+i*2.094;part('sphere',[ux+Math.sin(a)*.45,yy+2.25+Math.sin(a*2)*.18,uz+Math.cos(a)*.45],[0,0,0],[.11,.07,.06],[.75,.30,1],[.55,.05,.95],.90)}}
   if(u.slow>0){part('torus',[ux,.07,uz],[0,0,0],[.70,.035,.70],[.35,.72,1],[.05,.32,.88],.42)}
 }
}
function renderHealthShrines(){
 if(!state?.shrines)return;const tt=now();
 for(const sh of state.shrines){
   if(sh.active){const pulse=1+Math.sin(tt*3)*.08;part('torus',[sh.x,.08,sh.z],[0,tt*.5,0],[1.05*pulse,.07,1.05*pulse],[.25,1,.42],[.05,.65,.20],.88);part('cube',[sh.x,.85,sh.z],[0,tt*.35,0],[.18,.72,.18],[.72,1,.76],[.20,1,.38],.94);part('cube',[sh.x,.85,sh.z],[0,tt*.35,0],[.65,.18,.18],[.72,1,.76],[.20,1,.38],.94);part('sphere',[sh.x,.85,sh.z],[0,0,0],[.62,.62,.62],[.25,1,.42],[.05,.85,.28],.18)}
   else{const k=clamp(sh.respawn/45,0,1);part('torus',[sh.x,.06,sh.z],[0,0,0],[.72,.035,.72],[.22,.30,.24],[.05,.10,.06],.28);}
 }
}
// Décor three.js (environment.js) dessiné sous ce canevas ; en cas d'échec, l'arène historique ci-dessous reste affichée.
const ENV={attempted:false,ok:false};
function envEnsureInit(){
  if(ENV.attempted)return ENV.ok;ENV.attempted=true;
  try{ENV.ok=!!(window.THREE&&window.ArenaEnv&&ArenaEnv.init(THREE,$('env3d'),arena,{mobile:document.body.classList.contains('mobile-mode')}))}
  catch(e){console.warn('Décor 3D indisponible, arène simplifiée :',e);ENV.ok=false}
  if(!ENV.ok)$('env3d').style.display='none';return ENV.ok;
}
function renderArena(){
 if(ENV.ok){
  // le décor est sur le canevas du dessous : ici, seulement la profondeur des piliers/murs (les effets passent derrière) et les sanctuaires
  const hx=arena.halfX,hz=arena.halfZ;gl.colorMask(false,false,false,false);
  for(const p of arena.pillars)part('cyl',[p.x,p.h/2,p.z],[0,0,0],[p.r,p.h/2,p.r],[0,0,0]);
  part('cube',[0,1.7,-hz-.5],[0,0,0],[hx+1.2,1.7,.5],[0,0,0]);part('cube',[0,1.7,hz+.5],[0,0,0],[hx+1.2,1.7,.5],[0,0,0]);
  part('cube',[-hx-.5,1.7,0],[0,0,0],[.5,1.7,hz+1.2],[0,0,0]);part('cube',[hx+.5,1.7,0],[0,0,0],[.5,1.7,hz+1.2],[0,0,0]);
  gl.colorMask(true,true,true,true);renderHealthShrines();return;
 }
 const hx=arena.halfX,hz=arena.halfZ;
 // Broad arena floor with greener, less toy-like materials.
 part('cube',[0,-.26,0],[0,0,0],[hx+4,.24,hz+4],[.12,.14,.11]);
 const tileStep=4;
 for(let x=-hx+2;x<=hx-2;x+=tileStep)for(let z=-hz+2;z<=hz-2;z+=tileStep){
   const nx=x/hx,nz=z/hz,edge=Math.max(Math.abs(nx),Math.abs(nz));
   const moss=(Math.sin(x*.37)+Math.cos(z*.41)+Math.sin((x+z)*.17))*0.5;
   let col;
   if(edge>.78) col=[.16+.03*moss,.24+.04*moss,.15+.02*moss];
   else if((Math.round(x/tileStep)+Math.round(z/tileStep))%2===0) col=[.24,.25,.23];
   else col=[.20,.22,.20];
   part('cube',[x,-.015,z],[0,0,0],[1.90,.03,1.90],col);
   if(edge>.62 && (Math.sin(x*1.7+z*2.1)>0.35)) part('cube',[x,.02,z],[0,0,0],[1.6,.012,1.6],[.16,.24,.13]);
 }
 // central runes / inlays
 part('torus',[0,.038,0],[0,0,0],[12.8,.07,12.8],[.65,.49,.17],[.22,.09,.01],.92);
 part('torus',[0,.044,0],[0,0,0],[7.8,.06,7.8],[.18,.52,.86],[.03,.16,.48],.82);
 part('torus',[0,.049,0],[0,0,0],[2.4,.055,2.4],[.66,.48,.17],[.20,.08,.01],.90);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=i%2?10.0:5.7;part('cube',[Math.sin(a)*r,.04,Math.cos(a)*r],[0,-a,0],[.17,.035,.92],[.56,.43,.17],[.12,.05,.01],.70)}
 // outer walls
 const wall=[.24,.26,.23],trim=[.38,.36,.29];
 part('cube',[0,1.7,-hz-.78],[0,0,0],[hx+1.2,.82,.78],wall);part('cube',[0,1.7,hz+.78],[0,0,0],[hx+1.2,.82,.78],wall);
 part('cube',[-hx-.78,1.7,0],[0,0,0],[.78,.82,hz+1.2],wall);part('cube',[hx+.78,1.7,0],[0,0,0],[.78,.82,hz+1.2],wall);
 for(let x=-hx+1;x<=hx-1;x+=3){part('cube',[x,2.92,-hz-.78],[0,0,0],[.56,.42,.76],trim);part('cube',[x,2.92,hz+.78],[0,0,0],[.56,.42,.76],trim)}
 for(let z=-hz+1;z<=hz-1;z+=3){part('cube',[-hx-.78,2.92,z],[0,0,0],[.76,.42,.56],trim);part('cube',[hx+.78,2.92,z],[0,0,0],[.76,.42,.56],trim)}
 // line-of-sight pillars
 for(const p of arena.pillars){
   part('cyl',[p.x,p.h/2,p.z],[0,0,0],[p.r,p.h/2,p.r],[.31,.34,.31]);
   part('cyl',[p.x,.18,p.z],[0,0,0],[p.r*1.28,.18,p.r*1.28],[.40,.41,.34]);
   part('cyl',[p.x,p.h-.18,p.z],[0,0,0],[p.r*1.18,.18,p.r*1.18],[.42,.43,.38]);
   part('torus',[p.x,.45,p.z],[0,0,0],[p.r*1.09,.07,p.r*1.09],[.24,.48,.20],[.04,.18,.03],.76);
   part('torus',[p.x,p.h-.48,p.z],[0,0,0],[p.r*1.04,.055,p.r*1.04],[.22,.55,.95],[.03,.15,.48],.70);
   part('cone',[p.x,p.h+.52,p.z],[0,now()*.18,0],[.30,.66,.30],[.22,.75,1],[.05,.32,.85],.88);
 }
 // grass / weeds / flowers around outer lanes for a more WoW-like arena feel.
 function grassClump(x,z,s=1){
   const g1=[.18,.45,.14],g2=[.28,.62,.18],g3=[.36,.70,.24];
   for(let i=0;i<5;i++){const a=i*0.72+Math.sin(x*1.7+z*1.1),h=(.26+(i%3)*.08)*s;part('cube',[x+Math.sin(a)*.16*s,h*.5,z+Math.cos(a)*.16*s],[0,a,.22+Math.sin(a)*.25],[.03*s,h,.012*s],i%3===0?g3:(i%2?g2:g1));}
   if(((Math.floor(x)+Math.floor(z))%7)===0){part('sphere',[x,.12,z],[0,0,0],[.035,.035,.035],[.76,.45,.82]);part('sphere',[x+.06,.10,z-.04],[0,0,0],[.028,.028,.028],[.93,.86,.30]);}
 }
 for(let i=0;i<120;i++){
   const a=i*2.3999632297; const ring=i%3===0?0.74:(i%3===1?0.84:0.92);
   const x=Math.sin(a)*(hx*ring), z=Math.cos(a)*(hz*ring);
   if(Math.abs(x)<15 && Math.abs(z)<12) continue;
   grassClump(x,z,.9+((i%4)*.16));
   if(i%5===0) part('sphere',[x+.22,.10,z-.15],[0,0,0],[.15,.10,.12],[.18,.24,.14]);
 }
 // scenery outside combat lanes: banners, trees, braziers.
 for(const side of [-1,1]){
   const teamCol=side<0?[.48,.09,.12]:[.08,.22,.58];
   for(const z of [-18,-9,0,9,18]){part('cube',[side*(hx-.65),2.25,z],[0,0,0],[.06,.96,.76],teamCol);part('cyl',[side*(hx-1.4),1.0,z+.95],[0,0,0],[.085,.7,.085],[.19,.13,.07]);part('sphere',[side*(hx-1.4),1.86,z+.95],[0,0,0],[.22,.22,.22],[1,.38,.04],[1,.12,.01],.95)}
   for(const z of [-20.0,20.0]){
     const x=side*(hx-7.0);part('cyl',[x,1.20,z],[0,0,0],[.30,1.20,.30],[.24,.15,.08]);
     part('sphere',[x,2.85,z],[0,0,0],[1.45,1.80,1.45],[.15,.34,.12],[.04,.16,.03],.96);
     part('sphere',[x+.70*side,2.38,z+.2],[0,0,0],[1.05,1.18,1.05],[.18,.39,.13],[.04,.16,.03],.94);
     for(let g=0;g<6;g++)grassClump(x+Math.sin(g*1.2)*1.1,z+Math.cos(g*1.2)*1.0,.9);
   }
 }
 // ruined arches and broken walls
 for(const sx of [-1,1])for(const sz of [-1,1]){
   const x=sx*(hx-10.5),z=sz*(hz-8.8);
   part('cyl',[x,1.9,z],[0,0,0],[.45,1.9,.45],[.34,.34,.30]);
   part('cyl',[x+sx*2.4,1.9,z],[0,0,0],[.45,1.9,.45],[.34,.34,.30]);
   part('cube',[x+sx*1.2,3.7,z],[0,0,0],[1.7,.30,.52],[.40,.39,.33]);
   part('sphere',[x+sx*1.2,4.06,z],[0,0,0],[.24,.24,.24],[.18,.55,.94],[.04,.18,.55],.88);
   for(let s=0;s<4;s++)part('cube',[x+sx*(3.8+s*.75),.35,z+sz*(.5+s*.55)],[0,s*.3,0],[.32,.22,.26],[.27,.29,.24]);
 }
 // rocks, moss and extra grass around the perimeter.
 for(let i=0;i<28;i++){
   const a=i*2.173,rx=(hx-2.0),rz=(hz-1.8),x=Math.sin(a)*rx,z=Math.cos(a)*rz;
   part('sphere',[x,.18,z],[0,0,0],[.46+(i%3)*.12,.24,.38+(i%2)*.14],[.24,.28,.22]);
   if(i%2===0) part('sphere',[x+.28,.31,z-.18],[0,0,0],[.34,.34,.34],[.16,.36,.13]);
   for(let g=0;g<3;g++) grassClump(x+Math.sin(g*2.1)*.42,z+Math.cos(g*2.1)*.42,.72);
 }
 renderHealthShrines();

 // distant castle skyline and fantasy horizon
 for(const side of [-1,1]){part('cube',[side*9,4.4,-hz-8.5],[0,0,0],[7.2,2.8,2.2],[.30,.34,.43]);part('cube',[side*9,7.3,-hz-8.5],[0,0,0],[2.5,.55,2.2],[.44,.49,.62]);part('cyl',[side*13.6,5.6,-hz-8.8],[0,0,0],[1.6,4.8,1.6],[.32,.36,.45]);part('cyl',[side*4.4,5.0,-hz-8.6],[0,0,0],[1.4,4.3,1.4],[.32,.36,.45]);part('cone',[side*13.6,10.4,-hz-8.8],[0,0,0],[1.5,1.8,1.5],[.5,.56,.72]);part('cone',[side*4.4,9.1,-hz-8.6],[0,0,0],[1.3,1.6,1.3],[.5,.56,.72]);part('sphere',[side*9,6.4,-hz-7.2],[0,0,0],[.30,.30,.30],[1,.78,.34],[1,.58,.12],.94)}
 part('cube',[0,3.7,-hz-9.0],[0,0,0],[6.0,2.3,2.4],[.34,.38,.48]);part('cyl',[0,6.9,-hz-9.0],[0,0,0],[1.4,3.1,1.4],[.34,.38,.48]);part('cone',[0,10.0,-hz-9.0],[0,0,0],[1.35,1.7,1.35],[.55,.60,.76]);
}
function renderFx(){
 if(!state)return;
 for(const f of state.fx){
  if(f.fx3d)continue;   // dessiné par effects.js
  const k=clamp(f.life/f.max,0,1),t=1-k,grow=f.size*(1.65-k*.65),em=hexish(f.color,.75);
  const P=(x,y,z,sz=.08,a=.9)=>part('sphere',[x,y,z],[0,0,0],[sz,sz,sz],f.color,em,a),G=(name,p,r,s,a=.38)=>glowPart(name,p,r,s,f.color,a);
  if(f.type==='ring'){part('torus',[f.x,f.y,f.z],[0,0,0],[grow,.06,grow],f.color,hexish(f.color,.55),k*.7);G('torus',[f.x,f.y+.01,f.z],[0,0,0],[grow*1.08,.10,grow*1.08],k*.24)}
  else if(f.type==='arcaneProjectile'||f.type==='shadowProjectile'||f.type==='projectile'){
   if(!f.to)continue;for(let j=0;j<6;j++){const q=clamp(t-j*.055,0,1),x=lerp(f.from[0],f.to[0],q),y=lerp(f.from[1],f.to[1],q)+Math.sin(q*Math.PI)*.22,z=lerp(f.from[2],f.to[2],q),sz=f.size*(1-j*.10);P(x,y,z,sz,k*(.95-j*.10))}const q=t,x=lerp(f.from[0],f.to[0],q),y=lerp(f.from[1],f.to[1],q)+Math.sin(q*Math.PI)*.22,z=lerp(f.from[2],f.to[2],q);part('torus',[x,y,z],[Math.PI/2,0,0],[f.size*1.25,.035,f.size*1.25],f.color,em,.75*k);G('sphere',[x,y,z],[0,0,0],[f.size*1.9,f.size*1.9,f.size*1.9],k*.30);G('sphere',[x,y,z],[0,0,0],[f.size*.72,f.size*.72,f.size*.72],k*.70);if(t>.72){const hit=(t-.72)/.28,tx=f.to[0],ty=f.to[1],tz=f.to[2];G('sphere',[tx,ty,tz],[0,0,0],[f.size*(1.2+hit*2.1),f.size*(1.2+hit*2.1),f.size*(1.2+hit*2.1)],(1-hit)*.44);G('torus',[tx,ty,tz],[Math.PI/2,hit*3,0],[f.size*(.8+hit*2.2),.08,f.size*(.8+hit*2.2)],(1-hit)*.52)};
  }else if(f.type==='healBeam'||f.type==='chain'||f.type==='trail'){
   if(!f.to)continue;const n=f.type==='chain'?9:7;for(let j=0;j<n;j++){const q=j/(n-1),x=lerp(f.from[0],f.to[0],q),y=lerp(f.from[1],f.to[1],q)+(f.type==='chain'?Math.sin(q*Math.PI*4)*.06:Math.sin(q*Math.PI)*.12),z=lerp(f.from[2],f.to[2],q);P(x,y,z,f.size*(f.type==='chain'?.55:(1-q*.35)),k*(.35+.55*(1-q)))}
  }else if(f.type==='slash'){
   for(let j=0;j<3;j++)part('torus',[f.x,f.y+j*.11,f.z],[Math.PI/2,.5+j*.28,.55],[grow*(.72+j*.12),.035,grow*(.72+j*.12)],f.color,em,k*(.8-j*.15));
  }else if(f.type==='nova'||f.type==='holyBurst'||f.type==='frostAura'||f.type==='aura'||f.type==='darkAura'){
   const mult=f.type==='nova'?1.8:f.type==='holyBurst'?2.0:1.35;part('torus',[f.x,f.y,f.z],[0,0,0],[grow*mult,.055,grow*mult],f.color,em,k*.72);G('torus',[f.x,f.y+.02,f.z],[0,0,0],[grow*mult*1.04,.12,grow*mult*1.04],k*.28);part('torus',[f.x,f.y+.18+t*.9,f.z],[0,0,0],[grow*(.65+t*.25),.035,grow*(.65+t*.25)],f.color,em,k*.48);for(let j=0;j<8;j++){const a=j*Math.PI/4+t*1.8;P(f.x+Math.sin(a)*grow*(.5+t),f.y+.25+Math.sin(a*2+t*5)*.25,f.z+Math.cos(a)*grow*(.5+t),.045+.025*k,k*.65)}
  }else if(f.type==='shield'||f.type==='cloak'){
   part('sphere',[f.x,f.y,f.z],[0,0,0],[grow,grow*1.28,grow],f.color,em,k*(f.type==='cloak'?.18:.25));G('sphere',[f.x,f.y,f.z],[0,0,0],[grow*1.06,grow*1.34,grow*1.06],k*(f.type==='cloak'?.10:.18));for(let j=0;j<3;j++)part('torus',[f.x,f.y-.55+j*.5,f.z],[0,0,0],[grow*(.75+j*.08),.025,grow*(.75+j*.08)],f.color,em,k*.55);
  }else if(f.type==='roots'||f.type==='snare'){
   part('torus',[f.x,.08,f.z],[0,0,0],[grow,.05,grow],f.color,em,k*.75);for(let j=0;j<7;j++){const a=j*0.9+t*.4;part('cone',[f.x+Math.sin(a)*grow*.65,.18+grow*.16,f.z+Math.cos(a)*grow*.65],[Math.sin(a)*.35,-a,Math.cos(a)*.35],[.04,.22+grow*.18,.04],f.color,em,k*.9)}
  }else if(f.type==='silence'||f.type==='fear'||f.type==='stun'){
   part('torus',[f.x,f.y,f.z],[Math.PI/2,0,t*4],[grow,.05,grow],f.color,em,k*.8);part('torus',[f.x,f.y+.28,f.z],[Math.PI/2,1.57,-t*3],[grow*.72,.035,grow*.72],f.color,em,k*.55);for(let j=0;j<4;j++){const a=j*Math.PI/2+t*5;P(f.x+Math.sin(a)*grow*.7,f.y+.35+Math.sin(a*2)*.18,f.z+Math.cos(a)*grow*.7,.065,k*.85)}
  }else if(f.type==='castArcane'||f.type==='castShadow'||f.type==='healCast'){
   part('torus',[f.x,.10,f.z],[0,0,0],[grow,.04,grow],f.color,em,k*.65);G('torus',[f.x,.11,f.z],[0,0,0],[grow*1.1,.10,grow*1.1],k*.32);G('sphere',[f.x,f.y+.15,f.z],[0,0,0],[grow*.50,grow*.50,grow*.50],k*.16);for(let j=0;j<6;j++){const a=j*Math.PI/3-t*5,r=.35+.32*t;P(f.x+Math.sin(a)*r,f.y+Math.sin(a*2+t*4)*.20,f.z+Math.cos(a)*r,.055,k*.75)}
  }else if(f.type==='arcaneImpact'||f.type==='shadowImpact'){
   G('sphere',[f.x,f.y,f.z],[0,0,0],[grow*1.35,grow*1.35,grow*1.35],k*.42);G('torus',[f.x,f.y,f.z],[Math.PI/2,t*3,0],[grow*1.15,.11,grow*1.15],k*.48);G('torus',[f.x,f.y,f.z],[0,t*2,Math.PI/2],[grow*.82,.08,grow*.82],k*.38);for(let j=0;j<5;j++){const a=j*1.256+t*2.4;P(f.x+Math.sin(a)*grow*(.55+t),f.y+(j-2)*.10+t*.35,f.z+Math.cos(a)*grow*(.55+t),.055,k*.8)}
  }else if(f.type==='blinkBurst'){
   G('sphere',[f.x,f.y,f.z],[0,0,0],[grow*1.65,grow*1.9,grow*1.65],k*.34);for(let j=0;j<3;j++){const a=t*6+j*2.094;G('torus',[f.x,f.y+(j-1)*.18,f.z],[Math.PI/2,a,a*.45],[grow*(.62+j*.14),.08,grow*(.62+j*.14)],k*.46)}for(let j=0;j<7;j++){const a=j*.897+t*3;P(f.x+Math.sin(a)*grow*.85,f.y+(j%3-.7)*.22,f.z+Math.cos(a)*grow*.85,.045,k*.75)}
  }else if(f.type==='blinkRibbon'){
   if(!f.to)continue;for(let j=0;j<9;j++){const q=j/8,x=lerp(f.from[0],f.to[0],q),y=lerp(f.from[1],f.to[1],q)+Math.sin(q*Math.PI)*.18,z=lerp(f.from[2],f.to[2],q);G('sphere',[x,y,z],[0,0,0],[f.size*(1.1-q*.45),f.size*(1.1-q*.45),f.size*(1.1-q*.45)],k*(.22+.28*(1-q)))}
  }else if(f.type==='chargeStart'||f.type==='chargeImpact'){
   G('torus',[f.x,.10,f.z],[0,0,0],[grow*1.35,.12,grow*1.35],k*.40);G('sphere',[f.x,f.y,f.z],[0,0,0],[grow*.85,grow*.85,grow*.85],k*.24);for(let j=0;j<6;j++){const a=j*Math.PI/3+t*4;P(f.x+Math.sin(a)*grow*.7,f.y+.15+Math.sin(a*2)*.18,f.z+Math.cos(a)*grow*.7,.05,k*.7)}
  }else if(f.type==='chargeTrail'){
   if(!f.to)continue;for(let j=0;j<4;j++){const q=j/3,x=lerp(f.from[0],f.to[0],q),y=lerp(f.from[1],f.to[1],q),z=lerp(f.from[2],f.to[2],q);G('sphere',[x,y,z],[0,0,0],[f.size*(1-q*.35),f.size*(1-q*.35),f.size*(1-q*.35)],k*.26)}
  }else if(f.type==='starfall'){
   for(let j=0;j<6;j++){const a=j*2.399+(f.extra?.seed||0),r=.6+(j%3)*.55,drop=(t*2.2+j*.17)%1;P(f.x+Math.sin(a)*r,.35+(1-drop)*3.2,f.z+Math.cos(a)*r,.09+drop*.05,k*.9);part('torus',[f.x+Math.sin(a)*r,.06,f.z+Math.cos(a)*r],[0,0,0],[.16+drop*.20,.025,.16+drop*.20],f.color,em,k*.35)}
  }else part('sphere',[f.x,f.y,f.z],[0,0,0],[grow,grow,grow],f.color,hexish(f.color,.7),k*.55);
 }
}
// Positions affichées = interpolation entre les deux derniers pas de simulation (120 Hz) : caméra, décor, noms et marqueurs
// suivent exactement les modèles, sans à-coups quand le nombre de pas varie d'une image à l'autre.
function interpolateUnits(){if(!state?.units)return;const a=renderAlpha;for(const u of state.units){if(u.visualSnap||u.prevX==null){u.rx=u.x;u.ry=u.y||0;u.rz=u.z}else{u.rx=lerp(u.prevX,u.x,a);u.ry=lerp(u.prevY??(u.y||0),u.y||0,a);u.rz=lerp(u.prevZ,u.z,a)}}}
function render(){if(!gl)return;resize();interpolateUnits();gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);const envOn=envEnsureInit();if(envOn)gl.clearColor(0,0,0,0);else gl.clearColor(.10,.14,.22,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);setupCamera();
if(envOn){const p=state?.player||{x:0,y:0,z:0},r=canvas.getBoundingClientRect();ArenaEnv.render(camPos,[p.rx??p.x,(p.ry??p.y??0)+1.25,p.rz??p.z],state?.units,r.width,r.height)}if(typeof renderArena!=='function')throw Error('renderArena manquant');renderArena();renderPersistentCC();const hfOn=hfEnsureInit();if(state?.units)for(const u of state.units){const rec=hfOn?HF.records.get(u.id):null;if(!hfOn||(rec&&rec.failed))renderCharacter(u)}renderFx();renderOverlayWorld();if(hfOn)hfRender()}
function projectScreen(x,y,z){if(!viewProj)return null;const q=tf(viewProj,[x,y,z,1]);if(q[3]<=.01)return null;const nx=q[0]/q[3],ny=q[1]/q[3];return{x:(nx*.5+.5)*canvas.clientWidth,y:(1-(ny*.5+.5))*canvas.clientHeight,z:q[2]/q[3]}}
// Noms et chiffres flottants : éléments réutilisés et déplacés par transform (pas de reconstruction HTML à chaque image).
const OVERLAY={plates:new Map(),floaters:[]};
function renderOverlayWorld(){if(!state)return;const np=$('nameplates'),W=canvas.clientWidth,H=canvas.clientHeight,seen=new Set();
 for(const u of state.units){let e=OVERLAY.plates.get(u);
  if(!e){e=document.createElement('div');e.className='nameplate';e.innerHTML='<div class="npName"></div><div class="npBar"><div class="npFill"></div></div><div class="npCast"><span class="npIcon"></span><div class="npTrack"><div></div><span></span></div></div>';e.style.left=e.style.top='0';np.appendChild(e);
   e._name=e.firstChild;e._fill=e.children[1].firstChild;e._cast=e.children[2];e._castIcon=e._cast.firstChild;e._castFill=e._cast.lastChild.firstChild;e._castName=e._cast.lastChild.lastChild;e._k={};OVERLAY.plates.set(u,e)}
  seen.add(u);const p=u.alive&&!(u.stealth&&u.team!==state.player.team)?projectScreen(u.rx??u.x,(u.ry??u.y??0)+2.65,u.rz??u.z):null,vis=!!p&&p.x>-60&&p.x<W+60&&p.y>-30&&p.y<H+30;
  if(e._k.vis!==vis){e.style.display=vis?'':'none';e._k.vis=vis}if(!vis)continue;
  e.style.transform=`translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-100%)`;
  if(e._k.name!==u.name){e._name.textContent=u.name;e._k.name=u.name}
  const w=(100*u.hp/u.maxHp).toFixed(1);if(e._k.w!==w){e._fill.style.width=w+'%';e._k.w=w}
  const c=u.team===0?'#58c3ff':'#ff6976';if(e._k.c!==c){e._fill.style.background=c;e._k.c=c}
  const t=u===state.player.target;if(e._k.t!==t){e.classList.toggle('target',t);e._k.t=t}
  const cs=!!u.cast;if(e._k.cs!==cs){e._cast.style.display=cs?'flex':'none';e._k.cs=cs}if(cs){const ck=u.cls+':'+u.cast.i;if(e._k.ck!==ck){e._castIcon.innerHTML=skillIconSVG(u.cls,u.cast.i??0);e._castName.textContent=u.cast.name;e._k.ck=ck}}if(cs)e._castFill.style.width=(clamp(1-(u.cast.end-now())/u.cast.dur,0,1)*100).toFixed(1)+'%'}
 for(const [u,e] of OVERLAY.plates)if(!seen.has(u)){e.remove();OVERLAY.plates.delete(u)}
 const fl=$('floaters'),pool=OVERLAY.floaters;let n=0;
 for(const f of state.floaters){const p=projectScreen(f.x+f.off,f.y,f.z);if(!p)continue;
  let e=pool[n];if(!e){e=document.createElement('div');e.className='floater';e.style.left=e.style.top='0';fl.appendChild(e);e._k={};pool.push(e)}n++;
  if(e._k.vis!==true){e.style.display='';e._k.vis=true}
  e.style.transform=`translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%)`;e.style.opacity=clamp(f.life/f.max,0,1).toFixed(2);
  if(e._k.text!==f.text){e.textContent=f.text;e._k.text=f.text}if(e._k.color!==f.color){e.style.color=f.color;e._k.color=f.color}}
 for(let i=n;i<pool.length;i++)if(pool[i]._k.vis!==false){pool[i].style.display='none';pool[i]._k.vis=false}}

