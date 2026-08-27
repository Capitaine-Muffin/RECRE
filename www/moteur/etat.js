/**
 * L'état d'une partie : un objet sérialisable, et rien d'autre.
 *
 * Pas de fonction, pas de référence croisée, pas de `Map` ni de `Set`. Une
 * partie se range dans `localStorage` avec `JSON.stringify` et se relit telle
 * quelle — la sauvegarde ne demande aucun travail supplémentaire.
 */
import { REGLES, LANE } from './donnees.js';

/** Les deux camps. `nous` construit depuis 0, `eux` depuis `LANE`. */
export const NOUS = 0;
export const EUX = 1;

/** Le camp d'en face. */
export const adverse = (camp) => (camp === NOUS ? EUX : NOUS);

/** Sens de progression d'un camp sur la lane : +1 pour nous, −1 pour eux. */
export const sens = (camp) => (camp === NOUS ? 1 : -1);

/** Position de la base d'un camp, en millipas. */
export const baseDe = (camp) => (camp === NOUS ? 0 : LANE);

function camp(nom) {
  return {
    nom,
    or: REGLES.orInitial,
    population: 0,
    populationMax: REGLES.populationInitiale,
    pvChateau: REGLES.pvChateau,
    /** Un emplacement vide vaut `null`. */
    emplacements: Array.from({ length: REGLES.emplacements }, () => null),
    /** Vrai tant qu'un bâtiment est en chantier : le revenu est suspendu. */
    enChantier: false,
  };
}

/**
 * Une partie neuve.
 *
 * @param {number} graine  même graine + mêmes intentions ⇒ même partie.
 */
export function nouvellePartie(graine) {
  return {
    graine: graine >>> 0,
    tick: 0,
    /** `null` tant que personne n'a gagné, sinon le camp vainqueur. */
    vainqueur: null,
    prochainId: 1,
    /** Les unités en vie, dans l'ordre de création. Jamais trié. */
    unites: [],
    camps: [camp('Nous'), camp('Eux')],
  };
}

/** Copie profonde. L'état ne contient que du JSON, donc ceci suffit. */
export function copier(etat) {
  return JSON.parse(JSON.stringify(etat));
}

/**
 * Empreinte de l'état, pour les tests de non-régression.
 *
 * FNV-1a 32 bits sur la forme JSON. Deux parties qui se déroulent pareil ont
 * la même empreinte ; la moindre divergence la change.
 */
export function empreinte(etat) {
  const texte = JSON.stringify(etat);
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
