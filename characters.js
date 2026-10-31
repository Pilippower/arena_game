(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CharacterKit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Assemblage des personnages à partir des packs CC0 Quaternius (même squelette 65 os pour tout) :
  // tête du corps de base + tenue + coiffure + pièces procédurales (robe, bâton), recoloration par classe/race.
  // La CLASSE choisit la tenue/silhouette, la RACE ne fait que la morphologie/peau/détails.

  // Clips de la bibliothèque d'animations conservés au build (le reste est retiré pour alléger).
  const ANIMS=['Idle_Loop','Jog_Fwd_Loop','Sprint_Loop','Walk_Loop','Spell_Simple_Shoot','Spell_Simple_Idle_Loop',
    'Sword_Attack','Punch_Jab','Punch_Cross','Death01','Hit_Chest','Hit_Head','Jump_Start','Jump_Loop','Jump_Land','Roll'];

  // CLASSE : tenue (pièces modulaires fusionnées au build), coiffure par défaut, palette, robe, arme, lueur des yeux.
  // Archétypes fantasy génériques et originaux (aucun personnage existant reproduit).
  const CLASSES={
    sentinel:{ // Guerrier : armure de plaques acier bordée d'or, grandes épaulières, épée et bouclier
      sex:'M',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet'],
      hair:{M:'Hair_Buzzed',F:'Hair_Buns'},hairColor:[.32,.20,.11],
      palette:{dark:[.10,.10,.12],mid:[.36,.37,.40],trim:[.74,.56,.28],cloth:[.48,.50,.54]},
      weapon:'swordShield',
      armor:{mat:{kind:'metal',style:{base:[.64,.66,.70],trim:[.80,.60,.26],lames:3,ridge:true,rivets:true}},trim:[.80,.60,.26],
        shells:['cuirass','belt','rerebrace','vambrace','cuisse','greave'],pauldron:{layers:3,size:.135},
        helmet:{mat:{kind:'metal',style:{base:[.66,.68,.72],trim:[.80,.60,.26],rivets:true}}}}},
    arcanist:{ // Sorcière de bataille : robe violet profond / or, capuche, bâton à cristal arcane
      sex:'F',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet','Ranger_Head_Hood'],
      hair:{F:'Hair_Long',M:'Hair_SimpleParted'},hairColor:[.92,.72,.38],
      palette:{dark:[.13,.05,.20],mid:[.36,.14,.55],trim:[.86,.66,.26],cloth:[.93,.89,.80]},
      robe:{color:[.30,.11,.47],trim:[.86,.66,.26],length:.86,flare:1.7},
      staff:{crystal:[.78,.55,1.0]},eyeGlow:[.55,.30,1.0],
      // mantelet de tissu brodé d'or, ceinture et brassards assortis
      armor:{mat:{kind:'cloth',style:{base:[.30,.11,.46],trim:[.86,.66,.26],stitch:[.86,.66,.26],grain:.05}},trim:[.86,.66,.26],
        shells:['belt','vambrace'],pauldron:{layers:2,size:.105,cover:1.3}}},
    oracle:{ // Prêtresse : robe blanche et or, bâton solaire
      sex:'F',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet'],
      hair:{F:'Hair_Buns',M:'Hair_SimpleParted'},hairColor:[.45,.27,.14],
      palette:{dark:[.40,.30,.16],mid:[.86,.82,.72],trim:[.90,.72,.30],cloth:[.97,.95,.90]},
      robe:{color:[.90,.88,.82],trim:[.88,.68,.25],length:.9,flare:1.6},
      staff:{crystal:[1.0,.82,.40],wood:0xe8dcc0,metal:0xd9b55a},
      // mantelet blanc à larges bordures dorées, ceinture d'or
      armor:{mat:{kind:'cloth',style:{base:[.93,.91,.85],trim:[.88,.68,.25],stitch:[.88,.68,.25],lames:2,grain:.04}},trim:[.92,.72,.28],
        shellMat:{belt:{kind:'metal',style:{base:[.88,.68,.28],lames:1,rivets:true,trim:[.95,.85,.5]}}},
        shells:['belt','vambrace'],pauldron:{layers:2,size:.11,cover:1.35}}},
    reaver:{ // Chevalier runique : plaques d'acier noirci à runes de givre, épaulières à pointes, grande lame runique
      sex:'M',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet'],
      hair:{M:'Hair_Long',F:'Hair_Long'},hairColor:[.78,.80,.82],
      palette:{dark:[.05,.06,.08],mid:[.20,.24,.30],trim:[.55,.74,.88],cloth:[.26,.30,.36]},
      weapon:'runeblade',eyeGlow:[.40,.80,1.0],
      armor:{mat:{kind:'metal',style:{base:[.17,.19,.22],trim:[.30,.34,.40],lames:3,ridge:true,rune:[.45,.85,1]}},trim:[.34,.38,.46],
        shells:['cuirass','belt','rerebrace','vambrace','cuisse','greave'],pauldron:{layers:3,size:.145,spikes:3}}},
    warden:{ // Druide : cuir et lin naturels, bois de cerf, bâton noueux à cristal vert
      sex:'M',outfit:['Ranger_Body','Ranger_Arms','Peasant_Legs','Ranger_Feet'],
      hair:{M:'Hair_Long',F:'Hair_Long'},hairColor:[.36,.22,.10],
      palette:{dark:[.16,.10,.05],mid:[.40,.27,.13],trim:[.52,.60,.24],cloth:[.66,.58,.40]},
      staff:{crystal:[.45,1.0,.35],wood:0x4a3018,metal:0x8a7a40},antlers:true,
      armor:{mat:{kind:'leather',style:{base:[.32,.21,.11],trim:[.22,.34,.12],stitch:[.6,.5,.3]}},shells:['vambrace','greave'],
        pauldron:{layers:2,size:.125,leaves:true,mat:{kind:'leather',style:{base:[.30,.20,.11],lames:4,grain:.16}}}}},
    shade:{ // Voleuse : armure de cuir noir et rouge, masque, capuche, deux dagues aux hanches
      sex:'F',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet','Ranger_Head_Hood'],
      hair:{F:'Hair_Long',M:'Hair_Buzzed'},hairColor:[.10,.07,.06],
      palette:{dark:[.04,.04,.05],mid:[.14,.14,.17],trim:[.50,.12,.10],cloth:[.24,.24,.27]},
      weapon:'daggers',
      armor:{mat:{kind:'leather',style:{base:[.075,.065,.07],trim:[.46,.07,.06],stitch:[.7,.13,.1],lames:2,grain:.08}},
        shellMat:{belt:{kind:'leather',style:{base:[.48,.07,.06],stitch:[.15,.02,.02],grain:.1}}},
        shells:['chest','belt','vambrace','greave'],pauldron:{layers:2,size:.1},mask:[.025,.02,.025]}},
    warlock:{ // Occultiste : robe noire et verte, capuche, bâton à flamme verte
      sex:'M',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet','Ranger_Head_Hood'],
      hair:{M:'Hair_SimpleParted',F:'Hair_Long'},hairColor:[.12,.10,.10],
      palette:{dark:[.06,.04,.07],mid:[.22,.10,.24],trim:[.40,.80,.22],cloth:[.30,.26,.24]},
      robe:{color:[.12,.07,.13],trim:[.38,.78,.20],length:.9,flare:1.5},
      staff:{crystal:[.40,1.0,.25],wood:0x1c1418,metal:0x50604a},eyeGlow:[.40,1.0,.25],
      // mantelet sombre aux runes vertes et cornes d'os
      armor:{mat:{kind:'cloth',style:{base:[.09,.06,.10],trim:[.38,.78,.20],rune:[.40,1.0,.25],grain:.06}},trim:[.20,.24,.18],
        shells:['belt','vambrace'],pauldron:{layers:2,size:.115,cover:1.3,spikes:2,spikeColor:0xe6dcc0}}}
  };
  // RACE : morphologie (échelle des os, rotations seulement dans les animations), peau, cheveux, détails.
  const RACES={
    human:{},
    orc:{sex:'M',skin:[.58,.98,.42],hairColor:[.07,.05,.04],noHair:true,tusks:true,ears:{len:.055,up:.25},
      bones:{spine_02:1.1,spine_03:1.1,neck_01:.86}},
    dwarf:{sex:'M',skin:[1.08,.92,.84],hairColor:[.55,.24,.09],beard:true,hair:'Hair_Buzzed',
      bigBeard:true,bones:{spine_01:1.2,spine_02:1.05,neck_01:.9,upperarm_l:1.06,upperarm_r:1.06,thigh_l:.78,thigh_r:.78}},
    elf:{skin:[1.06,1.0,.98],hairColor:[.93,.90,.80],ears:{len:.13,up:.6},eyeGlow:[.35,.85,1.0],
      bones:{spine_03:.96}},
    undead:{skin:[.84,.80,.68],hairColor:[.17,.17,.16],noHair:true,skull:true,eyeGlow:[1.0,.75,.25],bones:{spine_03:.95,neck_01:.97}}
  };
  const SEXNAME={F:'Female',M:'Male'};
  const PARTFILE={Ranger_Feet:{F:'Female_Ranger_Feet',M:'Male_Ranger_Feet_Boots'},Ranger_Pauldron:{F:'Female_Ranger_Acc_Pauldrons',M:'Male_Ranger_Acc_Pauldron'}};
  const partFile=(key,sex)=>(PARTFILE[key]?.[sex]||SEXNAME[sex]+'_'+key)+'.gltf';
  const sexFor=(race,cls)=>RACES[race].sex||CLASSES[cls].sex;
  // Kit complet d'une race+classe.
  function resolveKit(kitId){
    const [race,cls]=kitId.split('_'),R=RACES[race],C=CLASSES[cls];
    if(!R||!C)throw new Error('Kit inconnu : '+kitId);
    const sex=sexFor(race,cls),hair=R.noHair||C.armor?.helmet?[]:[R.hair&&sex==='M'?R.hair:C.hair[sex]];if(R.beard)hair.push('Hair_Beard.gltf');
    return {...C,race,cls,sex,body:'Superhero_'+SEXNAME[sex]+'_FullBody.gltf',outfit:'outfit_'+cls+'_'+sex,
      hair:hair.map(h=>/\.gltf$/.test(h)?h:h+'.gltf'),hairColor:R.hairColor||C.hairColor,skin:R.skin||[1,1,1],
      eyeGlow:R.eyeGlow||C.eyeGlow,ears:R.ears,tusks:R.tusks,skull:R.skull,bigBeard:R.bigBeard,bones:R.bones||{}};
  }
  const KITS={};for(const r in RACES)for(const c in CLASSES)KITS[r+'_'+c]={race:r,cls:c};
  // Pour le build : bundles de tenue (pièces fusionnées) et fichiers simples nécessaires.
  function buildManifest(){
    const outfits={},files=new Set();
    for(const id in KITS){const k=resolveKit(id);outfits[k.outfit]=CLASSES[k.cls].outfit.map(p=>partFile(p,k.sex));files.add(k.body);k.hair.forEach(h=>files.add(h))}
    return {outfits,files:[...files]};
  }

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function rgbToHsl(r,g,b){
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;
    if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);
      h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6}
    return [h,s,l];
  }

  // Recolore une texture de tenue : les tons cuir/bruns deviennent la palette de classe,
  // les tissus clairs désaturés et le métal sont conservés. Réduit aussi la texture à `size`.
  function recolorTexture(THREE,tex,pal,size=1024,lightIsCloth=false){
    const img=tex.image,c=document.createElement('canvas');c.width=c.height=size;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0,size,size);
    const id=ctx.getImageData(0,0,size,size),d=id.data;
    for(let i=0;i<d.length;i+=4){
      const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255,[h,s,l]=rgbToHsl(r,g,b);
      let t=null;
      let ref=.5;
      if(s<.32&&l>.5)t=pal.cloth;                       // tissu clair
      else if(lightIsCloth&&s<.3&&l>.36){t=pal.cloth;ref=.62}  // chemise homme : lin gris-beige plus sombre dans la texture
      else if(s>=.18&&(h<.16||h>.92)){                    // bruns / cuir / tan
        t=l>.48?pal.trim:l>.2?pal.mid:pal.dark;
      }
      else if(s>=.18&&h>.18&&h<.48){t=pal.mid;ref=.3}        // verts (tenue Rôdeur), plus sombres : teinte unie, le relief vient de k
      if(!t)continue;
      const k=l/ref;                                      // garde le relief peint (lumière/ombre)
      d[i]=clamp(t[0]*k*255,0,255);d[i+1]=clamp(t[1]*k*255,0,255);d[i+2]=clamp(t[2]*k*255,0,255);
    }
    ctx.putImageData(id,0,0);
    const out=new THREE.CanvasTexture(c);
    out.flipY=tex.flipY;out.encoding=tex.encoding;out.wrapS=tex.wrapS;out.wrapT=tex.wrapT;
    return out;
  }

  const comp=(a,v,k)=>k===0?a.getX(v):k===1?a.getY(v):k===2?a.getZ(v):a.getW(v);
  // Ne garde que les triangles dont les sommets sont dominés par l'un des os listés.
  function keepOnlyBones(mesh,names){
    const geo=mesh.geometry,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,idx=geo.index;
    const keep=new Set(names.map(n=>mesh.skeleton.bones.findIndex(b=>b.name===n)).filter(i=>i>=0));
    const ok=v=>{let best=0,bw=-1;for(let k=0;k<4;k++){const w=comp(sw,v,k);if(w>bw){bw=w;best=comp(si,v,k)}}return keep.has(best)};
    const out=[];
    for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);if(ok(a)&&ok(b)&&ok(c))out.push(a,b,c)}
    geo.setIndex(out);
  }

  // Les tenues fusionnent plusieurs pièces, chacune avec son squelette : GLTFLoader suffixe alors les doublons (root_1, spine_01_2…).
  // Les pièces qui ont les mêmes os et les mêmes matrices de bind partagent un squelette (`shared`) :
  // three ne recalcule alors les matrices qu'une fois par image au lieu d'une fois par pièce.
  function bindToSkeleton(THREE,mesh,bones,host,shared){
    const list=mesh.skeleton.bones.map(b=>bones[b.name]||bones[b.name.replace(/_\d+$/,'')]||b),inv=mesh.skeleton.boneInverses;
    let sk=shared&&shared.find(k=>k.bones.length===list.length&&k.bones.every((b,i)=>b===list[i])&&k.boneInverses.every((m,i)=>m.equals(inv[i])));
    if(!sk){sk=new THREE.Skeleton(list,inv);if(shared)shared.push(sk)}
    host.add(mesh);mesh.bind(sk,mesh.bindMatrix);
  }

  // Robe longue procédurale, skinnée bassin + cuisses pour suivre les jambes.
  // Profil réel du corps habillé (pose de bind) : rayon max par secteur angulaire autour du bassin, à une hauteur donnée.
  function bodyProfile(THREE,meshes,inv,center,y,band,seg){
    const r=new Array(seg).fill(0),v=new THREE.Vector3();
    for(const m of meshes){
      const pos=m.geometry.attributes.position,mat=new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld);
      for(let i=0;i<pos.count;i++){
        v.fromBufferAttribute(pos,i).applyMatrix4(mat);if(Math.abs(v.y-y)>band)continue;
        const dx=v.x-center.x,dz=v.z-center.z,a=(Math.atan2(dx,dz)+Math.PI*2)%(Math.PI*2);
        const k=Math.min(seg-1,Math.floor(a/(Math.PI*2)*seg));r[k]=Math.max(r[k],Math.hypot(dx,dz));
      }
    }
    // secteurs vides → voisins, puis lissage circulaire
    for(let pass=0;pass<seg;pass++)for(let k=0;k<seg;k++)if(!r[k])r[k]=Math.max(r[(k+seg-1)%seg],r[(k+1)%seg]);
    for(let pass=0;pass<3;pass++){const c=r.slice();for(let k=0;k<seg;k++)r[k]=Math.max(c[k],(c[(k+seg-1)%seg]+2*c[k]+c[(k+1)%seg])/4)}
    return r;
  }

  function buildRobe(THREE,body,bones,cfg,fitMeshes){
    body.updateMatrixWorld(true);fitMeshes.forEach(m=>m.updateMatrixWorld(true));
    const inv=new THREE.Matrix4().copy(body.matrixWorld).invert();
    const P=n=>new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(inv);
    const pelvis=P('pelvis'),tl=P('thigh_l'),tr=P('thigh_r'),cl=P('calf_l'),fl=P('foot_l');
    const sk=body.skeleton.bones,bi=n=>sk.findIndex(b=>b.name===n);
    const iP=bi('pelvis'),iL=bi('thigh_l'),iR=bi('thigh_r'),iCL=bi('calf_l'),iCR=bi('calf_r');
    const hipHalf=Math.abs(tl.x-tr.x)/2,top=pelvis.y+.15,bottom=fl.y+(cl.y-fl.y)*(1-cfg.length)+.03;
    const lSign=Math.sign(tl.x-tr.x)||1,SEG=40,RINGS=16;
    const pos=[],uv=[],si=[],sw=[],idx=[];
    // La robe épouse le corps habillé en haut (taille/bassin) puis s'évase ; un rayon ne diminue jamais en descendant.
    let prev=null;
    for(let j=0;j<=RINGS;j++){
      const t=j/RINGS,y=top+(bottom-top)*t,prof=bodyProfile(THREE,fitMeshes,inv,pelvis,y,.025,SEG);
      const flare=(cfg.flare-1)*hipHalf*1.3*Math.pow(t,1.5);
      const ring=prof.map((r,k)=>Math.max(r+.012+.025*t,prev?prev[k]:0));prev=ring;   // marge croissante vers le genou
      for(let i=0;i<=SEG;i++){
        const a=(i+.5)/SEG*Math.PI*2,rr=ring[i%SEG]+flare,x=Math.sin(a)*rr,z=Math.cos(a)*rr;
        pos.push(pelvis.x+x,y,pelvis.z+z);uv.push(i/SEG,t);
        // Sous la hanche, la robe suit franchement la cuisse de son côté (sinon le genou ressort en course) ;
        // seule une étroite bande devant/derrière se partage entre les deux jambes.
        const leg=clamp(t*2.4,0,1),wl=clamp(.5+lSign*Math.sin(a)*1.6,0,1);
        const calf=t>.6?(t-.6)/.4*.35:0;
        si.push(iP,iL,iR,wl>.5?iCL:iCR);
        sw.push(1-leg,(leg-calf)*wl,(leg-calf)*(1-wl),calf);
      }
    }
    for(let j=0;j<RINGS;j++)for(let i=0;i<SEG;i++){const a=j*(SEG+1)+i,b=a+SEG+1;idx.push(a,b,a+1,b,b+1,a+1)}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));
    geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
    geo.setIndex(idx);geo.computeVertexNormals();
    // Texture : tissu avec plis verticaux, bande dorée en bas et ouverture brodée devant.
    const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
    const col=a=>`rgb(${a.map(v=>Math.round(clamp(v,0,1)*255)).join(',')})`;
    g.fillStyle=col(cfg.color);g.fillRect(0,0,512,256);
    for(let x=0;x<512;x+=32){const gr=g.createLinearGradient(x,0,x+32,0);gr.addColorStop(0,'rgba(0,0,0,.12)');gr.addColorStop(.5,'rgba(255,255,255,.05)');gr.addColorStop(1,'rgba(0,0,0,.12)');g.fillStyle=gr;g.fillRect(x,0,32,256)}
    for(let i=0;i<5000;i++){g.fillStyle=`rgba(${Math.random()<.5?'0,0,0':'255,255,255'},.05)`;g.fillRect(Math.random()*512,Math.random()*256,2,2)}
    const vg=g.createLinearGradient(0,0,0,256);vg.addColorStop(0,'rgba(0,0,0,.35)');vg.addColorStop(.3,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.25)');g.fillStyle=vg;g.fillRect(0,0,512,256);
    g.fillStyle=col(cfg.trim);g.fillRect(0,232,512,10);g.fillRect(0,222,512,3);g.fillRect(0,0,512,9);
    g.fillRect(0,0,6,256);g.fillRect(506,0,6,256);     // bord avant (a=0 → face +z)
    g.fillStyle=col(cfg.color.map(v=>v*.55));g.fillRect(6,9,10,213);g.fillRect(496,9,10,213);
    g.fillStyle=col(cfg.trim);for(let x=8;x<512;x+=32){g.beginPath();g.moveTo(x,222);g.lineTo(x+8,206);g.lineTo(x+16,222);g.fill()}
    const tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;
    const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.78,metalness:.02,side:THREE.DoubleSide,skinning:true});
    const robe=new THREE.SkinnedMesh(geo,mat);robe.name='Robe';robe.frustumCulled=false;
    body.parent.add(robe);robe.position.copy(body.position);robe.quaternion.copy(body.quaternion);robe.scale.copy(body.scale);
    robe.bind(body.skeleton,body.bindMatrix);
    return robe;
  }

  // Halo lumineux additif (sprite) : donne l'impression de lumière sans post-traitement.
  const haloTextures=new Map();
  function glowSprite(THREE,color,size){
    if(!haloTextures.has('h')){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
      const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=gr;g.fillRect(0,0,64,64);haloTextures.set('h',new THREE.CanvasTexture(c))}
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTextures.get('h'),color,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
    sp.scale.set(size,size,1);return sp;
  }

  // Yeux lumineux : l'iris (zone brune saturée de la texture) est recoloré et rendu émissif.
  function glowEyes(THREE,mesh,color,headBone,inv){
    const m=mesh.material=mesh.material.clone(),img=m.map&&m.map.image;if(!img)return;
    const size=img.width||256,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.drawImage(img,0,0,size,size);
    const mask=document.createElement('canvas');mask.width=mask.height=size;const mg=mask.getContext('2d'),mid=mg.createImageData(size,size);
    const id=g.getImageData(0,0,size,size),d=id.data;
    for(let i=0;i<d.length;i+=4){const [h,s,l]=rgbToHsl(d[i]/255,d[i+1]/255,d[i+2]/255);
      const x=(i/4)%size,y=Math.floor(i/4/size),r=Math.hypot(x-size/2,y-size/2)/size;
      if(r<.14&&(s>.3&&h<.14&&l<.55||l<.12)){const k=l<.12?.35:1;d[i]=color.r*255*k;d[i+1]=color.g*255*k;d[i+2]=color.b*255*k;mid.data[i]=mid.data[i+1]=mid.data[i+2]=255*k;mid.data[i+3]=255}
      else mid.data[i+3]=255}
    g.putImageData(id,0,0);mg.putImageData(mid,0,0);
    const t=new THREE.CanvasTexture(c);t.flipY=m.map.flipY;t.encoding=m.map.encoding;m.map=t;
    const e=new THREE.CanvasTexture(mask);e.flipY=m.map.flipY;m.emissiveMap=e;m.emissive=color.clone();m.emissiveIntensity=1.6;
    // petits halos devant chaque œil, attachés à la tête
    const pos=mesh.geometry.attributes.position,v=new THREE.Vector3(),sides=[[],[]];
    mesh.updateMatrixWorld(true);const mat=new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld);
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(mat);sides[v.x<0?0:1].push(v.clone())}
    for(const pts of sides){if(!pts.length)continue;
      const cen=pts.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/pts.length),front=Math.max(...pts.map(p=>p.z));
      const sp=glowSprite(THREE,color,.024);sp.material.opacity=.7;sp.name='EyeGlow';sp.position.set(cen.x,cen.y,front+.004);headBone.attach(sp)}
  }

  // Point d'accroche dans le dos (surface mesurée sur la tenue ; le personnage regarde +z, le dos est vers -z).
  function backMount(THREE,body,bones,fitMeshes){
    body.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(body.matrixWorld).invert(),sp=new THREE.Vector3().setFromMatrixPosition(bones.spine_03.matrixWorld).applyMatrix4(inv);
    let back=sp.z;const v=new THREE.Vector3();
    for(const m of fitMeshes){const pos=m.geometry.attributes.position,mat=new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld);
      for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(mat);if(Math.abs(v.y-sp.y)<.08&&Math.abs(v.x-sp.x)<.08)back=Math.min(back,v.z)}}
    const tl=new THREE.Vector3().setFromMatrixPosition(bones.thigh_l.matrixWorld).applyMatrix4(inv),tr=new THREE.Vector3().setFromMatrixPosition(bones.thigh_r.matrixWorld).applyMatrix4(inv);
    return {sp,back,toRight:Math.sign(tr.x-tl.x)||-1,hipHalf:Math.abs(tl.x-tr.x)/2,pelvis:new THREE.Vector3().setFromMatrixPosition(bones.pelvis.matrixWorld).applyMatrix4(inv)};
  }
  // Fixe un objet placé en coordonnées du corps (pose de bind) sur un os, en conservant sa position.
  function mount(THREE,body,bone,obj){
    obj.position.applyMatrix4(body.matrixWorld);obj.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(body.matrixWorld));
    bone.attach(obj);return obj;
  }

  // Bâton porté dans le dos, en diagonale (cristal au-dessus de l'épaule droite), attaché au haut de la colonne.
  function buildStaff(THREE,body,bones,cfg,height,fitMeshes){
    const s=height/1.8,g=new THREE.Group();g.name='Staff';
    const wood=new THREE.MeshStandardMaterial({color:cfg.wood??0x3b2416,roughness:.7,metalness:.05});
    const gold=new THREE.MeshStandardMaterial({color:cfg.metal??0xc9a04a,roughness:.32,metalness:.85});
    const cc=new THREE.Color(...cfg.crystal);
    const crystalMat=new THREE.MeshStandardMaterial({color:cc,emissive:cc,emissiveIntensity:2.8,roughness:.15,metalness:.1,transparent:true,opacity:.95});
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.018*s,.024*s,1.55*s,10),wood);g.add(shaft);
    for(const y of [-.70,-.2,.55,.68]){const r=new THREE.Mesh(new THREE.CylinderGeometry(.03*s,.03*s,.035*s,12),gold);r.position.y=y*s;g.add(r)}
    // Tête du bâton : deux crochets qui enserrent le cristal
    for(const side of [-1,1]){const hook=new THREE.Mesh(new THREE.TorusGeometry(.085*s,.012*s,8,20,Math.PI*1.1),gold);hook.position.set(side*.02*s,.84*s,0);hook.rotation.set(0,side>0?0:Math.PI,-.5);g.add(hook)}
    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.07*s,0),crystalMat);crystal.scale.set(.8,1.5,.8);crystal.position.y=.86*s;g.add(crystal);
    const glow=new THREE.PointLight(cc,1.4,1.8*s);glow.position.y=.86*s;g.add(glow);
    // Halo magique pulsant autour du cristal
    const hc=cc.clone().multiplyScalar(.85);hc.g*=.55;               // halo plus saturé que le cristal
    const halo=glowSprite(THREE,hc,.42*s),core=glowSprite(THREE,cc,.13*s);halo.position.y=core.position.y=.86*s;halo.name='CrystalGlow';g.add(halo,core);
    halo.onBeforeRender=()=>{const t=performance.now()/1000,p=1+Math.sin(t*3.1)*.12+Math.sin(t*7.3)*.05;halo.scale.set(.42*s*p,.42*s*p,1);glow.intensity=1.4*p};
    const M=backMount(THREE,body,bones,fitMeshes);
    g.position.set(M.sp.x,M.sp.y-.12*s,M.back-.04*s);
    g.rotation.z=-M.toRight*.55;                       // le haut part vers l'épaule droite
    return mount(THREE,body,bones.spine_03,g);
  }

  // Armes de mêlée, rangées comme le bâton : dans le dos ou aux hanches.
  function buildWeapon(THREE,body,bones,kind,height,fitMeshes){
    const s=height/1.8,M=backMount(THREE,body,bones,fitMeshes);
    const steel=new THREE.MeshStandardMaterial({color:0xb8bec6,roughness:.28,metalness:.9});
    const dark=new THREE.MeshStandardMaterial({color:0x2a2d33,roughness:.4,metalness:.8});
    const leather=new THREE.MeshStandardMaterial({color:0x3a2416,roughness:.85});
    const bronze=new THREE.MeshStandardMaterial({color:0xb0843c,roughness:.35,metalness:.85});
    const B=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w*s,h*s,d*s),m);
    const sword=(len,width,bladeMat,guardMat)=>{const w=new THREE.Group();
      const blade=B(width,len,.012,bladeMat);blade.position.y=len/2*s;w.add(blade);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(width*.72*s,width*1.6*s,4),bladeMat);tip.scale.z=.18;tip.rotation.y=Math.PI/4;tip.position.y=(len+width*.8)*s;w.add(tip);
      const guard=B(width*3.2,.035,.04,guardMat);w.add(guard);
      const grip=new THREE.Mesh(new THREE.CylinderGeometry(.016*s,.018*s,.2*s,8),leather);grip.position.y=-.11*s;w.add(grip);
      const pommel=new THREE.Mesh(new THREE.SphereGeometry(.028*s,10,8),guardMat);pommel.position.y=-.23*s;w.add(pommel);return w};
    if(kind==='swordShield'){
      // Bouclier rond sur le dos, épée longue à la hanche gauche
      const sh=new THREE.Group();sh.name='Shield';
      const wood=new THREE.MeshStandardMaterial({color:0x6b1d16,roughness:.6,metalness:.1});
      const disc=new THREE.Mesh(new THREE.CylinderGeometry(.27*s,.27*s,.03*s,32),wood);disc.rotation.x=Math.PI/2;sh.add(disc);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.27*s,.018*s,8,40),steel);sh.add(rim);
      const boss=new THREE.Mesh(new THREE.SphereGeometry(.07*s,16,10,0,Math.PI*2,0,Math.PI/2),steel);boss.rotation.x=-Math.PI/2;boss.position.z=-.015*s;sh.add(boss);
      for(const a of [0,Math.PI/2]){const band=B(.04,.5,.01,bronze);band.rotation.z=a;band.position.z=-.018*s;sh.add(band)}
      sh.position.set(M.sp.x,M.sp.y-.06*s,M.back-.05*s);mount(THREE,body,bones.spine_03,sh);
      const sw=sword(.78,.055,steel,bronze);sw.name='Sword';sw.rotation.set(.25,0,Math.PI+M.toRight*.22);
      sw.position.set(M.pelvis.x-M.toRight*(M.hipHalf+.1*s),M.pelvis.y+.02*s,M.pelvis.z-.03*s);mount(THREE,body,bones.pelvis,sw);
    }else if(kind==='runeblade'){
      // Grande lame runique dans le dos, poignée au-dessus de l'épaule droite
      const sw=sword(1.0,.09,dark,dark);sw.name='Runeblade';
      const rc=new THREE.Color(.45,.85,1),rune=new THREE.MeshStandardMaterial({color:rc,emissive:rc,emissiveIntensity:2.2});
      for(let i=0;i<5;i++){const r=B(.035,.05,.016,rune);r.position.y=(.15+i*.17)*s;sw.add(r)}
      const glow=glowSprite(THREE,rc,.35*s);glow.position.y=.5*s;glow.scale.set(.25*s,1.1*s,1);glow.material.opacity=.35;sw.add(glow);
      sw.rotation.z=Math.PI-M.toRight*.5;sw.position.set(M.sp.x,M.sp.y+.05*s,M.back-.05*s);mount(THREE,body,bones.spine_03,sw);
    }else if(kind==='daggers'){
      for(const side of [-1,1]){const d=sword(.26,.04,steel,dark);d.name='Dagger';d.rotation.set(-.35,0,Math.PI+side*.15);
        d.position.set(M.pelvis.x+side*(M.hipHalf+.09*s),M.pelvis.y-.02*s,M.pelvis.z-.04*s);mount(THREE,body,bones.pelvis,d)}
    }
  }

  // Détails raciaux sur la tête : oreilles pointues, défenses, bois de cerf (druide). Mesurés sur la tête réelle.
  function headFeatures(THREE,kit,root,body,bones,skinColor){
    if(!kit.ears&&!kit.tusks&&!kit.antlers)return;
    body.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(body.matrixWorld).invert(),pts=[],v=new THREE.Vector3();
    const geo=body.geometry,pos=geo.attributes.position,idx=geo.index,mat=new THREE.Matrix4().multiplyMatrices(inv,body.matrixWorld);
    const seen=new Set();for(let i=0;i<idx.count;i++){const k=idx.getX(i);if(seen.has(k))continue;seen.add(k);pts.push(v.fromBufferAttribute(pos,k).applyMatrix4(mat).clone())}
    let eyes=null;root.traverse(o=>{if(o.isMesh&&o.name==='Eyes')eyes=o});
    const eye=new THREE.Vector3();if(eyes){eyes.geometry.computeBoundingBox();eyes.geometry.boundingBox.getCenter(eye);eye.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,eyes.matrixWorld))}
    const top=Math.max(...pts.map(p=>p.y)),cx=eye.x;
    const front=pts.filter(p=>Math.abs(p.x-cx)<.015&&p.y<eye.y-.03&&p.y>eye.y-.12);
    const chin=Math.min(...front.map(p=>p.y)),mouthZ=Math.max(...front.filter(p=>p.y<eye.y-.07).map(p=>p.z));
    const skin=new THREE.MeshStandardMaterial({color:skinColor,roughness:.62,metalness:0});
    const ivory=new THREE.MeshStandardMaterial({color:0xece0c2,roughness:.45});
    const cone=(r,len,m)=>{const g=new THREE.ConeGeometry(r,len,10);g.translate(0,len/2,0);return new THREE.Mesh(g,m)};
    const aim=(o,d)=>o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    for(const side of [-1,1]){
      if(kit.ears){
        const band=pts.filter(p=>Math.abs(p.y-(eye.y-.01))<.025&&p.z<eye.z-.04&&Math.sign(p.x-cx)===side);
        const ear=band.reduce((a,b)=>Math.abs(b.x-cx)>Math.abs(a.x-cx)?b:a,band[0]||eye);
        const e=cone(.017,kit.ears.len,skin);e.geometry.scale(1,1,.38);e.name='Ear';
        aim(e,new THREE.Vector3(side,kit.ears.up,-.45));e.position.set(ear.x-side*.006,ear.y+.004,ear.z+.004);
        mount(THREE,body,bones.Head,e);
      }
      if(kit.tusks){
        // défenses inférieures : partent de la lèvre du bas et remontent devant la lèvre supérieure
        const t=cone(.0068,.034,ivory);t.name='Tusk';aim(t,new THREE.Vector3(side*.22,1,.12));
        t.position.set(cx+side*.02,chin+.036,mouthZ-.006);mount(THREE,body,bones.Head,t);
      }
      if(kit.antlers){
        const horn=new THREE.MeshStandardMaterial({color:0x6e5536,roughness:.8});
        const g=new THREE.Group();g.name='Antler';
        const seg=(from,dir,len,r)=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(r*.7,r,len,7),horn);c.geometry.translate(0,len/2,0);aim(c,dir.clone());c.position.copy(from);g.add(c);return from.clone().add(dir.clone().normalize().multiplyScalar(len))};
        let p=new THREE.Vector3();
        p=seg(p,new THREE.Vector3(side*.8,1,-.3),.09,.012);const t1=p.clone();
        p=seg(p,new THREE.Vector3(side*.5,1,-.5),.10,.009);const t2=p.clone();
        seg(p,new THREE.Vector3(side*.2,1,-.1),.07,.006);
        seg(t1,new THREE.Vector3(side*.15,1,.5),.07,.006);seg(t2,new THREE.Vector3(side,.6,.1),.06,.005);
        g.position.set(cx+side*.045,top-.03,eye.z-.07);mount(THREE,body,bones.Head,g);
      }
    }
  }

  // Couleur moyenne d'une texture (pour teinter les pièces procédurales comme la peau).
  function averageColor(THREE,tex){
    const c=new THREE.Color(.8,.6,.5);if(!tex||!tex.image)return c;
    const cv=document.createElement('canvas');cv.width=cv.height=8;const g=cv.getContext('2d');g.drawImage(tex.image,0,0,8,8);
    const d=g.getImageData(0,0,8,8).data;let r=0,gg=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){const l=(d[i]+d[i+1]+d[i+2])/765;if(l<.15)continue;r+=d[i];gg+=d[i+1];b+=d[i+2];n++}
    if(n)c.setRGB(r/n/255,gg/n/255,b/n/255).convertSRGBToLinear();return c;
  }

  // ---- Armures procédurales ------------------------------------------------------------------
  // Pose de bind = T-pose, corps à l'origine, mètres, regard +z ; l'axe long de chaque os est son +y local.
  const rng=seed=>()=>(seed=(seed*16807)%2147483647)/2147483647;       // pseudo-aléatoire stable

  // Reflets des métaux : dégradé ciel/sol équirectangulaire (three le convertit en cubemap).
  let envTex=null;
  function envMap(THREE){
    if(envTex)return envTex;
    const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,128);
    gr.addColorStop(0,'#d6e2f2');gr.addColorStop(.42,'#8496b0');gr.addColorStop(.5,'#f0d9b5');gr.addColorStop(.56,'#5a4a3a');gr.addColorStop(1,'#16120e');
    g.fillStyle=gr;g.fillRect(0,0,256,128);
    for(let i=0;i<6;i++){const x=i*43+10,y=18+(i*37)%30,rg=g.createRadialGradient(x,y,0,x,y,18);rg.addColorStop(0,'rgba(255,255,255,.9)');rg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=rg;g.fillRect(x-18,y-18,36,36)}
    envTex=new THREE.CanvasTexture(c);envTex.mapping=THREE.EquirectangularReflectionMapping;envTex.encoding=THREE.sRGBEncoding;return envTex;
  }

  // Texture de plaque/cuir : u fait le tour (avant au centre), v suit le segment.
  const armorTextures=new Map();
  function armorTexture(THREE,st){
    const key=JSON.stringify(st);if(armorTextures.has(key))return armorTextures.get(key);
    const W=256,H=256,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
    const col=a=>`rgb(${a.map(v=>Math.round(clamp(v,0,1)*255)).join(',')})`,rnd=rng(7);
    g.fillStyle=col(st.base);g.fillRect(0,0,W,H);
    for(let i=0;i<4000;i++){g.fillStyle=`rgba(${rnd()<.5?'0,0,0':'255,255,255'},${st.grain||.06})`;g.fillRect(rnd()*W,rnd()*H,1+rnd()*4,1)}
    const n=st.lames||1;
    for(let k=1;k<n;k++){const y=k*H/n;g.fillStyle='rgba(0,0,0,.6)';g.fillRect(0,y-2,W,3);g.fillStyle='rgba(255,255,255,.22)';g.fillRect(0,y+1,W,2)}
    if(st.ridge){const gr=g.createLinearGradient(W/2-12,0,W/2+12,0);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(.45,'rgba(255,255,255,.35)');gr.addColorStop(.55,'rgba(0,0,0,.35)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(W/2-12,0,24,H)}
    if(st.trim){g.fillStyle=col(st.trim);g.fillRect(0,0,W,10);g.fillRect(0,H-10,W,10);g.fillStyle='rgba(0,0,0,.45)';g.fillRect(0,10,W,2);g.fillRect(0,H-12,W,2);
      if(st.rivets)for(let x=6;x<W;x+=16)for(const y of [5,H-5]){g.fillStyle='rgba(255,255,255,.75)';g.beginPath();g.arc(x,y,2,0,7);g.fill()}}
    if(st.stitch){g.strokeStyle=col(st.stitch);g.lineWidth=2;g.setLineDash([5,4]);for(const y of [16,H-16]){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}g.setLineDash([])}
    let emissiveMap=null;
    if(st.rune){const e=document.createElement('canvas');e.width=W;e.height=H;const ge=e.getContext('2d');ge.fillStyle='#000';ge.fillRect(0,0,W,H);
      for(const ctx of [g,ge]){ctx.strokeStyle=col(st.rune);ctx.lineWidth=3;
        for(let x=14;x<W;x+=42){const y0=H*.32,y1=H*.68,ym=(y0+y1)/2;ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x+9,ym);ctx.lineTo(x,y1);ctx.moveTo(x+9,ym);ctx.lineTo(x+19,ym-11);ctx.stroke()}}
      emissiveMap=new THREE.CanvasTexture(e)}
    const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;map.anisotropy=4;
    const out={map,emissiveMap};armorTextures.set(key,out);return out;
  }
  function armorMaterial(THREE,a){
    const t=armorTexture(THREE,a.style),metal=a.kind==='metal';
    const m=new THREE.MeshStandardMaterial({map:t.map,metalness:metal?.82:.04,roughness:metal?.3:a.kind==='cloth'?.88:.72,side:THREE.DoubleSide});
    if(metal){m.envMap=envMap(THREE);m.envMapIntensity=1.2}
    if(t.emissiveMap){m.emissiveMap=t.emissiveMap;m.emissive=new THREE.Color(...a.style.rune);m.emissiveIntensity=1.8}
    return m;
  }

  // Coque rigide ajustée à un segment : rayon max de la tenue autour de l'axe de l'os, par tranche et par angle.
  const SHELLS={
    chest:{bone:'spine_03',from:['spine_02','spine_03'],axis:'neck_01',range:[0,.97],rings:10,margin:.016},
    cuirass:{bone:'spine_03',from:['spine_02','spine_03','clavicle_l','clavicle_r'],axis:'neck_01',range:[0,.93],rings:12,margin:.014},
    belt:{bone:'pelvis',from:['pelvis','spine_01'],axis:'spine_01',range:[.45,.75],rings:2,margin:.02},
    vambrace_l:{bone:'lowerarm_l',axis:'hand_l',range:[.3,.95],rings:5,margin:.012},vambrace_r:{bone:'lowerarm_r',axis:'hand_r',range:[.3,.95],rings:5,margin:.012},
    rerebrace_l:{bone:'upperarm_l',axis:'lowerarm_l',range:[.35,.85],rings:4,margin:.012},rerebrace_r:{bone:'upperarm_r',axis:'lowerarm_r',range:[.35,.85],rings:4,margin:.012},
    cuisse_l:{bone:'thigh_l',axis:'calf_l',range:[.25,.72],rings:5,margin:.014},cuisse_r:{bone:'thigh_r',axis:'calf_r',range:[.25,.72],rings:5,margin:.014},
    greave_l:{bone:'calf_l',axis:'foot_l',range:[.08,.7],rings:5,margin:.014},greave_r:{bone:'calf_r',axis:'foot_r',range:[.08,.7],rings:5,margin:.014}
  };
  function fitShell(THREE,bones,fitMeshes,cfg,material,name){
    const bone=bones[cfg.bone],axisBone=bones[cfg.axis];if(!bone||!axisBone)return null;
    const set=new Set((cfg.from||[cfg.bone]).map(n=>bones[n]).filter(Boolean));
    const bp=new THREE.Vector3(),bq=new THREE.Quaternion(),bs=new THREE.Vector3();bone.matrixWorld.decompose(bp,bq,bs);
    const toLocal=new THREE.Matrix4().compose(bp,bq,new THREE.Vector3(1,1,1)).invert();
    const dir=axisBone.getWorldPosition(new THREE.Vector3()).applyMatrix4(toLocal).normalize();
    const fwd=new THREE.Vector3(0,0,1).transformDirection(toLocal),u1=fwd.addScaledVector(dir,-fwd.dot(dir)).normalize(),u2=new THREE.Vector3().crossVectors(dir,u1);
    const pts=[],v=new THREE.Vector3();
    for(const [mi,m] of fitMeshes.entries()){
      const geo=m.geometry,pos=geo.attributes.position,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,bl=m.skeleton.bones;
      const mat=new THREE.Matrix4().multiplyMatrices(toLocal,m.matrixWorld),used=geo.index?new Set(geo.index.array):null;
      for(let i=0;i<pos.count;i++){
        if(used&&!used.has(i))continue;
        let best=0,bw=-1;for(let k=0;k<4;k++){const w=comp(sw,i,k);if(w>bw){bw=w;best=comp(si,i,k)}}
        if(!set.has(bl[best]))continue;
        v.fromBufferAttribute(pos,i).applyMatrix4(mat);const x=v.dot(u1),y=v.dot(u2);pts.push([v.dot(dir),Math.atan2(y,x),Math.hypot(x,y),mi,i]);
      }
    }
    if(pts.length<30)return null;
    const ts=pts.map(p=>p[0]).sort((a,b)=>a-b),lo=ts[Math.floor(ts.length*.02)],hi=ts[Math.floor(ts.length*.98)];
    const t0=lo+(hi-lo)*cfg.range[0],t1=lo+(hi-lo)*cfg.range[1],RINGS=cfg.rings,SEG=28,band=Math.max((t1-t0)/RINGS*.75,.015);
    // La tenue recouverte par la plaque est retirée : sinon elle la traverse dès que le corps se plie.
    const hidden=fitMeshes.map(()=>new Set());for(const p of pts)if(p[0]>t0+.01&&p[0]<t1-.01)hidden[p[3]].add(p[4]);
    fitMeshes.forEach((m,mi)=>{const h=hidden[mi],ix=m.geometry.index;if(!h.size||!ix)return;const out=[];
      for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);if(!(h.has(a)&&h.has(b)&&h.has(c)))out.push(a,b,c)}m.geometry.setIndex(out)});
    let prev=null;const pos=[],uv=[],idx=[];
    for(let j=0;j<=RINGS;j++){
      const tt=t0+(t1-t0)*j/RINGS,r=new Array(SEG).fill(0);
      for(const p of pts)if(Math.abs(p[0]-tt)<band){const k=Math.floor((p[1]+Math.PI)/(Math.PI*2)*SEG)%SEG;r[k]=Math.max(r[k],p[2])}
      if(!r.some(Boolean)&&prev)r.splice(0,SEG,...prev);
      for(let pass=0;pass<SEG;pass++)for(let k=0;k<SEG;k++)if(!r[k])r[k]=Math.max(r[(k+SEG-1)%SEG],r[(k+1)%SEG]);
      for(let pass=0;pass<2;pass++){const c=r.slice();for(let k=0;k<SEG;k++)r[k]=Math.max(c[k],(c[(k+SEG-1)%SEG]+2*c[k]+c[(k+1)%SEG])/4)}
      prev=r;
      const lip=(j===0||j===RINGS)?.006:0;                       // bords roulés
      for(let k=0;k<=SEG;k++){
        const a=(k%SEG+.5)/SEG*Math.PI*2-Math.PI,rr=r[k%SEG]+cfg.margin+lip;
        pos.push(...new THREE.Vector3().addScaledVector(dir,tt).addScaledVector(u1,Math.cos(a)*rr).addScaledVector(u2,Math.sin(a)*rr).toArray());
        uv.push(k/SEG,j/RINGS);
      }
    }
    for(let j=0;j<RINGS;j++)for(let k=0;k<SEG;k++){const a=j*(SEG+1)+k,b=a+SEG+1;idx.push(a,a+1,b,b,a+1,b+1)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,material);mesh.name=name;mesh.position.copy(bp);mesh.quaternion.copy(bq);bone.attach(mesh);
    return mesh;
  }

  // Feuille découpée (alpha) pour l'armure du druide.
  let leafTex=null;
  function leafTexture(THREE){
    if(leafTex)return leafTex;
    const c=document.createElement('canvas');c.width=64;c.height=128;const g=c.getContext('2d');
    g.fillStyle='#fff';g.beginPath();g.moveTo(32,4);g.bezierCurveTo(62,40,58,96,32,124);g.bezierCurveTo(6,96,2,40,32,4);g.fill();
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=2;g.beginPath();g.moveTo(32,8);g.lineTo(32,122);g.stroke();
    g.lineWidth=1;for(let y=30;y<110;y+=14){g.beginPath();g.moveTo(32,y);g.lineTo(14,y-10);g.moveTo(32,y);g.lineTo(50,y-10);g.stroke()}
    leafTex=new THREE.CanvasTexture(c);return leafTex;
  }

  // Épaulières à lames superposées, fixées aux clavicules (elles restent sur l'épaule quand le bras bouge).
  function buildPauldrons(THREE,bones,p,height,mat,trimMat){
    const s=height/1.8,sp=bones.spine_03.getWorldPosition(new THREE.Vector3());
    for(const side of ['l','r']){
      const S=bones['upperarm_'+side].getWorldPosition(new THREE.Vector3()),out=Math.sign(S.x-sp.x)||1,rnd=rng(side==='l'?11:23);
      const g=new THREE.Group();g.name='Pauldron';
      const cover=p.cover||1.2,base=(p.size||.13)*s;
      for(let i=0;i<(p.layers||3);i++){
        const r=base*(1-i*.13),cap=new THREE.Mesh(new THREE.SphereGeometry(r,30,12,0,Math.PI*2,0,cover),mat);
        cap.scale.set(1.05,.62,1.12);cap.position.set(out*i*.03*s,-i*.042*s,0);cap.rotation.z=-out*(.2+i*.22);g.add(cap);
        if(trimMat){const rim=new THREE.Mesh(new THREE.TorusGeometry(r*Math.sin(cover),.007*s,6,40),trimMat);rim.rotation.x=Math.PI/2;rim.position.y=r*Math.cos(cover);cap.add(rim)}
        if(i===0&&p.spikes)for(let k=0;k<p.spikes;k++){
          const sp=new THREE.Mesh(new THREE.ConeGeometry(.018*s,(.11-k*.02)*s,8),p.spikeColor?new THREE.MeshStandardMaterial({color:p.spikeColor,roughness:.5}):trimMat||mat);
          const a=(k-(p.spikes-1)/2)*.45;sp.position.set(Math.sin(a)*r*.35,r*.62,Math.cos(a)*r*.35*0+(k-(p.spikes-1)/2)*.045*s);sp.rotation.z=-out*.35;cap.add(sp);
        }
      }
      if(p.leaves){
        const leafMat=c=>new THREE.MeshStandardMaterial({map:leafTexture(THREE),color:new THREE.Color(...c),alphaTest:.5,side:THREE.DoubleSide,roughness:.7});
        const greens=[[.30,.55,.16],[.42,.62,.18],[.22,.42,.12],[.55,.62,.20]].map(leafMat);
        for(let k=0;k<34;k++){
          const th=rnd()*cover*.95,ph=rnd()*Math.PI*2,r=base*1.02,n=new THREE.Vector3(Math.sin(th)*Math.cos(ph)*1.05,Math.cos(th)*.62,Math.sin(th)*Math.sin(ph)*1.12);
          const leaf=new THREE.Mesh(new THREE.PlaneGeometry(.05*s,.1*s).translate(0,.045*s,0),greens[k%4]);
          leaf.position.copy(n).multiplyScalar(r);
          leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n.clone().normalize().add(new THREE.Vector3(0,-.6,0)).normalize());
          leaf.rotateY(rnd()*Math.PI);g.add(leaf);
        }
        const grassMat=new THREE.MeshStandardMaterial({color:0x7da23a,roughness:.8});
        for(let k=0;k<26;k++){
          const th=rnd()*.7,ph=rnd()*Math.PI*2,h=(.05+rnd()*.06)*s,bl=new THREE.Mesh(new THREE.ConeGeometry(.004*s,h,4).translate(0,h/2,0),grassMat);
          bl.position.set(Math.sin(th)*Math.cos(ph)*base,Math.cos(th)*base*.62,Math.sin(th)*Math.sin(ph)*base);
          bl.rotation.set((rnd()-.5)*.8,0,(rnd()-.5)*.8);g.add(bl);
        }
      }
      g.position.set(S.x+out*.012*s,S.y+.035*s,S.z);g.rotation.z=-out*.12;
      bones['clavicle_'+side].attach(g);
    }
  }

  // Masque de tissu sur le bas du visage (voleur) : copie skinnée du bas du visage, légèrement gonflée.
  function faceMask(THREE,body,L,color){
    const geo=body.geometry.clone(),pos=geo.attributes.position,nor=geo.attributes.normal,idx=geo.index,v=new THREE.Vector3();
    const inZone=i=>{v.fromBufferAttribute(pos,i);return v.y<L.eye.y-.028&&v.y>L.chin-.06&&v.z>L.eye.z-.085+Math.max(0,L.eye.y-.06-v.y)*.4};
    const out=[];for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);if(inZone(a)+inZone(b)+inZone(c)>=2)out.push(a,b,c)}
    // le tissu tombe du nez : il ne suit pas les lèvres ni le menton
    let nose=null;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(Math.abs(v.x-L.cx)<.01&&v.y<L.eye.y&&v.y>L.eye.y-.07&&(!nose||v.z>nose.z))nose=v.clone()}
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).addScaledVector(new THREE.Vector3().fromBufferAttribute(nor,i),.006);
      v.y=Math.min(v.y,L.eye.y-.03);                        // bord supérieur net, sous les yeux
      if(nose&&v.y<nose.y)v.z=Math.max(v.z,nose.z+.004-9*(v.x-L.cx)**2/.05*.05-.3*(nose.y-v.y));
      pos.setXYZ(i,v.x,v.y,v.z)}
    geo.computeVertexNormals();
    geo.setIndex(out);
    const mask=new THREE.SkinnedMesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(...color),roughness:.9,skinning:true}));
    mask.name='Mask';mask.frustumCulled=false;body.parent.add(mask);mask.bind(body.skeleton,body.bindMatrix);return mask;
  }

  // Repères du visage mesurés sur la tête (pose de bind).
  function headLandmarks(THREE,root,body){
    const pos=body.geometry.attributes.position,idx=body.geometry.index,pts=[],seen=new Set();
    for(let i=0;i<idx.count;i++){const k=idx.getX(i);if(!seen.has(k)){seen.add(k);pts.push(new THREE.Vector3().fromBufferAttribute(pos,k))}}
    let eyes=null;root.traverse(o=>{if(o.isMesh&&o.name==='Eyes')eyes=o});
    const eye=new THREE.Vector3(),eyeL=new THREE.Vector3(),eyeR=new THREE.Vector3();let nl=0,nr=0;
    if(eyes){const ep=eyes.geometry.attributes.position;for(let i=0;i<ep.count;i++){const p=new THREE.Vector3().fromBufferAttribute(ep,i);if(p.x>0){eyeL.add(p);nl++}else{eyeR.add(p);nr++}}
      eyeL.multiplyScalar(1/Math.max(1,nl));eyeR.multiplyScalar(1/Math.max(1,nr));eye.addVectors(eyeL,eyeR).multiplyScalar(.5)}
    const cx=eye.x,top=Math.max(...pts.map(p=>p.y));
    const front=pts.filter(p=>Math.abs(p.x-cx)<.015&&p.y<eye.y-.03&&p.y>eye.y-.12);
    const chin=Math.min(...front.map(p=>p.y)),mouthZ=Math.max(...front.filter(p=>p.y<eye.y-.07).map(p=>p.z));
    return {pts,eye,eyeL,eyeR,cx,top,chin,mouthZ,mouthY:chin+(eye.y-chin)*.33,eyes};
  }

  // Mort-vivant : la tête devient un crâne (orbites creuses, nez effacé, joues creusées, dents à nu), couleur os.
  function skullFace(THREE,body,L){
    const geo=body.geometry,pos=geo.attributes.position,v=new THREE.Vector3(),orig=[];
    const isFront=p=>p.z>L.eye.z-.05;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);orig.push(v.clone());if(!isFront(v))continue;
      for(const e of [L.eyeL,L.eyeR]){const d=Math.hypot(v.x-e.x,v.y-e.y);if(d<.026)v.z-=Math.pow(1-d/.026,1.4)*.016}
      if(Math.abs(v.x-L.cx)<.018&&v.y<L.eye.y-.005&&v.y>L.eye.y-.06&&v.z>L.eye.z-.004)v.z-=(v.z-(L.eye.z-.004))*.85;
      const ax=Math.abs(v.x-L.cx);
      if(ax>.022&&ax<.058&&v.y<L.eye.y-.03&&v.y>L.mouthY-.012){const w=Math.min(1,(ax-.022)/.012)*Math.min(1,(.058-ax)/.012);v.x-=Math.sign(v.x-L.cx)*.007*w;v.z-=.006*w}
      pos.setXYZ(i,v.x,v.y,v.z);
    }
    pos.needsUpdate=true;geo.computeVertexNormals();
    // Peinture "3D" de la texture : chaque pixel du visage connaît sa position sur la tête.
    const m=body.material,img=m.map&&m.map.image;if(!img)return;
    const W=img.width||1024,H=img.height||1024,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.drawImage(img,0,0,W,H);
    const id=g.getImageData(0,0,W,H),d=id.data,src=d.slice(),uv=geo.attributes.uv,idx=geo.index;
    const bone=[.88,.84,.72],dark=[.06,.04,.04],teeth=[.95,.92,.82];
    const shade=(p,lum)=>{
      let col=bone.map(x=>x*(.5+.62*lum));
      const mix=(t,k)=>{k=clamp(k,0,1);col=col.map((x,i)=>x+(t[i]-x)*k)};
      if(isFront(p)){
        for(const e of [L.eyeL,L.eyeR]){const r=Math.hypot(p.x-e.x,p.y-e.y);mix(dark,(.024-r)/.008)}
        const ny=L.eye.y-.058,nh=.034;if(p.y>ny&&p.y<ny+nh&&Math.abs(p.x-L.cx)<(p.y-ny)*.33+.002)mix(dark,.95);
        const ax=Math.abs(p.x-L.cx),my=p.y-L.mouthY;
        if(ax<.03&&Math.abs(my)<.011){col=teeth.map(x=>x*(.75+.3*lum));const f=((p.x-L.cx)/.0062%1+1)%1;if(f<.2||Math.abs(my)<.0016)mix(dark,.9);if(Math.abs(my)>.008)mix(dark,.5)}
        if(ax>.024&&ax<.056&&p.y<L.eye.y-.03&&p.y>L.mouthY-.012)col=col.map(x=>x*.72);
      }
      if(p.y<L.chin-.01)col=col.map(x=>x*.62);                     // cou plus sombre
      return col;
    };
    const P=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],q=new THREE.Vector3();
    for(let t=0;t<idx.count;t+=3){
      const vi=[idx.getX(t),idx.getX(t+1),idx.getX(t+2)],px=vi.map(i=>[uv.getX(i)*W,uv.getY(i)*H]);
      vi.forEach((i,k)=>P[k].copy(orig[i]));
      const x0=Math.floor(Math.min(...px.map(p=>p[0])))-1,x1=Math.ceil(Math.max(...px.map(p=>p[0])))+1,y0=Math.floor(Math.min(...px.map(p=>p[1])))-1,y1=Math.ceil(Math.max(...px.map(p=>p[1])))+1;
      const [[ax,ay],[bx,by],[cx2,cy]]=px,den=(by-cy)*(ax-cx2)+(cx2-bx)*(ay-cy);if(Math.abs(den)<1e-9)continue;
      for(let y=Math.max(0,y0);y<=Math.min(H-1,y1);y++)for(let x=Math.max(0,x0);x<=Math.min(W-1,x1);x++){
        const X=x+.5,Y=y+.5,w0=((by-cy)*(X-cx2)+(cx2-bx)*(Y-cy))/den,w1=((cy-ay)*(X-cx2)+(ax-cx2)*(Y-cy))/den,w2=1-w0-w1;
        if(w0<-.08||w1<-.08||w2<-.08)continue;
        q.set(0,0,0).addScaledVector(P[0],w0).addScaledVector(P[1],w1).addScaledVector(P[2],w2);
        const o=(y*W+x)*4,lum=(src[o]+src[o+1]+src[o+2])/765/.62,col=shade(q,clamp(lum,0,1.3));
        d[o]=clamp(col[0]*255,0,255);d[o+1]=clamp(col[1]*255,0,255);d[o+2]=clamp(col[2]*255,0,255);
      }
    }
    g.putImageData(id,0,0);
    const t=new THREE.CanvasTexture(c);t.flipY=m.map.flipY;t.encoding=m.map.encoding;m.map=t;m.color.setRGB(1,1,1);
    if(L.eyes)L.eyes.visible=false;                                  // seules les lueurs restent au fond des orbites
  }

  // Casque ouvert ajusté à la tête : calotte, protège-joues, couvre-nuque et nasal.
  function buildHelmet(THREE,bones,L,h,mat,trim){
    const above=L.pts.filter(p=>p.y>L.eye.y-.02),cz=(Math.min(...above.map(p=>p.z))+Math.max(...above.map(p=>p.z)))/2,cx=L.cx;
    const y0=L.eye.y-.085,y1=L.top+.018,RINGS=14,SEG=32,M=h.margin||.016,brow=L.eye.y+.012;
    const rings=[];
    for(let j=0;j<=RINGS;j++){
      const t=j/RINGS,y=y0+(y1-y0)*(1-Math.pow(1-t,1.6)),r=new Array(SEG).fill(0);
      for(const p of L.pts)if(Math.abs(p.y-y)<.014){const a=Math.atan2(p.x-cx,p.z-cz),k=Math.floor((a+Math.PI)/(Math.PI*2)*SEG)%SEG;r[k]=Math.max(r[k],Math.hypot(p.x-cx,p.z-cz))}
      for(let pass=0;pass<SEG;pass++)for(let k=0;k<SEG;k++)if(!r[k])r[k]=Math.max(r[(k+SEG-1)%SEG],r[(k+1)%SEG]);
      for(let pass=0;pass<3;pass++){const c=r.slice();for(let k=0;k<SEG;k++)r[k]=(c[(k+SEG-1)%SEG]+2*c[k]+c[(k+1)%SEG])/4}
      if(j>0)for(let k=0;k<SEG;k++)r[k]=Math.min(r[k]+M,rings[j-1].r[k]+.02);else for(let k=0;k<SEG;k++)r[k]+=M;
      if(j===RINGS)r.fill(0);                                     // sommet fermé
      rings.push({y,r});
    }
    const pos=[],uv=[],idx=[];
    for(let j=0;j<=RINGS;j++)for(let k=0;k<=SEG;k++){
      const a=(k%SEG+.5)/SEG*Math.PI*2-Math.PI,rr=rings[j].r[k%SEG];
      pos.push(cx+Math.sin(a)*rr,rings[j].y,cz+Math.cos(a)*rr);uv.push(k/SEG,j/RINGS);
    }
    for(let j=0;j<RINGS;j++)for(let k=0;k<SEG;k++){
      const a=(k+.5)/SEG*Math.PI*2-Math.PI,y=rings[j].y;
      // ouverture du visage : sous le front, l'avant reste dégagé ; les joues sont couvertes sur les côtés
      if(y<brow&&Math.abs(a)<(y<L.eye.y-.035?1.05:.85))continue;
      const i0=j*(SEG+1)+k,i1=i0+SEG+1;idx.push(i0,i1,i0+1,i1,i1+1,i0+1);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx);geo.computeVertexNormals();
    const g=new THREE.Group();g.name='Helmet';g.add(new THREE.Mesh(geo,mat));
    const frontR=rings[Math.round(RINGS*.3)].r[SEG/2|0];
    const nasal=new THREE.Mesh(new THREE.BoxGeometry(.014,.06,.01),trim||mat);nasal.position.set(cx,L.eye.y-.012,cz+frontR-.004);g.add(nasal);
    bones.Head.attach(g);return g;
  }

  // Barbe de nain : la barbe du pack est allongée et élargie, puis deux tresses cerclées d'or.
  function dwarfBeard(THREE,root,bones,L,color){
    let beard=null;root.traverse(o=>{if(o.isMesh&&/Beard/i.test(o.name))beard=o});if(!beard)return;
    const geo=beard.geometry=beard.geometry.clone(),pos=geo.attributes.position,v=new THREE.Vector3();
    beard.updateMatrixWorld(true);const toW=beard.matrixWorld,toL=toW.clone().invert(),anchor=L.mouthY+.01;
    let bottom=Infinity;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(toW);const dy=anchor-v.y;
      if(dy>0){v.y=anchor-dy*2.4;v.x=L.cx+(v.x-L.cx)*(1+Math.min(dy,.08)*5);v.z+=dy*.7}
      bottom=Math.min(bottom,v.y);v.applyMatrix4(toL);pos.setXYZ(i,v.x,v.y,v.z);
    }
    pos.needsUpdate=true;geo.computeVertexNormals();
    const hair=new THREE.MeshStandardMaterial({color,roughness:.85}),gold=new THREE.MeshStandardMaterial({color:0xd4a64a,metalness:.85,roughness:.3});
    for(const side of [-1,1]){
      const b=new THREE.Group();b.name='Braid';
      for(let k=0;k<7;k++){const s=new THREE.Mesh(new THREE.SphereGeometry(.02-k*.0013,10,8),hair);s.scale.set(1,1.4,.9);s.position.set((k%2?.004:-.004),-k*.026,0);s.rotation.z=k%2?.4:-.4;b.add(s)}
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.018,12),gold);ring.position.y=-7*.026+.03;b.add(ring);
      b.position.set(L.cx+side*.028,bottom+.02,L.mouthZ+.03);bones.Head.attach(b);
    }
  }

  function buildArmor(THREE,root,body,bones,a,height,fit,L){
    const mat=armorMaterial(THREE,a.mat),trim=a.trim?new THREE.MeshStandardMaterial({color:new THREE.Color(...a.trim),metalness:.85,roughness:.3,envMap:envMap(THREE),envMapIntensity:1.2}):null;
    for(const n of a.shells||[])for(const k of [n,n+'_l',n+'_r'])if(SHELLS[k])fitShell(THREE,bones,fit,SHELLS[k],a.shellMat&&a.shellMat[n]?armorMaterial(THREE,a.shellMat[n]):mat,'Armor_'+k);
    if(a.pauldron)buildPauldrons(THREE,bones,a.pauldron,height,a.pauldron.mat?armorMaterial(THREE,a.pauldron.mat):mat,trim);
    if(a.mask)faceMask(THREE,body,L,a.mask);
    if(a.helmet)buildHelmet(THREE,bones,L,a.helmet,armorMaterial(THREE,a.helmet.mat||a.mat),trim);
  }

  // Les modèles sont emballés en .js (tools/build_characters.js) : window.CHAR_ASSETS[nom]=GLB en base64.
  // Un <script> se charge en double-clic (file://), contrairement à un fetch de .glb.
  const assetName=f=>f.replace(/\.(gltf|glb)$/i,'');
  const scriptLoads=new Map();
  function loadAssetScript(name,baseUrl){
    const store=globalThis.CHAR_ASSETS||{};
    if(store[name])return Promise.resolve(store[name]);
    if(!scriptLoads.has(name))scriptLoads.set(name,new Promise((res,rej)=>{
      const sc=document.createElement('script');sc.src=baseUrl+'assets/characters/'+name+'.js';sc.async=true;
      sc.onload=()=>globalThis.CHAR_ASSETS?.[name]?res(globalThis.CHAR_ASSETS[name]):rej(new Error('Asset vide : '+name));
      sc.onerror=()=>{scriptLoads.delete(name);rej(new Error('Asset introuvable : '+name))};
      document.head.appendChild(sc);
    }));
    return scriptLoads.get(name);
  }
  function b64ToBuffer(b64){const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer}
  const parsed=new Map();
  // Les GLB parsés sont mis en cache ; chaque personnage reçoit une copie indépendante (SkeletonUtils-like).
  async function loadAsset(THREE,loader,name,baseUrl){
    if(!parsed.has(name))parsed.set(name,loadAssetScript(name,baseUrl).then(b64=>new Promise((res,rej)=>loader.parse(b64ToBuffer(b64),'',res,rej))));
    return parsed.get(name);
  }

  // Clone profond d'une scène skinnée (équivalent de SkeletonUtils.clone, absent du build global r128).
  function cloneSkinned(source){
    const map=new Map(),clone=source.clone(true);
    const walk=(a,b)=>{map.set(a,b);for(let i=0;i<a.children.length;i++)walk(a.children[i],b.children[i])};walk(source,clone);
    clone.traverse(o=>{if(!o.isSkinnedMesh)return;
      const src=[...map].find(([k,v])=>v===o)[0];
      o.geometry=src.geometry.clone();
      o.bind(new o.skeleton.constructor(src.skeleton.bones.map(b=>map.get(b)),src.skeleton.boneInverses),src.bindMatrix)});
    return clone;
  }

  // Construit un personnage. Résout { root, height, clips }.
  async function build(THREE,kitId,{baseUrl='',loader=new THREE.GLTFLoader(),withAnims=true}={}){
    const kit=resolveKit(kitId);
    const load=f=>loadAsset(THREE,loader,assetName(f),baseUrl).then(g=>({scene:cloneSkinned(g.scene),animations:g.animations}));
    const [bodyG,outfitG,...rest]=await Promise.all([
      load(kit.body),load(kit.outfit),
      ...kit.hair.map(load),
      ...(withAnims?[load('anims')]:[])
    ]);
    const nh=kit.hair.length,hairGs=rest.slice(0,nh),animG=withAnims?rest[nh]:null;
    const root=bodyG.scene,bones={};
    root.traverse(o=>{if(o.isBone)bones[o.name]=o});
    let body=null;
    root.traverse(o=>{if(o.isSkinnedMesh){if(/^Super/i.test(o.name)){keepOnlyBones(o,['Head','neck_01']);body=o}}});
    const hairColor=new THREE.Color(...kit.hairColor);
    root.traverse(o=>{if(o.isMesh&&o.name==='Eyebrows'){o.material=o.material.clone();o.material.color=hairColor}});
    const shared=[body.skeleton],attach=g=>{const ms=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)ms.push(o)});ms.forEach(m=>bindToSkeleton(THREE,m,bones,body.parent,shared))};
    if(kit.robe)outfitG.scene.traverse(o=>{if(o.isSkinnedMesh&&/_Legs$/.test(o.name))keepOnlyBones(o,['calf_l','calf_r','foot_l','foot_r','ball_l','ball_r'])});
    attach(outfitG);hairGs.forEach(attach);
    const recolored=new Map(),skinTint=new THREE.Color(...kit.skin);let skinColor=null;
    root.traverse(o=>{
      if(!o.isMesh||!o.material)return;
      const m=o.material=o.material.clone();
      if(/Hair/i.test(m.name))m.color=hairColor;
      else if(/Superhero|Regular_(Fe)?male/i.test(m.name)){m.color=skinTint.clone();if(/Superhero/i.test(m.name))skinColor=averageColor(THREE,m.map).multiply(skinTint)}
      else if(/Peasant|Ranger/i.test(m.name)&&m.map){
        if(!recolored.has(m.map))recolored.set(m.map,recolorTexture(THREE,m.map,kit.palette,1024,kit.sex==='M'&&/Peasant/i.test(m.name)));
        m.map=recolored.get(m.map);
      }
      o.frustumCulled=false;
    });
    root.updateMatrixWorld(true);
    let height=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
    // Robe, armes et détails sont construits en pose de bind, ajustés sur la tenue réelle.
    const fit=[];root.traverse(o=>{if(o.isSkinnedMesh&&/_(Body|Legs)$/.test(o.name))fit.push(o)});   // pièces déjà déplacées sur le squelette du corps
    if(kit.robe)buildRobe(THREE,body,bones,kit.robe,fit);
    if(kit.staff)buildStaff(THREE,body,bones,kit.staff,height,fit);
    if(kit.weapon)buildWeapon(THREE,body,bones,kit.weapon,height,fit);
    headFeatures(THREE,kit,root,body,bones,skinColor||new THREE.Color(.6,.45,.35));
    if(kit.eyeGlow){const inv=new THREE.Matrix4().copy(body.matrixWorld).invert(),col=new THREE.Color(...kit.eyeGlow);root.traverse(o=>{if(o.isMesh&&o.name==='Eyes')glowEyes(THREE,o,col,bones.Head,inv)})}
    const L=headLandmarks(THREE,root,body);
    if(kit.bigBeard)dwarfBeard(THREE,root,bones,L,hairColor);
    if(kit.skull){skullFace(THREE,body,L);root.traverse(o=>{if(o.name==='Eyebrows')o.visible=false})}
    const outfitMeshes=[];root.traverse(o=>{if(o.isSkinnedMesh&&/Ranger|Peasant/.test(o.name))outfitMeshes.push(o)});
    if(kit.armor)buildArmor(THREE,root,body,bones,kit.armor,height,outfitMeshes,L);
    // Morphologie raciale : échelles uniformes d'os (les animations ne pilotent que les rotations).
    const wy=b=>{root.updateMatrixWorld(true);return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).y};
    const head0=wy(bones.Head),foot0=wy(bones.foot_l);
    for(const [n,k] of Object.entries(kit.bones))if(bones[n])bones[n].scale.multiplyScalar(k);
    // Jambes raccourcies : on abaisse tout le squelette pour garder les pieds au sol.
    const drop=wy(bones.foot_l)-foot0;
    if(Math.abs(drop)>1e-4){const rig=new THREE.Group();rig.name='Rig';[...root.children].forEach(c=>rig.add(c));root.add(rig);rig.position.y=-drop}
    height+=wy(bones.Head)-head0;
    // Pièces rigides (épaulières, casque, armes, feuilles…) : fusionnées par matériau dans chaque groupe, moins d'appels de dessin.
    const merge=globalThis.ArenaEnv&&globalThis.ArenaEnv.mergeMeshes;
    if(merge){root.updateMatrixWorld(true);const groups=[];root.traverse(o=>{if(o.isGroup&&/^(Pauldron|Helmet|Shield|Sword|Runeblade|Dagger|Staff|Antler|Braid)$/.test(o.name))groups.push(o)});
      for(const g of groups){const meshes=[];g.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&!o.material.transparent)meshes.push(o)});
        for(const m of merge(THREE,meshes,new THREE.Matrix4().copy(g.matrixWorld).invert())){m.frustumCulled=false;g.add(m)}}}
    return {root,height,clips:animG?animG.animations:[]};
  }

  const kitFor=(race,cls)=>KITS[race+'_'+cls]?race+'_'+cls:null;

  return {KITS,CLASSES,RACES,ANIMS,build,kitFor,resolveKit,buildManifest,assetName,keepOnlyBones,recolorTexture};
});
