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
import { SPRITE_BATIMENT, echelle } from './scene.js';
import { dessiner } from './dessin.js';
import { saisir, glisser, lacher, recentrer, front } from './camera.js';

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

export function construireInterface(racine, camera) {
  racine.innerHTML = `
    <header class="bandeau">
      <div class="chateau chateau--eux">
        <span class="etiquette">Château adverse</span>
        <span class="pv" id="pv-eux">—</span>
      </div>
    </header>

    <div class="terrain">
      <canvas id="scene" class="scene"></canvas>
      <button id="recentrer" class="recentrer" hidden>⌖ Revenir à la bataille</button>
    </div>

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
      <div class="achat-tete">
        <h2>Que construire ?</h2>
        <button id="annuler" class="fermer" aria-label="Fermer">✕</button>
      </div>
      <div id="catalogue" class="catalogue"></div>
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
    const carte = document.createElement('button');
    carte.className = 'carte';
    carte.dataset.batiment = cle;
    carte.append(vignette(cle));
    carte.insertAdjacentHTML('beforeend', `
      <span class="carte-nom">${modele.nom}</span>
      <span class="carte-prix">${modele.or} or · ${modele.population} pop</span>
      <span class="carte-aide">${modele.aide}</span>
    `);
    carte.addEventListener('click', () => {
      enAttente.push({
        camp: NOUS, action: 'construire',
        emplacement: emplacementVise, batiment: cle,
      });
      fermer(racine, camera);
    });
    catalogue.append(carte);
  }

  racine.querySelector('#annuler').addEventListener('click', () => fermer(racine, camera));

  // Toucher le terrain referme : c'est le geste attendu d'une feuille.
  racine.querySelector('#scene').addEventListener('pointerdown', () => {
    if (achat.open) fermer(racine, camera);
  });

  const emplacements = racine.querySelector('#emplacements');
  for (let i = 0; i < REGLES.emplacements; i++) {
    const bouton = document.createElement('button');
    bouton.className = 'emplacement';
    bouton.dataset.index = String(i);
    // Le clavier autant que le doigt : 1 à 6 ouvrent l'emplacement.
    bouton.title = `Emplacement ${i + 1} (touche ${i + 1})`;
    bouton.addEventListener('click', () => ouvrir(racine, camera, i));
    emplacements.append(bouton);
  }

  addEventListener('keydown', (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= REGLES.emplacements) ouvrir(racine, camera, n - 1);
    if (e.key === 'Escape') fermer(racine, camera);
  });

  return racine.querySelector('#scene');
}

/**
 * Les gestes de caméra : glisser pour regarder ailleurs, molette et flèches
 * pour la même chose au clavier, et un bouton pour revenir à la bataille.
 *
 * Rien de tout ça ne touche à l'état : la caméra est du décor, pas du jeu.
 */
export function brancherCamera(racine, toile, camera, obtenirEtat) {
  const bouton = racine.querySelector('#recentrer');

  /**
   * Combien de millipas vaut un pixel écran.
   *
   * Positif : augmenter `camera.position` fait descendre le décor, donc tirer
   * vers le bas révèle le terrain d'en face. C'est le geste attendu — on
   * attrape le monde, on ne pousse pas une fenêtre.
   */
  const parPixel = () => 1 / echelle(toile.clientHeight);

  toile.addEventListener('pointerdown', (e) => {
    toile.setPointerCapture(e.pointerId);
    saisir(camera, e.clientY);
  });
  toile.addEventListener('pointermove', (e) => {
    if (camera.saisie) glisser(camera, e.clientY, parPixel());
  });
  for (const fin of ['pointerup', 'pointercancel']) {
    toile.addEventListener(fin, () => lacher(camera, performance.now()));
  }

  toile.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Molette vers le bas : on descend vers sa propre base, comme une page.
    camera.cible -= e.deltaY * parPixel();
    lacher(camera, performance.now());
  }, { passive: false });

  addEventListener('keydown', (e) => {
    const pas = 40_000;
    if (e.key === 'ArrowUp') camera.cible += pas;
    else if (e.key === 'ArrowDown') camera.cible -= pas;
    else if (e.key === 'Home') return recentrer(camera, obtenirEtat());
    else return;
    e.preventDefault();
    lacher(camera, performance.now());
  });

  bouton.addEventListener('click', () => recentrer(camera, obtenirEtat()));

  return function rafraichirBouton(etat) {
    // Le bouton n'apparaît que si la caméra s'est vraiment écartée du front.
    const loin = Math.abs(camera.position - front(etat)) > toile.clientHeight
      / echelle(toile.clientHeight) / 2;
    bouton.hidden = !loin;
  };
}

/**
 * Ouvre le panneau d'achat.
 *
 * `show()` et non `showModal()` : le panneau est une feuille posée au-dessus du
 * terrain, pas un écran qui le remplace. On continue de voir la bataille — et
 * c'est souvent elle qui dit quoi acheter.
 *
 * La caméra est figée le temps du choix : sinon sa patience expire pendant
 * qu'on lit les cartes, et on retrouve un autre endroit en refermant.
 */
function ouvrir(racine, camera, index) {
  emplacementVise = index;
  camera.figee = true;
  racine.querySelector('#achat').show();
}

function fermer(racine, camera) {
  camera.figee = false;
  racine.querySelector('#achat').close();
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
