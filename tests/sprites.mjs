/**
 * Vérifie les sprites : lignes de longueur constante, caractères connus.
 *
 * Une faute de frappe dans un dessin de vingt lignes ne se voit pas à l'œil et
 * décale toute une colonne. Ce test la trouve tout de suite.
 */
import { PALETTE } from '../www/rendu/palette.js';
import * as SPRITES from '../www/rendu/sprites.js';
import { zoomUnite } from '../www/rendu/scene.js';

let fautes = 0;
for (const [nom, sprite] of Object.entries(SPRITES)) {
  if (!Array.isArray(sprite)) continue;
  const largeur = sprite[0].length;
  sprite.forEach((ligne, y) => {
    if (ligne.length !== largeur) {
      console.error(`✗ ${nom} ligne ${y} : ${ligne.length} caractères, ${largeur} attendus`);
      fautes++;
    }
    for (const c of ligne) {
      if (!(c in PALETTE)) {
        console.error(`✗ ${nom} ligne ${y} : caractère « ${c} » absent de la palette`);
        fautes++;
      }
    }
  });
  if (!fautes) console.log(`  ${nom.padEnd(20)} ${largeur} × ${sprite.length}`);
}

// Les unités se croisent sur le terrain : si l'une se dessine plus haut que
// l'autre, la file n'a plus d'échelle. Le zoom compense la finesse du dessin,
// encore faut-il que le compte tombe juste.
const UNITES = [SPRITES.PETIT_SOLDAT, SPRITES.SOLDAT_BRIQUES, SPRITES.CAVALIER_BRIQUES];
const hauteurs = new Set(UNITES.map((s) => s.length * zoomUnite(s, 3)));
if (hauteurs.size !== 1) {
  console.error(`✗ les unités ne font pas la même taille à l'écran : ${[...hauteurs].join(', ')} pixels`);
  fautes++;
}

if (fautes) {
  console.error(`\n${fautes} faute(s) dans les sprites.`);
  process.exit(1);
}
console.log(`\nSprites : tous valides. Unités à ${[...hauteurs][0]} pixels.`);
