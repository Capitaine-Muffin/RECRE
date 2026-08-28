/**
 * L'interface : le bandeau du haut, la barre des bâtiments en bas, et le
 * panneau d'achat.
 *
 * En DOM plutôt qu'en canvas : les boutons sont alors de vrais boutons —
 * cibles tactiles confortables, focus au clavier, lisibles par un lecteur
 * d'écran — et le jeu reste jouable au clavier comme l'exige le modèle.
 *
 * Elle ne modifie pas l'état : elle empile des intentions que la boucle ira
 * chercher, exactement comme l'IA.
 */
import { BATIMENTS, CATALOGUE } from '../moteur/donnees.js';
import { NOUS } from '../moteur/etat.js';
import { SPRITE_BATIMENT, echelle, visible } from './scene.js';
import { dessiner } from './dessin.js';
import { saisir, glisser, lacher, deplacer, recentrer, front } from './camera.js';

/** Les intentions du joueur en attente. La boucle les vide à chaque tick. */
const enAttente = [];

/** Prend et vide la file. */
export function recolterIntentions() {
  return enAttente.splice(0, enAttente.length);
}

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
      <div id="batiments" class="batiments"></div>
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
      enAttente.push({ camp: NOUS, action: 'construire', batiment: cle });
      fermer(racine);
    });
    catalogue.append(carte);
  }

  racine.querySelector('#annuler').addEventListener('click', () => fermer(racine));

  // Toucher le terrain referme : c'est le geste attendu d'une feuille.
  racine.querySelector('#scene').addEventListener('pointerdown', () => {
    if (achat.open) fermer(racine);
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'b' || e.key === 'B') ouvrir(racine);
    if (e.key === 'Escape') fermer(racine);
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
    saisir(camera, e.clientY, e.timeStamp);
  });
  toile.addEventListener('pointermove', (e) => {
    if (camera.saisie) glisser(camera, e.clientY, parPixel(), e.timeStamp);
  });
  for (const fin of ['pointerup', 'pointercancel']) {
    toile.addEventListener(fin, () => lacher(camera));
  }

  toile.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Molette vers le bas : on descend vers sa propre base, comme une page.
    // ×3 : à un pour un, un cran ne déplaçait que 17 % d'écran et il en
    // fallait dix-huit pour traverser le terrain.
    deplacer(camera, -e.deltaY * parPixel() * 3);
  }, { passive: false });

  addEventListener('keydown', (e) => {
    // Une demi-tranche visible par appui : six appuis pour traverser le
    // terrain, au lieu de vingt-cinq.
    const pas = visible() / 2;
    if (e.key === 'ArrowUp') deplacer(camera, pas);
    else if (e.key === 'ArrowDown') deplacer(camera, -pas);
    else if (e.key === 'Home') return recentrer(camera, obtenirEtat());
    else return;
    e.preventDefault();
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
 * Le panneau ne touche pas à la caméra. Elle continue de suivre le front si le
 * joueur ne l'a jamais déplacée, et reste où il l'a mise s'il l'a fait — dans
 * les deux cas il retrouve en refermant ce qu'il avait en ouvrant.
 */
function ouvrir(racine) {
  racine.querySelector('#achat').show();
}

function fermer(racine) {
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

  // La barre liste ce qui est bâti, dans l'ordre, et se termine par le bouton
  // de construction. Elle est reconstruite quand le nombre change seulement.
  const barre = racine.querySelector('#batiments');
  if (barre.childElementCount !== nous.emplacements.length + 1) {
    barre.replaceChildren();
    for (const place of nous.emplacements) {
      const tuile = document.createElement('div');
      tuile.className = 'batiment';
      tuile.title = BATIMENTS[place.batiment].nom;
      tuile.append(vignette(place.batiment, 2));
      tuile.insertAdjacentHTML('beforeend', '<span class="chrono"></span>');
      barre.append(tuile);
    }
    const plus = document.createElement('button');
    plus.id = 'construire';
    plus.className = 'batiment batiment--plus';
    plus.title = 'Construire (touche B)';
    plus.textContent = '+';
    plus.addEventListener('click', () => ouvrir(racine));
    barre.append(plus);
  }

  nous.emplacements.forEach((place, i) => {
    const chrono = barre.children[i]?.querySelector('.chrono');
    if (!chrono) return;
    chrono.textContent = place.restant > 0 ? `${Math.ceil(place.restant / 10)} s` : '';
    chrono.hidden = place.restant === 0;
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
