/**
 * La scène : l'état de la partie, dessiné.
 *
 * La lane est verticale — ma base en bas, l'ennemie en haut — et la caméra ne
 * bouge jamais : tout le terrain tient à l'écran, comme dans l'original où le
 * brouillard est désactivé. Rien à faire glisser du doigt pour comprendre où
 * on en est.
 */
import { LANE, UNITES } from '../moteur/donnees.js';
import { EUX } from '../moteur/etat.js';
import * as S from './sprites.js';
import { dessiner, barreDeVie, socle } from './dessin.js';

const SPRITE_UNITE = {
  petit_soldat: S.PETIT_SOLDAT,
  soldat_briques: S.SOLDAT_BRIQUES,
  cavalier_briques: S.CAVALIER_BRIQUES,
};

export const SPRITE_BATIMENT = {
  caserne_soldats: S.CASERNE_SOLDATS,
  fort_briques: S.FORT_BRIQUES,
  citadelle_briques: S.CITADELLE_BRIQUES,
  tour: S.TOUR,
  coffre_jouets: S.COFFRE_JOUETS,
  gouter: S.GOUTER,
};

/** Les couleurs d'équipe. Le joueur est toujours le bleu, quel que soit le camp. */
export const COULEUR_CAMP = ['#4aa3f0', '#ef4d5a'];

/** Marges de la lane, en fraction de la hauteur : le ciel et le bas d'écran. */
const HAUT = 0.16;
const BAS = 0.90;

/** Position sur la lane (0…LANE) → ordonnée à l'écran. */
function ordonnee(position, hauteur) {
  const part = position / LANE;
  return hauteur * (BAS - part * (BAS - HAUT));
}

/**
 * Étale les unités sur la largeur pour qu'elles ne s'empilent pas au même
 * pixel. Purement cosmétique : la simulation, elle, est en une dimension.
 */
const VOIES = 7;
function abscisse(unite, largeur) {
  const voie = unite.id % VOIES;
  return largeur * (0.18 + (voie * 0.64) / (VOIES - 1));
}

export function dessinerScene(ctx, etat, { largeur, hauteur, zoom }) {
  ctx.clearRect(0, 0, largeur, hauteur);

  // Le ciel, puis la cour.
  const ciel = ctx.createLinearGradient(0, 0, 0, hauteur);
  ciel.addColorStop(0, '#2b2140');
  ciel.addColorStop(1, '#4a3a5c');
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, largeur, hauteur);

  ctx.fillStyle = '#6b5a4a';
  ctx.fillRect(0, hauteur * (HAUT - 0.02), largeur, hauteur);

  // Le bitume de la cour : des bandes claires, repère de profondeur.
  ctx.fillStyle = 'rgba(255,246,232,0.05)';
  for (let i = 0; i <= 10; i++) {
    ctx.fillRect(0, ordonnee((i * LANE) / 10, hauteur), largeur, 1);
  }

  // Les deux châteaux.
  dessiner(ctx, S.CHATEAU_SABLE, largeur / 2, ordonnee(LANE, hauteur) + 8, zoom);
  dessiner(ctx, S.CHATEAU_SABLE, largeur / 2, ordonnee(0, hauteur) + 24, zoom);

  // Les enfants, à côté de leur château. Décoratifs à l'étape 1 : ils
  // deviendront le constructeur, et la cible de la maîtresse, à l'étape 2.
  dessiner(ctx, S.MORVEUX, largeur * 0.22, ordonnee(LANE, hauteur) + 10, zoom);
  dessiner(ctx, S.MIOCHE, largeur * 0.22, ordonnee(0, hauteur) + 26, zoom);

  // Les unités, du fond vers l'avant pour que le recouvrement soit correct.
  const triees = [...etat.unites].sort((a, b) => b.position - a.position);
  for (const unite of triees) {
    const sprite = SPRITE_UNITE[unite.type];
    const x = abscisse(unite, largeur);
    const y = ordonnee(unite.position, hauteur);
    // Le socle se cale sur les pieds, pas sur la largeur du sprite : un
    // cavalier fait 24 px de large mais ne pose pas plus large qu'un fantassin.
    socle(ctx, x, y, Math.min(sprite[0].length, 14) * zoom * 0.5,
      COULEUR_CAMP[unite.camp]);
    dessiner(ctx, sprite, x, y, zoom, { miroir: unite.camp === EUX });
    barreDeVie(ctx, x, y - sprite.length * zoom - 6, 20,
      unite.pv / UNITES[unite.type].pv);
  }
}
