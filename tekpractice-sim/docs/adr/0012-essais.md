# ADR-0012 — Essais et acoustique pédagogique

- **Status:** Accepté par défaut — en attente de validation d'Oscar (night build 2026-10-24, phase C).
- **Numérotation :** les documents de recherche (`research/fohhn-benchmark`: `scope-decision.md`, `tekpractice-data-model.md`, `council/synthesis.md`) appellent cette décision « ADR-0011 ». Le numéro 0011 est pris par la navigation (`0011-designer-navigation.md`), donc celle-ci devient **0012** (décision N5). Toute mention « ADR-0011 » dans ces documents à propos des Essais désigne le présent ADR.
- **Sources :** brief de nuit, Tasks 9 à 11 ; décisions D1 à D8 (`docs/NIGHT-2026-10-24.md`) ; modèle de données révisé par le conseil (`tekpractice-data-model.md`) ; checklist §4 de la synthèse du conseil.
- **Inspiration :** le *comportement* des outils pro de conception acoustique (figer un calcul, comparer, revenir en arrière). Aucun nom, aucune donnée, aucun libellé, aucun style ni code n'en est repris.
- **Nombres :** aucune valeur acoustique (ni dB, ni STI, ni « ±x dB ») dans la phase 1.

## Contexte

Un apprenant de BTS doit apprendre une **méthode** : changer une seule chose à la fois, prédire, puis comparer, en gardant la trace. TekPractice sait câbler et placer du matériel, mais rien ne permet de figer un montage, de le comparer à un autre ou d'y revenir. Le conseil d'experts recommande l'option C plafonnée à la fidélité (a)+, en commençant par la phase 1 = B : des **Essais sans acoustique**, construits autour de la preuve d'apprentissage.

## Décision 1 — Nommage (D4)

- Le mot côté apprenant est **Essai** ; le mot côté code est **`Trial`** (`src/trials/`).
- **Aucun nouvel identifiant ne contient « snapshot »** : `RigSnapshot` est déjà la vue graphe du moteur (ADR-0001).
- La copie française vient du copy deck `docs/copy/designer-nav-essais.md` (tekuxwriter).

## Décision 2 — Fidélité plafonnée à (a)+ ; phase 1 sans acoustique (D1)

- Ce soir, **seule la phase 1** est construite : figer, comparer et restaurer un montage (placement, câblage, contrôles, salle), avec prédiction écrite, résultats R1–R8 figés et état du niveau.
- `TrialResult` **n'existe pas** en phase 1 (il arrivera en phase 2, fidélité (a)/(a)+, après une nouvelle porte d'entrée). La fidélité (b) demande une **nouvelle décision** ; (c) n'est pas prévue.
- Pas d'inclinaison (`pitchDeg`) en phase 1 : un placement = position (m) + lacet (°).

## Décision 3 — Intégration par valeur

- Un `Trial` contient **une copie** de tout ce qu'il a consommé : le `DesignState` complet, les preuves (`Evidence`) et la salle consommée `consumed.room = { roomId | null, geometryRev | null }`.
- Il contient aussi la **vue** (`view: { pose, pivot }`) pour que la comparaison se fasse depuis la même caméra. La vue **n'entre pas** dans l'empreinte : changer de vue n'est pas une nouvelle évaluation.
- `rulesRev = 'r1:' + sha256(canonicalize(catalog.rules))`, calculé hors du module `trials` (qui n'importe jamais le catalog) et passé en entrée.

## Décision 4 — Write-once

- Un `Trial` est **figé à la création** (`Object.freeze` profond, type `DeepReadonly`).
- Le store est **append-only**. Après coup, seuls sont permis :
  - le renommage (`name`) ;
  - l'ajout d'amendements à la note (`evidence.noteAmendments`, append-only) ;
  - la suppression explicite par l'apprenant (`remove`, avec confirmation dans l'UI).
- La note elle-même n'est jamais réécrite ; dès qu'un essai enfant existe (`parentId`), seule la voie des amendements reste ouverte.
- `createTrial` exige une **prédiction non vide** (sinon `TrialError('prediction-required')`) et `prediction.writtenAt <= frozenAt`.

## Décision 5 — Empreinte canonique `fp1`

- `fingerprint(design) = 'fp1:' + sha256hex(canonicalize(design))` via `crypto.subtle`.
- `canonicalize` :
  - clés triées ; tableaux gardés dans l'ordre, **sauf** les listes de connexions, triées par une clé normalisée (chaque câble écrit `a < b`, puis la liste triée) : brancher A→B ou B→A, dans n'importe quel ordre, donne la même empreinte ;
  - nombres quantifiés selon le nom du champ : positions → 0,001 m ; angles en degrés → 0,1° ; `delayMs` → 0,01 ms ; autres → 1e-6 ;
  - `-0` → `0`, jamais de notation exponentielle.
- L'empreinte est **revérifiée au chargement** ; un écart envoie le stockage en quarantaine.
- Le préfixe `fp1:` est versionné : toute évolution de la canonisation crée `fp2:`, jamais une réécriture silencieuse.

## Décision 6 — Quarantaine, jamais `removeItem`

- L'API de stockage injectée est `Pick<Storage, 'getItem' | 'setItem'>` : **`removeItem` n'existe pas** dans le module.
- Au chargement : parse zod strict + empreinte revérifiée par essai. En cas d'échec, la chaîne brute est **ajoutée** à `audio-sim/trials.quarantine` = `{ version: 1, items: { at, raw, reason }[] }`, la liste chargée est vide et `quarantined: true` est renvoyé (l'UI le signale).
- La quarantaine est en lecture seule et exportable. Elle est **plafonnée à 5 éléments** : au-delà, le plus ancien est retiré. C'est la **seule suppression bornée** du système, documentée ici volontairement : une boucle de corruption ne doit pas remplir le stockage.
- Ceci remplace, pour les Essais, la règle générale « version mismatch → reset + notice » de `CLAUDE.md`.

## Décision 7 — Budget global en octets (D3)

- Budget absolu : **1 500 000 octets** pour `audio-sim/trials` (mesuré en longueur de chaîne JSON). Avertissement `near-budget` dès **80 %**.
- `append` refuse un ajout qui dépasserait le budget → `{ ok: false, reason: 'budget' }`. L'UI propose « Exporter puis archiver » ; l'arrêt dur n'arrive qu'au budget absolu.
- Toute écriture est protégée : `QuotaExceededError` → `{ ok: false, reason: 'quota' }`, toujours affiché à l'apprenant. **Aucun échec d'écriture n'est silencieux.**
- La taille réelle d'un Essai reste à mesurer (3 Ko est une estimation non mesurée) ; le budget pourra être réglé, pas contourné.

## Décision 8 — Politique d'examen (D2)

- En mode examen, les Essais sont **désactivés**, sauf si le niveau les déclare.
- Précondition à tout usage en examen : `ExamScore` est persisté.

## Décision 9 — `rigs.v2`

- `SavedRig` v2 vit sous une **nouvelle clé** `audio-sim/rigs.v2`, migrée par copie depuis `audio-sim/rigs` avec `roomId: null` ; la v1 n'est jamais touchée. Un test de non-écrasement prouve qu'un ancien build ne peut pas écraser la v2. (Livré dans une tâche ultérieure ; noté ici parce que les Essais en dépendent.)

## Décision 10 — Export « déclaratif »

- L'export `.essai.json` = `{ formatVersion, exportedAt, app: 'tekpractice', trials }`, étiqueté **« déclaratif »**.
- Un fichier exporté peut être forgé : c'est une **trace**, pas une preuve d'examen. Toute valeur d'examen demanderait signature ou stockage serveur, donc une nouvelle décision.

## Conséquences

- Nouveau module pur `src/trials/` (`fingerprint.ts`, `trial.ts`, `store.ts`), sans Babylon ni DOM, jamais importé par `src/engine/`.
- Les Essais ne portent aucun nombre acoustique. La phase 2 rouvrira cet ADR (directivité, `engineVersion`, fixtures dorées, `consumed` étendu).
- Questions ouvertes pour Oscar : validation de cet ADR ; taille réelle d'un Essai ; politique d'examen définitive (D2 était contesté au conseil).
