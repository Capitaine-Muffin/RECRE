/**
 * La scène : l'état de la partie, dessiné.
 *
 * La lane est **verticale** — ma base en bas, celle d'en face en haut — et le
 * terrain est plus haut que l'écran : on n'en voit qu'une tranche, et la
 * caméra suit le front (`camera.js`). Il n'y a **pas de défilement
 * horizontal** : la simulation est en une dimension, la largeur ne sert qu'à
 * étaler les unités pour qu'elles ne se marchent pas dessus. Un défilement
 * latéral ne montrerait que du vide.
 *
 * Cette couche lit l'état et ne l'écrit jamais.
 */
import { LANE, UNITES, BATIMENTS, VOIES } from '../moteur/donnees.js';
import { NOUS, EUX } from '../moteur/etat.js';
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

/** Les couleurs d'équipe. Le joueur est toujours le bleu. */
export const COULEUR_CAMP = ['#4aa3f0', '#ef4d5a'];

/**
 * Quelle part de la lane tient à l'écran.
 *
 * 0,34 : le terrain fait un peu moins de trois écrans de haut. Assez grand
 * pour qu'une avancée se voie et que la caméra ait un intérêt, assez court
 * pour qu'on ne perde jamais la partie de vue longtemps.
 *
 * C'est du cadrage, pas de l'équilibrage : la lane fait toujours `LANE`
 * millipas et une unité met le même temps à la traverser.
 */
export const PART_VISIBLE = 0.34;

/** Millipas visibles à l'écran, et l'échelle qui en découle. */
export function visible() {
  return LANE * PART_VISIBLE;
}

/** Pixels écran par millipas, pour une hauteur de canvas donnée. */
export function echelle(hauteur) {
  return hauteur / visible();
}

/** Position sur la lane → ordonnée à l'écran, la caméra étant au milieu. */
function ordonnee(position, camera, hauteur) {
  return hauteur / 2 - (position - camera.position) * echelle(hauteur);
}

/**
 * L'abscisse d'une unité : sa file.
 *
 * La file vient de la simulation, pas du dessin — c'est elle qui empêche deux
 * unités de se chevaucher, donc elle doit être la même pour tout le monde.
 */
function abscisse(unite, largeur) {
  return largeur * (0.16 + (unite.voie * 0.68) / (VOIES - 1));
}

/**
 * Où poser un bâtiment sur la carte.
 *
 * Ils s'alignent de part et d'autre de la lane, en s'éloignant de la base : le
 * terrain gagné par la caméra sert à voir sa propre installation grandir, au
 * lieu de rester vide.
 */
function placeBatiment(index, camp, largeur) {
  // 0,13 et pas 0,09 : un bâtiment fait 24 pixels de large, il déborderait du
  // cadre sur un écran étroit.
  const cote = index % 2 === 0 ? 0.13 : 0.87;
  // Assez loin du château pour ne pas l'empiler dessus, assez près pour que
  // les trois d'un côté tiennent dans la tranche visible.
  const recul = 62_000 + Math.floor(index / 2) * 72_000;
  return {
    x: largeur * cote,
    position: camp === NOUS ? recul : LANE - recul,
  };
}

/** Au-delà de chaque base, le terrain s'arrête : mur de la cour, puis ciel. */
const MUR = 46_000;

function dessinerDecor(ctx, camera, largeur, hauteur) {
  const e = echelle(hauteur);
  const finHaute = ordonnee(LANE, camera, hauteur) - MUR * e;
  const finBasse = ordonnee(0, camera, hauteur) + MUR * e;

  ctx.fillStyle = '#6b5a4a';
  ctx.fillRect(0, 0, largeur, hauteur);

  if (finHaute > 0) {
    const ciel = ctx.createLinearGradient(0, Math.max(0, finHaute - 260), 0, finHaute);
    ciel.addColorStop(0, '#221a34');
    ciel.addColorStop(1, '#3d2f56');
    ctx.fillStyle = ciel;
    ctx.fillRect(0, 0, largeur, finHaute);
  }
  if (finBasse < hauteur) {
    ctx.fillStyle = '#2b2140';
    ctx.fillRect(0, finBasse, largeur, hauteur - finBasse);
  }

  // Les lignes du bitume, tous les 50 pas : un repère de distance parcourue.
  ctx.fillStyle = 'rgba(255,246,232,0.06)';
  for (let p = 0; p <= LANE; p += 50_000) {
    const y = ordonnee(p, camera, hauteur);
    if (y > -2 && y < hauteur + 2) ctx.fillRect(0, Math.round(y), largeur, 1);
  }
}

/** Une flèche de bord quand des unités se battent hors du cadre. */
function indicateursHorsChamp(ctx, etat, camera, largeur, hauteur) {
  const compte = [0, 0];   // au-dessus, en dessous
  const camp = [null, null];
  for (const unite of etat.unites) {
    const y = ordonnee(unite.position, camera, hauteur);
    const cote = y < 0 ? 0 : y > hauteur ? 1 : -1;
    if (cote < 0) continue;
    compte[cote]++;
    if (camp[cote] === null) camp[cote] = unite.camp;
    else if (camp[cote] !== unite.camp) camp[cote] = 2;   // les deux
  }

  for (const cote of [0, 1]) {
    if (!compte[cote]) continue;
    const y = cote === 0 ? 14 : hauteur - 14;
    ctx.fillStyle = camp[cote] === 2 ? '#ffd84d' : COULEUR_CAMP[camp[cote]];
    ctx.beginPath();
    const sens = cote === 0 ? -1 : 1;
    ctx.moveTo(largeur / 2, y + sens * 7);
    ctx.lineTo(largeur / 2 - 8, y - sens * 4);
    ctx.lineTo(largeur / 2 + 8, y - sens * 4);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(compte[cote]), largeur / 2, y + (cote === 0 ? 22 : -10));
  }
  ctx.textAlign = 'start';
}

export function dessinerScene(ctx, etat, camera, { largeur, hauteur, zoom }) {
  ctx.clearRect(0, 0, largeur, hauteur);
  dessinerDecor(ctx, camera, largeur, hauteur);

  const y = (position) => ordonnee(position, camera, hauteur);

  // Les bâtiments posés, de part et d'autre de la lane.
  for (const c of [NOUS, EUX]) {
    etat.camps[c].emplacements.forEach((place, i) => {
      if (!place) return;
      const { x, position } = placeBatiment(i, c, largeur);
      const py = y(position);
      if (py < -120 || py > hauteur + 120) return;
      const sprite = SPRITE_BATIMENT[place.batiment];
      // Un chantier est translucide : on voit qu'il n'est pas encore là.
      ctx.globalAlpha = place.restant > 0 ? 0.45 : 1;
      dessiner(ctx, sprite, x, py, zoom);
      ctx.globalAlpha = 1;
      socle(ctx, x, py, 10 * zoom * 0.5, COULEUR_CAMP[c]);
    });
  }

  // Les deux châteaux, et les enfants à côté.
  dessiner(ctx, S.CHATEAU_SABLE, largeur / 2, y(LANE) + 8, zoom);
  dessiner(ctx, S.MORVEUX, largeur * 0.24, y(LANE) + 10, zoom);
  dessiner(ctx, S.CHATEAU_SABLE, largeur / 2, y(0) + 24, zoom);
  dessiner(ctx, S.MIOCHE, largeur * 0.24, y(0) + 26, zoom);

  // Les unités, du fond vers l'avant pour que le recouvrement soit correct.
  const triees = [...etat.unites].sort((a, b) => b.position - a.position);
  for (const unite of triees) {
    const py = y(unite.position);
    if (py < -80 || py > hauteur + 80) continue;
    const sprite = SPRITE_UNITE[unite.type];
    const x = abscisse(unite, largeur);
    socle(ctx, x, py, Math.min(sprite[0].length, 14) * zoom * 0.5,
      COULEUR_CAMP[unite.camp]);
    dessiner(ctx, sprite, x, py, zoom, { miroir: unite.camp === EUX });
    barreDeVie(ctx, x, py - sprite.length * zoom - 6, 20,
      unite.pv / UNITES[unite.type].pv);
  }

  indicateursHorsChamp(ctx, etat, camera, largeur, hauteur);
}

export { BATIMENTS };
