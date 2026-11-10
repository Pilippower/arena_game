'use strict';
// Aventure PVE en groupe en ligne (5 héros au plus : l'hôte et 4 amis). Même principe que l'arène (net/online.js) :
// l'hôte simule tout (monstres, dégâts, feux de camp, herse, victoire) et envoie l'état ; chaque ami se déplace en local
// dans le même monde (pveApplyWorld) et envoie sa position, ses sorts, sa cible et le levier de la porte.
// Ce fichier : composition du groupe au lancement (pveNetParty), données propres au PVE dans la composition envoyée
// (pveRosterUnit) et dans l'état (pveNetState, pveSnapFor : seulement les unités proches de chaque ami, le monde compte
// des dizaines de monstres), partie construite chez l'ami (pveGuestBuild, pveGuestSync), messages de l'hôte à l'ami
// (PVE_NET_MSG : annonces, fin d'aventure). Points d'accroche dans net/online.js (netOnData, netSendRoster,
// netHostUpdate, netGuestBuild, netGuestUpdate, netUnitToAI, netPartySync), inertes hors PVE.
const PVE_NET_RANGE = 120; // m : unités envoyées à un ami en deçà de son héros (au-delà, la brume les cache, PVE.drawRange)
// Amis du groupe pour pveStart, ou null (message au joueur) : l'hôte lance, chacun a choisi son héros, 5 au plus.
function pveNetParty() {
  if (NET.role !== 'host') {
    $('selectedClass').textContent = 'The party leader starts the adventure';
    return null;
  }
  const gs = [...NET.guests.values()];
  if (gs.length > PVE.maxHeroes - 1) {
    lobbyTab('party');
    netStatus(`PvE: ${PVE.maxHeroes} heroes at most — ${gs.length + 1 - PVE.maxHeroes} must leave the party.`);
    return null;
  }
  if (gs.some(g => !g.cls)) {
    lobbyTab('party');
    netStatus('Waiting for your friends to pick a class…');
    return null;
  }
  return gs.map(g => ({ cls: g.cls, race: g.race, name: g.name, gid: g.id }));
}
// Composition : où est chaque unité au départ (les monstres lointains ne sont pas envoyés ensuite) et ce qu'est un
// monstre (type, camp, taille, forme de bête).
function pveRosterUnit(u) {
  const r = { x: r2(u.x), z: r2(u.z), yaw: r2(u.yaw) };
  if (u.monster) Object.assign(r, { mob: u.monster.type, camp: u.monster.camp, sc: u.scale, form: u.form || null });
  return r;
}
// État envoyé à l'ami joué par `hero` : unités proches (héros toujours, pour les cadres du groupe), 0 pour les autres
// (l'ami garde leur dernier état connu).
function pveSnapFor(hero, list) {
  return list.map((s, i) => {
    const u = state.units[i];
    return u.team === 0 || (hero && Math.hypot(u.x - hero.x, u.z - hero.z) < PVE_NET_RANGE) ? s : 0;
  });
}
// Progression commune (herse, dernier feu, chutes) et éliminations de l'ami (cadre du bas).
function pveNetState(hero) {
  const R = state.pve;
  return { go: R.gateOpen, cp: R.checkpoint, d: R.deaths, k: statOf(hero)?.kills || 0 };
}
// ---------- chez l'ami ----------
// Partie construite d'après la composition de l'hôte (même monde, mêmes unités au même endroit).
function pveGuestBuild(m) {
  pveApplyWorld();
  const me = m.units[m.me];
  state = {
    pve: { t0: now(), deaths: 0, checkpoint: 0, gateOpen: false, won: false, endT: null, party: [] },
    pcls: me.cls,
    prace: me.race,
    scoreA: 0,
    scoreB: 0,
    round: 1,
    stats: [],
    map: 'pve',
    size: 1,
    t: 1e9,
    prep: 0,
    elapsed: 0,
    dampening: 0,
    ended: false,
    keys: {},
    fx: [],
    floaters: [],
    shrines: [],
    splash: 1.8,
    uiTick: 0,
    online: true
  };
  state.units = m.units.map((r, i) => {
    const u = makeUnit(r.cls, 0, 0, r.team, r.name, false, r.race, i);
    u.slotIndex = i;
    if (r.mob) {
      if (r.form) setForm(u, r.form);
      u.monster = { type: r.mob, camp: r.camp, boss: !!PVE_WORLD.mobs[r.mob].boss };
      u.scale = r.sc || 1;
    }
    return pvePlace(u, r.x, r.z, r.yaw);
  });
  state.player = state.units[m.me];
  NET.snap = null;
  NET.lastEnded = false;
  hideResults();
  $('overlay').style.display = 'none';
  camera.yaw = state.player.yaw;
  camera.pitch = 0.2;
  pveUiStart();
  showSplash(PVE_WORLD.name);
  if (HF.enabled) hfSyncUnits();
  if (typeof musicStart === 'function') musicStart();
  updateUI();
  prepareMatch();
}
// État de l'hôte reçu : la herse s'ouvre aussi pour la collision de l'ami (il se déplace en local).
function pveGuestSync(pv) {
  const R = state.pve;
  if (pv.go !== R.gateOpen) pveSetGate(pv.go);
  R.checkpoint = pv.cp;
  R.deaths = pv.d;
  (state.stats[state.player.slotIndex] ||= { damage: 0, healing: 0, kills: 0 }).kills = pv.k;
}
// Messages de l'hôte propres au PVE (netOnData, chez l'ami).
const PVE_NET_MSG = {
  say(m) {
    if (!state?.pve) return;
    showSplash(m.text);
    if (m.fanfare) SFX.victory(false);
  },
  pveEnd(m) {
    if (state?.pve) pveShowEnd(m.sum);
  }
};
