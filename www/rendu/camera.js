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

/**
 * Douceur du suivi automatique : part du chemin parcourue à chaque image.
 *
 * Elle ne s'applique **qu'au suivi du front**. Pendant un glissé, le décor
 * colle au doigt : lissé, il traînait derrière — 275 pixels rattrapés sur 300
 * après une demi-seconde, alors que le geste était fini depuis longtemps. Ça se
 * ressent comme une caméra lente, et ça n'en est pas une.
 */
const SOUPLESSE = 0.08;

/**
 * Frein de l'élan après un lancer, en part de vitesse conservée par seconde.
 *
 * Le terrain fait près de trois écrans : sans élan, il faut le traverser à
 * coups de glissés successifs. Avec, un lancer franc parcourt la moitié du
 * terrain.
 */
const FREIN = 0.02;

/** En dessous, l'élan est mort : on l'arrête plutôt que de traîner. */
const ELAN_MORT = 4_000;

export function nouvelleCamera() {
  return {
    /** Position visée sur la lane, en millipas. */
    cible: 0,
    /** Position réellement affichée : elle rattrape `cible` en douceur. */
    position: 0,
    saisie: null,
    /** Vitesse restante après un lancer, en millipas par seconde. */
    elan: 0,
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
/**
 * Avance la caméra d'une image.
 *
 * @param {number} ecoule  millisecondes depuis l'image précédente. L'élan
 *   décroît avec le temps et non avec les images : sans ça un écran à 120 Hz
 *   freinerait deux fois plus vite qu'un écran à 60.
 */
export function suivre(camera, etat, ecoule = 16) {
  if (camera.saisie === null && !camera.libre && camera.elan === 0) {
    camera.cible = front(etat);
  }

  if (camera.elan !== 0 && camera.saisie === null) {
    const secondes = ecoule / 1000;
    camera.cible += camera.elan * secondes;
    camera.elan *= FREIN ** secondes;
    if (Math.abs(camera.elan) < ELAN_MORT) camera.elan = 0;
  }

  const avant = camera.cible;
  camera.cible = borner(camera.cible);
  // Arrivé sur une butée, l'élan n'a plus de sens : il pousserait dans le mur.
  if (camera.cible !== avant) camera.elan = 0;

  // Sous le doigt, ou lancé : le décor colle, sans lissage. Le lissage est
  // réservé au suivi automatique du front.
  if (camera.saisie !== null || camera.elan !== 0) {
    camera.position = camera.cible;
    return;
  }

  const ecart = camera.cible - camera.position;
  camera.position += Math.abs(ecart) < 200 ? ecart : ecart * SOUPLESSE;
}

/** Rend la caméra au jeu : elle revient au front et se remet à le suivre. */
export function recentrer(camera, etat) {
  camera.cible = borner(front(etat));
  camera.libre = false;
  camera.saisie = null;
  camera.elan = 0;
}

/** Le joueur saisit la caméra. `y` est en pixels écran. */
export function saisir(camera, y, maintenant) {
  camera.saisie = { y, depart: camera.cible, dernierY: y, dernierT: maintenant };
  camera.elan = 0;
  camera.libre = true;
}

/**
 * Le joueur fait glisser. `parPixel` convertit les pixels écran en millipas —
 * il dépend du zoom, donc la scène le fournit.
 */
export function glisser(camera, y, parPixel, maintenant) {
  const saisie = camera.saisie;
  if (saisie === null) return;
  camera.cible = borner(saisie.depart + (y - saisie.y) * parPixel);

  // La vitesse du geste, pour le lancer. Lissée : un tremblement juste avant
  // de lever le doigt ne doit pas décider de la trajectoire.
  const dt = maintenant - saisie.dernierT;
  if (dt > 0) {
    const brute = ((y - saisie.dernierY) * parPixel) / (dt / 1000);
    saisie.vitesse = saisie.vitesse === undefined
      ? brute
      : saisie.vitesse * 0.6 + brute * 0.4;
    saisie.dernierY = y;
    saisie.dernierT = maintenant;
  }
}

/** Le doigt se lève : ce qu'il restait de vitesse devient de l'élan. */
export function lacher(camera) {
  const vitesse = camera.saisie?.vitesse ?? 0;
  camera.saisie = null;
  camera.elan = Math.abs(vitesse) < ELAN_MORT ? 0 : vitesse;
}

/** Déplacement direct — molette, flèches. La caméra passe au joueur. */
export function deplacer(camera, delta) {
  camera.cible = borner(camera.cible + delta);
  camera.position = camera.cible;
  camera.elan = 0;
  camera.libre = true;
}
