# Arena Ascendant — instructions pour Claude Code

Prototype d'arène 3v3 fantasy (feeling MMO arena) jouable dans le navigateur. Projet démarré avec GPT, repris ici.
**Spécifications validées (à respecter, source des régressions passées) : [docs/SPEC.md](docs/SPEC.md), testées par `tests/spec.test.js`.**
Documentation complète (mécaniques, historique des régressions, décisions validées) : [docs/HANDOFF.md](docs/HANDOFF.md). **La lire avant toute modification non triviale.**

L'utilisateur communique en français : répondre en français.

## État réel du repo (vérifié au 03/11/2026, fait foi sur HANDOFF.md)

- `index.html` : HTML + CSS + liste ordonnée des scripts (~30 Ko). Tout le JS est dans `src/` (scripts classiques, pas de bundler : le jeu se lance en double-clic, `file://`). **L'ordre des balises <script> compte** (code exécuté au chargement).
- `src/` (un fichier par rôle) :
  - `data/classes.js` : classes, races, barres de forme/camouflage (données ; mécanique des formes et du camouflage : `game/forms.js`), accès `skillsOf` et **`SPELLS` = source unique des valeurs et textes de chaque sort** (dégâts, soins, durées, temps d'incantation, infobulle). Pour changer une valeur : modifier `SPELLS` ; `ui/skillbar.js` (infobulles) et `game/spells.js` les lisent. Portée/école de chaque case : `SKILL_META` (même fichier, aligné sur l'ordre de `CLASS[cls].skills`).
  - `game/spells.js` : **`SPELL_CAST` = mécanique de chaque sort, par nom** (`run(c)` effet, renvoie `false` si impossible ; `fx(c)` visuel ; options `mobility`, `noFace`, `usableStunned`). `useSkill` (combat.js) ne fait que les vérifications communes (étourdi, recharges, ressource, cible) puis appelle l'entrée. Sorts de forme/camouflage (champ `k`) : `useSpecialSkill` (`game/forms.js`, avec `setForm` / `setStealth` / `syncBar`). Rôles d'IA : `AI_ROLE` (`game/ai.js`) par nom de sort, convertis en numéros de case au chargement.
  - Armures (`ARMOR`, `CLASS_ARMOR` dans `data/classes.js`) : plaque/cuir/tissu réduisent les dégâts physiques/magiques (`armorReduction`, appliqué dans `damage()` selon `src.curSchool`). PV par classe : `hp` dans `CLASS`. Cadence des auto-attaques : `SWING` (`game/rules.js`). Trinket PvP : `TRINKET` (`data/classes.js`).
  - Format 1v1 / 2v2 / 3v3 : `TEAM_SIZE` + `teamsFor()` dans `game/combat.js` (composition des équipes), choix « Mode » du lobby (`#sizeChoices`, `ui/settings.js`), `?size=` dans l'URL.
  - Match : `game/match.js` (3 manches `MATCH_ROUNDS`, stats dégâts/soins/kills par place `slotIndex`, écran de résultats, Play again / Back to lobby).
  - Cartes : `data/maps.js` (`MAPS` : dimensions, obstacles = cercles de LOS/collision, sanctuaires ; `applyMap(id)` remplit `arena` + `HEALTH_SPOTS`, reconstruit décor et occultants). Décor : une carte = `render/map_<id>.js` enregistrée par `ArenaEnv.registerMap` (`map_castle.js` = arène du château, son horizon forêt / montagnes / château lointain dans `map_castle_horizon.js` ; `map_bridge.js`), outils communs `ArenaEnv.helpers` (`environment.js`). Vignettes du lobby : `assets/ui/map_thumbs.js` (captures du jeu `?map=<id>`). URL de test : `?autoplay=<classe>&race=<race>&map=<id>`.
  - `game/` : `combat.js` (dégâts, contrôles + DR, fuite du fear `updateFearMovement`, interruptions, ruées, `useSkill`), `spells.js` (`SPELL_CAST`), `ai.js` (IA + difficulté, `aiMoveDir` avancer/reculer, `aiSpecial` formes et camouflage), `forms.js` (formes du druide, Stealth, sorts spéciaux `useSpecialSkill`), `player.js` (déplacement du joueur `playerMove` : clavier, souris, joystick, base de trajectoire `moveBaseYaw` / `orbitBase` partagée avec `input/controls.js` et le réglage « Camera returns behind you »), `rules.js` (mouton, auto-attaque, cibles `hostileTarget` / `friendlyTarget`, sanctuaires de soin `updateHealthShrines`), `sim.js` (pas de simulation 120 Hz).
  - `render/` (un fichier par rôle, scripts globaux chargés dans l'ordre d'index.html) :
    - personnages three.js en arène : `heroes3d.js` (état `HF`, chargement des kits, création / synchronisation des modèles, `hfRender`, occultants, silhouettes sous le pont), `hero_anim.js` (clips `hfSetAnim`, impact des attaques `ATTACK_HIT`, pas `FOOT_CONTACTS`, mains sur l'arme IK, traînée de lame), `hero_decor.js` (échelle et traits de race, ornements de classe, aura, racines), `beasts.js` (formes du druide panthère / ours, mouton du Polymorph), `portraits.js` (portraits des cadres) ;
    - prévisualisation du lobby : `preview3d.js` (`updateSelectPreview3D`, socle `previewPedestalTexture`, `previewFallbackModel`) ;
    - monde : `world.js` (boucle `render`, caméra, interpolation), `arena_fallback.js` (init du décor `ENV`, arène de secours, sanctuaires), `units_fallback.js` (personnages de secours WebGL), `cc_marks.js` (marques de contrôle au-dessus des têtes), `fx_webgl.js` (effets historiques), `overlay.js` (noms / barres flottants, chiffres de dégâts) ;
    - décor : `environment.js` (moteur : scène, ombres, rendu, textures communes `ArenaEnv.helpers`), cartes `map_<id>.js` ; effets de sorts : `effects.js`.
  - `characters/` : `kits.js` (données des 35 kits, lu aussi par `tools/build_characters.js`), `builder.js` (assemblage `CharacterKit.build`, rendu illustration, chargement des assets) et ses pièces partagées par `root.CharacterParts`, chargées avant lui (index.html et `tools/char_viewer.html`) : `rig.js` (outils : couleurs, recoloration, squelette, fixation sur un os), `glow.js` (lueurs, feux follets, armes enchantées, yeux, orbes, effets de main, crânes), `weapons.js` (armes, bâtons), `cloth.js` (robes, capes, tabards), `armor.js` (armures procédurales), `head.js` (traits de race, visage, barbe).
  - Bruitages : `audio/sfx.js` (synthèse) + sons enregistrés sous licences libres `assets/audio/sfx_pack.js` (base64, généré par `node tools/build_sfx_pack.js` depuis `assets_src/audio/`, licences dans `assets/audio/LICENSES.md`) : `sfxSample(kind…)`, arme et voix d'une unité `sfxWho(u)`, cri `SFX.effort(u)`. Ajouter un son : le déposer dans `assets_src/audio/`, l'ajouter à `PACK` dans l'outil, compléter LICENSES.md.
  - Musique : `audio/tracks.js` (lobby = `assets/audio/lobby.mp3` fourni par l'utilisateur ; musique de jeu = `assets/audio/game.mp3` (fournie par l'utilisateur, sans droits Blizzard selon lui) ; départ aléatoire, volume bas `TRACK_VOL`), repli `audio/music.js` (procédural).
  - Thème visuel (couleurs, cadres, boutons, fond de prévisualisation) : `src/ui/theme.css` (surcharges, chargé après le CSS d'index.html).
  - Lobby (design de l'utilisateur) : `src/ui/lobby.css` (mise en page + décor, scopé `#overlay` / `body.lobby` ; cadre doré et rubans en CSS pur, cartes de même taille via `--hc`/`--cw`) et `src/ui/lobby.js` (`body.lobby` suit `#overlay`, `lobbyCardArt`, feu animé des torches `TORCHES` + `lobbyTorches`, positions dans les images de murs). Images dans `assets/ui/lobby/`, découpées de la maquette (`assets_src/ui/interface_target.png`) et de la panoplie d'UI de l'utilisateur (`assets_src/ui/kit_*.png`, fonds transparents : cadres, rubans, icônes, curseurs ; `kit_18` = cadres du lobby) par `node tools/build_lobby_assets.js` (coordonnées dans le script). Socle 3D de la prévisualisation : `previewPedestalTexture` dans `render/preview3d.js`.
  - Interface en jeu PC (design de l'utilisateur, maquette `assets_src/ui/interface_in_game.png`) : `src/ui/hud.css` (scopé `body:not(.mobile-mode)`, barres du haut/bas aussi `:not(.lobby)`), images `assets/ui/hud/` découpées de sa panoplie `assets_src/ui/hud_kit_1..6.png` par `node tools/build_hud_assets.js` (coordonnées dans le script). Cadres d'unité à proportions fixes : portrait/barres/textes placés en % de l'image source ; l'image du cadre est dans `::before` (au-dessus du portrait) ; les barres peintes font le remplissage, la partie vide est recouverte (`.fill::after`). Buffs : `buffList` dans `ui/hud.js`.
  - Fin de match PC (Victory / Defeat, design de l'utilisateur) : `src/ui/results.css` (cadre en 3 couches haut / bande étirée / bas, tout en unité `--u` calculée sur la hauteur via `cqh`) + `src/ui/results.js` (canevas `#resultsFx` : flammes des torches, étincelles / braises) ; images `assets/ui/results/` par `node tools/build_results_assets.js` (score peint effacé, bouton rouge recoloré). Auras au-dessus des personnages : `buffList` / `debuffList` (`ui/hud.js`), sort source noté par `markDebuff` (`SPELL_NOW`, `game/combat.js`).
  - Lobby, 2e design (`assets_src/ui/lobby_interface.png`) : fin de `src/ui/lobby.css` (surcharges), images `assets/ui/lobby2/` par `node tools/build_lobby2_assets.js` (planches opaques : fond sombre rendu transparent par remplissage depuis les bords). Récapitulatif `#lobbyChips` (`lobbyChipsHTML`) et barre de sorts de la classe choisie (`lobbySkillBar`) dans `ui/settings.js`. Clic d'interface : `uiClickSound` (`audio/tracks.js`, `assets/audio/click.wav`).
  - Icônes de sorts : dessinées par l'utilisateur (`assets_src/ui/spells_all.png`, planche avec cadres et noms) → `node tools/build_spell_icons.js` (cadres détectés automatiquement, nom du sort de chaque case dans `NAMES`) → `assets/ui/spells/<sort>.webp` ; ajouter la clé dans `SPELL_ART` (`ui/icons.js`), sinon `skillIconSVG` (même fichier) garde l'icône vectorielle.
  - Curseurs (gantelet / épée sur ennemi / main verte sur allié) : `src/ui/cursor.js` (`unitAtScreen` sert aussi au ciblage au clic).
  - Jeu en ligne : `src/net/online.js` (PeerJS/WebRTC chargé à la demande, hôte qui fait autorité, invités qui se déplacent en local ; l'hôte garde `NET.guests` (id → connexion, nom, classe, équipe ally/enemy), les unités pilotées ont `remoteId` ; composition `netTeamsFor` dans combat.js). Points d'accroche : `update()` (sim.js), `resetRound` / `tryPlayerSkill` / `useTrinket` (combat.js), `setTarget` (rules.js), `showResults` / `playAgain` / `leaveMatch` (match.js), Play du lobby (settings.js). `NET` est un `var` (lu comme `window.NET`). Test à deux navigateurs : voir l'historique (nécessite Internet, hors `npm test`).
  - Chargement : `src/core/loading.js` (`prepareMatch` à chaque manche, `warmPreview` à l'ouverture). Règles de performance : ne jamais faire varier le nombre de lumières d'une scène three.js (recompile tout), compiler les nouveaux matériaux pendant un chargement (`renderer.compile`), ne rien dessiner de caché.
  - `ui/` (hud, skillbar = barre de sorts + infobulles, settings, mobile), `audio/` (music, sfx), `input/controls.js` (contrôles validés), `core/` (setup = `$`, `PREFS`, touches ; webgl, main = boucle, `perf.js` = compteur `?fps=1` + qualité adaptative `PERF.scale` appliquée aux 3 canevas, `diag.js` = panneau de diagnostic sur l'appareil `?diag=1`, chargé en premier).
- Mise en forme : `npm run format` (Prettier, `.prettierrc.json`). Les tests statiques ignorent les espaces.
- `mobile.html` : simple redirection vers `index.html?mobile=1` (le jeu n'existe qu'en un exemplaire). Ne jamais y recopier le jeu.
- `game_logic.js` : **source unique** de GameLogic (mouvement/caméra), chargé par `index.html` avant `src/` (plus de copie inline).
- Cache navigateur (GitHub Pages garde 10 min) : chaque balise porte `?v=AAAAMMJJHHMM` + `window.ASSET_V` (bundles personnages). **Augmenter ce numéro à chaque publication** (`sed -i -E 's/?v=[0-9]+"/?v=NOUVEAU"/g; s/window.ASSET_V="[0-9]+"/window.ASSET_V="NOUVEAU"/' index.html`).
- Personnages : `src/characters/kits.js` (données) + `src/characters/builder.js` et ses pièces (assemblage three.js) assemblent les packs CC0 Quaternius pour les 35 race+classe : CLASSES (tenue modulaire, palette, robe, arme, armure procédurale ajustée par os : plaques, épaulières, masque, feuilles) + RACES (peau, cheveux, oreilles/défenses/barbe, crâne du mort-vivant, échelles d'os, longueur de lame par classe `weaponLength`). Un skin unique par race+classe. Sources brutes dans `assets_src/` (non versionné, ~480 Mo) → `node tools/build_characters.js` → `assets/characters/*.js` (GLB en base64, indispensable car le jeu est lancé en double-clic / `file://`). Sans kit pour une race+classe, ou si le kit échoue, le jeu garde les anciens modèles KayKit. Visualiseur de dev : `tools/char_viewer.html` + `tools/shoot.js` (servi par `tools/serve.js`).
- Effets de sorts : `src/render/effects.js` (particules additives, anneaux runiques, bulles, éclairs) reçoit les appels `fx()` ; les types non gérés restent dessinés par le moteur WebGL historique.
- Décor : `src/render/environment.js` (moteur three.js, tout procédural) + cartes `map_<id>.js` dessinent sol pierre/herbe, herbe animée, piliers, remparts, château et ciel dans `#env3d`, sous le canevas WebGL du jeu (devenu transparent : effets de sorts + profondeur des piliers). Si le décor échoue, `renderArena()` retombe sur l'arène historique.
- Direction artistique : personnages **originaux** dans le style fantasy MMO. Ne pas les faire ressembler à des personnages Warcraft existants (Jaina, etc.), même par petites retouches successives.
- Les backups `index_*_backup.html` mentionnés dans le handoff ne sont pas dans le repo : utiliser l'historique git.

## Tests

```bash
npm install        # une fois : playwright-core (pilote le Edge/Chrome installé), prettier
npm test           # ~15 s : tests unitaires (combat.test.js, gameplay.test.js, game_logic.test.js), spécifications (spec.test.js), intégration + partie lancée dans le navigateur (tests/browser/smoke.test.js)
npm run test:all   # ~1 min 30 : + test navigateur complet (sélection, 35 kits, 7 classes, Polymorph/saut/pas chassé, mobile)
```

`npm test` après chaque modification ; `npm run test:all` avant de publier. Le navigateur utilise la carte graphique (`tests/browser/browser.js`) ; `SOFTWARE_GL=1` force le rendu logiciel, `BROWSER_PATH` choisit le navigateur. Captures de personnages : `tools/shoot.js` (même lanceur).

## Bonnes pratiques de code (demandées par l'utilisateur, à appliquer à chaque tâche)

But : un code **maintenable**, où l'on sait **tout de suite où regarder et quoi modifier**, pour aller vite sans régression. Si une règle devient contre-productive, le signaler à l'utilisateur au lieu de l'appliquer aveuglément.

**Trouver vite**
- Partir de la carte « État réel du repo » et des « Recettes » ; lire la zone concernée, pas tout le projet.
- Un concept = un endroit = un nom cherchable (`SPELLS`, `SPELL_CAST`, `AI_ROLE`, `MAPS`…) ; une **table de données** lue par le code plutôt que des `if (nom === …)` dispersés.

**SOLID, adapté au projet** (scripts classiques sans classes : les modules sont des fichiers et des tables)
- **S** : un fichier = un rôle (`game/` règles, `render/` dessin, `ui/` interface, `data/` valeurs), une fonction = une action (`dampeningAt` calcule, `heal` applique). Fichier de plus de ~800 lignes ou à deux rôles : le découper.
- **O** : étendre en ajoutant une entrée (`SPELL_CAST` / `SPELLS`, `ArenaEnv.registerMap`, `AI_ROLE`, pièce `characters/` sur `CharacterParts`), pas en ajoutant un `if` dans `useSkill`, `setMap` ou `build`.
- **L** : même contrat pour toutes les entrées d'une table (`run(c)` renvoie `false` si impossible ; carte = `(THREE, S, arena, E)`) ; joueur, IA et ami en ligne passent par les mêmes fonctions.
- **I** : chaque fichier n'importe que ce qu'il utilise (`const { … } = ArenaEnv.helpers` / `root.CharacterParts`).
- **D** : les règles passent par des points d'entrée (`SFX.*`, `fx()`, `addFloat`, `unitError`, `NET`), jamais directement par le DOM, three.js ou le réseau : c'est ce qui les rend testables.

**Écrire et factoriser**
- Chercher (Grep) avant d'écrire une fonction ; à la 3e copie d'un bloc, l'extraire dans le point de partage du rôle (`core/setup.js`, `ArenaEnv.helpers`, `rig.js`, `tests/sources.js`).
- Code neuf : fonctions courtes (~60 lignes max), noms explicites, constantes nommées plutôt que valeurs magiques. Les longues fonctions existantes (`ai`, `renderCharacter`, `hfRender`, `build`…) ne se découpent que si la tâche porte sur elles, dans un commit à part.
- Commentaires : le **pourquoi** (règle validée, piège, mesure), pas le quoi.

**Code mort : zéro** — supprimer tout de suite ce que l'on remplace (fonction, variable, CSS, image, son, branche morte, code commenté), après un Grep dans `index.html`, `src/`, `tests/`, `tools/` (attention aux noms lus dans une table ou une chaîne).

**Refactoring et livraison**
- Une fonctionnalité demandée = une tranche complète livrée d'un coup (données + mécanique + IA + icône…). « Une couche à la fois » (règle 10) veut dire : ne pas toucher au visuel ou aux contrôles par effet de bord d'une autre tâche.
- Refactoring = comportement identique, commit à part. Simplifier au passage ce que la tâche touche ; un chantier plus large se propose, il ne s'improvise pas. Ne jamais « corriger » ce que `docs/SPEC.md` valide.

**Tests : unitaires d'abord**
- Règle de jeu ou fonction pure = test unitaire Node qui vérifie le **résultat** (PV, durée, position, état) :
  - combat (contrôles, DR, dégâts, soins, sorts, incantations, IA) : `tests/combat.test.js` ; `combatWorld()` (`tests/combat_world.js`) = vrai code sur une arène vide ; `unit(classe, x, z, équipe)`, `run(ctx, secondes)` fait avancer `update`, `sounds` = bruitages demandés, `ctx.Math.random` fixable ;
  - déplacement, caméra, cibles : `tests/gameplay.test.js` ;
  - outils : `sandbox(stubs)` de `tests/sources.js` (`load(fichier)`, `fn(fichier, nom)`), `code('src/<dossier>/')` pour lire un dossier.
- Chaque règle nouvelle : une régression volontaire qui doit faire échouer son test, `node tools/mutate.js <test> <fichier> "<extrait>" "<remplacement>"` (fichier toujours restauré).
- Navigateur (`tests/browser/`) : seulement démarrage, rendu, modèles, interface. Tests « texte du code » : seulement pour interdire une régression connue, ou quand le comportement dépend du hasard / du réseau.
- Un bug corrigé = un test qui l'aurait attrapé.
- **Équilibrage** : mesurer avant de changer une valeur, `node tools/duel.js <équipe A> <équipe B> [combats]` (IA contre IA, vrai code, ex. `shade oracle`, `sentinel,oracle arcanist,warlock`) ; pour essayer un réglage sans toucher au jeu, `duel(A, B, durée, ctx => { … })` (`tools/duel.js`).

**Documentation, dans le même commit que le code**
- **Fonctionnelle = `docs/SPEC.md`** : ce que le jeu fait, tel que validé par l'utilisateur ; une ligne par demande validée (🧪 si testée), mise à jour quand la règle change, jamais deux versions contradictoires.
- **Technique = `CLAUDE.md`** : carte des fichiers, recettes, pièges. Garder court : ne pas y recopier ce que le code ou `SPEC.md` disent déjà ; le nettoyer quand il grossit.
- En-têtes de fichiers justes (rôle + fichiers voisins). Avant de publier, relire les lignes des deux documents qui parlent de la zone touchée.

**Relecture avant commit** : relire son `git diff` (bugs, cas limites : unité morte, cible absente, en ligne, mobile ; duplication, code mort, SOLID, test de la règle, docs à jour). Revue complète `/code-review` + `/simplify` seulement pour un gros changement (nouveau système, refactoring large) ou à la demande de l'utilisateur.

## Recettes (pour aller vite)

- **Changer une valeur de sort** (dégâts, durée, recharge…) : `SPELLS` (`data/classes.js`) ; l'infobulle suit seule. Recharge/coût : `cd` / `c` dans `CLASS[cls].skills`.
- **Ajouter / remplacer un sort** : entrée `SPELLS` (valeurs + `text`), place dans `CLASS[cls].skills` + `SKILL_META`, mécanique dans `SPELL_CAST` (`game/spells.js`), rôle dans `AI_ROLE` si l'IA doit l'utiliser, icône : `SPELL_ART` (`ui/icons.js` ; ou `art:` dans `SPELLS` pour réutiliser l'image d'un autre sort). `tests/spec.test.js` vérifie que chaque sort a sa mécanique et chaque rôle d'IA un vrai sort.
- **Effet dans la durée** : `addAura(cible, lanceur, nom, 'dot'|'hot', total, durée, école)` ; affiché seul sur les cadres et au-dessus des personnages (`buffList` / `debuffList`).
- **Contrôle** : `control(t, 'stun'|'root'|'fear'|'poly', durée, src, drKey?)` (rendements décroissants inclus).
- **Images d'interface** fournies par l'utilisateur : planche dans `assets_src/ui/`, coordonnées de découpe dans le `tools/build_*_assets.js` correspondant, sortie `.webp` dans `assets/ui/<écran>/`. Placement en CSS **relatif** uniquement (%, `cqh`, variables `--u`), jamais en pixels.
- **Message d'erreur au joueur** : `unitError(u, texte)` (affiché chez l'ami en ligne aussi), jamais `showError` direct pour une unité.
- **Publier** : `bash tools/publish.sh "message"` (numéro `?v=`, tests, commit, push) ; `FULL=1` pour `test:all`. Spécifications validées par l'utilisateur : `docs/SPEC.md` + un test dans `tests/spec.test.js`.

## Pièges connus

- Fichiers en CRLF et en LF mélangés : les scripts d'édition doivent conserver les fins de ligne (`newline=''` en Python).
- Heredoc bash : pas d'apostrophes ni de `$(` non échappés ; pour un gros script, l'écrire dans un fichier.
- `tests/spec.test.js` lit encore souvent le texte du code : un renommage peut casser un test sans casser le jeu ; mettre le test à jour en gardant la règle (ou le convertir en test de comportement).
- three.js : ne jamais changer le nombre de lumières d'une scène (recompilation de tous les shaders, saccade en combat) ; mettre l'intensité à 0 à la place.
- `NET` doit rester un `var` (lu comme `window.NET`).
- `docs/HANDOFF.md` est historique (démarrage du projet) : `CLAUDE.md` et `docs/SPEC.md` font foi.

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
10. **Une seule couche à la fois** (graphisme ≠ UI ≠ gameplay ≠ contrôles) : ne pas toucher une couche par effet de bord d'une tâche sur une autre ; une fonctionnalité demandée se livre en tranche complète. Petits pas, pas de rewrite.

## Priorités de travail

- P0 : tests unitaires de combat en place (`tests/combat.test.js` : DR, contrôles, Hamstring, Charge, Blink, dampening, Dispel ; chaque test vérifié par une régression volontaire). Aussi : incantations (ressource prise à la fin, interruption, ligne de vue perdue), auras, auto-attaque, IA (sanctuaire), mort et fin de manche, chargement. Restent vérifiés par le texte du code : seuils de fuite / regroupement de l’IA (aléatoires), jeu en ligne, écrans du match.
- P2 : **chantier principal souhaité** — personnages 3D fantasy adultes (Orc massif, Elf élancé, pas de look chibi/Lego), assets permissifs bundlés localement.
- P3 : samples audio CC0/CC-BY + manifest de licences, fallback procédural.
- P4 : décor plus organique (textures, végétation, props).
