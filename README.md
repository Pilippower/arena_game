# Arena Ascendant — pas synchronisés aux animations

## Correction audio des déplacements
- Les bruits de pas ne sont plus déclenchés par un timer indépendant.
- Ils suivent maintenant directement la **phase de l'animation de course 3D** : un contact pied gauche et un contact pied droit par cycle.
- Si l'animation ralentit (par exemple sous Hamstring), la cadence des pas ralentit automatiquement avec elle.
- L'ancien bip/oscillateur a été retiré du bruit de pas.
- Nouveau son procédural de type foley : impact sourd + semelle/frottement, avec variations pierre/herbe et pas plus lourds pour Warrior/Death Knight.
- Légères variations gauche/droite et aléatoires pour éviter l'effet répétitif.

## Desktop / mobile
- `index.html` : version desktop + détection automatique mobile.
- `mobile.html` : redirige vers `index.html?mobile=1` (force le mode mobile).
- Le mode mobile conserve joystick, caméra tactile, sorts cliquables et plein écran.

## Contrôles desktop
Z/S/Q/D, Espace, clic droit caméra, molette zoom, TAB/clic gauche ciblage, sorts 1–5, Trinket R.

## Tests
`npm install` puis `npm test` (tests logiques + démarrage réel dans Edge/Chrome headless).
