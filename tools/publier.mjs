/**
 * Envoie un `.aab` sur Google Play, sans ouvrir la console.
 *
 * Remplace la séquence manuelle qui prend dix minutes et se rate
 * silencieusement : créer une version, glisser le fichier, coller les
 * notes, prévisualiser, enregistrer, aller dans la vue d'ensemble,
 * envoyer pour examen.
 *
 *   node tools/publier.mjs <chemin.aab> --piste internal --notes notes.txt
 *
 * Pistes possibles : `internal` (par défaut, se propage en quelques
 * minutes), `alpha`, `beta`, `production`.
 *
 * La fiche du magasin, les produits et les prix se posent avec
 * `tools/store.mjs`. L'authentification est dans `tools/google-play.mjs`.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  appeler,
  dansUneEdition,
  lireCompteDeService,
  lireNomDePaquet,
  obtenirJeton,
  televerser,
} from './google-play.mjs';

const PISTES = ['internal', 'alpha', 'beta', 'production'];

const args = process.argv.slice(2);
const cheminAab = args[0];
const piste = valeurDe('--piste') ?? 'internal';
const cheminNotes = valeurDe('--notes');

if (!cheminAab || cheminAab.startsWith('--')) {
  echouer('Usage : node tools/publier.mjs <chemin.aab> [--piste internal] [--notes notes.txt]');
}
if (!existsSync(cheminAab)) echouer(`Fichier introuvable : ${cheminAab}`);
if (!PISTES.includes(piste)) {
  echouer(`Piste inconnue : ${piste}. Choisir parmi ${PISTES.join(', ')}.`);
}

try {
  const paquet = lireNomDePaquet();
  const notes = cheminNotes ? readFileSync(cheminNotes, 'utf8').trim() : null;

  console.log(`Publication de ${path.basename(cheminAab)} sur ${paquet} → piste ${piste}`);

  const jeton = await obtenirJeton(lireCompteDeService());

  await dansUneEdition(paquet, jeton, async (edition) => {
    const base = `/androidpublisher/v3/applications/${paquet}/edits/${edition}`;

    // Le `.aab` part en une seule requête, sur l'hôte d'envoi de Google.
    const bundle = await televerser(
      `/upload${base}/bundles?uploadType=media`,
      jeton,
      readFileSync(cheminAab),
      'application/octet-stream',
    );
    console.log(`Envoyé : versionCode ${bundle.versionCode}`);

    await appeler('PUT', `${base}/tracks/${piste}`, jeton, {
      track: piste,
      releases: [
        {
          versionCodes: [String(bundle.versionCode)],
          status: 'completed',
          ...(notes ? { releaseNotes: [{ language: 'fr-FR', text: notes }] } : {}),
        },
      ],
    });
  });

  console.log(`Publié sur ${piste}. L'examen de Google démarre maintenant.`);
} catch (erreur) {
  console.error(`\nÉchec : ${erreur.message}`);
  process.exit(1);
}

/** La valeur qui suit une option, ou `null` si l'option est absente. */
function valeurDe(option) {
  const index = args.indexOf(option);
  return index === -1 ? null : args[index + 1] ?? null;
}

function echouer(message) {
  console.error(message);
  process.exit(1);
}
