/**
 * Les identifiants du jeu. Tout ce qui change d'un jeu à l'autre est ici.
 *
 * Ces valeurs sont publiques par nature : elles partent dans l'app, où
 * n'importe qui peut les lire. Les vrais secrets — clé de signature, compte
 * de service Google — ne vivent que dans les secrets GitHub.
 */

/** Clé publique RevenueCat (`goog_…`). Vide = pas d'achats, le jeu tourne. */
export const CLE_REVENUECAT = '';

/** Bloc d'annonces AdMob. Vide = pas de bannière. */
export const BLOC_BANNIERE = '';

export const PRODUITS = {
  SANS_PUB: 'sans_pub',
};

/**
 * Un droit RevenueCat par produit vendu.
 *
 * ⚠️ Un droit qui porte plusieurs produits est acquis dès qu'un **seul**
 * est acheté : y attacher tout le catalogue le débloquerait pour le prix du
 * moins cher.
 */
export const DROITS = {
  sans_pub: [PRODUITS.SANS_PUB],
};
