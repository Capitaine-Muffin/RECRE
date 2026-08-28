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
import { LANE, UNITES, BATIMENTS, VOIES, ECART_MIN, COLONNES_GRILLE,
  RANGEES_GRILLE } from '../moteur/donnees.js';
import { NOUS, EUX, profondeurRangee } from '../moteur/etat.js';
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
 * Les bâtiments sont dessinés un cran plus petits que les unités.
 *
 * Un cran entier, et pas une fraction : le pixel art se met à l'échelle par
 * multiples entiers, sinon les pixels bavent.
 */
export const zoomBatiment = (zoom) => Math.max(1, zoom - 1);

/** L'abscisse d'une colonne de construction. */
export const abscisseColonne = (colonne, largeur) =>
  largeur * COLONNES_GRILLE[colonne];

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

/**
 * La pelouse.
 *
 * Un vert d'herbe franc, tiré vers l'olive. Deux raisons à ce choix, et la
 * première est contre-intuitive :
 *
 * 1. **Un fond clair se lit mieux qu'un fond sombre**, ici. Chaque sprite
 *    porte un contour `#2f2740` : sur une pelouse sombre ce contour se noie,
 *    sur une pelouse claire il détoure. La première version, très sombre,
 *    partait de l'intuition inverse — à tort.
 * 2. Le Petit Soldat et la Caserne sont verts (`#3d9950`, `#6fd47a`), d'un
 *    vert **bleuté et saturé**. L'olive s'en écarte par la teinte autant que
 *    par la valeur, ce qui sépare mieux qu'un simple écart de luminosité.
 */
const PELOUSE = '#6d9155';

/** Les bandes de tonte, alternées le long de la lane. */
const TONTE = 'rgba(255,255,255,0.055)';
const LARGEUR_TONTE = 62_000;

/**
 * La craie sur l'herbe : plus franche que sur du bitume, parce que c'est ce
 * qu'on voit d'un vrai terrain — mais toujours sans volume ni ombre.
 */
const CRAIE = 'rgba(255,253,247,0.42)';
const CRAIE_PALE = 'rgba(255,253,247,0.26)';

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

  ctx.fillStyle = PELOUSE;
  ctx.fillRect(0, 0, largeur, hauteur);

  // Les bandes de tonte. Elles remplacent les taches d'usure : même rôle —
  // casser la dalle uniforme — mais en donnant en plus un repère de distance
  // qui défile quand la caméra bouge.
  ctx.fillStyle = TONTE;
  for (let p = 0; p < LANE; p += LARGEUR_TONTE * 2) {
    const haut = y(p + LARGEUR_TONTE);
    const bas = y(p);
    if (bas < 0 || haut > hauteur) continue;
    ctx.fillRect(0, haut, largeur, bas - haut);
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
  // Le même aux deux bouts : c'est la même cour, entourée du même mur. Un
  // dégradé de ciel d'un côté et un aplat de l'autre donnaient deux lieux
  // différents, et le violet jurait avec l'herbe.
  if (finHaute > 0) mur(ctx, largeur, 0, finHaute, e);
  if (finBasse < hauteur) mur(ctx, largeur, finBasse, hauteur, e);

  // ---- un très léger assombrissement des bords ----------------------------
  // Les figurines ressortent au centre sans qu'on ait ajouté le moindre objet.
  // Discret : à 0,38 ça ternissait toute la cour, et un décor qui se voit est
  // un décor raté.
  const bord = ctx.createRadialGradient(
    largeur / 2, hauteur / 2, hauteur * 0.48,
    largeur / 2, hauteur / 2, hauteur * 0.85);
  bord.addColorStop(0, 'rgba(0,0,0,0)');
  bord.addColorStop(1, 'rgba(20,32,18,0.16)');
  ctx.fillStyle = bord;
  ctx.fillRect(0, 0, largeur, hauteur);
}

/**
 * Le mur de la cour : pierre chaude, assises marquées.
 *
 * C'est le seul endroit du décor qui a droit à du détail, puisque personne n'y
 * joue. Il reste sourd — une pierre grise à peine chaude — pour ne pas tirer
 * l'œil hors du terrain.
 */
function mur(ctx, largeur, haut, bas, e) {
  const fond = ctx.createLinearGradient(0, haut, 0, bas);
  const versLeBas = bas < 400 || haut > 0;
  fond.addColorStop(0, versLeBas ? '#6f6659' : '#857b6d');
  fond.addColorStop(1, versLeBas ? '#857b6d' : '#6f6659');
  ctx.fillStyle = fond;
  ctx.fillRect(0, haut, largeur, bas - haut);

  const assise = Math.max(4, Math.round(12_000 * e));
  ctx.fillStyle = 'rgba(46,38,32,0.22)';
  for (let ligne = 0, yy = bas - assise; yy > haut - assise; yy -= assise, ligne++) {
    ctx.fillRect(0, Math.round(yy), largeur, 1);
    const decale = (ligne % 2) * assise;
    for (let x = decale; x < largeur; x += assise * 2) {
      ctx.fillRect(Math.round(x), Math.round(yy), 1, assise);
    }
  }

  // Le chaperon : la rangée de pierres du dessus, côté terrain.
  ctx.fillStyle = 'rgba(255,250,240,0.14)';
  const cote = haut === 0 ? bas - 3 : haut;
  ctx.fillRect(0, Math.round(cote), largeur, 3);
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

/**
 * La grille de construction, montrée seulement pendant qu'on place.
 *
 * Les cases libres s'éclairent, les occupées se barrent. Avancer une case, c'est
 * gagner du trajet pour ses unités et de la portée pour ses tours, mais entrer
 * dans celle des unités adverses : la grille donne à voir cet arbitrage.
 */
function dessinerGrille(ctx, etat, placement, { largeur, zoom, y }) {
  const prises = new Set(etat.camps[NOUS].emplacements
    .map((b) => `${b.colonne}:${b.rangee}`));
  const cote = 13 * zoomBatiment(zoom);

  for (let r = 0; r < RANGEES_GRILLE; r++) {
    for (let c = 0; c < COLONNES_GRILLE.length; c++) {
      const py = y(profondeurRangee(NOUS, r));
      const x = abscisseColonne(c, largeur);
      const occupee = prises.has(`${c}:${r}`);
      const visee = placement.colonne === c && placement.rangee === r;

      ctx.lineWidth = visee ? 3 : 1;
      ctx.strokeStyle = occupee ? 'rgba(239,77,90,0.55)'
        : visee ? '#ffd84d' : 'rgba(255,253,247,0.55)';
      ctx.fillStyle = occupee ? 'rgba(239,77,90,0.10)' : 'rgba(255,216,77,0.12)';
      if (!occupee) ctx.fillRect(x - cote, py - cote * 2, cote * 2, cote * 2);
      ctx.strokeRect(Math.round(x - cote) + 0.5, Math.round(py - cote * 2) + 0.5,
        cote * 2, cote * 2);
    }
  }
}

export function dessinerScene(ctx, etat, camera,
  { largeur, hauteur, zoom, placement = null }) {
  ctx.clearRect(0, 0, largeur, hauteur);
  dessinerDecor(ctx, camera, largeur, hauteur);

  const y = (position) => ordonnee(position, camera, hauteur);

  // La grille de construction, seulement pendant qu'on place.
  if (placement) dessinerGrille(ctx, etat, placement, { largeur, hauteur, zoom, y });

  // Les bâtiments, chacun sur sa case.
  const zb = zoomBatiment(zoom);
  for (const c of [NOUS, EUX]) {
    for (const place of etat.camps[c].emplacements) {
      const py = y(place.position);
      if (py < -120 || py > hauteur + 120) continue;
      const x = abscisseColonne(place.colonne, largeur);
      const sprite = SPRITE_BATIMENT[place.batiment];
      // Un chantier est translucide : on voit qu'il n'est pas encore là.
      ctx.globalAlpha = place.restant > 0 ? 0.45 : 1;
      dessiner(ctx, sprite, x, py, zb);
      ctx.globalAlpha = 1;
      socle(ctx, x, py, 10 * zb * 0.5, COULEUR_CAMP[c]);
      barreDeVie(ctx, x, py - sprite.length * zb - 6, 22,
        place.pv / BATIMENTS[place.batiment].pv);
    }
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
