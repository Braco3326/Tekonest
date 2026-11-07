# Mode Création : rapport de fin de Phase 5

Date : 2026-11-04. **Mise à jour du soir : la Phase 5 et le travail de nuit (L36 à L39 : durcissement, mise en page téléphone, passe de design, passe de texte) sont poussés (`feature/tekpractice-creative-mode` à `f3f3245`) et déployés** : https://tekonest.com/tekpractice/jouer/ (commit de déploiement du site `0742e42`, branche `design/tekonest-umbrella-brand`). Le build a été fait dans un dossier propre car `dist-site` est verrouillé sur ce PC (même commande Vite, mêmes nettoyages, garde de déploiement et test de fumée passés sur cette sortie). Restent à faire : le réaudit en ligne complet (CA-01 à CA-27), Safari/iOS, un vrai appareil tactile. Le texte ci-dessous décrit l'état de fin de Phase 5, avant la nuit.

Texte d'origine : état tout est construit, testé et relu **en local**. La branche `feature/tekpractice-creative-mode` était poussée jusqu'à `d50cea9` (essai local demandé par le fondateur) ; trois commits plus récents (`94a1255`, `a5df830`, `2925539`) restaient sur ce PC. **Rien n'était déployé en ligne pour la Phase 5** à ce moment-là. Les phases 0 à 4 sont en ligne depuis le 2026-10-29 (https://tekonest.com/tekpractice/jouer/).

## Ce que la Phase 5 apporte

| Pièce | Ce que ça fait | État |
|---|---|---|
| Page du site (43s) | La page TekPractice du site présente Mode Création : un lieu, du vrai matériel, le câblage, l'écoute (simulation simple), la couverture. Pas de promesse de chansons, pas de Safari/iOS. | Prête, **non poussée** (site, commits `bc22e28`, `7019677`) |
| Budgets et tests (43a) | Un contrôle de taille des fichiers (création 5,81 Mo, limite 6,69 Mo), des tests de repos (aucun rendu inutile), de fuites d'écouteurs et d'accessibilité (axe) sur six écrans. | Fait |
| Restes de l'audit (43b) | Touche **G** pour placer librement sans Alt ; bouton **« Annuler la pose »** (toucher/souris) ; **glisser-déposer** depuis le tiroir ; **« Écouter depuis ici »** ; la hauteur de scène était déjà gérée ; le compteur de console reste volontairement non construit. | Fait |
| Corrections de revue (43d) | Arbre Projet accessible (nom = texte affiché) ; **décodeur Draco servi par le site** (plus de requête vers un CDN tiers dans les sessions testées) ; **garde de clé API** : le build de déploiement (et la commande Vercel) refusent de tourner si une variable `VITE_*KEY/SECRET/TOKEN/PASSWORD…` existe. | Fait |
| Faces avant des modèles 3D (43c) | K12.2 et Genelec 8030C tournés vers l'avant, comme la direction acoustique ; les appareils tournés retombent exactement sur leur emplacement dans Mode Création ; prises sur la face arrière ; modèle de départ : QL1 à 0°. Le DBR12 reste non corrigé (son modèle est couché sur le côté), avec sa mention « face avant non vérifiée ». | Fait pour 2 enceintes sur 3 |

Chaque tâche est passée par une revue indépendante (et des rondes de correction), puis une revue de toute la phase (aucun point Critique).

## Chiffres du gate final (commit `2925539`, lancé le 2026-11-04)

`tsc` 0 erreur ; lint 0 ; catalogue valide ; vitest 164 fichiers / 2 407 tests ; build et budget OK ; Playwright création 354 passés (8 ignorés, 0 échec) ; tests historiques 110 passés (16 ignorés, 0 échec) ; `build:site` et `smoke:site` OK ; moteur (`src/engine`) inchangé.

## Ce qui change pour toi (note de version)

- **Anciens projets.** Le modèle « Concert simple (référence) » met maintenant la QL1 à 0° (prises côté scène). Un projet ou une sauvegarde de la phase 4 garde la QL1 à 180° : à la réouverture, ses prises regardent la caméra, et un clic au centre de la console (35 × 20 px à l'échelle par défaut) démarre un câble au lieu de la sélectionner. Remède : sélectionner la console par l'arbre Projet ou en zoomant, puis la tourner à 0°. Pas de migration automatique.
- Les appareils sauvegardés tournés se recentrent sur leur emplacement (jusqu'à 0,47 m de décalage corrigé).
- Le décodeur Draco (environ 250 Ko) vient maintenant du site lui-même, au lieu d'un CDN tiers.

## Ce qui reste ouvert (je ne l'ai pas décidé à ta place)

1. **Écoute humaine** (niveau, absence de clic, deux enceintes) et essai **Safari/iOS** : personne ne l'a fait. CA-03 n'est pas fermée.
2. **Chansons** : aucune livrée ; deux candidats (A et B) attendent ton accord avant tout téléchargement.
3. **DBR12** : il faut un tangage ou un roulis, pas un lacet : à régler avec les modèles reconstruits. **8030C** : s'affiche très petit (son pied compte dans la hauteur).
4. **Texte et look** : environ 200 chaînes « à valider (tekuxwriter) » ; regard de tekdesigner sur « Filtrer », les vignettes et les blocs couverture/Écoute.
5. **Limites connues** : zones de fosse traitées comme sol à hauteur 0 ; pas de compteur de console ; Draco et `aria-owns` vérifiés dans Chromium seulement (ni lecteur d'écran, ni Firefox, ni Safari, ni vrai appareil tactile) ; un `npm run build` lancé à la main n'est pas gardé contre une clé (voulu, c'est le build local).
6. **Fichiers à nettoyer** : `E:\tmp_t1.txt` et `E:\tmp_t2.txt` (restes d'un agent).

## Avant de pousser et de déployer (rien ne part sans ton go)

1. Ton go explicite.
2. Pousser la branche du jeu (les 3 commits restants) : aucun secret détecté dans les commits déjà poussés ; refaire l'analyse sur les 3 derniers avant de pousser (le dépôt est **public**).
3. `npm run build:site` dans un shell **sans** variable `VITE_*KEY` ni `.env` ; vérifier que le dossier `draco/` est dans `dist-site`.
4. Copier `dist-site` dans le worktree du site (`website-prototype/tekpractice/jouer/`) dans **son propre commit** ; ne pas inclure les trois SVG modifiés (`design/09-logo-nest/*`) ; la page du site (`bc22e28`, `7019677`) part avec ce lot.
5. **Vérifier quelle branche Cloudflare publie en production** : `design/tekonest-umbrella-brand` a 65 commits d'avance sur `main` ; pousser cette branche peut mettre en ligne du travail « umbrella » que tu n'as pas validé.
6. Après la mise en ligne : ré-audit en ligne de CA-01 à CA-27 (taille des fichiers < 25 Mio chacun : le plus gros fait 5,1 Mio).

## Où trouver quoi

Journal des décisions : `docs/CREATIVE-MODE-LOG.md` (L32 à L35 pour la Phase 5). Mode d'emploi pas à pas : `docs/TEKPRACTICE-CREATION-GUIDE.md` (non suivi par git). Registre des décisions et rapports de tâche : `.superpowers/sdd/2026-10-24-creative-mode/` (hors dépôt).
