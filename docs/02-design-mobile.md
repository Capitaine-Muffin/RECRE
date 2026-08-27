# RECRE mobile — document de conception

Point de départ : le système décrit dans `01-analyse-systeme-wc3.md`. Ce
document dit ce qu'on garde, ce qu'on change, et pourquoi.

---

## 1. Ce qui se porte tel quel

Le moteur de La Récréation est déjà, sans le savoir, un jeu mobile :

| Propriété de la map WC3 | Pourquoi c'est bon pour du mobile |
|---|---|
| Aucun contrôle d'unité | Pas de micro, pas de joystick, pas de sélection à 5 doigts |
| Une décision à la fois (quoi construire) | Un tap. Jouable à une main, en portrait |
| Brouillard désactivé, tout est visible | Aucune caméra à déplacer pour comprendre l'état de la partie |
| Revenu continu, pas de récolte | Pas de gestion d'ouvriers |
| Parties courtes, condition de victoire unique | Format session mobile |

Le portage n'a donc pas à inventer une boucle. Il doit **retirer ce que
Warcraft imposait** : la caméra RTS, les groupes de contrôle, la barre de
commandes à 12 boutons.

## 2. Format retenu

**Au lancement : solo contre l'IA.** Le jeu tient entièrement dans
`modele-jeu-mobile` — HTML/CSS/JS dans `www/`, zéro build, hors ligne,
publiable par un tag. Pas de serveur, pas de compte, pas de réseau.

Le multijoueur viendra (§8, étape 3), et le moteur est écrit dès maintenant
pour le recevoir sans réécriture (§6). Mais ce n'est pas ce qu'on livre
d'abord, et il ne faut pas faire semblant : tout ce qui suit décrit un jeu
solo.

- **1 contre 1 contre l'IA.** Une base à moi, une base adverse tenue par
  l'ordinateur. Le format 3c3 de l'original reste la cible du réseau, et rien
  dans le moteur ne l'empêche — une équipe est déjà une liste de joueurs, elle
  n'en contient qu'un pour l'instant.
- **Une lane, deux bases.** Comme la map d'origine : `Base1` ↔ `Work`, la
  rencontre au milieu.
- **8 à 12 minutes** par partie.
- **Portrait**, une main. La lane est verticale : ma base en bas, l'ennemie en
  haut, la mêlée au centre de l'écran.
- **Jouable au clavier et au tactile**, comme l'exige le modèle : le jeu sera
  essayé depuis un navigateur de bureau autant que depuis un téléphone.
- **La partie se met en pause et reprend** — l'état de la simulation tient dans
  un objet sérialisable, on le range dans `localStorage` en quittant.

## 3. Écran

```
┌─────────────────────────┐
│  ▲ base ennemie  9 320  │  PV du château adverse
├─────────────────────────┤
│                         │
│      zone de mêlée      │  la caméra ne bouge pas :
│    (les deux flots)     │  toute la lane tient à l'écran
│                         │
├─────────────────────────┤
│   MES EMPLACEMENTS      │  6 cases de construction
│   [■][■][+][+][+][+]    │  tap sur [+] → panneau d'achat
├─────────────────────────┤
│  or 148   pop 7/35      │
│  [casernes][tours][héros][coups]│
└─────────────────────────┘
```

Décision de conception : **des emplacements fixes, pas de placement libre.**
Placer un bâtiment au pixel près sur un écran de téléphone est pénible, et dans
la map d'origine la position n'a presque aucune importance — les unités partent
en ligne droite quoi qu'il arrive. Les tours, elles, gardent un placement
significatif : elles vont sur des emplacements *le long de la lane*, où la
distance compte vraiment.

## 4. Économie

On garde les chiffres de la 4.01, ils sont éprouvés :

| | Valeur | Note |
|---|---|---|
| Or de départ | 20 | |
| Revenu | +1 / 0,5 s (120/min) | affiché comme « 2 or/s », plus lisible |
| Population | 10, plafond 35 | |
| Tick de production | 5 s | tous les spawners en même temps, comme l'original |
| PV du château | 10 000 | |

**On garde la règle du revenu coupé pendant la construction.** C'est le seul
arbitrage du jeu ; sans elle il ne reste qu'un bouton « acheter le plus cher ».
Sur mobile il faut la rendre *visible* : pendant la construction, le compteur
d'or passe en gris avec un chrono, et le manque à gagner s'affiche
(« −38 or »). Une règle invisible dans WC3 devient un objet d'interface.

## 5. Contenu au lancement

Un seul thème pour commencer — **Cour de récré**, le thème d'origine — avec de
quoi tenir une méta :

- **6 casernes** : petit soldat, brique de construction, cavalier de brique,
  peluche, robot, hélico de poche.
- **4 tours**, chacune avec un surclassement (comme anti-fufu → améliorée).
- **6 héros** à 85 or / 10 pop, un par « boîte à jouets », achetés à un autel.
- **3 coups spéciaux** : la Bombe à Eau (victoire éclair, à garder intacte), le
  Paquet de Pétards, la Bombe Aérosol.

Soit environ 20 objets achetables. La 4.01 en a 154 : c'est trop pour un premier
jet et une bonne partie fait doublon (`docs/generated/units.md` montre les
familles quasi identiques). On monte ensuite par saisons.

### Les thèmes comme contenu

Les cinq maps prouvent que le thème est détachable du moteur : ninja, jouets et
sous-marin tournent sur les mêmes déclencheurs. Un **thème = un jeu de skins +
un jeu de noms**, sur les mêmes 20 emplacements de la grille d'équilibrage.
C'est la voie de contenu la moins chère et la plus fidèle à l'original.

## 6. Architecture technique

**Simulation déterministe à pas fixe, écrite comme telle dès la première
ligne.** Elle tourne dans le navigateur pour l'instant ; c'est le seul point
qui changera quand le réseau arrivera.

C'est la décision structurante du projet. Un moteur déterministe se retrofite
mal : il faut traquer après coup chaque `Math.random`, chaque `Date.now`,
chaque parcours d'objet dont l'ordre n'est pas garanti. Écrit déterministe
d'emblée, il coûte à peu près la même chose, et l'étape 3 devient un
changement de source d'entrées plutôt qu'une réécriture.

### La forme

```
www/
  moteur/     la simulation. Aucun DOM, aucun son, aucune horloge, aucun hasard
              non semé. Ne dépend de rien. Tourne aussi bien dans Node.
  rendu/      lit l'état du moteur et dessine. N'écrit jamais dedans.
  ia/         produit des intentions, exactement comme un joueur humain.
  jeu.js      assemble les trois et tient la boucle
```

Le moteur est une fonction pure :

```js
etatSuivant = avancer(etat, entreesDuTick)
```

`entreesDuTick` est une liste d'intentions `{joueur, action, cible}`. D'où
elles viennent — le doigt du joueur, l'IA locale, plus tard une socket — le
moteur ne le sait pas et ne doit jamais le savoir. **C'est tout le truc** :
brancher le réseau, c'est remplir cette liste autrement.

### Les règles qu'on ne transige pas

1. **Pas fixe de 100 ms** (10 Hz), boucle à accumulateur. Aucune grandeur du
   jeu n'est multipliée par un `deltaTime` variable. 10 Hz suffit : personne ne
   contrôle d'unité, il n'y a pas de visée.
2. **Aucun `Math.random()` dans `moteur/`.** Un générateur semé
   (`mulberry32`), rangé dans l'état de la partie, avancé par la simulation.
   Même graine et mêmes entrées ⇒ même partie, à l'octet près.
3. **Aucune horloge dans `moteur/`.** `Date.now()` et `performance.now()`
   vivent dans la boucle hôte, jamais dans la simulation. Le temps du jeu, ce
   sont les ticks.
4. **Positions et PV en entiers.** Millièmes de case pour les positions ; pas
   de flottant accumulé d'un tick à l'autre. Le flottant n'est pas indéterminé
   en JavaScript (IEEE 754 partout), mais l'entier évite le débat et rend l'état
   comparable par égalité stricte.
5. **Parcours toujours dans le même ordre.** Les unités vivent dans un tableau,
   avec un identifiant entier croissant. Jamais de `Object.keys`, jamais de
   `Set` d'objets, jamais de tri instable.
6. **`rendu/` n'écrit jamais dans l'état.** Il interpole entre le tick courant
   et le précédent pour l'affichage, et c'est tout.

### Ce que ça donne gratuitement, dès le solo

- **Le journal de partie** — `{graine, [{tick, intentions}]}` — quelques
  kilo-octets. Rejouable, donc : replays, rapports de bug reproductibles,
  et parties de test rejouées en boucle pour l'équilibrage.
- **Un test de non-régression qui vaut quelque chose** : rejouer un journal
  enregistré et comparer une empreinte de l'état final. Si un correctif change
  le déroulement d'une partie, on le voit tout de suite.
- **La sauvegarde** : l'état est déjà sérialisable, par construction.

### Le combat

C'est le seul morceau à écrire de zéro : dans WC3 c'est le moteur qui gère
cible, portée, projectiles, types d'armure. Le remplacement minimal :

- une unité avance sur la lane jusqu'à trouver une cible à portée ;
- elle frappe tous les `cooldown` ticks pour `dmg_per_hit` ;
- réduction de dégâts par type d'armure (table à 5 entrées, comme WC3) ;
- pas de pathfinding : la lane est un couloir 1D avec des voies parallèles.

**Ce dernier point est le vrai raccourci.** La lane 1D remplace tout le
pathfinding de Warcraft, et elle est fidèle : dans la map d'origine les unités
vont en ligne droite vers un rectangle.

### L'IA adverse

Elle n'a **aucun accès privilégié** : elle lit l'état public et produit les
mêmes intentions qu'un joueur. Pas de triche à l'or, pas de vision cachée —
le brouillard est de toute façon désactivé dans l'original (§4 du doc
d'analyse), donc tout le monde voit tout, y compris elle.

Trois niveaux, qui se règlent sur un seul curseur : le délai de réaction, en
ticks, entre le moment où une composition adverse devient lisible et celui où
l'IA y répond. C'est plus honnête qu'un bonus d'or, et ça se joue mieux.

Le combat est le seul morceau à écrire de zéro : dans WC3 c'est le moteur qui
gère cible, portée, projectiles, types d'armure. Le remplacement minimal :

- une unité avance sur la lane jusqu'à trouver une cible à portée ;
- elle frappe toutes les `cooldown` secondes pour `dmg_per_hit` ;
- réduction de dégâts par type d'armure (table à 5 entrées, comme WC3) ;
- pas de pathfinding : la lane est un couloir 1D avec des voies parallèles.

**Ce dernier point est le vrai raccourci.** La lane 1D remplace tout le
pathfinding de Warcraft, et elle est fidèle : dans la map d'origine les unités
vont en ligne droite vers un rectangle.

### Données manquantes, à mesurer en jeu

Les fichiers de map ne contiennent que les champs que l'auteur a *modifiés*. Les
cadences d'attaque, elles, sont presque toutes héritées des unités Warcraft
standard, dont la table vit dans le client du jeu et **pas** dans les `.w3x`.
`docs/generated/spawners.md` marque ces cas `inherited`. Il faut donc fixer les
cadences nous-mêmes, par équilibrage — on a les PV, les dégâts par coup, les
coûts, la vitesse, l'armure, et c'est l'essentiel.

## 7. Monétisation et social

- **Cosmétique uniquement.** Le jeu est symétrique et lisible ; vendre de la
  puissance casserait la seule chose qui le tient. Ça vaut aussi en solo : une
  IA qu'on bat en payant n'est pas un adversaire.
- Thèmes, skins de château, effets de destruction, emotes. En solo, le produit
  qui se tient est un **déblocage à vie** qui ouvre les thèmes — ça rentre tel
  quel dans le `store.json` du modèle.
- L'interdiction du « rush base » n'est plus une convention : les emplacements
  de construction sont hors de portée des unités adverses par construction.
- Le social — `-kick`, votes, abandon — ne se pose qu'à l'étape 3. À noter
  quand elle viendra : le kick unilatéral par l'hôte de la 4.01 est
  inacceptable dans un jeu public, ce sera un vote ou un remplacement par
  l'IA.

## 8. Étapes

**Étapes 1 et 2 : c'est le périmètre en cours.** Solo contre l'IA, dans
`modele-jeu-mobile` tel quel, publiable par un tag. Rien d'autre n'est engagé.

1. **Prototype jouable** — une lane, 3 casernes, 1 tour, le château, une IA
   qui achète au hasard. But : vérifier que la boucle « acheter et regarder »
   tient sur téléphone. Rien d'autre ne compte tant que ce n'est pas prouvé.
   Le moteur est déterministe dès ce prototype (§6) — c'est le moment où ça
   coûte le moins cher.
2. **La boucle complète** — revenu coupé pendant la construction, Bombe à Eau,
   punition du coin, héros, une IA qui répond à la composition adverse.
   Livrable : un jeu solo publiable.

Puis, dans l'ordre où ça se décide plus tard :

3. **Réseau** — 3c3 temps réel. **Hors modèle** : il faut un serveur, donc un
   dépôt à part. WebSocket et matchmaking, rien à voir avec un backend REST.
   Le client garde son moteur ; ce qui change, c'est que les intentions
   arrivent d'une socket au lieu de l'IA locale, et que le serveur fait
   autorité en rejouant la même simulation.
4. **Contenu** — les 20 achetables, un thème, l'équilibrage.
5. **Deuxième thème** — pour valider que le moteur est bien détachable du
   contenu, ce que les cinq maps promettent.

## 9. Ce qui ne peut pas être porté

Les maps d'origine sont truffées de propriété intellectuelle tierce : Pikachu,
Bob l'Éponge, Superman, Batman, Gandalf, Sauron, Voldemort, Goku, les Bisounours,
Barbie, G.I. Joe, Lego, Playmobil, Naruto, Terminator, Dark Revan — et les
modèles 3D et textures importés qui vont avec (`assets/extracted/*/war3mapImported/`).

C'était sans conséquence pour une map amateur diffusée entre amis. **Ça ne peut
pas partir sur un store.** Voir `04-assets-et-propriete-intellectuelle.md` : le
détail, et les remplacements proposés. La bonne nouvelle est que le charme de La
Récréation ne tient pas aux licences mais à l'idée — *des enfants qui se battent
avec leurs jouets pendant la récré* — et cette idée-là est libre.
