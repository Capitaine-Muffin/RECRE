# Assets et propriété intellectuelle

Ce document existe parce que c'est le seul obstacle sérieux entre les maps et
un jeu publiable. Il vaut mieux le régler maintenant qu'après avoir dessiné
cent icônes.

Les chiffres viennent de `tools/ip_audit.py` et `tools/asset_inventory.py` ;
les listes complètes sont dans `docs/generated/ip_audit.md` et
`docs/generated/assets.md`.

---

## 1. L'état des lieux

**118 des 273 noms d'unités** des cinq maps — 43 % — appartiennent à une
franchise tierce, réparties sur 16 ayants droit distincts :

| | |
|---|---|
| Marques de jouets | Lego, Playmobil, Barbie, Ken, G.I. Joe, Matchbox, Bisounours, Gundam, Micro Machines, Megazord, Action Man, Meccano |
| Naruto | Konoha, Kakashi, Tsunade, Jiraya, Gaara, Sharingan, Kyubi, Chidori, Akamaru… |
| Le Seigneur des Anneaux | Aragorn, Gandalf, Gimli, Elrond, Legolas, Sauron, Lurtz, Balrog, Orthanc |
| Blizzard / Warcraft | Archimonde, Illidan, Arthas, Thrall, Sapphiron, Anub'Rekhan, les quatre cavaliers de Naxxramas |
| DC Comics | Superman, Batman, Joker, Flash, Green Lantern, Wonder Woman, Lex Luthor |
| Pokémon | Pikachu, Raichu |
| Harry Potter | Dumbledore, Voldemort, Poudlard, Hedwige |
| Star Wars | Dark Revan, turbolaser |
| et aussi | Bob l'Éponge, Tortues Ninja, Chevaliers du Zodiaque, Dragon Ball, Terminator, Final Fantasy, Hannibal Lecter, Capitaine Crochet |

À quoi s'ajoutent **25 fichiers d'art importés** (modèles `.mdx` et textures
`.blp`) qui représentent directement ces personnages — Pikachu, Bob l'Éponge,
le Krusty Krab, Dark Revan, Goku, Terminator, Cloud.

Il faut aussi noter que ces modèles ne sont pas l'œuvre de l'auteur des maps :
la description de la 4.01 crédite *Dan van Ohllus, General Frank, Illidan(Evil)X,
D.O.G.* — des moddeurs de la communauté Warcraft III. Même les pièces d'art
« originales » sont sous des conditions de réutilisation qu'il faudrait aller
vérifier une par une.

## 2. Pourquoi ça ne passe pas

Une map Warcraft III circule entre joueurs qui possèdent déjà le jeu, gratuite,
sans distribution commerciale. Un jeu sur l'App Store ou le Play Store est
publié, distribué et monétisé sous une identité vérifiée. Les processus de
signalement des deux stores traitent ce genre de cas en retrait pur et simple,
et Nintendo comme Disney sont connus pour agir vite.

Ça vaut pour les noms comme pour les modèles, et ça vaut même si le jeu est
gratuit et sans publicité.

## 3. Ce qu'il faut faire — et ce que ça ne coûte pas

**Le charme de La Récréation ne vient pas des licences.** Il vient de l'idée :
*des gamins qui règlent leurs comptes dans la cour avec leurs jouets, et une
maîtresse qui vient te mettre au coin quand tu vas trop loin.* Cette idée est
libre, et elle est plus forte que n'importe laquelle des références.

La plupart des unités sont d'ailleurs **déjà génériques** et se gardent telles
quelles : Château de Sable, Bombe à Eau, Boule Puante, Coffre à Jouets, Volcan
de Purée, Paquet de Pétards, Nounours, Mioche, Morveux, Maîtresse, Tour de
Défense, Bombe Aérosol, Robot, Alien, Le Broyeur, Le Recousu. Ce sont
d'excellents noms, et ce sont les meilleurs de la map.

Pour le reste, le remplacement se fait par **archétype**, pas par personnage —
on garde ce que l'unité *fait*, on change qui elle est :

| Original | Archétype | Remplacement possible |
|---|---|---|
| Fort / Château en Lego | caserne à briques | **Fort en Briques**, **Citadelle en Briques** |
| Campement de G.I. Joe | caserne de petits soldats | **Caserne des Petits Soldats** |
| Totem Playmobil | tour figurine | **Totem de Figurines** |
| Barbie Enragée | poupée de mêlée | **Poupée Furieuse** |
| Bisounours | soigneur peluche | **Câlinours** (garder l'idée, changer le nom) |
| Pikachu | invocation électrique | **Souris-Éclair** |
| Superman / Batman… | héros de comics | héros maison, **La Figurine de Plomb**, **Capitaine Carton** |
| Gandalf / Dumbledore | héros lanceur de sorts | **Le Vieux Magicien de la boîte à jouets** |
| Sauron / Voldemort | boss final | **Le Jouet Cassé du Grenier** |
| Tank Miniature Matchbox | char miniature | **Petite Voiture Blindée** |
| Tortue Ninja | tortue combattante | **Tortue de Poche** |
| Terminator 9000 | robot lourd | **Automate 9000** |
| Bob l'Éponge / Krusty Krab | mascotte + son resto | mascotte maison |

Le thème Naruto de `La_Recreation_ninja` ne se rattrape pas par renommage : il
faudrait le refaire en **ninjas de cour de récré** — des gamins déguisés, avec
des shurikens en carton. C'est d'ailleurs plus drôle, et plus dans le ton du
reste.

## 4. Les fichiers d'art

Aucun des `.mdx` / `.blp` importés ne peut être réutilisé, ni comme asset ni
comme base de retouche. Ils restent dans `assets/extracted/` **comme référence
de conception uniquement** — pour savoir à quoi ressemblait l'unité et quelle
silhouette lui donner. Le pipeline mobile part de zéro de toute façon : les
modèles Warcraft III ne s'importent pas proprement dans un moteur moderne, et
leur budget de polygones n'a rien à voir avec une cible téléphone.

## 5. À faire

- [ ] Trancher le thème du lancement (recommandation : **Cour de récré**, sans
      les marques)
- [ ] Renommer les ~20 achetables retenus pour le lancement, en partant de la
      table §3
- [ ] Marquer `assets/extracted/` comme référence, jamais comme source de
      production
- [ ] Vérifier chaque nom retenu à l'INPI et à l'EUIPO avant de figer les icônes
- [ ] Recréditer les auteurs des modèles d'origine dans le fichier de crédits,
      pour la partie recherche — même si rien de leur art n'est utilisé
