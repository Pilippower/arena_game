'use strict';
// Test navigateur réel (Edge/Chrome via playwright-core) : démarrage sans erreur JS,
// sélection race/classe + preview, lancement d'un round pour chaque classe, mode mobile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch {
  console.log('SKIP - playwright-core absent (lancer npm install)');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..', '..');
const url = (file, query = '') => pathToFileURL(path.join(ROOT, file)).href + query;

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  return candidates.find(p => p && fs.existsSync(p));
}

// Les échecs réseau (CDN Three.js / GLB externes) sont tolérés : le jeu a un fallback.
const isNetworkNoise = t => /Failed to load resource|net::ERR_|ERR_INTERNET|Failed to fetch|CORS|GLTF|\.glb/i.test(t);

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => {
    if (m.type() === 'error' && !isNetworkNoise(m.text())) errors.push('console.error: ' + m.text());
  });
  return errors;
}

async function bootError(page) {
  return page.evaluate(() => {
    const e = document.getElementById('bootError');
    return getComputedStyle(e).display !== 'none' ? e.textContent : '';
  });
}

async function run() {
  const executablePath = findBrowser();
  if (!executablePath) {
    console.log('SKIP - aucun Edge/Chrome trouvé (définir BROWSER_PATH)');
    return;
  }
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: require('./browser.js').launchArgs(['--autoplay-policy=no-user-gesture-required'])
  });
  try {
    // 1. Desktop : sélection + preview + round
    {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      await page.goto(url('index.html'));
      await page.waitForTimeout(500);
      assert.equal(await bootError(page), '', 'erreur de démarrage affichée');
      assert.equal(await page.locator('#raceChoices button').count(), 5, '5 races attendues');
      assert.equal(await page.locator('#classChoices button').count(), 7, '7 classes attendues');
      assert.ok(await page.locator('#playBtn').isDisabled(), 'Jouer doit être désactivé sans sélection');
      assert.equal(
        await page.evaluate(() => document.body.classList.contains('mobile-mode')),
        false,
        'desktop ne doit pas être en mode mobile'
      );

      // Lobby (design de l'utilisateur) : tout tient dans la page en 1366×768, sans barre de défilement
      const fit = await page.evaluate(() => {
        const m = document.querySelector('#overlay .modal');
        return { lobby: document.body.classList.contains('lobby'), scroll: m.scrollHeight - m.clientHeight };
      });
      assert.ok(fit.lobby, 'body.lobby pendant la sélection');
      assert.ok(fit.scroll <= 1, `lobby : défilement inattendu (${fit.scroll}px)`);
      // mise en page du 2e design, boutons en biseau (06/11/2026, src/ui/lobby_buttons.css) : onglets, Mode, Difficulty
      const bevel = await page.evaluate(() =>
        ['#tabSolo', '#sizeChoices button', '#diffChoices button'].map(s => {
          const b = document.querySelector(s);
          return getComputedStyle(b, '::before').transform !== 'none' && getComputedStyle(b).borderRadius === '0px';
        })
      );
      assert.deepEqual(bevel, [true, true, true], 'lobby : boutons en biseau');
      assert.ok(
        await page.evaluate(() => !!document.querySelector('#mapChoices .mapCard, #mapChoices button')?.offsetHeight),
        'lobby : arènes illustrées (2e design)'
      );
      // fenêtre large et basse (06/11/2026, chez un ami) : tout tient dans le cadre et les arènes ne sont pas rognées en
      // bande (largeur ≤ 2,35 × hauteur)
      await page.setViewportSize({ width: 1530, height: 650 });
      await page.waitForTimeout(150);
      const low = await page.evaluate(() => {
        const m = document.querySelector('#overlay .modal'),
          c = document.querySelector('#mapChoices .mapCard').getBoundingClientRect();
        return { scroll: m.scrollHeight - m.clientHeight, ratio: c.width / c.height };
      });
      assert.ok(low.scroll <= 1, `fenêtre basse : défilement (${low.scroll}px)`);
      assert.ok(
        low.ratio > 1.8 && low.ratio < 2.45,
        `fenêtre basse : arène rognée ou écrasée (${low.ratio.toFixed(2)})`
      );
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForTimeout(150);
      // onglet Multiplayer (groupe simulé, sans réseau) : chaque réglage tient dans son bouton (bug du 04/11/2026 :
      // « Medium » sortait de son cadre)
      const overflow = await page.evaluate(() => {
        NET.role = 'host';
        NET.code = 'TEST01';
        lobbyTab('party');
        const out = [...document.querySelectorAll('#partyBox .pOpt')]
          .filter(b => b.scrollWidth > b.clientWidth + 1)
          .map(b => b.textContent);
        // le contenu remplit le cadre doré comme l'onglet Solo (demande du 04/11/2026) sans en déborder
        const R = s => document.querySelector(s).getBoundingClientRect(),
          box = R('#partyBox'),
          view = R('#overlay .partyView');
        if (box.width < view.width * 0.95 || box.height < view.height * 0.8) out.push('contenu trop petit');
        for (const s of ['.pSettings', '.pTeams', '.pActions'])
          for (const e of document.querySelectorAll(`#partyBox ${s}, #partyBox ${s} *`)) {
            const r = e.getBoundingClientRect();
            if (r.width && (r.right > view.right + 1 || r.left < view.left - 1)) out.push('déborde : ' + s);
          }
        NET.role = null;
        lobbyTab('solo');
        return out;
      });
      assert.deepEqual(overflow, [], 'Multiplayer : texte qui déborde de son bouton');
      await page.click('#raceChoices button[data-r="orc"]');
      await page.click('#classChoices button[data-c="arcanist"]');
      assert.ok(await page.locator('#playBtn').isEnabled(), 'Jouer doit être actif après sélection');
      assert.match(await page.textContent('#selectedClass'), /Orc Mage/);
      // Changements rapides : ne doit ni planter ni créer plusieurs canvas preview
      for (const [r, c] of [
        ['elf', 'shade'],
        ['dwarf', 'sentinel'],
        ['undead', 'warlock'],
        ['human', 'oracle'],
        ['orc', 'arcanist']
      ]) {
        await page.click(`#raceChoices button[data-r="${r}"]`);
        await page.click(`#classChoices button[data-c="${c}"]`);
      }
      assert.equal(await page.locator('#preview3d').count(), 1, 'un seul canvas preview');
      await page
        .waitForFunction(
          () => getComputedStyle(document.getElementById('previewLoading')).display === 'none' || PREVIEW.loaded,
          null,
          { timeout: 15000 }
        )
        .catch(() => {
          throw new Error('preview bloquée sur "Chargement du personnage…"');
        });

      // Humain + Mage : personnage CC0 assemblé (characters.js), chargé depuis assets/characters/*.js en file://
      await page.click('#raceChoices button[data-r="human"]');
      await page
        .waitForFunction(
          () => {
            let robe = false;
            PREVIEW.group?.traverse(o => {
              if (o.name === 'Robe') robe = true;
            });
            return PREVIEW.loaded && robe;
          },
          null,
          { timeout: 30000 }
        )
        .catch(() => {
          throw new Error('preview Humain Mage : personnage assemblé non chargé');
        });
      await page.click('#raceChoices button[data-r="orc"]');

      await page.click('#playBtn');
      await page.waitForTimeout(1500);
      const s = await page.evaluate(() => ({
        round: state.round,
        units: state.units.length,
        pcls: state.pcls,
        prace: state.prace,
        advanced: state.prep < GATE_TIME || state.elapsed > 0, // préparation (salles de départ) puis combat
        overlay: getComputedStyle(document.getElementById('overlay')).display
      }));
      assert.equal(s.overlay, 'none', 'overlay de sélection doit disparaître');
      assert.equal(s.round, 1);
      assert.equal(s.units, 6, '3v3 = 6 unités');
      assert.equal(s.pcls, 'arcanist');
      assert.equal(s.prace, 'orc');
      assert.ok(s.advanced, 'la simulation doit avancer');
      assert.equal(await page.evaluate(() => ENV.ok), true, 'décor 3D (environment.js) chargé');
      assert.equal(await bootError(page), '');
      assert.deepEqual(errors, [], 'erreurs JS desktop');
      await ctx.close();
    }

    // 2. Chaque classe démarre un round sans erreur (via ?autoplay=)
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      for (const cls of ['sentinel', 'arcanist', 'oracle', 'reaver', 'warden', 'shade', 'warlock']) {
        const page = await ctx.newPage();
        const errors = watchErrors(page);
        await page.goto(url('index.html', `?autoplay=${cls}&race=orc`));
        // écran de chargement (shaders, personnages…) puis la manche démarre
        await page.waitForFunction(() => state?.units && !state.loading, null, { timeout: 90000 });
        await page.waitForTimeout(700);
        const s = await page.evaluate(() => ({
          pcls: state?.pcls,
          units: state?.units?.length,
          advanced: state.prep < GATE_TIME || state.elapsed > 0
        }));
        assert.equal(s.pcls, cls);
        assert.equal(s.units, 6);
        assert.ok(s.advanced, `${cls}: simulation figée`);
        assert.equal(await bootError(page), '', `${cls}: erreur de démarrage`);
        assert.deepEqual(errors, [], `${cls}: erreurs JS`);
        await page.close();
      }
      await ctx.close();
    }

    // 2b. En arène, le joueur Humain Mage utilise le personnage assemblé et ses animations
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      // gates=0 : portes ouvertes tout de suite, les attentes ci-dessous se mesurent au chrono de la manche
      await page.goto(url('index.html', '?autoplay=arcanist&race=human&gates=0'));
      await page
        .waitForFunction(
          () => {
            const r = HF.records.get(state.player.id);
            let robe = false;
            r?.model?.traverse(o => {
              if (o.name === 'Robe') robe = true;
            });
            return r?.loaded && robe;
          },
          null,
          { timeout: 30000 }
        )
        .catch(() => {
          throw new Error('arène Humain Mage : personnage assemblé non chargé');
        });
      await page.waitForTimeout(500);
      const anim = await page.evaluate(() => HF.records.get(state.player.id).action?.getClip().name);
      assert.equal(anim, 'Idle_Loop', 'animation de repos Quaternius attendue');
      // Métamorphose : mouton qui erre dans 1 m de rayon, ne peut rien faire, brisée au premier coup
      const poly = await page.evaluate(async () => {
        for (const u of state.units) if (u !== state.player) u.ai = false;
        const pl = state.player,
          e = state.units.find(u => u.team !== pl.team);
        pl.x = e.x - 6;
        pl.z = e.z;
        pl.target = e;
        pl.gcd = 0;
        // attentes en temps de simulation (le rendu logiciel des tests est lent)
        const simWait = sec =>
          new Promise(r => {
            const t0 = state.elapsed;
            const f = () => (state.elapsed - t0 >= sec ? r() : setTimeout(f, 50));
            f();
          });
        const cast = useSkill(pl, 5);
        await simWait(1.7);
        const o = { cast, poly: e.poly };
        await simWait(2);
        const rec = HF.records.get(e.id);
        o.dist = Math.hypot(e.x - e.polyX, e.z - e.polyZ);
        o.sheep = !!rec.sheep?.visible;
        o.hidden = !rec.model.visible;
        o.act = useSkill(e, 0);
        damage(pl, e, 1);
        o.after = e.poly;
        return o;
      });
      assert.ok(poly.cast, 'Polymorph lancé');
      assert.ok(poly.poly > 5, `cible métamorphosée (${poly.poly})`);
      assert.ok(poly.dist <= 1.0, `le mouton reste dans 2 m de diamètre (${poly.dist})`);
      assert.ok(poly.sheep && poly.hidden, 'modèle remplacé par le mouton');
      assert.equal(poly.act, false, 'un mouton ne peut pas lancer de sort');
      assert.equal(poly.after, 0, 'un coup brise la métamorphose');
      // Saut : animation en l'air (pas de course qui « pédale »)
      await page.evaluate(() => {
        const p = state.player;
        p.vy = 7.5;
        p.grounded = false;
      });
      await page.waitForFunction(
        () => HF.records.get(state.player.id).animKey === 'air' || state.player.grounded,
        null,
        { timeout: 10000 }
      );
      assert.equal(
        await page.evaluate(() => HF.records.get(state.player.id).animKey),
        'air',
        "animation de saut en l'air"
      );
      await page.waitForTimeout(1200);
      // Pas chassé (caméra tenue) : le modèle se tourne vers la direction de course, l'orientation de jeu ne change pas
      await page.evaluate(() => {
        looking = true;
        state.player.yaw = camera.yaw;
      });
      await page.waitForFunction(() => state.player.grounded, null, { timeout: 20000 });
      await page.focus('#c');
      await page.keyboard.down('KeyD');
      await page
        .waitForFunction(() => Math.abs(Math.abs(HF.records.get(state.player.id).moveOff) - Math.PI / 2) < 0.2, null, {
          timeout: 20000
        })
        .catch(() => {});
      const strafe = await page.evaluate(() => ({
        off: HF.records.get(state.player.id).moveOff,
        yaw: state.player.yaw,
        cam: camera.yaw
      }));
      await page.keyboard.up('KeyD');
      await page.evaluate(() => {
        looking = false;
      });
      assert.ok(
        Math.abs(Math.abs(strafe.off) - Math.PI / 2) < 0.2,
        `corps tourné de 90° en pas chassé (${strafe.off})`
      );
      assert.ok(Math.abs(strafe.yaw - strafe.cam) < 1e-6, 'orientation de jeu = caméra pendant le pas chassé');
      // Les 35 combinaisons race+classe s'assemblent, avec leurs pièces distinctives
      const built = await page.evaluate(async () => {
        const out = {};
        for (const id of Object.keys(CharacterKit.KITS)) {
          const k = await CharacterKit.build(THREE, id, { withAnims: false });
          const names = new Set();
          const frozen = []; // maillage skinné dont le matériau ne l'est pas : figé en pose de repos (three r128)
          k.root.traverse(o => {
            names.add(o.name);
            if (o.isSkinnedMesh && [].concat(o.material).some(m => !m.skinning)) frozen.push(o.name);
          });
          out[id] = {
            frozen,
            h: k.height,
            robe: names.has('Robe'),
            staff: names.has('Staff'),
            tusk: names.has('Tusk'),
            ear: names.has('Ear'),
            beard: names.has('Hair_Beard')
          };
        }
        return out;
      });
      assert.equal(Object.keys(built).length, 35, '35 kits race+classe');
      for (const [id, b] of Object.entries(built)) {
        const [race, cls] = id.split('_');
        assert.ok(b.h > 1.4 && b.h < 2.3, `${id}: hauteur ${b.h}`);
        assert.equal(b.robe, ['arcanist', 'oracle', 'warlock', 'warden'].includes(cls), `${id}: robe`);
        assert.equal(b.staff, ['arcanist', 'oracle', 'warlock', 'warden'].includes(cls), `${id}: bâton`);
        assert.equal(b.tusk, race === 'orc', `${id}: défenses`);
        assert.equal(b.ear, race === 'orc' || race === 'elf', `${id}: oreilles`);
        assert.equal(b.beard, race === 'dwarf', `${id}: barbe`);
        assert.deepEqual(b.frozen, [], `${id}: pièces skinnées qui suivent l'animation`);
      }
      assert.deepEqual(errors, [], 'erreurs JS arène Humain Mage');
      await ctx.close();
    }

    // Nain qui marche : barbe, tresses, cheveux et yeux suivent la tête (demande du 04/11/2026 : « une partie de la
    // barbe reste figée ») ; mesure dans le repère de l'os Head, la cape (qui bouge) sert de témoin
    {
      const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
      const page = await ctx.newPage();
      await page.goto(url('index.html', '?autoplay=reaver&race=dwarf&gates=0&size=1'));
      await page.waitForFunction(() => HF.records.get(state?.player?.id)?.model, null, { timeout: 60000 });
      await page.evaluate(() => (window.__headDrift = { first: null, max: {} }));
      await page.keyboard.down('KeyW');
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(100);
        await page.evaluate(() => {
          const m = HF.records.get(state.player.id).model,
            D = window.__headDrift,
            v = new THREE.Vector3(),
            snap = {};
          let head = null,
            k = 0;
          m.traverse(o => o.isBone && o.name === 'Head' && (head = o));
          const inv = head.matrixWorld.clone().invert(),
            onHead = o => {
              for (let a = o.parent; a; a = a.parent) if (a === head) return true;
              return false;
            };
          m.traverse(o => {
            if (!o.isMesh || !o.visible || !(onHead(o) || /Hair|Beard|Eye|Cape/.test(o.name))) return;
            const pos = o.geometry.attributes.position,
              pts = [];
            for (let j = 0; j < pos.count; j += Math.max(1, Math.floor(pos.count / 30))) {
              v.fromBufferAttribute(pos, j);
              if (o.isSkinnedMesh) o.boneTransform(j, v);
              v.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
              pts.push(v.x, v.y, v.z);
            }
            snap[(o.name || 'pièce') + '#' + k++] = pts;
          });
          D.first ||= snap;
          for (const key in snap)
            D.max[key] = Math.max(D.max[key] || 0, ...snap[key].map((x, j) => Math.abs(x - D.first[key][j])));
        });
      }
      await page.keyboard.up('KeyW');
      const drift = await page.evaluate(() => window.__headDrift.max);
      assert.ok(
        Object.entries(drift).some(([k, d]) => k.startsWith('Cape') && d > 0.05),
        'témoin : la cape bouge par rapport à la tête'
      );
      const loose = Object.entries(drift).filter(([k, d]) => !k.startsWith('Cape') && d > 0.005);
      assert.deepEqual(loose, [], 'nain qui marche : toute la barbe suit la tête');
      await ctx.close();
    }

    // 3. Mobile paysage via mobile.html
    {
      const ctx = await browser.newContext({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2
      });
      const page = await ctx.newPage();
      const errors = watchErrors(page);
      await page.goto(url('mobile.html'));
      await page.waitForURL(/index\.html\?mobile=1/);
      await page.waitForTimeout(500);
      assert.equal(
        await page.evaluate(() => document.body.classList.contains('mobile-mode')),
        true,
        'mobile.html doit forcer le mode mobile'
      );
      // revue mobile du 04/11/2026 : bouton PLAY peint sans texte par-dessus ; ligne Mode / Difficulty dans le cadre,
      // aussi sur un très petit téléphone (568 × 320)
      const lobbyFits = () =>
        page.evaluate(() => {
          const m = document.querySelector('#overlay .modal').getBoundingClientRect(),
            k = [...document.querySelector('#overlay .lobbyOpts').children].map(c => c.getBoundingClientRect());
          return {
            playText: getComputedStyle(document.getElementById('playBtn')).fontSize,
            inside: k.every(r => r.left >= m.left && r.right <= m.right)
          };
        });
      assert.deepEqual(await lobbyFits(), { playText: '0px', inside: true }, 'lobby mobile 844 × 390');
      await page.setViewportSize({ width: 568, height: 320 });
      await page.waitForTimeout(300);
      assert.equal((await lobbyFits()).inside, true, 'lobby mobile 568 × 320 : options dans le cadre');
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(300);
      await page.click('#raceChoices button[data-r="human"]');
      await page.click('#classChoices button[data-c="sentinel"]');
      await page.click('#playBtn');
      await page.waitForTimeout(1200);
      const m = await page.evaluate(() => {
        const vis = id => {
          const e = document.getElementById(id);
          if (!e) return false;
          const cs = getComputedStyle(e),
            r = e.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        const c = document.getElementById('c').getBoundingClientRect();
        return {
          joystick: vis('mobileJoystick'),
          target: vis('mobileTargetBtn'),
          jump: vis('mobileJumpBtn'),
          timer: vis('timer'),
          score: vis('score'),
          canvasBottom: c.bottom,
          vh: innerHeight
        };
      });
      assert.ok(m.joystick, 'joystick visible');
      assert.ok(m.target, 'bouton CIBLE visible');
      assert.ok(m.jump, 'bouton SAUT visible');
      assert.ok(m.timer, 'timer visible');
      assert.ok(m.score, 'score visible');
      assert.ok(m.vh - m.canvasBottom < 4, `bande vide sous l'arène (${m.vh - m.canvasBottom}px)`);
      // bug du 04/11/2026 : le cadre de la barre de sorts recouvrait TARGET / JUMP, et la barre construite au lobby
      // (même classe) restait « barre du lobby » en jeu : aucun sort lancé au toucher
      await page.waitForFunction(
        () => getComputedStyle(document.getElementById('loadingScreen')).display === 'none',
        null,
        {
          timeout: 30000
        }
      );
      const center = sel =>
        page.evaluate(sel => {
          const r = document.querySelector(sel).getBoundingClientRect(),
            x = r.x + r.width / 2,
            y = r.y + r.height / 2;
          return { x, y, hit: !!document.elementFromPoint(x, y)?.closest(sel) };
        }, sel);
      for (const sel of ['#mobileTargetBtn', '#mobileJumpBtn', '.skill[data-slot="0"]'])
        assert.ok((await center(sel)).hit, `${sel} : touchable (rien par-dessus)`);
      await page.evaluate(() => {
        const f = tryPlayerSkill;
        window.TAPPED = [];
        tryPlayerSkill = i => (TAPPED.push(i), f(i));
      });
      const s0 = await center('.skill[data-slot="0"]');
      await page.touchscreen.tap(s0.x, s0.y);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => TAPPED.length), 1, 'toucher un sort le lance');
      const bg = await page.evaluate(() => {
        const cs = getComputedStyle(document.getElementById('bottom'));
        return cs.backgroundImage + ' ' + cs.backgroundColor;
      });
      assert.equal(bg, 'none rgba(0, 0, 0, 0)', `barre du bas mobile non transparente (${bg})`);
      assert.deepEqual(errors, [], 'erreurs JS mobile');
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log('OK - démarrage navigateur desktop + 7 classes + mobile paysage');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
