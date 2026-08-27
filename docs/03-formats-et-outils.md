# Formats et outils d'extraction

Comment les données de `data/` sont produites, et comment les régénérer.

---

## 1. Ce qu'est un `.w3x`

Une map Warcraft III est une **archive MPQ** (le format d'archive de Blizzard),
parfois précédée d'un en-tête `HM3W` de 512 octets qui contient le nom de la
map.

Une MPQ n'a pas de table des matières : les noms de fichiers sont **hachés**, et
on ne peut lire un fichier que si on connaît déjà son nom exact. Les maps
Warcraft utilisent heureusement des noms fixes (`war3map.j`, `war3map.w3u`, …),
et embarquent souvent un `(listfile)` qui donne le reste.

Les fichiers qui comptent, dans une map :

| Fichier | Contenu | Parseur |
|---|---|---|
| `war3map.j` | le script JASS — **toutes les règles** | `tools/parse_jass.py` |
| `war3map.wts` | table des chaînes (tous les noms et textes) | `w3fmt.read_wts` |
| `war3map.w3i` | infos de map : joueurs, équipes, taille | `w3fmt.read_w3i` |
| `war3map.w3u` | unités personnalisées | `w3fmt.read_objmod` |
| `war3map.w3a` | capacités personnalisées | idem (avec niveaux) |
| `war3map.w3t` / `w3b` / `w3d` / `w3q` / `w3h` | objets, décors, doodads, améliorations, buffs | idem |
| `war3mapUnits.doo` | unités pré-placées sur le terrain | `w3fmt.read_units_doo` |
| `war3map.w3r` | régions nommées (utilisées par les déclencheurs) | `w3fmt.read_w3r` |
| `war3map.w3e` | terrain | `w3fmt.read_w3e` |
| `war3map.wtg` / `.wct` | déclencheurs au format éditeur GUI | non parsé — le `.j` généré suffit |

## 2. Pourquoi un lecteur MPQ maison

Ce dépôt implémente MPQ de zéro dans `tools/mpq.py` (~230 lignes). C'était plus
simple que de dépendre d'une bibliothèque :

- `mpyq`, le paquet Python courant, ne gère **ni le déchiffrement de fichiers**
  ni la compression **PKWARE DCL**, dont ces maps se servent ;
- l'installation de `mpyq` échoue de toute façon sur les Python récents.

`tools/mpq.py` gère : en-têtes v0/v1, préfixe `HM3W`, tables de hachage et de
blocs chiffrées, fichiers en unité unique comme en secteurs multiples,
déchiffrement par clé dérivée du nom (`MPQ_FILE_FIX_KEY` compris), et les
décompressions zlib, bzip2 et PKWARE DCL (« implode »).

## 3. Le pipeline

```
raw/maps/*.w3x
      │
      │  tools/extract_map.py       (MPQ → fichiers + JSON structuré)
      ▼
data/maps/*.json          assets/extracted/<map>/…   (fichiers bruts)
      │                            │
      │  tools/parse_jass.py       │  tools/asset_inventory.py
      ▼                            ▼
data/rules/*.json          data/catalog/assets.json
      │                            docs/generated/assets.md
      │  tools/build_catalog.py
      ▼
data/catalog/units.json
data/catalog/summary.json
docs/generated/units.md
      │
      │  tools/spawner_economics.py     tools/ip_audit.py
      ▼                                 ▼
data/catalog/spawner_economics.json     data/catalog/ip_audit.json
docs/generated/spawners.md              docs/generated/ip_audit.md
```

Tout régénérer :

```sh
make            # ou: sh tools/run_all.sh
```

Aucune dépendance : Python 3 de la bibliothèque standard uniquement.

## 4. Extraire les règles depuis le JASS

`war3map.j` est du JASS **généré par l'éditeur GUI**, pas écrit à la main. Chaque
action de l'éditeur produit exactement la même forme d'appel, ce qui le rend
lisible à l'expression régulière — approche fragile en général, fiable ici.

`tools/parse_jass.py` en sort : ressources de départ, cadence et montant du
revenu d'or, ce qui met le revenu en pause, la table
`bâtiment → unité produite`, la destination et le nouveau propriétaire de chaque
unité produite, les balayages de ré-attaque périodiques, les conditions de
victoire, les commandes de chat, et la pénalité de mort du constructeur.

## 5. Limites connues

- **`Recreation_dans_les_iles_v1.2` est protégée.** Son `war3map.j` et son
  `war3map.wtg` ont été supprimés de l'archive par un outil de protection ; son
  `war3map.w3i` est délibérément corrompu (il annonce 0 joueur et des masques
  d'équipe invalides). Les données d'objets — 72 unités, 25 améliorations,
  22 capacités — sont intactes et extraites. Ses **règles** ne le sont pas.
- **Les cadences d'attaque manquent presque partout.** Un fichier d'objets ne
  stocke que les champs *modifiés* par l'auteur ; tout le reste est hérité de
  l'unité Warcraft standard, dont la table vit dans le client du jeu et pas dans
  la map. On a donc les PV, les dégâts par coup, les coûts, l'armure et la
  vitesse, mais rarement la cadence — donc rarement le DPS. Voir la colonne
  `inherited` de `docs/generated/spawners.md`.
- **Les décompressions huffman, ADPCM et le mode littéral ASCII de PKWARE ne
  sont pas implémentés.** Ils ne servent qu'aux fichiers audio, dont ces maps
  n'ont pas. Le parseur lève une exception explicite si un jour il en croise un.
