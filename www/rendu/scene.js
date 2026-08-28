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
import { LANE, UNITES, BATIMENTS, VOIES, ECART_MIN } from '../moteur/donnees.js';
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
 * La file vient de la simulation, pas du dessin — c'est elle qui décide qui
 * bloque qui, donc elle doit être la même pour tout le monde.
 */
function abscisse(unite, largeur) {
  return largeur * (0.09 + (unite.voie * 0.82) / (VOIES - 1));
}

/**
 * Le décalage en profondeur d'une file, en millipas.
 *
 * À seize files, les figurines se recouvrent sur les côtés. Décaler une file
 * sur deux d'un demi-écart suffit à ce qu'on lise une foule plutôt qu'une
 * bouillie : deux voisines qui se chevauchent ne sont plus à la même hauteur.
 *
 * Purement visuel — la simulation ignore ce décalage.
 */
function decalage(unite) {
  return (unite.voie % 2) * (ECART_MIN / 2);
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

/**
 * Le décor de fond.
 *
 * Règle unique, et elle est sévère : **rien ne doit concurrencer les
 * figurines**. L'écran est déjà chargé. Donc tout ce qui suit est plat, pâle,
 * et sans volume — des tracés à la craie sur du bitume, pas des objets. Un
 * décor qui se voit est un décor raté ; celui-ci doit seulement empêcher le
 * sol d'être une dalle marron.
 *
 * D'où une seule idée plutôt qu'un empilement : la cour est un terrain de
 * foot peint au sol, dans l'axe de la lane. Les deux armées se battent
 * dessus. Ça situe le lieu, ça donne des repères de distance — ligne médiane,
 * surfaces de réparation — et ça ne coûte pas un pixel opaque.
 */

/** La craie : blanc cassé, très transparent. Jamais plus appuyé que ça. */
const CRAIE = 'rgba(255,246,232,0.085)';
const CRAIE_PALE = 'rgba(255,246,232,0.055)';

/** Une marelle, dessinée depuis son coin bas, en millipas. */
function marelle(ctx, x, y, e, sens) {
  const c = 15_000 * e;               // le côté d'une case
  const cases = [[0, 0], [0, 1], [-0.5, 2], [0.5, 2], [0, 3], [-0.5, 4], [0.5, 4], [0, 5]];
  ctx.strokeStyle = CRAIE_PALE;
  ctx.lineWidth = 1;
  for (const [dx, dy] of cases) {
    ctx.strokeRect(Math.round(x + dx * c - c / 2), Math.round(y - sens * (dy + 1) * c),
      Math.round(c), Math.round(c));
  }
}

function dessinerDecor(ctx, camera, largeur, hauteur) {
  const e = echelle(hauteur);
  const y = (position) => ordonnee(position, camera, hauteur);
  const finHaute = y(LANE) - MUR * e;
  const finBasse = y(0) + MUR * e;

  ctx.fillStyle = '#6b5a4a';
  ctx.fillRect(0, 0, largeur, hauteur);

  // Deux zones usées, à peine plus claires : le bitume n'est pas neuf, et ça
  // évite la dalle uniforme sans rien ajouter à regarder.
  ctx.fillStyle = 'rgba(255,246,232,0.028)';
  for (const [debut, fin] of [[210_000, 430_000], [620_000, 760_000]]) {
    const haut = y(fin);
    ctx.fillRect(0, haut, largeur, Math.max(0, y(debut) - haut));
  }

  // ---- le terrain de foot, tracé à la craie --------------------------------
  const gauche = Math.round(largeur * 0.05);
  const droite = Math.round(largeur * 0.95);
  ctx.strokeStyle = CRAIE;
  ctx.lineWidth = 1;

  // Les touches, sur toute la longueur.
  ctx.beginPath();
  ctx.moveTo(gauche + 0.5, y(LANE));
  ctx.lineTo(gauche + 0.5, y(0));
  ctx.moveTo(droite + 0.5, y(LANE));
  ctx.lineTo(droite + 0.5, y(0));
  ctx.stroke();

  // La ligne médiane et son rond central.
  const milieu = y(LANE / 2);
  ctx.beginPath();
  ctx.moveTo(gauche, Math.round(milieu) + 0.5);
  ctx.lineTo(droite, Math.round(milieu) + 0.5);
  ctx.stroke();
  // Un rond, pas un œuf : la projection est droite du dessus, donc un cercle
  // peint au sol est un cercle à l'écran — même rayon dans les deux sens.
  const rond = largeur * 0.19;
  ctx.beginPath();
  ctx.ellipse(largeur / 2, milieu, rond, rond, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Une surface de réparation devant chaque but.
  for (const base of [0, LANE]) {
    const vers = base === 0 ? 1 : -1;
    const proche = y(base + vers * 55_000);
    const loin = y(base + vers * 165_000);
    ctx.strokeRect(Math.round(largeur * 0.24) + 0.5, Math.round(Math.min(proche, loin)) + 0.5,
      Math.round(largeur * 0.52), Math.round(Math.abs(loin - proche)));
  }

  // ---- deux marelles, hors du terrain -------------------------------------
  marelle(ctx, largeur * 0.10, y(300_000), e, 1);
  marelle(ctx, largeur * 0.90, y(640_000), e, -1);

  // ---- au-delà des bases : le mur de la cour ------------------------------
  if (finHaute > 0) {
    const ciel = ctx.createLinearGradient(0, Math.max(0, finHaute - 260), 0, finHaute);
    ciel.addColorStop(0, '#221b2c');
    ciel.addColorStop(1, '#3a3145');
    ctx.fillStyle = ciel;
    ctx.fillRect(0, 0, largeur, finHaute);
    mursEtBriques(ctx, largeur, 0, finHaute, e);
  }
  if (finBasse < hauteur) {
    // Le même gris-brun que le mur du fond : un violet franc jurerait avec la
    // cour, et le mur n'est pas censé attirer l'œil.
    ctx.fillStyle = '#2e2636';
    ctx.fillRect(0, finBasse, largeur, hauteur - finBasse);
    mursEtBriques(ctx, largeur, finBasse, hauteur, e);
  }

  // ---- un très léger assombrissement des bords ----------------------------
  // Les figurines ressortent au centre sans qu'on ait ajouté le moindre objet.
  // Discret : à 0,38 ça ternissait toute la cour, et un décor qui se voit est
  // un décor raté.
  const bord = ctx.createRadialGradient(
    largeur / 2, hauteur / 2, hauteur * 0.48,
    largeur / 2, hauteur / 2, hauteur * 0.85);
  bord.addColorStop(0, 'rgba(0,0,0,0)');
  bord.addColorStop(1, 'rgba(12,8,20,0.20)');
  ctx.fillStyle = bord;
  ctx.fillRect(0, 0, largeur, hauteur);
}

/** Les assises de briques du mur du fond. Sombres, à peine détachées. */
function mursEtBriques(ctx, largeur, haut, bas, e) {
  const assise = Math.max(4, Math.round(12_000 * e));
  ctx.fillStyle = 'rgba(255,246,232,0.045)';
  for (let ligne = 0, yy = bas - assise; yy > haut - assise; yy -= assise, ligne++) {
    ctx.fillRect(0, Math.round(yy), largeur, 1);
    const decale = (ligne % 2) * assise;
    for (let x = decale; x < largeur; x += assise * 2) {
      ctx.fillRect(Math.round(x), Math.round(yy), 1, assise);
    }
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
    const py = y(unite.position + decalage(unite));
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
