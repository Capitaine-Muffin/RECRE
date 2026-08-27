/**
 * L'adversaire.
 *
 * Il ne triche pas : il lit l'état public — le même que le joueur, le
 * brouillard étant désactivé des deux côtés comme dans l'original — et produit
 * des intentions de la même forme. Le moteur ne fait aucune différence entre
 * les siennes et celles d'un doigt sur l'écran.
 *
 * Sa difficulté tient à un seul curseur : le délai, en ticks, entre le moment
 * où il pourrait agir et celui où il agit. Un bonus d'or serait plus simple à
 * écrire et bien moins honnête à jouer.
 */
import { BATIMENTS, CATALOGUE } from '../moteur/donnees.js';
import { entier, parmi } from '../moteur/aleatoire.js';

export const NIVEAUX = {
  tranquille: { reflexion: 120, nom: 'Tranquille' },
  normal: { reflexion: 60, nom: 'Normal' },
  teigneux: { reflexion: 20, nom: 'Teigneux' },
};

/**
 * @param {number} graine  propre à l'IA : elle ne puise pas dans le hasard de
 *   la simulation, pour qu'ajouter un tirage ici ne décale pas la partie.
 */
export function nouvelAdversaire(graine, niveau = 'normal') {
  return { graine: graine >>> 0, niveau, attente: NIVEAUX[niveau].reflexion };
}

/**
 * Ce que l'IA veut faire à ce tick. Rend une liste d'intentions, souvent vide.
 *
 * Étape 1 : elle achète au hasard ce qu'elle peut se payer, dès qu'un
 * emplacement est libre. Elle jouera la composition adverse à l'étape 2.
 */
export function jouer(ia, etat, campIndex) {
  if (etat.vainqueur !== null) return [];
  if (ia.attente > 0) {
    ia.attente--;
    return [];
  }

  const camp = etat.camps[campIndex];
  const libres = [];
  camp.emplacements.forEach((place, i) => {
    if (place === null) libres.push(i);
  });
  if (!libres.length) return [];

  const abordables = CATALOGUE.filter((cle) => {
    const modele = BATIMENTS[cle];
    return camp.or >= modele.or
      && camp.population + modele.population <= camp.populationMax;
  });
  if (!abordables.length) return [];

  ia.attente = NIVEAUX[ia.niveau].reflexion;
  return [{
    camp: campIndex,
    action: 'construire',
    emplacement: libres[entier(ia, libres.length)],
    batiment: parmi(ia, abordables),
  }];
}
