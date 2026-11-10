# Arena Ascendant — tâches en attente

Tâches demandées ou proposées, pas encore faites. Quand une tâche est terminée : la retirer d'ici et décrire le résultat
validé dans `docs/SPEC.md`.

## Liste n°2 du 04/11/2026 : terminée, restent des propositions à valider par l'utilisateur

9. Sons de sorts : **étude faite le 04/11/2026, Drain Life corrigé ; sons enregistrés réalistes validés et faits pour le
   Mage et le Prêtre (SPEC.md) ; restent le Druide (vent, feuilles, bois, pluie), le Démoniste (feu qui gronde,
   grésillement, murmures, aspiration), le Chevalier de la mort (chaînes, glace massive, souffle spectral), et Pain
   (murmures).** Propositions de l'étude (a à f) :
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

## Mode PVE : première proposition du 09/11/2026, détails à valider par l'utilisateur

Livré : onglets PvP / PvE, monde « The Mistvale Road », 7 camps + gardien, château à traverser jusqu'au roi au sommet du donjon, aventure en groupe en ligne de 5 avec camps agrandis (docs/SPEC.md).
Groupe, choix faits sans validation : un ami qui part quitte l'aventure (son héros reste à terre, pas d'IA) ; la progression (dernier feu, herse) est commune au groupe ; un ami qui rejoint le groupe en cours d'aventure attend la suivante.
Choix faits sans validation (à confirmer ou changer) :
1. Mort : retour au dernier **feu de camp** atteint au bout de 4 s, en pleine forme, sans pénalité ; pas de défaite.
2. Hors combat (5 s sans coup), **régénération rapide** : 5 % des PV et de la ressource par seconde.
3. Victoire = le roi (Varkhul the Ashen King, démoniste mort-vivant) vaincu au sommet du donjon : écran « Victory »
   (temps, chutes, dégâts, soins, éliminations), « Play again » / « Back to lobby ». Le gardien de la porte (Morvain
   the Hollow) garde le levier de la herse (la herse ne se lève qu'au levier, même gardien vivant). Château à ciel ouvert (ruine), plan en enfilade : cour → grande salle →
   grand escalier → galerie → escalier du donjon → sommet.
4. Monstres = modèles de héros existants (morts-vivants, elfe, orc) et formes du druide (félin, ours) ; un vrai
   bestiaire (loups, squelettes, araignées…) demanderait de nouveaux modèles libres de droits.
5. Difficulté du lobby appliquée aux monstres ; dégâts des monstres réduits (28 à 50 % d'un héros), PV 30 à 40 % (gardien 120 %, roi 160 %) : mesuré, chaque classe jouée par l'IA bat chaque camp de la route et le roi ; dans le château, la grande salle (3 monstres de mêlée) est le combat le plus dur (17 à 30 % de PV restants), le prêtre est lent partout (peu de dégâts). Pas de monstre soigneur : un prêtre mort-vivant rendait son camp imbattable pour les classes de mêlée.
6. Pistes suivantes : quêtes / dialogues, butin et progression, autres zones, coopération en ligne, carte du monde
   (mini-carte), salles couvertes (plafonds : caméra à revoir), boss avec des phases.
