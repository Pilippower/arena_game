'use strict';
// Test navigateur réel (Edge/Chrome via playwright-core) : démarrage sans erreur JS,
// sélection race/classe + preview, lancement d'un round pour chaque classe, mode mobile.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

let chromium;
try{({chromium}=require('playwright-core'))}catch{
  console.log('SKIP - playwright-core absent (lancer npm install)');process.exit(0);
}

const ROOT=path.join(__dirname,'..');
const url=(file,query='')=>pathToFileURL(path.join(ROOT,file)).href+query;

function findBrowser(){
  const candidates=[
    process.env.BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  return candidates.find(p=>p&&fs.existsSync(p));
}

// Les échecs réseau (CDN Three.js / GLB externes) sont tolérés : le jeu a un fallback.
const isNetworkNoise=t=>/Failed to load resource|net::ERR_|ERR_INTERNET|Failed to fetch|CORS|GLTF|\.glb/i.test(t);

function watchErrors(page){
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
  page.on('console',m=>{if(m.type()==='error'&&!isNetworkNoise(m.text()))errors.push('console.error: '+m.text())});
  return errors;
}

async function bootError(page){
  return page.evaluate(()=>{const e=document.getElementById('bootError');return getComputedStyle(e).display!=='none'?e.textContent:''});
}

async function run(){
  const executablePath=findBrowser();
  if(!executablePath){console.log('SKIP - aucun Edge/Chrome trouvé (définir BROWSER_PATH)');return}
  const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  try{
    // 1. Desktop : sélection + preview + round
    {
      const ctx=await browser.newContext({viewport:{width:1366,height:768}});
      const page=await ctx.newPage();const errors=watchErrors(page);
      await page.goto(url('index.html'));
      await page.waitForTimeout(500);
      assert.equal(await bootError(page),'','erreur de démarrage affichée');
      assert.equal(await page.locator('#raceChoices button').count(),5,'5 races attendues');
      assert.equal(await page.locator('#classChoices button').count(),7,'7 classes attendues');
      assert.ok(await page.locator('#playBtn').isDisabled(),'Jouer doit être désactivé sans sélection');
      assert.equal(await page.evaluate(()=>document.body.classList.contains('mobile-mode')),false,'desktop ne doit pas être en mode mobile');

      await page.click('#raceChoices button[data-r="orc"]');
      await page.click('#classChoices button[data-c="arcanist"]');
      assert.ok(await page.locator('#playBtn').isEnabled(),'Jouer doit être actif après sélection');
      assert.match(await page.textContent('#selectedClass'),/Orc Mage/);
      // Changements rapides : ne doit ni planter ni créer plusieurs canvas preview
      for(const [r,c] of [['elf','shade'],['dwarf','sentinel'],['undead','warlock'],['human','oracle'],['orc','arcanist']]){
        await page.click(`#raceChoices button[data-r="${r}"]`);await page.click(`#classChoices button[data-c="${c}"]`);
      }
      assert.equal(await page.locator('#preview3d').count(),1,'un seul canvas preview');
      await page.waitForFunction(()=>getComputedStyle(document.getElementById('previewLoading')).display==='none'||PREVIEW.loaded,null,{timeout:15000})
        .catch(()=>{throw new Error('preview bloquée sur "Chargement du personnage…"')});

      // Humain + Mage : personnage CC0 assemblé (characters.js), chargé depuis assets/characters/*.js en file://
      await page.click('#raceChoices button[data-r="human"]');
      await page.waitForFunction(()=>{let robe=false;PREVIEW.group?.traverse(o=>{if(o.name==='Robe')robe=true});return PREVIEW.loaded&&robe},null,{timeout:30000})
        .catch(()=>{throw new Error('preview Humain Mage : personnage assemblé non chargé')});
      await page.click('#raceChoices button[data-r="orc"]');

      await page.click('#playBtn');
      await page.waitForTimeout(1500);
      const s=await page.evaluate(()=>({round:state.round,units:state.units.length,pcls:state.pcls,prace:state.prace,elapsed:state.elapsed,overlay:getComputedStyle(document.getElementById('overlay')).display}));
      assert.equal(s.overlay,'none','overlay de sélection doit disparaître');
      assert.equal(s.round,1);assert.equal(s.units,6,'3v3 = 6 unités');
      assert.equal(s.pcls,'arcanist');assert.equal(s.prace,'orc');
      assert.ok(s.elapsed>0,'la simulation doit avancer');
      assert.equal(await bootError(page),'');
      assert.deepEqual(errors,[],'erreurs JS desktop');
      await ctx.close();
    }

    // 2. Chaque classe démarre un round sans erreur (via ?autoplay=)
    {
      const ctx=await browser.newContext({viewport:{width:1280,height:720}});
      for(const cls of ['sentinel','arcanist','oracle','reaver','warden','shade','warlock']){
        const page=await ctx.newPage();const errors=watchErrors(page);
        await page.goto(url('index.html',`?autoplay=${cls}&race=orc`));
        await page.waitForTimeout(1200);
        const s=await page.evaluate(()=>({pcls:state?.pcls,units:state?.units?.length,elapsed:state?.elapsed}));
        assert.equal(s.pcls,cls);assert.equal(s.units,6);assert.ok(s.elapsed>0,`${cls}: simulation figée`);
        assert.equal(await bootError(page),'',`${cls}: erreur de démarrage`);
        assert.deepEqual(errors,[],`${cls}: erreurs JS`);
        await page.close();
      }
      await ctx.close();
    }

    // 2b. En arène, le joueur Humain Mage utilise le personnage assemblé et ses animations
    {
      const ctx=await browser.newContext({viewport:{width:1280,height:720}});
      const page=await ctx.newPage();const errors=watchErrors(page);
      await page.goto(url('index.html','?autoplay=arcanist&race=human'));
      await page.waitForFunction(()=>{const r=HF.records.get(state.player.id);let robe=false;r?.model?.traverse(o=>{if(o.name==='Robe')robe=true});return r?.loaded&&robe},null,{timeout:30000})
        .catch(()=>{throw new Error('arène Humain Mage : personnage assemblé non chargé')});
      await page.waitForTimeout(500);
      const anim=await page.evaluate(()=>HF.records.get(state.player.id).action?.getClip().name);
      assert.equal(anim,'Idle_Loop','animation de repos Quaternius attendue');
      assert.deepEqual(errors,[],'erreurs JS arène Humain Mage');
      await ctx.close();
    }

    // 3. Mobile paysage via mobile.html
    {
      const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});
      const page=await ctx.newPage();const errors=watchErrors(page);
      await page.goto(url('mobile.html'));
      await page.waitForURL(/index\.html\?mobile=1/);
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(()=>document.body.classList.contains('mobile-mode')),true,'mobile.html doit forcer le mode mobile');
      await page.click('#raceChoices button[data-r="human"]');
      await page.click('#classChoices button[data-c="sentinel"]');
      await page.click('#playBtn');
      await page.waitForTimeout(1200);
      const m=await page.evaluate(()=>{
        const vis=id=>{const e=document.getElementById(id);if(!e)return false;const cs=getComputedStyle(e),r=e.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};
        const c=document.getElementById('c').getBoundingClientRect();
        return {joystick:vis('mobileJoystick'),target:vis('mobileTargetBtn'),jump:vis('mobileJumpBtn'),timer:vis('timer'),score:vis('score'),canvasBottom:c.bottom,vh:innerHeight};
      });
      assert.ok(m.joystick,'joystick visible');assert.ok(m.target,'bouton CIBLE visible');assert.ok(m.jump,'bouton SAUT visible');
      assert.ok(m.timer,'timer visible');assert.ok(m.score,'score visible');
      assert.ok(m.vh-m.canvasBottom<4,`bande vide sous l'arène (${m.vh-m.canvasBottom}px)`);
      assert.deepEqual(errors,[],'erreurs JS mobile');
      await ctx.close();
    }
  }finally{await browser.close()}
  console.log('OK - démarrage navigateur desktop + 7 classes + mobile paysage');
}

run().catch(e=>{console.error(e);process.exit(1)});
