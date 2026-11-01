(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CharacterKits=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // DONNÉES des personnages (aucune dépendance à three.js) : 7 classes × 5 races = 35 kits.
  // Lues par le jeu (src/characters/builder.js) et par l'outil de construction des bundles (tools/build_characters.js).
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
      hair:{M:'Hair_Long',F:'Hair_Long'},hairColor:[.06,.05,.05],
      palette:{dark:[.10,.10,.12],mid:[.36,.37,.40],trim:[.74,.56,.28],cloth:[.48,.50,.54]},
      weapon:'swordShield',cape:{raceTint:1,trim:[.92,.72,.3],length:.62,emblem:1},
      bones:{spine_03:1.08,clavicle_l:1.1,clavicle_r:1.1,upperarm_l:1.06,upperarm_r:1.06},
      armor:{mat:{kind:'metal',style:{base:[.16,.18,.22],trim:[.88,.7,.32],diamonds:[.08,.3,.72],rivets:true,plain:true}},trim:[.92,.74,.32],thick:1.9,
        shellMat:{belt:{kind:'metal',style:{base:[.55,.42,.2],trim:[.95,.78,.36],diamonds:[.08,.3,.72],plain:true}}},
        shells:['cuirass','belt','rerebrace','vambrace','cuisse','greave'],pauldron:{layers:2,size:.16,bigSpikes:5,cover:1.3},mask:[.4,.43,.5],maskMetal:true}},
    arcanist:{ // Sorcière de bataille : robe violet profond / or, capuche, bâton à cristal arcane
      sex:'F',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet','Ranger_Head_Hood'],
      hair:{F:'Hair_Long',M:'Hair_SimpleParted'},hairColor:[.92,.72,.38],
      palette:{dark:[.13,.05,.20],mid:[.36,.14,.55],trim:[.86,.66,.26],cloth:[.93,.89,.80]},
      robe:{color:[.30,.11,.47],trim:[.86,.66,.26],length:.86,flare:1.7},
      staff:{crystal:[.78,.55,1.0]},eyeGlow:[.55,.30,1.0],orbs:{color:[.7,.45,1],n:3},
      cape:{color:[.34,.12,.5],trim:[.9,.7,.3],length:.82},handFx:[{kind:'orb',color:[.7,.4,1]}],
      // mantelet de tissu brodé d'or, ceinture et brassards assortis
      armor:{mat:{kind:'cloth',style:{base:[.30,.11,.46],trim:[.86,.66,.26],stitch:[.86,.66,.26],grain:.05,glow:[.75,.45,1]}},trim:[.86,.66,.26],
        shells:['belt','vambrace'],pauldron:{layers:2,size:.105,cover:1.3}}},
    oracle:{ // Prêtresse : robe blanche et or, bâton solaire
      sex:'F',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet'],
      hair:{F:'Hair_Buns',M:'Hair_SimpleParted'},hairColor:[.45,.27,.14],
      palette:{dark:[.40,.30,.16],mid:[.86,.82,.72],trim:[.90,.72,.30],cloth:[.97,.95,.90]},
      robe:{color:[.90,.88,.82],trim:[.88,.68,.25],length:.9,flare:1.6},
      staff:{crystal:[1.0,.82,.40],wood:0xe8dcc0,metal:0xd9b55a},orbs:{color:[1,.85,.4],n:3},
      cape:{color:[.92,.88,.78],trim:[.92,.72,.28],length:.85,emblem:'star'},handFx:[{kind:'star',color:[1,.85,.45]}],
      // mantelet blanc à larges bordures dorées, ceinture d'or
      armor:{mat:{kind:'cloth',style:{base:[.93,.91,.85],trim:[.88,.68,.25],stitch:[.88,.68,.25],lames:2,grain:.04,glow:[1,.8,.35]}},trim:[.92,.72,.28],
        shellMat:{belt:{kind:'metal',style:{base:[.88,.68,.28],lames:1,rivets:true,trim:[.95,.85,.5]}}},
        shells:['belt','vambrace'],pauldron:{layers:2,size:.11,cover:1.35}}},
    reaver:{ // Chevalier runique : plaques d'acier noirci à runes de givre, épaulières à pointes, grande lame runique
      sex:'M',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet'],
      hair:{M:'Hair_Long',F:'Hair_Long'},hairColor:[.78,.80,.82],
      palette:{dark:[.05,.06,.08],mid:[.20,.24,.30],trim:[.55,.74,.88],cloth:[.26,.30,.36]},
      weapon:'runeblade',eyeGlow:[.40,.80,1.0],cape:{color:[.1,.11,.17],trim:[.35,.55,.75],length:.78,tattered:1,flare:1.6},skulls:{shoulders:1,flame:[.35,.75,1]},
      armor:{mat:{kind:'metal',style:{base:[.17,.19,.22],trim:[.30,.34,.40],lames:3,ridge:true,rune:[.45,.85,1]}},trim:[.34,.38,.46],thick:1.6,bones:null,
        shells:['cuirass','belt','rerebrace','vambrace','cuisse','greave'],pauldron:{layers:4,size:.165,spikes:3,cover:1.3}}},
    warden:{ // Druidesse : robe de lin vert et crème, épaulières de feuilles, bois de cerf, bâton noueux à cristal vert
      sex:'F',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet'],
      hair:{M:'Hair_Long',F:'Hair_Long'},hairColor:[.55,.22,.08],
      palette:{dark:[.12,.16,.06],mid:[.26,.42,.16],trim:[.78,.62,.26],cloth:[.86,.82,.66]},
      robe:{color:[.20,.38,.14],trim:[.82,.66,.28],length:.9,flare:1.6},cape:{color:[.16,.3,.12],trim:[.6,.75,.25],length:.8,tattered:.8},
      staff:{crystal:[.45,1.0,.35],wood:0x4a3018,metal:0x8a7a40,inHand:true},antlers:true,
      armor:{mat:{kind:'leather',style:{base:[.32,.21,.11],trim:[.22,.34,.12],stitch:[.6,.5,.3],glow:[.35,1,.3]}},shells:['belt','vambrace'],
        pauldron:{layers:2,size:.125,leaves:true,mat:{kind:'leather',style:{base:[.30,.20,.11],lames:4,grain:.16}}}}},
    shade:{ // Voleuse : armure de cuir noir et rouge, masque, capuche, deux dagues aux hanches
      sex:'F',outfit:['Ranger_Body','Ranger_Arms','Ranger_Legs','Ranger_Feet','Ranger_Head_Hood'],
      hair:{F:'Hair_Long',M:'Hair_Buzzed'},hairColor:[.10,.07,.06],
      palette:{dark:[.04,.04,.05],mid:[.14,.14,.17],trim:[.50,.12,.10],cloth:[.24,.24,.27]},
      weapon:'daggers',cape:{color:[.55,.06,.06],trim:[.3,.04,.04],length:.42,width:.75,tattered:1,flare:1.7},
      armor:{mat:{kind:'leather',style:{base:[.075,.065,.07],trim:[.46,.07,.06],stitch:[.7,.13,.1],lames:2,grain:.08,glow:[1,.12,.08]}},
        shellMat:{belt:{kind:'leather',style:{base:[.48,.07,.06],stitch:[.15,.02,.02],grain:.1}}},
        shells:['chest','belt','vambrace','greave'],pauldron:{layers:2,size:.1},mask:[.025,.02,.025]}},
    warlock:{ // Occultiste : robe noire et verte, capuche, bâton à flamme verte
      sex:'M',outfit:['Peasant_Body','Peasant_Arms','Peasant_Legs','Peasant_Feet','Ranger_Head_Hood'],
      hair:{M:'Hair_SimpleParted',F:'Hair_Long'},hairColor:[.12,.10,.10],
      palette:{dark:[.08,.03,.10],mid:[.32,.10,.38],trim:[.85,.65,.25],cloth:[.36,.14,.42]},
      robe:{color:[.30,.08,.38],trim:[.45,.85,.22],length:.9,flare:1.5},cape:{color:[.26,.06,.32],trim:[.85,.65,.25],length:.85,tattered:.5},
      skulls:{belt:1},handFx:[{kind:'flame',color:[.45,1,.25],hand:'r'},{kind:'book',color:[.45,1,.25]}],
      staff:{crystal:[.40,1.0,.25],wood:0x1c1418,metal:0x50604a},eyeGlow:[.40,1.0,.25],orbs:{color:[.4,1,.25],n:3},
      // mantelet sombre aux runes vertes et cornes d'os
      armor:{mat:{kind:'cloth',style:{base:[.24,.06,.3],trim:[.85,.65,.25],rune:[.40,1.0,.25],grain:.06}},trim:[.85,.65,.25],
        shells:['belt','vambrace'],pauldron:{layers:2,size:.115,cover:1.3,spikes:2,spikeColor:0xe6dcc0}}}
  };
  // RACE : morphologie (échelle des os, rotations seulement dans les animations), peau, cheveux, détails.
  const RACES={
    human:{},
    orc:{sex:{arcanist:'F',warden:'F'},defaultSex:'M',hairF:'Hair_Long',skin:[.46,.98,.32],hairColor:[.07,.05,.04],noHair:true,tusks:true,ears:{len:.055,up:.25},
      bones:{spine_02:1.1,spine_03:1.1,neck_01:.86}},
    dwarf:{sex:'M',skin:[1.08,.92,.84],hairColor:[.55,.24,.09],beard:true,hair:'Hair_Buzzed',
      bigBeard:true,bones:{spine_01:1.2,spine_02:1.05,neck_01:.9,upperarm_l:1.06,upperarm_r:1.06,thigh_l:.78,thigh_r:.78}},
    elf:{skin:[1.06,1.0,.98],hairColor:[.93,.90,.80],hair:'Hair_Long',ears:{len:.13,up:.6},eyeGlow:[.35,.85,1.0],
      bones:{spine_03:.96}},
    undead:{skin:[.84,.80,.68],hairColor:[.82,.84,.88],noHair:true,skull:true,eyeGlow:[.45,.85,1.0],bones:{spine_03:.95,neck_01:.97}}
  };
  const SEXNAME={F:'Female',M:'Male'};
  const PARTFILE={Ranger_Feet:{F:'Female_Ranger_Feet',M:'Male_Ranger_Feet_Boots'},Ranger_Pauldron:{F:'Female_Ranger_Acc_Pauldrons',M:'Male_Ranger_Acc_Pauldron'}};
  const partFile=(key,sex)=>(PARTFILE[key]?.[sex]||SEXNAME[sex]+'_'+key)+'.gltf';
  const sexFor=(race,cls)=>{const x=RACES[race].sex;return typeof x==='object'?(x[cls]||RACES[race].defaultSex||CLASSES[cls].sex):x||CLASSES[cls].sex};
  // Kit complet d'une race+classe.
  function resolveKit(kitId){
    const [race,cls]=kitId.split('_'),R=RACES[race],C=CLASSES[cls];
    if(!R||!C)throw new Error('Kit inconnu : '+kitId);
    const noHelm=race==='orc'||race==='elf';let armor=C.armor&&noHelm&&C.armor.helmet?{...C.armor,helmet:null}:C.armor;
    if(armor?.maskMetal&&(race==='orc'||race==='dwarf'))armor={...armor,mask:null};
    const sex=sexFor(race,cls),hair=armor?.helmet?[]:R.hairF&&sex==='F'?[R.hairF]:R.noHair?[]:[R.hair&&sex==='M'?R.hair:C.hair[sex]];if(R.beard)hair.push('Hair_Beard.gltf');
    return {...C,race,cls,sex,body:'Superhero_'+SEXNAME[sex]+'_FullBody.gltf',outfit:'outfit_'+cls+'_'+sex,
      hair:hair.map(h=>/\.gltf$/.test(h)?h:h+'.gltf'),hairColor:R.hairColor||C.hairColor,skin:R.skin||[1,1,1],
      eyeGlow:R.eyeGlow||C.eyeGlow,ears:R.ears,tusks:R.tusks,skull:R.skull,bigBeard:R.bigBeard,bones:mergeBones(mergeBones(HEROIC[sex],C.bones),R.bones),orbs:C.orbs,rim:RIM[cls],
      weapon:C.weapon==='swordShield'?({dwarf:'hammerShield',orc:'axeShield'}[race]||'swordShield'):C.weapon,
      cape:tint(C.cape,race),tabard:tint(C.tabard,race),armor};
  }
  const RACE_TINT={human:[.12,.2,.52],elf:[.1,.34,.16],dwarf:[.14,.22,.5],orc:[.5,.07,.05],undead:[.36,.05,.08]},RACE_EMBLEM={human:'sword',elf:'tree',dwarf:'hammer',orc:'axes',undead:'sword'};
  function tint(c,race){if(!c)return c;const o={...c};if(o.raceTint)o.color=RACE_TINT[race];if(o.emblem===1)o.emblem=RACE_EMBLEM[race];return o}
  // Silhouette héroïque (épaules larges, grandes mains, tête un peu plus petite), puis liseré de lumière par classe.
  const HEROIC={M:{clavicle_l:1.08,clavicle_r:1.08,upperarm_l:1.05,upperarm_r:1.05,hand_l:1.15,hand_r:1.15,Head:.93,spine_03:1.04},F:{hand_l:1.06,hand_r:1.06,Head:.95}};
  const RIM={sentinel:[1,.72,.38],arcanist:[.72,.45,1],oracle:[1,.86,.5],reaver:[.4,.8,1],warden:[.5,1,.4],shade:[1,.32,.25],warlock:[.55,1,.3]};
  function mergeBones(a,b){const o={...(a||{})};for(const k in b||{})o[k]=(o[k]||1)*b[k];return o}
  const KITS={};for(const r in RACES)for(const c in CLASSES)KITS[r+'_'+c]={race:r,cls:c};
  // Pour le build : bundles de tenue (pièces fusionnées) et fichiers simples nécessaires.
  function buildManifest(){
    const outfits={},files=new Set();
    for(const id in KITS){const k=resolveKit(id);outfits[k.outfit]=CLASSES[k.cls].outfit.map(p=>partFile(p,k.sex));files.add(k.body);k.hair.forEach(h=>files.add(h))}
    return {outfits,files:[...files]};
  }
  const assetName=f=>f.replace(/.(gltf|glb)$/i,'');
  const kitFor=(race,cls)=>KITS[race+'_'+cls]?race+'_'+cls:null;

  return {ANIMS,CLASSES,RACES,KITS,resolveKit,buildManifest,assetName,kitFor};
});
