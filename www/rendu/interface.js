/**
 * L'interface : le bandeau du haut, les emplacements du bas, le panneau
 * d'achat.
 *
 * En DOM plutôt qu'en canvas : les boutons sont alors de vrais boutons —
 * cibles tactiles confortables, focus au clavier, lisibles par un lecteur
 * d'écran — et le jeu reste jouable au clavier comme l'exige le modèle.
 *
 * Elle ne modifie pas l'état : elle empile des intentions que la boucle ira
 * chercher, exactement comme l'IA.
 */
import { BATIMENTS, CATALOGUE, REGLES } from '../moteur/donnees.js';
import { NOUS } from '../moteur/etat.js';
import { SPRITE_BATIMENT } from './scene.js';
import { dessiner } from './dessin.js';

/** Les intentions du joueur en attente. La boucle les vide à chaque tick. */
const enAttente = [];

/** Prend et vide la file. */
export function recolterIntentions() {
  return enAttente.splice(0, enAttente.length);
}

let emplacementVise = null;

/** Une vignette du bâtiment, dessinée — pas d'image à charger. */
function vignette(cle, taille = 3) {
  const sprite = SPRITE_BATIMENT[cle];
  const toile = document.createElement('canvas');
  toile.width = sprite[0].length * taille;
  toile.height = sprite.length * taille;
  dessiner(toile.getContext('2d'), sprite, toile.width / 2, toile.height, taille);
  toile.className = 'vignette';
  return toile;
}

export function construireInterface(racine) {
  racine.innerHTML = `
    <header class="bandeau">
      <div class="chateau chateau--eux">
        <span class="etiquette">Château adverse</span>
        <span class="pv" id="pv-eux">—</span>
      </div>
    </header>

    <canvas id="scene" class="scene"></canvas>

    <footer class="pupitre">
      <div class="compteurs">
        <span id="or" class="compteur compteur--or">0</span>
        <span id="pop" class="compteur">0/0</span>
        <span id="chantier" class="compteur compteur--alerte" hidden>
          chantier : revenu suspendu
        </span>
        <span class="compteur compteur--pv">
          mon château <b id="pv-nous">—</b>
        </span>
      </div>
      <div id="emplacements" class="emplacements"></div>
    </footer>

    <dialog id="achat" class="achat">
      <h2>Que construire ?</h2>
      <div id="catalogue" class="catalogue"></div>
      <button id="annuler" class="secondaire">Annuler</button>
    </dialog>

    <dialog id="fin" class="fin">
      <h2 id="fin-titre"></h2>
      <p id="fin-detail"></p>
      <button id="rejouer">Rejouer</button>
    </dialog>
  `;

  const achat = racine.querySelector('#achat');
  const catalogue = racine.querySelector('#catalogue');

  for (const cle of CATALOGUE) {
    const modele = BATIMENTS[cle];
    const bouton = document.createElement('button');
    bouton.className = 'carte';
    bouton.dataset.batiment = cle;
    bouton.append(vignette(cle));
    bouton.insertAdjacentHTML('beforeend', `
      <span class="carte-nom">${modele.nom}</span>
      <span class="carte-prix">${modele.or} or · ${modele.population} pop</span>
      <span class="carte-aide">${modele.aide}</span>
    `);
    bouton.addEventListener('click', () => {
      enAttente.push({
        camp: NOUS, action: 'construire',
        emplacement: emplacementVise, batiment: cle,
      });
      achat.close();
    });
    catalogue.append(bouton);
  }

  racine.querySelector('#annuler').addEventListener('click', () => achat.close());

  const emplacements = racine.querySelector('#emplacements');
  for (let i = 0; i < REGLES.emplacements; i++) {
    const bouton = document.createElement('button');
    bouton.className = 'emplacement';
    bouton.dataset.index = String(i);
    // Le clavier autant que le doigt : 1 à 6 ouvrent l'emplacement.
    bouton.title = `Emplacement ${i + 1} (touche ${i + 1})`;
    bouton.addEventListener('click', () => ouvrir(racine, i));
    emplacements.append(bouton);
  }

  addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= REGLES.emplacements) ouvrir(racine, n - 1);
    if (e.key === 'Escape') achat.close();
  });

  return racine.querySelector('#scene');
}

function ouvrir(racine, index) {
  emplacementVise = index;
  racine.querySelector('#achat').showModal();
}

/** Reflète l'état dans l'interface. Lecture seule, comme tout `rendu/`. */
export function rafraichir(racine, etat) {
  const nous = etat.camps[0];
  const eux = etat.camps[1];

  racine.querySelector('#or').textContent = `${nous.or} or`;
  racine.querySelector('#pop').textContent = `${nous.population}/${nous.populationMax} pop`;
  racine.querySelector('#pv-nous').textContent = nous.pvChateau;
  racine.querySelector('#pv-eux').textContent = eux.pvChateau;
  racine.querySelector('#chantier').hidden = !nous.enChantier;

  racine.querySelectorAll('.emplacement').forEach((bouton, i) => {
    const place = nous.emplacements[i];
    if (!place) {
      if (bouton.dataset.etat !== 'vide') {
        bouton.dataset.etat = 'vide';
        bouton.replaceChildren();
        bouton.insertAdjacentHTML('beforeend', '<span class="plus">+</span>');
      }
      return;
    }
    const cle = place.restant > 0 ? `${place.batiment}:chantier` : place.batiment;
    if (bouton.dataset.etat !== cle) {
      bouton.dataset.etat = cle;
      bouton.replaceChildren(vignette(place.batiment, 2));
      if (place.restant > 0) {
        bouton.insertAdjacentHTML('beforeend', '<span class="chrono"></span>');
      }
    }
    const chrono = bouton.querySelector('.chrono');
    if (chrono) chrono.textContent = `${Math.ceil(place.restant / 10)} s`;
  });

  // Griser ce qu'on ne peut pas s'offrir : la contrainte se voit avant le clic.
  racine.querySelectorAll('.carte').forEach((carte) => {
    const modele = BATIMENTS[carte.dataset.batiment];
    carte.disabled = nous.or < modele.or
      || nous.population + modele.population > nous.populationMax;
  });
}

export function annoncerFin(racine, gagne) {
  const fin = racine.querySelector('#fin');
  if (fin.open) return;
  racine.querySelector('#fin-titre').textContent = gagne ? 'Gagné !' : 'Perdu…';
  racine.querySelector('#fin-detail').textContent = gagne
    ? 'Le château adverse est en miettes.'
    : 'Votre château est en miettes.';
  fin.showModal();
}
