# Arena Ascendant — tâches en attente

Tâches demandées ou proposées, pas encore faites. Quand une tâche est terminée : la retirer d'ici et décrire le résultat
validé dans `docs/SPEC.md`.

## Liste du 04/11/2026 (priorité, dans cet ordre : du plus simple au plus compliqué, un commit par tâche)

6. Augmenter le volume des sons des sorts.
8. Voleur : Backstab ralentit la cible de 60 % pendant 6 s.
9. Voleur : Shadowstep téléporte dans le dos de la cible, portée 20 m, utilisable aussi camouflé.
10. Les racines (roots) ne cassent plus quand la cible subit des dégâts.
11. Démoniste : Corruption vole la vie (chaque dégât infligé est rendu au démoniste).
12. Bug : un lanceur qui saute peut commencer une incantation (ne doit pas pouvoir).
13. Bug : Blink pendant un saut (le mage reste sur place au lieu d'arriver au sol à destination).
14. Mobile : icônes en haut à droite (son, settings…) pas centrées dans leur carré ; reprendre les icônes du PC.
15. Ciblage : boîte invisible de la barre flottante (incluse) jusqu'au sol, un clic entre la barre et le personnage
    le sélectionne.
16. Lobby : pour le druide, choisir la forme ours / félin pour voir et lire leur barre de sorts.
17. Raccourcis : pouvoir utiliser Shift + Espace et Ctrl + touche.
18. Raccourcis propres à chaque classe (autant de configurations que de classes).
19. Écran Defeat : flammes mal placées (Victory est juste) ; vérifier en plein écran F11 : proportions gardées.
20. Bouclier d'absorption visible sur la barre de vie (flottante et cadres de groupe) : portion superposée, couleur
    distincte, style MMO sans copier.
21. Régression des glaives du voleur : il frappait en tranchant avec ses glaives, il frappe de nouveau comme des coups de
    poing. Corriger et ajouter un test de non-régression.
22. Les sorts des lanceurs suivent la cible en mouvement et frappent son corps.
23. Étourdissement : la tête ne doit plus partir en arrière ; animation dédiée (tête légèrement penchée en avant, yeux
    fermés, petits cercles lents).
24. Nain : la barbe reste immobile quand la tête bouge (capture de l'utilisateur) : elle doit suivre la tête.
25. Sons des sorts plus expressifs (lanceurs et mêlée, ex. Cloak, Stealth) : son pendant l'incantation / la
    canalisation, son de libération à la fin d'une incantation, son d'échec quand une incantation est interrompue ou
    arrêtée ; esprit des sons de MMO sans les copier.
26. Cartes : une salle de chaque côté, reliée à l'arène, où chaque équipe apparaît ; compte à rebours de 20 s affiché ;
    à 0, les portes s'ouvrent avec un son qui marque le début de l'arène.

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
