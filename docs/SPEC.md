# Arena Ascendant — spécifications validées par l'utilisateur

Chaque point ci-dessous a été **demandé et validé** par l'utilisateur. Toute modification qui les contredit est une régression.
Les points marqués 🧪 sont vérifiés par `tests/spec.test.js` (test rapide, sans navigateur, lancé par `npm test`).
Ajouter une ligne ici (et un test si c'est vérifiable à bas coût) à chaque nouvelle demande validée.

## Contrôles (desktop) — `src/input/controls.js`, `src/ui/cursor.js`
- ZQSD (Q gauche, D droite), Espace saut, molette zoom, TAB cible, 1–6 sorts, R trinket. Signes de `screenRight` / `applyLook` intouchables (`game_logic.js`).
- Clic gauche **ou** droit sans glisser = cibler l'unité sous le curseur.
- Glisser au **clic droit** = caméra **et** orientation/trajectoire du personnage.
- Glisser au **clic gauche** = caméra **seule** : la trajectoire du personnage ne change pas ; au relâchement la caméra revient derrière lui. 🧪
- Gauche + droit enfoncés (dans les deux ordres) = avancer.
- Curseur : gantelet ; épée au-dessus d'un ennemi ; gantelet vert au-dessus d'un allié.

## Contrôles (mobile) — `src/ui/mobile.js`
- Joystick : la déviation franche = vitesse pleine (pas de vitesse réduite à mi-course). 🧪
- Toucher un personnage à l'écran = le cibler.
- Pas de bande sombre sous l'arène (barre du bas transparente) — vérifié par `tests/browser/full.test.js`.

## Sorts et combat — `src/data/classes.js` (`SPELLS`, `SKILL_META`), `src/game/combat.js`
- Polymorph et Fear : **pas de recharge**. 🧪
- Rendements décroissants des CC : 100 % → 50 % → 25 % → immunité, remis à zéro 20 s après. Sur une cible immunisée, le sort part quand même et « Immune » s'affiche.
- Interruptions (Pummel, Counterspell, Spell Lock) : verrouillent l'école 4 s.
- Charge (guerrier) : étourdit 2 s. Wild Charge (druide) : immobilise 2 s.
- Death Grip : la cible est tirée devant le lanceur. Death Advance : bond dans la direction regardée.
- Cloak (voleur) : immunité aux **sorts** 5 s (pas aux coups d'arme), retire racines et ralentissements magiques.
- Sort qui échoue faute de ligne de vue : ressource et recharge rendues.
- Voleur : frappe 2× plus vite qu'un guerrier pour la moitié des dégâts (même DPS). 🧪

## Classes, formes, armures
- Armure plaque (guerrier, chevalier de la mort) > cuir (druide, voleur) > tissu (mage, prêtre, démoniste). 🧪
- Druide : félin = +30 % de vitesse ; ours = +40 % PV, -30 % dégâts subis. 🧪
- Voleur camouflé : -30 % de vitesse. 🧪
- **Icônes du druide : Cat Form = griffures, Bear Form = empreinte de patte.** 🧪
- Voleur : deux glaives (une lame en croissant de chaque côté de la main), tranchant dans le sens de la frappe, enchantement vert lumineux, les deux mains orientées pareil.

## Interface
- Jeu entièrement en anglais (vérifié par `tests/integration.test.js`).
- Le joueur ne choisit pas la musique : lobby = `assets/audio/lobby.mp3`, jeu = `assets/audio/game.mp3`.
- Icônes de sorts : l'illustration remplit tout le carré, le nom en bas par-dessus ; GCD et recharges affichés par un balayage circulaire ; retour visuel à l'appui.
- Lobby : design de l'utilisateur (`interface_target.png`) — murs de bois et torches, blason en haut, cadre doré, titres en ruban, cartes de race/classe illustrées, prévisualisation devant les voûtes du donjon sur un socle de pierre, plaque du chrono. Bande du bas plus fine sur PC. Tout tient dans la page en 1366×768 (vérifié par `full.test.js`) ; si la fenêtre est trop petite, défilement **dans le cadre** avec une barre au style de l'UI. Le même design sera appliqué en jeu ensuite.
- Lobby (suite) : les deux torches ont un **vrai feu animé** (pas d'image figée) ; le cadre doré (grand cadre et cadre de la prévisualisation) vient de la panoplie de l'utilisateur (`assets_src/ui/kit_18.png`, angles continus, pas une simple bande) ; rubans sans ligne sous les titres ; pas de petites phrases (« same model as in the arena », « Choose a race and a class ») ; toutes les cartes de race et de classe ont **la même taille** (classes centrées 4 + 3). 🧪

## Cartes — `src/data/maps.js`, `src/render/environment.js`, `src/render/map_*.js`
- « The Castle » : ne pas modifier sans demande. Le décor suit toujours la carte de gameplay (test dans `smoke.test.js`).
- « The Bridge » : pont accessible par deux rampes à chaque extrémité (de part et d'autre, perpendiculaires au pont) ; on peut lancer des sorts depuis le tablier ; pas de ligne de vue entre le tablier et le dessous du pont. 🧪
- « The Bridge » : bois « fantasy » (planches peintes, joints, nœuds, clous, chapeaux de bronze, lanternes). Un personnage caché par le pont (vu du dessus ou du dessous) apparaît en **silhouette translucide**, jamais en clair par-dessus le tablier ; pas de silhouette pour un camouflé. 🧪 (`hfRenderGhosts` dans `heroes3d.js`) (`surfaceAt`, `groundAt`, `blockedBySurface`, `bridgeRail` dans `maps.js`)

## Fluidité et performances — `src/core/perf.js`, `src/render/*`
- `?fps=1` affiche un compteur (images/s, temps CPU par couche de rendu, pas de simulation par image).
- Qualité adaptative : sous 50 images/s en partie, la résolution des canevas baisse par paliers (55 % minimum) ; si la baisse ne fait rien gagner, la résolution d'avant est rendue et ne bouge plus. 🧪
- Tout ce qui suit un personnage (modèle, ombre, noms, effets) utilise la position interpolée, jamais la position brute de simulation. 🧪
- The Bridge : la passe des silhouettes ne tourne que si le pont cache réellement quelqu'un (`hfBridgeHides`). 🧪
- Caméra : le zoom à la molette glisse (≈ 0,2 s) au lieu de sauter ; derrière un pilier la caméra se rapproche immédiatement et se recule en douceur (`CAM_VIEW` dans `world.js`). Le personnage pivote vite mais sans claquer et s'incline légèrement dans les virages (visuel seulement, la simulation garde l'orientation exacte). 🧪
- Combat : l'animation de frappe démarre juste avant l'impact (`ATTACK_HIT` dans `heroes3d.js`) pour que la lame touche avec les dégâts et le son, sans rien retarder. Chiffres de dégâts colorés par école (`SCHOOL_COLOR`), critiques en gros avec « ! ». Barre d'incantation des ennemis plus grande, lumineuse, avec le temps restant. 🧪
- IA (déterministe, pas de mobilité aléatoire) : contourne les piliers (`aiSteer`) ; lanceur/soigneur ciblé et sous 40 % PV se met à couvert derrière un pilier jusqu'à 65 % (`aiCover`, pas en Easy) ; protège son soigneur frappé par une mêlée (`aiPeel`) ; enchaîne les contrôles au lieu de les superposer (`ccReady`). 🧪
- **Refusé par l'utilisateur : pas de secousses de caméra, pas d'accélération/freinage progressifs, aucun délai ajouté (pas de micro-gel sur les coups).**
