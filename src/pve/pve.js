'use strict';
// Mode PVE (aventure, seul ou en groupe de 5 au plus) : les héros suivent la route du monde ouvert PVE_WORLD
// (src/pve/world.js) jusqu'au château, à travers des camps de monstres. Mêmes règles de combat, sorts, déplacement et IA
// que l'arène (game/*.js) ; ce fichier ajoute seulement : création du monde, des héros et des monstres (pveStart, camps
// agrandis selon la taille du groupe pveCampMobs), comportement de monstre (pveBrain : repos, alerte du camp, poursuite
// par l'IA de l'arène, retour au camp), règles du mode (pveUpdate : régénération hors combat, feux de camp, mort puis
// retour au dernier feu pour chaque héros, herse levée par le levier de la porte pveUseLever, victoire sur le roi au
// sommet du donjon). Château : src/pve/castle.js. Interface : src/pve/pve_ui.js. En ligne : src/net/pve_online.js
// (l'hôte simule, comme en arène ; les messages aux amis passent par pveTell / pveTellAll).
// Points d'accroche dans le jeu (sans effet en PvP, où state.pve est absent) : update (game/sim.js), playAgain /
// leaveMatch (game/match.js), Play du lobby (ui/settings.js).
const PVE = {
  regen: 0.05, // part des PV max rendue par seconde hors combat
  calm: 5, // s sans combat avant la régénération
  respawn: 4, // s avant de revenir au dernier feu de camp
  leash: 38, // m : un monstre entraîné plus loin de son camp y retourne
  homeSpeed: 1.6, // vitesse du retour au camp (× vitesse de course)
  lostSight: 6, // s sans voir aucun héros (derrière un mur du château, hors d'atteinte) : le camp rentre
  checkpointR: 7, // m : rayon d'un feu de camp
  plateRange: 48, // m : barres de nom affichées en deçà (render/overlay.js)
  drawRange: 100, // m : monstres dessinés et animés en deçà (render/heroes3d.js), la brume cache le reste
  tabRange: 40, // m : TAB ne vise que les monstres proches et visibles
  maxHeroes: 5, // groupe en ligne : l'hôte et 4 amis au plus
  // Groupe : chaque héros en plus ajoute à chaque camp 60 % de ses monstres (arrondi, 8 au plus), pris dans le camp
  // lui-même (même mélange de mêlée et de distance), et 15 % de PV et de dégâts à chaque monstre (un groupe a ses
  // soigneurs : à nombre seul, 3 héros avec un prêtre finissaient chaque camp à 93 % de PV) ; un gardien ne se double
  // pas : il gagne une escorte par héros en plus (W.mobs[…].escort) et 50 % de PV. Mesuré le 10/11/2026, groupes joués
  // par l'IA (PV restants) : seul 24-61 % ; 3 héros 77-95 % avec un prêtre, 2-86 % sans (quelques défaites) ; 5 héros
  // 69-97 % avec un prêtre, 47-81 % sans.
  perHero: 0.6,
  campMax: 8,
  mobHp: 0.15,
  mobDmg: 0.15,
  bossHp: 0.5
};
// Le monde PVE prend la place de la carte d'arène dans `arena` (lue par la collision, la ligne de vue, la caméra et le
// décor) ; applyMap (data/maps.js) remet la carte d'arène au retour au lobby.
function pveApplyWorld(W = PVE_WORLD) {
  arena.halfX = W.halfX;
  arena.halfZ = W.halfZ;
  arena.pillars = [...W.obstacles, ...W.structures].map(p => ({ ...p }));
  arena.walls = W.walls.map(w => ({ ...w })); // copies : la herse s'ouvre pendant la partie (pveSetGate)
  arena.bridge = null;
  arena.rooms = [];
  arena.heightAt = W.heightAt;
  arena.world = W;
  HEALTH_SPOTS.length = 0;
  if (typeof ENV !== 'undefined' && window.ArenaEnv?.setMap) {
    if (ENV.ok)
      ENV.pendingMap = 'pve'; // décor reconstruit derrière l'écran de chargement (prepareMatch)
    else ArenaEnv.setMap('pve', arena); // pas encore de moteur : la carte est notée pour son initialisation
  }
  if (typeof hfRebuildOccluders === 'function') hfRebuildOccluders();
}
// Pose une unité au sol (relief) en (x, z).
function pvePlace(u, x, z, yaw = u.yaw) {
  const y = terrainY(x, z);
  return Object.assign(u, { x, z, y, prevX: x, prevZ: z, prevY: y, yaw, prevYaw: yaw, vy: 0, grounded: true });
}
const pveIsGuardian = type => !!(PVE_WORLD.mobs[type].gate || PVE_WORLD.mobs[type].boss);
function pveMonster(type, x, z, camp, i, heroes) {
  const T = PVE_WORLD.mobs[type],
    u = makeUnit(T.cls, x, z, 1, T.name, true, T.race, i),
    hpScale = 1 + (pveIsGuardian(type) ? PVE.bossHp : PVE.mobHp) * (heroes - 1);
  if (T.form) setForm(u, T.form); // forme de bête gardée (aiSpecial ne change pas la forme d'un monstre)
  u.maxHp = u.hp = Math.round(u.maxHp * T.hp * hpScale);
  u.scale = T.scale || 1;
  const yaw = Math.random() * Math.PI * 2;
  u.monster = { type, camp, mode: 'idle', boss: !!T.boss, aggro: T.aggro, home: { x, z, yaw } };
  u.brain = pveBrain;
  return pvePlace(u, x, z, yaw);
}
// Monstres d'un camp pour un groupe de `heroes` héros (règle : PVE.perHero, PVE.campMax, escorte des gardiens).
function pveCampMobs(c, heroes) {
  const extra = heroes - 1,
    guardian = c.mobs.find(pveIsGuardian);
  if (guardian) return [...c.mobs, ...Array(extra).fill(PVE_WORLD.mobs[guardian].escort)];
  const k = c.mobs.length,
    n = Math.min(Math.max(k, PVE.campMax), Math.round(k * (1 + PVE.perHero * extra)));
  return Array.from({ length: n }, (_, i) => c.mobs[i % k]);
}
function pveSpawnMonsters(W, heroes = 1) {
  const out = [];
  for (const c of W.camps) {
    const mobs = pveCampMobs(c, heroes),
      r = mobs.length > 1 ? 1.7 + 0.35 * mobs.length : 0; // cercle plus large pour un grand camp
    mobs.forEach((type, i) => {
      const a = (i / mobs.length) * Math.PI * 2 + c.id;
      out.push(pveMonster(type, c.x + Math.sin(a) * r, c.z + Math.cos(a) * r, c.id, i, heroes));
    });
  }
  return out;
}
// Profil de combat d'un monstre : celui de la difficulté choisie, sans bijou ni repli (couvert, sanctuaire) ni
// protection d'un allié, dégâts selon le type de monstre.
function pveTuneMonsters(heroes = 1) {
  for (const u of state.units) {
    if (!u.monster) continue;
    const P = u.aiP || AI_PROFILES.medium;
    u.aiP = { ...P, trinket: 0, peel: 0, defensive: Math.min(P.defensive, 0.5) };
    u.aiDmg = (u.aiDmg || 1) * PVE_WORLD.mobs[u.monster.type].dmg * (1 + PVE.mobDmg * (heroes - 1));
  }
}
// Héros du groupe (équipe 0) encore dans l'aventure (un ami parti en ligne la quitte : pveHeroGone).
const pveHeroes = () => state.units.filter(u => u.team === 0 && !u.gone);
// Places de départ côte à côte, à la largeur de la route (soi au centre).
const pveRow = (i, n) => (i - (n - 1) / 2) * 1.6;
// party : amis en ligne [{ cls, race, name, gid }] (net/pve_online.js) ; seul : [].
function pveStart(cls, race, party = []) {
  pveApplyWorld();
  const W = PVE_WORLD,
    n = 1 + party.length;
  state = {
    pve: { t0: now(), deaths: 0, checkpoint: 0, gateOpen: false, won: false, endT: null, party },
    pcls: cls,
    prace: race,
    scoreA: 0,
    scoreB: 0,
    round: 1,
    stats: [],
    map: 'pve',
    online: party.length ? { host: NET_NAME || 'Host' } : null,
    size: 1,
    t: 1e9, // pas de chrono de manche
    prep: 0,
    elapsed: 0,
    dampening: 0,
    ended: false,
    keys: {},
    fx: [],
    floaters: [],
    shrines: [],
    splash: 1.8,
    uiTick: 0
  };
  const hero = (c, r, name, i, gid) => {
    const u = makeUnit(c, 0, 0, 0, name, gid != null, r, i);
    if (gid != null) Object.assign(u, { remoteId: gid, remote: true, ai: false }); // l'ami pilote son héros
    return pvePlace(u, W.start.x + pveRow(i, n), W.start.z, W.start.yaw);
  };
  state.units = [hero(cls, race, 'You', 0), ...party.map((g, i) => hero(g.cls, g.race, g.name, i + 1, g.gid))];
  state.units.push(...pveSpawnMonsters(W, n));
  state.units.forEach((u, i) => (u.slotIndex = i));
  state.player = state.units[0];
  applyDifficulty();
  pveTuneMonsters(n);
  camera.yaw = W.start.yaw;
  camera.pitch = 0.2;
  pveUiStart();
  showSplash(W.name);
  if (HF.enabled) hfSyncUnits();
  updateUI();
  if (state.online) netSendRoster();
  prepareMatch();
}
// ---------- Messages aux joueurs (soi à l'écran, un ami en ligne par le réseau) ----------
function pveTell(u, text) {
  if (u === state.player) showSplash(text);
  else if (u.remote) netSendTo(netGuestOf(u), { t: 'say', text });
}
function pveTellAll(text, fanfare = false) {
  showSplash(text);
  if (fanfare) SFX.victory(false);
  if (window.NET?.role === 'host') netSend({ t: 'say', text, fanfare });
}
// ---------- Monstres ----------
const pveCamp = id => state.units.filter(u => u.monster?.camp === id && u.alive);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pveNearestHero = u =>
  pveHeroes()
    .filter(h => h.alive)
    .sort((a, b) => flatDist(u, a) - flatDist(u, b))[0] || null;
// Héros remarqué par un monstre au repos : proche et visible (camouflé : seulement tout près) ; attaqué ou contrôlé, le
// monstre se tourne vers le héros le plus proche.
function pveNoticed(u) {
  if (u.hp < u.maxHp || u.stun > 0 || u.root > 0 || u.fear > 0 || u.poly > 0 || u.auras?.length)
    return pveNearestHero(u);
  return (
    pveHeroes().find(
      p =>
        p.alive &&
        flatDist(u, p) < (p.stealth ? 3 : u.monster.aggro) &&
        Math.abs((u.y || 0) - (p.y || 0)) < 8 &&
        los(u, p)
    ) || null
  );
}
// Tout le camp attaque ensemble le héros qui l'a alerté.
function pveEngage(campId, hero = state.player) {
  for (const m of pveCamp(campId))
    if (m.monster.mode === 'idle') {
      m.monster.mode = 'fight';
      m.monster.seenAt = now();
      setTarget(m, hero);
    }
}
// Groupe entier mort ou monstre entraîné trop loin : le camp rentre et se soigne (l'IA de l'arène ne le guide plus).
function pveReset(campId) {
  for (const m of pveCamp(campId)) {
    m.monster.mode = 'reset';
    endCast(m, 'stop');
    m.mobility = null;
    m.target = m.lastEnemy = null;
    m.auras = [];
    m.stun = m.root = m.fear = m.slow = 0;
    if (m.poly > 0) endPoly(m, false);
  }
}
function pveWalkHome(u, dt) {
  const H = u.monster.home,
    d = flatDist(u, H);
  if (d < 0.6) {
    u.monster.mode = 'idle';
    u.hp = u.maxHp;
    u.res = 100;
    u.moving = false;
    u.yaw = H.yaw;
    return;
  }
  const h = aiStep(u, Math.atan2(H.x - u.x, H.z - u.z), Math.min(d, moveSpeed(u) * PVE.homeSpeed * dt));
  if (h == null) {
    pvePlace(u, H.x, H.z, H.yaw); // coincé : il rentre directement
    u.visualSnap = true;
    return;
  }
  u.yaw = h;
  u.moving = true;
  u.movePhase += dt * 8.5;
}
// Comportement d'un monstre (appelé par update à la place de ai, u.brain) : repos, combat (IA de l'arène), retour.
function pveBrain(u, dt) {
  const M = u.monster;
  if (!u.alive) return ai(u, dt);
  if (M.mode === 'reset') return pveWalkHome(u, dt);
  if (M.mode === 'idle') {
    const h = pveNoticed(u);
    if (!h) {
      u.moving = false;
      return;
    }
    pveEngage(M.camp, h);
  }
  const alive = pveHeroes().filter(h => h.alive);
  if (!alive.length || flatDist(u, M.home) > PVE.leash) return pveReset(M.camp);
  if (alive.some(h => los(u, h))) M.seenAt = now();
  else if (now() - M.seenAt > PVE.lostSight) return pveReset(M.camp);
  ai(u, dt);
}
// ---------- Règles du mode ----------
// Appelé à chaque pas par update (game/sim.js) à la place de la fin de manche de l'arène.
function pveUpdate(dt) {
  for (const p of pveHeroes()) pveHeroUpdate(p, dt);
  for (const u of state.units)
    if (u.monster && !u.alive && PVE_WORLD.mobs[u.monster.type].boss && !state.pve.won) pveVictory();
}
// Un héros : régénération hors combat, feux de camp ; mort, puis retour au dernier feu atteint par le groupe.
function pveHeroUpdate(p, dt) {
  const R = state.pve;
  if (p.alive) {
    if (now() - (p.lastCombat ?? -99) > PVE.calm) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * PVE.regen * dt);
      p.res = Math.min(100, p.res + 100 * PVE.regen * dt);
    }
    pveCheckpoints(p);
  } else if (p.pveDeadAt == null) {
    p.pveDeadAt = now();
    R.deaths++;
    pveTell(p, 'You have fallen');
  } else if (now() - p.pveDeadAt > PVE.respawn) pveRespawn(p);
}
// Levier de la porte (PVE_WORLD.lever), tiré au clic (pveLeverAtScreen, pve_ui.js) : à portée, la herse se lève.
// Renvoie false si rien ne se passe (déjà levée, trop loin, mort). Ami en ligne : l'hôte décide (net/pve_online.js).
function pveUseLever(u = state.player) {
  const L = PVE_WORLD.lever;
  if (!state.pve || state.pve.gateOpen || !u.alive) return false;
  if (flatDist(u, L) > L.reach) {
    unitError(u, 'Too far away');
    return false;
  }
  if (window.NET?.role === 'guest') return (netSend({ t: 'lever' }), true);
  pveOpenGate();
  return true;
}
// Herse levée ou baissée : collision et ligne de vue (arena.walls), décor (render/map_pve_castle.js).
function pveSetGate(open) {
  state.pve.gateOpen = open;
  for (const w of arena.walls) if (w.gate) w.open = open;
}
function pveOpenGate() {
  pveSetGate(true);
  pveTellAll('The castle gate is open!', true);
}
// Feu de camp atteint par un héros : le point de reprise de tout le groupe.
function pveCheckpoints(p) {
  const R = state.pve,
    C = PVE_WORLD.checkpoints;
  for (let i = R.checkpoint + 1; i < C.length; i++)
    if (flatDist(p, C[i]) < PVE.checkpointR) {
      R.checkpoint = i;
      addFloat(p, C[i].name, '#9fe8ff', true);
      fx('holyBurst', C[i].x, 0.3, C[i].z, [1, 0.7, 0.3], 1.1, 1.2);
    }
}
// Retour au dernier feu de camp, en pleine forme ; les camps en combat sont déjà rentrés s'il ne reste aucun héros
// debout (pveBrain). En groupe, chacun à sa place, côte à côte.
function pveRespawn(p) {
  const c = PVE_WORLD.checkpoints[state.pve.checkpoint],
    next = PVE_WORLD.checkpoints[state.pve.checkpoint + 1] || PVE_WORLD.top,
    yaw = Math.atan2(next.x - c.spawn.x, next.z - c.spawn.z),
    off = pveRow(p.slotIndex, pveHeroes().length);
  Object.assign(p, {
    alive: true,
    hp: p.maxHp,
    res: 100,
    shield: 0,
    stun: 0,
    root: 0,
    fear: 0,
    silence: 0,
    slow: 0,
    poly: 0,
    auras: [],
    target: null,
    lastEnemy: null,
    mobility: null,
    visualSnap: true,
    pveDeadAt: null
  });
  endCast(p, 'stop');
  pvePlace(p, c.spawn.x + Math.cos(yaw) * off, c.spawn.z - Math.sin(yaw) * off, yaw);
  p.tpN = (p.tpN || 0) + 1; // l'ami en ligne qui joue ce héros se recale (net/online.js)
  if (p === state.player) camera.yaw = yaw;
  pveTell(p, c.name);
}
// Héros d'un ami parti en cours d'aventure : il quitte la partie (pas d'IA qui courrait seule vers les camps).
function pveHeroGone(u) {
  Object.assign(u, { gone: true, alive: false, hp: 0, remote: false, remoteId: null, ai: false });
}
// Résumé de fin d'aventure (écran de victoire, envoyé aussi aux amis) : temps, chutes, une ligne par héros.
function pveSummary() {
  const R = state.pve;
  return {
    time: (R.endT || now()) - R.t0,
    deaths: R.deaths,
    heroes: state.units
      .filter(u => u.team === 0)
      .map(u => ({
        slot: u.slotIndex,
        name: u === state.player ? state.online?.host || 'You' : u.name,
        ...(statOf(u) || { damage: 0, healing: 0, kills: 0 })
      }))
  };
}
function pveVictory() {
  const R = state.pve,
    match = state;
  R.won = true;
  R.endT = now();
  state.ended = true;
  state.winTeam = state.player.team;
  pveTellAll('The Ashen King has fallen!', true);
  setTimeout(() => {
    if (state !== match) return;
    const sum = pveSummary();
    if (window.NET?.role === 'host') netSend({ t: 'pveEnd', sum });
    pveShowEnd(sum);
  }, 2600);
}
// « Play again » de l'écran de fin : nouvelle aventure, mêmes héros (le groupe en ligne aussi).
function pveRestart() {
  hideResults();
  pveStart(state.pcls, state.prace, state.pve.party);
  playGameMusic();
}
// Retour au lobby : la carte d'arène reprend sa place (décor reconstruit au prochain match d'arène).
function pveLeave() {
  pveUiStop();
  applyMap(MAP_ID); // remet aussi arena.walls à null
}
// TAB en PVE : monstres proches et visibles, du plus proche au plus loin (rules.js, tabTargets).
function pveTabTargets(p) {
  return enemies(p)
    .filter(e => !e.stealth && flatDist(p, e) < PVE.tabRange && los(p, e))
    .sort((a, b) => flatDist(p, a) - flatDist(p, b));
}
