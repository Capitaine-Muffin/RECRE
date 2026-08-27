/**
 * Le hasard du jeu, et le seul autorisé dans `moteur/`.
 *
 * `Math.random()` n'est pas reproductible : deux parties parties de la même
 * graine avec les mêmes entrées en divergeraient. Tout le hasard passe donc
 * par ce générateur, dont l'état vit dans l'état de la partie et avance avec
 * elle.
 *
 * mulberry32 : 32 bits d'état, très bonne distribution pour ce qu'on en fait,
 * et tient en cinq lignes.
 */

/** Avance le générateur et rend un entier dans [0, 2^32). Mute `etat.graine`. */
export function suivant(etat) {
  etat.graine = (etat.graine + 0x6d2b79f5) >>> 0;
  let t = etat.graine;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Entier dans [0, borne). Rend 0 si la borne est nulle ou négative. */
export function entier(etat, borne) {
  return borne > 0 ? suivant(etat) % borne : 0;
}

/** Un élément du tableau, ou `undefined` s'il est vide. */
export function parmi(etat, tableau) {
  return tableau.length ? tableau[entier(etat, tableau.length)] : undefined;
}
