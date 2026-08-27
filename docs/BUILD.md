# Fabriquer l'`.aab`

La fabrication dépend de la techno ; ce document est donc propre à ce jeu.
Ce qui touche au Store — produits, prix, déclarations, examen — est commun
et vit dans
[publier-sur-play](https://github.com/Capitaine-Muffin/publier-sur-play).

## En temps normal : ne rien faire à la main

```bash
git tag v1.0.1 && git push --tags
```

La CI fabrique, vérifie et envoie en test interne. Pour une autre piste :
onglet *Actions* → *Publier sur Google Play* → **Run workflow**.

C'est la voie à privilégier, et pas seulement par confort : le runner Linux
est propre à chaque fois, là où une machine de développement accumule des
états qui font passer un build et rater le suivant.

## En local, pour déboguer

```bash
npm install
npm run preparer          # recopie la monétisation dans www/vendor/
npx cap sync android
cd android && ./gradlew app:bundleRelease
```

## Ce que la CI vérifie avant de publier

Elle compare le `jeu.js` embarqué dans l'`.aab` à celui du dépôt et refuse
de publier s'ils diffèrent.

Ce garde-fou vient d'une mésaventure réelle : Gradle avait jugé l'étape de
préparation « à jour » et embarqué une version périmée du code. Le fichier
paraissait neuf, s'installait sans erreur, et la version publiée n'avait
aucune des corrections. Rien ne le signalait.

## Deux règles

- **Ne jamais faire confiance à un `.aab` sur sa seule date.** Vérifier ce
  qu'il contient.
- Le `versionCode` doit être **strictement supérieur** au dernier envoyé.
  La CI le calcule à partir du numéro de run : ne pas l'écrire à la main.
  Si des versions ont été envoyées avant la mise en place de la CI, relever
  `BASE_VERSION_CODE` dans le workflow pour repasser au-dessus.
