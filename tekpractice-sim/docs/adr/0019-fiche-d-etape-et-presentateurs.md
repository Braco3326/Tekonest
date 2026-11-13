# ADR-0019 — La fiche d’étape dans une ligne réservée, la liste de vérification en panneau, les raccourcis à côté des commandes

- **Status:** Accepté par défaut — en attente de validation du fondateur (paquets d’accueil, 2026-11-13). Les textes de la section `tutorialCard` sont « à valider (tekuxwriter) ».
- **Sources :** spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (§6.3, §6.4, §6.6, §7.1, §7.2, §9, §11.1 à §11.3, erratum T6 du 2026-11-13) ; plan `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (T6.1, T6.2) ; `src/design/tutorialSlot.ts`, `src/guide/stepCard.ts`, `src/guide/stepCard.css`, `src/guide/tutorial.ts`, `src/guide/mount.ts`, `src/creation/shell/checklist.ts`, `src/creation/onboarding/wire.ts`, `src/creation/shell/creation.css`, `src/design/packages.css`.

## Contexte

Le premier son de l’apprenant ne doit pas dépendre de la lecture de la bulle d’Oscar. Il faut un présentateur de progression calme, qui ne recouvre rien (ni la vue 3D, ni le tiroir, ni les panneaux, ni Oscar), qui ne demande aucun focus et ne répète pas la consigne de la bulle. Les lignes de fin (`closingLines()`) n’étaient affichées nulle part (revue G8, S2 / C2). La liste « Pourquoi je n’entends rien ? » doit être, selon le paquet, une pastille ou un panneau permanent. `src/creation/**` n’importe jamais `src/guide/**`.

## Décision

### La ligne réservée (`src/design/tutorialSlot.ts`)

- Un module **neutre** (`src/design`, importé par le guide et par la coque, aucun n’important l’autre) crée et retire `[data-testid="tutorial-slot"]`, **dernier enfant** de la racine de la coque (ses boutons viennent donc après la barre d’état dans l’ordre de tabulation, spec §4.3), et pose `data-tutorial="on"` sur la racine. La feuille de la coque (`creation.css`) fait de cet attribut une ligne de la grille entre la barre de menus et le reste ; le sélecteur de lieux (`.cr-pick`) descend d’une ligne avec les panneaux.
- La ligne n’existe **que pendant un tutoriel** : adresse sans `?design`, examen, `?oscar=0` : jamais. « Passer le tutoriel » retire la ligne à l’instant et la libère. Ni rôle de dialogue, ni piège de focus, ni animation, rien d’inerte.
- Écart avec le plan (qui nommait `layout.ts`) : le guide doit pouvoir ouvrir et fermer la ligne sans importer la coque (CSS comprise) ; l’élément est donc créé par ce module neutre, et `layout.ts` n’a pas changé.
- Ouverture et fermeture envoient un événement `resize` à la fenêtre : la grille a bougé, le widget fourni relit ses marges et ses obstacles et remet Oscar au repos hors de la ligne, le cube de vue se remesure. Aucun écouteur nouveau (les existants l’entendent). La ligne entière est un obstacle de `hostObstacles` et son bas compte dans la marge haute de `hostInsets`.

### La fiche (`src/guide/stepCard.ts`, `stepCard.css`)

- **Progression seulement :** « Étape k sur n » (n = les étapes du parcours, donc 10 pour les cinq paquets tant que T6.3 n’a pas construit le modèle jouable), une marque par étape (faite, en cours, à venir, « passée », « montré », « déjà en place »), « Passer le tutoriel » (`tutorialUi.skip`, une source avec Aide). Jamais la phrase de la bulle, jamais « réussi », aucun chiffre hors k et n.
- Les marques se distinguent par la forme (contour plein, pointillé, double ; coche, tiret, losange, signe égal dessinés en SVG) et jamais par la couleur seule ; une légende n’apparaît que si une marque en demande une. Chaque marque a son texte caché (« Étape 3 : passée »).
- Région nommée (`tabindex="-1"` : Aide › « Reprendre à l’étape k » la focalise, `firstVisit.ts` sans importer le guide). Elle suit les jetons de rôle du paquet (`secondary` / `secondaryInk`, l’étape courante en `accent`), jamais un numéro de paquet ; elle garde l’anneau de focus de la coque (Ambre sur Nuit), car le rôle `focus` du paquet 3 (Nuit) disparaîtrait sur une carte Prune. Le `data-presenter` du paquet (`step-card` ou `checklist`) donne un aspect plus serré aux paquets 2 et 4, dont la liste de vérification est le présentateur principal.
- Après la dernière étape elle montre `closingLines()` (`listen.simple`, puis la ligne micro de la liste, `checklist.micCabled`, ou le texte `NO_MIC` du moteur) et un bouton « Fermer » ; la ligne est relue avec le banc (le lecteur `mic()` du pont recalcule le chemin du signal ; inconnu : seule la phrase épinglée est montrée, jamais une affirmation sur le micro). Une fin trouvée après un rechargement ne montre pas de fiche.

### « Passée » n’est pas « faite » (`passed` dans `oscar-guide.onboarding.v1`)

Le contrôleur fourni ne distingue pas une étape terminée par son événement d’une étape passée. Le montage dit au tutoriel les événements qu’il envoie (`sawEvent`) ; quand le contrôleur quitte une étape, elle est **faite** si un événement récent la termine (`matchesDone` fourni), si son résultat était déjà sur le banc (`early`) ou si l’aide au branchement l’a faite (`shown`), sinon **passée**. Les événements plus vieux de 3 s sont oubliés. Une étape passée puis faite (retour arrière) n’est plus passée. Un rechargement garde les marques (le champ est dans l’enregistrement ; un enregistrement antérieur se lit vide). Choix de la prudence : en cas de doute, une étape lit « passée », jamais « faite ».

### La liste de vérification en panneau (`checklist.ts`, `wire.ts`)

- Forme `panel` (paquet 2, `layout.checklist`) : la même liste, **un seul élément**, amarrée au pied du panneau Projet (`dock`), sans pastille, sans rôle de dialogue, sans focus pris, sans Échap, dans le flux de la colonne (jamais sur la vue 3D). Là où l’amarrage ne se voit pas (Projet replié, fenêtre de la taille d’un téléphone), la liste redevient la fenêtre de la pastille : elle n’est jamais hors d’atteinte. Un observateur de `data-tree` sur la racine fait passer la liste de l’un à l’autre ; les identifiants de test restent uniques.
- `wire.ts` lit la forme dans le paquet actif (`lookOfRoot`), sans numéro de paquet et sans toucher `boot.ts`.

### Les raccourcis à côté des commandes

`applyLookAttributes` écrit `data-shortcuts` (`beside` | `end`) d’après `layout.shortcutsBesideControls` ; `packages.css` place le raccourci d’un élément de menu juste après son libellé, en touche, pour les paquets 2 et 4. Les autres gardent le raccourci en bout de ligne, comme aujourd’hui. Le lien avec `menuBar.ts` se limite à cet attribut (le menu affichait déjà le raccourci de chaque élément).

## Conséquences

- La ligne et la fiche existent dans les cinq paquets (parité du DOM) ; le présentateur principal de 2 et 4 est la liste de vérification, la fiche leur reste une compagne discrète. C’est une lecture du tableau §7.2 (le brief de T6 demande la fiche dans les cinq) : le fondateur peut préférer qu’elle disparaisse dans ces deux paquets (un champ `presenter`, une ligne de code).
- Le champ `passed` ajoute une clé à un enregistrement épinglé : les assertions épinglées de `tutorialRuntime.test.ts` sont étendues (le ledger le dit).
- L’événement `resize` synthétique est un moyen simple de réveiller des consommateurs qui existent déjà ; si l’un d’eux faisait un travail coûteux au `resize`, il le ferait deux fois par tutoriel (ouverture, fermeture) : aucun ne l’est aujourd’hui.
