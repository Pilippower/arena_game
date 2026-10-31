'use strict';
// Optimise les sources CC0 Quaternius (assets_src/, non versionné) et les emballe en fichiers .js
// dans assets/characters/ : le jeu reste jouable en double-clic (file:// bloque le chargement des .glb).
// Usage : node tools/build_characters.js
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {prune,dedup,resample,mergeDocuments,unpartition}=require('@gltf-transform/functions');
const CharacterKit=require('../characters.js');

const ROOT=path.join(__dirname,'..');
const OUT=path.join(ROOT,'assets','characters');
const SRC={
  base:'assets_src/Universal Base Characters[Standard]/Universal Base Characters[Standard]/Base Characters/Godot - UE/',
  hair:'assets_src/Universal Base Characters[Standard]/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/',
  outfit:'assets_src/Modular Character Outfits - Fantasy[Standard]/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/',
  parts:'assets_src/Modular Character Outfits - Fantasy[Standard]/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts/',
  anims:'assets_src/Universal Animation Library[Standard]/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
};
const TEX_SIZE=1024;

// Le pack référence parfois "X_png.png" alors que le fichier s'appelle "X.png".
function fixMissingUris(file){
  if(!file.endsWith('.gltf'))return file;
  const dir=path.dirname(file),json=JSON.parse(fs.readFileSync(file,'utf8'));let changed=false;
  for(const img of json.images||[]){
    if(img.uri&&!fs.existsSync(path.join(dir,img.uri))){const alt=img.uri.replace(/_png\.png$/,'.png');if(fs.existsSync(path.join(dir,alt))){img.uri=alt;changed=true}}
  }
  if(!changed)return file;
  const tmp=path.join(dir,'.fixed_'+path.basename(file));fs.writeFileSync(tmp,JSON.stringify(json));return tmp;
}

async function shrinkTextures(doc){
  for(const tex of doc.getRoot().listTextures()){
    const img=tex.getImage();if(!img)continue;
    const s=sharp(Buffer.from(img)),meta=await s.metadata();
    // Beaucoup de PNG ont un canal alpha inutile (entièrement opaque) : JPEG dans ce cas.
    if(meta.hasAlpha&&(await s.stats()).isOpaque)meta.hasAlpha=false;
    const size=Math.min(TEX_SIZE,meta.width||TEX_SIZE);
    const out=meta.hasAlpha?await s.resize(size,size).png({compressionLevel:9}).toBuffer():await s.resize(size,size).jpeg({quality:86,mozjpeg:true}).toBuffer();
    tex.setImage(out).setMimeType(meta.hasAlpha?'image/png':'image/jpeg');
    tex.setURI(tex.getURI().replace(/\.\w+$/,meta.hasAlpha?'.png':'.jpg'));
  }
}

// Lit un fichier source ; une liste de pièces modulaires est fusionnée en un seul document (texture partagée dédoublonnée).
async function readSources(io,srcFiles){
  const [first,...others]=srcFiles.map(f=>fixMissingUris(path.join(ROOT,f)));
  const doc=await io.read(first);
  for(const f of others){
    mergeDocuments(doc,await io.read(f));
    const [main,...extra]=doc.getRoot().listScenes();
    for(const sc of extra){for(const n of sc.listChildren())main.addChild(n);sc.dispose()}
  }
  if(others.length)await doc.transform(unpartition());
  return doc;
}

async function bundle(io,name,srcFile,{animsKeep=null}={}){
  const doc=await readSources(io,[].concat(srcFile));
  if(animsKeep){
    // Bibliothèque d'animations : on retire le mannequin et les clips inutiles.
    for(const a of doc.getRoot().listAnimations())if(!animsKeep.includes(a.getName()))a.dispose();
    for(const n of doc.getRoot().listNodes())if(n.getMesh()){n.getMesh().dispose();n.setMesh(null);n.setSkin(null)}
    // Canaux position/échelle constants et égaux à la pose de repos : inutiles (la majorité des 195 canaux/clip).
    for(const a of doc.getRoot().listAnimations())for(const ch of a.listChannels()){
      const p=ch.getTargetPath(),node=ch.getTargetNode();if(p==='rotation'||!node)continue;
      const rest=p==='scale'?node.getScale():node.getTranslation(),out=ch.getSampler().getOutput().getArray();
      let dev=0;for(let i=0;i<out.length;i++)dev=Math.max(dev,Math.abs(out[i]-rest[i%3]));
      if(dev<1e-3){const s=ch.getSampler();ch.dispose();s.dispose()}
    }
  }
  await shrinkTextures(doc);
  await doc.transform(resample({tolerance:1e-4}),dedup(),prune({keepLeaves:true}));
  const glb=Buffer.from(await io.writeBinary(doc));
  const js=`(window.CHAR_ASSETS=window.CHAR_ASSETS||{})[${JSON.stringify(name)}]=${JSON.stringify(glb.toString('base64'))};\n`;
  fs.writeFileSync(path.join(OUT,name+'.js'),js);
  console.log(`${name}.js  ${(js.length/1048576).toFixed(2)} Mo`);
}

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const {outfits,files}=CharacterKit.buildManifest();
  const only=process.argv[2]?new RegExp(process.argv[2]):null;      // ex. node tools/build_characters.js outfit_
  for(const f of files)if(!only||only.test(f))await bundle(io,CharacterKit.assetName(f),(/^Hair_/.test(f)?SRC.hair:SRC.base)+f);
  for(const [name,parts] of Object.entries(outfits))if(!only||only.test(name))await bundle(io,name,parts.map(p=>SRC.parts+p));
  if(only&&!only.test('anims'))return;
  await bundle(io,'anims',SRC.anims,{animsKeep:CharacterKit.ANIMS});
})().catch(e=>{console.error(e);process.exit(1)});
