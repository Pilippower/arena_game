'use strict';
// Monde de combat pour les tests unitaires et les simulations (tools/duel.js) : le vrai code du jeu (données, formes,
// combat, sorts, IA, règles, match, pas de simulation) chargé dans un contexte vm, sur une arène vide, sans DOM,
// three.js, son ni réseau (stubs). Horloge contrôlée : ctx.clock (secondes).
const { sandbox } = require('./sources.js');

const GAME_FILES = [
  'src/data/maps.js',
  'src/game/forms.js',
  'src/game/combat.js',
  'src/game/spells.js',
  'src/game/ai.js',
  'src/game/rules.js',
  'src/game/match.js',
  'src/game/sim.js'
];

function combatWorld() {
  const views = [];
  const sounds = []; // bruitages demandés (SFX.<nom>, arguments), pour vérifier les cris et les nappes d'incantation
  const S = sandbox({
    Math: Object.create(Math), // propre au monde : un test peut fixer Math.random
    window: {},
    document: { addEventListener() {} },
    location: { search: '' },
    URLSearchParams,
    $: () => ({ classList: { add() {}, remove() {} } }),
    now: () => S.ctx.clock,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    updateUI() {},
    spellSfx() {},
    spellSfxKind() {},
    showSplash() {},
    setTimeout() {},
    clearTimeout() {},
    playerMove() {},
    viewBehind: u => views.push(u), // caméra replacée derrière le joueur (player.js)
    SFX: new Proxy(
      {},
      {
        get:
          (o, name) =>
          (...args) =>
            sounds.push({ name, unit: args[0], args })
      }
    )
  });
  S.ctx.clock = 100;
  S.load('src/data/classes.js');
  S.ctx.arena = {};
  S.ctx.HEALTH_SPOTS = [];
  for (const f of GAME_FILES) S.load(f);
  S.ctx.applyMap('castle');
  S.ctx.arena.pillars = []; // arène vide : les règles, pas la géométrie
  S.ctx.state = {
    units: [],
    floaters: [],
    fx: [],
    dampening: 0,
    elapsed: 0,
    stats: [],
    t: 180,
    uiTick: 1,
    round: 1,
    scoreA: 0,
    scoreB: 0
  };
  const unit = (cls, x, z, team, extra = {}) => {
    const u = Object.assign(S.ctx.makeUnit(cls, x, z, team, cls), { slotIndex: S.ctx.state.units.length }, extra);
    S.ctx.state.units.push(u);
    return u;
  };
  return { ctx: S.ctx, unit, sounds, views, load: S.load }; // load : fichier de plus (ex. le mode PVE)
}
// emplacement d'un sort sur la barre de base d'une classe
const spell = (ctx, cls, n) => ctx.CLASS[cls].skills.findIndex(s => s.n === n);
// avance la simulation de `sec` secondes (horloge comprise) ; s'arrête à la fin de la manche
function run(ctx, sec, dt = 1 / 120) {
  for (let k = 0; k < Math.round(sec / dt) && !ctx.state.ended; k++) {
    ctx.clock += dt;
    ctx.update(dt);
  }
}
// Monde PVE (src/pve/*.js, + files) chargé dans le monde de combat, interface et chargement neutralisés, hasard fixé ;
// partie pas encore lancée. stubs(ctx) : fonctions de l'interface ou du réseau remplacées (avant le chargement).
const PVE_FILES = ['src/pve/castle.js', 'src/pve/world.js', 'src/pve/nav.js', 'src/pve/pve.js'];
function pveCombatWorld(stubs = () => ({}), files = []) {
  const w = combatWorld(),
    { ctx } = w;
  Object.assign(ctx, {
    camera: { yaw: 0, pitch: 0 },
    HF: { enabled: false },
    prepareMatch() {},
    pveUiStart() {},
    pveUiStop() {},
    hideResults() {},
    playGameMusic() {},
    pveShowEnd: () => (ctx.endShown = true),
    ...stubs(ctx)
  });
  for (const f of [...PVE_FILES, ...files]) w.load(f);
  ctx.Math.random = () => 0.5;
  return w;
}
module.exports = { combatWorld, pveCombatWorld, spell, run };
