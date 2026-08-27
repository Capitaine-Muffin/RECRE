/**
 * Configure la fiche du magasin, les produits payants et leurs prix, sans
 * ouvrir la Play Console.
 *
 *   node tools/store.mjs              tout ce que `store.json` décrit
 *   node tools/store.mjs --essai      montre ce qui serait fait, sans rien faire
 *   node tools/store.mjs --seulement fiche|produits|paiements
 *
 * C'est la partie longue de la publication : une heure de saisie et de
 * clics, à refaire pour chaque jeu, où une case oubliée ne se voit qu'au
 * refus de l'envoi. Tout est ici décrit une fois dans `store.json` et
 * rejouable autant de fois qu'on veut — relancer met à jour, ne duplique
 * rien.
 *
 * Ce qui reste manuel, faute d'API chez Google : créer l'application dans
 * Play Console, les questionnaires obligatoires (âge, données, publicité),
 * et l'application côté AdMob. Environ trente minutes, une fois par jeu.
 * Voir https://github.com/Capitaine-Muffin/publier-sur-play
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  appeler,
  dansUneEdition,
  lireCompteDeService,
  lireNomDePaquet,
  obtenirJeton,
  racine,
  televerser,
} from './google-play.mjs';

const ETAPES = ['fiche', 'produits', 'paiements'];

const args = process.argv.slice(2);
const essai = args.includes('--essai');
const seulement = valeurDe('--seulement');

if (seulement && !ETAPES.includes(seulement)) {
  echouer(`--seulement attend ${ETAPES.join(', ')}`);
}

const config = lireConfig();
const paquet = lireNomDePaquet();

console.log(`${paquet}${essai ? '   (essai : rien ne sera modifié)' : ''}\n`);

const jeton = essai ? null : await obtenirJeton(lireCompteDeService());

try {
  if (faire('fiche') && config.fiche) await poserLaFiche();
  if (faire('produits') && config.produits?.length) await poserLesProduits();
  if (faire('paiements') && config.paiements) await poserLesPaiements();
  console.log('\nTerminé.');
} catch (erreur) {
  console.error(`\nÉchec : ${erreur.message}`);
  process.exit(1);
}

// ------------------------------------------------------------------ la fiche

/**
 * Textes et images de la fiche, langue par langue.
 *
 * Les images sont remplacées en bloc : Play n'a pas de « mettre à jour la
 * capture numéro 3 », et un ajout sans suppression préalable empilerait les
 * anciennes à côté des nouvelles.
 */
async function poserLaFiche() {
  console.log('Fiche du magasin');

  for (const [langue, textes] of Object.entries(config.fiche.textes ?? {})) {
    console.log(`  ${langue} : ${textes.titre}`);
    verifierLongueur(langue, textes);
  }

  // On liste tout avant de se plaindre : voir les huit images manquantes d'un
  // coup vaut mieux que d'en découvrir une à chaque relance.
  const manquantes = [];
  for (const [type, fichiers] of Object.entries(config.fiche.images ?? {})) {
    const liste = Array.isArray(fichiers) ? fichiers : [fichiers];
    const absentes = liste.filter((f) => !existsSync(path.join(racine(), f)));
    manquantes.push(...absentes);
    console.log(
      `  ${type} : ${liste.length} fichier·s` +
        (absentes.length ? `   — ${absentes.length} manquant·s` : ''),
    );
  }
  if (manquantes.length) {
    throw new Error(['Images introuvables :', ...manquantes.map((f) => `  ${f}`)].join('\n'));
  }

  if (essai) return;

  await dansUneEdition(paquet, jeton, async (edition) => {
    const base = `/androidpublisher/v3/applications/${paquet}/edits/${edition}`;

    for (const [langue, textes] of Object.entries(config.fiche.textes ?? {})) {
      await appeler('PUT', `${base}/listings/${langue}`, jeton, {
        language: langue,
        title: textes.titre,
        shortDescription: textes.resume,
        fullDescription: textes.description,
      });
    }

    const langueDesImages = config.fiche.langueDesImages ?? 'fr-FR';
    for (const [type, fichiers] of Object.entries(config.fiche.images ?? {})) {
      await appeler('DELETE', `${base}/listings/${langueDesImages}/${type}`, jeton).catch(() => {});
      for (const fichier of Array.isArray(fichiers) ? fichiers : [fichiers]) {
        await televerser(
          `/upload${base}/listings/${langueDesImages}/${type}?uploadType=media`,
          jeton,
          readFileSync(path.join(racine(), fichier)),
          fichier.endsWith('.jpg') || fichier.endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
        );
      }
    }
  });
}

/**
 * Play tronque sans prévenir au-delà de ces longueurs, et refuse l'envoi
 * au-delà de la description. Autant le voir ici.
 */
function verifierLongueur(langue, textes) {
  const limites = { titre: 30, resume: 80, description: 4000 };
  for (const [champ, limite] of Object.entries(limites)) {
    const valeur = textes[champ] ?? '';
    if (valeur.length > limite) {
      throw new Error(`${langue} : « ${champ} » fait ${valeur.length} caractères, maximum ${limite}.`);
    }
  }
}

// --------------------------------------------------------------- les produits

/**
 * Crée ou met à jour les produits payants.
 *
 * ⚠️ Le prix envoyé à Google est **hors taxes**, alors que le prix qu'on a
 * en tête est celui que le joueur paie. Saisir 0,99 donne 1,19 € à
 * l'affichage, et on cherche longtemps pourquoi. On écrit donc le prix TTC
 * dans `store.json` et la conversion se fait ici.
 *
 * `autoConvertMissingPrices` laisse Google fixer les autres monnaies :
 * c'est ce qui évite de saisir 170 pays à la main.
 */
async function poserLesProduits() {
  console.log('\nProduits');

  const tvaParDefaut = config.tva ?? 0.2;
  const existants = essai ? [] : await listerProduits();

  for (const produit of config.produits) {
    const tva = produit.tva ?? tvaParDefaut;
    const micros = Math.round((produit.prixTTC / (1 + tva)) * 1e6);
    const affiche = `${produit.prixTTC.toFixed(2)} € TTC → ${(micros / 1e6).toFixed(3)} € HT`;
    const connu = existants.includes(produit.id);

    // En essai on n'a pas interrogé Play : annoncer « création » serait faux
    // pour un produit qui existe déjà.
    console.log(`  ${essai ? 'prévu      ' : connu ? 'mise à jour' : 'création  '} ${produit.id} — ${affiche}`);
    if (essai) continue;

    const corps = {
      packageName: paquet,
      sku: produit.id,
      status: 'active',
      // « managedUser » : un achat définitif, pas un abonnement. C'est ce que
      // vend l'atelier, et c'est aussi ce que le code d'achat interroge.
      purchaseType: 'managedUser',
      defaultLanguage: produit.langue ?? 'fr-FR',
      defaultPrice: { priceMicros: String(micros), currency: produit.monnaie ?? 'EUR' },
      listings: {
        [produit.langue ?? 'fr-FR']: { title: produit.titre, description: produit.description },
      },
    };

    const chemin = `/androidpublisher/v3/applications/${paquet}/inappproducts`;
    if (connu) {
      await appeler('PUT', `${chemin}/${produit.id}?autoConvertMissingPrices=true`, jeton, corps);
    } else {
      await appeler('POST', `${chemin}?autoConvertMissingPrices=true`, jeton, corps);
    }
  }
}

async function listerProduits() {
  const reponse = await appeler(
    'GET',
    `/androidpublisher/v3/applications/${paquet}/inappproducts`,
    jeton,
  );
  return (reponse?.inappproduct ?? []).map((p) => p.sku);
}

// -------------------------------------------------------------- les paiements

/**
 * Déclare les mêmes produits dans RevenueCat, et leur donne un droit chacun.
 *
 * ⚠️ Un droit qui porte plusieurs produits est acquis dès qu'**un seul** est
 * acheté : y attacher tout le catalogue le débloquerait pour le prix du
 * moins cher. D'où un droit par produit, ce que ce script garantit.
 *
 * La clé secrète vient de `REVENUECAT_SECRET_KEY` et ne doit jamais être
 * commitée — c'est une clé `sk_`, différente de la clé publique `goog_` que
 * le jeu embarque.
 */
async function poserLesPaiements() {
  console.log('\nPaiements (RevenueCat)');

  const cle = process.env.REVENUECAT_SECRET_KEY;
  if (!cle && !essai) {
    throw new Error(
      'REVENUECAT_SECRET_KEY est absente.\n' +
        'La clé secrète `sk_` se lit dans RevenueCat → Project settings → API keys.',
    );
  }

  const { projet, application } = config.paiements;
  for (const produit of config.produits ?? []) {
    console.log(`  ${produit.id} → droit « ${produit.droit ?? produit.id} »`);
  }
  if (essai) return;

  const api = async (methode, chemin, corps) => {
    const reponse = await fetch(`https://api.revenuecat.com/v2${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cle}`,
        ...(corps ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    });
    const texte = await reponse.text();
    // 409 : l'objet existe déjà. Relancer le script doit rester sans effet,
    // pas échouer — c'est ce qui permet de le rejouer après une correction.
    if (reponse.status === 409) return null;
    if (!reponse.ok) throw new Error(`RevenueCat ${methode} ${chemin} → ${reponse.status} ${texte.slice(0, 300)}`);
    return texte ? JSON.parse(texte) : null;
  };

  const produitsExistants = new Map(
    ((await api('GET', `/projects/${projet}/products`))?.items ?? []).map((p) => [
      p.store_identifier,
      p.id,
    ]),
  );
  const droitsExistants = new Map(
    ((await api('GET', `/projects/${projet}/entitlements`))?.items ?? []).map((d) => [
      d.lookup_key,
      d.id,
    ]),
  );

  for (const produit of config.produits ?? []) {
    const droit = produit.droit ?? produit.id;

    const cree = await api('POST', `/projects/${projet}/products`, {
      store_identifier: produit.id,
      app_id: application,
      type: 'one_time',
    });
    const idProduit = cree?.id ?? produitsExistants.get(produit.id);

    const droitCree = await api('POST', `/projects/${projet}/entitlements`, {
      lookup_key: droit,
      display_name: produit.titre,
    });
    const idDroit = droitCree?.id ?? droitsExistants.get(droit);

    if (idProduit && idDroit) {
      await api('POST', `/projects/${projet}/entitlements/${idDroit}/actions/attach_products`, {
        product_ids: [idProduit],
      });
    }
  }
}

// ------------------------------------------------------------------ outillage

function faire(etape) {
  return !seulement || seulement === etape;
}

function valeurDe(option) {
  const index = args.indexOf(option);
  return index === -1 ? null : args[index + 1] ?? null;
}

function lireConfig() {
  const chemin = path.join(racine(), 'store.json');
  if (!existsSync(chemin)) {
    echouer(
      'store.json est absent.\n' +
        "C'est lui qui décrit la fiche, les produits et les prix. Un exemple\n" +
        'commenté se trouve dans docs/BUILD.md.',
    );
  }
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (erreur) {
    echouer(`store.json est illisible : ${erreur.message}`);
  }
}

function echouer(message) {
  console.error(message);
  process.exit(1);
}
