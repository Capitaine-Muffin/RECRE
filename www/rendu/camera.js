/**
 * La caméra : quelle tranche du terrain on regarde.
 *
 * Elle vit dans `rendu/` et nulle part ailleurs. La simulation ignore
 * complètement qu'on la regarde — bouger la caméra ne peut donc pas changer
 * une partie, et deux joueurs qui regardent des endroits différents jouent
 * quand même la même partie. C'est ce qui la rend sûre.
 *
 * Elle suit le front toute seule, et se laisse écarter au doigt : dès qu'on la
 * saisit, elle arrête de suivre, et elle s'y remet après un moment de calme.
 */
import { LANE } from '../moteur/donnees.js';
import { NOUS, baseDe } from '../moteur/etat.js';
import { visible } from './scene.js';

/** Combien de temps la caméra reste où le joueur l'a mise, en millisecondes. */
const PATIENCE = 2500;

/** Douceur du suivi : part du chemin parcourue à chaque image. */
const SOUPLESSE = 0.08;

export function nouvelleCamera() {
  return {
    /** Position visée sur la lane, en millipas. */
    cible: 0,
    /** Position réellement affichée : elle rattrape `cible` en douceur. */
    position: 0,
    /** Horodatage de la dernière intervention du joueur. 0 = jamais. */
    laché: 0,
    saisie: null,
    /** Vrai tant qu'un panneau est ouvert : la caméra ne suit plus. */
    figee: false,
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

/**
 * Avance la caméra d'une image.
 *
 * @param {number} maintenant  horloge murale, en millisecondes. La caméra a le
 *   droit de la connaître : elle n'est pas la simulation.
 */
export function suivre(camera, etat, maintenant) {
  // Panneau ouvert : le joueur ne regarde pas le terrain, la caméra ne doit
  // pas en profiter pour s'en aller. Sans ça la patience expire pendant qu'il
  // choisit, et il retrouve un autre endroit en refermant.
  if (camera.figee) camera.laché = maintenant;

  if (camera.saisie === null && !camera.figee
      && maintenant - camera.laché > PATIENCE) {
    camera.cible = front(etat);
  }
  camera.cible = borner(camera.cible);

  const ecart = camera.cible - camera.position;
  // Sauter le lissage sous le pixel évite de trembloter indéfiniment.
  camera.position += Math.abs(ecart) < 200 ? ecart : ecart * SOUPLESSE;
}

/** Recentre franchement sur le front, sans attendre la fin de la patience. */
export function recentrer(camera, etat) {
  camera.cible = borner(front(etat));
  camera.laché = 0;
  camera.saisie = null;
}

/** Le joueur saisit la caméra. `y` est en pixels écran. */
export function saisir(camera, y) {
  camera.saisie = { y, depart: camera.cible };
}

/**
 * Le joueur fait glisser. `parPixel` convertit les pixels écran en millipas —
 * il dépend du zoom, donc la scène le fournit.
 */
export function glisser(camera, y, parPixel) {
  if (camera.saisie === null) return;
  camera.cible = borner(camera.saisie.depart + (y - camera.saisie.y) * parPixel);
}

export function lacher(camera, maintenant) {
  camera.saisie = null;
  camera.laché = maintenant;
}
