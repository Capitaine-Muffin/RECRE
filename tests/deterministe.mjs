/**
 * Le test qui garde le moteur déterministe.
 *
 * C'est la promesse sur laquelle repose l'étape 3 : même graine et mêmes
 * intentions ⇒ même partie, à l'octet près. Elle est facile à casser sans s'en
 * apercevoir — un `Math.random()` glissé dans une invocation, une itération sur
 * les clés d'un objet — et c'est ici qu'on le voit.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { nouvellePartie, empreinte, copier, NOUS, EUX } from '../www/moteur/etat.js';
import { VOIES, ECART_MIN } from '../www/moteur/donnees.js';
import { avancer } from '../www/moteur/simulation.js';
import { nouveauJournal, noter, rejouer } from '../www/moteur/journal.js';
import { nouvelAdversaire, jouer } from '../www/ia/adversaire.js';

let echecs = 0;
function verifier(nom, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${nom}`);
  } else {
    console.error(`  ✗ ${nom}${detail ? ' — ' + detail : ''}`);
    echecs++;
  }
}

/* ------------------------------------------------------------------------ */
console.log('\nLe moteur ne touche à rien d\'indéterminé');

// `Math.random` mais pas `Math.floor` ; `Date`/`performance` ; le DOM.
const INTERDITS = [
  [/Math\s*\.\s*random/, 'Math.random'],
  [/\bDate\s*\.\s*now|new\s+Date\b/, 'Date'],
  [/\bperformance\s*\./, 'performance'],
  [/\bdocument\b|\bwindow\b|\blocalStorage\b/, 'DOM'],
  [/Object\s*\.\s*keys|Object\s*\.\s*entries/, 'itération sur les clés d\'un objet'],
];
const dossier = new URL('../www/moteur/', import.meta.url);
for (const fichier of readdirSync(dossier)) {
  const source = readFileSync(join(dossier.pathname, fichier), 'utf8')
    // Les commentaires ont le droit de nommer ce qu'ils interdisent.
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  for (const [motif, nom] of INTERDITS) {
    verifier(`moteur/${fichier} sans ${nom}`, !motif.test(source));
  }
}

/* ------------------------------------------------------------------------ */
console.log('\nMêmes entrées, même partie');

/** Joue une partie complète IA contre IA et rend l'état final et son journal. */
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

const a = partie(20240827);
const b = partie(20240827);
verifier('deux exécutions donnent la même empreinte',
  empreinte(a.etat) === empreinte(b.etat),
  `${empreinte(a.etat)} ≠ ${empreinte(b.etat)}`);

const autre = partie(20240828);
verifier('une graine différente donne une partie différente',
  empreinte(a.etat) !== empreinte(autre.etat));

/* ------------------------------------------------------------------------ */
console.log('\nLe journal rejoue la partie');

const rejeu = rejouer(a.journal, a.etat.tick);
verifier('le rejeu retrouve l\'empreinte exacte',
  empreinte(rejeu) === empreinte(a.etat),
  `${empreinte(rejeu)} ≠ ${empreinte(a.etat)}`);
verifier('le journal reste petit',
  JSON.stringify(a.journal).length < 20_000,
  `${JSON.stringify(a.journal).length} octets`);

/* ------------------------------------------------------------------------ */
console.log('\nL\'état survit à la sérialisation');

const range = JSON.parse(JSON.stringify(a.etat));
verifier('aller-retour JSON sans perte', empreinte(range) === empreinte(a.etat));
verifier('copier() rend un état identique', empreinte(copier(a.etat)) === empreinte(a.etat));

const repris = copier(a.etat);
repris.vainqueur = null;
const suite1 = empreinte(avancer(copier(repris), []));
const suite2 = empreinte(avancer(JSON.parse(JSON.stringify(repris)), []));
verifier('une partie reprise continue pareil', suite1 === suite2);

/* ------------------------------------------------------------------------ */
console.log('\nLes règles tiennent');

const r = nouvellePartie(1);
for (let t = 0; t < 10; t++) avancer(r, []);
verifier('le revenu tombe (+1 tous les 5 ticks)', r.camps[NOUS].or === 22,
  `or = ${r.camps[NOUS].or}`);

const c = nouvellePartie(1);
avancer(c, [{ camp: NOUS, action: 'construire', emplacement: 0, batiment: 'caserne_soldats' }]);
verifier('construire coupe le revenu', c.camps[NOUS].enChantier);
const orAuDebut = c.camps[NOUS].or;
for (let t = 0; t < 20; t++) avancer(c, []);
verifier('le revenu reste coupé pendant le chantier',
  c.camps[NOUS].or === orAuDebut, `or ${orAuDebut} → ${c.camps[NOUS].or}`);

const p = nouvellePartie(1);
p.camps[NOUS].or = 999;
avancer(p, [{ camp: NOUS, action: 'construire', emplacement: 0, batiment: 'gouter' }]);
while (p.camps[NOUS].emplacements[0].restant > 0) avancer(p, []);
verifier('le Goûter ouvre 20 places', p.camps[NOUS].populationMax === 30,
  `plafond = ${p.camps[NOUS].populationMax}`);

const refus = nouvellePartie(1);
refus.camps[NOUS].or = 0;
avancer(refus, [{ camp: NOUS, action: 'construire', emplacement: 0, batiment: 'gouter' }]);
verifier('un achat qu\'on ne peut pas payer est refusé',
  refus.camps[NOUS].emplacements[0] === null);

/* ------------------------------------------------------------------------ */
console.log('\nLes unités ne se chevauchent pas');

// La garantie de lisibilité : dans une file, deux unités gardent leurs
// distances. Le chevauchement qu'on accepte est latéral, jamais en profondeur.
const foule = partie(31337, 4000).etat;
let collisions = 0;
for (const u of foule.unites) {
  for (const autre of foule.unites) {
    if (autre.id <= u.id || autre.voie !== u.voie) continue;
    if (Math.abs(autre.position - u.position) < ECART_MIN) collisions++;
  }
}
verifier('aucune paire trop proche dans une même file', collisions === 0,
  `${collisions} paire(s) sur ${foule.unites.length} unités`);

// Les files tournent : les VOIES premières unités d'un camp les servent
// toutes, une fois chacune. Sans adversaire, personne ne meurt et on peut
// compter tranquillement.
const seul = nouvellePartie(4);
seul.camps[NOUS].or = 500;
avancer(seul, [{ camp: NOUS, action: 'construire', emplacement: 0,
  batiment: 'caserne_soldats' }]);
while (seul.unites.length < VOIES) avancer(seul, []);
const tournee = seul.unites.slice(0, VOIES).map((u) => u.voie);
verifier('les files tournent et sont servies une fois chacune',
  new Set(tournee).size === VOIES, `files servies : ${tournee.join(',')}`);

/* ------------------------------------------------------------------------ */
if (echecs) {
  console.error(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log('\nTout passe.');
