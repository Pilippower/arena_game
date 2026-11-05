'use strict';
// Lobby, onglet « Multiplayer » : groupe d'amis en ligne, présenté comme une partie personnalisée des jeux du genre.
// Créer un groupe (code gardé d'une fois sur l'autre) ou en rejoindre un ; réglages du match (mode, arène, difficulté
// de l'IA : l'hôte les change, les amis les voient) ; deux équipes avec exactement autant de places que le mode (places
// libres : IA) ; l'hôte change un ami de côté ou l'exclut et lance le match ; « Leave party » / « Disband party ».
// Le groupe reste formé entre les matchs. Réseau : net/online.js (NET, netHost, netJoin, netMoveGuest, netKick,
// netAutoBalance, netSetAI, netClose, netPartyMembers, netSetName) ; mise en page : maquette de l'utilisateur
// assets_src/ui/party_interface.png (pièces peintes : node tools/build_party_assets.js → assets/ui/party/) ; héros et
// réglages en solo : onglet Solo (settings.js, dont les boutons
// restent la seule source des réglages : ceux de l'onglet Multiplayer les actionnent). Styles : fin de ui/lobby.css, PC : ui/lobby3.css. Le bandeau des réglages
// sert aussi en haut de l'onglet Solo sur PC (renderSoloSettings).
const PARTY_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// les noms viennent des autres navigateurs : jamais de HTML
const partyEsc = s => String(s ?? '').replace(/[&<>"']/g, c => PARTY_ESC[c]);
const PARTY_DIFFS = ['easy', 'medium', 'hard'];
function lobbyTab(name) {
  document.querySelector('#overlay .modal')?.classList.toggle('partyMode', name === 'party');
  $('tabSolo')?.classList.toggle('selected', name !== 'party');
  $('tabMulti')?.classList.toggle('selected', name === 'party');
  partyRender();
}
// le groupe vu de chez moi : membres, réglages, code, mon id (hôte : 0), et si je le dirige
function partyView() {
  if (NET.role === 'host')
    return {
      members: netPartyMembers(),
      size: TEAM_SIZE,
      map: MAP_ID,
      diff: DIFFICULTY,
      code: NET.code,
      ai: netAiSlots(),
      me: 0,
      lead: true
    };
  if (NET.role === 'guest' && NET.party) return { ...NET.party, lead: false };
  return null;
}
// réglages du match : boutons de l'hôte (actionnent ceux de l'onglet Solo), lecture seule chez les amis. Même bandeau
// en haut de l'onglet Solo sur PC (maquette lobby3_solo.png, renderSoloSettings) ; mobile : boutons d'origine.
function partySettingsHTML(v) {
  const opt = (kind, val, label, on, art = '') =>
    `<button class="pOpt${on ? ' selected' : ''}" data-${kind}="${val}"${v.lead ? '' : ' disabled'}>${art}<span>${label}</span></button>`;
  const maps = Object.entries(MAPS)
    .map(([id, M]) =>
      opt('map', id, M.name, id === v.map, `<img src="${MAP_ART[id] || window.MAP_THUMBS?.[id] || ''}" alt="">`)
    )
    .join('');
  return `<div class="pSettings">
<div class="pSet"><h4>Mode</h4><div class="pOpts diffs">${[1, 2, 3].map(s => opt('size', s, `${s}v${s}`, s === v.size)).join('')}</div></div>
<div class="pSet pArena"><h4>Arena</h4><div class="pOpts diffs">${maps}</div></div>
<div class="pSet"><h4>AI difficulty</h4><div class="pOpts diffs">${PARTY_DIFFS.map(d => opt('diff', d, d[0].toUpperCase() + d.slice(1), d === v.diff)).join('')}</div></div>
</div>`;
}
// portrait de race et médaillon de classe d'une place
const partyFaceHTML = (race, cls) =>
  `<span class="pFace">${RACE[race] ? `<img src="assets/ui/lobby2/race_${race}.webp" alt="">` : ''}${CLASS[cls] ? `<img class="pBadge" src="assets/ui/lobby2/class_${cls}.webp" alt="">` : ''}</span>`;
const partyHeroName = (race, cls) => `${RACE[race]?.name || ''} · ${CLASS[cls]?.name || ''}`;
// place libre : l'IA qui la jouera (a) ; l'hôte choisit sa race et sa classe
function partyAiSlotHTML(a, v, team, k) {
  if (!a)
    return `<div class="pSlot ai"><span class="pCrown"></span><span class="pFace"></span><span class="pInfo"><b>AI</b><small>Open slot</small></span></div>`;
  const pick = (kind, cur, table) =>
    `<select data-ai="${team}:${k}" data-kind="${kind}" title="AI ${kind}">${Object.entries(table)
      .map(([id, x]) => `<option value="${id}"${id === cur ? ' selected' : ''}>${x.name}</option>`)
      .join('')}</select>`;
  return `<div class="pSlot ai"><span class="pCrown"></span>${partyFaceHTML(a.race, a.cls)}<span class="pInfo"><b>AI</b>${
    v.lead
      ? `<span class="pPick">${pick('race', a.race, RACE)}${pick('cls', a.cls, CLASS)}</span>`
      : `<small>${partyHeroName(a.race, a.cls)}</small>`
  }</span></div>`;
}
// une place d'ami (ou de l'hôte) : portrait, nom, outils
const PARTY_GEAR =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7 2.2-1.6-.3a5.6 5.6 0 0 0-.6-1.5l.9-1.4-1.5-1.5-1.4.9a5.6 5.6 0 0 0-1.5-.6L11 2.8H9l-.3 1.6a5.6 5.6 0 0 0-1.5.6l-1.4-.9-1.5 1.5.9 1.4a5.6 5.6 0 0 0-.6 1.5L3 8.8v2l1.6.3c.1.5.3 1 .6 1.5l-.9 1.4 1.5 1.5 1.4-.9c.5.3 1 .5 1.5.6l.3 1.6h2l.3-1.6c.5-.1 1-.3 1.5-.6l1.4.9 1.5-1.5-.9-1.4c.3-.5.5-1 .6-1.5l1.6-.3z" fill="currentColor"/></svg>';
function partySlotHTML(m, v, over) {
  const me = m.id === v.me,
    who = m.cls ? partyHeroName(m.race, m.cls) : 'Choosing a hero…',
    tools = me
      ? `<button data-hero title="Pick your race and class">${PARTY_GEAR}Change</button>`
      : v.lead
        ? `<button data-move="${m.id}" title="Switch side">⇄</button><button data-kick="${m.id}" title="Remove from the party">Kick</button>`
        : '';
  return `<div class="pSlot${me ? ' me' : ''}${over ? ' over' : ''}"><span class="pCrown">${m.host ? '♛' : ''}</span>${partyFaceHTML(m.race, m.cls)}<span class="pInfo"><b>${partyEsc(m.name)}${me ? ' (you)' : ''}</b><small>${over ? `No slot in ${v.size}v${v.size}` : partyEsc(who)}</small></span><span class="pTools">${tools}</span></div>`;
}
// deux équipes face à face, mon équipe à gauche ; autant de places que le mode, les libres jouées par l'IA
function partyTeamsHTML(v) {
  const mine = v.members.find(m => m.id === v.me)?.team || 'ally',
    col = (team, title) => {
      const list = v.members.filter(m => m.team === team),
        slots = Array.from({ length: Math.max(v.size, list.length) }, (_, k) =>
          k < list.length
            ? partySlotHTML(list[k], v, k >= v.size)
            : partyAiSlotHTML(v.ai?.[team]?.[k - list.length], v, team, k - list.length)
        );
      // bandeau peint (titre compris) : le texte reste pour les lecteurs d'écran
      return `<div class="pTeam ${team === mine ? 'mine' : 'foe'}"><h3 class="pRibbon"><span>${title}</span></h3>${slots.join('')}</div>`;
    };
  return `<div class="pTeams">${col(mine, 'Your team')}<div class="pVs"><img src="assets/ui/party/vs.webp" alt="VS"></div>${col(mine === 'ally' ? 'enemy' : 'ally', 'Enemy team')}</div>`;
}
const PARTY_COPY =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="5" width="10" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 14V3.5C4 2.7 4.7 2 5.5 2H13" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
function partyJoinHTML() {
  return `<p class="partyHint">Play with or against your friends, browser to browser. Empty slots are played by the AI.</p>
<div class="pRow"><input id="partyName" maxlength="16" placeholder="Your name" autocomplete="off" spellcheck="false"></div>
<div class="pRow"><button id="partyCreate">Create a party</button></div>
<div class="pRow"><input id="partyCode" maxlength="6" placeholder="CODE" autocomplete="off" spellcheck="false"><button id="partyJoin">Join</button></div>`;
}
// boutons du bandeau : on actionne ceux de l'onglet Solo (même effet, même sauvegarde, groupe synchronisé)
function wireMatchSettings(box) {
  const relay = (attr, list, key) =>
    box
      .querySelectorAll(`[data-${attr}]`)
      .forEach(b => (b.onclick = () => $(list).querySelector(`[data-${key}="${b.dataset[attr]}"]`)?.click()));
  relay('size', 'sizeChoices', 's');
  relay('map', 'mapChoices', 'map');
  relay('diff', 'diffChoices', 'd');
}
function renderSoloSettings() {
  const box = $('soloSettings');
  if (!box) return;
  box.innerHTML = partySettingsHTML({ size: TEAM_SIZE, map: MAP_ID, diff: DIFFICULTY, lead: true });
  wireMatchSettings(box);
  lobbyQueueLabel();
}
// plaque du bas, au lobby : file d'attente du mode joué (« Queue (Solo) », « Queue in : 3v3 » en groupe)
function lobbyQueueLabel() {
  const el = $('queueLabel');
  if (el) el.textContent = partyView() ? `Queue in : ${TEAM_SIZE}v${TEAM_SIZE}` : 'Queue (Solo)';
}
function partyRender() {
  lobbyQueueLabel();
  const box = $('partyBox'),
    tab = $('tabMultiN');
  if (!box) return;
  const v = partyView();
  if (tab) tab.textContent = v ? `(${v.members.length})` : '';
  if (!v) {
    box.innerHTML = partyJoinHTML();
    $('partyName').value = NET_NAME;
    $('partyCode').value = netStored('arenaNetJoin');
    $('partyName').onchange = () => netSetName($('partyName').value);
    $('partyCreate').onclick = () => netHost();
    $('partyJoin').onclick = () => netJoin($('partyCode').value);
    return;
  }
  box.innerHTML = `<div class="pRow partyCode">Party Code: <b>${partyEsc(v.code)}</b><button id="partyCopy">${PARTY_COPY}Copy</button></div>
${partySettingsHTML(v)}
${partyTeamsHTML(v)}
<div class="pRow pActions">${
    v.lead
      ? '<button id="partyBalance" class="pArt balance" aria-label="Auto-Balance" title="Spread your friends evenly between the two teams"></button><button id="partyStart" class="pArt start" aria-label="Start match"></button><button id="partyLeave" class="pSmall">Disband party</button>'
      : '<button id="partyLeave">Leave party</button>'
  }</div>`;
  $('partyCopy').onclick = () => navigator.clipboard?.writeText(v.code).then(() => netStatus('Code copied.'));
  $('partyLeave').onclick = () => netClose(v.lead ? 'Party disbanded.' : 'You left the party.');
  const hero = box.querySelector?.('[data-hero]');
  if (hero) hero.onclick = () => lobbyTab('solo');
  if (v.lead) {
    $('partyStart').onclick = () => $('playBtn').click();
    $('partyBalance').onclick = () => netAutoBalance();
    wireMatchSettings(box);
  }
  box.querySelectorAll('[data-move]').forEach(b => {
    const m = v.members.find(x => x.id === +b.dataset.move);
    b.onclick = () => netMoveGuest(m.id, m.team === 'ally' ? 'enemy' : 'ally');
  });
  // IA : race et classe choisies par l'hôte (les deux listes de la place)
  box.querySelectorAll('select[data-ai]').forEach(
    s =>
      (s.onchange = () => {
        const [team, k] = s.dataset.ai.split(':'),
          val = kind => box.querySelector(`select[data-ai="${s.dataset.ai}"][data-kind="${kind}"]`).value;
        netSetAI(team, +k, val('cls'), val('race'));
      })
  );
  box.querySelectorAll('[data-kick]').forEach(b => (b.onclick = () => netKick(+b.dataset.kick)));
}
$('tabSolo').onclick = () => lobbyTab('solo');
$('tabMulti').onclick = () => lobbyTab('party');
partyRender();
renderSoloSettings();
