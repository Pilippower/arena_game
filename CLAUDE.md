# Arena Ascendant — instructions pour Claude Code

Prototype d'arène 3v3 fantasy (feeling MMO arena) jouable dans le navigateur. Projet démarré avec GPT, repris ici.
Documentation complète (mécaniques, historique des régressions, décisions validées) : [docs/HANDOFF.md](docs/HANDOFF.md). **La lire avant toute modification non triviale.**

L'utilisateur communique en français : répondre en français.

## État réel du repo (vérifié au 31/10/2026, fait foi sur HANDOFF.md)

- `index.html` : tout le jeu (HTML/CSS/JS monolithique, ~160 Ko). Desktop + auto-détection mobile.
- `mobile.html` : simple redirection vers `index.html?mobile=1` (le jeu n'existe qu'en un exemplaire). Ne jamais y recopier le jeu.
- `game_logic.js` : **source de vérité** de GameLogic (mouvement/caméra). La copie inline `<script id="game-logic-inline">` de `index.html` doit lui rester strictement identique (vérifié par `tests/integration.test.js`). Modifier les deux ensemble.
- Les tests passent (`npm test`). Les problèmes « game_logic.js absent / tests stale » décrits en §4 du handoff sont **déjà résolus**.
- Personnages : `characters.js` (KITS, un skin unique par race+classe) assemble les packs CC0 Quaternius. Sources brutes dans `assets_src/` (non versionné, ~480 Mo) → `node tools/build_characters.js` → `assets/characters/*.js` (GLB en base64, indispensable car le jeu est lancé en double-clic / `file://`). Sans kit pour une race+classe, ou si le kit échoue, le jeu garde les anciens modèles KayKit. Visualiseur de dev : `tools/char_viewer.html` + `tools/shoot.js` (servi par `tools/serve.js`).
- Direction artistique : personnages **originaux** dans le style fantasy MMO. Ne pas les faire ressembler à des personnages Warcraft existants (Jaina, etc.), même par petites retouches successives.
- Les backups `index_*_backup.html` mentionnés dans le handoff ne sont pas dans le repo : utiliser l'historique git.

## Tests

```bash
npm install   # une fois : playwright-core (pilote le Edge/Chrome installé, aucun navigateur téléchargé)
npm test      # lance tests/*.test.js
```

À lancer après chaque modification. `tests/startup.test.js` ouvre le vrai jeu dans Edge headless : démarrage sans erreur JS, sélection race/classe + preview, round lancé pour les 7 classes, mode mobile paysage (joystick, timer, pas de bande vide). Les échecs réseau des CDN sont tolérés (fallback). Navigateur personnalisé : variable `BROWSER_PATH`.

## Règles non négociables

1. **Contrôles desktop validés = intouchables** : ZQSD (Q gauche, D droite), Espace saut, clic droit + souris = caméra MMO, molette zoom, clic gauche/TAB cible, 1–5 sorts, R trinket. Ne jamais « corriger » les signes de `screenRight` / `applyLook` (convention contre-intuitive mais validée ; inversée plusieurs fois par le passé).
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
