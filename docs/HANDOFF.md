# Arena Ascendant — Handoff complet pour Claude Code

> Document de passation technique généré le 31 octobre 2026 (projet initialement développé avec GPT).
>
> Objectif : permettre à Claude Code de reprendre le projet sans perdre les décisions déjà validées avec l'utilisateur, sans réintroduire les nombreuses régressions de contrôles/caméra/preview/UI rencontrées pendant l'itération.
>
> **Note Claude Code (31/10/2026)** : certaines infos de ce document sont déjà dépassées par l'état du repo — voir la section « État réel du repo » de `CLAUDE.md` à la racine, qui fait foi.

---

## 1. Résumé du produit

**Arena Ascendant** est un prototype de jeu d'arène 3v3 jouable directement dans un navigateur, fortement inspiré du feeling d'une arène MMO fantasy / WoW Arena, mais avec des assets et effets originaux ou permissifs.

Le jeu est actuellement un gros prototype monolithique en HTML/CSS/JS, avec :

- combat 3v3 temps réel ;
- classes et races fantasy ;
- ciblage, ligne de vue, GCD, ressources, casts, cooldowns ;
- CC + diminishing returns ;
- Blink / Charge ;
- healer + dampening ;
- VFX de sorts procéduraux ;
- personnages 3D Three.js + fallback procédural ;
- preview 3D dans l'écran de sélection ;
- musique et SFX générés via Web Audio ;
- pas synchronisés sur l'animation ;
- interface personnalisable ;
- version desktop et version mobile browser ;
- joystick virtuel, caméra tactile et sorts tactiles sur mobile.

La priorité de l'utilisateur est **le feeling de gameplay WoW-like et un rendu fantasy plus mature**, mais sans casser les contrôles et l'interface sur lesquels il a déjà convergé.

---

## 2. Fichiers principaux

### Entrées utilisateur

- `index.html`
  - version principale ;
  - desktop + auto-détection mobile ;
  - contient presque tout le jeu : HTML, CSS, GameLogic, gameplay, rendu, audio, UI.

- `mobile.html`
  - copie proche de `index.html` ;
  - ajoute `window.__FORCE_MOBILE__ = true` avant l'initialisation ;
  - force donc l'UI mobile même si la détection tactile échoue.

### Documentation

- `README.md`
  - README court, mis à jour au fil des versions ;
  - **ne doit pas être considéré comme documentation exhaustive**.

- `docs/HANDOFF.md`
  - ce document.

### Tests actuellement présents

- `tests/game_logic.test.js`
- `tests/integration.test.js`
- `tests/footstep_sync.test.js`

### Backups historiques importants

Le dossier d'origine contenait beaucoup de snapshots (non importés dans ce repo git — l'historique git les remplace désormais) :

- `index_controls_perfect_backup.html`
- `index_controls_frozen_backup.html`
- `index_ui_stable_characters_fix_backup.html`
- `index_before_mobile_mode.html`
- `index_before_mobile_fullscreen_fix.html`
- `index_before_footstep_sync_fix.html`
- `index_before_ui_customization.html`
- `index_before_preview_canvas_fix.html`
- `index_before_preview_defined_fix.html`
- `index_before_orc_elf_load_fix.html`
- etc.

Ces fichiers sont utiles pour retrouver un état antérieur lorsqu'une régression UI / contrôle / preview réapparaît.

---

## 3. PRIORITÉ ABSOLUE : contrôles desktop validés

L'utilisateur a explicitement dit que ces contrôles étaient **parfaits**. Ne pas les modifier sans nécessité.

### Contrôles validés

- `Z` = avancer
- `S` = reculer
- `Q` = gauche / strafe gauche
- `D` = droite / strafe droite
- `Espace` = saut
- clic droit maintenu + souris = caméra MMO + orientation personnage
- souris vers la droite = tourner à droite
- souris vers la gauche = tourner à gauche
- souris vers le haut = regarder vers le haut
- souris vers le bas = regarder vers le bas
- molette = zoom
- clic gauche = ciblage à l'écran
- `TAB` = cycle de cible
- 1–5 = sorts par défaut
- `R` = trinket PvP par défaut

Les raccourcis de sorts/trinket sont personnalisables, mais **les touches de déplacement/caméra doivent rester réservées**.

### GameLogic à préserver

`index.html` contient une version inline de `GameLogic` (identique à `game_logic.js`) :

```js
function forward(yaw){
  return {x:Math.sin(yaw), z:Math.cos(yaw)};
}

function screenRight(yaw){
  return {x:-Math.cos(yaw), z:Math.sin(yaw)};
}

function axesFromKeys(keys={}){
  const f=(keys.z||keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0);
  const r=(keys.d||keys.arrowright?1:0)-(keys.q||keys.a||keys.arrowleft?1:0);
  return {forward:f,right:r};
}

function moveVector(keys,yaw){
  let {forward:f,right:r}=axesFromKeys(keys);
  if(!f&&!r) return {x:0,z:0,forward:0,right:0};
  const len=Math.hypot(f,r)||1;
  f/=len; r/=len;
  const fw=forward(yaw), rt=screenRight(yaw);
  return {
    x:fw.x*f+rt.x*r,
    z:fw.z*f+rt.z*r,
    forward:f,
    right:r
  };
}

function applyLook(yaw,pitch,dx,dy,hSens=.0045,vSens=.0042){
  return {
    yaw:yaw-dx*hSens,
    pitch:clamp(pitch+dy*vSens,-.45,1.04)
  };
}
```

### Attention à la convention caméra

La convention peut paraître contre-intuitive : **ne pas “corriger” les signes mathématiques sans tester visuellement**.

Historiquement :

- Q/D ont été inversés plusieurs fois ;
- caméra horizontale inversée plusieurs fois ;
- caméra verticale inversée plusieurs fois.

Toute modification du mouvement/caméra doit être accompagnée de tests de régression multi-angle.

---

## 4. État des tests au moment de la passation (selon GPT)

> **Dépassé** : à l'import dans git, `game_logic.js` est présent, la copie inline est vérifiée identique par `tests/integration.test.js`, et les 3 tests passent. Voir `CLAUDE.md`. Texte d'origine conservé ci-dessous pour l'historique.

### La suite de tests était désynchronisée du code

#### Problème 1 : `game_logic.js` absent

`tests/game_logic.test.js` fait `require('../game_logic.js')` mais le fichier n'était plus présent. La logique existait inline dans `index.html` sous `<script id="game-logic-inline">`.

#### Problème 2 : `integration.test.js` attend une architecture ancienne

Le test vérifiait `/script src="game_logic\.js"/` alors que `index.html` utilise une copie inline. Choisir une architecture :

1. revenir à `game_logic.js` externe, ou
2. garder l'inline mais faire générer/tester cette copie automatiquement.

Éviter les deux sources de vérité manuelles.

#### Problème 3 : test caméra verticale ancien/stale

Le `selfCheck()` inline considère : `dy < 0` → pitch diminue → regarder vers le haut dans la convention orbit actuelle. Réaligner le test avec le comportement réellement validé par l'utilisateur.

### Recommandation de remise en ordre

Créer une suite de tests structurée :

```text
tests/
  game_logic.test.js
  controls_integration.test.js
  startup.test.js
  gameplay_mobility.test.js
  cc_slow.test.js
  healer_balance.test.js
  preview.test.js
  ui_customization.test.js
  audio.test.js
  mobile.test.js
```

Puis lancer tous les tests à chaque modification sensible.

---

## 5. Architecture actuelle du jeu

Le projet est volontairement simple mais maintenant trop monolithique.

### Couches principales

1. **GameLogic pur** — base de déplacement ; transformation touches → vecteur monde ; rotation caméra.
2. **Simulation gameplay** — unités ; HP / ressources ; casts ; GCD ; cooldowns ; CC ; AI ; mobilité ; dégâts / soins.
3. **Renderer WebGL procédural principal** — arène ; sol ; piliers ; décor ; VFX procéduraux.
4. **Renderer Three.js transparent** — personnages GLB ; animations ; occlusion avec piliers/murs ; interpolation visuelle.
5. **Preview Three.js** — renderer séparé dans écran de sélection ; même logique de modèle que le jeu ; fallback 3D local si téléchargement externe échoue.
6. **UI/HUD** — frames joueur/cible/arène ; barres ; action bar ; settings ; sélection race/classe.
7. **Audio Web Audio API** — musique procédurale ; SFX sorts ; pas synchronisés.
8. **Mobile input/UI** — joystick ; caméra touch ; buttons cible/saut/sorts ; fullscreen / visualViewport.

---

## 6. Simulation et loop

La simulation tourne à **120 Hz fixe** :

```js
const SIM_DT = 1/120;
const MAX_SIM_STEPS = 6;
```

Le rendu utilise `renderAlpha` pour interpoler visuellement entre ticks. Cette séparation a été introduite pour réduire les micro-sauts / jitter des personnages.

**Règle** : ne pas revenir à une simulation directement basée sur `requestAnimationFrame(dt)` sans raison, car cela a déjà causé une sensation de lag / micro-blink.

---

## 7. Classes disponibles

| ID interne | Classe visible | Rôle |
|---|---|---|
| `sentinel` | Warrior | Tank / mêlée |
| `arcanist` | Mage | Caster |
| `oracle` | Priest | Healer |
| `reaver` | Death Knight | Bruiser |
| `warden` | Druid | Hybride |
| `shade` | Rogue | Contrôle |
| `warlock` | Warlock | Caster / DoT |

### Skills actuels

| Classe | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Warrior | Mortal Strike | Hamstring | Pummel | Shield Wall | Charge |
| Mage | Arcane Bolt | Frost Nova | Counterspell | Arcane Power | Blink |
| Priest | Flash Heal | Power Shield | Silence | Divine Hymn | Angelic Step |
| Death Knight | Obliterate | Death Grip | Asphyxiate | Pillar of Frost | Death Advance |
| Druid | Claw | Entangling Roots | Barkskin | Starfall | Wild Charge |
| Rogue | Backstab | Cloak | Kidney Shot | Vendetta | Shadowstep |
| Warlock | Shadow Bolt | Fear | Spell Lock | Dark Soul | Demonic Gate |

---

## 8. Races disponibles

Human, Dwarf, Elf, Orc, Undead.

### Point important sur l'architecture visuelle

**La classe doit choisir la silhouette / modèle principal. La race est un traitement visuel secondaire.**

- Orc Mage = **modèle Mage** + traits Orc ;
- Orc Warrior = modèle Warrior + traits Orc ;
- Elf Rogue = modèle Rogue + traits Elf.

Une ancienne version faisait passer la race avant la classe (toutes les races ressemblaient à des Warriors, Orc Mage avec modèle Orc générique…). **Ne pas réintroduire cette logique.**

---

## 9. Assets 3D actuels

Three.js est chargé depuis jsDelivr :

```text
https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js
https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js
```

### Bases GLB externes actuelles

```js
const HF_ASSET_BASE_JEV =
  'https://cdn.jsdelivr.net/gh/kikoncuo/jevfire@main/web/public/assets/';

const HF_ASSET_BASE_HOLLOW =
  'https://cdn.jsdelivr.net/gh/euuuuuuan/hollowmere-public@main/public/models/char/';
```

### Modèles classe

- Rogue → `rogue.glb`
- Warrior → `knight.glb`
- Death Knight → `barbarian.glb`
- casters → `Mage.glb`
- Undead → variantes Skeleton_*.

### Fallback

La preview possède un fallback Three.js local procédural : `previewFallbackModel()`.

Raison : plusieurs tentatives de modèles Orc/Elf externes ont cassé (CORS/URL/hosting) et ont laissé la preview bloquée sur « Modèle 3D indisponible ». Le fallback doit rester tant qu'on dépend de ressources externes.

### Direction visuelle demandée

- silhouette MMO fantasy mature ;
- proportions adultes ;
- Orc massif, mâchoire forte, défenses, épaules larges ;
- Elf élancé, oreilles longues, détails plus fantasy ;
- éviter absolument le rendu **chibi / jouet / Lego**.

L'utilisateur a fourni une référence d'Orc adulte massif avec cuir/métal.

### IP / copyright

Ne pas importer/ripper : modèles, textures, sons exacts, icônes exactes de Blizzard/WoW. On peut reproduire le **langage visuel / feeling général** avec assets originaux ou permissifs.

---

## 10. Preview de sélection

La preview a été une source majeure de bugs.

### État voulu

- UI de sélection actuelle = **à garder stable** ;
- race et classe séparées ;
- preview à droite ;
- la preview doit afficher le même type de modèle utilisé en arène ;
- ne pas transformer les boutons de sélection en thumbnails 3D sans demande explicite.

L'utilisateur a explicitement demandé après une régression :

> garde la meme interface qu'avant je te demande juste de changer les graphisme des personnage

### Bugs déjà rencontrés

1. `previewCharacterSVG is not defined`
2. `PREVIEW is not defined`
3. preview bloquée sur `Chargement du personnage…`
4. canvas WebGL recréé à chaque clic → contexte perdu / chargements concurrents
5. modèle externe indisponible → écran vide
6. race prioritaire sur classe → mauvais modèle visuel

### Architecture actuelle

`PREVIEW` doit être déclaré avant les fonctions de preview :

```js
const PREVIEW = {
  renderer: null, scene: null, camera: null, loader: null,
  group: null, mixer: null, action: null, clips: [],
  canvas: null, currentKey: '', animId: 0, requestId: 0,
  loaded: false, loadTimer: null
};
```

Un seul canvas preview doit être conservé. `requestId` permet d'ignorer un ancien chargement GLB si l'utilisateur change de race/classe rapidement.

---

## 11. Bug de “flash ancien graphisme” à l'entrée en arène

Au lancement du round, le fallback procédural était visible ~1 s avant que le modèle Three.js charge.

Correction : ne rendre le fallback que si le renderer HF n'existe pas ou si le chargement a réellement échoué ; ne pas l'afficher pendant un simple état `pending`.

Ne pas revenir à `if (!hfHasModel(u)) renderCharacter(u)` sans distinguer `pending` vs `failed`.

---

## 12. Arène actuelle

```js
const arena = { halfX: 34, halfZ: 25, ... };
```

Environ **68 × 50 unités**, 8 piliers de ligne de vue.

Décor procédural : sol pierre / mousse, herbe, ruines, arches, arbres, bannières, braseros, rochers, fleurs, runes, cristaux, skyline/château distant.

Direction demandée : éviter le look lisse / Lego / trop géométrique. Aller vers une MMO fantasy plus organique : relief, végétation, matériaux et silhouettes détaillées.

---

## 13. Mobilité : Blink et Charge

### Blink (`blinkForward()`)

- téléportation instantanée **dans le facing du personnage** ;
- ne force pas le facing vers la cible ;
- fonctionne sans cible ;
- s'arrête avant mur/pilier ;
- retire le root ;
- utilise `visualSnap=true` pour éviter une interpolation visuelle absurde.

### Charge (`beginCharge()`, `updateMobility()`, `finishCharge()`)

Ne doit **pas** être une téléportation :

- nécessite une cible vivante, distance ~2.8 à 15, LoS ;
- crée `u.mobility={type:'charge', ...}` ;
- mouvement rapide vers la cible avec suivi de position ;
- stop en mêlée ;
- impact + dégâts + court root ;
- trail VFX pendant le déplacement.

---

## 14. Spell queue / GCD

```js
const SPELL_QUEUE_WINDOW = .18;
```

Un sort pressé dans les 180 ms avant fin GCD/CD est mis en queue. La queue expire après ~350 ms.

---

## 15. Slow / Hamstring

`applySlow(t,pct=.5,dur=8)` ; `moveSpeed()` applique réellement `1 - slowPct`. Hamstring = **slow 50 %**.

Le slow affecte joueur, bots, cadence d'animation de run, et donc la cadence des pas. Ne pas transformer Hamstring en root.

---

## 16. CC / DR

États : `stun`, `root`, `silence`, `fear` ; `slow` séparé des DR CC principaux.

### DR

```js
dr: { stun: 1, root: 1, silence: 1, fear: 1 }
```

Progression `1.0 → 0.5 → 0.25 → 0`, reset après ~18 s via `drT`.

### Fear

- vrai état distinct ; coupe le cast ;
- fait fuir physiquement la cible (direction avec wobble) ;
- un gros hit (>= ~8 % max HP) peut casser le Fear ;
- Warlock garde une seule cible Fear active.

### Frost Nova / root

Root AoE autour du Mage, effet visuel persistant, fenêtre minimale avant break, cassable par dégâts selon `rootBreakDamage`.

### Stun

Immobilisation totale ; annule le cast.

### Silence

Annule le cast ; bloque les sorts.

### Trinket

Touche `R` par défaut ; libère stun/root/silence/fear ; CD ~90 s ; ajoute un petit shield.

---

## 17. Healer / équilibre / dampening

Ancien bug : le Priest healait en boucle, ennemis impossibles à tuer. Rééquilibrage : regen réduite, coûts de heal augmentés, seuil d'AI heal ajusté, dampening.

### Priest actuel

- regen Mana : `6` / s ;
- Flash Heal : `28` ;
- Power Shield : `24` ;
- Divine Hymn : `45`.

### Dampening

```js
state.dampening = clamp((state.elapsed-35)/90*.45, 0, .45)
```

Pas de dampening avant ~35 s, puis jusqu'à **45 % de réduction des soins**.

---

## 18. Sanctuaires de soin

```js
const HEALTH_SPOTS = [ {x:0,z:-20}, {x:0,z:20} ];
```

Si un joueur passe dedans avec HP manquants : HP → max, shield supprimé, sanctuaire désactivé, respawn après 45 s. Représentés comme un gros `+` / heal pickup.

---

## 19. IA

- cible l'ennemi le plus proche ;
- caster garde la distance, mêlée colle ;
- Priest heal l'allié le plus bas ;
- trinket automatique sur certains CC longs ;
- mobilité plus lancée totalement au hasard.

Ne pas remettre des mobilités dans une simple rotation aléatoire (donnait l'impression que les personnages « blinkaient / laggaient »).

---

## 20. Interpolation / jitter

Les modèles 3D sont interpolés entre ticks de simulation (120 Hz). Les anciennes versions avec lissage exponentiel « poursuivaient » la position (rattrapage / micro-blink). Les vraies téléportations doivent utiliser `visualSnap`.

---

## 21. Animation de mort

```js
if(key==='death'){
  next.setLoop(THREE.LoopOnce,1);
  next.clampWhenFinished=true;
}
```

Ne pas réintroduire `LoopRepeat` sur la death animation.

---

## 22. VFX de sorts

VFX procéduraux WebGL : blending additif, halos, anneaux, particles, projectiles, trails, impacts, auras persistantes.

Types : `arcaneProjectile`, `shadowProjectile`, `healBeam`, `slash`, `nova`, `holyBurst`, `frostAura`, `shield`, `cloak`, `roots`, `snare`, `fear`, `silence`, `stun`, `castArcane`, `castShadow`, `healCast`, `blinkBurst`, `blinkRibbon`, `chargeStart`, `chargeTrail`, `chargeImpact`.

L'utilisateur aime les effets plus **glowing**. `state.fx` est limité à ~180 entrées pour éviter les chutes de FPS.

---

## 23. Icônes de sorts

SVG originaux générés dans le code : motifs par type de compétence, palette dérivée de la classe, aucun asset Blizzard. L'utilisateur veut de « vraies icônes dans le thème », sans copie exacte de WoW.

---

## 24. Audio

### Volume

Persisté dans `localStorage`, range UI jusqu'à **200 %** : `PREFS.volume = clamp(..., 0, 2.0)`.

### Musique

Synthétisée via Web Audio : battle fantasy, ~138 BPM, instrumental, couches adaptatives selon l'intensité du combat (percussion / bass / ostinato / lead). Les anciennes boucles étaient jugées trop « boring ».

### SFX de sorts

Procéduraux et originaux par classe : Warrior métallique / impact ; Mage cristallin / arcane ; Priest lumineux ; Warlock sombre ; DK grave ; Rogue sec / tranchant ; Druid nature / astral. Pas de copie des sons WoW — reproduire le **type de feedback**.

### Spatialisation

SFX ennemis atténués avec la distance + panning gauche/droite selon la position relative.

---

## 25. Bruits de pas

Le déclenchement suit la **phase réelle de l'animation Three.js** :

```js
phase = rec.action.time / clip.duration
```

Triggers ~`.16` et ~`.66` (deux contacts de pied par cycle). Animation ralentie (ex. Hamstring) → pas ralentis.

`footstepSfx()` n'utilise **pas** d'oscillateur tonal : buffers de noise, filtre lowpass / bandpass, impact grave, semelle / frottement, variante herbe vs pierre, variante heavy pour Warrior/DK, légère variation gauche/droite.

---

## 26. Interface personnalisable

Bouton `⚙ Interface`. Préférences : `const PREF_KEY = 'arenaAscendantPrefs_v1'`.

Réglages : volume, raccourcis des 5 sorts, raccourci trinket, positions HUD.

Frames déplaçables : `selfFrame`, `targetFrame`, `arenaFrames` — positions en coordonnées relatives 0..1 pour survivre au resize.

Touches réservées (interdites aux sorts) : Z/Q/S/D, W/A, flèches, Espace, TAB, Escape.

---

## 27. Version mobile browser

- `index.html` : auto-détection (`matchMedia('(pointer:coarse)')`, `navigator.maxTouchPoints > 0`, ou `?mobile=1`) ;
- `mobile.html` : `window.__FORCE_MOBILE__ = true`.

### Contrôles mobile

Joystick à gauche (mouvement), swipe zone droite (caméra), bouton `CIBLE`, bouton `SAUT`, action bar tactile, trinket tactile, plein écran.

Le joystick est une **couche d'entrée supplémentaire** qui alimente le même système de déplacement relatif à la caméra que le desktop — pas une nouvelle implémentation de mouvement.

### Paysage / fullscreen

Overlay « tournez le téléphone » en portrait. `mobileViewportSync()`, `mobileRequestFullscreen()` ; `visualViewport`, vars CSS `--mobile-vh` / `--mobile-vw`, `requestFullscreen({navigationUI:'hide'})`.

### Bug mobile corrigé

Grosse bande noire en bas : `#bottom` était absolute mais `#app` gardait une 3e ligne Grid de ~106 px. Le mode mobile doit utiliser l'arène sur toute la hauteur et superposer les sorts. Ne pas réintroduire la ligne vide.

---

## 28. Sélection race / classe

**Garder la même interface.** Quand l'utilisateur demande « améliore les personnages », ne pas : changer les dimensions de la grille, remplacer les boutons par des render targets 3D, refaire la structure du menu, mélanger race et classe.

Changer uniquement : modèle 3D, proportions, matériaux, équipement, détails raciaux.

Il souhaite des pictos plus proches d'un écran de création de personnage MMO, mais l'UI actuelle doit être préservée sauf demande explicite.

---

## 29. Historique des régressions à ne PAS répéter

- **Contrôles** : Q/D inversés ; caméra horizontale inversée ; caméra verticale inversée.
- **Startup** : `GameLogic is not defined` ; `previewCharacterSVG is not defined` ; `PREVIEW is not defined`.
- **Rendu** : `renderArena` supprimé (fond bleu) ; variable `race` utilisée avant init (personnages invisibles) ; flash du fallback 1 s ; ombres Three.js coûteuses sans bénéfice ; résolution personnage réduite (flou en mouvement).
- **Preview** : canvas recréé à chaque clic ; modèle externe jamais chargé ; URLs 3D non fiables ; race prioritaire sur classe ; menu cassé par thumbnails 3D.
- **Gameplay** : Blink vers la cible au lieu du facing ; Charge = téléportation ; IA spam mobilité ; Hamstring sans ralentissement ; healer infini ; Fear traité comme stun ; death animation en boucle.
- **Mobile** : bande noire sous l'arène ; HUD timer/round absent ; divergence `index.html` / `mobile.html`.

---

## 30. Recommandation de refactor

Cible possible :

```text
src/
  game-logic.js
  gameplay/   classes.js state.js combat.js cc.js mobility.js ai.js
  input/      desktop.js mobile.js
  render/     arena-webgl.js characters-three.js preview-three.js vfx.js
  audio/      music.js sfx.js footsteps.js
  ui/         hud.js selection.js settings.js mobile-hud.js
```

Puis builder vers un HTML distribuable. **Refactorer par petits pas.** Après chaque extraction : comparer le comportement, lancer les tests, tester Q/D + caméra, Blink/Charge, preview, mobile. Pas de rewrite complet d'un coup.

---

## 31. Tâches recommandées — ordre de priorité

### P0 — Stabiliser le repo / tests

1. ~~recréer `game_logic.js` depuis la version inline validée~~ (fait) ;
2. ~~choisir une seule source de vérité~~ (fait : `game_logic.js` testé, copie inline vérifiée identique) ;
3. ~~réparer les tests stale~~ (fait) ;
4. ajouter test startup navigateur/jsdom ou Playwright ;
5. ajouter test mobile DOM/layout ;
6. ajouter test preview state machine.

### P1 — Éviter divergence mobile/desktop

`mobile.html` est une copie quasi complète de `index.html` (seule différence : `<script>window.__FORCE_MOBILE__=true;</script>`). Générer `mobile.html` depuis la même source, ou externaliser le code dans `app.js`.

### P2 — Personnages

Principal chantier visuel : modèles fantasy adultes, Orc massif crédible, Elf crédible, équipement distinct par classe, preview == rendu in-game, aucun asset Blizzard. Idéalement **bundler localement les modèles permissifs** pour éviter les CDN cassés.

### P3 — Audio assets

Samples de foley / magie sous licences CC0/CC-BY, manifest de licences, fallback Web Audio procédural.

### P4 — Décor / textures

Textures sol, grass meshes / instancing, props fantasy, skybox original, matériaux plus riches.

---

## 32. Checklist avant toute livraison

### Code
- [ ] pas d'erreur JS startup ;
- [ ] pas de variable globale manquante ;
- [ ] pas de fonction référencée mais supprimée ;
- [ ] `node --check` sur JS extrait.

### Contrôles desktop
- [ ] Z avant / S arrière / Q gauche / D droite ;
- [ ] souris droite → rotation droite / gauche → gauche ;
- [ ] souris haut → caméra haut / bas → bas ;
- [ ] Espace saute ; TAB cible.

### Gameplay
- [ ] Blink = facing, pas target ; collision OK ;
- [ ] Charge = déplacement, pas teleport ;
- [ ] Hamstring ralentit réellement ;
- [ ] Fear fait fuir ; Nova root ; trinket casse CC ;
- [ ] healer peut être oom/pressuré ; dampening fonctionne ;
- [ ] death animation joue une fois.

### Visuel
- [ ] preview charge ; fallback preview fonctionne offline ;
- [ ] pas de flash ancien renderer ;
- [ ] Orc Mage reste visuellement Mage ;
- [ ] personnages non flous en mouvement.

### Audio
- [ ] volume 0–200 % ; pas = animation ; pas sans beep ; SFX sorts ; music toggle.

### Mobile
- [ ] joystick ; caméra swipe ; sorts touch ; cible ; saut ;
- [ ] timer/score visibles ; paysage ; pas de bande noire ; fullscreen optionnel.

---

## 33. Commandes de validation

```bash
for t in tests/*.test.js; do node "$t" || exit 1; done
```

Vérifier les deux pages (`index.html`, `mobile.html`). Test navigateur recommandé (Playwright/Chromium) : startup, sélection Race + Classe, preview, clic Jouer, absence d'erreur console, viewport desktop et mobile paysage.

---

## 34. Contrat avec l'utilisateur / style de développement

L'utilisateur préfère : résultats directement testables, itérations concrètes, peu de théorie, aucune régression sur ce qui est validé.

Il a été particulièrement frustré quand une amélioration visuelle a cassé l'UI, les contrôles, la preview ou la classe/race.

**Modifier une seule couche à la fois** : graphisme personnage → ne pas toucher UI ; mobile layout → ne pas toucher gameplay ; SFX → ne pas toucher animation/mouvement sauf synchronisation explicite ; caméra → tests obligatoires.

---

## 35. Résumé ultra-court

1. **Ne touche pas aux contrôles.**
2. **Ne refais pas l'UI de sélection sans demande explicite.**
3. Garde la structure de tests et `game_logic.js` comme source de vérité.
4. Garde la simulation fixe 120 Hz.
5. Garde Blink = facing et Charge = vraie ruée.
6. Garde Hamstring comme slow réel, pas root.
7. Garde Fear comme fuite réelle avec DR.
8. Garde dampening/healer balance.
9. Preview et arène utilisent le même modèle de classe/race.
10. Race ne remplace jamais la classe visuellement.
11. Mobile réutilise le même gameplay, seulement une autre couche d'input/UI.
12. Prochain gros chantier : **meilleurs personnages 3D fantasy adultes, notamment Orc/Elf**, sans casser le reste.

---

## 36. Note finale

Le prototype a beaucoup de fonctionnalités et une base de gameplay déjà convergée, mais a subi de nombreuses modifications directes dans un seul fichier HTML. Priorités : sécuriser la source de vérité, enrichir la suite de tests, découpler les modules, bundler les assets permis localement, puis améliorer massivement personnages et rendu.

**Ne pas recommencer le jeu de zéro.**
