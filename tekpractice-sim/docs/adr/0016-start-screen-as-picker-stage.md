# ADR-0016 — L’écran de départ est une étape du sélecteur de lieu, sous `?design` seulement

- **Status:** Accepté par défaut — en attente de validation du fondateur (paquets d’accueil, 2026-11-12). Rédaction française : brouillon, les textes de l’écran sont « à valider (tekuxwriter) ».
- **Sources :** spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (§2, §3, §4, §5) ; plan `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (T2.1 à T2.5) ; ADR-0013 (Mode Création par défaut).

## Contexte

La première visite doit demander une situation (quatre profils) puis proposer le tutoriel, sans jamais gêner le jeu tel qu’il est aujourd’hui. Deux faits du code décident de la forme :

1. `mountPlacePicker` rend `inert` les trois zones qu’il couvre (`shell.tree`, `shell.viewport`, `shell.props`) dans `show()` et les rend toutes non `inert` dans `hide()`. Un second recouvrement serait effacé par ce `hide()`.
2. 45 specs e2e de Mode Création ouvrent `/` et attendent le sélecteur de lieu sur une page neuve : elles sont la garde de non-régression.

## Décision

### Une étape du même sélecteur (un seul propriétaire de `inert`)

L’écran de départ (`src/creation/onboarding/startScreen.ts`) est un panneau **à l’intérieur de la même `section`** du sélecteur. `showStart()` cache l’en-tête et les grilles et montre le panneau ; « Tous les lieux » revient aux grilles ; un choix (profil, puis offre) appelle le même chemin d’ouverture que le clic sur une carte (`pick(blank, 'empty')`), qui ferme le sélecteur par `showCanvas()`. Le sélecteur reste le seul à poser et lever `inert`.

- **Échap propre à l’étape.** Celui du sélecteur est conditionné par `closable`, faux à la première visite : l’étape gère Échap elle-même (profil : « Tous les lieux » ; offre : « Passer, je connais »). Les chiffres 1 à 4 sont lus par position (`Digit1`, `Numpad1`), donc sûrs en AZERTY.
- **Le dialogue de confirmation** (« Salle vide / Avec le matériel ») appelle `setInert` sur son en-tête et ses grilles ; le panneau de départ est dans cet ensemble.
- **Montage paresseux.** Le panneau n’est créé qu’au premier `showStart` : sans `?design`, aucun nœud `start-screen` n’est dans la page (e2e : 0).
- **Rouvrir par la pastille.** La pastille « Profil : X · changer » (barre d’état) rouvre l’étape. Au-dessus d’un projet ouvert, le choix applique le profil sans remplacer la salle ; « Tous les lieux » donne alors des grilles fermables (`PickerStartOpts.closable`).

### Sous `?design` seulement

L’écran, les profils, la pastille et Aide › « Premiers pas » n’existent que sous `?design=1..5` (adresse seule, jamais stocké). Sans `?design` : le sélecteur d’aujourd’hui, aucun nœud, aucune clé lue ou écrite (`audio-sim/creation-onboarding.v1`). Promouvoir un paquet en défaut est une décision ultérieure du fondateur. Les 45 specs `/` restent la garde.

### Où le guide ne peut pas tourner

`main.ts` calcule `tutorialAllowed` (`guideRouteAllowed` + `guideMode === 'practice'` : ni `?oscar=0`, ni adresse d’examen, `?mode=` quelconque compris) et le passe à `bootCreation({ tutorialAllowed })` : la création n’importe pas le guide. Quand il est faux, l’étape « profil » reste (spec §4.2), **l’offre n’est pas dans la page** (pas seulement cachée), un choix de profil est **final** (profil stocké, `offer` reste `null`, `request` reste 0), et Aide n’a pas « Premiers pas ». Manquant = faux (fermé par défaut, comme la porte de mode du guide).

### Appliquer le profil à la première salle

Après l’ouverture de la salle vide neutre (`blank`, « Salle vide neutre », 24 × 14 m, sans lieu réel nommé) : panneaux latéraux (ceux du profil, ou ceux du paquet actif pour `panels: 'package'`), tiroir d’inventaire sur l’onglet du profil sans déplacer le focus (le focus reste sur la vue 3D, spec §4.3), puis le cadrage.

### Cadrage de la première salle

`framing` du paquet actif via `host.rig.flyToPreset` (aucun changement de moteur), appliqué **seulement** après un choix de l’écran de départ ou Aide › « Premiers pas » sans lieu ouvert ; jamais sur `/`, jamais sur une salle déjà ouverte, jamais par « Tous les lieux ». La mesure a corrigé l’estimation du spec : 7 m donnent environ 19 px au SM58, pas 40 ; il faut environ 3 m ; la pose retenue est à 2,7 m (au-dessus de la limite basse de 2 m de l’orbite). Valeurs et mesures : `src/design/packages.ts` (`firstSoundFraming`), `tests/e2e/onboarding-framing.spec.ts`.

## Conséquences

- Une seule étape à tester pour `inert`, Échap et le focus ; les deux anciennes façons d’ouvrir le sélecteur restent intactes.
- L’écran de départ ne fait aucune promesse de durée (« étapes, à votre rythme »).
- Un stockage bloqué garde l’enregistrement en mémoire : l’écran peut se représenter à la visite suivante (dit, accepté).
- La pastille et le cadrage dépendent du paquet actif : T4.3 (dispositions) pourra changer la hauteur du canevas ; le rayon n’en dépend pas (l’angle de champ est vertical), la visibilité latérale oui.

## Alternatives écartées

- **Un second recouvrement** : son `inert` serait levé par le `hide()` du sélecteur.
- **Un écran avant le jeu, sans lien avec le sélecteur** : double propriétaire de `inert`, double gestion du focus.
- **Montrer l’écran partout** : casserait les 45 specs `/` et le comportement d’aujourd’hui sans accord du fondateur.
