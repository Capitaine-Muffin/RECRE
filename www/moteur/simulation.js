/**
 * La simulation. Le cœur du jeu, et la seule chose qui fait autorité.
 *
 * Une fonction, un pas fixe :
 *
 *     etatSuivant = avancer(etat, intentions)
 *
 * `intentions` est la liste des actions du tick, sans distinction d'origine :
 * le doigt du joueur, l'IA locale, et plus tard une socket produisent
 * exactement la même chose. C'est ce qui permettra de brancher le réseau sans
 * toucher à ce fichier.
 *
 * Interdits ici, et vérifiés par `tests/deterministe.mjs` :
 * `Math.random`, `Date.now`, `performance.now`, le DOM. Tout le hasard vient
 * de `aleatoire.js`, tout le temps se compte en ticks.
 */
import { UNITES, BATIMENTS, REGLES, LANE } from './donnees.js';
import { NOUS, EUX, adverse, sens, baseDe } from './etat.js';

/**
 * Dégâts après armure, en entiers.
 *
 * Reprend la formule de Warcraft — `1 − 0,06·a / (1 + 0,06·a)`, soit un
 * rendement décroissant — écrite pour rester en nombres entiers :
 * `degats × 100 / (100 + 6·armure)`.
 */
export function degatsRecus(degats, armure) {
  return Math.max(1, Math.floor((degats * 100) / (100 + 6 * Math.max(0, armure))));
}

/** L'unité ennemie la plus proche de `unite`, ou `null`. */
function cible(etat, unite) {
  let meilleure = null;
  let distance = Infinity;
  // Parcours d'un tableau, dans l'ordre de création : reproductible.
  for (const autre of etat.unites) {
    if (autre.camp === unite.camp || autre.pv <= 0) continue;
    const d = Math.abs(autre.position - unite.position);
    if (d < distance) {
      distance = d;
      meilleure = autre;
    }
  }
  return meilleure && distance <= unite.portee ? meilleure : null;
}

/** Applique les achats du tick. Une intention refusée est ignorée en silence. */
function appliquerIntentions(etat, intentions) {
  for (const { camp: c, action, emplacement, batiment } of intentions) {
    if (action !== 'construire') continue;
    const camp = etat.camps[c];
    const modele = BATIMENTS[batiment];
    if (!modele) continue;
    if (emplacement < 0 || emplacement >= camp.emplacements.length) continue;
    if (camp.emplacements[emplacement] !== null) continue;
    if (camp.or < modele.or) continue;
    if (camp.population + modele.population > camp.populationMax) continue;

    camp.or -= modele.or;
    camp.population += modele.population;
    camp.emplacements[emplacement] = {
      batiment,
      restant: modele.ticksConstruction,
      /** Décalé pour que les casernes d'un même camp ne pondent pas en bloc. */
      depuisProduction: emplacement * 7,
      /** Recharge propre à cette tour, pour qu'elles ne tirent pas en salve. */
      recharge: 0,
    };
  }
}

/** Verse l'or, sauf pendant un chantier — c'est le seul arbitrage du jeu. */
function verserOr(etat) {
  if (etat.tick % REGLES.ticksParOr !== 0) return;
  for (const camp of etat.camps) {
    if (!camp.enChantier) camp.or += REGLES.orParVersement;
  }
}

/**
 * Fait avancer les chantiers et note si un camp est encore en travaux.
 *
 * Un bâtiment qui vient d'être fini ouvre ses places de population — comme
 * dans Warcraft, la nourriture n'est comptée qu'une fois la construction
 * achevée.
 */
function avancerChantiers(etat) {
  for (const camp of etat.camps) {
    let chantier = false;
    for (const place of camp.emplacements) {
      if (!place || place.restant === 0) continue;
      place.restant--;
      if (place.restant > 0) {
        chantier = true;
        continue;
      }
      const fournies = BATIMENTS[place.batiment].fournitPopulation;
      if (fournies) {
        camp.populationMax = Math.min(
          REGLES.populationMax, camp.populationMax + fournies);
      }
    }
    camp.enChantier = chantier;
  }
}

function creer(etat, campIndex, type, position) {
  const modele = UNITES[type];
  etat.unites.push({
    id: etat.prochainId++,
    type,
    camp: campIndex,
    position,
    pv: modele.pv,
    degats: modele.degats,
    armure: modele.armure,
    portee: modele.portee,
    vitesse: modele.vitesse,
    ticksParCoup: modele.ticksParCoup,
    /** Ticks restants avant de pouvoir frapper. */
    recharge: 0,
  });
}

/** Les casernes terminées produisent, toutes les `ticksParProduction` ticks. */
function produire(etat) {
  for (let c = 0; c < etat.camps.length; c++) {
    for (const place of etat.camps[c].emplacements) {
      if (!place || place.restant > 0) continue;
      const modele = BATIMENTS[place.batiment];
      if (!modele.produit) continue;
      place.depuisProduction++;
      if (place.depuisProduction < REGLES.ticksParProduction) continue;
      place.depuisProduction = 0;
      creer(etat, c, modele.produit, baseDe(c));
    }
  }
}

/**
 * Les tours tirent sur ce qui approche de leur base.
 *
 * Chacune porte sa propre recharge : sans ça elles tireraient toutes le même
 * tick, sur la même unité, et trois tours ne vaudraient guère mieux qu'une.
 */
function tirerDesTours(etat, degats) {
  for (let c = 0; c < etat.camps.length; c++) {
    const base = baseDe(c);
    for (const place of etat.camps[c].emplacements) {
      if (!place || place.restant > 0) continue;
      const modele = BATIMENTS[place.batiment];
      if (!modele.portee) continue;
      if (place.recharge > 0) {
        place.recharge--;
        continue;
      }

      let victime = null;
      let distance = Infinity;
      for (const unite of etat.unites) {
        if (unite.camp === c || unite.pv <= 0) continue;
        const d = Math.abs(unite.position - base);
        if (d < distance) {
          distance = d;
          victime = unite;
        }
      }
      if (victime && distance <= modele.portee) {
        place.recharge = modele.ticksParCoup;
        degats.set(victime.id,
          (degats.get(victime.id) ?? 0) + degatsRecus(modele.degats, victime.armure));
      }
    }
  }
}

/**
 * Les unités : chercher une cible, sinon avancer.
 *
 * Les dégâts sont accumulés puis appliqués d'un coup, pour que l'ordre du
 * parcours ne décide pas qui meurt en premier : deux unités qui s'achèvent
 * au même tick tombent toutes les deux.
 */
function combattre(etat) {
  const degats = new Map();

  for (const unite of etat.unites) {
    if (unite.pv <= 0) continue;
    if (unite.recharge > 0) unite.recharge--;

    const proie = cible(etat, unite);
    if (proie) {
      if (unite.recharge === 0) {
        unite.recharge = unite.ticksParCoup;
        degats.set(proie.id,
          (degats.get(proie.id) ?? 0) + degatsRecus(unite.degats, proie.armure));
      }
      continue;
    }

    const arrivee = baseDe(adverse(unite.camp));
    const restant = Math.abs(arrivee - unite.position);

    // Arrivée devant le château : elle l'assiège, elle ne disparaît pas. Les
    // unités s'y empilent, exactement comme dans la map d'origine.
    if (restant === 0) {
      if (unite.recharge === 0) {
        unite.recharge = unite.ticksParCoup;
        const ennemi = etat.camps[adverse(unite.camp)];
        ennemi.pvChateau = Math.max(0, ennemi.pvChateau - unite.degats);
      }
      continue;
    }

    unite.position += sens(unite.camp) * Math.min(unite.vitesse, restant);
  }

  tirerDesTours(etat, degats);

  for (const unite of etat.unites) {
    const recu = degats.get(unite.id);
    if (recu) unite.pv -= recu;
  }

  etat.unites = etat.unites.filter((unite) => unite.pv > 0);
}

function verifierVictoire(etat) {
  if (etat.vainqueur !== null) return;
  if (etat.camps[EUX].pvChateau === 0) etat.vainqueur = NOUS;
  else if (etat.camps[NOUS].pvChateau === 0) etat.vainqueur = EUX;
}

/**
 * Un pas de simulation.
 *
 * Mute `etat` et le rend — la boucle appelante garde une seule instance. Pour
 * une copie, passer par `copier()`.
 *
 * L'ordre des étapes fait partie des règles du jeu : le changer change les
 * parties, et l'empreinte du test le verra.
 */
export function avancer(etat, intentions = []) {
  if (etat.vainqueur !== null) return etat;

  appliquerIntentions(etat, intentions);
  verserOr(etat);
  avancerChantiers(etat);
  produire(etat);
  combattre(etat);
  verifierVictoire(etat);

  etat.tick++;
  return etat;
}

export { LANE };
