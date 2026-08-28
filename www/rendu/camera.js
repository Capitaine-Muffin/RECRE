/**
 * La caméra : quelle tranche du terrain on regarde.
 *
 * Elle vit dans `rendu/` et nulle part ailleurs. La simulation ignore
 * complètement qu'on la regarde — bouger la caméra ne peut donc pas changer
 * une partie, et deux joueurs qui regardent des endroits différents jouent
 * quand même la même partie. C'est ce qui la rend sûre.
 *
 * Elle suit le front toute seule **tant que le joueur n'y a pas touché**. Dès
 * qu'il la déplace — au doigt, à la molette, aux flèches — elle lui appartient
 * et n'y revient plus d'elle-même. Le bouton « Revenir à la bataille » existe
 * pour ça, et il vaut mieux qu'une caméra qui décide à sa place.
 *
 * Une caméra qui reprend la main toute seule produit exactement le bug qu'on a
 * eu : le joueur ouvre le panneau d'achat, la bataille avance pendant qu'il
 * choisit, il referme — et la caméra rattrape le front d'un coup. Le décor
 * glisse de deux hauteurs de figurine, et on jurerait que les unités reculent.
 */
import { LANE } from '../moteur/donnees.js';
import { NOUS, baseDe } from '../moteur/etat.js';
import { visible } from './scene.js';

/** Douceur du suivi : part du chemin parcourue à chaque image. */
const SOUPLESSE = 0.08;

export function nouvelleCamera() {
  return {
    /** Position visée sur la lane, en millipas. */
    cible: 0,
    /** Position réellement affichée : elle rattrape `cible` en douceur. */
    position: 0,
    saisie: null,
    /**
     * Vrai dès que le joueur a déplacé la caméra lui-même. Elle cesse alors de
     * suivre le front : elle est à lui jusqu'à ce qu'il demande à revenir.
     */
    libre: false,
  };
}

/**
 * Où se joue la partie, en millipas.
 *
 * Le front, c'est l'endroit où les deux flots se rencontrent : entre notre
 * unité la plus avancée et la leur. Quand un camp n'a rien sur le terrain, on
 * regarde le château menacé — c'est là que ça se passe.
 */
export function front(etat) {
  let nous = null;
  let eux = null;
  for (const unite of etat.unites) {
    if (unite.camp === NOUS) {
      if (nous === null || unite.position > nous) nous = unite.position;
    } else if (eux === null || unite.position < eux) eux = unite.position;
  }
  if (nous !== null && eux !== null) return (nous + eux) / 2;
  if (nous !== null) return nous;
  if (eux !== null) return eux;
  // Terrain vide : on regarde sa propre base, pas le milieu du terrain. C'est
  // le début de partie, on est en train d'y construire — renvoyer le joueur
  // sur une pelouse déserte à chaque fois qu'il ferme le panneau d'achat est
  // le contraire de ce qu'il veut.
  return baseDe(NOUS);
}

/**
 * Jusqu'où la caméra dépasse une base, en part de la tranche visible.
 *
 * 0,22 : quand on est acculé, son château se retrouve aux trois quarts de la
 * hauteur, avec juste ce qu'il faut de marge dessous. Sans cette butée la
 * caméra se centre sur la base et un tiers de l'écran ne montre que le mur.
 */
const DEBORD = 0.22;

/**
 * Ramène une visée dans les bornes.
 *
 * Un seul endroit calcule ces bornes, et toutes les façons de bouger la caméra
 * y passent. Auparavant seul `suivre` bornait, et `recentrer` pouvait poser la
 * caméra pile sur une base : un quart de l'écran ne montrait plus que le mur.
 */
function borner(cible) {
  const marge = visible() * DEBORD;
  return Math.max(marge, Math.min(LANE - marge, cible));
}

/** Avance la caméra d'une image. */
export function suivre(camera, etat) {
  if (camera.saisie === null && !camera.libre) camera.cible = front(etat);
  camera.cible = borner(camera.cible);

  const ecart = camera.cible - camera.position;
  // Sauter le lissage sous le pixel évite de trembloter indéfiniment.
  camera.position += Math.abs(ecart) < 200 ? ecart : ecart * SOUPLESSE;
}

/** Rend la caméra au jeu : elle revient au front et se remet à le suivre. */
export function recentrer(camera, etat) {
  camera.cible = borner(front(etat));
  camera.libre = false;
  camera.saisie = null;
}

/** Le joueur saisit la caméra. `y` est en pixels écran. */
export function saisir(camera, y) {
  camera.saisie = { y, depart: camera.cible };
  camera.libre = true;
}

/**
 * Le joueur fait glisser. `parPixel` convertit les pixels écran en millipas —
 * il dépend du zoom, donc la scène le fournit.
 */
export function glisser(camera, y, parPixel) {
  if (camera.saisie === null) return;
  camera.cible = borner(camera.saisie.depart + (y - camera.saisie.y) * parPixel);
}

export function lacher(camera) {
  camera.saisie = null;
}

/** Déplacement direct — molette, flèches. La caméra passe au joueur. */
export function deplacer(camera, delta) {
  camera.cible = borner(camera.cible + delta);
  camera.libre = true;
}
