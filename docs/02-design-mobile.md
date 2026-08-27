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

- **3 contre 3** (au lieu de 5c5). Le 5c5 demande dix joueurs simultanés ; à
  trois, une partie se remplit et la contribution de chacun reste lisible.
- **Une lane, deux bases.** Comme la map d'origine : `Base1` ↔ `Work`, la
  rencontre au milieu.
- **8 à 12 minutes** par partie.
- **Portrait**, une main. La lane est verticale : ma base en bas, l'ennemie en
  haut, la mêlée au centre de l'écran.
- **Temps réel avec reconnexion.** Le serveur fait autorité, la simulation est
  déterministe (voir §6) ; un joueur qui coupe se reconnecte sur l'état courant.

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

**Serveur autoritaire, simulation déterministe à pas fixe.**

- Pas de simulation : **100 ms** (10 Hz). Suffisant — aucune unité n'est
  contrôlée, il n'y a pas de visée.
- Le client n'envoie que des intentions : `{tick, slot, achat}`. Quelques
  octets, quelques fois par minute. Injouable à tricher, trivial à rejouer.
- Le client interpole entre les pas pour l'affichage ; la vérité reste au
  serveur.
- Une partie entière tient dans une liste d'entrées horodatées → **replays et
  spectateur gratuits**, et une reconnexion se résout en rejouant le journal.

### Ce que « serveur autoritaire » implique — et ce que ça n'implique pas

Cette section décrit **l'état d'arrivée**, pas le premier jour. Lue seule, elle
donne à croire qu'un serveur est nécessaire avant de pouvoir jouer : c'est
faux, et ça a déjà envoyé une session sur une fausse piste.

**La même simulation tourne des deux côtés.** En solo et contre l'IA (étapes 1
et 2 du §8), elle s'exécute dans le client, sans réseau. Passer au 3c3 la
déplace sur un serveur — ce n'est pas une réécriture, à une condition
non négociable :

> **La simulation reste pure.** Aucun accès au DOM, aucun `Date.now()`, aucun
> `Math.random()` non graine. Elle prend un état et une liste d'intentions,
> elle rend l'état suivant. Le rendu la lit, ne la modifie jamais.

C'est cette séparation qui rend l'étape 3 possible sans tout refaire — et
c'est aussi ce qui donne les replays et la reconnexion par rejeu du journal
annoncés plus haut. Elle se paie le premier jour ou elle ne se paie jamais.

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
  puissance casserait la seule chose qui le tient.
- Thèmes, skins de château, effets de destruction, emotes.
- Pas de `-kick` à la main comme dans l'original : **vote d'équipe** ou
  abandon avec remplacement par une IA. Le kick unilatéral par l'hôte, tel qu'il
  existe dans la 4.01, est inacceptable dans un jeu public.
- L'interdiction du « rush base » n'est plus une convention : les emplacements
  de construction sont hors de portée des unités adverses par construction.

## 8. Étapes

Les deux premières étapes sont **hors ligne, sans serveur** : la simulation
tourne dans le client. Le jeu est déjà publiable à la fin de l'étape 2, en
solo contre l'IA — c'est ce qui permet de vérifier la boucle sur de vrais
joueurs avant d'engager le réseau.

1. **Prototype jouable** — une lane, 3 casernes, 1 tour, le château. But :
   vérifier que la boucle « acheter et regarder » tient sur téléphone. Rien
   d'autre ne compte tant que ce n'est pas prouvé. *Simulation locale.*
2. **La boucle complète** — revenu coupé pendant la construction, Bombe à Eau,
   punition du coin, héros. *Simulation locale, adversaire IA.* **Publiable en
   l'état.**
3. **Réseau** — serveur autoritaire, 3c3, reconnexion. La simulation ne change
   pas : elle change d'hôte (voir §6). Websocket, appariement et boucle 10 Hz
   sont à écrire — c'est l'étape la plus lourde du projet, et la seule qui
   sorte du modèle de jeu mobile.
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
