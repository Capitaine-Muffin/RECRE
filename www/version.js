/**
 * La version du jeu, telle qu'elle part dans le rapport de partie.
 *
 * `VERSION` suit `package.json`, et `tests/rapport.mjs` refuse qu'elles
 * divergent : un rapport qui annonce une version fausse ne vaut rien.
 *
 * `REVISION` est réécrite par la CI juste avant de publier (`pages.yml`,
 * `publier.yml`) — c'est le commit exact que le joueur avait sous les doigts,
 * ce que le seul numéro de version ne dit pas entre deux tags. En local elle
 * reste `local`, et le fichier marche tel quel : pas de build, comme le reste.
 */
export const VERSION = '1.0.0';
export const REVISION = 'local';
