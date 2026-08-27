# Les images de la fiche

`npm run store` envoie ce dossier vers Google Play. Les noms sont ceux que
`store.json` désigne — les changer là, pas ici.

| Fichier | Taille attendue | Rôle |
|---|---|---|
| `icone-512.png` | 512 × 512 | l'icône de la fiche, pas celle de l'app |
| `banniere-1024x500.png` | 1024 × 500 | le bandeau en haut de la fiche |
| `capture-*.png` | 1080 × 1920 conseillé | 2 à 8 captures, toutes dans le même sens |

Play refuse une taille qui ne correspond pas exactement, et refuse une
fiche qui a moins de deux captures.

Le plus simple pour les fabriquer : ouvrir le jeu dans un navigateur, régler
la fenêtre sur 1080 × 1920, et capturer. Pas besoin de téléphone.

⚠️ Ne pas y mettre de faux avis, de fausses notes, ni de mentions
« numéro 1 » : Google refuse la fiche, et c'est long à rattraper.
