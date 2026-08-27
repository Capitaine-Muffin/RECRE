/**
 * Le strict nécessaire pour parler à Google Play, partagé par les scripts
 * de `tools/`.
 *
 * Aucune dépendance : `fetch` et `crypto` suffisent. Ajouter `googleapis`
 * ferait entrer cent paquets pour trois appels HTTP.
 *
 * Le compte de service s'authentifie via `GOOGLE_PLAY_SERVICE_ACCOUNT` — le
 * contenu JSON lui-même, pas un chemin, pour qu'il vienne d'un secret
 * GitHub sans jamais toucher le disque.
 *
 * ⚠️ Ce compte doit être **distinct** de celui donné à RevenueCat : une clé
 * unique qui sait à la fois lire les achats et publier des versions est déjà
 * déposée chez un tiers.
 */

import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API = 'https://androidpublisher.googleapis.com';

/** La racine du dépôt, quel que soit l'endroit d'où le script est lancé. */
export function racine() {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

/**
 * Le nom de paquet vient du projet lui-même : le répéter en argument
 * ouvrirait la porte à publier un jeu sous l'identifiant d'un autre.
 *
 * Deux emplacements, pour que ces scripts servent aussi bien aux jeux
 * Capacitor de l'atelier qu'aux applications Expo plus anciennes.
 */
export function lireNomDePaquet() {
  const capacitor = path.join(racine(), 'capacitor.config.json');
  if (existsSync(capacitor)) {
    const config = JSON.parse(readFileSync(capacitor, 'utf8'));
    if (config.appId) return config.appId;
    throw new Error('capacitor.config.json ne contient pas appId.');
  }

  const expo = path.join(racine(), 'app.json');
  if (existsSync(expo)) {
    const paquet = JSON.parse(readFileSync(expo, 'utf8'))?.expo?.android?.package;
    if (paquet) return paquet;
    throw new Error("app.json ne contient pas expo.android.package.");
  }

  throw new Error('Ni capacitor.config.json ni app.json : impossible de savoir quel paquet publier.');
}

export function lireCompteDeService() {
  const brut = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!brut) {
    throw new Error(
      'La variable GOOGLE_PLAY_SERVICE_ACCOUNT est absente.\n' +
        'Elle doit contenir le JSON du compte de service, pas son chemin.',
    );
  }
  const compte = JSON.parse(brut);
  if (!compte.client_email || !compte.private_key) {
    throw new Error("Ce JSON n'est pas un compte de service Google.");
  }
  return compte;
}

/**
 * Échange la clé du compte de service contre un jeton d'accès.
 *
 * Google demande un JWT signé en RS256, que `crypto` sait produire.
 */
export async function obtenirJeton(compte) {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const charge = base64url(
    JSON.stringify({
      iss: compte.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: maintenant,
      exp: maintenant + 3600,
    }),
  );

  let signature;
  try {
    signature = base64urlDepuisBase64(
      createSign('RSA-SHA256').update(`${entete}.${charge}`).sign(compte.private_key, 'base64'),
    );
  } catch {
    // Cas le plus fréquent : le JSON a transité par un secret qui a mangé
    // les retours à la ligne de la clé. Le message brut de `crypto` ne le
    // dit pas du tout.
    throw new Error(
      'La clé privée du compte de service est illisible.\n' +
        'Les retours à la ligne de `private_key` ont probablement été perdus.',
    );
  }

  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${entete}.${charge}.${signature}`,
    }),
  });

  const corps = await reponse.json();
  if (!reponse.ok) {
    throw new Error(`Authentification refusée : ${corps.error_description ?? reponse.status}`);
  }
  return corps.access_token;
}

function base64url(texte) {
  return base64urlDepuisBase64(Buffer.from(texte).toString('base64'));
}

function base64urlDepuisBase64(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Un appel à l'API, qui jette un message lisible plutôt qu'un statut nu. */
export async function appeler(methode, chemin, jeton, corps) {
  const reponse = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${jeton}`,
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  });

  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`${methode} ${chemin} → ${reponse.status} ${detail.slice(0, 400)}`);
  }
  return reponse.status === 204 ? null : reponse.json();
}

/** Envoi d'un fichier brut (paquet, capture d'écran). */
export async function televerser(chemin, jeton, octets, type) {
  const reponse = await fetch(`${API}${chemin}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': type },
    body: octets,
  });

  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`Envoi refusé (${reponse.status}) : ${detail.slice(0, 400)}`);
  }
  return reponse.json();
}

/**
 * Ouvre une édition, exécute le travail, puis valide.
 *
 * Une édition laissée ouverte bloque les suivantes : en cas d'échec on la
 * referme avant de relayer l'erreur, sinon la tentative d'après échoue pour
 * une raison sans rapport avec le vrai problème.
 */
export async function dansUneEdition(paquet, jeton, travail) {
  const edition = await appeler('POST', `/androidpublisher/v3/applications/${paquet}/edits`, jeton);
  try {
    const resultat = await travail(edition.id);
    await appeler(
      'POST',
      `/androidpublisher/v3/applications/${paquet}/edits/${edition.id}:commit`,
      jeton,
    );
    return resultat;
  } catch (erreur) {
    await appeler(
      'DELETE',
      `/androidpublisher/v3/applications/${paquet}/edits/${edition.id}`,
      jeton,
    ).catch(() => {});
    throw erreur;
  }
}
