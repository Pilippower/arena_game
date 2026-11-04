# Arena Ascendant — tâches en attente

Tâches demandées ou proposées, pas encore faites. Quand une tâche est terminée : la retirer d'ici et décrire le résultat
validé dans `docs/SPEC.md`.

## Liste n°2 du 04/11/2026 (gérée par le coordinateur seul, sans agents parallèles)

Du plus simple au plus compliqué, un commit par tâche. Images de référence des épaules (planches de classe génériques
fournies par l'utilisateur, à suivre au plus près) : `assets_src/ui/ref_shoulders_{mage,warlock,rogue,priest}.png`.

9. Sons de sorts : **étude faite le 04/11/2026, Drain Life corrigé ; propositions à faire valider par l'utilisateur.**
   Sources publiques : Blizzard, « Under the Hood: Anatomy of Sound Design » (créatures de WoW : voix + ours + tigre
   superposés puis traités ; variations nombreuses) ; Brian Farr (Hearthstone, ex-WoW) : les sorts de Warcraft ont « un
   élément musical atonal » qui les rend reconnaissables ; guides de design de sorts (Game Developer, RPG Magic 2) : 3 à
   8 couches, découpe incantation / boucle / impact, impact = sub + corps + détail + queue, attaques alignées.
   Constat chez nous : tout est synthétisé (oscillateurs purs + bruit filtré), sans texture enregistrée ni attaque
   franche, d'où le côté plat. Propositions :
   a. sous chaque sort, une texture enregistrée libre de droits par école (craquement de glace, souffle d'arcane,
      grondement d'ombre, bois et feuilles…), comme le souffle et le choc d'arme de la mêlée ;
   b. impact en 4 couches alignées (sub, corps, détail, queue réverbérée) avec une attaque nette ;
   c. signature « atonale » propre à chaque école (intervalles dissonants reconnaissables) au lieu d'accords consonants ;
   d. variations : hauteur aléatoire légère et 2 ou 3 variantes par sort fréquent (pas deux fois le même son) ;
   e. mixage : ses propres sorts devant, ceux des autres plus doux et filtrés avec la distance ;
   f. canalisations en vagues au rythme des tics plutôt qu'un bourdon continu (appliqué à Drain Life).
11. Mobile : **revue faite le 04/11/2026** (lobby jusqu'à PLAY, Settings, jeu, fin de match ; 568 × 320, 667 × 375,
    844 × 390, 1024 × 768, portrait). Corrigé : « Play » en double sur PLAY, ligne Mode / Difficulty qui débordait.
    À décider par l'utilisateur : (a) tablette : le lobby n'occupe que le haut de l'écran (l'agrandir ?) ; (b) la barre
    de sorts du lobby n'est pas visible en mobile (la montrer ?) ; (c) fin de match en 3v3 sur téléphone : le panneau
    défile un peu (règle validée « jamais sous 52 % de la largeur »), les boutons sont sous le bord à 844 × 390.
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
