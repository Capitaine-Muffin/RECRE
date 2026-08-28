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
| Brouillard désactivé, tout est visible | Aucune information cachée, donc aucune reconnaissance à faire : la caméra sert le confort, jamais le renseignement |
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
│  ▲ château adverse 9320 │
├─────────────────────────┤
│         ▲ 4             │  unités hors champ, en couleur d'équipe
│  [caserne]              │
│              [tour]     │  le terrain fait ~3 écrans de haut ;
│      ~ mêlée ~          │  la caméra suit le front toute seule
│  [fort]                 │
│         ▼ 2             │
│   ⌖ Revenir à la bataille│  (n'apparaît que si on s'est écarté)
├─────────────────────────┤
│  or 148   pop 7/35      │
│   MES EMPLACEMENTS      │  6 cases de construction
│   [■][■][+][+][+][+]    │  tap sur [+] → panneau d'achat
└─────────────────────────┘
```

### Le panneau d'achat est une feuille, pas un écran

Il s'ouvre en bas et laisse **54 % du terrain visible** au-dessus : on continue
de voir la bataille pendant qu'on choisit, et c'est souvent elle qui dit quoi
acheter. Non modal, donc, et refermé par la croix, par `Échap`, ou en touchant
le terrain.

Il ne touche pas à la caméra — voir juste en dessous pourquoi.

### La caméra

Le terrain est plus haut que l'écran — environ **trois écrans** — et on en
regarde une tranche. La caméra **suit le front** : le point entre l'unité la
plus avancée de chaque camp, c'est-à-dire l'endroit où ça se joue. Terrain
vide, elle regarde **sa propre base** et non le milieu du terrain — c'est le
début de partie, on y construit, et renvoyer le joueur sur une pelouse déserte
à chaque fois qu'il ferme le panneau est le contraire de ce qu'il veut. On peut
l'écarter au doigt, à la molette ou aux flèches — et **elle lui appartient dès
lors qu'il y a touché** : elle n'y revient plus d'elle-même. Un bouton *Revenir
à la bataille* apparaît dès qu'elle s'est éloignée, et le lui rend.

Une caméra qui reprend la main toute seule produit un bug qu'on a eu, et qui ne
se lit pas du tout comme un problème de caméra : le joueur ouvre le panneau
d'achat, la bataille avance pendant qu'il choisit, il referme — et la caméra
rattrape le front. Le décor glisse de **79 pixels**, presque deux hauteurs de
figurine, et on jurerait que les unités reculent. Le bug avait d'ailleurs été
rapporté comme « les mobs font demi-tour quand je construis une tour ».

D'où la règle : la caméra suit tant qu'on ne l'a pas touchée, et se tait
ensuite. Aucun délai, aucune reprise automatique — il n'y a rien à régler et
rien qui surprenne.

**Le décor colle au doigt.** Le lissage du suivi ne s'applique qu'au suivi
automatique : appliqué au glissé, il faisait traîner le décor derrière la main
— 275 pixels rattrapés sur 300 une demi-seconde après la fin du geste, ce qui
se ressent comme une caméra lente sans en être une.

**Un lancer prolonge le geste** d'une demi-page environ, avec un freinage
exprimé par seconde et non par image : sinon un écran à 120 Hz freinerait deux
fois plus vite qu'un écran à 60. Molette et flèches ont été agrandies dans la
foulée — traverser le terrain demandait vingt-cinq appuis de flèche, il en faut
six.

Ce qui sort du cadre ne disparaît pas pour autant : une flèche en haut et en
bas compte les unités hors champ, dans la couleur du camp à qui elles sont.

**Le défilement est vertical, et seulement vertical.** La simulation est en une
dimension : la largeur ne sert qu'à étaler les unités pour qu'elles ne se
marchent pas dessus. Un défilement latéral ne montrerait que du vide, et
coûterait un geste au joueur pour rien.

La place gagnée sert à quelque chose : les bâtiments construits sont **posés
sur la carte**, de part et d'autre de la lane en s'éloignant de la base. On
voit son installation grandir au lieu de la lire dans une barre d'icônes — et
un chantier s'affiche en translucide, parce qu'il n'est pas encore là.

Ceci dit : **Clash Royale ne défile pas.** Toute l'arène tient à l'écran, la
caméra est fixe. C'est un choix défendable, et c'était celui de la première
version d'ici. Si le terrain agrandi complique plus qu'il n'apporte, revenir en
arrière tient dans une constante : `PART_VISIBLE` dans `rendu/scene.js`, à
remettre à 1.

Agrandir le terrain n'a **rien changé au jeu** : la lane fait toujours la même
longueur en millipas, une unité met le même temps à la traverser, et
l'équilibrage mesuré à l'étape 1 tient tel quel. C'est du cadrage. Si on veut
de vraies marches plus longues, c'est `LANE` qu'il faut bouger, et ça, ça
rééquilibre tout.

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

Les trois interdits généraux — pas de DOM, pas de `Date.now()`, pas de
`Math.random()` non graine — sont ceux de
[`modele-jeu-mobile`](https://github.com/Capitaine-Muffin/modele-jeu-mobile),
section *Comment écrire le jeu*. Ils valent pour tous les jeux et ne sont pas
recopiés ici. Ce qui suit est ce que **RECRE** ajoute, et que `npm test`
vérifie fichier par fichier.

1. **Pas fixe de 100 ms** (10 Hz), boucle à accumulateur. Aucune grandeur du
   jeu n'est multipliée par un `deltaTime` variable. 10 Hz suffit : personne ne
   contrôle d'unité, il n'y a pas de visée.
2. **Positions et PV en entiers.** Des millipas pour les distances ; pas de
   flottant accumulé d'un tick à l'autre. Le flottant n'est pas indéterminé en
   JavaScript (IEEE 754 partout), mais l'entier évite le débat et rend l'état
   comparable par égalité stricte — ce dont vit le test d'empreinte.
3. **Parcours toujours dans le même ordre.** Les unités vivent dans un tableau,
   avec un identifiant entier croissant. Jamais de `Object.keys`, jamais de
   `Set` d'objets, jamais de tri instable.
4. **Le générateur semé vit dans l'état**, pas à côté : `mulberry32` dans
   `moteur/aleatoire.js`, sa graine rangée dans la partie et avancée par elle.
   Même graine et mêmes entrées ⇒ même partie, à l'octet près.
5. **`rendu/` n'écrit jamais dans l'état** — la caméra comprise, qui est du
   décor et ne peut donc pas changer une partie.

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

### Ce que « serveur autoritaire » implique — et ce que ça n'implique pas

Cette section décrit **l'état d'arrivée**, pas le premier jour. Lue seule, elle
donne à croire qu'un serveur est nécessaire avant de pouvoir jouer : c'est
faux, et ça a déjà envoyé une session sur une fausse piste.

**La même simulation tourne des deux côtés.** En solo et contre l'IA (étapes 1
et 2 du §8), elle s'exécute dans le client, sans réseau. Passer au 3c3 la
déplace sur un serveur — ce n'est pas une réécriture, à une condition
non négociable :

> **La simulation reste pure.** Elle prend un état et une liste d'intentions,
> elle rend l'état suivant. Le rendu la lit, ne la modifie jamais.

La règle et ses trois interdits sont dans
[`modele-jeu-mobile`](https://github.com/Capitaine-Muffin/modele-jeu-mobile),
section *Comment écrire le jeu* — elle vaut pour tous les jeux, elle n'est pas
recopiée ici.

Ce qu'elle apporte **à RECRE en particulier** : c'est elle qui rend l'étape 3
possible sans tout refaire, et c'est elle qui donne les replays et la
reconnexion par rejeu du journal annoncés plus haut. Elle se paie le premier
jour ou elle ne se paie jamais.

**Ce que le serveur coûtera vraiment, le moment venu :** une connexion
persistante (websocket), un service de mise en relation des joueurs, et une
boucle à 10 Hz vivante pour chaque partie en cours.

⚠️ **Ce n'est pas le backend de PING PIOU.** Celui-là reçoit des résumés de
partie en REST et les rejoue après coup : ni connexion permanente, ni
appariement, ni boucle temps réel. Les fonctions Edge de Supabase ne sont pas
faites pour ça. L'étape 3 est un chantier à part entière, à ne pas budgéter
comme « on rebranche le serveur existant ».

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

Les deux premières étapes sont **hors ligne, sans serveur** : la simulation
tourne dans le client. **C'est le périmètre en cours**, dans
`modele-jeu-mobile` tel quel, publiable par un tag. Rien d'autre n'est engagé.

1. **Prototype jouable** — une lane, 3 casernes, 1 tour, le château, une IA
   qui achète au hasard. But : vérifier que la boucle « acheter et regarder »
   tient sur téléphone. Rien d'autre ne compte tant que ce n'est pas prouvé.
   Le moteur est déterministe dès ce prototype (§6) — c'est le moment où ça
   coûte le moins cher. *Simulation locale.*
2. **La boucle complète** — revenu coupé pendant la construction, Bombe à Eau,
   punition du coin, héros, une IA qui répond à la composition adverse.
   *Simulation locale, adversaire IA.* **Publiable en l'état** : c'est ce qui
   permet de vérifier la boucle sur de vrais joueurs avant d'engager le réseau.

Puis, dans l'ordre où ça se décide plus tard :

3. **Réseau** — serveur autoritaire, 3c3, reconnexion. La simulation ne change
   pas : elle change d'hôte (voir §6). Le client garde son moteur ; ce qui
   change, c'est que les intentions arrivent d'une socket au lieu de l'IA
   locale. Websocket, appariement et boucle 10 Hz sont à écrire — c'est
   l'étape la plus lourde du projet, la seule qui sorte du modèle de jeu
   mobile, et elle demande son propre dépôt.
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

---

## 10. Où en est le jeu

**Étape 1 faite.** Le prototype tourne : `npm run servir`, puis
<http://localhost:8000>.

```
www/moteur/     simulation déterministe — aucun DOM, aucune horloge, aucun
                hasard non semé. Vérifié par un test, pas seulement promis.
www/rendu/      palette, sprites, dessin, scène, caméra, interface. Lecture
                seule — la caméra ne rentre jamais dans l'état de la partie.
www/ia/         l'adversaire, qui produit des intentions comme un joueur.
www/jeu.js      le seul fichier qui regarde l'horloge, et la convertit en ticks.
tests/          déterminisme, règles, sprites.  `npm test`
```

Contenu : 3 casernes, 1 tour, 2 réserves de population, 6 emplacements, un
château à 10 000 PV de chaque côté, et une IA à trois niveaux qui achète au
hasard.

### Ce que la simulation a appris pendant l'étape 1

Trois choses sont sorties de la mesure, pas de la théorie.

**Le plafond de population manquait, et sans lui la partie ne finit pas.**
Une fois les emplacements pleins, l'or n'a plus de destination et deux armées
s'annulent au milieu pour toujours : 26 parties sur 30 ne se terminaient pas.
Les maps d'origine ont ce qu'il fallait — le Coffre à Jouet (15 or, +5 places)
et le Goûter (100 or, +20). Ils sont dans le jeu, aux mêmes prix.

**Le match nul est normal quand les deux camps sont identiques.** Revenu égal,
IA identique : la symétrie est parfaite, donc rien ne casse. Dès qu'on
déséquilibre — deux niveaux d'IA différents — 7 à 8 parties sur 30 seulement
restent nulles, les autres se règlent en 4 à 5 minutes. La vraie réponse est la
**Bombe à Eau** de l'étape 2 : c'est exactement l'outil que l'original s'était
donné pour débloquer les grinds.

**Construire sans arrêt fait perdre.** L'IA la plus lente bat la plus rapide
16 à 6 : à force de poser des bâtiments, on est toujours en chantier, donc on
ne touche jamais son or. C'est le mécanisme central de l'original, et il
fonctionne sans qu'on ait eu à le forcer. Le jeu récompense celui qui sait
attendre — ce qui est très exactement ce qu'on voulait.

### Les files, et pourquoi la mêlée compte la largeur

La lane n'est pas un fil : c'est un couloir de **seize files**. Une unité tient
sa file du début à la fin, ne double personne et ne traverse personne — avant
ça, les figurines se traversaient purement et simplement, ce que personne
n'avait relevé.

Seize et pas cinq, parce qu'une ligne de cinq n'est pas une armée, c'est une
patrouille. À seize, les figurines se recouvrent légèrement sur les côtés, et
c'est voulu : le décalage en profondeur d'une file sur deux (au dessin
seulement) suffit à ce qu'on lise une foule plutôt qu'une bouillie.

Une portée mesure alors sa distance **en profondeur et en largeur**. C'est ce
qui empêche un soldat de poignarder son vis-à-vis à l'autre bout d'un front de
seize files — et c'est ce qui donnera leur intérêt aux unités qui tapent loin :
elles, la largeur du contact ne les limite pas. À `ECART_VOIE = 3500`, la mêlée
atteint trois files de chaque côté ; il reste tout l'espace au-dessus pour une
unité à distance.

Aucune stat d'unité n'a bougé.

#### Toutes les distances tiennent à une seule référence

Elles n'y tenaient pas, et ça s'est vu. `ECART_MIN` avait été posé à 10 000
millipas, censément « la hauteur d'une figurine à l'écran » — calculé en
oubliant que les sprites sont dessinés au **zoom 3**. La vraie valeur est
27 000. Les unités se recouvraient donc de **64 % en profondeur** : elles ne
faisaient pas la queue, elles s'empilaient, et une armée qui montait vers la
base adverse se lisait comme une bouillie horizontale au lieu de rangs
successifs.

C'est le genre d'erreur qui ne se voit pas dans un test — le déterminisme était
intact, l'équilibrage aussi — et que seul un œil sur l'écran attrape.

Toutes les distances sont désormais dérivées de `TAILLE_FIGURINE`, avec le
calcul écrit à côté :

| | |
|---|---|
| `TAILLE_FIGURINE` | 27 000 — une figurine, à l'écran, en millipas |
| `ECART_MIN` | = `TAILLE_FIGURINE` : deux unités se touchent sans se recouvrir |
| `ECART_VOIE` | 0,35 × — la mêlée porte à trois files de chaque côté |
| portée de mêlée | 1,22 × `ECART_MIN` — **doit** dépasser l'écart, sinon deux unités qui se bloquent restent face à face sans pouvoir se toucher |
| portée de tour | 9 × `ECART_MIN` |

Le rapport entre la portée de mêlée et `ECART_MIN` n'est pas un réglage
d'équilibrage : c'est une contrainte. En dessous de 1, le jeu se fige.

Mesuré après correction : 10 % de matchs nuls et 305 s de médiane, contre 10 %
et 310 s avant. La géométrie change ce qu'on voit, pas comment ça se joue.

### L'IA achetait 71 % de tours

En regardant une capture, un détail : six bâtiments construits, et une
population de 2 sur 10. L'IA avait rempli ses emplacements de tours, qui ne
coûtent aucune population — et ne produisent aucune unité.

La cause est une conséquence de la règle centrale. Elle achetait « ce qu'elle
peut se payer maintenant » ; or construire coupe le revenu, donc elle était
presque toujours fauchée, donc seule la tour à 5 or lui était accessible.
Mesuré : **71 % de tours**. Elle ne se faisait jamais d'armée.

Elle se choisit désormais une envie et **économise** jusqu'à pouvoir se
l'offrir. La répartition redevient uniforme, autour de 17 % par bâtiment.

Ça invalidait tout ce qui avait été mesuré avant. Les chiffres qui valent, sur
30 parties, `normal` contre `tranquille` :

| | matchs nuls | durée médiane |
|---|---|---|
| portée en profondeur seule (référence) | 17 % | 310 s |
| seize files, portée en largeur comprise | **10 %** | 310 s |

Les files ne coûtent rien, et l'IA réparée fait plus de bien que tout le reste.

### Le coût en calcul : nul

0,01 ms par tick à 121 unités, pour un budget de 100 ms. Même au pic observé
— 294 unités — le ciblage en O(n²) reste sous la milliseconde. Rien à
optimiser tant que l'ordre de grandeur ne change pas.

### Ce qui reste faible

- **Les cadences d'attaque sont posées à la main**, les maps ne les
  contiennent pas (§6). C'est l'équilibrage de l'étape 4.
- **La tour ne vaut pas son emplacement.** Deux tours retardent une percée
  d'une douzaine de secondes. Aux valeurs de l'original — et l'original a le
  même souci.
- **Le Château de Sable est le sprite le plus faible.** Il se lit, mais il
  s'aplatit ; c'est l'objet qu'on regarde mourir, il mérite mieux.
- **Il n'y a aucune unité à distance**, alors que toute la géométrie des files
  est faite pour en accueillir. C'est le prochain contenu évident : une unité
  qui tape par-dessus la mêlée depuis les rangs de derrière.
- **L'IA reste bête** : elle choisit son envie au hasard. Elle économise
  correctement, c'est tout. Répondre à la composition adverse est prévu à
  l'étape 2.

## 11. Les dessins

Tout est en pixel art écrit à la main, dans `www/rendu/sprites.js` : des
tableaux de chaînes, un caractère par pixel, une palette commune de vingt-deux
teintes dans `palette.js`. Aucun fichier image — rien à charger, rien qui
manque hors ligne, et un diff Git qui montre ce qui a bougé sur le dessin.

`tests/sprites.mjs` vérifie que chaque sprite a des lignes de longueur
constante et n'emploie que des couleurs de la palette : une faute de frappe
dans un dessin de vingt-quatre lignes décale une colonne entière et ne se voit
pas à l'œil.

La planche de contact se régénère avec `python3 tools/apercu_sprites.py`
(`docs/generated/sprites.png`) — elle lit les sprites depuis le code, donc elle
ne peut pas mentir sur ce qui est réellement dessiné.

| | |
|---|---|
| Unités, 16×16 et 24×20 | Petit Soldat, Soldat de Briques, Cavalier de Briques |
| Bâtiments, 24×24 | Caserne des Petits Soldats, Fort en Briques, Citadelle en Briques, Tour de Défense, Coffre à Jouets, Goûter |
| Château, 32×24 | Château de Sable |
| Enfants, 16×20 | Mioche, Morveux, Maîtresse |

Les proportions font le ton : grosse tête et petit corps pour les enfants, et
la Maîtresse dessinée plus haute qu'eux — c'est elle qui les fait paraître
petits. Le contour n'est jamais noir pur mais `#2f2740`, un violet très
sombre, qui adoucit la silhouette.

Les noms sont neutres par construction : aucun ne renvoie à une franchise (§9,
et `docs/04-assets-et-propriete-intellectuelle.md`).

## 12. Le décor

Règle unique, et sévère : **rien ne doit concurrencer les figurines**. L'écran
est déjà chargé. Un décor qui se voit est un décor raté — celui-ci doit
seulement empêcher le sol d'être une dalle unie.

D'où une seule idée plutôt qu'un empilement d'objets : **la cour est un terrain
de foot**, en herbe, dans l'axe de la lane. Les deux armées se battent dessus.
Ça situe le lieu en une seconde, ça donne des repères de distance — les
touches, la ligne médiane, le rond central, les surfaces de réparation — et ça
ne coûte pas un pixel opaque. Deux marelles sur les côtés, et les bandes de
tonte alternées qui défilent quand la caméra bouge.

Les tracés sont de la craie : du blanc cassé, sans volume et sans ombre, donc
rien qui puisse passer pour un objet du jeu.

### Le vert : mon raisonnement était à l'envers

Le Petit Soldat et la Caserne sont verts. J'en avais déduit qu'il fallait une
pelouse **sombre**, pour que les figurines ressortent par la luminosité. C'était
faux, et la capture l'a montré tout de suite quand la pelouse a été éclaircie.

Chaque sprite porte un contour `#2f2740`. Sur une pelouse sombre, ce contour se
**noie** dans le fond et la silhouette se dilue. Sur une pelouse claire, il
**détoure** — les mêmes soldats verts se lisent mieux. C'est le contour qui
sépare, pas le corps.

La pelouse est donc un vert d'herbe franc (`#6d9155`), tiré vers l'olive pour
s'écarter aussi par la teinte du vert bleuté et saturé des figurines
(`#3d9950`, `#6fd47a`).

Ça ne se décide pas au jugé : il faut forcer le pire cas — que des unités
vertes et des tentes vertes sur de l'herbe, rien d'autre à l'écran — et
regarder. C'est le cas à revérifier si la palette bouge.

Au-delà des bases, le mur de la cour prend ses assises de pierre et son
chaperon : c'est le seul endroit qui peut se permettre du détail, puisque
personne n'y joue. Il est **identique aux deux bouts** — c'est la même cour,
entourée du même mur ; un dégradé de ciel d'un côté et un aplat de l'autre
donnaient deux lieux différents. Enfin un assombrissement très léger des bords
fait ressortir le centre sans qu'on ait ajouté le moindre objet.

Le test, c'est la capture : sur un terrain vide, le décor se lit ; sous la
foule, il disparaît complètement.

Les deux réglages, dans `rendu/scene.js` : `CRAIE` / `CRAIE_PALE` pour
l'opacité des tracés, `PELOUSE` et `TONTE` pour l'herbe.
