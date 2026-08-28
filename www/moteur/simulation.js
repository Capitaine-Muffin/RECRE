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
import { UNITES, BATIMENTS, REGLES, LANE, VOIES, ECART_MIN, ECART_VOIE }
  from './donnees.js';
import { NOUS, EUX, adverse, sens, baseDe, profondeurRangee, voieColonne,
  caseValide } from './etat.js';

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

/**
 * Le carré de la distance entre deux unités, files comprises.
 *
 * Au carré, et pas la vraie distance : tout reste entier, donc exact et
 * comparable sans qu'une racine vienne mettre des flottants dans une
 * comparaison dont dépend le déroulement de la partie.
 *
 * La largeur compte autant que la profondeur. C'est elle qui fait qu'une unité
 * de mêlée ne tape pas son vis-à-vis à l'autre bout d'un front de seize files.
 */
function distanceCarree(a, b) {
  const dp = a.position - b.position;
  const dv = (a.voie - b.voie) * ECART_VOIE;
  return dp * dp + dv * dv;
}

/**
 * Range les unités par file, une fois par tick.
 *
 * Sans ça, chercher une cible coûte un parcours de toute l'armée, pour chaque
 * unité : mesuré à 2132 unités, 35 ms par tick — au-dessus du budget de 100 ms
 * dès qu'on met un téléphone au bout. Une attaque ne porte que sur quelques
 * files, il est inutile de regarder les autres.
 *
 * L'ordre dans chaque file reste l'ordre de création : reproductible.
 */
function rangerParVoie(unites) {
  const files = Array.from({ length: VOIES }, () => []);
  for (const u of unites) files[u.voie].push(u);
  return files;
}

/**
 * L'unité ennemie la plus proche de `unite`, ou `null` si aucune à portée.
 *
 * On sort dès qu'une cible est à moins d'un écart minimal : aucune autre ne
 * pourra être sensiblement plus proche, et dans une mêlée dense c'est ce qui
 * évite de parcourir la foule entière pour chacun de ses membres.
 */
function cible(files, unite) {
  const portee = unite.portee * unite.portee;
  const atteinte = Math.ceil(unite.portee / ECART_VOIE);
  const proche = ECART_MIN * ECART_MIN;
  let meilleure = null;
  let distance = Infinity;

  const debut = Math.max(0, unite.voie - atteinte);
  const fin = Math.min(VOIES - 1, unite.voie + atteinte);
  for (let v = debut; v <= fin; v++) {
    for (const autre of files[v]) {
      if (autre.camp === unite.camp || autre.pv <= 0) continue;
      const d = distanceCarree(unite, autre);
      if (d >= distance) continue;
      distance = d;
      meilleure = autre;
      if (d <= proche) return meilleure;
    }
  }
  return meilleure && distance <= portee ? meilleure : null;
}

/** Applique les achats du tick. Une intention refusée est ignorée en silence. */
function appliquerIntentions(etat, intentions) {
  for (const { camp: c, action, batiment, colonne, rangee } of intentions) {
    if (action !== 'construire') continue;
    const camp = etat.camps[c];
    const modele = BATIMENTS[batiment];
    if (!modele) continue;
    if (!caseValide(colonne, rangee)) continue;
    if (camp.emplacements.some((b) => b.colonne === colonne && b.rangee === rangee)) {
      continue;
    }
    if (camp.or < modele.or) continue;
    if (camp.population + modele.population > camp.populationMax) continue;

    camp.or -= modele.or;
    camp.population += modele.population;
    camp.emplacements.push({
      batiment,
      colonne,
      rangee,
      position: profondeurRangee(c, rangee),
      voie: voieColonne(colonne),
      pv: modele.pv,
      restant: modele.ticksConstruction,
      /** Décalé pour que les casernes d'un même camp ne pondent pas en bloc. */
      depuisProduction: (camp.emplacements.length * 7) % REGLES.ticksParProduction,
      /** Recharge propre à cette tour, pour qu'elles ne tirent pas en salve. */
      recharge: 0,
    });
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

/**
 * Recule le point de sortie jusqu'à ce que la place soit libre dans la file.
 *
 * Deux casernes sur la même rangée, de part et d'autre de la lane, produisent à
 * la même profondeur : si la rotation des files leur donne la même, les deux
 * unités naissaient exactement l'une sur l'autre. On recule la nouvelle vers sa
 * propre base, ce qui la met simplement en queue.
 */
function placeLibre(etat, campIndex, voie, position) {
  const recul = sens(campIndex) * -1;
  let essai = position;
  for (let i = 0; i < 64; i++) {
    let occupee = false;
    for (const autre of etat.unites) {
      if (autre.voie !== voie) continue;
      if (Math.abs(autre.position - essai) < ECART_MIN) { occupee = true; break; }
    }
    if (!occupee) return essai;
    essai += recul * ECART_MIN;
  }
  return essai;
}

function creer(etat, campIndex, type, position) {
  const modele = UNITES[type];
  const camp = etat.camps[campIndex];
  // Les files tournent : deux casernes voisines ne versent pas dans la même.
  const voie = camp.prochaineVoie;
  camp.prochaineVoie = (voie + 1) % VOIES;
  etat.unites.push({
    id: etat.prochainId++,
    type,
    camp: campIndex,
    voie,
    position: placeLibre(etat, campIndex, voie, position),
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
      // L'unité sort de sa caserne, pas du château : une caserne avancée
      // économise à ses unités le trajet qui la sépare de la base.
      creer(etat, c, modele.produit, place.position);
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
    for (const place of etat.camps[c].emplacements) {
      if (place.restant > 0) continue;
      const modele = BATIMENTS[place.batiment];
      if (!modele.portee) continue;
      if (place.recharge > 0) {
        place.recharge--;
        continue;
      }

      // Depuis sa propre position, et non depuis le château : c'est ce qui
      // fait qu'une tour avancée couvre plus de terrain.
      const portee = modele.portee * modele.portee;
      let victime = null;
      let distance = Infinity;
      for (const unite of etat.unites) {
        if (unite.camp === c || unite.pv <= 0) continue;
        const d = distanceCarree(place, unite);
        if (d < distance) {
          distance = d;
          victime = unite;
        }
      }
      if (victime && distance <= portee) {
        place.recharge = modele.ticksParCoup;
        degats.set(victime.id,
          (degats.get(victime.id) ?? 0) + degatsRecus(modele.degats, victime.armure));
      }
    }
  }
}

/**
 * Le bâtiment adverse le plus proche et à portée, ou `null`.
 *
 * Les unités s'en prennent aux bâtiments **seulement quand aucune unité
 * ennemie n'est à portée** : autrement une armée s'arrêterait sur la première
 * caserne venue en laissant passer celle d'en face.
 */
function cibleBatiment(etat, unite) {
  const camp = etat.camps[adverse(unite.camp)];
  const portee = unite.portee * unite.portee;
  let meilleur = null;
  let distance = Infinity;
  for (const place of camp.emplacements) {
    if (place.restant > 0) continue;
    const d = distanceCarree(place, unite);
    if (d < distance) {
      distance = d;
      meilleur = place;
    }
  }
  return meilleur && distance <= portee ? meilleur : null;
}

/**
 * Jusqu'où une unité peut avancer sans monter sur celle de devant.
 *
 * On regarde la file, et seulement elle : l'unité la plus proche devant, amie
 * ou ennemie, fixe la limite à `ECART_MIN`. Personne ne double, personne ne
 * traverse — les figurines font la queue et le front devient une vraie ligne.
 *
 * Les distances sont mesurées sur les positions **du début du tick**
 * (`depart`), pas sur celles déjà modifiées : sinon l'ordre du parcours
 * déciderait qui avance, et deux exécutions pourraient diverger.
 */
function limiteDAvance(unite, file, s) {
  let ecart = Infinity;
  for (const autre of file) {
    if (autre.id === unite.id) continue;
    const devant = (autre.position - unite.position) * s;
    if (devant > 0 && devant < ecart) ecart = devant;
  }
  return ecart === Infinity ? Infinity : Math.max(0, ecart - ECART_MIN);
}

/**
 * Les unités : chercher une cible, sinon avancer — sans se chevaucher.
 *
 * Les dégâts sont accumulés puis appliqués d'un coup, pour que l'ordre du
 * parcours ne décide pas qui meurt en premier : deux unités qui s'achèvent
 * au même tick tombent toutes les deux.
 */
function combattre(etat) {
  const degats = new Map();
  /** Dégâts aux bâtiments, par « camp:index ». Appliqués en fin de tick. */
  const degatsBatis = new Map();
  const files = rangerParVoie(etat.unites);
  // Photographie des positions avant que quiconque bouge, rangée par file.
  const depart = files.map((file) => file.map((u) => ({
    id: u.id, position: u.position,
  })));

  for (const unite of etat.unites) {
    if (unite.pv <= 0) continue;
    if (unite.recharge > 0) unite.recharge--;

    const proie = cible(files, unite);
    if (proie) {
      if (unite.recharge === 0) {
        unite.recharge = unite.ticksParCoup;
        degats.set(proie.id,
          (degats.get(proie.id) ?? 0) + degatsRecus(unite.degats, proie.armure));
      }
      continue;
    }

    // Aucune unité à portée : on s'en prend au bâti. C'est le prix d'un
    // bâtiment avancé, et la seule chose qui empêche « toujours plus devant »
    // d'être gratuitement meilleur.
    const bati = cibleBatiment(etat, unite);
    if (bati) {
      if (unite.recharge === 0) {
        unite.recharge = unite.ticksParCoup;
        const cle = `${adverse(unite.camp)}:${bati.colonne}:${bati.rangee}`;
        const modele = BATIMENTS[bati.batiment];
        degatsBatis.set(cle, (degatsBatis.get(cle) ?? 0)
          + degatsRecus(unite.degats, modele.armure));
      }
      continue;
    }

    const s = sens(unite.camp);
    const arrivee = baseDe(adverse(unite.camp));
    const restant = Math.abs(arrivee - unite.position);

    // Devant le château : elle le cogne. Elle ne disparaît pas, et celles de
    // derrière font la queue — c'est le siège de la map d'origine.
    if (restant <= ECART_MIN) {
      if (unite.recharge === 0) {
        unite.recharge = unite.ticksParCoup;
        const ennemi = etat.camps[adverse(unite.camp)];
        ennemi.pvChateau = Math.max(0, ennemi.pvChateau - unite.degats);
      }
      continue;
    }

    const pas = Math.min(unite.vitesse, restant - ECART_MIN,
      limiteDAvance(unite, depart[unite.voie], s));
    if (pas > 0) unite.position += s * pas;
  }

  tirerDesTours(etat, degats);

  for (const unite of etat.unites) {
    const recu = degats.get(unite.id);
    if (recu) unite.pv -= recu;
  }
  etat.unites = etat.unites.filter((unite) => unite.pv > 0);

  appliquerDegatsAuBati(etat, degatsBatis);
}

/**
 * Encaisse les dégâts subis par les bâtiments et démolit ceux qui tombent.
 *
 * Un bâtiment détruit rend sa population : on peut reconstruire ailleurs, ce
 * qui rend une perte coûteuse sans être définitive.
 */
function appliquerDegatsAuBati(etat, degatsBatis) {
  if (degatsBatis.size === 0) return;
  for (let c = 0; c < etat.camps.length; c++) {
    const camp = etat.camps[c];
    const debout = [];
    for (const place of camp.emplacements) {
      const recu = degatsBatis.get(`${c}:${place.colonne}:${place.rangee}`);
      if (recu) place.pv -= recu;
      if (place.pv > 0) {
        debout.push(place);
        continue;
      }
      const modele = BATIMENTS[place.batiment];
      camp.population -= modele.population;
      if (modele.fournitPopulation) {
        camp.populationMax = Math.max(REGLES.populationInitiale,
          camp.populationMax - modele.fournitPopulation);
      }
    }
    if (debout.length !== camp.emplacements.length) camp.emplacements = debout;
  }
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
