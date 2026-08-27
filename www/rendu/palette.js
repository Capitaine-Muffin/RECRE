/**
 * La palette du jeu, et rien d'autre.
 *
 * Une palette courte tient l'ensemble : tous les sprites piochent dedans, donc
 * un bâtiment et un enfant ne peuvent pas jurer l'un à côté de l'autre. Les
 * teintes sont franches et un peu sucrées — c'est une cour de récré, pas un
 * champ de bataille.
 *
 * Le contour n'est jamais noir pur : `#2f2740` est un violet très sombre, qui
 * adoucit la silhouette et évite l'effet « clipart ».
 */
export const PALETTE = {
  '.': null,          // transparent

  o: '#2f2740',       // contour
  w: '#fff6e8',       // blanc cassé
  d: '#c9c2d4',       // gris clair (ombre sur le blanc)

  s: '#f6d79b',       // sable
  S: '#d9a95d',       // sable, ombre

  e: '#ffcfa8',       // peau
  E: '#d99a6c',       // peau, ombre
  h: '#7a4a2b',       // cheveux bruns
  H: '#ffd84d',       // jaune vif / cheveux blonds
  J: '#e0a800',       // jaune, ombre

  r: '#ef4d5a',       // rouge
  R: '#b82f43',       // rouge, ombre
  b: '#4aa3f0',       // bleu
  B: '#2a63b8',       // bleu, ombre
  g: '#6fd47a',       // vert clair
  G: '#3d9950',       // vert, ombre
  p: '#e08ad0',       // rose
  P: '#8e4fa8',       // violet, ombre

  n: '#b98a5a',       // bois
  N: '#7d5636',       // bois, ombre
  k: '#9aa8bd',       // métal
  K: '#5d6b80',       // métal, ombre
  c: '#9fe8ff',       // verre / ciel
};
