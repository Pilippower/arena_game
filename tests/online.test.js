'use strict';
// Tests unitaires du groupe en ligne (src/net/online.js + onglet Multiplayer src/ui/party.js) : le vrai code dans un contexte
// vm, connexions PeerJS remplacées par des fausses (messages enregistrés). Le réseau réel (deux navigateurs, Internet)
// reste hors de npm test.
const assert = require('node:assert/strict');
const { sandbox } = require('./sources.js');

// fausse connexion : messages envoyés, gestionnaires d'événements, fermeture
function fakeConn() {
  const on = {},
    sent = [];
  return { open: true, sent, on: (k, f) => (on[k] = f), send: m => sent.push(m), close: () => on.close?.(), fire: on };
}
function netWorld({ stored = {}, role = 'host' } = {}) {
  const els = new Map(),
    el = id =>
      els.get(id) ||
      (els.set(id, {
        textContent: '',
        innerHTML: '',
        value: '',
        classList: { toggle() {} },
        querySelectorAll: () => []
      }),
      els.get(id)),
    storage = { ...stored },
    calls = { leaveMatch: 0, errors: [] };
  const S = sandbox({
    $: el,
    document: { querySelector: () => null, createElement: () => ({}), head: { appendChild() {} } },
    window: {},
    localStorage: {
      getItem: k => storage[k] ?? null,
      setItem: (k, v) => (storage[k] = v),
      removeItem: k => delete storage[k]
    },
    setTimeout: f => f(),
    navigator: {},
    TEAM_SIZE: 3,
    MAP_ID: 'bridge',
    DIFFICULTY: 'hard',
    MAPS: { castle: { name: 'The Castle' }, bridge: { name: 'The Bridge' } },
    MAP_ART: {},
    CLASS: Object.fromEntries(
      [
        ['sentinel', 'Warrior'],
        ['arcanist', 'Mage'],
        ['oracle', 'Priest'],
        ['shade', 'Rogue'],
        ['warlock', 'Warlock'],
        ['reaver', 'Death Knight']
      ].map(([k, name]) => [k, { name }])
    ),
    RACE: Object.fromEntries(
      ['human', 'orc', 'elf', 'dwarf', 'undead'].map(k => [k, { name: k[0].toUpperCase() + k.slice(1) }])
    ),
    AI_PROFILES: { medium: { m: 1 } },
    state: null,
    fx() {},
    addFloat() {},
    SFX: {},
    showError: t => calls.errors.push(t),
    leaveMatch: () => calls.leaveMatch++,
    partyRender() {}
  });
  // compositions : le vrai code (IA des places libres)
  S.fn('src/data/classes.js', 'raceForClass');
  for (const f of ['compForPlayer', 'teamsFor', 'netAiFill', 'netTeamsFor']) S.fn('src/game/combat.js', f);
  S.load('src/net/online.js');
  S.ctx.NET.role = role;
  return { ...S, storage, calls, els: el };
}
// hôte : un ami se connecte (connexion + message « hello »)
function join(w, name, cls = 'warlock', race = 'orc') {
  const c = fakeConn();
  w.ctx.netGuestJoined(c);
  const g = [...w.ctx.NET.guests.values()].at(-1);
  c.fire.data({ t: 'hello', name, cls, race });
  return { c, g };
}
const lastParty = c => c.sent.filter(m => m.t === 'party').at(-1);

// ---------- groupe de l'hôte : membres, équipes, places ----------
{
  const w = netWorld();
  w.ctx.NET.code = 'ABCDE';
  const a = join(w, 'Lyra'),
    b = join(w, 'Torren', 'arcanist', 'human');
  // chaque ami reçoit le groupe : l'hôte d'abord, les mêmes équipes chez tous, son propre id
  const p = lastParty(b.c);
  assert.equal(p.code, 'ABCDE', 'code du groupe envoyé');
  assert.equal(p.size, 3, 'mode du lobby de l’hôte');
  assert.equal(p.map + ' ' + p.diff, 'bridge hard', 'arène et difficulté de l’hôte envoyées aux amis');
  assert.equal(p.me, b.g.id, 'chacun sait qui il est');
  assert.equal(p.members.map(m => m.name).join(), 'Host,Lyra,Torren', 'hôte puis amis');
  assert.equal(p.members[2].cls, 'arcanist', 'classe choisie visible');
  assert.equal(lastParty(a.c).members.length, 3, 'le premier ami voit aussi le second');
  // nouveaux amis en face par défaut ; changer de côté, refusé si l'équipe est pleine (3v3 : 2 alliés max)
  assert.equal(a.g.team, 'enemy', 'nouvel ami : en face');
  assert.ok(w.ctx.netMoveGuest(a.g.id, 'ally') && w.ctx.netMoveGuest(b.g.id, 'ally'), 'deux alliés');
  assert.equal(lastParty(a.c).members.find(m => m.name === 'Torren').team, 'ally', 'changement envoyé à tous');
  const c3 = join(w, 'Seris');
  assert.ok(!w.ctx.netMoveGuest(c3.g.id, 'ally'), '3v3 : pas de troisième allié');
  assert.match(w.els('netStatus').textContent, /No free slot in your team/, 'message : équipe pleine');
  // exclure : l'ami est prévenu, retiré du groupe, les autres le voient partir
  w.ctx.netKick(c3.g.id);
  assert.equal(c3.c.sent.at(-1).t, 'kicked', 'ami exclu prévenu');
  assert.ok(!w.ctx.NET.guests.has(c3.g.id), 'ami exclu retiré');
  assert.equal(lastParty(a.c).members.length, 3, 'groupe mis à jour');
}

// ---------- Auto-Balance : amis répartis au plus près de l'égalité, hôte compris ----------
{
  const w = netWorld(),
    side = () => {
      const gs = [...w.ctx.NET.guests.values()];
      return gs.filter(g => g.team === 'ally').length + 1 + ' vs ' + gs.filter(g => g.team === 'enemy').length;
    };
  const a = join(w, 'Lyra');
  w.ctx.netAutoBalance();
  assert.equal(side(), '1 vs 1', '1 ami : en face');
  for (const n of ['Torren', 'Seris', 'Nyx']) join(w, n);
  for (let i = 0; i < 5; i++) {
    w.ctx.netAutoBalance();
    assert.equal(side(), '3 vs 2', '3v3, 4 amis : 3 contre 2 (hôte compris)');
  }
  join(w, 'Kargan');
  w.ctx.netAutoBalance();
  assert.equal(side(), '3 vs 3', '5 amis : 3 contre 3');
  w.ctx.TEAM_SIZE = 2;
  w.ctx.netAutoBalance();
  assert.equal(side(), '2 vs 4', '2v2 : jamais plus d’alliés que de places (les amis en trop restent en face)');
  assert.equal(lastParty(a.c).members.filter(m => m.team === 'ally').length, 2, 'équipes envoyées à tous');
}

// ---------- IA des places libres : race et classe choisies par l'hôte ----------
{
  const w = netWorld();
  w.ctx.NET_CHOICE = { race: 'human', cls: 'sentinel' };
  const a = join(w, 'Lyra', 'warlock', 'orc');
  const names = T => [...T.allies, ...T.foes].map(([c, , r]) => r + ' ' + c).join(', ');
  // sans choix : la composition hors ligne (inchangée)
  assert.equal(
    names(w.ctx.netTeamsFor(w.ctx.netOnlineTeams(), 'sentinel', 3)),
    'human oracle, dwarf arcanist, orc warlock, orc reaver, elf arcanist',
    'IA par défaut : composition hors ligne'
  );
  assert.equal(
    lastParty(a.c)
      .ai.enemy.map(x => x.race + ' ' + x.cls)
      .join(),
    'orc reaver,elf arcanist',
    'amis : IA affichées = IA jouées'
  );
  // l'hôte choisit : 2e IA en face = nain démoniste ; 1re alliée = mort-vivant voleur
  w.ctx.netSetAI('enemy', 1, 'warlock', 'dwarf');
  w.ctx.netSetAI('ally', 0, 'shade', 'undead');
  assert.equal(
    names(w.ctx.netTeamsFor(w.ctx.netOnlineTeams(), 'sentinel', 3)),
    'undead shade, dwarf arcanist, orc warlock, orc reaver, dwarf warlock',
    'IA choisies par l’hôte jouées en match'
  );
  assert.equal(lastParty(a.c).ai.ally[0].cls, 'shade', 'choix envoyé aux amis');
  w.ctx.netSetAI('enemy', 0, 'nope', 'orc');
  assert.equal(lastParty(a.c).ai.enemy[0].cls, 'reaver', 'classe inconnue refusée');
  // gardés dans le navigateur ; un choix illisible revient à l'IA par défaut
  const w2 = netWorld({ stored: { arenaNetAI: w.storage.arenaNetAI } });
  w2.ctx.NET_CHOICE = { race: 'human', cls: 'sentinel' };
  assert.equal(w2.ctx.netAiSlots().enemy[1].race, 'dwarf', 'choix des IA gardés d’une fois sur l’autre');
  const w3 = netWorld({ stored: { arenaNetAI: '{"ally":[{"cls":"x","race":"y"}]}' } });
  w3.ctx.NET_CHOICE = { race: 'human', cls: 'sentinel' };
  assert.equal(w3.ctx.netAiSlots().ally[0].cls, 'oracle', 'choix illisible : IA par défaut');
}

// ---------- le groupe survit au match ----------
{
  const w = netWorld();
  const a = join(w, 'Lyra');
  const u = { remoteId: a.g.id, remote: true, ai: false };
  w.ctx.state = { units: [u] };
  // un ami quitte le match : son personnage passe à l'IA, il reste dans le groupe
  a.c.fire.data({ t: 'leftMatch' });
  assert.ok(u.ai && !u.remote, 'personnage de l’ami : joué par l’IA');
  assert.ok(w.ctx.NET.guests.has(a.g.id), 'l’ami reste dans le groupe');
  // l'hôte revient au lobby : tout le groupe revient avec lui, connexions gardées
  w.ctx.netLeaveMatch();
  assert.equal(a.c.sent.at(-1).t, 'lobby', 'hôte : retour au lobby pour tous');
  assert.ok(a.c.open && w.ctx.NET.role === 'host', 'groupe toujours formé');
  // ami : le message « lobby » le ramène au lobby ; un ami qui part du match prévient l'hôte, sans quitter le groupe
  const gw = netWorld({ role: 'guest' }),
    hc = fakeConn();
  gw.ctx.NET.conn = hc;
  gw.ctx.state = { units: [{}] };
  gw.ctx.netOnData({ t: 'lobby' });
  assert.equal(gw.calls.leaveMatch, 1, 'ami : retour au lobby avec l’hôte');
  gw.ctx.netLeaveMatch();
  assert.equal(hc.sent.at(-1).t, 'leftMatch', 'ami : quitte le match, pas le groupe');
  assert.equal(gw.ctx.NET.role, 'guest', 'ami : toujours dans le groupe');
  gw.ctx.netOnData({ t: 'party', code: 'ABCDE', size: 2, me: 1, members: [] });
  assert.equal(gw.ctx.NET.party.code, 'ABCDE', 'ami : groupe reçu');
  // exclu : hors ligne, prévenu
  gw.ctx.state = null;
  gw.ctx.netOnData({ t: 'kicked' });
  assert.equal(gw.ctx.NET.role, null, 'ami exclu : hors du groupe');
  assert.match(gw.els('netStatus').textContent, /removed from the party/, 'ami exclu : message');
}

// ---------- retour au lobby pendant le chargement du match : l'écran de chargement disparaît ----------
{
  const el = id => (el[id] ||= { style: { display: 'flex' } });
  const S = sandbox({
    $: el,
    window: { NET: { role: 'guest' } },
    state: { units: [] },
    netLeaveMatch() {},
    hideResults() {},
    chooseClass() {}
  });
  S.fn('src/core/loading.js', 'loadingHide');
  S.fn('src/core/loading.js', 'loadingCancel');
  S.ctx.LOADING = { el: el('loadingScreen'), token: 4 };
  S.fn('src/game/match.js', 'leaveMatch');
  S.ctx.leaveMatch();
  assert.equal(el('loadingScreen').style.display, 'none', 'écran de chargement retiré');
  assert.equal(S.ctx.LOADING.token, 5, 'préparation du match abandonnée');
}

// ---------- même code d'une fois sur l'autre ----------
{
  const ids = [];
  const w = netWorld({ role: null, stored: { arenaNetCode: 'QWERT' } });
  w.ctx.window.Peer = true;
  w.ctx.Peer = function (id) {
    ids.push(id);
    this.handlers = {};
    this.on = (k, f) => (this.handlers[k] = f);
    this.destroy = () => {};
    w.ctx.lastPeer = this;
  };
  w.ctx.netHost().then(async () => {
    assert.equal(ids[0], 'arena-ascendant-QWERT', 'hôte : code gardé dans le navigateur');
    // code encore pris par une ancienne page : un nouveau code, gardé à son tour
    w.ctx.lastPeer.handlers.error({ type: 'unavailable-id' });
    await new Promise(r => setImmediate(r));
    assert.notEqual(ids[1], ids[0], 'code pris : nouveau code');
    w.ctx.lastPeer.handlers.open();
    assert.equal(w.storage.arenaNetCode, ids[1].slice('arena-ascendant-'.length), 'nouveau code gardé');
    partyTests();
  });
}

// ---------- onglet Multiplayer : affichage ----------
function partyTests() {
  const w = netWorld();
  const box = w.els('partyBox');
  w.ctx.partyRender = undefined;
  // onglet chargé sur le même monde (boutons des onglets)
  w.els('tabSolo');
  w.els('tabMultiN');
  w.load('src/ui/party.js');
  w.ctx.NET.code = 'ABCDE';
  join(w, '<img src=x onerror=alert(1)>');
  w.ctx.partyRender();
  assert.ok(!box.innerHTML.includes('<img src=x'), 'noms des amis jamais interprétés comme du HTML');
  assert.ok(box.innerHTML.includes('&lt;img'), 'nom affiché tel quel');
  assert.ok(
    box.innerHTML.includes('Disband party') && box.innerHTML.includes('Start match'),
    'hôte : lancer, dissoudre'
  );
  // 3v3 : une place par joueur du mode ; mon équipe = moi + 2 places IA, en face : l'ami + 2 places IA
  const slots = () => (box.innerHTML.match(/class="pSlot/g) || []).length,
    aiSlots = () => (box.innerHTML.match(/pSlot ai/g) || []).length;
  assert.equal(slots() + ' ' + aiSlots(), '6 4', '3v3 : 6 places, libres jouées par l’IA');
  assert.equal(w.els('tabMultiN').textContent, '(2)', 'onglet : nombre de membres');
  assert.match(box.innerHTML, /pOpt selected" data-map="bridge"/, 'arène choisie affichée');
  assert.match(box.innerHTML, /pOpt selected" data-diff="hard"/, 'difficulté affichée');
  // 1v1 avec deux amis en face : 2 places, l'ami en trop est signalé
  join(w, 'Torren');
  w.ctx.TEAM_SIZE = 1;
  w.ctx.partyRender();
  assert.equal(slots() + ' ' + aiSlots(), '3 0', '1v1 : une place par équipe (+ l’ami en trop)');
  assert.match(box.innerHTML, /pSlot over[^]*No slot in 1v1/, 'ami sans place signalé');
  // hôte : chaque IA a ses deux listes (race, classe), valeur jouée sélectionnée
  w.ctx.TEAM_SIZE = 3;
  w.ctx.partyRender();
  assert.equal((box.innerHTML.match(/<select data-ai=/g) || []).length, 6, 'hôte : race + classe pour chaque IA (3)');
  assert.match(box.innerHTML, /data-ai="enemy:0" data-kind="cls"[^]*?value="reaver" selected/, 'classe jouée choisie');
  // ami : réglages en lecture seule, choisis par l'hôte
  w.ctx.NET.role = 'guest';
  w.ctx.NET.party = {
    code: 'ABCDE',
    size: 2,
    map: 'castle',
    diff: 'easy',
    me: 1,
    members: [],
    ai: { ally: [{ cls: 'warlock', race: 'dwarf' }], enemy: [] }
  };
  w.ctx.partyRender();
  assert.ok(!box.innerHTML.includes('Start match') && box.innerHTML.includes('Leave party'), 'ami : Leave party');
  assert.match(box.innerHTML, /pOpt selected" data-size="2" disabled/, 'ami : mode de l’hôte, non modifiable');
  assert.equal(aiSlots(), 4, 'ami : places du mode de l’hôte');
  assert.ok(
    !box.innerHTML.includes('<select') && box.innerHTML.includes('Dwarf · Warlock'),
    'ami : IA lues, non modifiables'
  );
  console.log(
    'OK - groupe en ligne (tests unitaires : membres, équipes, places, exclure, groupe gardé entre les matchs, code gardé, onglet Multiplayer)'
  );
}
// ---------- Fluidité en ligne (06/11/2026, « mes amis lag énormément ») ----------
// L'hôte suit la position envoyée par l'ami même avec un gros retard du réseau (avant : refusée au-delà de 3 m, puis
// l'ami ramené en arrière, en boucle) ; après une téléportation, il ignore les positions d'avant ; l'ami ne se recale
// que sur une téléportation, jamais pour un simple retard.
{
  const w = netWorld();
  const { g } = join(w, 'Bob'),
    friend = { remote: true, remoteId: g.id, alive: true, x: 0, y: 0, z: 0, cd: [], auras: [] };
  w.ctx.state = { units: [friend], t: 0 };
  w.ctx.endCast = () => {};
  w.ctx.now = () => 0;
  const step = (s = 0.5) => {
    for (let t = 0; t < s; t += 1 / 120) w.ctx.netHostUpdate(1 / 120);
  };
  g.input = { t: 'in', x: 5, y: 0, z: 0, tp: 0, mv: true };
  step();
  assert.ok(Math.abs(friend.x - 5) < 0.01, `hôte : position de l'ami suivie malgré 5 m de retard (${friend.x})`);
  g.input = { t: 'in', x: 5.6, y: 0, z: 0, tp: 0, mv: true };
  w.ctx.netHostUpdate(1 / 120);
  assert.ok(friend.x > 5 && friend.x < 5.6, "hôte : l'ami glisse vers sa position (pas d'à-coup)");
  // téléportation par l'hôte (Blink) : la position d'avant, encore en route, est ignorée
  step();
  friend.x = 12;
  friend.tpN = 1;
  g.input = { t: 'in', x: 5.6, y: 0, z: 0, tp: 0, mv: true };
  step();
  assert.equal(friend.x, 12, 'hôte : position d’avant la téléportation ignorée');
  g.input = { t: 'in', x: 12.4, y: 0, z: 0, tp: 1, mv: true };
  step();
  assert.ok(Math.abs(friend.x - 12.4) < 0.01, "hôte : l'ami suivi de nouveau une fois la téléportation vue");
  // fin d'un déplacement imposé (étourdissement) : l'ami se recale une fois
  friend.stun = 1;
  step(0.1);
  friend.stun = 0;
  step(0.1);
  assert.equal(friend.tpN, 2, 'fin du déplacement imposé : un recalage');
}
// invité : 4 m d'écart avec l'hôte (retard) → il garde sa position ; téléportation (tp) → recalé une fois
{
  const w = netWorld({ role: 'guest' });
  const me = { team: 0, x: 10, y: 0, z: 0, cd: [], auras: [], alive: true, grounded: true };
  Object.assign(w.ctx, {
    playerMove() {},
    groundAt: () => 0,
    updateVisualState() {},
    updateUI() {},
    viewBehind() {},
    showSplash() {},
    netSend() {}
  });
  w.ctx.state = { units: [me], player: me, shrines: [], uiTick: 1, splash: 0 };
  const snap = (x, tp) => (w.ctx.NET.snap = { u: [{ x, y: 0, z: 0, yaw: 0, tp, cd: [], au: [] }], ev: [] });
  snap(6, 0);
  w.ctx.netGuestUpdate(1 / 60);
  snap(6, 0);
  w.ctx.netGuestUpdate(1 / 60);
  assert.equal(me.x, 10, 'invité : pas ramené en arrière par le retard du réseau');
  snap(20, 1);
  w.ctx.netGuestUpdate(1 / 60);
  assert.equal(me.x, 20, 'invité : recalé sur une téléportation de l’hôte');
}
