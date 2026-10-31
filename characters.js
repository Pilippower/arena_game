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

  const KITS={
    // Sorcière de bataille humaine : robe violet profond / or, manches crème, capuche, cheveux blonds longs.
    human_arcanist:{
      body:'Superhero_Female_FullBody.gltf',
      outfit:'Female_Peasant.gltf',
      parts:['Female_Ranger_Head_Hood.gltf'],
      hair:['Hair_Long.gltf'],
      hairColor:[.92,.72,.38],
      skinBoost:[1.32,1.18,1.06],
      palette:{dark:[.13,.05,.20],mid:[.36,.14,.55],trim:[.86,.66,.26],cloth:[.93,.89,.80]},
      robe:{color:[.30,.11,.47],trim:[.86,.66,.26],length:.86,flare:1.7},
      staff:{crystal:[.78,.55,1.0]},
      eyeGlow:[.55,.30,1.0]                      // lueur arcane, même teinte que le cristal
    }
  };

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function rgbToHsl(r,g,b){
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;
    if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);
      h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6}
    return [h,s,l];
  }

  // Recolore une texture de tenue : les tons cuir/bruns deviennent la palette de classe,
  // les tissus clairs désaturés et le métal sont conservés. Réduit aussi la texture à `size`.
  function recolorTexture(THREE,tex,pal,size=1024){
    const img=tex.image,c=document.createElement('canvas');c.width=c.height=size;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0,size,size);
    const id=ctx.getImageData(0,0,size,size),d=id.data;
    for(let i=0;i<d.length;i+=4){
      const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255,[h,s,l]=rgbToHsl(r,g,b);
      let t=null;
      if(s<.32&&l>.5)t=pal.cloth;                       // tissu clair
      else if(s>=.18&&(h<.16||h>.92)){                    // bruns / cuir / tan
        t=l>.48?pal.trim:l>.2?pal.mid:pal.dark;
      }
      else if(s>=.18&&h>.18&&h<.48)t=pal.mid;                // verts (tenue Rôdeur) : teinte unie, le relief vient de k
      if(!t)continue;
      const k=l/.5;                                       // garde le relief peint (lumière/ombre)
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

  function bindToSkeleton(THREE,mesh,bones,host){
    const sk=new THREE.Skeleton(mesh.skeleton.bones.map(b=>bones[b.name]||b),mesh.skeleton.boneInverses);
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
      const ring=prof.map((r,k)=>Math.max(r+.012,prev?prev[k]:0));prev=ring;
      for(let i=0;i<=SEG;i++){
        const a=(i+.5)/SEG*Math.PI*2,rr=ring[i%SEG]+flare,x=Math.sin(a)*rr,z=Math.cos(a)*rr;
        pos.push(pelvis.x+x,y,pelvis.z+z);uv.push(i/SEG,t);
        const leg=Math.pow(t,.75)*.9,wl=clamp(.5+lSign*Math.sin(a)*.65,0,1);
        const calf=t>.7?(t-.7)/.3*.25:0;
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

  // Bâton porté dans le dos, en diagonale (cristal au-dessus de l'épaule droite), attaché au haut de la colonne.
  function buildStaff(THREE,body,bones,cfg,height,fitMeshes){
    const spine=bones.spine_03;if(!spine)return null;
    const s=height/1.8,g=new THREE.Group();g.name='Staff';
    const wood=new THREE.MeshStandardMaterial({color:0x3b2416,roughness:.7,metalness:.05});
    const gold=new THREE.MeshStandardMaterial({color:0xc9a04a,roughness:.32,metalness:.85});
    const cc=new THREE.Color(...cfg.crystal);
    const crystalMat=new THREE.MeshStandardMaterial({color:cc,emissive:cc,emissiveIntensity:2.8,roughness:.15,metalness:.1,transparent:true,opacity:.95});
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.018*s,.024*s,1.55*s,10),wood);g.add(shaft);
    for(const y of [-.70,-.2,.55,.68]){const r=new THREE.Mesh(new THREE.CylinderGeometry(.03*s,.03*s,.035*s,12),gold);r.position.y=y*s;g.add(r)}
    // Tête du bâton : deux crochets dorés qui enserrent le cristal
    for(const side of [-1,1]){const hook=new THREE.Mesh(new THREE.TorusGeometry(.085*s,.012*s,8,20,Math.PI*1.1),gold);hook.position.set(side*.02*s,.84*s,0);hook.rotation.set(0,side>0?0:Math.PI,-.5);g.add(hook)}
    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.07*s,0),crystalMat);crystal.scale.set(.8,1.5,.8);crystal.position.y=.86*s;g.add(crystal);
    const glow=new THREE.PointLight(cc,1.4,1.8*s);glow.position.y=.86*s;g.add(glow);
    // Halo magique pulsant autour du cristal
    const hc=cc.clone().multiplyScalar(.85);hc.g*=.55;               // halo plus saturé que le cristal
    const halo=glowSprite(THREE,hc,.42*s),core=glowSprite(THREE,cc,.13*s);halo.position.y=core.position.y=.86*s;halo.name='CrystalGlow';g.add(halo,core);
    halo.onBeforeRender=()=>{const t=performance.now()/1000,p=1+Math.sin(t*3.1)*.12+Math.sin(t*7.3)*.05;halo.scale.set(.42*s*p,.42*s*p,1);glow.intensity=1.4*p};
    // Surface du dos mesurée sur la tenue (le personnage regarde +z, le dos est vers -z).
    body.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(body.matrixWorld).invert(),sp=new THREE.Vector3().setFromMatrixPosition(spine.matrixWorld).applyMatrix4(inv);
    let back=sp.z;const v=new THREE.Vector3();
    for(const m of fitMeshes){const pos=m.geometry.attributes.position,mat=new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld);
      for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(mat);if(Math.abs(v.y-sp.y)<.08&&Math.abs(v.x-sp.x)<.08)back=Math.min(back,v.z)}}
    const tl=new THREE.Vector3().setFromMatrixPosition(bones.thigh_l.matrixWorld).applyMatrix4(inv),tr=new THREE.Vector3().setFromMatrixPosition(bones.thigh_r.matrixWorld).applyMatrix4(inv);
    const toRight=Math.sign(tr.x-tl.x)||-1;           // côté droit du personnage en x
    g.position.set(sp.x,sp.y-.12*s,back-.04*s);
    g.rotation.z=-toRight*.55;                         // le haut part vers l'épaule droite
    g.position.applyMatrix4(body.matrixWorld);g.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(body.matrixWorld));
    spine.attach(g);
    return g;
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
    const kit=KITS[kitId];if(!kit)throw new Error('Kit inconnu : '+kitId);
    const load=f=>loadAsset(THREE,loader,assetName(f),baseUrl).then(g=>({scene:cloneSkinned(g.scene),animations:g.animations}));
    const parts=kit.parts||[];
    const [bodyG,outfitG,...rest]=await Promise.all([
      load(kit.body),load(kit.outfit),
      ...kit.hair.map(load),
      ...parts.map(load),
      ...(withAnims?[load('anims')]:[])
    ]);
    const nh=kit.hair.length,hairGs=rest.slice(0,nh),partGs=rest.slice(nh,nh+parts.length),animG=withAnims?rest[nh+parts.length]:null;
    const root=bodyG.scene,bones={};
    root.traverse(o=>{if(o.isBone)bones[o.name]=o});
    let body=null;
    root.traverse(o=>{if(o.isSkinnedMesh){if(/^Super/i.test(o.name)){keepOnlyBones(o,['Head','neck_01']);body=o}}});
    const hairColor=new THREE.Color(...kit.hairColor);
    root.traverse(o=>{if(o.isMesh&&o.name==='Eyebrows'){o.material=o.material.clone();o.material.color=hairColor}});
    const attach=g=>{const ms=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)ms.push(o)});ms.forEach(m=>bindToSkeleton(THREE,m,bones,body.parent))};
    if(kit.robe)outfitG.scene.traverse(o=>{if(o.isSkinnedMesh&&/_Legs$/.test(o.name))keepOnlyBones(o,['calf_l','calf_r','foot_l','foot_r','ball_l','ball_r'])});
    attach(outfitG);hairGs.forEach(attach);partGs.forEach(attach);
    const recolored=new Map();
    root.traverse(o=>{
      if(!o.isMesh||!o.material)return;
      const m=o.material=o.material.clone();
      if(/Hair/i.test(m.name))m.color=hairColor;
      else if(/Regular_(Fe)?male/i.test(m.name))m.color=new THREE.Color(...kit.skinBoost);
      else if(/Peasant|Ranger/i.test(m.name)&&m.map){
        if(!recolored.has(m.map))recolored.set(m.map,recolorTexture(THREE,m.map,kit.palette));
        m.map=recolored.get(m.map);
      }
      o.frustumCulled=false;
    });
    root.updateMatrixWorld(true);
    const height=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
    // Robe et bâton sont construits en pose de bind, ajustés sur la tenue réelle.
    const fit=[];root.traverse(o=>{if(o.isSkinnedMesh&&/_(Body|Legs)$/.test(o.name))fit.push(o)});   // pièces déjà déplacées sur le squelette du corps
    if(kit.robe)buildRobe(THREE,body,bones,kit.robe,fit);
    if(kit.staff)buildStaff(THREE,body,bones,kit.staff,height,fit);
    if(kit.eyeGlow){const inv=new THREE.Matrix4().copy(body.matrixWorld).invert(),col=new THREE.Color(...kit.eyeGlow);root.traverse(o=>{if(o.isMesh&&o.name==='Eyes')glowEyes(THREE,o,col,bones.Head,inv)})}
    return {root,height,clips:animG?animG.animations:[]};
  }

  const kitFor=(race,cls)=>KITS[race+'_'+cls]?race+'_'+cls:null;

  return {KITS,ANIMS,build,kitFor,assetName,keepOnlyBones,recolorTexture};
});
