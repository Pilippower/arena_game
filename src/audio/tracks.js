'use strict';
// Musiques enregistrées (fichiers audio) par-dessus le moteur procédural (music.js) :
//  - lobby : assets/audio/lobby.mp3 en boucle tant que l'écran de sélection est ouvert ;
//  - en jeu : un fichier choisi par le joueur (⚙ Interface), gardé dans le navigateur (IndexedDB), jamais publié.
//    Chaque partie démarre à une position aléatoire avec un fondu ; sans fichier, la musique procédurale joue.
//  - musique de jeu par défaut : assets/audio/game.mp3 (fournie par l'utilisateur, publiée), chargée seulement
//    au lancement d'une partie (fichier lourd). Un fichier choisi par le joueur la remplace.
const TRACKS = { lobby: null, game: null, gameUrl: null, gameName: '', want: 'none' };
const TRACK_VOL = { lobby: 0.32, game: 0.16 }; // la musique ne doit pas couvrir les bruitages
function trackVolume(kind) {
  return clamp(TRACK_VOL[kind] * PREFS.volume, 0, 1);
}
function fadeTo(a, vol, sec = 1.2) {
  if (!a) return;
  clearInterval(a._fade);
  const v0 = a.volume,
    t0 = performance.now();
  a._fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
    a.volume = clamp(v0 + (vol - v0) * k, 0, 1);
    if (k >= 1) {
      clearInterval(a._fade);
      if (vol === 0) a.pause();
    }
  }, 50);
}
function lobbyAudio() {
  if (!TRACKS.lobby) {
    TRACKS.lobby = new Audio('assets/audio/lobby.mp3?v=' + (window.ASSET_V || 1));
    TRACKS.lobby.loop = true;
    TRACKS.lobby.volume = 0;
  }
  return TRACKS.lobby;
}
// Le navigateur n'autorise le son qu'après une action du joueur : on réessaie au premier clic ou touche.
function playSafe(a) {
  const p = a.play();
  if (p && p.catch)
    p.catch(() => {
      const retry = () => {
        if (TRACKS.want !== 'none' && PREFS.musicOn) a.play().catch(() => {});
      };
      window.addEventListener('pointerdown', retry, { once: true });
      window.addEventListener('keydown', retry, { once: true });
    });
}
function playLobbyMusic() {
  TRACKS.want = 'lobby';
  if (TRACKS.game) fadeTo(TRACKS.game, 0, 0.8);
  if (TRACKS.local) fadeTo(TRACKS.local, 0, 0.8);
  musicStopProcedural();
  if (!PREFS.musicOn) return;
  const a = lobbyAudio();
  playSafe(a);
  fadeTo(a, trackVolume('lobby'), 1.5);
}
// Fichier local par défaut : chargé une fois ; s'il est absent (erreur), on garde la musique procédurale.
function localGameTrack() {
  if (TRACKS.local === undefined) {
    const a = new Audio('assets/audio/game.mp3');
    a.loop = true;
    a.preload = 'metadata';
    TRACKS.local = a;
    a.addEventListener('error', () => {
      TRACKS.local = null;
      if (TRACKS.want === 'game' && !TRACKS.game) musicStartProcedural();
    });
  }
  return TRACKS.local;
}
function playGameMusic() {
  // le fichier de jeu est lourd : on attend la fin du chargement de la page avant de le demander
  if (document.readyState !== 'complete') {
    TRACKS.want = 'game';
    window.addEventListener('load', () => TRACKS.want === 'game' && playGameMusic(), { once: true });
    return;
  }
  TRACKS.want = 'game';
  if (TRACKS.lobby) fadeTo(TRACKS.lobby, 0, 1);
  if (!PREFS.musicOn) return;
  const g = TRACKS.game || localGameTrack();
  if (!g) return musicStartProcedural();
  musicStopProcedural();
  const start = () => {
    if (isFinite(g.duration) && g.duration > 60) g.currentTime = Math.random() * (g.duration - 30);
    g.volume = 0;
    playSafe(g);
    fadeTo(g, trackVolume('game'), 2.5);
  };
  if (g.readyState >= 1) start();
  else g.addEventListener('loadedmetadata', start, { once: true });
}
function stopAllMusic() {
  if (TRACKS.local) fadeTo(TRACKS.local, 0, 0.5);
  if (TRACKS.lobby) fadeTo(TRACKS.lobby, 0, 0.5);
  if (TRACKS.game) fadeTo(TRACKS.game, 0, 0.5);
  musicStopProcedural();
}
function refreshTrackVolumes() {
  if (TRACKS.want === 'lobby' && TRACKS.lobby && !TRACKS.lobby.paused) TRACKS.lobby.volume = trackVolume('lobby');
  const g = TRACKS.game || TRACKS.local;
  if (TRACKS.want === 'game' && g && !g.paused) g.volume = trackVolume('game');
}
// ---- fichier de musique de jeu choisi par le joueur (stocké localement) ----
function setGameTrack(blob, name) {
  if (TRACKS.gameUrl) URL.revokeObjectURL(TRACKS.gameUrl);
  TRACKS.gameUrl = URL.createObjectURL(blob);
  TRACKS.game = new Audio(TRACKS.gameUrl);
  TRACKS.game.loop = true;
  TRACKS.game.preload = 'metadata';
  TRACKS.gameName = name || 'custom';
  for (const id of ['gameTrackName', 'lobbyTrackName']) if ($(id)) $(id).textContent = TRACKS.gameName;
}
function trackDb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('arenaTracks', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('t');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) {
      rej(e);
    }
  });
}
async function saveGameTrack(file) {
  setGameTrack(file, file.name);
  try {
    const db = await trackDb();
    db.transaction('t', 'readwrite').objectStore('t').put({ blob: file, name: file.name }, 'game');
  } catch (_) {}
  if (TRACKS.want === 'game') playGameMusic();
}
async function clearGameTrack() {
  if (TRACKS.game) TRACKS.game.pause();
  TRACKS.game = null;
  TRACKS.gameName = '';
  for (const id of ['gameTrackName', 'lobbyTrackName']) if ($(id)) $(id).textContent = 'Arena soundtrack';
  try {
    const db = await trackDb();
    db.transaction('t', 'readwrite').objectStore('t').delete('game');
  } catch (_) {}
  if (TRACKS.want === 'game') playGameMusic();
}
(async () => {
  try {
    const db = await trackDb();
    const r = db.transaction('t').objectStore('t').get('game');
    r.onsuccess = () => r.result && setGameTrack(r.result.blob, r.result.name);
  } catch (_) {}
})();
// Bouton du lobby : même sélecteur de fichier que les réglages (le fichier reste sur l'appareil).
$('lobbyTrackBtn').onclick = () => $('gameTrackInput').click();
