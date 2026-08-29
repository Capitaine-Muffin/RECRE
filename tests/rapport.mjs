/**
 * Le rapport de partie : il doit dire vrai, et rester rejouable.
 *
 * Un rapport sert à reproduire un bug. S'il annonce une mauvaise version, ou
 * si le journal qu'il recopie ne rejoue pas la partie, il coûte plus de temps
 * qu'il n'en fait gagner.
 */
import { readFileSync } from 'node:fs';
import { nouvellePartie, empreinte, NOUS, EUX } from '../www/moteur/etat.js';
import { avancer } from '../www/moteur/simulation.js';
import { nouveauJournal, noter, rejouer } from '../www/moteur/journal.js';
import { nouvelAdversaire, jouer } from '../www/ia/adversaire.js';
import { redigerRapport, duree } from '../www/rapport.js';
import { VERSION, REVISION } from '../www/version.js';

let echecs = 0;
function verifier(nom, condition, detail = '') {
  if (condition) console.log(`  ✓ ${nom}`);
  else { console.error(`  ✗ ${nom}${detail ? ' — ' + detail : ''}`); echecs++; }
}

console.log('\nLe rapport de partie dit vrai');

const paquet = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
verifier('la version affichée est celle du paquet',
  VERSION === paquet.version, `${VERSION} ≠ ${paquet.version}`);

/** Une partie IA contre IA, avec son journal. */
function partie(graine, ticks = 6000) {
  const etat = nouvellePartie(graine);
  const journal = nouveauJournal(graine);
  const a = nouvelAdversaire(graine ^ 0x1111, 'normal');
  const b = nouvelAdversaire(graine ^ 0x2222, 'teigneux');
  for (let t = 0; t < ticks && etat.vainqueur === null; t++) {
    const intentions = [...jouer(a, etat, NOUS), ...jouer(b, etat, EUX)];
    noter(journal, t, intentions);
    avancer(etat, intentions);
  }
  return { etat, journal };
}

const { etat, journal } = partie(20240827);
const texte = redigerRapport({ journal, etat, version: VERSION, revision: REVISION });

verifier('il porte la version et la révision',
  texte.includes(VERSION) && texte.includes(REVISION));
verifier('il porte la graine', texte.includes(String(journal.graine)));
verifier('il dit l\'issue',
  /Partie \*\*(gagnée|perdue|en cours)\*\*/.test(texte));
verifier('le rejeu retombe sur la partie racontée',
  texte.includes(empreinte(rejouer(journal, etat.tick))));
verifier('il ne signale pas de divergence', !texte.includes('⚠️'), texte.slice(0, 400));

// Le bloc `json` du rapport est la pièce qui compte : c'est lui qu'on recolle.
const bloc = texte.match(/```json\n(.*)\n```/s);
verifier('il embarque un journal', Boolean(bloc));
if (bloc) {
  const relu = JSON.parse(bloc[1]);
  verifier('le journal recopié rejoue la partie à l\'identique',
    empreinte(rejouer(relu, etat.tick)) === empreinte(etat));
}

verifier('il tient dans un collage raisonnable',
  texte.length < 30_000, `${texte.length} caractères`);

// Une partie neuve : le rapport doit sortir quand même, sans rien inventer.
const neuve = { etat: nouvellePartie(1), journal: nouveauJournal(1) };
const vierge = redigerRapport({ ...neuve, version: VERSION, revision: REVISION });
verifier('une partie vide donne un rapport, pas une erreur',
  vierge.includes('Partie **en cours**') && vierge.includes('personne n\'a rien bâti'));

verifier('les durées se lisent en minutes',
  duree(0) === '0 s' && duree(35) === '4 s' && duree(1234) === '2 min 03 s',
  `${duree(0)} / ${duree(35)} / ${duree(1234)}`);

if (echecs) {
  console.error(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log('\nRapport : conforme.');
