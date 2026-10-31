(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.ArenaEnv=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Décor 3D de l'arène (three.js), dessiné dans un canevas SOUS le jeu : sol pierre/herbe, herbe animée,
  // piliers, remparts, bannières, braseros, forêt, montagnes, château au loin, ciel de crépuscule.
  // Tout est procédural (textures en canvas) : rien à télécharger, fonctionne en double-clic (file://).
  // Les dimensions de jeu (piliers, murs) viennent de `arena` : le décor suit la collision existante.

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
  const rng=seed=>()=>(seed=(seed*16807)%2147483647)/2147483647;

  // Bruit de valeur périodique (textures qui se répètent sans couture).
  function makeNoise(seed){
    const N=256,g=new Float32Array(N*N),r=rng(seed);for(let i=0;i<g.length;i++)g[i]=r();
    const at=(i,j,p)=>g[((i%p+p)%p)%N+(((j%p+p)%p)%N)*N];
    const n=(x,y,p)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
      const a=at(xi,yi,p),b=at(xi+1,yi,p),c=at(xi,yi+1,p),d=at(xi+1,yi+1,p);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
    return (x,y,p=256,oct=4)=>{let s=0,amp=.5,f=1,tot=0;for(let o=0;o<oct;o++){s+=n(x*f,y*f,p*f)*amp;tot+=amp;amp*=.5;f*=2}return s/tot};
  }
  const noise=makeNoise(1337),noise2=makeNoise(4242);

  function canvas(w,h=w){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
  function tex(THREE,c,repeat=true,srgb=true){const t=new THREE.CanvasTexture(c);if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping}if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t}

  // Appareil de pierres (dallage ou maçonnerie) : pierres irrégulières, joints sombres, biseaux, grain, mousse.
  function stoneCanvas({size=1024,rows=6,minW=.12,maxW=.26,base=[.50,.48,.44],vary=.10,grout=[.12,.11,.10],moss=0,seed=3,warp=6}){
    const c=canvas(size),g=c.getContext('2d'),id=g.createImageData(size,size),d=id.data,r=rng(seed);
    const rowH=size/rows,stones=[];
    for(let j=0;j<rows;j++){let x=-r()*size*maxW;const row=[];while(x<size){const w=size*(minW+r()*(maxW-minW));row.push({x0:x,x1:x+w,t:r(),m:r()});x+=w}stones.push(row)}
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const wx=x+(noise(x/size*8,y/size*8,8,2)-.5)*warp*2,wy=y+(noise2(x/size*8,y/size*8,8,2)-.5)*warp*2;
      const j=((Math.floor(wy/rowH)%rows)+rows)%rows,yy=((wy%rowH)+rowH)%rowH,row=stones[j];
      let xx=((wx%size)+size)%size,s=row.find(q=>xx>=q.x0&&xx<q.x1);if(!s){s=row.find(q=>xx+size>=q.x0&&xx+size<q.x1)||row[0];xx+=size}
      const dx=Math.min(xx-s.x0,s.x1-xx),dy=Math.min(yy,rowH-yy),e=Math.min(dx,dy);
      const grain=noise(x/size*24,y/size*24,24,4),big=noise2(x/size*4,y/size*4,4,3);
      const k=(1-vary)+vary*2*s.t;let col=base.map((v,i)=>v*k*(.72+.5*grain)*(.85+.3*big));
      if(e<10){const bev=e<3?0:(e-3)/7;const light=(yy<rowH/2&&dy===e)||(xx-s.x0===e)?1.18:.78;col=col.map(v=>v*(bev+(1-bev)*light))}
      if(moss&&s.m<moss){const mm=smooth(.55,.75,noise(x/size*10,y/size*10,10,3))*(1-smooth(4,30,e));col=col.map((v,i)=>v+([.20,.30,.12][i]-v)*mm*.8)}
      if(e<3){const gk=.7+.6*grain;col=grout.map(v=>v*gk)}
      const o=(y*size+x)*4;d[o]=clamp(col[0]*255,0,255);d[o+1]=clamp(col[1]*255,0,255);d[o+2]=clamp(col[2]*255,0,255);d[o+3]=255;
    }
    g.putImageData(id,0,0);
    g.strokeStyle='rgba(20,18,16,.55)';g.lineWidth=1.2;                 // fissures
    for(let i=0;i<rows*3;i++){let x=r()*size,y=r()*size;g.beginPath();g.moveTo(x,y);for(let k=0;k<6;k++){x+=(r()-.5)*40;y+=(r()-.3)*30;g.lineTo(x,y)}g.stroke()}
    return c;
  }
  function grassCanvas(size=512){
    const c=canvas(size),g=c.getContext('2d'),id=g.createImageData(size,size),d=id.data;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const n=noise(x/size*6,y/size*6,6,5),m=noise2(x/size*3,y/size*3,3,3),f=noise(x/size*64,y/size*64,64,1);
      let col=[.17+.10*n,.32+.16*n,.09+.05*n];
      col=col.map((v,i)=>v*(.8+.4*m));if(m<.35)col=col.map((v,i)=>v+([.30,.26,.15][i]-v)*smooth(.35,.2,m)*.6);   // terre
      col=col.map(v=>v*(.85+.3*f));
      const o=(y*size+x)*4;d[o]=col[0]*255;d[o+1]=col[1]*255;d[o+2]=col[2]*255;d[o+3]=255;
    }
    g.putImageData(id,0,0);const r=rng(9);
    for(let i=0;i<5000;i++){const x=r()*size,y=r()*size,l=2+r()*5;g.strokeStyle=`rgba(${120+r()*80|0},${170+r()*60|0},${60+r()*40|0},.35)`;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*3,y-l);g.stroke()}
    return c;
  }

  // Cercle runique au centre de l'arène (or + arcane), avec carte émissive.
  function runeCircle(THREE){
    const S=1024,c=canvas(S),e=canvas(S),g=c.getContext('2d'),ge=e.getContext('2d'),C=S/2;
    ge.fillStyle='#000';ge.fillRect(0,0,S,S);
    const ring=(ctx,r,w,col)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.arc(C,C,r,0,Math.PI*2);ctx.stroke()};
    for(const [ctx,glow] of [[g,false],[ge,true]]){
      const gold=glow?'#4a3410':'#c99a3e',blue=glow?'#3aa8ff':'#5fb8ff';
      ring(ctx,500,10,gold);ring(ctx,470,4,gold);ring(ctx,300,8,blue);ring(ctx,285,3,blue);ring(ctx,95,8,gold);
      ctx.strokeStyle=blue;ctx.lineWidth=5;ctx.beginPath();                      // étoile à 8 branches
      for(let k=0;k<=16;k++){const a=k/16*Math.PI*2,r=k%2?140:290;ctx.lineTo(C+Math.sin(a)*r,C+Math.cos(a)*r)}ctx.stroke();
      ctx.fillStyle=gold;ctx.font='bold 34px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      const glyphs='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
      for(let k=0;k<36;k++){const a=k/36*Math.PI*2;ctx.save();ctx.translate(C+Math.sin(a)*485,C+Math.cos(a)*485);ctx.rotate(-a+Math.PI);ctx.fillText(glyphs[k%glyphs.length],0,0);ctx.restore()}
      for(let k=0;k<8;k++){const a=k/8*Math.PI*2;ctx.fillStyle=blue;ctx.beginPath();ctx.arc(C+Math.sin(a)*385,C+Math.cos(a)*385,14,0,Math.PI*2);ctx.fill()}
    }
    const mat=new THREE.MeshStandardMaterial({map:tex(THREE,c,false),emissiveMap:tex(THREE,e,false),emissive:new THREE.Color(1,1,1),emissiveIntensity:1.4,
      transparent:true,depthWrite:false,roughness:.4,metalness:.3,polygonOffset:true,polygonOffsetFactor:-2});
    // le fond du canvas est transparent : seuls les tracés apparaissent
    return mat;
  }

  function glowTexture(THREE){
    const c=canvas(64),g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.3,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
  }
  function flameTexture(THREE){
    const c=canvas(64,128),g=c.getContext('2d'),gr=g.createRadialGradient(32,92,2,32,80,60);
    gr.addColorStop(0,'rgba(255,250,220,1)');gr.addColorStop(.25,'rgba(255,190,70,.9)');gr.addColorStop(.6,'rgba(230,80,20,.45)');gr.addColorStop(1,'rgba(120,20,0,0)');
    g.fillStyle=gr;g.beginPath();g.moveTo(32,4);g.bezierCurveTo(60,60,58,120,32,124);g.bezierCurveTo(6,120,4,60,32,4);g.fill();
    return new THREE.CanvasTexture(c);
  }

  // Quantité d'herbe (0 = dallage, 1 = herbe) : partagé entre la texture de mélange et le placement des brins.
  function grassAmount(arena,x,z){
    const e=Math.max(Math.abs(x)/arena.halfX,Math.abs(z)/arena.halfZ),n=noise(x*.07+50,z*.07+50,256,4);
    let m=smooth(.56,.84,e+(n-.5)*.4);
    for(const p of arena.pillars){const d=Math.hypot(x-p.x,z-p.z)-p.r;m=Math.max(m,smooth(2.2,.3,d)*smooth(.4,.6,n))}   // herbe au pied des piliers
    return m;
  }

  // Fusionne des maillages statiques qui partagent un matériau (transformations appliquées) : des centaines
  // d'appels de dessin deviennent quelques-uns, ce qui soulage beaucoup le processeur sur mobile.
  function mergeMeshes(THREE,meshes,toLocal){
    const groups=new Map();
    for(const m of meshes){const k=m.material.uuid+'|'+m.castShadow+'|'+m.receiveShadow;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)}
    const out=[];
    for(const list of groups.values()){
      if(list.length<2){out.push(null);continue}
      const pos=[],nor=[],uv=[],idx=[];let base=0;
      for(const m of list){
        const g=m.geometry,mat=new THREE.Matrix4().multiplyMatrices(toLocal,m.matrixWorld),nm=new THREE.Matrix3().getNormalMatrix(mat);
        const P=g.attributes.position,N=g.attributes.normal,U=g.attributes.uv,v=new THREE.Vector3();
        for(let i=0;i<P.count;i++){v.fromBufferAttribute(P,i).applyMatrix4(mat);pos.push(v.x,v.y,v.z);
          if(N){v.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();nor.push(v.x,v.y,v.z)}else nor.push(0,1,0);
          if(U)uv.push(U.getX(i),U.getY(i));else uv.push(0,0)}
        if(g.index)for(let i=0;i<g.index.count;i++)idx.push(base+g.index.getX(i));else for(let i=0;i<P.count;i++)idx.push(base+i);
        base+=P.count;
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeBoundingSphere();
      const mm=new THREE.Mesh(geo,list[0].material);mm.castShadow=list[0].castShadow;mm.receiveShadow=list[0].receiveShadow;
      for(const m of list){m.parent.remove(m);m.geometry.dispose()}
      out.push(mm);
    }
    return out.filter(Boolean);
  }
  function mergeStatic(THREE,S){
    S.updateMatrixWorld(true);const list=[];
    S.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!o.isSkinnedMesh&&!o.userData.dynamic&&!o.material.isShaderMaterial&&!o.material.transparent&&!o.material.onBeforeCompile.toString().includes('time'))list.push(o)});
    for(const m of mergeMeshes(THREE,list,new THREE.Matrix4()))S.add(m);
  }

  const E={ok:false,THREE:null};

  function init(THREE,canvasEl,arena,{mobile=false}={}){
    E.THREE=THREE;E.arena=arena;E.mobile=mobile;
    const R=E.renderer=new THREE.WebGLRenderer({canvas:canvasEl,antialias:!mobile,powerPreference:'high-performance'});
    R.setPixelRatio(Math.min(mobile?1:1.5,devicePixelRatio||1));
    R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;
    R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
    const S=E.scene=new THREE.Scene();
    E.camera=new THREE.PerspectiveCamera(60,1,.1,1600);
    E.time={value:0};
    const horizon=new THREE.Color(0xe7a77a);
    S.fog=new THREE.Fog(0x8f8fae,70,620);

    // Ciel : dégradé crépuscule, soleil bas, étoiles naissantes
    const sunDir=new THREE.Vector3(-.55,.16,-.82).normalize();
    const sky=new THREE.Mesh(new THREE.SphereGeometry(1400,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{sun:{value:sunDir}},
      vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 vDir;uniform vec3 sun;
        float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
        void main(){float y=vDir.y;
          vec3 zen=vec3(.10,.14,.34),mid=vec3(.42,.42,.66),hor=vec3(.98,.66,.46),low=vec3(.30,.26,.34);
          vec3 c=y>0.?mix(mid,zen,smoothstep(.0,.55,y)):low;c=mix(c,hor,(1.-smoothstep(0.,.22,abs(y)))*.85);
          float s=max(dot(vDir,sun),0.);c+=vec3(1.,.72,.42)*pow(s,8.)*.55+vec3(1.,.9,.7)*pow(s,400.)*3.;
          vec3 q=floor(vDir*420.);float st=step(.9975,h(q))*smoothstep(.25,.7,y);c+=vec3(st)*.8;
          gl_FragColor=vec4(c,1.);}`}));
    sky.renderOrder=-100;S.add(sky);E.sky=sky;

    // Lumières : soleil couchant chaud (ombres), ciel bleuté, contre-jour froid
    S.add(new THREE.HemisphereLight(0xb8c4ff,0x3a3324,.75));
    const sun=new THREE.DirectionalLight(0xffd2a0,2.3);sun.position.copy(sunDir).multiplyScalar(-1).setY(.8).normalize().multiplyScalar(60);
    sun.position.set(28,34,30);sun.castShadow=true;const sm=mobile?1024:2048;sun.shadow.mapSize.set(sm,sm);
    Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:140});sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
    S.add(sun,sun.target);
    const fill=new THREE.DirectionalLight(0x8ea8ff,.55);fill.position.set(-20,14,-30);S.add(fill);

    buildGround(THREE,S,arena);
    buildGrass(THREE,S,arena);
    buildPillars(THREE,S,arena);
    buildWalls(THREE,S,arena);
    buildOutside(THREE,S,arena);
    buildCastle(THREE,S,arena);
    buildShadows(THREE,S);
    mergeStatic(THREE,S);
    // décor immobile : la carte d'ombres est calculée une fois, pas à chaque image
    R.shadowMap.autoUpdate=false;R.shadowMap.needsUpdate=true;
    E.ok=true;return true;
  }

  // ---- Sol : dallage + herbe mélangés par un masque, cercle runique au centre ----
  function buildGround(THREE,S,arena){
    const hx=arena.halfX,hz=arena.halfZ;
    const stone=tex(THREE,stoneCanvas({rows:5,minW:.14,maxW:.3,base:[.50,.46,.40],vary:.16,moss:.45,warp:5}));
    const grass=tex(THREE,grassCanvas());
    const M=256,mc=canvas(M),mg=mc.getContext('2d'),mid=mg.createImageData(M,M);
    for(let j=0;j<M;j++)for(let i=0;i<M;i++){const x=(i+.5)/M*2*hx-hx,z=(j+.5)/M*2*hz-hz,v=grassAmount(arena,x,z)*255,o=(j*M+i)*4;mid.data[o]=mid.data[o+1]=mid.data[o+2]=v;mid.data[o+3]=255}
    mg.putImageData(mid,0,0);const mask=tex(THREE,mc,false,false);
    const mat=new THREE.MeshStandardMaterial({map:stone,roughness:.88,metalness:0});
    mat.onBeforeCompile=sh=>{
      sh.uniforms.grassMap={value:grass};sh.uniforms.maskMap={value:mask};sh.uniforms.uHalf={value:new THREE.Vector2(hx,hz)};
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vWXZ;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWXZ=(modelMatrix*vec4(transformed,1.)).xz;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vWXZ;uniform sampler2D grassMap,maskMap;uniform vec2 uHalf;')
        .replace('#include <map_fragment>',`
          vec4 st=mapTexelToLinear(texture2D(map,vWXZ/5.5));
          vec4 gr=mapTexelToLinear(texture2D(grassMap,vWXZ/4.5));
          vec2 muv=(vWXZ+uHalf)/(2.*uHalf);float m=texture2D(maskMap,clamp(muv,0.,1.)).r;
          if(muv.x<0.||muv.x>1.||muv.y<0.||muv.y>1.)m=1.;
          diffuseColor*=mix(st,gr,smoothstep(.15,.85,m));`);
    };
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(hx*2+6,hz*2+6),mat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;S.add(ground);
    const rc=new THREE.Mesh(new THREE.PlaneGeometry(26,26),runeCircle(THREE));rc.rotation.x=-Math.PI/2;rc.position.y=.02;rc.receiveShadow=true;S.add(rc);E.rune=rc;
  }

  // ---- Herbe : brins instanciés qui ondulent au vent, fleurs ----
  function buildGrass(THREE,S,arena){
    const hx=arena.halfX,hz=arena.halfZ,r=rng(77);
    const blade=new THREE.BufferGeometry(),w=.06,hgt=1;
    blade.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,0,0, w/2,0,0, -w*.38,.45,0, w*.38,.45,0, 0,hgt,0],3));
    blade.setAttribute('color',new THREE.Float32BufferAttribute([.10,.20,.05, .10,.20,.05, .26,.46,.12, .26,.46,.12, .55,.72,.26],3));
    blade.setIndex([0,1,2,2,1,3,2,3,4]);blade.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.9});
    mat.onBeforeCompile=sh=>{sh.uniforms.time=E.time;
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float time;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          vec4 ip=instanceMatrix*vec4(0.,0.,0.,1.);float k=position.y*position.y;
          transformed.x+=(sin(time*1.7+ip.x*.35+ip.z*.22)*.10+sin(time*3.1+ip.z*.9)*.03)*k;
          transformed.z+=cos(time*1.3+ip.x*.27)*.05*k;`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(vec3(0.,1.,0.)*.6+normal*.4);');   // éclairage doux, sans face sombre
    };
    const N=E.mobile?7000:26000,inst=new THREE.InstancedMesh(blade,mat,N),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3(),col=new THREE.Color();
    let n=0,tries=0;
    while(n<N&&tries<N*12){tries++;
      const x=(r()*2-1)*hx,z=(r()*2-1)*hz,a=grassAmount(arena,x,z);if(r()>a*a)continue;
      if(arena.pillars.some(pp=>Math.hypot(x-pp.x,z-pp.z)<pp.r+.15))continue;
      const h=(.28+r()*.42)*(.5+.6*a);q.setFromAxisAngle(new THREE.Vector3(0,1,0),r()*Math.PI*2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),(r()-.5)*.5));
      m.compose(p.set(x,0,z),q,s.set(.8+r()*.6,h,1));inst.setMatrixAt(n,m);col.setHSL(.24+r()*.06,.5+r()*.2,.42+r()*.2);inst.setColorAt(n,col);n++;
    }
    inst.count=n;inst.instanceMatrix.needsUpdate=true;S.add(inst);
    // fleurs
    const fl=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.05,0),new THREE.MeshStandardMaterial({roughness:.6}),900);let f=0;
    const fcol=[0xd7b3ff,0xffe17a,0xffffff,0x9ad0ff,0xff9fb3];
    while(f<900&&tries<N*20){tries++;const x=(r()*2-1)*hx,z=(r()*2-1)*hz;if(grassAmount(arena,x,z)<.85||r()<.6)continue;
      m.compose(p.set(x,.18+r()*.2,z),q.identity(),s.setScalar(.7+r()*.6));fl.setMatrixAt(f,m);fl.setColorAt(f,col.set(fcol[f%fcol.length]));f++}
    fl.count=f;S.add(fl);
  }

  // ---- Piliers : ruines arcaniques en pierre taillée, cerclages d'or, runes et cristal flottant ----
  function buildPillars(THREE,S,arena){
    const masonry=tex(THREE,stoneCanvas({size:512,rows:8,minW:.25,maxW:.5,base:[.58,.56,.52],moss:.25,seed:11,warp:2}));
    const stoneMat=new THREE.MeshStandardMaterial({map:masonry,roughness:.85});
    const darkStone=new THREE.MeshStandardMaterial({map:masonry,color:0x9a958c,roughness:.9});
    const gold=new THREE.MeshStandardMaterial({color:0xc89b45,metalness:.85,roughness:.32});
    const rc=canvas(512,64),rg=rc.getContext('2d');rg.fillStyle='#000';rg.fillRect(0,0,512,64);rg.fillStyle='#7fd0ff';rg.font='bold 44px serif';rg.textBaseline='middle';
    const glyphs='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';for(let k=0;k<16;k++)rg.fillText(glyphs[k],k*32+4,34);
    const runeTex=tex(THREE,rc);runeTex.repeat.set(2,1);
    const runeMat=new THREE.MeshStandardMaterial({map:masonry,color:0x7a7770,emissiveMap:runeTex,emissive:new THREE.Color(.45,.8,1),emissiveIntensity:1.6,roughness:.85});
    const crystalMat=new THREE.MeshStandardMaterial({color:0x8fd8ff,emissive:0x3aa0ff,emissiveIntensity:1.6,roughness:.15,metalness:.1,transparent:true,opacity:.92});
    const glow=glowTexture(THREE);E.crystals=[];
    for(const p of arena.pillars){
      const g=new THREE.Group();g.position.set(p.x,0,p.z);
      const add=(geo,mat,y,cast=true)=>{const m=new THREE.Mesh(geo,mat);m.position.y=y;m.castShadow=cast;m.receiveShadow=true;g.add(m);return m};
      const r=p.r,h=p.h;
      add(new THREE.CylinderGeometry(r*1.42,r*1.5,.3,8),darkStone,.15);                     // socle à degrés
      add(new THREE.CylinderGeometry(r*1.22,r*1.3,.32,8),darkStone,.46);
      const shaft=add(new THREE.CylinderGeometry(r*.94,r*1.02,h-1.25,8,1),stoneMat,.62+(h-1.25)/2);
      shaft.geometry.attributes.uv.array.forEach((v,i,a)=>{if(i%2)a[i]=v*(h-1.25)/2.2;else a[i]=v*3});
      add(new THREE.CylinderGeometry(r*1.035,r*1.035,.42,8,1,true),runeMat,h*.42);            // bandeau runique lumineux
      for(const y of [.66,h*.42-.26,h*.42+.26,h-.66])add(new THREE.CylinderGeometry(r*1.06,r*1.06,.08,8),gold,y);
      add(new THREE.CylinderGeometry(r*1.3,r*1.0,.4,8),darkStone,h-.42);                      // chapiteau
      add(new THREE.CylinderGeometry(r*1.38,r*1.38,.22,8),stoneMat,h-.11);
      // cristal flottant au sommet
      const cr=add(new THREE.OctahedronGeometry(.42,0),crystalMat,h+1.0,false);cr.userData.dynamic=true;cr.scale.set(.75,1.6,.75);
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0x56b4ff,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.75}));sp.scale.setScalar(3.2);sp.position.y=h+1.0;g.add(sp);
      E.crystals.push({mesh:cr,sprite:sp,y:h+1.0,phase:p.x*.3+p.z*.2});
      // pierres tombées et mousse au pied
      const rr=rng(Math.abs(p.x*13+p.z*7)|0+5);
      for(let k=0;k<4;k++){const a=rr()*Math.PI*2,d=r*1.6+rr()*.8,b=add(new THREE.DodecahedronGeometry(.18+rr()*.22,0),darkStone,.12);b.position.set(Math.sin(a)*d,.1,Math.cos(a)*d);b.rotation.set(rr()*3,rr()*3,rr()*3)}
      S.add(g);
    }
  }

  // ---- Remparts : maçonnerie crénelée, contreforts, bannières d'équipe, braseros ----
  function buildWalls(THREE,S,arena){
    const hx=arena.halfX,hz=arena.halfZ,H=3.4,T=1.0;
    const masonry=tex(THREE,stoneCanvas({size:512,rows:6,minW:.18,maxW:.36,base:[.52,.50,.47],moss:.3,seed:21,warp:2}));
    const wallMat=new THREE.MeshStandardMaterial({map:masonry,roughness:.88});
    const capMat=new THREE.MeshStandardMaterial({map:masonry,color:0xb8b2a6,roughness:.85});
    const box=(w,h,d,x,y,z,mat=wallMat,uvScale=1)=>{const geo=new THREE.BoxGeometry(w,h,d),uv=geo.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.max(w,d)/3*uvScale,uv.getY(i)*h/3*uvScale);
      const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;S.add(m);return m};
    const sides=[[0,-hz-T/2,hx*2+T*2,T,false],[0,hz+T/2,hx*2+T*2,T,false],[-hx-T/2,0,T,hz*2,true],[hx+T/2,0,T,hz*2,true]];
    for(const [x,z,w,d,vert] of sides){
      box(w,H,d,x,H/2,z);box(vert?w+.3:w,.3,vert?d:d+.3,x,H+.15,z,capMat);
      const len=vert?d:w;for(let t=-len/2+.8;t<len/2;t+=1.6){const mx=vert?x:x+t,mz=vert?z+t:z;box(vert?T*.9:.8,.7,vert?.8:T*.9,mx,H+.65,mz,capMat)}   // merlons
      for(let t=-len/2+4;t<len/2-2;t+=8){const bx=vert?x-Math.sign(x)*.0:x+t,bz=vert?z+t:z;box(vert?T+1.0:1.1,H*.85,vert?1.1:T+1.0,bx,H*.425,bz)}   // contreforts
    }
    for(const sx of [-1,1])for(const sz of [-1,1]){                                         // tours d'angle
      const t=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.5,H+2.2,10),wallMat);t.position.set(sx*(hx+.6),(H+2.2)/2,sz*(hz+.6));t.castShadow=t.receiveShadow=true;S.add(t);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(2.8,3.4,10),new THREE.MeshStandardMaterial({color:0x2c4a7a,roughness:.6}));roof.position.set(sx*(hx+.6),H+2.2+1.7,sz*(hz+.6));roof.castShadow=true;S.add(roof);
    }
    // bannières d'équipe ondulantes (rouge à gauche, bleu à droite comme avant)
    const bannerMat=(col,emblem)=>{const c=canvas(128,256),g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,128,256);
      g.fillStyle='rgba(0,0,0,.25)';for(let x=0;x<128;x+=16)g.fillRect(x,0,3,256);
      g.fillStyle='#d9b25a';g.fillRect(0,0,128,14);g.beginPath();g.moveTo(0,220);g.lineTo(64,256);g.lineTo(128,220);g.lineTo(128,256);g.lineTo(0,256);g.fill();
      g.fillStyle='#e8cf8a';g.font='bold 80px serif';g.textAlign='center';g.fillText(emblem,64,140);
      const m=new THREE.MeshStandardMaterial({map:tex(THREE,c,false),side:THREE.DoubleSide,roughness:.8,alphaTest:.5});
      m.onBeforeCompile=sh=>{sh.uniforms.time=E.time;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float time;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nfloat k=(1.5-position.y)/3.;transformed.z+=(sin(time*2.2+position.y*1.6+modelMatrix[3].z)*.5+.5)*.16*k;');};
      return m};
    const red=bannerMat('#7a1418','⚔'),blue=bannerMat('#143a7a','✦');
    for(const side of [-1,1])for(const z of [-18,-9,0,9,18]){
      const b=new THREE.Mesh(new THREE.PlaneGeometry(1.3,3,4,8),side<0?red:blue);b.position.set(side*(hx-.14),2.1,z);b.rotation.y=-side*Math.PI/2;b.castShadow=true;S.add(b);
    }
    // braseros
    const flame=flameTexture(THREE),glow=glowTexture(THREE);E.flames=[];
    const bowl=new THREE.MeshStandardMaterial({color:0x2e2a26,metalness:.6,roughness:.5});
    for(const sx of [-1,1])for(const z of [-13.5,13.5]){
      const x=sx*(arena.halfX-1.6),g=new THREE.Group();g.position.set(x,0,z);
      const ped=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,1.3,8),capMat);ped.position.y=.65;ped.castShadow=true;g.add(ped);
      const b=new THREE.Mesh(new THREE.CylinderGeometry(.55,.3,.35,12),bowl);b.position.y=1.45;b.castShadow=true;g.add(b);
      for(let k=0;k<3;k++){const f=new THREE.Sprite(new THREE.SpriteMaterial({map:flame,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));f.position.set((k-1)*.12,1.95,0);g.add(f);E.flames.push({s:f,k:k+x})}
      const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0xff9a40,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.55}));gl.scale.setScalar(4);gl.position.y=1.9;g.add(gl);
      const light=new THREE.PointLight(0xff8a3c,1.2,9,2);light.position.y=2.1;g.add(light);E.flames.push({light,k:x+z});
      S.add(g);
    }
  }

  // ---- Extérieur : collines herbeuses, forêt de conifères, montagnes bleutées ----
  function buildOutside(THREE,S,arena){
    const hx=arena.halfX,hz=arena.halfZ,r=rng(99);
    const grass=tex(THREE,grassCanvas(256));grass.repeat.set(160,160);
    const terr=new THREE.PlaneGeometry(1400,1400,120,120);terr.rotateX(-Math.PI/2);
    const pos=terr.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),d=Math.max(Math.abs(x)-hx,Math.abs(z)-hz,0);
      pos.setY(i,-.05+smooth(4,60,d)*(noise2(x*.006+9,z*.006+9,256,4)*26-6)+smooth(200,600,Math.hypot(x,z))*40)}
    terr.computeVertexNormals();
    const tm=new THREE.Mesh(terr,new THREE.MeshStandardMaterial({map:grass,roughness:.95}));tm.receiveShadow=true;tm.position.y=-.03;S.add(tm);
    E.terrainY=(x,z)=>{const d=Math.max(Math.abs(x)-hx,Math.abs(z)-hz,0);return -.08+smooth(4,60,d)*(noise2(x*.006+9,z*.006+9,256,4)*26-6)+smooth(200,600,Math.hypot(x,z))*40};
    // conifères instanciés (tronc + 3 étages de feuillage)
    const N=E.mobile?220:520,trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.3,2,6),new THREE.MeshStandardMaterial({color:0x4a3220,roughness:.9}),N);
    // étages de branches irréguliers (silhouette moins géométrique)
    const tierGeo=k=>{const gg=new THREE.ConeGeometry(2.3-k*.55,3.3-k*.4,11,2),gp=gg.attributes.position,rj=rng(k+3);
      for(let i=0;i<gp.count;i++){const y=gp.getY(i);if(y<0){const f=1+(rj()-.5)*.45;gp.setX(i,gp.getX(i)*f);gp.setZ(i,gp.getZ(i)*f);gp.setY(i,y-rj()*.35)}}gg.computeVertexNormals();return gg};
    const tiers=[0,1,2,3].map(k=>new THREE.InstancedMesh(tierGeo(k),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9}),N));
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3(),col=new THREE.Color();let n=0;
    while(n<N){const a=r()*Math.PI*2,d=48+Math.pow(r(),1.4)*190,x=Math.sin(a)*d*1.2,z=Math.cos(a)*d;
      if(Math.abs(x)<hx+8&&Math.abs(z)<hz+8)continue;if(z<-hz-4&&Math.abs(x)<75)continue;            // dégagement : le château reste visible
      const sc=1.4+r()*1.8,y=E.terrainY(x,z);q.setFromAxisAngle(new THREE.Vector3(0,1,0),r()*6);
      m.compose(p.set(x,y+sc,z),q,s.setScalar(sc));trunk.setMatrixAt(n,m);
      col.setHSL(.29+r()*.07,.30+r()*.2,.10+r()*.07);
      tiers.forEach((t,k)=>{m.compose(p.set(x,y+sc*(2.4+k*1.35),z),q,s.setScalar(sc*(1-k*.06)));t.setMatrixAt(n,m);t.setColorAt(n,col)});n++}
    for(const t of [trunk,...tiers])S.add(t);
    // chaîne de montagnes au loin (brume)
    const mMat=new THREE.MeshStandardMaterial({color:0x5c6688,roughness:1,flatShading:true});
    const snow=new THREE.MeshStandardMaterial({color:0xe8ecf6,roughness:.9,flatShading:true});
    for(let k=0;k<26;k++){const a=k/26*Math.PI*2+r()*.1,d=520+r()*160,h=90+r()*170,w=90+r()*90;
      const geo=new THREE.ConeGeometry(w,h,9,4);const gp=geo.attributes.position;for(let i=0;i<gp.count;i++){const y=gp.getY(i);if(y<h/2-1){gp.setX(i,gp.getX(i)*(1+(r()-.5)*.25));gp.setZ(i,gp.getZ(i)*(1+(r()-.5)*.25))}}
      geo.computeVertexNormals();const mt=new THREE.Mesh(geo,mMat);mt.position.set(Math.sin(a)*d,h/2-20,Math.cos(a)*d);S.add(mt);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(w*.28,h*.28,9),snow);cap.position.set(mt.position.x,h-20-h*.14+.5,mt.position.z);S.add(cap);}
  }

  // ---- Château sur un promontoire, au-delà du rempart nord ----
  function buildCastle(THREE,S,arena){
    const cz=-arena.halfZ-230,base=0,g=new THREE.Group();g.position.set(0,0,cz);g.scale.setScalar(1.25);
    const masonry=tex(THREE,stoneCanvas({size:512,rows:10,minW:.15,maxW:.3,base:[.66,.64,.62],seed:31,warp:2}));
    const wall=new THREE.MeshStandardMaterial({map:masonry,roughness:.9}),roof=new THREE.MeshStandardMaterial({color:0x2b4f8f,roughness:.55,metalness:.15});
    const gold=new THREE.MeshStandardMaterial({color:0xd8ae58,metalness:.8,roughness:.35}),win=new THREE.MeshBasicMaterial({color:0xffc56a});
    const rock=new THREE.MeshStandardMaterial({color:0x38352f,roughness:1,flatShading:true});
    // promontoire rocheux
    const hill=new THREE.CylinderGeometry(66,96,30,18,4);const hp=hill.attributes.position,rr=rng(5);
    for(let i=0;i<hp.count;i++){const y=hp.getY(i);if(y>-14&&y<10){hp.setX(i,hp.getX(i)*(1+(rr()-.5)*.18));hp.setZ(i,hp.getZ(i)*(1+(rr()-.5)*.18))}}
    hill.computeVertexNormals();const hm=new THREE.Mesh(hill,rock);hm.position.y=base+12;g.add(hm);
    const turf=new THREE.Mesh(new THREE.CylinderGeometry(67,67,1.2,18),new THREE.MeshStandardMaterial({color:0x3f5a2a,roughness:1}));turf.position.y=base+27.2;g.add(turf);
    const top=base+27;
    const uvScale=(geo,sx,sy)=>{const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*sx,uv.getY(i)*sy);return geo};
    const tower=(x,z,r,h,roofH,flag)=>{
      const t=new THREE.Mesh(uvScale(new THREE.CylinderGeometry(r,r*1.08,h,14),r*2,h/6),wall);t.position.set(x,top+h/2,z);g.add(t);
      const cr=new THREE.Mesh(new THREE.CylinderGeometry(r*1.18,r*1.18,1.6,14),wall);cr.position.set(x,top+h+.8,z);g.add(cr);
      const rf=new THREE.Mesh(new THREE.ConeGeometry(r*1.3,roofH,14),roof);rf.position.set(x,top+h+1.6+roofH/2,z);g.add(rf);
      const sp=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,4,6),gold);sp.position.set(x,top+h+1.6+roofH+2,z);g.add(sp);
      if(flag){const f=new THREE.Mesh(new THREE.PlaneGeometry(4,2.2),new THREE.MeshStandardMaterial({color:0x8a1c22,side:THREE.DoubleSide}));f.position.set(x+2.1,top+h+1.6+roofH+3,z);g.add(f)}
      for(let k=0;k<Math.floor(h/7);k++){const a=k*1.7,w=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.8),win);w.position.set(x+Math.sin(a)*(r+.06),top+5+k*6.5,z+Math.cos(a)*(r+.06));w.rotation.y=a;g.add(w)}
    };
    const block=(x,z,w,d,h)=>{const b=new THREE.Mesh(uvScale(new THREE.BoxGeometry(w,h,d),Math.max(w,d)/6,h/6),wall);b.position.set(x,top+h/2,z);g.add(b);
      for(let t=-w/2+1;t<w/2;t+=2.4){const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.4,d+.3),wall);m.position.set(x+t,top+h+.7,z);g.add(m)}
      return b};
    // enceinte + tours d'angle
    block(0,32,90,4,14);block(0,-32,90,4,14);
    const side=new THREE.Mesh(uvScale(new THREE.BoxGeometry(4,14,64),10,2.3),wall);side.position.set(-45,top+7,0);g.add(side);const s2=side.clone();s2.position.x=45;g.add(s2);
    for(const [x,z] of [[-45,32],[45,32],[-45,-32],[45,-32]])tower(x,z,6,22,12,false);
    // châtelet d'entrée
    tower(-9,34,4.5,24,9,true);tower(9,34,4.5,24,9,true);block(0,34,14,6,18);
    // donjon et flèches
    block(0,-4,38,30,30);
    const roofKeep=new THREE.Mesh(new THREE.ConeGeometry(26,16,4),roof);roofKeep.rotation.y=Math.PI/4;roofKeep.scale.z=.8;roofKeep.position.set(0,top+30+1.4+8,-4);g.add(roofKeep);
    tower(-16,8,5,46,18,true);tower(16,8,5,46,18,true);tower(0,-16,7,62,24,true);tower(-22,-20,4,38,14,false);tower(22,-20,4,38,14,false);
    for(let k=0;k<10;k++){const w=new THREE.Mesh(new THREE.PlaneGeometry(1.4,3),win);w.position.set(-15+k*3.4,top+12+(k%2)*8,11.05);g.add(w)}
    g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
    S.add(g);E.castle=g;
  }

  // ---- Ombres de contact sous les personnages (dessinés sur un autre canevas) ----
  function buildShadows(THREE,S){
    const c=canvas(64),g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(.6,'rgba(0,0,0,.25)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
    const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
    E.blobs=[];for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6),mat);b.rotation.x=-Math.PI/2;b.position.y=.03;b.visible=false;S.add(b);E.blobs.push(b)}
  }

  function render(camPos,target,units,w,h){
    if(!E.ok)return;
    const R=E.renderer,t=performance.now()/1000;E.time.value=t;
    const cw=Math.max(1,Math.floor(w)),ch=Math.max(1,Math.floor(h));
    if(E.w!==cw||E.h!==ch){R.setSize(cw,ch,false);E.camera.aspect=cw/ch;E.camera.updateProjectionMatrix();E.w=cw;E.h=ch}
    E.camera.position.set(camPos[0],camPos[1],camPos[2]);E.camera.lookAt(target[0],target[1],target[2]);
    for(const c of E.crystals){c.mesh.position.y=c.y+Math.sin(t*1.3+c.phase)*.18;c.mesh.rotation.y=t*.6+c.phase;c.sprite.position.y=c.mesh.position.y;c.sprite.material.opacity=.6+Math.sin(t*2.1+c.phase)*.15}
    for(const f of E.flames){const k=f.k;if(f.s){const fl=.9+Math.sin(t*13+k*3)*.12+Math.sin(t*7.7+k)*.08;f.s.scale.set(.6*fl,1.1*fl,1)}else f.light.intensity=1.1+Math.sin(t*11+k)*.15+Math.sin(t*5.3+k)*.1}
    if(E.rune)E.rune.material.emissiveIntensity=1.25+Math.sin(t*1.5)*.25;
    (units||[]).forEach((u,i)=>{const b=E.blobs[i];if(!b)return;b.visible=!!u.alive;b.position.set(u.x,.03+(u.y>0?0:0),u.z);const k=1/(1+Math.max(0,u.y||0)*.6);b.scale.setScalar(k)});
    for(let i=(units||[]).length;i<E.blobs.length;i++)E.blobs[i].visible=false;
    R.render(E.scene,E.camera);
  }

  const stats=()=>E.renderer?{calls:E.renderer.info.render.calls,triangles:E.renderer.info.render.triangles}:null;
  return {init,render,stats,mergeMeshes,get ok(){return E.ok},grassAmount};
});
