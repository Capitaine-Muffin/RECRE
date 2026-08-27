# RECRE

Un jeu mobile bâti sur le système de **La Récréation**, une série de maps
Warcraft III francophones.

Ce dépôt contient, à ce stade, **la rétro-ingénierie complète des maps
d'origine** : les outils qui les ouvrent, les données extraites, et le document
de conception du portage mobile. Pas encore de code de jeu.

---

## Le jeu, en une phrase

5 contre 5 (3 contre 3 sur mobile), personne ne contrôle d'armée : on achète des
**bâtiments qui produisent des unités tout seuls**, elles partent
automatiquement vers la base adverse, et la première équipe à détruire le
**Château de Sable** ennemi gagne. Le tout dans une cour de récré, avec des
jouets — et une maîtresse qui vous met au coin une minute si vous mourez.

## Par où commencer

| | |
|---|---|
| [`docs/01-analyse-systeme-wc3.md`](docs/01-analyse-systeme-wc3.md) | Comment marchent les maps d'origine — la boucle, l'économie, les victoires, les chiffres |
| [`docs/02-design-mobile.md`](docs/02-design-mobile.md) | Le portage mobile : format, écran, architecture, étapes |
| [`docs/03-formats-et-outils.md`](docs/03-formats-et-outils.md) | Les formats `.w3x` et le pipeline d'extraction |
| [`docs/04-assets-et-propriete-intellectuelle.md`](docs/04-assets-et-propriete-intellectuelle.md) | Ce qui ne peut pas être publié tel quel, et par quoi le remplacer |

## Les maps sources

Cinq `.w3x`, dans `raw/maps/` :

| Map | Thème | Unités custom |
|---|---|---|
| `La_Recreation_4.01` | jouets + super-héros + LOTR + Harry Potter | 154 |
| `La_Recreation_retour_du_mag_v1.4` | jouets (G.I. Joe, Lego, Pikachu, Goku) | 84 |
| `Recreation_dans_les_iles_v1.2` | sous-marin / Naga (script protégé) | 72 |
| `La_Recreation_de_retour_du_mag2` | jouets, version antérieure | 57 |
| `La_Recreation_ninja` | Naruto / Konoha | 54 |

Elles tournent toutes sur le **même moteur**, avec les mêmes déclencheurs, les
mêmes régions et les mêmes identifiants d'unités. Seul le thème change — c'est
la découverte qui structure tout le projet.

## Ce qui a été extrait

- **421 unités** sur les cinq maps, avec coûts, PV, dégâts, armure, vitesse,
  temps de construction — [`docs/generated/units.md`](docs/generated/units.md)
- **Les règles du jeu**, tirées du script JASS : revenu, cadence de production,
  routage des unités, conditions de victoire, pénalités — `data/rules/*.json`
- **L'économie des casernes**, rendement par or investi —
  [`docs/generated/spawners.md`](docs/generated/spawners.md)
- **1 600 chaînes de texte** (noms, descriptions, dialogues) — `data/maps/*.json`
- **41 fichiers d'art importés**, inventoriés et audités —
  [`docs/generated/assets.md`](docs/generated/assets.md)

## Régénérer

```sh
make          # relit raw/maps/*.w3x et reconstruit data/ et docs/generated/
make clean    # efface tout le dérivé
```

Python 3, bibliothèque standard uniquement, aucune dépendance à installer.

## Arborescence

```
raw/maps/           les .w3x d'origine, intouchés
tools/              lecteur MPQ, parseurs de formats, pipeline
data/maps/          une map = un JSON (infos, objets, régions, chaînes)
data/rules/         règles de jeu extraites du JASS
data/scripts/       les scripts JASS des maps, en clair
data/catalog/       vues consolidées inter-maps
assets/extracted/   fichiers bruts sortis des archives (référence, pas production)
docs/               conception — écrit à la main
docs/generated/     tables — produites par make, ne pas éditer
```

## Attention avant de publier

43 % des noms d'unités et la quasi-totalité de l'art importé appartiennent à des
franchises tierces (Pokémon, DC, LOTR, Naruto, Lego, Playmobil…). Rien de tout
ça ne peut partir sur un store. Le détail et les remplacements proposés sont
dans [`docs/04-assets-et-propriete-intellectuelle.md`](docs/04-assets-et-propriete-intellectuelle.md).

Les maps d'origine sont l'œuvre de **HannibaLecter57** et créditent, pour les
modèles importés, *Dan van Ohllus, General Frank, Illidan(Evil)X* et *D.O.G.*
