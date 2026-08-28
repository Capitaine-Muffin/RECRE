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
import { BATIMENTS, CATALOGUE, COLONNES_GRILLE, RANGEES_GRILLE }
  from '../moteur/donnees.js';
import { parmi, entier } from '../moteur/aleatoire.js';

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
  return {
    graine: graine >>> 0,
    niveau,
    attente: NIVEAUX[niveau].reflexion,
    /** Ce qu'elle veut construire, et pour quoi elle met de côté. */
    envie: null,
  };
}

/**
 * Ce que l'IA veut faire à ce tick. Rend une liste d'intentions, souvent vide.
 *
 * Elle se choisit une **envie**, puis économise jusqu'à pouvoir se l'offrir.
 *
 * Acheter simplement « ce qu'elle peut se payer maintenant » ne marche pas, et
 * la raison est instructive : construire coupe le revenu, donc elle est presque
 * toujours fauchée, donc seul le moins cher lui est accessible. Mesuré, elle
 * achetait **71 % de tours** — qui ne produisent aucune unité. Elle ne se
 * faisait jamais d'armée, et les parties n'en finissaient pas.
 */
export function jouer(ia, etat, campIndex) {
  if (etat.vainqueur !== null) return [];
  if (ia.attente > 0) {
    ia.attente--;
    return [];
  }

  const camp = etat.camps[campIndex];
  if (ia.envie === null) ia.envie = parmi(ia, CATALOGUE);
  const modele = BATIMENTS[ia.envie];

  // Manque de place, et pas d'argent : économiser n'y changera rien, elle
  // change d'avis. Sans ça elle attendrait indéfiniment.
  if (camp.population + modele.population > camp.populationMax) {
    ia.envie = null;
    return [];
  }
  if (camp.or < modele.or) return [];

  const batiment = ia.envie;
  ia.envie = null;
  ia.attente = NIVEAUX[ia.niveau].reflexion;
  // Une case libre, la plus en arrière possible : l'IA de l'étape 1 ne sait
  // pas encore arbitrer entre gagner du trajet et s'exposer, elle joue donc
  // le placement prudent.
  const prises = new Set(camp.emplacements.map((b) => `${b.colonne}:${b.rangee}`));
  const libres = [];
  for (let r = 0; r < RANGEES_GRILLE; r++) {
    for (let c = 0; c < COLONNES_GRILLE.length; c++) {
      if (!prises.has(`${c}:${r}`)) libres.push({ colonne: c, rangee: r });
    }
    if (libres.length) break;
  }
  if (!libres.length) return [];
  const ou = libres[entier(ia, libres.length)];

  return [{ camp: campIndex, action: 'construire', batiment,
    colonne: ou.colonne, rangee: ou.rangee }];
}
