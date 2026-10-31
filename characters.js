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
    sentinel:{ // Guerrier : cuir renforcé acier/bronze, tabard rouge, épée et bouclier dans le dos
      sex:'M',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet','Ranger_Pauldron'],
      hair:{M:'Hair_Buzzed',F:'Hair_Buns'},hairColor:[.32,.20,.11],
      palette:{dark:[.10,.10,.12],mid:[.36,.37,.40],trim:[.74,.56,.28],cloth:[.58,.13,.10]},
      weapon:'swordShield'},
    arcanist:{ // Sorcière de bataille : robe violet profond / or, capuche, bâton à cristal arcane
      sex:'F',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet','Ranger_Head_Hood'],
      hair:{F:'Hair_Long',M:'Hair_SimpleParted'},hairColor:[.92,.72,.38],
      palette:{dark:[.13,.05,.20],mid:[.36,.14,.55],trim:[.86,.66,.26],cloth:[.93,.89,.80]},
      robe:{color:[.30,.11,.47],trim:[.86,.66,.26],length:.86,flare:1.7},
      staff:{crystal:[.78,.55,1.0]},eyeGlow:[.55,.30,1.0]},
    oracle:{ // Prêtresse : robe blanche et or, bâton solaire
      sex:'F',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet'],
      hair:{F:'Hair_Buns',M:'Hair_SimpleParted'},hairColor:[.45,.27,.14],
      palette:{dark:[.40,.30,.16],mid:[.86,.82,.72],trim:[.90,.72,.30],cloth:[.97,.95,.90]},
      robe:{color:[.90,.88,.82],trim:[.88,.68,.25],length:.9,flare:1.6},
      staff:{crystal:[1.0,.82,.40],wood:0xe8dcc0,metal:0xd9b55a}},
    reaver:{ // Chevalier runique : acier noirci, givre bleu, grande lame runique
      sex:'M',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet','Ranger_Pauldron'],
      hair:{M:'Hair_Long',F:'Hair_Long'},hairColor:[.78,.80,.82],
      palette:{dark:[.05,.06,.08],mid:[.20,.24,.30],trim:[.55,.74,.88],cloth:[.26,.30,.36]},
      weapon:'runeblade',eyeGlow:[.40,.80,1.0]},
    warden:{ // Druide : cuir et lin naturels, bois de cerf, bâton noueux à cristal vert
      sex:'M',outfit:['Ranger_Body','Ranger_Arms','Peasant_Legs','Ranger_Feet'],
      hair:{M:'Hair_Long',F:'Hair_Long'},hairColor:[.36,.22,.10],
      palette:{dark:[.16,.10,.05],mid:[.40,.27,.13],trim:[.52,.60,.24],cloth:[.66,.58,.40]},
      staff:{crystal:[.45,1.0,.35],wood:0x4a3018,metal:0x8a7a40},antlers:true},
    shade:{ // Voleuse : cuir noir, liserés rouge sombre, capuche, deux dagues aux hanches
      sex:'F',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet','Ranger_Head_Hood'],
      hair:{F:'Hair_Long',M:'Hair_Buzzed'},hairColor:[.10,.07,.06],
      palette:{dark:[.04,.04,.05],mid:[.14,.14,.17],trim:[.50,.12,.10],cloth:[.24,.24,.27]},
      weapon:'daggers'},
    warlock:{ // Occultiste : robe noire et verte, capuche, bâton à flamme verte
      sex:'M',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet','Ranger_Head_Hood'],
      hair:{M:'Hair_SimpleParted',F:'Hair_Long'},hairColor:[.12,.10,.10],
      palette:{dark:[.06,.04,.07],mid:[.22,.10,.24],trim:[.40,.80,.22],cloth:[.30,.26,.24]},
      robe:{color:[.12,.07,.13],trim:[.38,.78,.20],length:.9,flare:1.5},
      staff:{crystal:[.40,1.0,.25],wood:0x1c1418,metal:0x50604a},eyeGlow:[.40,1.0,.25]}
  };
  // RACE : morphologie (échelle des os, rotations seulement dans les animations), peau, cheveux, détails.
  const RACES={
    human:{},
    orc:{sex:'M',skin:[.58,.98,.42],hairColor:[.07,.05,.04],hair:'Hair_Long',tusks:true,ears:{len:.055,up:.25},
      bones:{spine_02:1.1,spine_03:1.1,neck_01:.86}},
    dwarf:{sex:'M',skin:[1.08,.92,.84],hairColor:[.55,.24,.09],beard:true,hair:'Hair_Buzzed',
      bones:{spine_01:1.15,neck_01:.92,thigh_l:.8,thigh_r:.8}},
    elf:{skin:[1.06,1.0,.98],hairColor:[.93,.90,.80],ears:{len:.13,up:.6},eyeGlow:[.35,.85,1.0],
      bones:{spine_03:.96}},
    undead:{skin:[.42,.60,.70],hairColor:[.17,.17,.16],eyeGlow:[1.0,.80,.30],bones:{spine_03:.95,neck_01:.97}}
  };
  const SEXNAME={F:'Female',M:'Male'};
  const PARTFILE={Ranger_Feet:{F:'Female_Ranger_Feet',M:'Male_Ranger_Feet_Boots'},Ranger_Pauldron:{F:'Female_Ranger_Acc_Pauldrons',M:'Male_Ranger_Acc_Pauldron'}};
  const partFile=(key,sex)=>(PARTFILE[key]?.[sex]||SEXNAME[sex]+'_'+key)+'.gltf';
  const sexFor=(race,cls)=>RACES[race].sex||CLASSES[cls].sex;
  // Kit complet d'une race+classe.
  function resolveKit(kitId){
    const [race,cls]=kitId.split('_'),R=RACES[race],C=CLASSES[cls];
    if(!R||!C)throw new Error('Kit inconnu : '+kitId);
    const sex=sexFor(race,cls),hair=[R.hair&&sex==='M'?R.hair:C.hair[sex]];if(R.beard)hair.push('Hair_Beard.gltf');
    return {...C,race,cls,sex,body:'Superhero_'+SEXNAME[sex]+'_FullBody.gltf',outfit:'outfit_'+cls+'_'+sex,
      hair:hair.map(h=>/\.gltf$/.test(h)?h:h+'.gltf'),hairColor:R.hairColor||C.hairColor,skin:R.skin||[1,1,1],
      eyeGlow:R.eyeGlow||C.eyeGlow,ears:R.ears,tusks:R.tusks,bones:R.bones||{}};
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
  function bindToSkeleton(THREE,mesh,bones,host){
    const sk=new THREE.Skeleton(mesh.skeleton.bones.map(b=>bones[b.name]||bones[b.name.replace(/_\d+$/,'')]||b),mesh.skeleton.boneInverses);
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
    const attach=g=>{const ms=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)ms.push(o)});ms.forEach(m=>bindToSkeleton(THREE,m,bones,body.parent))};
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
    // Morphologie raciale : échelles uniformes d'os (les animations ne pilotent que les rotations).
    const wy=b=>{root.updateMatrixWorld(true);return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).y};
    const head0=wy(bones.Head),foot0=wy(bones.foot_l);
    for(const [n,k] of Object.entries(kit.bones))if(bones[n])bones[n].scale.multiplyScalar(k);
    // Jambes raccourcies : on abaisse tout le squelette pour garder les pieds au sol.
    const drop=wy(bones.foot_l)-foot0;
    if(Math.abs(drop)>1e-4){const rig=new THREE.Group();rig.name='Rig';[...root.children].forEach(c=>rig.add(c));root.add(rig);rig.position.y=-drop}
    height+=wy(bones.Head)-head0;
    return {root,height,clips:animG?animG.animations:[]};
  }

  const kitFor=(race,cls)=>KITS[race+'_'+cls]?race+'_'+cls:null;

  return {KITS,CLASSES,RACES,ANIMS,build,kitFor,resolveKit,buildManifest,assetName,keepOnlyBones,recolorTexture};
});
