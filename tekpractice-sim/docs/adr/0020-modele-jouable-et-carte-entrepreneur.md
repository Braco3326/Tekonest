# ADR-0020 — Le paquet 5 démarre sur le modèle jouable ; la carte de l’entrepreneur est une ligne réservée, informative

- **Status:** Accepté par défaut — en attente de validation du fondateur (paquets d’accueil, 2026-11-13). Les textes de la section `ownGear` sont « à valider (tekuxwriter) ».
- **Sources :** spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (§3, §7.1, §7.2, §8.5, §11.10, erratum T6.3 / T6.4 du 2026-11-13) ; plan `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (T6.3, T6.4) ; `src/creation/onboarding/startRoom.ts`, `src/creation/onboarding/ownGear.ts`, `ownGearCard.ts`, `ownGear.css`, `src/design/packages.ts`, `src/guide/mount.ts`.

## Contexte

Le paquet 5 (« Modèle d’abord ») devait démarrer sur un banc déjà câblé et alimenté et dérouler trois étapes (le son, un débranchement, un rebranchement). Depuis la revue T3 il tournait sur les dix étapes standard dans la salle vide, son rythme n’étant qu’une donnée. Par ailleurs le profil 3 (entrepreneur) doit, après le premier son, apprendre que son matériel peut manquer à l’inventaire et voir des types de salle, sans qu’on invente un fait référentiel.

## Décision

### Le modèle jouable (T6.3)

- La salle de départ se lit dans le champ `layout.start` du paquet (`startRoomKey`) : `neutral-room` ouvre la carte `blank`, `playable-model` ouvre le modèle `premier-son-pret` par le chemin d’ouverture des modèles du sélecteur (la même `pick` que la carte du modèle : annonce, annulation, sauvegarde), et retombe sur la salle vide si le modèle manque. Aucun numéro de paquet n’est lu (le lint `noDesignBranching` reste vert).
- `tutorialSteps(pkg)` est le rythme du paquet pour tous : le repli sur les dix étapes disparaît. Le nombre d’étapes (écran de départ, fiche d’étape) vient de la même source.
- Le cadrage de la première salle du paquet 5 est une donnée du paquet (`modelFraming`), calculée contre la projection de la scène puis mesurée : le cadrage de la salle vide (cible au centre, rayon 2,2 m) ne montre que du sol sur ce modèle.
- L’aide « Je branche pour vous » n’est jamais proposée sur ce parcours et ne touche jamais un câble audio ; le débranchement n’est jamais fait pour l’apprenant. La réaction **audible** à un débranchement n’est pas vérifiée et aucun texte ne la décrit : `tutorial.debrancher` dit l’action et invite à observer (« Pendant l’écoute, débranchez le câble de la console vers l’une des enceintes, puis écoutez ce qui change. », revue T6 C2 ; l’ancien texte affirmait « cette enceinte se tait, l’autre continue »). Le test ne vérifie que le compte de voix de la simulation (`audioState().voices` : deux, puis une, puis deux), qui n’est jamais affiché.

### La carte de l’entrepreneur (T6.4)

- Due pour un profil dont la donnée `afterFirstSound` le dit, une fois qu’un son joue (le contrôleur d’écoute atteint `playing`), là où l’accueil est actif (jamais examen, jamais l’adresse simple), jusqu’à une fermeture mémorisée (`ownGear: 'dismissed'` dans `audio-sim/creation-onboarding.v1`, champ facultatif, aucune version changée).
- **Emplacement :** une ligne réservée de la grille de la coque juste au-dessus de la barre d’état (comme la ligne de la fiche d’étape, en haut) : elle ne recouvre rien (ni vue 3D, ni tiroir, ni panneaux, ni Oscar, dont les marges et les obstacles la lisent) ; elle ne prend à la vue que sa hauteur (un bandeau : au plus 120 px à 1366 px de large, borne vérifiée par les tests). Écartés : la barre d’état (28 px, déjà chargée de pastilles), les cartes du sélecteur de lieux (elles disparaissent dès qu’une salle est ouverte, et ce ne sont pas des salles), la liste de vérification (elle se cache quand le banc joue, c’est-à-dire quand la carte est due), une carte flottante (elle recouvrirait la vue, le tiroir ou Oscar, selon le coin d’Oscar du paquet).
- **Informative :** les trois types de salle n’ont aucun bouton. Aucune donnée ne relie un type de salle à une salle de l’application ; « Salle des fêtes » et « Bar-concert » ont des salles voisines par le nom, « Petite salle » n’en a pas une seule, et charger une salle remplace le banc. Un appui devrait inventer le lien ; un lien validé par le fondateur (donnée : type vers identifiant de salle) pourra rendre les cartes cliquables sans toucher au moteur.
- Une région nommée, pas de dialogue, pas de piège de focus, pas d’animation, pas de minuterie ; le seul contrôle est « Fermer », atteint par Tab après la barre d’état ; Échap n’est pas lu. Les couleurs sont des jetons de rôle dont les paires sont déjà déclarées (encre sur surface, encre atténuée sur surface pour le texte secondaire et les bordures, anneau de focus du paquet) : aucune paire ni couleur nouvelle.

## Conséquences

- Les tests épinglés qui supposaient une salle vide pour le paquet 5 (la fiche d’étape, la pastille de la liste, le contraste de la boîte « Connecter à… ») sont mis à jour dans leur mise en place seulement.
- Tant que la carte est affichée, la vue 3D perd sa hauteur (un bandeau) : le fondateur peut préférer une carte plus basse, ou la montrer une seule fois.
- Les enceintes du modèle sont sombres sur un fond sombre, et le SM58 n’est qu’un point à cette distance : le parcours se lit comme un ensemble (question de rendu 3D, non traitée ici).
