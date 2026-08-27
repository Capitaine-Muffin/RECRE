# Le système RECRE — rétro-ingénierie des maps Warcraft III

Tout ce document est tiré des cinq `.w3x` fournis, extraits par les outils de
`tools/`. Rien n'est deviné : chaque constante citée est dans `data/rules/*.json`
et chaque unité dans `data/catalog/units.json`.

---

## 1. Ce que c'est, en une phrase

**La Récréation** est un *Castle Fight* francophone à thème cour de récré :
5 contre 5, personne ne contrôle d'armée. On achète des **bâtiments qui
produisent des unités tout seuls**, ces unités partent automatiquement vers la
base adverse, et la première équipe à détruire le **Château de Sable** ennemi
gagne.

Le joueur ne fait qu'une chose pendant toute la partie : **décider quoi
construire, et quand**. C'est un jeu d'économie et de composition, pas de micro.

## 2. Les cinq maps sont le même moteur

| Map | Thème | Unités custom | Taille | Tick de spawn | Or de départ |
|---|---|---|---|---|---|
| `La_Recreation_retour_du_mag_v1.4` | Jouets (G.I. Joe, Lego, Pikachu, Goku) | 84 | 64×64 | 2 s | 10 |
| `La_Recreation_de_retour_du_mag2` | Jouets (version antérieure) | 57 | 64×64 | 2 s | 10 |
| `La_Recreation_ninja` | Naruto / Konoha | 54 | 53×54 | 2 s | 10 |
| `La_Recreation_4.01` | Jouets + super-héros + LOTR + Harry Potter | 154 | 64×64 | 5 s | 20 |
| `Recreation_dans_les_iles_v1.2` | Sous-marin / Naga / Murloc | 72 | 249×249 | *(script protégé)* | — |

Même déclencheurs, mêmes régions (`Base1`, `Work`, `ToSchool`, `zone_mioche`,
`zone_morveux`), mêmes identifiants d'unités (`oC00` le gosse, `oC36` le
château, `nC12` la maîtresse, `hC32` la bombe à eau) d'une map à l'autre.

**C'est l'observation la plus importante du projet** : le contenu est une couche
de thème posée sur un moteur fixe. Un jeu mobile bâti sur ce moteur peut donc
sortir plusieurs univers sans retoucher les règles.

## 3. La boucle de jeu

```
 ┌─ +1 or toutes les 0,5 s (= 120 or/min) ──────────────────┐
 │                                                          │
 │   MAIS le revenu est coupé tant qu'un de vos bâtiments   │
 │   est en construction                                    │
 │                                                          │
 ▼                                                          │
 Le joueur place un bâtiment (15 à 400 or)                  │
 │                                                          │
 ▼                                                          │
 Toutes les 5 s, CHAQUE bâtiment lance une production       │
 │                                                          │
 ▼                                                          │
 L'unité sort → elle change de propriétaire (IA d'équipe)   │
 → ordre « attaquer » vers la base adverse                  │
 │                                                          │
 ▼                                                          │
 Les deux flots se rencontrent au milieu et se détruisent ──┘
 │
 ▼
 Le survivant atteint le Château de Sable ennemi (10 000 PV) → victoire
```

### Le détail qui fait tout le jeu

**Construire coupe le revenu.** `Trig_When_Building` désactive le déclencheur
d'or du joueur dès qu'il pose une fondation ; `Trig_Finished_Building` et
`Trig_Canceled_Building` le réactivent, et un balayage de sécurité le rallume
toutes les 60 s. Chaque achat coûte donc son prix *plus* le revenu perdu pendant
le temps de construction (10 à 298 s selon le bâtiment).

C'est le seul vrai arbitrage du jeu, et il est élégant : un bâtiment cher n'est
pas cher parce qu'il coûte de l'or, il est cher parce qu'il vous fait taire
pendant cinq minutes.

### Le transfert de propriété

Quand une unité finit d'être produite (`EVENT_PLAYER_UNIT_TRAIN_FINISH`) :

1. `ReplaceUnitBJ` la recrée (remise à zéro d'état) ;
2. `SetUnitOwner` la donne au **joueur 10** (équipe 1) ou **11** (équipe 2) —
   deux slots ordinateur qui ne jouent pas, ils ne servent qu'à posséder les
   armées ;
3. `IssuePointOrderLocBJ(..., "attack", région base adverse)`.

Le joueur perd donc le contrôle de ses unités à la seconde où elles sortent.
Un balayage toutes les 30 s (`mouvement_auto_T1/T2`) redonne l'ordre d'attaque à
toutes les unités de l'IA d'équipe, pour que rien ne reste planté.

## 4. Constantes de départ (v4.01)

| | |
|---|---|
| Or de départ | 20 |
| Bois de départ | 1 |
| Nourriture | 10, plafond 35 |
| Revenu | +1 or / 0,5 s = **120 or/min** |
| Tick de production | 5 s |
| Balayage de ré-attaque | 30 s |
| Heure fixée à | 22 h, cycle jour/nuit désactivé |
| Brouillard de guerre | entièrement désactivé (`FogEnableOff` + `FogMaskEnableOff`) |
| Handicap d'XP | 200 % |
| PV du Château de Sable | 10 000 |

Le brouillard désactivé est important : **les deux équipes voient tout, tout le
temps**. Il n'y a aucune information cachée. Le jeu est un problème d'économie
ouvert, pas un jeu de reconnaissance.

## 5. Les deux conditions de victoire

1. **Normale** — le Château de Sable adverse (`oC36`, 10 000 PV) meurt.
2. **La Bombe à Eau** — `hC32` : 5 PV, 1000 de dégâts, vitesse 350. Elle se
   construit depuis le Canon à Ion (`oC33`, 20 or), passe sous contrôle de l'IA
   d'équipe et reçoit un ordre *move* (pas *attack*) vers la zone ennemie. Si
   elle **entre dans la région adverse**, le château explose immédiatement et la
   partie est finie.

La bombe à eau est un pari : 20 or, 5 points de vie, elle meurt si quoi que ce
soit la touche — mais si la ligne adverse est vide une seconde, elle gagne la
partie. C'est le meilleur morceau de design de toute la map, et il faut le
garder.

## 6. Le gosse, la maîtresse et le coin

Chaque joueur possède un **Mioche** (`oC00`) ou **Morveux** (`oC06`) — 1000 PV,
vitesse 300. C'est son avatar-constructeur : c'est lui qui pose les bâtiments.

S'il meurt (`Trig_KidDeath4T1/T2`) :

1. une **Maîtresse** (`nC12`) apparaît sur le cadavre et s'en va vers la région
   `ToSchool` ;
2. le joueur lit : *« Tu as été un vilain garçon ! Va au coin 1 minute ! »* ;
3. **60 secondes** plus tard le gosse réapparaît à la base.

Une minute sans pouvoir construire, avec le revenu qui continue de tomber : la
punition est un plein d'or qu'on ne peut pas dépenser. Thématiquement parfait,
mécaniquement juste. À garder tel quel.

## 7. Ce qui se construit

Quatre familles, toutes visibles dans `docs/generated/units.md` :

- **Casernes** (`hC03` camp d'orc 15 or, `hC14` fort en Lego 20 or,
  `hC15` château en Lego 40 or, `hC27` héliport 60 or, `h001` industrie de
  robots 60 or…) — le cœur : elles produisent en boucle.
- **Tours** (`oC05` tour de défense 5 or, `oC11` lance-flèche, `oC13`
  turbolaser, `oC31` lance-glaive, `o006` tour anti-fufu…) — restent au joueur,
  ne bougent pas, et se **surclassent** en chaîne (anti-fufu → anti-fufu
  améliorée ; turbolaser → aérien / terrestre).
- **Héros** — 85 or et 10 nourriture, achetés aux autels (`o002` Autel des
  Héros, `o003` Autel du Bien, `o004` Autel du Mal, `n00B` Autel des Rêves).
  Superman, Batman, Gandalf, Sauron, Voldemort, Pikachu, Hannibal Lecter…
- **Coups spéciaux** — Bombe à Eau (victoire éclair), Paquet de Pétard Chinois
  (`hC26`, 400 or, 180 s de construction), Bombe Nucléaire (`h006`), Bombe
  Aérosol (`nC29`).

### Le déséquilibre le plus visible

`docs/generated/spawners.md` chiffre le rendement de chaque caserne en
« PV d'armée produits par seconde, pour 100 or investis » :

| Bâtiment | Or | PV/s pour 100 or |
|---|---|---|
| Héliport Chasseur `h00Q` | 10 | **700** |
| Héliport Bombardier `h00R` | 10 | **700** |
| Héliport Hélicoptère `h00P` | 10 | **500** |
| Industrie de gobelin soldat `h00M` | 20 | 200 |
| Fort en Lego `hC14` | 20 | 125 |
| Campement d'orc 1G `hC03` | 15 | 67 |

Les trois héliports spécialisés à 10 or sont dix fois plus rentables que la
caserne de base. Ce sont des surclassements d'un héliport à 60 or déjà payé —
mais le rapport reste énorme. **À rééquilibrer au portage**, en gardant l'idée
de la spécialisation.

## 8. Règles sociales codées en dur

- *« Le Rush Base est interdit »* (description de la map) : attaquer la base
  adverse avec son propre gosse est interdit **par convention**, pas par le
  code.
- La sanction est manuelle : le joueur rouge (hôte) tape `-kick rouge`,
  `-kick bleu`, `-kick cyan`, `-kick pourpre`, `-kick jaune`, `-kick orange`,
  `-kick vert`, `-kick rose`, `-kick gris`, `-kick bleuc` — ce qui déclenche
  `CustomDefeatBJ` sur la cible.

Neuf déclencheurs de kick codés à la main, exécutables par une seule personne,
sans vote ni recours. Sur mobile ce sera un vote ou une règle serveur.

## 9. Origine

L'arbre d'améliorations de la map « dans les îles » contient des recherches
nommées en anglais — *Runner*, *Dwarven Rifleman Training*, *Fell Grunt
Training*, *Mountainking*, *Lightning / Flame / Poison Tower Research*. Ce
vocabulaire vient de **Castle Fight**, la map Warcraft III dont ce genre
descend. La Récréation en est une relecture francophone et enfantine — et cette
relecture, c'est la valeur du projet, pas le moteur.
