# Consignes

**RECRE** — un jeu mobile bâti sur le système de *La Récréation*, une série de
cartes Warcraft III. Le dépôt contient deux choses : le jeu, et la
rétro-ingénierie des cartes d'origine dont il sort.

## Style de réponse

Réponses **courtes**. Va droit au but.

- Pas de récapitulatif après chaque action : dis ce qui est fait en une phrase.
- Pas de tableau ni de liste d'options si on ne t'en demande pas.
- Pas de « pour aller plus loin », pas de suggestions non sollicitées.
- Si une question a une réponse en une ligne, réponds en une ligne.

## Les deux moitiés du dépôt

```
www/                le jeu           — HTML/CSS/JS natif, servi tel quel
tests/              ses tests        — `npm test`
raw/ tools/*.py     l'extraction     — les cartes .w3x et leurs parseurs
data/ docs/generated/                — tout est régénéré par `make`
docs/*.md           la conception    — écrit à la main, ne pas régénérer
```

`make` reconstruit `data/` et `docs/generated/` depuis `raw/maps/*.w3x`. Ne
jamais modifier un fichier de `data/` ou `docs/generated/` à la main : corrige
l'outil dans `tools/` et relance.

## Les règles du jeu (celles du code)

1. **Zéro build.** HTML/CSS/JS natif, servi tel quel. Pas de bundler, pas de
   TypeScript, pas de CDN — le jeu doit marcher hors ligne.
2. **Le jeu vit dans `www/`.** Les identifiants dans `config.js`.
3. **Jouable au clavier ET au tactile**, responsive, sans défilement
   horizontal. Il sera testé depuis un téléphone.
4. **Le français partout** : textes, commentaires, messages de commit. Les
   identifiants de code restent en anglais quand c'est l'usage.

## Le moteur est déterministe, et ça ne se négocie pas

`www/moteur/` est une simulation à pas fixe : `avancer(etat, intentions)`.
C'est ce qui rendra le multijoueur possible sans réécriture — le moteur ne sait
pas d'où viennent les intentions, donc les faire venir d'une socket ne le
regarde pas.

Dans `www/moteur/`, jamais : `Math.random`, `Date`, `performance`, le DOM,
`Object.keys` / `Object.entries` sur un état. Le hasard passe par
`aleatoire.js` et sa graine, qui vit dans l'état ; le temps se compte en ticks.
`npm test` refuse le commit qui l'oublie.

`www/rendu/` lit l'état et ne l'écrit jamais. `www/jeu.js` est le seul fichier
qui a le droit de regarder l'horloge.

## Les dessins

Pixel art écrit à la main dans `www/rendu/sprites.js` — un caractère par pixel,
palette commune dans `palette.js`, aucune image à charger. `npm test` vérifie
la géométrie et les couleurs de chaque sprite.

Pour les regarder : `python3 tools/apercu_sprites.py`, qui écrit
`docs/generated/sprites.png` en relisant le code.

## Propriété intellectuelle

Les cartes d'origine sont pleines de franchises tierces — 118 des 273 noms
d'unités. **Rien de tout ça ne peut partir sur un store.** Les noms du jeu sont
neutres par construction ; le rester. `assets/extracted/` est une référence de
conception, jamais une source de production. Détail dans
`docs/04-assets-et-propriete-intellectuelle.md`.

## Monétisation

Elle vient du paquet partagé `@capitaine-muffin/monetisation`, recopié dans
`www/vendor/` par `npm run preparer`. L'import est dynamique : sans le dossier,
le jeu tourne quand même, sans achats ni bannière.

**Ne pas la réécrire dans le jeu.** Chacun de ses garde-fous vient d'un bug qui
a coûté de l'argent en production, et ils sont commentés. Un correctif se fait
dans le paquet, où il profite à tous les jeux.

⚠️ Un droit RevenueCat par produit vendu. Un droit qui en porte plusieurs est
acquis dès qu'un **seul** est acheté.

## Remplir le magasin

La fiche, les produits et les prix se posent par une commande, jamais à la main
dans la console :

```bash
npm run store -- --essai   # ce qui serait fait, sans rien toucher
npm run store              # l'applique
```

Tout vient de `store.json`. Les prix s'y écrivent **TTC**, tels que le joueur
les voit : la conversion vers le prix hors taxes qu'attend Google est faite par
le script. La proposer dès qu'il est question de créer un produit, de changer
un prix ou d'écrire la fiche.

## Publier

`git tag vX.Y.Z && git push --tags` — la CI fait le reste.

Ne jamais envoyer une version à la main depuis la Play Console : le
`versionCode` serait choisi à la main, et Play refuse un numéro déjà utilisé.

La procédure Store complète est dans
[publier-sur-play](https://github.com/Capitaine-Muffin/publier-sur-play). Elle
existe aussi en compétence ; si `~/.claude/skills/publier-sur-play` n'existe pas
sur cette machine, le proposer avant d'attaquer une publication :

```bash
git clone https://github.com/Capitaine-Muffin/publier-sur-play ~/.claude/skills/publier-sur-play
```

## À ne jamais commiter

La clé de signature (`*.jks`), le JSON du compte de service Google, une clé
RevenueCat secrète (`sk_`). Ils vivent dans les secrets GitHub.
