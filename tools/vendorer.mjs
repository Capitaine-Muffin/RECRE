/**
 * Recopie le paquet de monétisation dans `www/vendor/`.
 *
 * Le jeu tourne sans bundler : le navigateur ne sait donc pas résoudre
 * `@capitaine-muffin/monetisation`, et Capacitor ne copie que `www/`. Cette
 * étape met le code là où les deux le trouvent, en imports relatifs.
 *
 * `www/vendor/` est ignoré par git : c'est une copie, la source fait foi.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(racine, 'node_modules', '@capitaine-muffin', 'monetisation', 'src');
const cible = path.join(racine, 'www', 'vendor', 'monetisation');

if (!existsSync(source)) {
  console.error('Le paquet de monétisation est absent. Lancer `npm install`.');
  process.exit(1);
}

rmSync(cible, { recursive: true, force: true });
mkdirSync(path.dirname(cible), { recursive: true });
cpSync(source, cible, { recursive: true });
console.log('Monétisation recopiée dans www/vendor/monetisation.');
