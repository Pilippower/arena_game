'use strict';
// Mode PVE (aventure solo) : le joueur suit la route du monde ouvert PVE_WORLD (src/pve/world.js) jusqu'au château,
// à travers des camps de monstres. Mêmes règles de combat, sorts, déplacement et IA que l'arène (game/*.js) ; ce fichier
// ajoute seulement : création du monde et des monstres (pveStart), comportement de monstre (pveBrain : repos, alerte
// du camp, poursuite par l'IA de l'arène, retour au camp), règles du mode (pveUpdate : régénération hors combat, feux
// de camp, mort puis retour au dernier feu, victoire sur le gardien de la porte). Interface : src/pve/pve_ui.js.
// Points d'accroche dans le jeu (sans effet en PvP, où state.pve est absent) : update (game/sim.js), playAgain /
// leaveMatch (game/match.js), Play du lobby (ui/settings.js).
const PVE = {
  regen: 0.05, // part des PV max rendue par seconde hors combat
  calm: 5, // s sans combat avant la régénération
  respawn: 4, // s avant de revenir au dernier feu de camp
  leash: 38, // m : un monstre entraîné plus loin de son camp y retourne
  homeSpeed: 1.6, // vitesse du retour au camp (× vitesse de course)
  checkpointR: 7, // m : rayon d'un feu de camp
  plateRange: 48, // m : barres de nom affichées en deçà (render/overlay.js)
  drawRange: 100, // m : monstres dessinés et animés en deçà (render/heroes3d.js), la brume cache le reste
  tabRange: 40 // m : TAB ne vise que les monstres proches et visibles
};
// Le monde PVE prend la place de la carte d'arène dans `arena` (lue par la collision, la ligne de vue, la caméra et le
// décor) ; applyMap (data/maps.js) remet la carte d'arène au retour au lobby.
function pveApplyWorld(W = PVE_WORLD) {
  arena.halfX = W.halfX;
  arena.halfZ = W.halfZ;
  arena.pillars = W.obstacles.map(p => ({ ...p }));
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
function pveMonster(type, x, z, camp, i) {
  const T = PVE_WORLD.mobs[type],
    u = makeUnit(T.cls, x, z, 1, T.name, true, T.race, i);
  if (T.form) setForm(u, T.form); // forme de bête gardée (aiSpecial ne change pas la forme d'un monstre)
  u.maxHp = u.hp = Math.round(u.maxHp * T.hp);
  u.scale = T.scale || 1;
  const yaw = Math.random() * Math.PI * 2;
  u.monster = { type, camp, mode: 'idle', boss: !!T.boss, aggro: T.aggro, home: { x, z, yaw } };
  u.brain = pveBrain;
  return pvePlace(u, x, z, yaw);
}
function pveSpawnMonsters(W) {
  const out = [];
  for (const c of W.camps)
    c.mobs.forEach((type, i) => {
      const a = (i / c.mobs.length) * Math.PI * 2 + c.id,
        r = c.mobs.length > 1 ? 2.4 : 0;
      out.push(pveMonster(type, c.x + Math.sin(a) * r, c.z + Math.cos(a) * r, c.id, i));
    });
  return out;
}
// Profil de combat d'un monstre : celui de la difficulté choisie, sans bijou ni repli (couvert, sanctuaire) ni
// protection d'un allié, dégâts selon le type de monstre.
function pveTuneMonsters() {
  for (const u of state.units) {
    if (!u.monster) continue;
    const P = u.aiP || AI_PROFILES.medium;
    u.aiP = { ...P, trinket: 0, peel: 0, defensive: Math.min(P.defensive, 0.5) };
    u.aiDmg = (u.aiDmg || 1) * PVE_WORLD.mobs[u.monster.type].dmg;
  }
}
function pveStart(cls, race) {
  pveApplyWorld();
  const W = PVE_WORLD;
  state = {
    pve: { t0: now(), deaths: 0, checkpoint: 0, deadAt: null, won: false, endT: null },
    pcls: cls,
    prace: race,
    scoreA: 0,
    scoreB: 0,
    round: 1,
    stats: [],
    map: 'pve',
    online: null,
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
  state.units = [];
  const p = pvePlace(makeUnit(cls, 0, 0, 0, 'You', false, race, 0), W.start.x, W.start.z, W.start.yaw);
  state.units = [p];
  state.units.push(...pveSpawnMonsters(W));
  state.units.forEach((u, i) => (u.slotIndex = i));
  state.player = p;
  applyDifficulty();
  pveTuneMonsters();
  camera.yaw = p.yaw;
  camera.pitch = 0.2;
  pveUiStart();
  showSplash(W.name);
  if (HF.enabled) hfSyncUnits();
  updateUI();
  prepareMatch();
}
// ---------- Monstres ----------
const pveCamp = id => state.units.filter(u => u.monster?.camp === id && u.alive);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Un monstre au repos remarque le joueur : proche et visible (camouflé : seulement tout près), ou attaqué / contrôlé.
function pveNotices(u, p) {
  if (!p.alive) return false;
  if (u.hp < u.maxHp || u.stun > 0 || u.root > 0 || u.fear > 0 || u.poly > 0 || u.auras?.length) return true;
  const reach = p.stealth ? 3 : u.monster.aggro;
  return flatDist(u, p) < reach && Math.abs((u.y || 0) - (p.y || 0)) < 8 && los(u, p);
}
// Tout le camp attaque ensemble.
function pveEngage(campId) {
  for (const m of pveCamp(campId))
    if (m.monster.mode === 'idle') {
      m.monster.mode = 'fight';
      setTarget(m, state.player);
    }
}
// Joueur mort ou monstre entraîné trop loin : le camp rentre et se soigne (l'IA de l'arène ne le guide plus).
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
  const M = u.monster,
    p = state.player;
  if (!u.alive) return ai(u, dt);
  if (M.mode === 'reset') return pveWalkHome(u, dt);
  if (M.mode === 'idle') {
    if (!pveNotices(u, p)) {
      u.moving = false;
      return;
    }
    pveEngage(M.camp);
  }
  if (!p.alive || flatDist(u, M.home) > PVE.leash) return pveReset(M.camp);
  ai(u, dt);
}
// ---------- Règles du mode ----------
// Appelé à chaque pas par update (game/sim.js) à la place de la fin de manche de l'arène.
function pveUpdate(dt) {
  const R = state.pve,
    p = state.player;
  if (p.alive) {
    if (now() - (p.lastCombat ?? -99) > PVE.calm) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * PVE.regen * dt);
      p.res = Math.min(100, p.res + 100 * PVE.regen * dt);
    }
    pveCheckpoints(p);
  } else if (R.deadAt == null) {
    R.deadAt = now();
    R.deaths++;
    showSplash('You have fallen');
  } else if (now() - R.deadAt > PVE.respawn) pveRespawn(p);
  const boss = state.units.find(u => u.monster?.boss);
  if (boss && !boss.alive && !R.won) pveVictory();
}
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
// Retour au dernier feu de camp, en pleine forme ; les camps en combat sont déjà rentrés (pveBrain).
function pveRespawn(p) {
  const c = PVE_WORLD.checkpoints[state.pve.checkpoint],
    next = PVE_WORLD.checkpoints[state.pve.checkpoint + 1] || PVE_WORLD.gate,
    yaw = Math.atan2(next.x - c.spawn.x, next.z - c.spawn.z);
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
    visualSnap: true
  });
  endCast(p, 'stop');
  pvePlace(p, c.spawn.x, c.spawn.z, yaw);
  camera.yaw = yaw;
  state.pve.deadAt = null;
  showSplash(c.name);
}
function pveVictory() {
  const R = state.pve,
    match = state;
  R.won = true;
  R.endT = now();
  state.ended = true;
  state.winTeam = state.player.team;
  showSplash('The castle gate is open!');
  SFX.victory(false);
  setTimeout(() => state === match && pveShowEnd(), 2600);
}
// « Play again » de l'écran de fin : nouvelle aventure, même héros.
function pveRestart() {
  hideResults();
  pveStart(state.pcls, state.prace);
  playGameMusic();
}
// Retour au lobby : la carte d'arène reprend sa place (décor reconstruit au prochain match d'arène).
function pveLeave() {
  pveUiStop();
  applyMap(MAP_ID);
}
// TAB en PVE : monstres proches et visibles, du plus proche au plus loin (rules.js, tabTargets).
function pveTabTargets(p) {
  return enemies(p)
    .filter(e => !e.stealth && flatDist(p, e) < PVE.tabRange && los(p, e))
    .sort((a, b) => flatDist(p, a) - flatDist(p, b));
}
