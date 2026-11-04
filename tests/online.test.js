'use strict';
// Tests unitaires du groupe en ligne (src/net/online.js + onglet Party src/ui/party.js) : le vrai code dans un contexte
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
    CLASS: { arcanist: { name: 'Mage' }, warlock: { name: 'Warlock' } },
    RACE: { human: { name: 'Human' }, orc: { name: 'Orc' } },
    AI_PROFILES: { medium: { m: 1 } },
    state: null,
    fx() {},
    addFloat() {},
    SFX: {},
    showError: t => calls.errors.push(t),
    leaveMatch: () => calls.leaveMatch++,
    partyRender() {}
  });
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

// ---------- onglet Party : affichage ----------
function partyTests() {
  const w = netWorld();
  const box = w.els('partyBox');
  w.ctx.partyRender = undefined;
  // onglet chargé sur le même monde (boutons des onglets)
  w.els('tabArena');
  w.els('tabParty');
  w.load('src/ui/party.js');
  w.ctx.NET.code = 'ABCDE';
  join(w, '<img src=x onerror=alert(1)>');
  w.ctx.partyRender();
  assert.ok(!box.innerHTML.includes('<img'), 'noms des amis jamais interprétés comme du HTML');
  assert.ok(box.innerHTML.includes('&lt;img'), 'nom affiché tel quel');
  assert.ok(
    box.innerHTML.includes('Disband party') && box.innerHTML.includes('Start match'),
    'hôte : lancer, dissoudre'
  );
  // 3v3 : mon équipe = moi + 2 places IA ; en face : l'ami + 2 places IA
  assert.equal((box.innerHTML.match(/pmember ai/g) || []).length, 4, 'places libres jouées par l’IA');
  assert.equal(w.els('tabParty').textContent, 'Party (2)', 'onglet : nombre de membres');
  console.log(
    'OK - groupe en ligne (tests unitaires : membres, équipes, places, exclure, groupe gardé entre les matchs, code gardé, onglet Party)'
  );
}
