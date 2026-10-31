(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CharacterKit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Assemblage des personnages à partir des packs CC0 Quaternius (même squelette 65 os pour tout) :
  // tête du corps de base + tenue + coiffure + pièces procédurales (robe, bâton), recoloration par classe/race.
  // La CLASSE choisit la tenue/silhouette, la RACE ne fait que la morphologie/peau/détails.

  const SRC={
    base:'assets_src/Universal Base Characters[Standard]/Universal Base Characters[Standard]/Base Characters/Godot - UE/',
    hair:'assets_src/Universal Base Characters[Standard]/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/',
    outfit:'assets_src/Modular Character Outfits - Fantasy[Standard]/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/',
    anims:'assets_src/Universal Animation Library[Standard]/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
  };

  const KITS={
    // Sorcière de bataille humaine : robe violet profond / or, manches crème, cheveux cuivrés en chignons.
    human_arcanist:{
      body:'Superhero_Female_FullBody.gltf',
      outfit:'Female_Peasant.gltf',
      hair:['Hair_Buns.gltf'],
      hairColor:[.42,.13,.05],
      skinBoost:[1.32,1.18,1.06],
      palette:{dark:[.13,.05,.20],mid:[.36,.14,.55],trim:[.86,.66,.26],cloth:[.93,.89,.80]},
      robe:{color:[.30,.11,.47],trim:[.86,.66,.26],length:.86,flare:1.7},
      staff:{crystal:[.78,.55,1.0]}
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
  function buildRobe(THREE,body,bones,cfg){
    body.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(body.matrixWorld).invert();
    const P=n=>new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(inv);
    const pelvis=P('pelvis'),tl=P('thigh_l'),tr=P('thigh_r'),cl=P('calf_l'),fl=P('foot_l');
    const sk=body.skeleton.bones,bi=n=>sk.findIndex(b=>b.name===n);
    const iP=bi('pelvis'),iL=bi('thigh_l'),iR=bi('thigh_r'),iCL=bi('calf_l'),iCR=bi('calf_r');
    const hipHalf=Math.abs(tl.x-tr.x)/2,top=pelvis.y+.15,bottom=fl.y+(cl.y-fl.y)*(1-cfg.length)+.03;
    const lSign=Math.sign(tl.x-tr.x)||1,SEG=40,RINGS=16;
    const pos=[],uv=[],si=[],sw=[],idx=[];
    for(let j=0;j<=RINGS;j++){
      const t=j/RINGS,y=top+(bottom-top)*t;
      const fl=Math.pow(t,1.4),rx=hipHalf*(1.7+(cfg.flare-1)*1.5*fl)+.015,rz=hipHalf*(1.5+(cfg.flare-1)*1.4*fl)+.012;
      for(let i=0;i<=SEG;i++){
        const a=i/SEG*Math.PI*2,x=Math.sin(a)*rx,z=Math.cos(a)*rz;
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

  // Bâton tenu dans la main droite (attaché à l'os, vertical en pose de repos).
  function buildStaff(THREE,bones,cfg,height){
    const hand=bones.hand_r;if(!hand)return null;
    const s=height/1.8,g=new THREE.Group();g.name='Staff';
    const wood=new THREE.MeshStandardMaterial({color:0x3b2416,roughness:.7,metalness:.05});
    const gold=new THREE.MeshStandardMaterial({color:0xc9a04a,roughness:.32,metalness:.85});
    const cc=new THREE.Color(...cfg.crystal);
    const crystalMat=new THREE.MeshStandardMaterial({color:cc,emissive:cc,emissiveIntensity:1.6,roughness:.15,metalness:.1,transparent:true,opacity:.92});
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.018*s,.024*s,1.55*s,10),wood);g.add(shaft);
    for(const y of [-.70,-.2,.55,.68]){const r=new THREE.Mesh(new THREE.CylinderGeometry(.03*s,.03*s,.035*s,12),gold);r.position.y=y*s;g.add(r)}
    // Tête du bâton : deux crochets dorés qui enserrent le cristal
    for(const side of [-1,1]){const hook=new THREE.Mesh(new THREE.TorusGeometry(.085*s,.012*s,8,20,Math.PI*1.1),gold);hook.position.set(side*.02*s,.84*s,0);hook.rotation.set(0,side>0?0:Math.PI,-.5);g.add(hook)}
    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.07*s,0),crystalMat);crystal.scale.set(.8,1.5,.8);crystal.position.y=.86*s;g.add(crystal);
    const glow=new THREE.PointLight(cc,.9,1.4*s);glow.position.y=.86*s;g.add(glow);
    hand.updateMatrixWorld(true);
    const hp=new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
    g.position.set(hp.x,hp.y+.18*s,hp.z+.02*s);
    hand.attach(g);
    return g;
  }

  function makeLoader(THREE){
    // Le pack référence parfois "X_png.png" alors que le fichier s'appelle "X.png".
    const manager=new THREE.LoadingManager();manager.setURLModifier(u=>u.replace(/_png\.png$/,'.png'));
    return new THREE.GLTFLoader(manager);
  }

  // Construit un personnage. Résout { root, height, clips }.
  async function build(THREE,kitId,{baseUrl='',loader=makeLoader(THREE),withAnims=true}={}){
    const kit=KITS[kitId];if(!kit)throw new Error('Kit inconnu : '+kitId);
    const load=u=>new Promise((res,rej)=>loader.load(baseUrl+u,res,undefined,rej));
    const [bodyG,outfitG,...rest]=await Promise.all([
      load(SRC.base+kit.body),load(SRC.outfit+kit.outfit),
      ...kit.hair.map(h=>load(SRC.hair+h)),
      ...(withAnims?[load(SRC.anims)]:[])
    ]);
    const hairGs=rest.slice(0,kit.hair.length),animG=withAnims?rest[kit.hair.length]:null;
    const root=bodyG.scene,bones={};
    root.traverse(o=>{if(o.isBone)bones[o.name]=o});
    let body=null;
    root.traverse(o=>{if(o.isSkinnedMesh){if(/^Super/i.test(o.name)){keepOnlyBones(o,['Head','neck_01']);body=o}}});
    const hairColor=new THREE.Color(...kit.hairColor);
    root.traverse(o=>{if(o.isMesh&&o.name==='Eyebrows'){o.material=o.material.clone();o.material.color=hairColor}});
    const attach=g=>{const ms=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)ms.push(o)});ms.forEach(m=>bindToSkeleton(THREE,m,bones,body.parent))};
    if(kit.robe)outfitG.scene.traverse(o=>{if(o.isSkinnedMesh&&/_Legs$/.test(o.name))keepOnlyBones(o,['calf_l','calf_r','foot_l','foot_r','ball_l','ball_r'])});
    attach(outfitG);hairGs.forEach(attach);
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
    if(kit.robe)buildRobe(THREE,body,bones,kit.robe);       // en pose de bind
    if(kit.staff){
      // Le bâton est placé dans la pose Idle (la main y est tournée différemment de la pose de bind).
      const idle=animG?.animations.find(c=>c.name==='Idle_Loop');
      if(idle){const mx=new THREE.AnimationMixer(root);mx.clipAction(idle).play();mx.update(0);root.updateMatrixWorld(true)}
      buildStaff(THREE,bones,kit.staff,height);
    }
    return {root,height,clips:animG?animG.animations:[]};
  }

  return {KITS,SRC,build,makeLoader,keepOnlyBones,recolorTexture};
});
