/**
 * Le dessin : sprites → canvas.
 *
 * Chaque sprite est peint une fois dans un canvas hors écran, puis recopié à
 * l'échelle voulue avec le lissage coupé — c'est ce qui garde des pixels
 * carrés et nets au lieu d'une bouillie floue.
 *
 * Cette couche ne lit que l'état ; elle n'y écrit jamais rien.
 */
import { PALETTE } from './palette.js';

const cache = new Map();

/** Peint un sprite dans un canvas 1 pixel = 1 pixel, et le garde. */
function prerendu(sprite) {
  let toile = cache.get(sprite);
  if (toile) return toile;

  const largeur = sprite[0].length;
  const hauteur = sprite.length;
  toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext('2d');
  const image = ctx.createImageData(largeur, hauteur);

  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const couleur = PALETTE[sprite[y][x]];
      if (!couleur) continue;
      const i = (y * largeur + x) * 4;
      image.data[i] = parseInt(couleur.slice(1, 3), 16);
      image.data[i + 1] = parseInt(couleur.slice(3, 5), 16);
      image.data[i + 2] = parseInt(couleur.slice(5, 7), 16);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  cache.set(sprite, toile);
  return toile;
}

/**
 * Dessine un sprite, `x`/`y` désignant le **bas du milieu** — les objets sont
 * posés sur le sol, on les place par les pieds.
 */
export function dessiner(ctx, sprite, x, y, zoom, { miroir = false } = {}) {
  const toile = prerendu(sprite);
  const l = toile.width * zoom;
  const h = toile.height * zoom;
  ctx.imageSmoothingEnabled = false;
  if (miroir) {
    ctx.save();
    ctx.translate(Math.round(x + l / 2), Math.round(y - h));
    ctx.scale(-1, 1);
    ctx.drawImage(toile, -l, 0, l, h);
    ctx.restore();
    return;
  }
  ctx.drawImage(toile, Math.round(x - l / 2), Math.round(y - h), l, h);
}

/**
 * Le socle d'équipe, sous les pieds.
 *
 * Sans lui on ne distingue pas ses unités de celles d'en face : les deux camps
 * achètent dans le même catalogue, donc les mêmes sprites marchent dans les
 * deux sens. Teinter les sprites eux-mêmes abîmerait la palette ; un socle
 * coloré se lit d'un coup d'œil et laisse le dessin intact.
 */
export function socle(ctx, x, y, largeur, couleur) {
  const l = Math.round(largeur);
  const h = Math.max(3, Math.round(largeur / 5));
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), l / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y) - 1, l / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Une barre de vie fine, seulement quand l'objet est entamé. */
export function barreDeVie(ctx, x, y, largeur, part) {
  if (part >= 1) return;
  const h = 3;
  ctx.fillStyle = '#2f2740';
  ctx.fillRect(Math.round(x - largeur / 2) - 1, Math.round(y) - 1, largeur + 2, h + 2);
  ctx.fillStyle = part > 0.5 ? '#6fd47a' : part > 0.25 ? '#ffd84d' : '#ef4d5a';
  ctx.fillRect(Math.round(x - largeur / 2), Math.round(y),
    Math.max(1, Math.round(largeur * part)), h);
}
