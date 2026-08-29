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
import { BATIMENTS, CATALOGUE, COLONNES_GRILLE, RANGEES_GRILLE, PAS_GRILLE }
  from '../moteur/donnees.js';
import { NOUS, profondeurRangee } from '../moteur/etat.js';
import { SPRITE_BATIMENT, echelle, visible, abscisseColonne } from './scene.js';
import { dessiner } from './dessin.js';
import { saisir, glisser, lacher, deplacer, recentrer, front } from './camera.js';

/** Les intentions du joueur en attente. La boucle les vide à chaque tick. */
const enAttente = [];

/**
 * Le bâtiment choisi et pas encore posé, ou `null`.
 *
 * Choisir puis toucher une case, plutôt que traîner du panneau jusqu'à la
 * carte : sur un téléphone le doigt masque ce qu'il déplace, et la carte défile
 * sous lui. En deux temps, on voit où on pose.
 */
let enPlacement = null;

/** Ce que la scène doit dessiner : la grille, et la case visée. */
export const placementEnCours = () => enPlacement;

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
      <button id="pause" class="menu-bouton" aria-label="Pause">⏸</button>
    </header>

    <div class="terrain">
      <canvas id="scene" class="scene"></canvas>
      <button id="recentrer" class="recentrer" hidden>⌖ Revenir à la bataille</button>
      <div id="placement" class="placement" hidden>
        <span>Touchez une case pour poser <b id="placement-quoi"></b></span>
        <button id="placement-annuler" class="secondaire">Annuler</button>
      </div>
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

    <dialog id="menu" class="menu">
      <h2 id="menu-titre">Partie en pause</h2>
      <div class="menu-actions">
        <button id="reprendre">Reprendre</button>
        <button id="recommencer" class="secondaire">Recommencer</button>
        <button id="voir-rapport" class="secondaire">Rapport de partie</button>
      </div>
    </dialog>

    <dialog id="rapport" class="rapport">
      <div class="achat-tete">
        <h2>Rapport de partie</h2>
        <button id="rapport-fermer" class="fermer" aria-label="Fermer">✕</button>
      </div>
      <p class="rapport-aide">Tout ce qui s'est passé, avec le numéro de
        version et le journal qui rejoue la partie. À coller tel quel.</p>
      <textarea id="rapport-texte" readonly spellcheck="false"></textarea>
      <button id="rapport-copier">Copier</button>
    </dialog>

    <dialog id="fin" class="fin">
      <h2 id="fin-titre"></h2>
      <p id="fin-detail"></p>
      <button id="rejouer">Rejouer</button>
      <button id="fin-rapport" class="secondaire">Rapport de partie</button>
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
      enPlacement = { batiment: cle, colonne: null, rangee: null };
      fermer(racine);
      racine.querySelector('#placement').hidden = false;
      racine.querySelector('#placement-quoi').textContent = modele.nom;
    });
    catalogue.append(carte);
  }

  racine.querySelector('#annuler').addEventListener('click', () => fermer(racine));

  // Toucher le terrain referme : c'est le geste attendu d'une feuille.
  racine.querySelector('#scene').addEventListener('pointerdown', () => {
    if (achat.open) fermer(racine);
  });

  racine.querySelector('#placement-annuler').addEventListener('click', () => {
    annulerPlacement(racine);
  });

  addEventListener('keydown', (e) => {
    if (raccourciBloque(e)) return;
    if (e.key === 'b' || e.key === 'B') ouvrir(racine);
    if (e.key === 'Escape') { fermer(racine); annulerPlacement(racine); }
  });

  return racine.querySelector('#scene');
}

/**
 * Le menu de pause : reprendre, recommencer, lire le rapport.
 *
 * L'interface ne sait pas mettre en pause ni redémarrer — elle appelle ce
 * qu'on lui donne. C'est `jeu.js` qui tient la boucle et l'horloge, et lui
 * seul ; ici on ne fait qu'écouter des boutons.
 *
 * @param actions.mettreEnPause  appelée quand le menu s'ouvre
 * @param actions.reprendre      appelée quand il se referme, quelle qu'en soit
 *                               la façon — bouton, Échap, clic hors du panneau
 * @param actions.recommencer    nouvelle partie
 * @param actions.redigerRapport rend le texte du rapport
 */
export function brancherMenu(racine, actions) {
  const menu = racine.querySelector('#menu');
  const rapport = racine.querySelector('#rapport');
  const texte = racine.querySelector('#rapport-texte');
  const recommencer = racine.querySelector('#recommencer');
  const copier = racine.querySelector('#rapport-copier');

  const ouvrirMenu = () => {
    // Partie finie : le panneau de fin a déjà la main, deux modales
    // superposées n'apprendraient rien à personne.
    if (menu.open || racine.querySelector('#fin').open) return;
    actions.mettreEnPause();
    armerRecommencer(recommencer, false);
    menu.showModal();
  };

  racine.querySelector('#pause').addEventListener('click', () => {
    if (menu.open) menu.close(); else ouvrirMenu();
  });
  racine.querySelector('#reprendre').addEventListener('click', () => menu.close());

  // `close` et pas le seul bouton : Échap et le clic hors du panneau ferment
  // aussi. Une partie qui resterait figée sans que rien ne le dise serait prise
  // pour un plantage.
  menu.addEventListener('close', () => {
    if (!rapport.open) actions.reprendre();
  });

  // Recommencer demande deux appuis. Pas de `confirm()` : bloqué dans certaines
  // WebViews, et l'à-peu-près d'un appui de trop coûterait la partie en cours.
  recommencer.addEventListener('click', () => {
    if (recommencer.dataset.arme !== 'oui') return armerRecommencer(recommencer, true);
    armerRecommencer(recommencer, false);
    menu.close();
    actions.recommencer();
  });

  const montrerRapport = () => {
    texte.value = actions.redigerRapport();
    copier.textContent = 'Copier';
    rapport.showModal();
  };
  racine.querySelector('#voir-rapport').addEventListener('click', montrerRapport);
  racine.querySelector('#fin-rapport').addEventListener('click', montrerRapport);
  racine.querySelector('#rapport-fermer').addEventListener('click', () => rapport.close());
  rapport.addEventListener('close', () => {
    if (!menu.open && !racine.querySelector('#fin').open) actions.reprendre();
  });

  copier.addEventListener('click', async () => {
    // `navigator.clipboard` demande un contexte sécurisé et n'existe pas
    // partout ; la sélection reste toujours possible à la main, d'où le repli
    // qui sélectionne tout plutôt que d'échouer en silence.
    try {
      await navigator.clipboard.writeText(texte.value);
      copier.textContent = 'Copié !';
    } catch {
      texte.focus();
      texte.select();
      copier.textContent = 'Copiez la sélection';
    }
  });

  addEventListener('keydown', (e) => {
    if (raccourciBloque(e) || (e.key !== 'p' && e.key !== 'P')) return;
    if (menu.open) menu.close(); else ouvrirMenu();
  });

  return { ouvrirMenu };
}

/** Une lettre tapée dans le rapport n'est pas un raccourci de jeu. */
const raccourciBloque = (e) =>
  e.target instanceof Element && e.target.closest('textarea, input');

function armerRecommencer(bouton, arme) {
  bouton.dataset.arme = arme ? 'oui' : 'non';
  bouton.textContent = arme ? 'Confirmer : tout perdre' : 'Recommencer';
  bouton.classList.toggle('danger', arme);
}

/** Remet l'interface à zéro pour une partie neuve. */
export function reinitialiser(racine) {
  fermer(racine);
  annulerPlacement(racine);
  const fin = racine.querySelector('#fin');
  if (fin.open) fin.close();
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

  let depart = null;
  toile.addEventListener('pointerdown', (e) => {
    toile.setPointerCapture(e.pointerId);
    depart = { x: e.clientX, y: e.clientY };
    saisir(camera, e.clientY, e.timeStamp);
  });
  toile.addEventListener('pointermove', (e) => {
    if (camera.saisie) glisser(camera, e.clientY, parPixel(), e.timeStamp);
    if (enPlacement) {
      const ou = caseSous(e.clientX, e.clientY, toile, camera);
      enPlacement.colonne = ou ? ou.colonne : null;
      enPlacement.rangee = ou ? ou.rangee : null;
    }
  });
  toile.addEventListener('pointerup', (e) => {
    lacher(camera);
    // Un appui bref pose ; au-delà de quelques pixels c'est un glissé de
    // caméra, et poser à l'endroit où le doigt s'est arrêté serait une surprise.
    const bouge = depart
      && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 8;
    depart = null;
    if (!enPlacement || bouge) return;
    const ou = caseSous(e.clientX, e.clientY, toile, camera);
    if (!ou) return;
    enAttente.push({ camp: NOUS, action: 'construire',
      batiment: enPlacement.batiment, colonne: ou.colonne, rangee: ou.rangee });
    annulerPlacement(racine);
  });
  toile.addEventListener('pointercancel', () => { depart = null; lacher(camera); });

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

function annulerPlacement(racine) {
  enPlacement = null;
  racine.querySelector('#placement').hidden = true;
}

/**
 * La case de la grille sous un point de l'écran, ou `null`.
 *
 * Tolérante : on vise la colonne la plus proche et la rangée la plus proche,
 * sans exiger de tomber pile dedans. Un doigt n'est pas un curseur.
 */
function caseSous(x, y, toile, camera) {
  const largeur = toile.clientWidth;
  const hauteur = toile.clientHeight;
  const ech = echelle(hauteur);

  let colonne = 0;
  let ecart = Infinity;
  for (let c = 0; c < COLONNES_GRILLE.length; c++) {
    const d = Math.abs(abscisseColonne(c, largeur) - x);
    if (d < ecart) { ecart = d; colonne = c; }
  }
  if (ecart > largeur * 0.28) return null;

  // De l'ordonnée écran vers la profondeur, puis vers la rangée.
  const profondeur = camera.position + (hauteur / 2 - y) / ech;
  const rangee = Math.round(profondeur / PAS_GRILLE) - 1;
  if (rangee < 0 || rangee >= RANGEES_GRILLE) return null;
  return { colonne, rangee };
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
  if (fin.open || racine.querySelector('#rapport').open) return;
  racine.querySelector('#fin-titre').textContent = gagne ? 'Gagné !' : 'Perdu…';
  racine.querySelector('#fin-detail').textContent = gagne
    ? 'Le château adverse est en miettes.'
    : 'Votre château est en miettes.';
  fin.showModal();
}
