# Arena Ascendant — instructions pour Claude Code

Prototype d'arène 3v3 fantasy (feeling MMO arena) jouable dans le navigateur. Projet démarré avec GPT, repris ici.
**Spécifications validées (à respecter, source des régressions passées) : [docs/SPEC.md](docs/SPEC.md), testées par `tests/spec.test.js`.**
Documentation complète (mécaniques, historique des régressions, décisions validées) : [docs/HANDOFF.md](docs/HANDOFF.md). **La lire avant toute modification non triviale.**

L'utilisateur communique en français : répondre en français.

## État réel du repo (vérifié au 31/10/2026, fait foi sur HANDOFF.md)

- `index.html` : HTML + CSS + liste ordonnée des scripts (~30 Ko). Tout le JS est dans `src/` (scripts classiques, pas de bundler : le jeu se lance en double-clic, `file://`). **L'ordre des balises <script> compte** (code exécuté au chargement).
- `src/` (un fichier par rôle) :
  - `data/classes.js` : classes, races, barres de forme/camouflage et **`SPELLS` = source unique des valeurs et textes de chaque sort** (dégâts, soins, durées, temps d'incantation, infobulle). Pour changer un sort : modifier `SPELLS` ; `game/combat.js` (effets, `useSkill`) et `ui/skillbar.js` (infobulles) lisent ces champs.
  - Armures (`ARMOR`, `CLASS_ARMOR` dans `data/classes.js`) : plaque/cuir/tissu réduisent les dégâts physiques/magiques (`armorReduction`, appliqué dans `damage()` selon `src.curSchool`). PV par classe : `hp` dans `CLASS`. Cadence des auto-attaques : `SWING` (`game/rules.js`).
  - Match : `game/match.js` (3 manches `MATCH_ROUNDS`, stats dégâts/soins/kills par place `slotIndex`, écran de résultats, Play again / Back to lobby).
  - Cartes : `data/maps.js` (`MAPS` : dimensions, obstacles = cercles de LOS/collision, sanctuaires ; `applyMap(id)` remplit `arena` + `HEALTH_SPOTS`, reconstruit décor et occultants). Décor : `castle` dans `render/environment.js` (`buildCastleMap`), autres cartes dans `render/map_<id>.js` via `ArenaEnv.registerMap`. Vignettes du lobby : `assets/ui/map_thumbs.js` (captures du jeu `?map=<id>`). URL de test : `?autoplay=<classe>&race=<race>&map=<id>`.
  - `game/` : `combat.js` (dégâts, contrôles + DR, interruptions, ruées, sorts), `ai.js` (IA + difficulté), `rules.js` (mouton, auto-attaque, cibles), `sim.js` (pas de simulation 120 Hz).
  - `render/` : `heroes3d.js` (personnages three.js, preview, portraits), `world.js` (décor + rendu de secours + noms), `environment.js` (décor), `effects.js` (effets de sorts).
  - `characters/` : `kits.js` (données des 35 kits, lu aussi par `tools/build_characters.js`), `builder.js` (assemblage three.js).
  - Musique : `audio/tracks.js` (lobby = `assets/audio/lobby.mp3` fourni par l'utilisateur ; musique de jeu = `assets/audio/game.mp3` (fournie par l'utilisateur, sans droits Blizzard selon lui) ; départ aléatoire, volume bas `TRACK_VOL`), repli `audio/music.js` (procédural).
  - Thème visuel (couleurs, cadres, boutons, fond de prévisualisation) : `src/ui/theme.css` (surcharges, chargé après le CSS d'index.html).
  - Lobby (design de l'utilisateur) : `src/ui/lobby.css` (mise en page + décor, scopé `#overlay` / `body.lobby` ; cadre doré et rubans en CSS pur, cartes de même taille via `--hc`/`--cw`) et `src/ui/lobby.js` (`body.lobby` suit `#overlay`, `lobbyCardArt`, feu animé des torches `TORCHES` + `lobbyTorches`, positions dans les images de murs). Images dans `assets/ui/lobby/`, découpées de la maquette (`assets_src/ui/interface_target.png`) et de la panoplie d'UI de l'utilisateur (`assets_src/ui/kit_*.png`, fonds transparents : cadres, rubans, icônes, curseurs ; `kit_18` = cadres du lobby) par `node tools/build_lobby_assets.js` (coordonnées dans le script). Socle 3D de la prévisualisation : `previewPedestalTexture` dans `render/heroes3d.js`.
  - Icônes de sorts : dessinées par l'utilisateur (`assets_src/ui/spells_*.png`, planches avec cadres et noms) → `node tools/build_spell_icons.js` (coordonnées des cadres + nom du sort de chaque case) → `assets/ui/spells/<sort>.webp` ; ajouter la clé dans `SPELL_ART` (`data/classes.js`), sinon `skillIconSVG` garde l'icône vectorielle.
  - Curseurs (gantelet / épée sur ennemi / main verte sur allié) : `src/ui/cursor.js` (`unitAtScreen` sert aussi au ciblage au clic).
  - `ui/` (hud, skillbar, settings, mobile), `audio/` (music, sfx), `input/controls.js` (contrôles validés), `core/` (setup, webgl, main = boucle, `perf.js` = compteur `?fps=1` + qualité adaptative `PERF.scale` appliquée aux 3 canevas).
- Mise en forme : `npm run format` (Prettier, `.prettierrc.json`). Les tests statiques ignorent les espaces.
- `mobile.html` : simple redirection vers `index.html?mobile=1` (le jeu n'existe qu'en un exemplaire). Ne jamais y recopier le jeu.
- `game_logic.js` : **source unique** de GameLogic (mouvement/caméra), chargé par `index.html` avant `src/` (plus de copie inline).
- Cache navigateur (GitHub Pages garde 10 min) : chaque balise porte `?v=AAAAMMJJHHMM` + `window.ASSET_V` (bundles personnages). **Augmenter ce numéro à chaque publication** (`sed -i -E 's/?v=[0-9]+"/?v=NOUVEAU"/g; s/window.ASSET_V="[0-9]+"/window.ASSET_V="NOUVEAU"/' index.html`).
- Personnages : `src/characters/kits.js` (données) + `src/characters/builder.js` (assemblage three.js) assemblent les packs CC0 Quaternius pour les 35 race+classe : CLASSES (tenue modulaire, palette, robe, arme, armure procédurale ajustée par os : plaques, épaulières, masque, feuilles) + RACES (peau, cheveux, oreilles/défenses/barbe, crâne du mort-vivant, échelles d'os). Un skin unique par race+classe. Sources brutes dans `assets_src/` (non versionné, ~480 Mo) → `node tools/build_characters.js` → `assets/characters/*.js` (GLB en base64, indispensable car le jeu est lancé en double-clic / `file://`). Sans kit pour une race+classe, ou si le kit échoue, le jeu garde les anciens modèles KayKit. Visualiseur de dev : `tools/char_viewer.html` + `tools/shoot.js` (servi par `tools/serve.js`).
- Effets de sorts : `src/render/effects.js` (particules additives, anneaux runiques, bulles, éclairs) reçoit les appels `fx()` ; les types non gérés restent dessinés par le moteur WebGL historique.
- Décor : `src/render/environment.js` (three.js, tout procédural) dessine sol pierre/herbe, herbe animée, piliers, remparts, château et ciel dans `#env3d`, sous le canevas WebGL du jeu (devenu transparent : effets de sorts + profondeur des piliers). Si le décor échoue, `renderArena()` retombe sur l'arène historique.
- Direction artistique : personnages **originaux** dans le style fantasy MMO. Ne pas les faire ressembler à des personnages Warcraft existants (Jaina, etc.), même par petites retouches successives.
- Les backups `index_*_backup.html` mentionnés dans le handoff ne sont pas dans le repo : utiliser l'historique git.

## Tests

```bash
npm install        # une fois : playwright-core (pilote le Edge/Chrome installé), prettier
npm test           # ~15 s : tests de code (logique, intégration, pas) + partie lancée dans le navigateur (tests/browser/smoke.test.js)
npm run test:all   # ~1 min 30 : + test navigateur complet (sélection, 35 kits, 7 classes, Polymorph/saut/pas chassé, mobile)
```

`npm test` après chaque modification ; `npm run test:all` avant de publier. Le navigateur utilise la carte graphique (`tests/browser/browser.js`) ; `SOFTWARE_GL=1` force le rendu logiciel, `BROWSER_PATH` choisit le navigateur. Captures de personnages : `tools/shoot.js` (même lanceur).

## Règles non négociables

1. **Contrôles desktop validés = intouchables** : ZQSD (Q gauche, D droite), Espace saut, glisser clic droit = caméra + personnage, glisser clic gauche = caméra seule, clic gauche OU droit sans glisser = cibler, gauche + droit (tout ordre) = avancer, molette zoom, TAB cible, 1–6 sorts, R trinket (code : `src/input/controls.js`, avance souris dans `playerMove`). Ne jamais « corriger » les signes de `screenRight` / `applyLook` (convention contre-intuitive mais validée ; inversée plusieurs fois par le passé).
2. **UI de sélection race/classe : ne pas la restructurer** sans demande explicite. « Améliorer les personnages » = modèle 3D, proportions, matériaux, équipement, détails raciaux uniquement.
3. **La classe choisit le modèle, la race est secondaire** (Orc Mage = modèle Mage + traits Orc). Preview et arène utilisent le même modèle.
4. Simulation fixe 120 Hz (`SIM_DT`) + interpolation `renderAlpha` ; téléportations avec `visualSnap`.
5. Blink = facing (pas la cible) ; Charge = vraie ruée (pas de téléport) ; Hamstring = slow 50 % (pas root) ; Fear = fuite réelle avec DR ; death animation `LoopOnce`.
6. Garder dampening + équilibre Priest. Pas de mobilité aléatoire dans l'IA.
7. Fallback personnage uniquement si chargement `failed` (pas `pending`). Garder `previewFallbackModel()` et un seul canvas preview.
8. Mobile = couche d'input/UI supplémentaire sur le même gameplay ; pas de ligne Grid vide sous l'arène.
9. **Aucun asset Blizzard/WoW** (modèles, textures, sons, icônes). Assets originaux ou licences permissives uniquement.
10. **Une seule couche à la fois** (graphisme ≠ UI ≠ gameplay ≠ contrôles). Petits pas, pas de rewrite.

## Priorités de travail

- P0 : enrichir les tests gameplay (Blink/Charge, CC/DR, Hamstring, dampening) en navigateur.
- P2 : **chantier principal souhaité** — personnages 3D fantasy adultes (Orc massif, Elf élancé, pas de look chibi/Lego), assets permissifs bundlés localement.
- P3 : samples audio CC0/CC-BY + manifest de licences, fallback procédural.
- P4 : décor plus organique (textures, végétation, props).
