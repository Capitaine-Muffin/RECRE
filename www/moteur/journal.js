/**
 * Le journal d'une partie : sa graine, et les intentions tick par tick.
 *
 * C'est tout ce qu'il faut pour la rejouer à l'identique — quelques
 * kilo-octets pour une partie entière. D'où, gratuitement : les replays, les
 * rapports de bug reproductibles, les tests de non-régression, et plus tard
 * la reprise après coupure côté réseau.
 *
 * Les intentions sont enregistrées telles quelles, sans qu'on sache qui les a
 * produites. Une partie contre l'IA se rejoue donc même si l'IA change : ce
 * qui est rejoué, ce sont ses décisions, pas son raisonnement.
 */
import { nouvellePartie } from './etat.js';
import { avancer } from './simulation.js';

/** Un journal vide pour une partie qui commence. */
export function nouveauJournal(graine) {
  return { graine: graine >>> 0, entrees: [] };
}

/** Note les intentions d'un tick. Les ticks sans action ne coûtent rien. */
export function noter(journal, tick, intentions) {
  if (intentions.length) journal.entrees.push({ tick, intentions });
}

/**
 * Rejoue un journal et rend l'état final.
 *
 * @param {number} [ticks]  s'arrêter là plutôt qu'à la fin du journal.
 */
export function rejouer(journal, ticks) {
  const etat = nouvellePartie(journal.graine);
  const parTick = new Map();
  for (const { tick, intentions } of journal.entrees) {
    parTick.set(tick, [...(parTick.get(tick) ?? []), ...intentions]);
  }
  const dernier = journal.entrees.length
    ? journal.entrees[journal.entrees.length - 1].tick
    : 0;
  const fin = ticks ?? dernier;
  for (let t = 0; t < fin && etat.vainqueur === null; t++) {
    avancer(etat, parTick.get(t) ?? []);
  }
  return etat;
}
