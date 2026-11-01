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
- Cadres de son équipe (et le sien) collés au bord gauche de l'écran (4 px, sans la marge de l'encoche). 🧪
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
- Pas : le son tombe quand le pied touche le sol dans l'animation (`FOOT_CONTACTS`, mesuré sur les os des pieds), aussi en marche arrière ; ses propres pas bien audibles ; ceux des autres de plus en plus forts en approchant, silencieux au-delà de 24 m (`FOOT_HEAR`), à gauche/droite selon la caméra (`footstepSpatial` dans `settings.js`). 🧪 (`footstep_sync.test.js`)
- PC en jeu : bande du bas fine (84 px, comme au lobby), boutons de sorts carrés de 68 px. 🧪
- Auras **au-dessus des personnages** (barre de nom, soi-même compris ; pas dans les cadres latéraux) : buffs à **gauche** de la barre de vie (cadre doré), débuffs posés par les adversaires à **droite** (cadre rouge : contrôles, ralentissements, verrou d'école, blessure anti-soin), icône du sort et temps restant ; un bouclier affiche son absorption. `buffList` / `debuffList` dans `hud.js` ; le combat note le sort de chaque effet (`SPELL_NOW`, `markDebuff`). 🧪
- Interface en jeu (PC) : design de l'utilisateur (maquette `assets_src/ui/interface_in_game.png`, panoplie `hud_kit_1..6.png` → `node tools/build_hud_assets.js` → `assets/ui/hud/`, styles `src/ui/hud.css`) : barres de bois cerclées d'or, blason suspendu, boutons sertis avec icônes, plaque du chrono, cases de sorts dorées, panneau des contrôles, pastilles. Cadres d'unité de la panoplie : portrait dans le cercle, emblème de classe dans le médaillon, barres peintes (la partie vide est recouverte). Incantation d'un adversaire à la place de son nom ; celle de la cible à gauche de son cadre. Le mobile et le lobby gardent leur interface. 🧪
- Barre de sorts : un clic souris lance le sort ; au survol, l'icône ne bouge pas. Les boutons sont construits une fois par barre, seuls recharges et états changent ensuite (`renderSkillBar`) ; un bouton cliqué ne prend pas le focus (Espace = saut). Icônes centrées verticalement dans la barre du bas. 🧪
- Se cibler soi-même (ou un allié) : plus d'auto-attaque sur l'ennemi d'en face, posture droite (pas de garde de combat). 🧪
- « Change class » en partie : confirmation (Leave / Stay) ; Leave arrête réellement le match (plus de simulation ni de sons), revient au lobby avec sa musique, race et classe présélectionnées. 🧪
- Lobby : pas de sous-titre « 1v1 to 3v3 · WebGL… » ni d'infos en bas à gauche ; en jeu, pas de bulles (mobility, stun…) sur la barre du bas. 🧪
- Le joueur ne choisit pas la musique : lobby = `assets/audio/lobby.mp3`, jeu = `assets/audio/game.mp3`.
- Icônes de sorts **dessinées par l'utilisateur** (planche `assets_src/ui/spells_all.png` → `node tools/build_spell_icons.js` → `assets/ui/spells/`, liste `SPELL_ART` dans `classes.js`) pour **tous** les sorts et le trinket : elles remplacent entièrement l'ancienne icône ; l'illustration (sans le cadre de la planche) remplit **tout le bouton**, même non carré (pas de bandes sur les côtés), la bordure reste celle du jeu. 🧪
- Icônes de sorts : l'illustration remplit tout le carré, le nom en bas par-dessus ; GCD et recharges affichés par un balayage circulaire ; retour visuel à l'appui.
- Lobby : design de l'utilisateur (`interface_target.png`) — murs de bois et torches, blason en haut, cadre doré, titres en ruban, cartes de race/classe illustrées, prévisualisation devant les voûtes du donjon sur un socle de pierre, plaque du chrono. Bande du bas plus fine sur PC. Tout tient dans la page en 1366×768 (vérifié par `full.test.js`) ; si la fenêtre est trop petite, défilement **dans le cadre** avec une barre au style de l'UI. Le même design sera appliqué en jeu ensuite.
- Lobby (suite) : les deux torches ont un **vrai feu animé** (pas d'image figée) ; le cadre doré (grand cadre et cadre de la prévisualisation) vient de la panoplie de l'utilisateur (`assets_src/ui/kit_18.png`, angles continus, pas une simple bande) ; rubans sans ligne sous les titres ; pas de petites phrases (« same model as in the arena », « Choose a race and a class ») ; toutes les cartes de race et de classe ont **la même taille** (classes centrées 4 + 3). 🧪

## Formats de match — `src/game/combat.js` (`TEAM_SIZE`, `teamsFor`), lobby « Mode »
- Le joueur choisit **1v1, 2v2 ou 3v3** au lobby (mémorisé ; `?size=1|2|3` pour les tests). 3v3 par défaut, inchangé.
- 2v2 : vous + un soigneur (ou un guerrier si vous êtes prêtre) contre chevalier de la mort + prêtre. 1v1 : contre un chevalier de la mort (un guerrier si vous jouez chevalier de la mort), jamais un soigneur seul. 🧪

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
- Combat : l'animation de frappe démarre juste avant l'impact (`ATTACK_HIT` dans `heroes3d.js`) pour que la lame touche avec les dégâts et le son, sans rien retarder. Chiffres de dégâts colorés par école (`SCHOOL_COLOR`), critiques en gros avec « ! ». Barre d'incantation des ennemis plus grande, lumineuse, avec le temps restant, affichée au-dessus du nom **sans élargir la barre de vie** (régression corrigée : la barre de vie de la cible gonflait pendant ses incantations). 🧪
- IA (déterministe, pas de mobilité aléatoire) : contourne les piliers (`aiSteer`) ; lanceur/soigneur ciblé et sous 40 % PV se met à couvert derrière un pilier jusqu'à 65 % (`aiCover`, pas en Easy) ; protège son soigneur frappé par une mêlée (`aiPeel`) ; enchaîne les contrôles au lieu de les superposer (`ccReady`). 🧪
- IA sans tremblement : contre un mur, un pilier ou le flanc d'une rampe, elle longe l'obstacle (toujours du même côté) ou s'arrête, jamais de course sur place (`aiStep`) ; contournement d'un pilier sans changer de côté (`aiSteer`) ; un lanceur qui fuit une mêlée s'écarte jusqu'à 5 m, un soigneur qui rejoint un allié va jusqu'à 7 m (pas de va-et-vient au seuil). 🧪
- IA sur The Bridge : pour rejoindre une cible sur le tablier, une mêlée passe par la rampe la plus courte (pied, puis haut ; `aiWaypoint`) au lieu de se mettre dessous ; un lanceur au sol se place à côté du pont, à hauteur de sa cible, jamais dessous. Pour descendre, elle passe par l'ouverture du garde-corps (pas de blocage dans l'angle en haut de la rampe) et va au bout de chaque point de passage. 🧪
- Barres d'incantation (la sienne, cible, cadres d'arène) : progression mise à jour à chaque image (`hudCastFrame`), pas 12 fois/s. 🧪
- **Refusé par l'utilisateur : pas de secousses de caméra, pas d'accélération/freinage progressifs, aucun délai ajouté (pas de micro-gel sur les coups).**
