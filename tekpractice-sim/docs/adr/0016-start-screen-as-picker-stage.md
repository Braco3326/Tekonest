# ADR-0016 — L’écran de départ est une étape du sélecteur de lieu, sous `?design` seulement

- **Status:** Accepté par défaut — en attente de validation du fondateur (paquets d’accueil, 2026-11-12). Rédaction française : brouillon, les textes de l’écran sont « à valider (tekuxwriter) ».
- **Sources :** spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (§2, §3, §4, §5) ; plan `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (T2.1 à T2.5) ; ADR-0013 (Mode Création par défaut).

## Contexte

La première visite doit demander une situation (quatre profils) puis proposer le tutoriel, sans jamais gêner le jeu tel qu’il est aujourd’hui. Deux faits du code décident de la forme :

1. `mountPlacePicker` rend `inert` les trois zones qu’il couvre (`shell.tree`, `shell.viewport`, `shell.props`) dans `show()` et les rend toutes non `inert` dans `hide()`. Un second recouvrement serait effacé par ce `hide()`.
2. Environ 45 specs e2e de Mode Création (44 fichiers `creation-*`, une cinquantaine de fichiers avec un `goto('/')`) ouvrent `/` et attendent le sélecteur de lieu sur une page neuve : elles sont la garde de non-régression.

## Décision

### Une étape du même sélecteur (un seul propriétaire de `inert`)

L’écran de départ (`src/creation/onboarding/startScreen.ts`) est un panneau **à l’intérieur de la même `section`** du sélecteur. `showStart()` cache l’en-tête et les grilles et montre le panneau ; « Tous les lieux » revient aux grilles ; un choix (profil, puis offre) appelle le même chemin d’ouverture que le clic sur une carte (`pick(blank, 'empty')`), qui ferme le sélecteur par `showCanvas()`. Le sélecteur reste le seul à poser et lever `inert`.

- **Échap propre à l’étape.** Celui du sélecteur est conditionné par `closable`, faux à la première visite : l’étape gère Échap elle-même (profil : « Tous les lieux » ; offre : « Passer, je connais »). Les chiffres 1 à 4 sont lus par position (`Digit1`, `Numpad1`), donc sûrs en AZERTY.
- **Le dialogue de confirmation** (« Salle vide / Avec le matériel ») appelle `setInert` sur son en-tête et ses grilles ; le panneau de départ est dans cet ensemble.
- **Montage paresseux.** Le panneau n’est créé qu’au premier `showStart` : sans `?design`, aucun nœud `start-screen` n’est dans la page (e2e : 0).
- **Rouvrir par la pastille.** La pastille « Profil : X · changer » (barre d’état) rouvre l’étape. Au-dessus d’un projet ouvert, le choix applique le profil sans remplacer la salle ; « Tous les lieux » donne alors des grilles fermables (`PickerStartOpts.closable`).

### Sous `?design` seulement

L’écran, les profils, la pastille et Aide › « Premiers pas » n’existent que sous `?design=1..5` (adresse seule, jamais stocké). Sans `?design` : le sélecteur d’aujourd’hui, aucun nœud, aucune clé lue ou écrite (`audio-sim/creation-onboarding.v1`). Promouvoir un paquet en défaut est une décision ultérieure du fondateur. Les 45 specs `/` restent la garde.

### Quand l’écran existe, et ce qu’il écrit (revue T2, décisions R-A et R-B)

`main.ts` calcule deux portes et les passe à `bootCreation({ onboarding, tutorialAllowed })` (la création n’importe pas le guide) : `onboarding` = mode pratique (aucun paramètre `mode`) ; `tutorialAllowed` = mode pratique et le guide peut tourner (pas `?oscar=0`). Manquant = faux (fermé par défaut, comme la porte de mode du guide).

- **Adresse d’examen** (tout `?mode=` ; un paramètre `level` ou `legacy` va vers la route historique) : l’onboarding est **entièrement éteint** — ni écran, ni enregistrement, ni pastille, ni cadrage, ni changement de panneaux ou de tiroir ; le sélecteur d’aujourd’hui. Les examens restent silencieux.
- **`?oscar=0`** : l’étape « profil » reste (spec §4.2), **l’offre n’est pas dans la page** (pas seulement cachée), un choix de profil est **final** (profil écrit, `offer` reste `null`), et Aide n’a pas « Premiers pas ».
- **Le profil s’écrit AVEC la réponse** (profil + offre ensemble) et seulement une fois la salle ouverte : quitter l’écran (« Tous les lieux », Échap, une salle qui ne s’ouvre pas) n’écrit rien, donc la prochaine visite normale redemande, et la requête `tutorial` ne part jamais sans salle pour la démarrer. Un profil dont l’offre n’a jamais été répondue (première visite sur `?oscar=0`) reçoit l’**offre** pour ce profil à la première adresse où le tutoriel est permis. Rouverte par la pastille, la touche Échap sur l’offre quitte sans rien changer.
- **La pastille** : « Profil : X · changer » une fois un profil enregistré, « Choisir un profil » sinon (la phrase « Vous pourrez changer de profil à tout moment » reste vraie). Aide › « Premiers pas » attend (grisé, avec sa raison) tant que l’écran de départ est ouvert.
- **Code paresseux** : l’écran, la mise en place (`firstVisit`) et le cadrage sont des chunks chargés seulement sous `?design` en mode pratique ; le budget du bundle de création baisse de quelques octets par rapport à avant (voir le rapport T2-fix).

### Appliquer le profil à la première salle

Après l’ouverture de la salle vide neutre (`blank`, « Salle vide neutre », 24 × 14 m, sans lieu réel nommé) : panneaux latéraux (ceux du profil, ou ceux du paquet actif pour `panels: 'package'`), tiroir d’inventaire sur l’onglet du profil sans déplacer le focus (le focus reste sur la vue 3D, spec §4.3), puis le cadrage.

### Cadrage de la première salle

`framing` du paquet actif via `host.rig.flyToPreset` (aucun changement de moteur), appliqué **seulement** après un choix de l’écran de départ ou Aide › « Premiers pas » sans lieu ouvert ; jamais sur `/`, jamais sur une salle déjà ouverte, jamais par « Tous les lieux ». La mesure a corrigé l’estimation du spec : à 7 m le SM58 fait environ 19 px (boîte de son volume), pas 40 ; il en faut environ 3 m. Comme la taille à l’écran suit la hauteur du canevas, le rayon du paquet est celui d’un canevas de 600 px, mis à l’échelle par la hauteur réelle (`framing.ts`, jamais sous la limite basse de 2 m de l’orbite) : pose retenue rayon 2,2 m, bêta 1,1, cible au sol au centre. Tenu à 1366 × 768 et à 1366 × 650 (canevas d’environ 590 px) : un SM58 à moins de 0,9 m en largeur et 0,5 m en profondeur du point au sol sous le milieu de la vue (là où le produit démarre une pose) fait au moins 44 px sur son plus grand axe (mesure : boîte à l’écran des huit coins du volume englobant, pas un comptage de pixels de la silhouette). Valeurs et mesures : `src/design/packages.ts` (`firstSoundFraming`), `tests/e2e/onboarding-framing.spec.ts`.

## Conséquences

- Une seule étape à tester pour `inert`, Échap et le focus ; les deux anciennes façons d’ouvrir le sélecteur restent intactes.
- L’écran de départ ne fait aucune promesse de durée (« étapes, à votre rythme »).
- Un stockage bloqué garde l’enregistrement en mémoire : l’écran peut se représenter à la visite suivante (dit, accepté).
- La pastille et le cadrage dépendent du paquet actif : T4.3 (dispositions) pourra changer la hauteur du canevas ; le rayon n’en dépend pas (l’angle de champ est vertical), la visibilité latérale oui.

## Alternatives écartées

- **Un second recouvrement** : son `inert` serait levé par le `hide()` du sélecteur.
- **Un écran avant le jeu, sans lien avec le sélecteur** : double propriétaire de `inert`, double gestion du focus.
- **Montrer l’écran partout** : casserait la quarantaine de specs `/` et le comportement d’aujourd’hui sans accord du fondateur.
