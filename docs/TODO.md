# Arena Ascendant — tâches en attente

Tâches demandées ou proposées, pas encore faites. Quand une tâche est terminée : la retirer d'ici et décrire le résultat
validé dans `docs/SPEC.md`.

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
