/**
 * Les sprites, en pixel art, écrits à la main.
 *
 * Chaque sprite est un tableau de lignes de même longueur ; chaque caractère
 * est une clé de `palette.js`, `.` étant transparent. C'est laid à lire et
 * délicieux à modifier : on voit le dessin dans le code, on change un
 * caractère, on recharge.
 *
 * Aucun fichier image, donc : rien à charger, rien qui manque hors ligne, et
 * un diff Git qui montre ce qui a changé sur le dessin.
 *
 * `tests/sprites.mjs` vérifie que toutes les lignes d'un sprite ont la même
 * longueur et que chaque caractère existe dans la palette — les fautes de
 * frappe dans un dessin de 24 lignes ne se voient pas à l'œil.
 */

/* ------------------------------------------------------------------ unités */
/* 24 lignes de haut, dessinées au zoom 2 : la figurine fait toujours 48 pixels
 * à l'écran, mais avec deux fois plus de pixels qu'en 16 × 16. C'est ce qui
 * permet une arme en travers du corps ou une tête de cheval reconnaissable —
 * en 16 × 16 tout se lisait comme une tache verte. `zoomUnite()`, dans
 * `scene.js`, en déduit le zoom : un sprite plus fin se dessine plus petit. */

/** Figurine de soldat en plastique vert : casque, fusil en travers, socle. */
export const PETIT_SOLDAT = [
  '........oooooooo........',
  '.......ooGGGGGGoo.......',
  '.......oGggGGGGGo.......',
  '......ooGGGGGGGGoo......',
  '......oGGGGGGGGGGo......',
  '.....ooooggggggooo......',
  '.....oooogoggogo........',
  '.....oooooggggoo........',
  '.....ooGooGGGGooooo.....',
  '.....oggGoggggggggo.....',
  '.....ogggGoggGGGggo.....',
  '.....oggggGoggggggo.....',
  '.....oggoggGoggggoo.....',
  '.....oGGGGGGGoGooo......',
  '.....ooooggggGooo.......',
  '.......ogggoogGoooo.....',
  '......oogggooggGGGo.....',
  '.....oogggooooggGoo.....',
  '...oooGGGGooooGGGGooo...',
  '...oooooooooooooooooo...',
  '...oGGGGGGGGGGGGGGGGo...',
  '...ooGGGGGGGGGGGGGGoo...',
  '....oooooooooooooooo....',
  '........................',
];

/** Bonhomme de briques : tenon sur la tête, bandoulière, mains en pince. */
export const SOLDAT_BRIQUES = [
  '..........oooo..........',
  '........oooHHooo........',
  '........oHHHHHHo........',
  '........oHHHHHHo........',
  '........oHoHHoHo........',
  '........oHHooHHo........',
  '........oJJJJJJo........',
  '........ooJJJJoo........',
  '....ooooorrrrrrooooo....',
  '....orrorwwrrrrrorro....',
  '....orrorrwwrrrrorro....',
  '....orrorrrwwrrrorro....',
  '....orrorrRRRRHrorro....',
  '....oHHoRRRRRRRRoHHo....',
  '....oHooBBBBBBBBooHo....',
  '....oooobbboobbboooo....',
  '.......obbboobbbo.......',
  '.......obbboobbbo.......',
  '.......obbboobbbo.......',
  '......oobbboobbboo......',
  '......oBBBBooBBBBo......',
  '......oooooooooooo......',
  '........................',
  '........................',
];

/** Le même, sur un cheval de briques. Plus large, il tient la place. */
export const CAVALIER_BRIQUES = [
  '.......oooo.................',
  '.....oooHHooo...............',
  '.....oHHHHHHo....ooooo......',
  '.....oHoHHoHo....onono......',
  '.....oHHHHHHo...oonono......',
  '....ooJJJJJJoo..oNnnnoo.....',
  '....orwwrrrrro.ooNnnnnoo....',
  '....orrwwrrrroooNononnnooo..',
  '....orrrwwrrrrrHNoonnnnnno..',
  '....orrrrwwrrooNonnnoNNNNo..',
  '....oRRRRRRRRoNonnnooooooo..',
  '..oooobbbbbboNonnnoo........',
  '.ooNNooobbbbBonnnoo.........',
  'ooNNonnnnnnnnnnnoo..........',
  'oNNonnnnnnnnnnnnno..........',
  'oNNonnnnnnnnnnnnno..........',
  'oNNooNNNNNNNNNNNoo..........',
  'ooNNonnonnoonnonno..........',
  '.oooonnonnoonnonno..........',
  '....onnonnoonnonno..........',
  '....onnonnoonnonno..........',
  '....onnonnoonnonno..........',
  '....oNNoNNooNNoNNo..........',
  '....oooooooooooooo..........',
];

/* --------------------------------------------------------------- bâtiments */
/* 24 × 24, posés sur leur base : la dernière ligne touche le sol. */

/** Tente de campement, drapeau planté sur le faîte. */
export const CASERNE_SOLDATS = [
  '........................',
  '...........oo...........',
  '..........orro..........',
  '..........orrrro........',
  '..........orrrro........',
  '..........orro..........',
  '..........oo............',
  '..........oo............',
  '........oooooo..........',
  '.......ooGGGGoo.........',
  '......ooGGGGGGoo........',
  '.....ooGGGGGGGGoo.......',
  '....ooGGGGGGGGGGoo......',
  '...ooGGGgggggggGGGoo....',
  '..ooGGGgoooooooogGGGoo..',
  '.ooGGGGgo......ogGGGGoo.',
  '.oGGGGGgo......ogGGGGGo.',
  '.oGGGGGgo......ogGGGGGo.',
  '.oGGGGGgo......ogGGGGGo.',
  '.oGGGGGgo......ogGGGGGo.',
  '.oGGGGGgo......ogGGGGGo.',
  '.ooooooooooooooooooooooo',
  '..oNNNNNNNNNNNNNNNNNNo..',
  '...oooooooooooooooooo...',
];

/** Fort de briques : créneaux, porte cintrée, deux rangées décalées. */
export const FORT_BRIQUES = [
  '........................',
  '........................',
  '...ooooo..oooo..ooooo...',
  '...orrro..orro..orrro...',
  '...orrro..orro..orrro...',
  '...oooooooooooooooooo...',
  '...orrrorrrrorrrrrrro...',
  '...orrrorrrrorrrrrrro...',
  '...oooooooooooooooooo...',
  '...orrrrorrrrorrrrrro...',
  '...orrrrorrrrorrrrrro...',
  '...oooooooooooooooooo...',
  '...orrrorrrrorrrrrrro...',
  '...orrrorrrrorrrrrrro...',
  '...ooooooohhhhooooooo...',
  '...orrrrrohhhhorrrrro...',
  '...orrrrrohhhhorrrrro...',
  '...orrrrrohhhhorrrrro...',
  '...orrrrrohhhhorrrrro...',
  '...orrrrrohhhhorrrrro...',
  '...orrrrrohhhhorrrrro...',
  '...oooooooooooooooooo...',
  '..oNNNNNNNNNNNNNNNNNNo..',
  '...oooooooooooooooooo...',
];

/** Citadelle : le fort, plus une tour d'angle et un fanion. */
export const CITADELLE_BRIQUES = [
  '...........oo...........',
  '...........orro.........',
  '...........orrrro.......',
  '...........orro.........',
  '...........oo...........',
  '........oooooooo........',
  '........obbbbbbo........',
  '........obccccbo........',
  '........obccccbo........',
  '..ooooo.oooooooo.ooooo..',
  '..obbbo.obbbbbbo.obbbo..',
  '..obbbo.obbbbbbo.obbbo..',
  '..oooooooooooooooooooo..',
  '..obbbbbbbbbbbbbbbbbbo..',
  '..obbbobbbbbbbbbbobbbo..',
  '..oooooooooooooooooooo..',
  '..obbbbbboooooobbbbbbo..',
  '..obbbbbbonnnnobbbbbbo..',
  '..obbbbbbonncnobbbbbbo..',
  '..obbbbbbonnnnobbbbbbo..',
  '..obbbbbbonnnnobbbbbbo..',
  '..oooooooooooooooooooo..',
  '.oNNNNNNNNNNNNNNNNNNNNo.',
  '..oooooooooooooooooooo..',
];

/** Tour de guet en cubes empilés, avec une lunette au sommet. */
export const TOUR = [
  '........................',
  '..........oo............',
  '.........okko...........',
  '........okkkko..........',
  '.......ooooooo..........',
  '......oHHHHHHHo.........',
  '......oHocccoHo.........',
  '......oHocccoHo.........',
  '......oHHHHHHHo.........',
  '......ooooooooo.........',
  '.......obbbbbo..........',
  '.......obbbbbo..........',
  '.......ooooooo..........',
  '.......orrrrro..........',
  '.......orrrrro..........',
  '.......ooooooo..........',
  '......oHHHHHHHo.........',
  '......oHHHHHHHo.........',
  '......ooooooooo.........',
  '.....obbbbbbbbbo........',
  '.....obbbbbbbbbo........',
  '.....ooooooooooo........',
  '....oNNNNNNNNNNNo.......',
  '.....ooooooooooo........',
];

/** Coffre à jouets, couvercle ouvert, un ballon et un ourson dépassent. */
export const COFFRE_JOUETS = [
  '........................',
  '........................',
  '.....oo.................',
  '....ohho....oooo........',
  '...ohhhho..orrrro.......',
  '...ohoohho.orwwrro......',
  '...ohhhhho.orrrrro......',
  '....ohhho..orrrro.......',
  '.....ooo....oooo........',
  '..oooooooooooooooooo....',
  '.onnnnnnnnnnnnnnnnno....',
  '.onNNNNNNNNNNNNNNNno....',
  '.oooooooooooooooooooo...',
  '.onnnnnnnnnnnnnnnnnno...',
  '.onHHHnnnnHHHnnnnHHno...',
  '.onHHHnnnnHHHnnnnHHno...',
  '.onnnnnnnnnnnnnnnnnno...',
  '.onnnnokkkkonnnnnnnno...',
  '.onnnnokKKkonnnnnnnno...',
  '.onnnnokkkkonnnnnnnno...',
  '.onnnnnnnnnnnnnnnnnno...',
  '.oooooooooooooooooooo...',
  '..oNNNNNNNNNNNNNNNNo....',
  '...oooooooooooooooo.....',
];

/** Le goûter : nappe, brique de jus, biscuits. Ça remplit le ventre. */
export const GOUTER = [
  '........................',
  '........................',
  '..........oo............',
  '.........okko...........',
  '........ooooooo.........',
  '........obbbbbo.........',
  '........obwwwbo.........',
  '........obwHwbo.........',
  '..ooo...obwwwbo...ooo...',
  '.onnno..obbbbbo..onnno..',
  'onnhnno.obbbbbo.onnhnno.',
  'onhnhno.ooooooo.onhnhno.',
  'onnhnno.........onnhnno.',
  '.onnno...........onnno..',
  '..ooo.............ooo...',
  'oowwwwwwwwwwwwwwwwwwwwoo',
  'owwddwwwwddwwwwddwwwwwwo',
  'owwwwwwwwwwwwwwwwwwwwwwo',
  'oooooooooooooooooooooooo',
  '..oNo..............oNo..',
  '..oNo..............oNo..',
  '..oNo..............oNo..',
  '..ooo..............ooo..',
  '........................',
];

/* ----------------------------------------------------------------- château */
/* 32 × 24. Le seul objet qu'on regarde mourir, il a droit à plus de place. */

export const CHATEAU_SABLE = [
  '...............oo...............',
  '...............orro.............',
  '...............orrrro...........',
  '...............orro.............',
  '...............oo...............',
  '...ooooo.....oooooo.....ooooo...',
  '...ossso.....osssso.....ossso...',
  '...osSso.....osSSso.....osSso...',
  '...ossso.....osssso.....ossso...',
  '..oooooooooooooooooooooooooooo..',
  '..osssssssssssssssssssssssssso..',
  '..ossSsssssSsssssSsssssSssssso..',
  '..osssssssssssssssssssssssssso..',
  '..oooooooooooooooooooooooooooo..',
  '..osssssssssoooooooossssssssso..',
  '..osssssssssoNNNNNNossssssssso..',
  '..ossSssssssoNNNNNNossssSsssso..',
  '..osssssssssoNNNNNNossssssssso..',
  '..osssssssssoNNNNNNossssssssso..',
  '..osssssssssoNNNNNNossssssssso..',
  '..oooooooooooooooooooooooooooo..',
  '.oSSSSSSSSSSSSSSSSSSSSSSSSSSSSo.',
  '.oSSSSSSSSSSSSSSSSSSSSSSSSSSSSo.',
  '.oooooooooooooooooooooooooooooo.',
];

/* ---------------------------------------------------------------- enfants */
/* 16 × 20. Grosse tête, petit corps : la proportion qui fait « enfant ». */

/** Le Mioche — celui du joueur. Blond, tee-shirt rouge, air content. */
export const MIOCHE = [
  '................',
  '.....oooooo.....',
  '....oHHHHHHo....',
  '...oHHHHHHHHo...',
  '...oHeeeeeeHo...',
  '...oeeoeeoeeo...',
  '...oeeoeeoeeo...',
  '...oeeeeeeeeo...',
  '...oeEeooeEeo...',
  '....oeeeeeeo....',
  '.....oooooo.....',
  '...ooorrrrooo...',
  '..oeeorrrroeeo..',
  '..oeeorrrroeeo..',
  '..ooooRrrRoooo..',
  '.....obbbbo.....',
  '.....obooboo....',
  '.....obooboo....',
  '....oeeooeeo....',
  '....oooooooo....',
];

/** Le Morveux — celui d'en face. Brun, tee-shirt bleu, l'air moins commode. */
export const MORVEUX = [
  '................',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '...ohhhhhhhho...',
  '...oheeeeeeho...',
  '...oeeoeeoeeo...',
  '...oeeoeeoeeo...',
  '...oeeeeeeeeo...',
  '...oeEoooooEo...',
  '....oeeeeeeo....',
  '.....oooooo.....',
  '...ooobbbbooo...',
  '..oeeobbbboeeo..',
  '..oeeobbbboeeo..',
  '..ooooBbbBoooo..',
  '.....oGGGGo.....',
  '.....oGooGoo....',
  '.....oGooGoo....',
  '....oeeooeeo....',
  '....oooooooo....',
];

/**
 * La Maîtresse.
 *
 * Elle ne sert à rien à l'étape 1 — elle arrive à l'étape 2, quand un enfant
 * meurt et se fait emmener au coin. Elle est dessinée maintenant parce qu'elle
 * fixe l'échelle : plus haute que les enfants, c'est ce qui les fait paraître
 * petits.
 */
export const MAITRESSE = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '....ohhhhhhho...',
  '....oheeeeho....',
  '....oeeoeoeo....',
  '....oeeoeoeo....',
  '....oeeeeeeo....',
  '....oeEoooEo....',
  '.....oeeeeo.....',
  '......oooo......',
  '...oooppppooo...',
  '..oeeoppppoeeo..',
  '..oeeoppppoeeo..',
  '..ooooppppoooo..',
  '...oPppppppPo...',
  '...oPppppppPo...',
  '...oPppppppPo...',
  '...oPPPPPPPPo...',
  '....oooooooo....',
];
