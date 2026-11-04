'use strict';
// Lobby, onglet « Party » : groupe d'amis en ligne, comme dans les jeux du genre. Créer un groupe (code gardé d'une
// fois sur l'autre) ou en rejoindre un ; deux équipes avec leurs places (places libres : IA) ; l'hôte change un ami de
// côté ou l'exclut et lance le match ; « Leave party » / « Disband party » pour partir. Le groupe reste formé entre
// les matchs. Réseau : net/online.js (NET, netHost, netJoin, netMoveGuest, netKick, netClose, netPartyMembers,
// netSetName) ; choix de race / classe : onglet Arena (settings.js). Styles : fin de ui/lobby.css.
const PARTY_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// les noms viennent des autres navigateurs : jamais de HTML
const partyEsc = s => String(s ?? '').replace(/[&<>"']/g, c => PARTY_ESC[c]);
function lobbyTab(name) {
  document.querySelector('#overlay .modal')?.classList.toggle('partyMode', name === 'party');
  $('tabArena')?.classList.toggle('selected', name !== 'party');
  $('tabParty')?.classList.toggle('selected', name === 'party');
  partyRender();
}
// le groupe vu de chez moi : membres, mode, code, mon id (hôte : 0), et si je le dirige
function partyView() {
  if (NET.role === 'host') return { members: netPartyMembers(), size: TEAM_SIZE, code: NET.code, me: 0, lead: true };
  if (NET.role === 'guest' && NET.party) return { ...NET.party, lead: false };
  return null;
}
function partyMemberHTML(m, v) {
  const who = m.cls ? `${RACE[m.race]?.name || ''} ${CLASS[m.cls]?.name || ''}` : 'choosing…',
    tools =
      v.lead && !m.host
        ? `<button data-move="${m.id}" title="Switch side">⇄</button><button data-kick="${m.id}" title="Remove from the party">Kick</button>`
        : '';
  return `<div class="pmember${m.id === v.me ? ' me' : ''}"><span class="pmName">${m.host ? '♛ ' : ''}${partyEsc(m.name)}${m.id === v.me ? ' (you)' : ''}</span><span class="pmClass">${partyEsc(who)}</span>${tools}</div>`;
}
// deux colonnes : mon équipe d'abord ; les places libres sont jouées par l'IA
function partyTeamsHTML(v) {
  const mine = v.members.find(m => m.id === v.me)?.team || 'ally',
    col = (team, title) => {
      const list = v.members.filter(m => m.team === team),
        ai = Math.max(0, v.size - list.length);
      return `<div class="partyTeam ${team === mine ? 'mine' : 'foe'}"><h3>${title}</h3>${list.map(m => partyMemberHTML(m, v)).join('')}${'<div class="pmember ai"><span class="pmName">AI</span><span class="pmClass">free slot</span></div>'.repeat(ai)}</div>`;
    };
  return `<div class="partyTeams">${col(mine, 'Your team')}${col(mine === 'ally' ? 'enemy' : 'ally', 'Enemy team')}</div>`;
}
function partyRender() {
  const box = $('partyBox'),
    tab = $('tabParty');
  if (!box) return;
  const v = partyView();
  if (tab) tab.textContent = v ? `Party (${v.members.length})` : 'Party';
  if (!v) {
    box.innerHTML = `<p class="partyHint">Play with or against your friends, browser to browser. Empty slots are played by the AI.</p>
<div class="pRow"><input id="partyName" maxlength="16" placeholder="Your name" autocomplete="off" spellcheck="false"></div>
<div class="pRow"><button id="partyCreate">Create a party</button></div>
<div class="pRow"><input id="partyCode" maxlength="6" placeholder="CODE" autocomplete="off" spellcheck="false"><button id="partyJoin">Join</button></div>`;
    $('partyName').value = NET_NAME;
    $('partyCode').value = netStored('arenaNetJoin');
    $('partyName').onchange = () => netSetName($('partyName').value);
    $('partyCreate').onclick = () => netHost();
    $('partyJoin').onclick = () => netJoin($('partyCode').value);
    return;
  }
  box.innerHTML = `<div class="pRow partyCode">Party code: <b>${partyEsc(v.code)}</b><button id="partyCopy">Copy</button></div>
<p class="partyHint">Mode ${v.size}v${v.size}${v.lead ? ' (change it in the Arena tab)' : ' (chosen by the host)'} · pick your race and class in the Arena tab</p>
${partyTeamsHTML(v)}
<div class="pRow">${v.lead ? '<button id="partyStart">Start match</button><button id="partyLeave">Disband party</button>' : '<button id="partyLeave">Leave party</button>'}</div>`;
  $('partyCopy').onclick = () => navigator.clipboard?.writeText(v.code).then(() => netStatus('Code copied.'));
  $('partyLeave').onclick = () => netClose(v.lead ? 'Party disbanded.' : 'You left the party.');
  if (v.lead) $('partyStart').onclick = () => $('playBtn').click();
  box.querySelectorAll('[data-move]').forEach(b => {
    const m = v.members.find(x => x.id === +b.dataset.move);
    b.onclick = () => netMoveGuest(m.id, m.team === 'ally' ? 'enemy' : 'ally');
  });
  box.querySelectorAll('[data-kick]').forEach(b => (b.onclick = () => netKick(+b.dataset.kick)));
}
$('tabArena').onclick = () => lobbyTab('arena');
$('tabParty').onclick = () => lobbyTab('party');
partyRender();
