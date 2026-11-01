'use strict';
// Musiques enregistrées (fichiers audio) par-dessus le moteur procédural (music.js) :
//  - lobby : assets/audio/lobby.mp3 en boucle tant que l'écran de sélection est ouvert ;
//  - musique de jeu par défaut : assets/audio/game.mp3 (fournie par l'utilisateur, publiée), chargée seulement
//    au lancement d'une partie (fichier lourd).
const TRACKS = { lobby: null, local: undefined, want: 'none' };
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
      if (TRACKS.want === 'game') musicStartProcedural();
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
  const g = localGameTrack();
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
  musicStopProcedural();
}
function refreshTrackVolumes() {
  if (TRACKS.want === 'lobby' && TRACKS.lobby && !TRACKS.lobby.paused) TRACKS.lobby.volume = trackVolume('lobby');
  const g = TRACKS.local;
  if (TRACKS.want === 'game' && g && !g.paused) g.volume = trackVolume('game');
}
// Clic de souris des options d'interface (lobby, réglages, résultats, boutons du haut) : assets/audio/click.mp3.
// Pas sur la barre de sorts ni sur les commandes mobiles (gameplay). Plusieurs lecteurs : clics rapprochés.
const UI_CLICK = { pool: [], i: 0 };
function uiClickSound() {
  if (!UI_CLICK.pool.length)
    for (let k = 0; k < 4; k++) UI_CLICK.pool.push(new Audio('assets/audio/click.mp3?v=' + (window.ASSET_V || 1)));
  const a = UI_CLICK.pool[UI_CLICK.i++ % UI_CLICK.pool.length];
  a.volume = clamp(0.5 * PREFS.volume, 0, 1);
  a.currentTime = 0;
  a.play().catch(() => {});
}
document.addEventListener(
  'pointerdown',
  e => {
    if (e.button !== 0) return;
    const el = e.target.closest?.('button, .iconChoice, .mapCard, [data-sort], input[type=range]');
    if (!el || el.disabled || el.closest('#skills, #mobileControls')) return;
    uiClickSound();
  },
  true
);
