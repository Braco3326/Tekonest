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
- Les résultats de règles sont figés **compacts** : `{ ruleId, severity, subjects }` (idem pour `levelState.violations`). Les textes `title` / `teach` ne sont pas copiés : `rulesRev` fige le catalog d'où ils viennent (gain de taille, voir Décision 7).

## Décision 4 — Write-once

- Un `Trial` est **figé à la création** (`Object.freeze` profond, type `DeepReadonly`).
- Le store est **append-only**. Après coup, seuls sont permis :
  - le renommage (`name`) ;
  - l'ajout d'amendements à la note (`evidence.noteAmendments`, append-only) ;
  - la suppression explicite par l'apprenant (`remove`, avec confirmation dans l'UI).
- La note est **verrouillée dès la création** : aucune API ne la réécrit, jamais (avec ou sans essai enfant). Seuls les amendements datés s'ajoutent.
- `createTrial` exige une **prédiction non vide** (sinon `TrialError('prediction-required')`) et `prediction.writtenAt <= frozenAt`. Un nombre non canonisable (NaN, ±Infini, hors plage) → `TrialError('invalid-design')` ; un hacheur absent → `TrialError('crypto-unavailable')`. Aucune exception brute ne sort.

## Décision 5 — Empreinte canonique `fp1`

- `fingerprint(design) = 'fp1:' + sha256hex(canonicalize(design))` via `crypto.subtle`.
- `canonicalize` :
  - `instances` et `placements` triés par `instanceId` (l'ordre d'insertion n'a pas de sens physique) ; dans `controls`, une table vide pour une instance est supprimée (= aucun contrôle) ;
  - clés triées ; autres tableaux gardés dans l'ordre, **sauf** les listes de connexions, triées par une clé normalisée (chaque câble écrit `a < b`, puis la liste triée) : brancher A→B ou B→A, dans n'importe quel ordre, donne la même empreinte. **Tous les champs** du câble sont conservés (pas seulement `a`/`b`), pour qu'un futur attribut de câble entre dans l'empreinte ;
  - nombres quantifiés selon le nom du champ : positions → 0,001 m ; angles en degrés → 0,1° ; `delayMs` → 0,01 ms ; autres → 1e-6 ;
  - le lacet (`yawDeg`) est d'abord **normalisé dans [0, 360)** : 0° ≡ 360° ≡ −360° ;
  - `-0` → `0`, jamais de notation exponentielle.
- Le design figé est **stocké déjà quantifié** (1 mm, 0,1°) ; la re-quantification est idempotente, l'empreinte ne change pas.
- `diffDesign` (→ `changedSinceParent`) compare **les mêmes valeurs quantifiées** que l'empreinte (`quantField`, `canonicalCable`) : empreintes égales ⇔ diff vide, **sans exception** (réordonner instances/placements ou ajouter une table de contrôles vide ne change ni l'un ni l'autre), vérifié par un test de propriété sur 400 paires aléatoires. Clés : `room`, `instance:+id`, `instance:-id`, `instance:~id` (deviceId changé), `placement:id`, `connection:+N`, `connection:-N`, `control:<instance>.<contrôle>`.
- L'empreinte est **revérifiée au chargement** ; un écart envoie le stockage en quarantaine.
- Le préfixe `fp1:` est versionné : toute évolution de la canonisation crée `fp2:`, jamais une réécriture silencieuse.

## Décision 6 — Quarantaine, jamais `removeItem`

- L'API de stockage injectée est `Pick<Storage, 'getItem' | 'setItem'>` : **`removeItem` n'existe pas** dans le module.
- Au chargement : parse zod strict + empreinte revérifiée par essai. En cas d'échec, la chaîne brute est **ajoutée** à `audio-sim/trials.quarantine` = `{ version: 1, items: { at, raw, reason }[] }`, la liste chargée est vide et `quarantined: true` est renvoyé (l'UI le signale).
- La quarantaine est en lecture seule et exportable. Elle est **plafonnée à 5 éléments** : au-delà, le plus ancien est retiré, avec l'avertissement `quarantine-evicted`. C'est la **seule suppression bornée** du système, documentée ici volontairement : une boucle de corruption ne doit pas remplir le stockage.
- Chaque `raw` est **tronqué à 200 000 caractères** (drapeau `truncated: true`) : la quarantaine reste sous ~1 Mo. Une copie tronquée est **incomplète** : le store passe alors en **lecture seule** (`quarantine-truncated`) et la clé principale reste intacte (seule copie complète) jusqu'à ce que l'apprenant l'exporte.
- **Récupérer l'espace de la quarantaine** : seulement par « Exporter puis acquitter » (l'apprenant exporte, puis acquitte, ce qui libère les éléments). **Décision ouverte pour Oscar, non implémentée ce soir** (consignée dans le rapport de nuit). D'ici là, la quarantaine ne se vide que par le plafond de 5. Un même contenu n'est mis en quarantaine qu'une fois. Une quarantaine illisible (dont un `at` non ISO) est elle-même conservée comme élément (`quarantine-unreadable`).
- Si la copie en quarantaine échoue, le store passe en **lecture seule** (`quarantine-failed`) : aucune écriture ultérieure ne peut écraser la seule copie.
- Si `crypto.subtle` manque, rien n'est vérifiable : **lecture seule** (`crypto-unavailable`) et **pas** de quarantaine (les données sont probablement saines, c'est le navigateur qui manque).
- Toutes les opérations du store (chargement compris) passent par **une seule file série** : une écriture ne peut pas s'intercaler pendant un chargement, et deux ajouts concurrents du même id donnent un ajout et un `duplicate-id`.
- **Plusieurs onglets (revue finale #2, fait).** La file série protège un seul onglet ; entre onglets, chaque écriture **relit** d'abord la clé. Si elle a changé depuis la dernière lecture/écriture de ce store, elle est vérifiée (schéma + empreintes, comme au chargement ; illisible → quarantaine) puis **fusionnée par id** : les Essais nouveaux de l'autre onglet sont gardés, ses modifications d'un Essai que cet onglet n'a pas touché l'emportent, une suppression volontaire ici reste faite (sauf si l'autre onglet a modifié l'Essai entre-temps : sa copie part en quarantaine), et un vrai conflit (les deux onglets ont modifié le même id) garde la copie de cet onglet dans la liste et met la copie stockée en quarantaine (`merge-conflict:<id>`). Aucun id n'est perdu ; un échec de quarantaine refuse l'écriture. Le panneau écoute l'événement `storage` et recharge la liste (`reload()`). La fusion attend des vérifications asynchrones : juste avant `setItem`, la clé est relue de façon synchrone, et refusionnée si elle a encore bougé (3 essais, puis refus `storage` plutôt qu'une écriture à l'aveugle). Reste possible : deux onglets qui écrivent dans la même tâche (pas de verrou `navigator.locks`).
- Ceci remplace, pour les Essais, la règle générale « version mismatch → reset + notice » de `CLAUDE.md`.

## Décision 7 — Budget global en octets (D3)

- Budget absolu **global** : **1 500 000 unités**, où « global » = `audio-sim/trials` **+** `audio-sim/trials.quarantine`, et l'unité = une **unité de code UTF-16** (`string.length` du JSON stocké ; c'est ainsi que les navigateurs comptent le quota de localStorage). Avertissement `near-budget` dès **80 %**.
- Une écriture qui ferait **grossir** le fichier au-delà du budget est refusée → `{ ok: false, reason: 'budget' }`. La suppression reste toujours possible. L'UI propose « Exporter puis archiver » ; l'arrêt dur n'arrive qu'au budget absolu.
- Toute écriture est protégée : `QuotaExceededError` → `{ ok: false, reason: 'quota' }`, autre erreur → `'storage'`. **Aucun échec d'écriture n'est silencieux.**
- **Mesure** (test `tests/trials/size.test.ts`) : un Essai moyen (12 appareils, 14 câbles, 3 événements de règle, prédiction et note de 200 caractères, état de niveau) pèse **4 805 unités** (6 819 avant compactage des règles et quantification du design). Soit ~310 Essais dans le budget, quarantaine vide. L'estimation de 3 Ko du modèle de données était trop basse.

### Avis à afficher à l'apprenant (UI)

| Code | Quand | Intention (le texte final vient du copy deck, tekuxwriter) |
|---|---|---|
| `quarantined: true` | Chargement : données illisibles mises de côté | les Essais ont été mis de côté, exportables |
| `quarantine-evicted` | Le plafond de 5 a retiré le plus ancien élément | une ancienne copie de secours a été retirée |
| `quarantine-failed` | La copie de secours n'a pas pu être écrite | lecture seule, rien n'a été effacé |
| `quarantine-truncated` | La copie de secours est tronquée (> 200 000 car.) | lecture seule jusqu'à l'export des données d'origine |
| `read-only` | Écriture refusée (store en lecture seule) | rien n'est enregistré pour l'instant |
| `crypto-unavailable` | Navigateur sans `crypto.subtle` | Essais en lecture seule sur ce navigateur |
| `storage-unavailable` | Stockage bloqué (navigation privée…) | Essais indisponibles |
| `near-budget` | ≥ 80 % du budget global | proposer « Exporter puis archiver » |
| `budget` | L'ajout dépasserait le budget | « Exporter puis archiver » |
| `quota` / `storage` | Le navigateur a refusé l'écriture | l'Essai n'a pas été enregistré |

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
- Questions ouvertes pour Oscar : validation de cet ADR ; politique d'examen définitive (D2 était contesté au conseil) ; « Exporter puis acquitter » pour libérer la quarantaine (non implémenté) ; traitement du multi-onglet.
