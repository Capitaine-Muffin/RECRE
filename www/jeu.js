/**
 * Le jeu : assemble le moteur, le rendu et l'IA, et tient la boucle.
 *
 * C'est le seul fichier qui a le droit de regarder l'horloge. Il la convertit
 * en ticks et n'en parle jamais au moteur : la simulation, elle, ne connaît
 * que des pas fixes.
 */
import { MS_PAR_TICK } from './moteur/donnees.js';
import { nouvellePartie, NOUS, EUX } from './moteur/etat.js';
import { avancer } from './moteur/simulation.js';
import { nouveauJournal, noter } from './moteur/journal.js';
import { nouvelAdversaire, jouer } from './ia/adversaire.js';
import { dessinerScene, visible } from './rendu/scene.js';
import { nouvelleCamera, suivre, recentrer } from './rendu/camera.js';
import { construireInterface, brancherCamera, rafraichir, recolterIntentions,
  annoncerFin } from './rendu/interface.js';
import { CLE_REVENUECAT, DROITS, BLOC_BANNIERE, PRODUITS } from './config.js';

const SAUVEGARDE = 'recre.partie';

const racine = document.querySelector('#jeu');
const toile = construireInterface(racine);
const ctx = toile.getContext('2d');

// La caméra est du décor : elle ne rentre jamais dans l'état de la partie.
const camera = nouvelleCamera();
const rafraichirRecentrage = brancherCamera(racine, toile, camera, () => etat);

let etat;
let journal;
let ia;
let achats = [];

/** Le reliquat de temps réel pas encore converti en ticks. */
let reste = 0;
let derniereFrame = 0;

function demarrerPartie(graine = (Math.random() * 2 ** 32) >>> 0) {
  etat = nouvellePartie(graine);
  journal = nouveauJournal(graine);
  // L'IA a sa propre graine : ajouter un tirage chez elle ne doit pas décaler
  // la simulation.
  ia = nouvelAdversaire(graine ^ 0x5bf03635, 'normal');
  reste = 0;
  recentrer(camera, etat);
  camera.position = camera.cible;
  ranger();
}

function ranger() {
  try {
    localStorage.setItem(SAUVEGARDE, JSON.stringify({ etat, journal }));
  } catch {
    // Navigation privée, quota plein : on joue sans sauvegarde, c'est tout.
  }
}

function reprendre() {
  try {
    const brut = localStorage.getItem(SAUVEGARDE);
    if (!brut) return false;
    const { etat: e, journal: j } = JSON.parse(brut);
    if (!e || e.vainqueur !== null) return false;
    etat = e;
    journal = j;
    ia = nouvelAdversaire(j.graine ^ 0x5bf03635, 'normal');
    return true;
  } catch {
    return false;
  }
}

/** Ajuste la taille du canvas à l'écran, en tenant compte de la densité. */
function redimensionner() {
  const densite = Math.min(devicePixelRatio || 1, 3);
  const l = toile.clientWidth;
  const h = toile.clientHeight;
  toile.width = Math.round(l * densite);
  toile.height = Math.round(h * densite);
  ctx.setTransform(densite, 0, 0, densite, 0, 0);
}

function boucle(maintenant) {
  requestAnimationFrame(boucle);

  // Onglet en arrière-plan puis retour : on ne rattrape pas dix minutes de
  // simulation d'un coup, on repart de zéro sur le temps écoulé.
  const ecoule = Math.min(maintenant - derniereFrame, 250);
  derniereFrame = maintenant;
  reste += ecoule;

  let avance = false;
  while (reste >= MS_PAR_TICK) {
    reste -= MS_PAR_TICK;
    const intentions = [
      ...recolterIntentions(),
      ...jouer(ia, etat, EUX),
    ];
    noter(journal, etat.tick, intentions);
    avancer(etat, intentions);
    avance = true;
  }

  const largeur = toile.clientWidth;
  const hauteur = toile.clientHeight;
  suivre(camera, etat, maintenant, { visible: visible() });
  dessinerScene(ctx, etat, camera, {
    largeur, hauteur,
    zoom: Math.max(2, Math.round(largeur / 120)),
  });
  rafraichir(racine, etat);
  rafraichirRecentrage(etat);

  if (etat.vainqueur !== null) {
    annoncerFin(racine, etat.vainqueur === NOUS);
  } else if (avance && etat.tick % 50 === 0) {
    ranger();
  }
}

racine.querySelector('#rejouer').addEventListener('click', () => {
  racine.querySelector('#fin').close();
  demarrerPartie();
});

addEventListener('resize', redimensionner);
addEventListener('pagehide', ranger);

if (!reprendre()) demarrerPartie();
redimensionner();
derniereFrame = performance.now();
requestAnimationFrame(boucle);

demarrerMonetisation();

/**
 * Achats et publicités, via le paquet partagé — jamais réécrits ici.
 *
 * L'import est dynamique parce que `www/vendor/` n'existe qu'après
 * `npm run preparer` : en import statique, un dossier absent empêcherait le
 * module entier de se charger et le jeu ne démarrerait pas du tout. Là, il
 * tourne, sans achats ni bannière.
 */
async function demarrerMonetisation() {
  let achatsMod;
  let pubsMod;
  try {
    achatsMod = await import('./vendor/monetisation/achats.js');
    pubsMod = await import('./vendor/monetisation/pubs.js');
  } catch {
    console.info('Monétisation absente (npm run preparer) — le jeu tourne sans.');
    return;
  }

  await achatsMod.configurer({ cle: CLE_REVENUECAT, correspondances: DROITS });
  achats = achatsMod.appliquer(achats, await achatsMod.lireAchats());
  achatsMod.surAchatsChanges((produits) => { achats = produits; });

  const sansPub = achats.includes(PRODUITS.SANS_PUB);
  if (await pubsMod.demarrerPubs({ testeur: location.hostname === 'localhost' })) {
    await pubsMod.montrerBanniere({ bloc: BLOC_BANNIERE, sansPub });
  }
}
