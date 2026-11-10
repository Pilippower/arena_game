'use strict';
// Écrans de chargement : le travail lourd (compilation des shaders WebGL, assemblage des personnages, décor de la
// carte, portraits, effets de sorts) est fait derrière une barre de progression, jamais pendant que le joueur
// interagit. WebGL compile de façon synchrone : sans cela, l'image gelait au choix d'une classe et pendant les
// premières secondes de jeu.
// - prepareMatch() : à chaque manche (appelé par resetRound / l'invité en ligne), chrono et IA arrêtés
//   (state.loading) ; l'écran n'apparaît que si la préparation dépasse 150 ms (manches suivantes : en cache).
// - warmPreview() : à l'ouverture, chaque classe passe une fois dans la prévisualisation du lobby.
const LOADING = { el: null, shown: false, token: 0 };
const LOADING_MIN_MS = 3000; // durée minimale de l'écran au début d'un match (sinon il clignote)
// ms : l'hôte attend au plus ce temps que ses amis aient chargé (10/11/2026 : 30 s ne suffisaient pas toujours à
// charger l'aventure PVE sur un PC plus lent, qui commençait alors en retard)
const NET_READY_WAIT = 90000;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function loadingShow(title) {
  const el = (LOADING.el = $('loadingScreen'));
  el.querySelector('.ldTitle').textContent = title;
  el.style.display = 'flex';
  LOADING.shown = true;
}
function loadingProgress(k, text) {
  if (!LOADING.el) LOADING.el = $('loadingScreen');
  LOADING.el.querySelector('.ldBar i').style.width = `${Math.round(Math.min(1, k) * 100)}%`;
  if (text) LOADING.el.querySelector('.ldText').textContent = text;
}
// match quitté pendant sa préparation (retour au lobby ; en ligne, l'hôte qui revient au lobby pendant que l'ami charge
// encore) : préparation abandonnée et écran retiré, sinon il restait affiché par-dessus le lobby (04/11/2026)
function loadingCancel() {
  LOADING.token++;
  loadingHide();
}
function loadingHide() {
  if (LOADING.el) LOADING.el.style.display = 'none';
  LOADING.shown = false;
}
// Attend que l'image soit stable : 3 images de suite sous 40 ms (les dernières compilations ont eu lieu).
async function waitStableFrames(maxMs = 4000) {
  const t0 = performance.now();
  let last = t0,
    calm = 0;
  while (calm < 3 && performance.now() - t0 < maxMs) {
    await nextFrame();
    const t = performance.now();
    calm = t - last < 40 ? calm + 1 : 0;
    last = t;
  }
}
// Effets de sorts : un exemplaire de chaque type, loin sous le sol, pour compiler leurs shaders à l'avance.
const FX_WARM = [
  'arcaneProjectile',
  'burst',
  'nova',
  'frostAura',
  'holyBurst',
  'aura',
  'ring',
  'castArcane',
  'healBeam',
  'shield',
  'cloak',
  'blinkBurst',
  'trail',
  'chain',
  'chargeStart',
  'chargeImpact',
  'silence',
  'fear',
  'stun',
  'roots',
  'snare',
  'starfall',
  'slash'
];
function warmSpellFx() {
  if (!window.SpellFX?.ok) return;
  for (const type of FX_WARM)
    try {
      SpellFX.spawn({
        type,
        x: 0,
        y: -80,
        z: 0,
        color: [1, 1, 1],
        life: 0.05,
        max: 0.05,
        size: 0.4,
        to: [0, -80, 1],
        from: [0, -80, 0]
      });
    } catch (_) {}
}
async function prepareMatch() {
  if (!state?.units) return;
  const token = ++LOADING.token,
    S = state,
    first = S.round === 1;
  S.loading = true;
  if (first) perfReset(); // nouvelle partie : pleine résolution (core/perf.js)
  if (first && MUSIC.ctx) sfxSamplesLoad(MUSIC.ctx); // bruitages enregistrés décodés avant le premier coup
  // début du match : écran affiché tout de suite (avant la moindre image du jeu) et gardé au moins 3 s ;
  // manche suivante (tout est en cache) : écran seulement si la préparation dépasse 150 ms
  const tStart = performance.now();
  if (first) loadingShow(S.pve ? 'Entering the Mistvale' : 'Entering the arena');
  const showT = first ? 0 : setTimeout(() => token === LOADING.token && loadingShow(`Round ${S.round}`), 150);
  const stale = () => token !== LOADING.token || state !== S;
  loadingProgress(0.05, S.pve ? 'Building the world' : 'Building the arena');
  await nextFrame();
  if (ENV.pendingMap && ENV.ok && window.ArenaEnv?.setMap) {
    ArenaEnv.setMap(ENV.pendingMap, arena);
    ENV.pendingMap = null;
  }
  await nextFrame();
  if (stale()) return;
  // personnages : chargés et assemblés (ou en échec : modèle de secours)
  const t0 = performance.now();
  for (;;) {
    const recs = S.units.map(u => HF.records.get(u.id)),
      done = !HF.enabled ? S.units.length : recs.filter(r => r?.loaded || r?.failed).length;
    loadingProgress(0.1 + 0.55 * (done / S.units.length), `Summoning heroes (${done}/${S.units.length})`);
    if (done >= S.units.length || performance.now() - t0 > 60000) break;
    await sleep(80);
    if (stale()) return;
  }
  loadingProgress(0.7, 'Preparing heroes');
  await nextFrame();
  if (HF.enabled)
    try {
      // tout ce qui peut apparaître en combat est compilé maintenant : formes du druide, mouton de la Métamorphose,
      // paupières de l'étourdissement
      const shown = [];
      for (const u of S.units) {
        const rec = HF.records.get(u.id);
        if (!rec?.group) continue;
        if (u.cls === 'warden') {
          rec.beasts = rec.beasts || {};
          for (const k of ['cat', 'bear']) if (!rec.beasts[k]) rec.group.add((rec.beasts[k] = hfMakeBeast(k)));
          shown.push(...Object.values(rec.beasts));
        }
        if (!rec.sheep) rec.group.add((rec.sheep = hfMakeSheep()));
        shown.push(rec.sheep);
        rec.model?.traverse(o => o.name === 'Eyelid' && shown.push(o)); // yeux fermés de l'étourdissement
      }
      const bubble = window.ShieldAura?.warm(); // bulle de bouclier (render/shield_aura.js)
      if (bubble) shown.push(bubble);
      const vis = shown.map(o => o.visible);
      shown.forEach(o => (o.visible = true));
      HF.renderer.compile(HF.scene, HF.camera);
      shown.forEach((o, i) => (o.visible = vis[i]));
    } catch (e) {
      console.warn('Préparation des shaders incomplète', e);
    }
  loadingProgress(0.8, 'Preparing spells');
  await nextFrame();
  warmSpellFx();
  // portraits des cadres (un par image) et dernières compilations : on attend une image stable
  loadingProgress(0.9, 'Final touches');
  const t1 = performance.now();
  while (
    HF.enabled &&
    S.units.some(u => HF.records.get(u.id)?.loaded && !HF.records.get(u.id).portrait) &&
    performance.now() - t1 < 3000
  )
    await nextFrame();
  await waitStableFrames();
  if (stale()) return;
  // en ligne : l'hôte attend que ses amis soient prêts (NET_READY_WAIT au plus) ; l'invité le signale
  if (window.NET?.role === 'guest') netSend({ t: 'ready', round: S.round });
  if (window.NET?.role === 'host' && S.online) {
    loadingProgress(0.97, 'Waiting for your friends…');
    const t2 = performance.now();
    while (
      [...NET.guests.values()].some(g => g.ready !== S.round && g.conn?.open) &&
      performance.now() - t2 < NET_READY_WAIT
    ) {
      await sleep(80);
      if (stale()) return;
    }
  }
  clearTimeout(showT);
  loadingProgress(1, 'Ready');
  while (first && performance.now() - tStart < LOADING_MIN_MS) {
    await sleep(50);
    if (stale()) return;
  }
  S.loading = false;
  loadingHide();
  showSplash(`Round ${S.round}`);
}
// Prévisualisation du lobby : chaque classe affichée une fois derrière l'écran de chargement (ses shaders sont alors
// compilés) ; ensuite les choix de race et de classe ne gèlent plus la page.
async function warmPreview() {
  if (!window.THREE || !previewEnsure()) return;
  loadingShow('Arena Ascendant');
  const classes = Object.keys(CLASS);
  for (let i = 0; i < classes.length; i++) {
    loadingProgress((i + 0.5) / classes.length, 'Preparing heroes');
    updateSelectPreview3D('human', classes[i]);
    const t0 = performance.now();
    while (!PREVIEW.loaded && performance.now() - t0 < 8000) await sleep(50);
    await nextFrame();
    await nextFrame();
  }
  loadingProgress(1, '');
  previewClearGroup();
  updateSelectPreview(NET_CHOICE.race, NET_CHOICE.cls); // la sélection du joueur
  loadingHide();
}
