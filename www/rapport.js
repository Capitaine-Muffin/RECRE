/**
 * Le rapport de partie : ce qui s'est passé, en texte, prêt à coller.
 *
 * Il ne lit pas des compteurs tenus par la simulation — il **rejoue le
 * journal** et regarde. C'est ce que le journal promet depuis le début
 * (`moteur/journal.js`) : quelques kilo-octets suffisent à reconstituer une
 * partie entière, donc le moteur n'a pas à traîner de statistiques dont il n'a
 * pas besoin pour jouer.
 *
 * Le coût est mesuré : une partie de 6000 ticks avec 383 unités en fin de
 * course se rejoue en 490 ms sur une machine de bureau. On le paie une fois,
 * quand le joueur demande le rapport, partie en pause.
 *
 * Le journal est recopié à la fin du texte : collé ici, il rejoue la partie à
 * l'identique. Un rapport de bug qui se reproduit vaut mieux qu'un rapport de
 * bug qui se raconte.
 */
import { UNITES, BATIMENTS, MS_PAR_TICK, REGLES } from './moteur/donnees.js';
import { nouvellePartie, empreinte, NOUS } from './moteur/etat.js';
import { avancer } from './moteur/simulation.js';

/** Les types d'unités, dans un ordre fixe — jamais `Object.keys` sur un état. */
const TYPES = ['petit_soldat', 'soldat_briques', 'cavalier_briques'];

const NOMS_CAMPS = ['Nous', 'Eux'];

/** Ticks → « 2 min 34 s ». Le tick est la seule horloge du jeu. */
export function duree(ticks) {
  const s = Math.round((ticks * MS_PAR_TICK) / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

/** `G3` : colonne gauche, troisième rangée depuis la base. */
const nomCase = (colonne, rangee) => `${colonne === 0 ? 'G' : 'D'}${rangee + 1}`;

const cleCase = (place) => `${place.colonne}:${place.rangee}`;

function suiviVide() {
  return {
    produites: { petit_soldat: 0, soldat_briques: 0, cavalier_briques: 0 },
    poses: 0,
    perdus: 0,
    orDepense: 0,
    pic: 0,
    picTick: 0,
  };
}

/**
 * Rejoue le journal et récolte tout ce que le rapport raconte.
 *
 * On regarde l'état après chaque tick plutôt que d'instrumenter la
 * simulation : elle reste exactement le code qui tourne en partie, sans
 * branche « quand on fait un rapport ».
 */
function depouiller(journal, jusqua) {
  const parTick = new Map();
  for (const { tick, intentions } of journal.entrees) {
    parTick.set(tick, [...(parTick.get(tick) ?? []), ...intentions]);
  }

  const etat = nouvellePartie(journal.graine);
  const suivi = [suiviVide(), suiviVide()];
  const vues = new Set();
  const connus = [new Map(), new Map()];
  const evenements = [];
  // Les paliers du château, pour que la chronologie dise quand ça a basculé.
  const paliers = [[75, 50, 25], [75, 50, 25]];

  for (let t = 0; t < jusqua && etat.vainqueur === null; t++) {
    avancer(etat, parTick.get(t) ?? []);

    const vivantes = [0, 0];
    for (const unite of etat.unites) {
      vivantes[unite.camp]++;
      if (vues.has(unite.id)) continue;
      vues.add(unite.id);
      suivi[unite.camp].produites[unite.type]++;
    }

    for (let c = 0; c < 2; c++) {
      if (vivantes[c] > suivi[c].pic) {
        suivi[c].pic = vivantes[c];
        suivi[c].picTick = etat.tick;
      }

      // Les bâtiments : ce qui apparaît a été payé, ce qui disparaît est tombé.
      const presents = new Set();
      for (const place of etat.camps[c].emplacements) {
        const cle = cleCase(place);
        presents.add(cle);
        if (connus[c].has(cle)) continue;
        connus[c].set(cle, place.batiment);
        suivi[c].poses++;
        suivi[c].orDepense += BATIMENTS[place.batiment].or;
        evenements.push({ tick: etat.tick, camp: c, verbe: 'pose',
          batiment: place.batiment, ou: nomCase(place.colonne, place.rangee) });
      }
      for (const [cle, batiment] of connus[c]) {
        if (presents.has(cle)) continue;
        connus[c].delete(cle);
        suivi[c].perdus++;
        const [colonne, rangee] = cle.split(':').map(Number);
        evenements.push({ tick: etat.tick, camp: c, verbe: 'perdu',
          batiment, ou: nomCase(colonne, rangee) });
      }

      const part = (etat.camps[c].pvChateau * 100) / REGLES.pvChateau;
      while (paliers[c].length && part <= paliers[c][0]) {
        const seuil = paliers[c].shift();
        evenements.push({ tick: etat.tick, camp: c, verbe: 'chateau', seuil });
      }
    }
  }

  return { etat, suivi, evenements };
}

const ligne = (titre, a, b) => `| ${titre} | ${a} | ${b} |`;

/**
 * Le rapport complet.
 *
 * `etat` est celui de la partie en cours : il sert à dire jusqu'où rejouer, et
 * le rejeu doit retomber dessus. S'il n'y retombe pas, on le dit dans le
 * rapport plutôt que de le taire — c'est précisément le genre de bug qu'on
 * cherche.
 */
export function redigerRapport({ journal, etat, version, revision, quand }) {
  const { etat: rejeu, suivi, evenements } = depouiller(journal, etat.tick);
  const camps = [rejeu.camps[0], rejeu.camps[1]];

  const issue = rejeu.vainqueur === null ? 'en cours'
    : rejeu.vainqueur === NOUS ? 'gagnée' : 'perdue';

  const lignes = [];
  lignes.push(`# Rapport de partie — RECRE ${version} (${revision})`);
  lignes.push('');
  lignes.push(`Partie **${issue}** · graine \`${journal.graine}\` · `
    + `${duree(rejeu.tick)} (${rejeu.tick} ticks) · empreinte \`${empreinte(rejeu)}\``);
  if (quand) lignes.push(`Relevé le ${quand}.`);
  if (rejeu.tick !== etat.tick) {
    lignes.push('');
    lignes.push(`⚠️ Le rejeu s'est arrêté au tick ${rejeu.tick} alors que la `
      + `partie en est au ${etat.tick} : le journal ne reproduit pas la partie.`);
  }

  lignes.push('');
  lignes.push('## Les camps');
  lignes.push('| | Nous | Eux |', '|---|---|---|');
  lignes.push(ligne('Château', ...camps.map((c) => `${c.pvChateau} / ${REGLES.pvChateau}`)));
  lignes.push(ligne('Or en caisse', ...camps.map((c) => c.or)));
  lignes.push(ligne('Or dépensé en bâtiments', ...suivi.map((s) => s.orDepense)));
  lignes.push(ligne('Population', ...camps.map((c) => `${c.population} / ${c.populationMax}`)));
  lignes.push(ligne('Bâtiments posés', ...suivi.map((s) => s.poses)));
  lignes.push(ligne('… détruits', ...suivi.map((s) => s.perdus)));
  lignes.push(ligne('… debout à la fin', ...camps.map((c) => c.emplacements.length)));

  lignes.push('');
  lignes.push('## Les armées');
  lignes.push('| | Nous | Eux |', '|---|---|---|');
  for (const type of TYPES) {
    lignes.push(ligne(`${UNITES[type].nom} produits`,
      ...suivi.map((s) => s.produites[type])));
  }
  const total = suivi.map((s) => TYPES.reduce((n, t) => n + s.produites[t], 0));
  const vivantes = [0, 0];
  for (const unite of rejeu.unites) vivantes[unite.camp]++;
  lignes.push(ligne('Total produit', ...total));
  lignes.push(ligne('Perdues au combat', ...total.map((n, c) => n - vivantes[c])));
  lignes.push(ligne('En vie à la fin', ...vivantes));
  lignes.push(ligne('Pic d\'armée',
    ...suivi.map((s) => `${s.pic} (${duree(s.picTick)})`)));

  lignes.push('');
  lignes.push('## Chronologie');
  lignes.push('_Les cases se lisent `G`/`D` pour la colonne gauche ou droite, '
    + 'puis la rangée depuis sa propre base._');
  lignes.push('');
  if (!evenements.length) lignes.push('_Rien à signaler : personne n\'a rien bâti._');
  for (const e of evenements) {
    const qui = NOMS_CAMPS[e.camp];
    // « construit X » plutôt que « X posée » : les noms de bâtiments n'ont pas
    // tous le même genre et le rapport n'a pas à trimballer une table pour ça.
    const quoi = e.verbe === 'chateau'
      ? `château sous ${e.seuil} %`
      : `${e.verbe === 'pose' ? 'construit' : 'perd'} ${BATIMENTS[e.batiment].nom} (${e.ou})`;
    lignes.push(`- \`${duree(e.tick).padStart(10)}\` — ${qui} : ${quoi}`);
  }

  lignes.push('');
  lignes.push('## Journal');
  lignes.push('_Collé tel quel, il rejoue la partie à l\'identique._');
  lignes.push('');
  lignes.push('```json');
  lignes.push(JSON.stringify(journal));
  lignes.push('```');

  return lignes.join('\n');
}
