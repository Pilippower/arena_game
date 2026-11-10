'use strict';
// Unités et manches : création d'une unité (makeUnit), composition des équipes selon le format 1v1 / 2v2 / 3v3
// (TEAM_SIZE, teamsFor ; en ligne netTeamsFor, netAiFill), préparation dans les salles de départ (GATE_TIME,
// gatesOpen) et mise en place d'une manche (resetRound). Les règles de combat : game/combat.js, chargé après.
function makeUnit(cls, x, z, team, name, ai = false, race = null, slot = 0) {
  const c = CLASS[cls];
  return {
    id: Math.random(),
    cls,
    name,
    team,
    ai,
    x,
    z,
    y: 0,
    vy: 0,
    grounded: true,
    yaw: team ? Math.PI : 0,
    hp: c.hp,
    maxHp: c.hp,
    res: 100,
    maxRes: 100,
    alive: true,
    cd: [0, 0, 0, 0, 0, 0],
    gcd: 0,
    trinket: 0,
    target: null,
    stun: 0,
    root: 0,
    silence: 0,
    shield: 0,
    antiheal: 0,
    burst: 0,
    speedBuff: 0,
    cast: null,
    flash: 0,
    moving: false,
    movePhase: 0,
    action: 0,
    actionType: '',
    queuedSkill: null,
    mobility: null,
    slow: 0,
    slowPct: 0,
    fear: 0,
    fearOwner: null,
    fearSourceX: x,
    fearSourceZ: z,
    fearPhase: Math.random() * 6.28,
    prevX: x,
    prevZ: z,
    prevYaw: team ? Math.PI : 0,
    visualSnap: false,
    stepCd: 0,
    race: race || raceForClass(cls, team, slot),
    dr: { stun: 1, root: 1, silence: 1, fear: 1, poly: 1 },
    drT: { stun: 0, root: 0, silence: 0, fear: 0, poly: 0 }
  };
}
function compForPlayer(cls) {
  if (cls === 'oracle') return ['sentinel', 'shade'];
  if (cls === 'sentinel') return ['oracle', 'arcanist'];
  if (cls === 'warlock') return ['oracle', 'sentinel'];
  return ['oracle', 'sentinel'];
}
// Format du match choisi au lobby : 1v1, 2v2 ou 3v3 (TEAM_SIZE joueurs par équipe, 3 par défaut).
let TEAM_SIZE = (() => {
  try {
    const n = +(new URLSearchParams(location.search).get('size') || localStorage.getItem('arenaTeamSize'));
    return n >= 1 && n <= 3 ? n : 3;
  } catch (_) {
    return 3;
  }
})();
// Équipes selon le format : en 2v2 un soigneur et un combattant de chaque côté ; en 1v1 un adversaire
// qui peut mourir (pas de soigneur seul en face).
// En ligne : amis placés par l'hôte, places libres complétées comme hors ligne (soigneur/combattant, Kargan…).
// En ligne : IA des places libres de chaque équipe ('ally' = celle de l'hôte, 'enemy' = en face) d'après le nombre
// d'amis de chaque côté. Par défaut la composition hors ligne ; l'hôte choisit race et classe place par place (picks,
// onglet Multiplayer) : l'onglet affiche exactement ce qui sera joué.
function netAiFill(pcls, size, nAllies, nFoes, picks = {}) {
  const base = teamsFor(pcls, 3),
    defA = base.allies.map((c, i) => [c, ['Lyra', 'Torren'][i], i ? 'dwarf' : raceForClass(c, 0, 1)]),
    fill = (team, def, n) =>
      def.slice(0, Math.max(0, n)).map((d, k) => {
        const p = picks[team]?.[k];
        return CLASS[p?.cls] && RACE[p.race] ? [p.cls, d[1], p.race] : d; // choix illisible : défaut
      });
  return { ally: fill('ally', defA, size - 1 - nAllies), enemy: fill('enemy', base.foes, size - nFoes) };
}
function netTeamsFor(on, pcls, size) {
  const allies = on.allies.map(g => [g.cls, g.name, g.race, g.gid]),
    foes = on.foes.map(g => [g.cls, g.name, g.race, g.gid]),
    ai = netAiFill(pcls, size, allies.length, foes.length, on.ai);
  return { allies: [...allies, ...ai.ally].slice(0, size - 1), foes: [...foes, ...ai.enemy].slice(0, size) };
}
function teamsFor(pcls, size) {
  const allies = compForPlayer(pcls),
    foes = [
      ['reaver', 'Kargan', 'orc'],
      ['arcanist', 'Nyx', 'elf'],
      ['oracle', 'Seris', 'dwarf']
    ];
  if (size === 3) return { allies, foes };
  if (size === 2) return { allies: allies.slice(0, 1), foes: [foes[0], foes[2]] };
  return { allies: [], foes: [pcls === 'reaver' ? ['sentinel', 'Kargan', 'orc'] : foes[0]] };
}
// Préparation : chaque équipe attend dans sa salle de départ (data/maps.js), porte fermée, pendant GATE_TIME s ; à 0,
// les portes s'ouvrent et le combat commence (chrono de manche et dampening démarrent alors, game/sim.js).
// ?gates=<s> (tests, captures) raccourcit l'attente.
const GATE_TIME = (() => {
  try {
    const v = new URLSearchParams(location.search).get('gates');
    return v != null && v !== '' && +v >= 0 ? +v : 20;
  } catch (_) {
    return 20;
  }
})();
const gatesOpen = () => !(state?.prep > 0);
function resetRound() {
  const o = state || {},
    size = o.size || TEAM_SIZE,
    T = o.online ? netTeamsFor(o.online, o.pcls || 'sentinel', size) : teamsFor(o.pcls || 'sentinel', size),
    allies = T.allies;
  state = {
    pcls: o.pcls || 'sentinel',
    prace: o.prace || raceForClass(o.pcls || 'sentinel'),
    scoreA: o.scoreA || 0,
    scoreB: o.scoreB || 0,
    round: (o.round || 0) + 1,
    stats: o.stats && o.round ? o.stats : [],
    map: o.map,
    online: o.online || null, // en ligne : amis avec / contre l'hôte (src/net/online.js)
    size,
    t: 150,
    prep: GATE_TIME,
    elapsed: 0,
    dampening: 0,
    ended: false,
    keys: {},
    fx: [],
    floaters: [],
    shrines: HEALTH_SPOTS.map(p => ({ x: p.x, z: p.z, active: true, respawn: 0 })),
    splash: 1.8,
    uiTick: 0
  };
  const mates = o.online
    ? allies
    : [
        [allies[0], 'Lyra', raceForClass(allies[0], 0, 1)],
        [allies[1], 'Torren', 'dwarf']
      ].slice(0, allies.length);
  // chaque équipe dans sa salle de départ, face à la porte
  const at = (u, team, i) => {
    const p = spawnPoint(team, i, size);
    return Object.assign(u, { x: p.x, z: p.z, prevX: p.x, prevZ: p.z, yaw: p.yaw, prevYaw: p.yaw });
  };
  state.units = [
    at(makeUnit(state.pcls, 0, 0, 0, 'You', false, state.prace, 0), 0, 0),
    ...mates.map(([c, n, r, gid], i) =>
      Object.assign(at(makeUnit(c, 0, 0, 0, n, true, r, i + 1), 0, i + 1), { remoteId: gid ?? null })
    ),
    ...T.foes.map(([c, n, r, gid], i) =>
      Object.assign(at(makeUnit(c, 0, 0, 1, n, true, r, i), 1, i), { remoteId: gid ?? null })
    )
  ];
  state.units.forEach((u, i) => (u.slotIndex = i));
  // en ligne : chaque ami pilote son personnage (pas d'IA)
  for (const u of state.units)
    if (u.remoteId != null) {
      u.remote = true;
      u.ai = false;
    }
  state.player = state.units[0];
  setTarget(state.player, state.units[size]);
  applyDifficulty();
  camera.yaw = state.player.yaw; // face à la porte de sa salle
  camera.pitch = 0.2;
  showSplash(`Round ${state.round}`);
  if (HF.enabled) hfSyncUnits();
  updateUI();
  if (state.online) netSendRoster();
  prepareMatch(); // décor, personnages, shaders… derrière l'écran de chargement (src/core/loading.js)
}
