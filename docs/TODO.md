# Arena Ascendant — tâches en attente

Tâches demandées ou proposées, pas encore faites. Quand une tâche est terminée : la retirer d'ici et décrire le résultat
validé dans `docs/SPEC.md`.

## Liste du 04/11/2026 (priorité, dans cet ordre : du plus simple au plus compliqué, un commit par tâche)

21. Régression des glaives du voleur : il frappait en tranchant avec ses glaives, il frappe de nouveau comme des coups de
    poing. Corriger et ajouter un test de non-régression.
22. Les sorts des lanceurs suivent la cible en mouvement et frappent son corps.
23. Étourdissement : la tête ne doit plus partir en arrière ; animation dédiée (tête légèrement penchée en avant, yeux
    fermés, petits cercles lents).
24. Nain : la barbe reste immobile quand la tête bouge (capture de l'utilisateur) : elle doit suivre la tête.
26. Cartes : une salle de chaque côté, reliée à l'arène, où chaque équipe apparaît ; compte à rebours de 20 s affiché ;
    à 0, les portes s'ouvrent avec un son qui marque le début de l'arène.

## Liste n°2 du 04/11/2026 (après la liste ci-dessus ; gérée par le coordinateur seul, sans agents parallèles)

Du plus simple au plus compliqué, un commit par tâche. Images de référence des épaules (planches de classe génériques
fournies par l'utilisateur, à suivre au plus près) : `assets_src/ui/ref_shoulders_{mage,warlock,rogue,priest}.png`.

1. Armes portées par les elfes : 40 % plus petites. DK elfe : lame aujourd'hui à 80 % (−20 %), à porter à 60 % comme
   les autres (l'utilisateur pensait −30 % déjà fait).
2. En jeu, en haut à gauche : remettre uniquement l'icône et le titre du jeu, comme dans le lobby (sans le sous-titre).
3. Shadowstep : tourner la caméra et le personnage vers la cible derrière laquelle on arrive.
4. Raccourcis par classe, réglables dans le lobby (ex. mage : 2 → F ; démoniste : 2 → X), qui fonctionnent en jeu et
   restent après fermeture du navigateur (vérifier ce que le lot du 04/11 a déjà fait et compléter).
5. Ordre des sorts changé avec Shift + glisser : faisable aussi dans le lobby, gardé par classe.
6. Lobby, druide : remplacer les 3 boutons de forme à droite par un clic sur le sort de forme dans la barre (Cat Form /
   Bear Form), qui change la barre affichée.
7. Nain : une petite barbe reste figée dans l'air quand il marche (une partie de la barbe ne suit pas la tête) : le
   vérifier soi-même en marchant, corriger.
8. Ours : ses sons ressemblent encore à un cochon ; nouvelle étude des sons (enregistrements d'ours libres de droits).
9. Sons de sorts encore plats et fades : état des lieux du design sonore des sorts de World of Warcraft (sources
   publiques, sans copier ni extraire leurs sons), puis propositions ; Drain Life du démoniste très gênant.
10. Épaules (épaulières) du mage, du démoniste, du voleur et du prêtre : se rapprocher au plus près des planches de
    référence (formes, couches, matières, couleurs, gemmes) ; seules les épaulières changent (pas les visages ni les
    coiffures). Mage : grandes épaulières bleu roi en plusieurs pointes dorées, cristaux bleus lumineux ; démoniste :
    épaulières violettes bordées de cuivre, pointes recourbées, motif vert lumineux ; voleur : cuir sombre en lames
    superposées, liserés dorés, gemme rouge, capuche et écharpe bordeaux ; prêtre : grandes épaulières dorées en ailes
    nacrées, gemmes bleues, col haut.

## Équilibrage 1v1 : que chaque classe ait sa chance (proposé le 04/11/2026, à reprendre)

Demande de l'utilisateur : des 1v1 plus équilibrés, où chacun a sa chance de gagner. Les points 1 et 2 du premier plan
(guerrier, démoniste) sont déjà appliqués.

**Objectif** : aucun duel joué d'avance, chaque affrontement entre **25 % et 75 %** de victoires, sans casser le 3v3.

**État mesuré** (`node tools/balance.js 12 16`, IA Medium, après les changements du 04/11/2026) :

| Classe | 1v1 moyenne | Duels joués d'avance | 3v3 (victoires de son équipe) |
|---|---|---|---|
| DK | 75 % (trop fort) | 100 % contre guerrier, druide, démoniste ; 92 % contre voleur | 44 % |
| Voleur | 65 % | 100 % contre mage et démoniste | 38 % |
| Guerrier | 57 % | 100 % contre mage et démoniste ; 0 % contre DK et prêtre | 50 % |
| Prêtre | 56 % | 100 % contre guerrier et druide ; 0 % contre mage et démoniste | — |
| Démoniste | 46 % | 0 % contre guerrier, DK, voleur | 56 % |
| Mage | 28 % (trop faible) | 0 % contre guerrier, voleur, druide | 81 % (trop fort en équipe) |
| Druide | 24 % (trop faible) | 0 % contre DK et prêtre | 44 % (meurt dans 81 % des matchs) |

**Méthode** : comme pour le premier plan, proposer des réglages **mesurés en simulation** avant de les appliquer
(`duel(A, B, durée, ctx => { … })` dans `tools/duel.js`, puis `node tools/balance.js`), les faire **valider par
l'utilisateur**, puis appliquer avec un test et une ligne dans `docs/SPEC.md`. Pistes à mesurer : DK (PV ou
Obliterate), druide (survie), mage (1v1 contre la mêlée sans le renforcer en 3v3).

**À remesurer** : depuis Backstab (ralentit de 60 % pendant 6 s) et le nouveau Shadowstep (dans le dos, 20 m,
utilisable camouflé), le voleur gagne 9 duels sur 10 contre un prêtre (`node tools/duel.js shade oracle 10`, 16 sur 20
avant) : probablement renforcé, à intégrer au plan. Corruption vole désormais la vie : démoniste à remesurer aussi.
