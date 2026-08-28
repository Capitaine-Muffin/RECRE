/**
 * Le catalogue : bâtiments, unités, constantes de la partie.
 *
 * Les valeurs viennent des maps Warcraft d'origine — voir
 * `data/catalog/spawner_economics.json` et `docs/01-analyse-systeme-wc3.md`.
 * Les noms, eux, sont neutres : ceux de l'original appartiennent à des tiers
 * (`docs/04-assets-et-propriete-intellectuelle.md`).
 *
 * Tout est en entiers. Les distances sont en **millipas** : la lane fait
 * `LANE` millipas d'une base à l'autre, et une unité avance de `vitesse`
 * millipas par tick.
 */

/** Durée d'un tick, en millisecondes. Le pas est fixe, jamais un deltaTime. */
export const MS_PAR_TICK = 100;

/** Longueur de la lane, en millipas. 1000 pas de 1000 millipas. */
export const LANE = 1_000_000;

/**
 * La taille d'une figurine à l'écran, exprimée en millipas.
 *
 * **Toutes les distances du jeu s'accrochent à celle-ci.** Sans référence
 * commune, la simulation et le dessin dérivent l'un de l'autre sans que rien
 * ne le signale : la première version valait 10 000, calculée en oubliant que
 * les sprites sont dessinés au zoom 3. Les unités se recouvraient de 64 % en
 * profondeur — elles ne faisaient pas la queue, elles s'empilaient, et une
 * armée qui montait vers la base adverse se lisait comme une bouillie
 * horizontale.
 *
 * Le calcul, pour un téléphone de 390 × 844 (canvas ≈ 595 de haut) :
 * une figurine fait 16 pixels de sprite au zoom 3, soit 48 px ; l'échelle vaut
 * `hauteur / (LANE × PART_VISIBLE)` = 595 / 340 000 ; d'où 48 / cette échelle
 * ≈ 27 000 millipas.
 */
export const TAILLE_FIGURINE = 27_000;

/**
 * Le nombre de files de front.
 *
 * La lane n'est pas un fil : c'est un couloir de `VOIES` files parallèles. Une
 * unité tient sa file du début à la fin et ne double personne.
 *
 * Seize, et non cinq : les figurines se recouvrent alors légèrement sur les
 * côtés, et c'est voulu. Une ligne de cinq n'est pas une armée, c'est une
 * patrouille ; à seize, on retrouve la masse qui traverse la cour. Le
 * chevauchement latéral reste lisible parce que les files voisines sont
 * décalées en profondeur au dessin (`rendu/scene.js`) : on voit une foule, pas
 * une bouillie.
 */
export const VOIES = 16;

/**
 * L'écart minimal entre deux unités d'une même file.
 *
 * Exactement une figurine : deux unités l'une derrière l'autre se touchent
 * sans se recouvrir. C'est ce qui fait qu'une armée en marche se lit comme des
 * rangs qui montent, et pas comme un tas.
 *
 * Le chevauchement qu'on accepte est latéral, jamais en profondeur.
 */
export const ECART_MIN = TAILLE_FIGURINE;

/**
 * L'écart entre deux files voisines, pour le calcul des portées.
 *
 * Il ne sert qu'aux portées : une attaque mesure sa distance en profondeur
 * **et** en largeur. Une unité de mêlée atteint alors trois files de chaque
 * côté, sur un front qui en fait seize : le corps à corps reste un contact
 * local, et il reste de la place au-dessus pour une unité qui tape loin —
 * c'est tout l'intérêt d'en avoir.
 *
 * Mesuré, pas deviné : sur 70 parties, une portée purement en profondeur donne
 * 26 % de matchs nuls, celle-ci 29 %, soit la même chose au bruit près. Quatre
 * fois plus large, en revanche, monte à 43 % : la mêlée n'atteint plus que ses
 * voisines immédiates et les deux armées se croisent sans se voir.
 */
export const ECART_VOIE = Math.round(TAILLE_FIGURINE * 0.35);

/**
 * La zone constructible, en millipas depuis sa propre base.
 *
 * Un bâtiment posé loin devant produit des unités plus près du front et, s'il
 * tire, couvre plus de terrain — mais il entre dans la portée des unités
 * adverses, qui le démolissent. C'est tout l'arbitrage du placement, et il
 * n'existe que parce que les trois vont ensemble : sortie des unités sur
 * place, tir depuis la position, et bâtiments attaquables.
 */
export const ZONE_CONSTRUCTIBLE = 380_000;

/** Le pas de la grille de construction, en profondeur. */
export const PAS_GRILLE = 46_000;

/** Les deux colonnes, de part et d'autre de la lane, en fraction de largeur. */
export const COLONNES_GRILLE = [0.085, 0.915];

/** Rangées disponibles, de la base vers le front. */
export const RANGEES_GRILLE = Math.floor(ZONE_CONSTRUCTIBLE / PAS_GRILLE);

export const REGLES = {
  orInitial: 20,
  /** +1 or toutes les 0,5 s dans l'original, soit 1 tous les 5 ticks. */
  ticksParOr: 5,
  orParVersement: 1,
  /** L'original produit toutes les 5 s. */
  ticksParProduction: 50,
  populationInitiale: 10,
  populationMax: 35,
  pvChateau: 10_000,
};

/**
 * Vitesse Warcraft (unités/s) → millipas par tick.
 *
 * Une unité à 300 — la vitesse courante dans les maps — traverse la lane en
 * une vingtaine de secondes, soit 200 ticks : 5000 millipas par tick.
 */
const vitesse = (vitesseWc3) => Math.round((vitesseWc3 * 50) / 3);

/**
 * Portées d'attaque.
 *
 * La mêlée doit dépasser `ECART_MIN`, et ce n'est pas un réglage : deux unités
 * qui se bloquent restent à `ECART_MIN` l'une de l'autre, donc une portée plus
 * courte les laisserait face à face sans pouvoir se toucher. Un cinquième de
 * marge suffit.
 */
const PORTEE_MELEE = Math.round(ECART_MIN * 1.22);
const PORTEE_TOUR = Math.round(ECART_MIN * 9);

/**
 * Les unités.
 *
 * `pv`, `degats` et `armure` sont ceux des maps. Les **cadences ne le sont
 * pas** : les maps n'écrasent presque jamais ce champ, il reste hérité de
 * l'unité Warcraft de base dont la table vit dans le client du jeu et pas dans
 * le `.w3x` (colonne `inherited` de `docs/generated/spawners.md`). Elles sont
 * donc posées ici, à l'équilibrage.
 */
export const UNITES = {
  petit_soldat: {
    nom: 'Petit Soldat',
    pv: 50, degats: 5, armure: 1,
    ticksParCoup: 12, portee: PORTEE_MELEE, vitesse: vitesse(270),
  },
  soldat_briques: {
    nom: 'Soldat de Briques',
    pv: 125, degats: 11, armure: 3,
    ticksParCoup: 15, portee: PORTEE_MELEE, vitesse: vitesse(270),
  },
  cavalier_briques: {
    nom: 'Cavalier de Briques',
    pv: 200, degats: 10, armure: 2,
    ticksParCoup: 13, portee: PORTEE_MELEE, vitesse: vitesse(350),
  },
};

/** Ce qu'on peut poser sur un emplacement. */
export const BATIMENTS = {
  caserne_soldats: {
    nom: 'Caserne des Petits Soldats',
    aide: 'Produit un Petit Soldat. Le moins cher, le plus fragile.',
    or: 15, population: 2, ticksConstruction: 200, produit: 'petit_soldat',
    pv: 500, armure: 2,
  },
  fort_briques: {
    nom: 'Fort en Briques',
    aide: 'Produit un Soldat de Briques. Le bon rapport encaisse/prix.',
    or: 20, population: 2, ticksConstruction: 350, produit: 'soldat_briques',
    pv: 650, armure: 3,
  },
  citadelle_briques: {
    nom: 'Citadelle en Briques',
    aide: 'Produit un Cavalier de Briques, rapide et coriace.',
    or: 40, population: 3, ticksConstruction: 400, produit: 'cavalier_briques',
    pv: 750, armure: 4,
  },
  tour: {
    nom: 'Tour de Défense',
    aide: 'Ne produit rien. Tire sur ce qui passe devant votre base.',
    or: 5, population: 0, ticksConstruction: 100,
    pv: 250, degats: 8, armure: 5, ticksParCoup: 10, portee: PORTEE_TOUR,
  },

  // Les deux réserves de population. Sans elles l'or n'a plus où aller une
  // fois la population saturée, et la partie cale : mesuré, 26 parties sur
  // 30 ne finissaient pas. Ce sont le Coffre à Jouet et le Goûter des maps
  // d'origine, aux mêmes prix.
  coffre_jouets: {
    nom: 'Coffre à Jouets',
    aide: '+5 places. Un emplacement dépensé ici est un emplacement en moins '
      + 'pour produire — c\'est tout l\'arbitrage.',
    or: 15, population: 0, fournitPopulation: 5, ticksConstruction: 150,
    pv: 300, armure: 1,
  },
  gouter: {
    nom: 'Goûter',
    aide: '+20 places, mais long à préparer. Le pari du début de partie.',
    or: 100, population: 0, fournitPopulation: 20, ticksConstruction: 400,
    pv: 700, armure: 2,
  },
};

/** Ordre d'affichage dans le panneau d'achat. */
export const CATALOGUE = [
  'caserne_soldats', 'fort_briques', 'citadelle_briques',
  'tour', 'coffre_jouets', 'gouter',
];
