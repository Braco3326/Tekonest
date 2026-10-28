# ADR-0015 — Champ direct relatif

- **Status:** Accepté par défaut — en attente de validation d'Oscar (reconstruction « Mode Création », Task 36). Rédaction française : brouillon à relire par tekuxwriter.
- **Sources :** brief `docs/plans/2026-10-24-creative-mode-brief.md` §5 ; plan `docs/plans/2026-10-24-creative-mode.md` (Task 36, décisions C13, P9, P10, P17, S2) ; conseil `docs/audit/2026-10-24-council.md` (Q5, C12, C13) ; ADR-0013 (addendum : conventions de pose) ; journal `docs/CREATIVE-MODE-LOG.md` (L28 : données acoustiques sourcées).
- **Inspiration :** le *modèle d'interaction* des outils pro de prédiction de couverture (points d'écoute colorés, échelle relative). Aucun nom, graphisme, libellé, algorithme ni code n'en est repris ; le modèle ci-dessous est le nôtre, volontairement simple.

## Contexte

Mode Création doit montrer à l'apprenant où une sonorisation couvre bien le public et où elle couvre mal, sans prétendre mesurer. Le brief fixe un modèle pédagogique : champ direct, relatif, en points d'écoute. Cette tâche livre seulement le **noyau pur** (`src/acoustics/*`) ; le Web Worker et l'affichage viennent à la Task 37, le mixage audio à la Task 39 (qui relira `directivityDb`).

## Décision

### Un noyau pur

`src/acoustics/` n'importe que lui-même : ni Babylon, ni DOM, ni magasin, ni module `creation`, `engine` ou `flow`. Un test (`tests/acoustics/layering.test.ts`) parcourt les imports de valeur et le vérifie, avec un contrôle « le garde mord ». Le noyau **ne lit pas le catalogue** : `AcSource` porte des nombres simples (pose, `hDeg`, `vDeg`, `lRefDb`). Il peut donc tourner tel quel dans un Worker.

### Formule

Pour chaque enceinte qui reçoit du signal, est alimentée et n'est pas en sourdine :

`L = L_ref + D(θH, θV) − 20·log10(max(r, 0,5 m))`

- `L_ref` est le gain `gainDb` de l'alimentation de l'enceinte (`SpeakerFeed`, Task 34, décision P10). C'est un niveau d'échelle, **pas** un dB SPL.
- `r` est la distance au point d'écoute, **plancher 0,5 m** : près de l'enceinte le champ direct n'a plus de sens et le niveau doit rester fini (r = 0 donne +6,02 dB, pas l'infini). Le plancher est testé : 0,1 m donne le même niveau que 0,5 m, et 0,6 m en donne un plus bas.
- Décroissance : −6 dB par doublement de distance (20·log10 ; 2× la distance sur l'axe = −6,02 dB).
- Directivité : `D = max(−6·u², −30) dB`, avec `u² = (θH / (H/2))² + (θV / (V/2))²`. À la moitié de la couverture nominale en H (ou en V), on perd donc **exactement 6 dB** (u² = 1) ; le plancher de −30 dB est atteint dès que u² ≥ 5, pas avant (par exemple 89° hors axe en H seul, pour 90° de couverture, donne −23,5 dB et non −30 : le cas du plan était faux, voir « Écarts du plan »).
- `H` et `V` sont les angles de couverture du catalogue. Un angle non positif ou non fini est refusé (`RangeError`) : il donnerait NaN.

### Somme énergétique

Les niveaux s'additionnent en énergie : `10·log10(Σ 10^(L/10))` (calculée par rapport au niveau le plus fort, donc sans dépassement ni sous-dépassement numérique). Deux sources égales : +3,01 dB. Aucune phase : voir « Non modélisé ».

### Repère et signes

Repère de Babylon (main gauche), identique à celui de la pose (ADR-0013, addendum) :

- **Lacet** (`yawDeg`) autour de +y ; **0° = l'enceinte regarde +z** ; 90° regarde +x (axe = (sin lacet, 0, cos lacet)).
- **Inclinaison** (`tiltDeg`) autour de l'axe x propre à l'enceinte, appliquée après le lacet ; **> 0 vise vers le haut**. Un auditeur à la même hauteur, droit devant, est alors **sous l'axe** pour `tiltDeg = +10` (θV ≈ −10°) et **au-dessus** pour `tiltDeg = −10` (θV ≈ +10°). Testé.
- θH > 0 : à droite de l'axe (+x quand l'enceinte regarde +z) ; θV > 0 : au-dessus de l'axe.
- **Arrière** : z local < 0, calculé **après** l'inclinaison (une enceinte visant le plafond a son arrière sous elle). Le plan de l'enceinte (z local = 0) compte comme l'avant.

### Hémisphère arrière : −30 dB, avec une marche (P9)

Derrière l'enceinte, `D = −30 dB`, comme l'a écrit le conseil. **Limite connue :** pour une couverture H supérieure à environ 80° (précisément H > 2·90/√5 ≈ 80,5°), la directivité de face au plan de l'enceinte (θH = 90°) vaut `−6·(90/(H/2))²`, qui est **au-dessus** de −30 dB ; l'arrière est à −30 dB juste de l'autre côté du plan : le champ présente donc une **marche** à ce plan. Exemples : H = 90° donne −24 dB devant et −30 dB derrière (marche de 6 dB) ; H = 120° donne −13,5 dB et −30 dB (marche de 16,5 dB) ; H ≤ 80° n'a pas de marche (le plancher joue déjà). La marche est testée. Elle est acceptée : un vrai diagramme est continu mais l'ordre de grandeur (l'arrière est très en dessous de l'avant) est juste et le modèle reste lisible. Un raccord lisse est possible plus tard sans changer les interfaces.

### Affichage relatif

- `computeField` renvoie, pour chaque point, le niveau **relatif au point le plus fort** : `relDb ≤ 0`, le maximum vaut exactement 0. Légende : « dB relatif (0 = point le plus fort) ». `maxDb` est le niveau énergétique absolu de ce point le plus fort, **sur l'échelle de `L_ref`** (pas un dB SPL).
- Échelle verrouillée : `SCALE_STEPS_DB = [0, −3, −6, −9, −12, −15, −18, −21, −24]`, soit **8 classes** de 3 dB. `scaleBin(rel)` renvoie 0..7 : la classe k contient `(−3(k+1), −3k]` (−3 va en classe 1, −24 et tout ce qui est plus bas en classe 7, au-dessus de 0 en classe 0).
- `stats` (min, max, moyenne, σ, nombre) lit les valeurs relatives **non coupées** (P17) : le plancher de −24 de l'échelle ne doit pas cacher l'inégalité de la couverture. `σ` est l'**écart type de population** (division par n).

### Valeur sentinelle : −Infinity, jamais NaN

Une alimentation à `gainDb = −Infinity` (fader à −inf) ou une liste de sources vide ne produit aucun son. Le noyau définit alors : `maxDb = −Infinity`, **tous** les `relDb = −Infinity`, aucun recouvrement ; `scaleBin(−Infinity) = 7` ; `stats` **ignore** les points silencieux (non finis) et, s'il n'en reste aucun, renvoie `{ min: 0, max: 0, mean: 0, sd: 0, count: 0 }` : l'appelant doit lire `count` avant d'afficher des chiffres. Une source à −Infinity à côté d'une source audible se comporte exactement comme si elle était absente. Le noyau ne renvoie jamais NaN pour des entrées finies ; les appelants retirent normalement les sources non alimentées avant l'appel (sourdine, hors tension).

### Recouvrement

`overlap[i] = 1` quand les **deux** contributeurs les plus forts au point sont à **6 dB ou moins** l'un de l'autre. Ce n'est qu'un avertissement : l'interface hachure ces zones « interférences non modélisées ». Une seule source ne recouvre jamais.

### Grille d'écoute

- Les zones sont celles de `roomLayout` (`audience` et `foh`, filtrées par l'appelant) : `{ x, z }` est le **centre** du rectangle, `w` sa taille en x, `d` en z, `y` le sol de la zone. Hauteur d'oreille ajoutée : 1,2 m assis (défaut), 1,7 m debout.
- Pas : 0,5 m, puis 1 m, puis 2 m tant que le **total** des points (toutes zones) dépasse `maxPoints` (20 000 par défaut, limite incluse). 2 m est le pas le plus grossier : une très grande salle est rendue à 2 m même si elle dépasse encore la limite.
- **Règle de bord** (déterministe, testée) : le treillis est centré sur la zone, ses cellules mesurent exactement le pas, et un point est le **centre d'une cellule**. Aucun point n'est donc sur le bord (le plus proche est à pas/2 à l'intérieur), une bande de bord plus étroite qu'un pas est laissée de côté, et une zone plus petite qu'une cellule reçoit un seul point en son centre. Une zone sans surface ne donne aucun point. Les zones sont supposées disjointes.
- Ordre : zone par zone, lignes en z puis colonnes en x.

### Estimation « ≈ dB SPL » (S2) : règle, pas de code

Elle n'existe que si **chaque** enceinte contributrice a une `sensitivity_db` **et** un `max_spl_db` sourcés dans le catalogue, et elle porte la mention « estimation pédagogique ». Aujourd'hui aucun appareil n'a de `sensitivity_db` (L28 (v)) : elle reste donc **masquée**. Ce noyau ne lit ni l'un ni l'autre : `max_spl_db` est un niveau de **crête** (L28 (v)) et ne doit jamais être présenté comme un niveau soutenu. La formule de l'estimation sera décidée avec son implémentation (Task 37) ; si elle demande une hypothèse non sourcée, elle ne sera pas affichée.

### Provenance des données

Les angles viennent du champ `acoustic` du catalogue (`coverage_h_deg`, `coverage_v_deg`), chaque valeur avec sa source (`kb`, `datasheet` ou `nominal`, schéma `Sourced`). `nominal` n'existe que pour la paire 90° × 60°, quand la base de connaissances ne donne aucune couverture (« valeur nominale », décision C12). Le **V du K12.2 (75°) est une déduction** de « axisymmetric » (la base ne donne qu'un angle) : la `ref` du catalogue le dit (journal L28 (iii)). L'interface doit garder cette distinction visible (« valeur nominale », « déduit »). Le noyau ne devine jamais une valeur : il reçoit des nombres et refuse une couverture invalide.

### Non modélisé (dit à l'apprenant)

- **Réflexions** et réverbération de la salle : le champ est direct seulement.
- **Interférences** : les sources s'ajoutent en énergie, sans phase ni filtrage en peigne ; les zones où deux contributeurs sont à 6 dB ou moins sont hachurées.
- **Absorption de l'air**, vent, température : la vitesse du son (343 m/s, contrainte du plan) n'entre pas dans le calcul du niveau.
- **Intelligibilité** (STI) : aucune estimation.
- **Seuil légal** : le projet n'affirme rien sur une limite de niveau sonore ; aucune comparaison réglementaire.
- La directivité est un modèle lisse en cloche à deux angles, pas le diagramme mesuré de l'enceinte.

## Écarts du plan relevés à l'implémentation

- Le cas « −30 dB hors axe » du plan (`directivityDb(89, 0, 90, 60, false) = −30`) était faux : −23,47 dB. Le test vise maintenant un point où u² > 5, la frontière exacte u² = 5 (−30 pile) et un point juste en dessous (−27,66).
- `scaleBin(0)` du plan renvoyait −0 (`Math.floor(-0/3)`) : corrigé pour renvoyer +0.
- `computeField` du plan renvoyait NaN quand toutes les sources sont à −Infinity (−Infinity − −Infinity) : voir la valeur sentinelle.
- La directivité sur l'axe du plan était −0 : corrigé.

## Conséquences

- La Task 37 construit les `AcSource` (pose, couverture du catalogue, `gainDb` de l'alimentation) pour les seules enceintes alimentées, sous tension et non en sourdine, et exécute `computeField` dans un Worker, sur changement seulement.
- La Task 39 lit `directivityDb` pour le mixage ; elle doit donc garder la même convention de signes.
- Réversible et sans migration : aucune donnée enregistrée n'est touchée.
