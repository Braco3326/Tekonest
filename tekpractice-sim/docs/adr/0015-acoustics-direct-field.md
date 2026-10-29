# ADR-0015 — Champ direct relatif

- **Status:** Accepté par défaut — en attente de validation d'Oscar (reconstruction « Mode Création », Task 36). Rédaction française : brouillon à relire par tekuxwriter.
- **Sources :** brief `docs/plans/2026-10-24-creative-mode-brief.md` §5 ; plan `docs/plans/2026-10-24-creative-mode.md` (Task 36, décisions C13, P9, P10, P17, S2) ; conseil `docs/audit/2026-10-24-council.md` (Q5, C12, C13) ; ADR-0013 (addendum : conventions de pose) ; journal `docs/CREATIVE-MODE-LOG.md` (L28 : données acoustiques sourcées).
- **Inspiration :** le *modèle d'interaction* des outils pro de prédiction de couverture (points d'écoute colorés, échelle relative). Aucun nom, graphisme, libellé, algorithme ni code n'en est repris ; le modèle ci-dessous est le nôtre, volontairement simple.

## Contexte

Mode Création doit montrer à l'apprenant où une sonorisation couvre bien le public et où elle couvre mal, sans prétendre mesurer. Le brief fixe un modèle pédagogique : champ direct, relatif, en points d'écoute. Cette tâche livre seulement le **noyau pur** (`src/acoustics/*`) ; le Web Worker et l'affichage viennent à la Task 37, le mixage audio à la Task 39 (qui relira `directivityDb`).

## Décision

### Un noyau pur

Le **noyau** de `src/acoustics/` (`geometry`, `field`, `scale`, `grid`) n'importe que lui-même : ni Babylon, ni DOM, ni magasin, ni module `creation`, `engine` ou `flow`. Un test (`tests/acoustics/layering.test.ts`) nomme ces quatre fichiers, parcourt leurs imports de valeur et le vérifie, avec un contrôle « le garde mord » sur un dossier de test créé pour l'occasion. La Task 37 ajoutera `worker.ts` et `client.ts` dans le même dossier : ce sont les seules exceptions (un Worker utilise `self` et `postMessage`), elles ne font pas partie du noyau. Le noyau **ne lit pas le catalogue** : `AcSource` porte des nombres simples (pose, `hDeg`, `vDeg`, `lRefDb`). Il peut donc tourner tel quel dans un Worker.

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
- **Règle de bord** (déterministe, testée) : le treillis est centré sur la zone, ses cellules mesurent exactement le pas, et un point est le **centre d'une cellule**. Aucun point n'est donc sur le bord (le plus proche est à pas/2 à l'intérieur), une bande de bord plus étroite qu'un pas est laissée de côté, et une zone plus petite qu'une cellule reçoit un seul point en son centre. Une zone sans surface ne donne aucun point et n'en cache aucun.
- **Zones qui se recouvrent** (cas réel : dans plusieurs lieux livrés, la zone `foh` « régie » est un rectangle inclus dans la zone `audience`, et d'autres zones `foh` ou `audience` se chevauchent en partie) : une position d'écoute n'est comptée qu'**une fois**, sinon `count`, la moyenne et σ (P17) et le choix du pas seraient faussés. Un point candidat d'une zone est **écarté** s'il tombe dans le rectangle (bords compris, comme `roomLayout.floorAt`) d'une zone **antérieure** de la liste dont le sol est à la **même hauteur** (à 1 mm près). Une zone à une autre hauteur (un balcon, une régie surélevée) ne cache rien et n'est pas cachée. La zone antérieure l'emporte (l'ordre de la liste compte). Limite : un point situé dans la bande de bord que le treillis de la zone antérieure laisse de côté (au plus une cellule) est écarté aussi. Le pas est choisi sur le nombre de points **conservés**. Testé sur les rectangles réels de `bar-club-stage-small` (aucun point à moins d'un pas d'un autre) et de `sports-venue-pa-large` (pas de 2 m).
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
- **La directivité est une approximation, pas le diagramme mesuré de l'enceinte.** C'est une parabole en dB (−6·u²) coupée à −30 dB, avec une marche à l'arrière (voir plus haut) : ni une cloche lisse, ni un diagramme réel. Plus précisément :
  - θH est l'azimut et θV l'élévation dans le repère de l'enceinte ; ils sont combinés en **somme de carrés**. Les angles de couverture du catalogue sont des valeurs dans les **plans principaux** (horizontal et vertical) ; ce que le modèle donne dans les diagonales est une extrapolation.
  - « −6 dB à la moitié de la couverture » est **notre convention**. La base de connaissances ne dit pas à quel niveau chaque fabricant définit ses angles : ce n'est pas forcément le même.
  - La directivité est la **même à toutes les fréquences** : une vraie enceinte devient plus directive vers l'aigu et plus large dans le grave.

## Écarts du plan relevés à l'implémentation

- Le cas « −30 dB hors axe » du plan (`directivityDb(89, 0, 90, 60, false) = −30`) était faux : −23,47 dB. Le test vise maintenant un point où u² > 5, la frontière exacte u² = 5 (−30 pile) et un point juste en dessous (−27,66).
- `scaleBin(0)` du plan renvoyait −0 (`Math.floor(-0/3)`) : corrigé pour renvoyer +0.
- `computeField` du plan renvoyait NaN quand toutes les sources sont à −Infinity (−Infinity − −Infinity) : voir la valeur sentinelle.
- La directivité sur l'axe du plan était −0 : corrigé.

## Conséquences

- La Task 37 construit les `AcSource` (pose, couverture du catalogue, `gainDb` de l'alimentation) pour les seules enceintes alimentées, sous tension et non en sourdine, et exécute `computeField` dans un Worker, sur changement seulement.
- La Task 39 lit `directivityDb` pour le mixage ; elle doit donc garder la même convention de signes.
- **Tranché à la Task 37 : convention gardée (lacet 0 = +z), voir L30 ; à revérifier quand les modèles 3D refondus arrivent (le panneau de couverture porte une mention en attendant).** *Vérifié en Task 37 (voir « Addendum (Task 37) »).* *Texte d’origine :* la face avant des `.glb` (K12.2, DBR12). Le modèle suppose que l'avant de l'enceinte (la grille) regarde +z local. Si un modèle 3D regarde l'autre côté, c'est un retournement de 180° : tous les points du public deviennent « arrière » (−30 dB) et le champ se réduit à un dégradé de distance d'apparence plausible. À trancher en Task 37, **avant d'afficher la couverture** (voir aussi l'addendum d'ADR-0013).
- **Pour la Task 37 :** (1) `computeField` lève `RangeError` si une enceinte n'a pas de couverture valide : l'appelant écarte les enceintes sans champ `acoustic` du catalogue et les appareils Bêta avant de construire les `AcSource` ; (2) beaucoup de lieux n'ont aucune zone `audience` ni `foh` (studios, cabines) : la grille est alors vide, `maxDb = −Infinity` et `stats.count = 0`, et le panneau de couverture a besoin d'un état vide ; (3) `maxDb` est sur l'échelle de `L_ref`, ce n'est pas un dB SPL.
- Réversible et sans migration : aucune donnée enregistrée n'est touchée.

## Addendum (Task 37) : la couverture affichée, et la face avant des .glb

- **Affichage.** Un Worker (`src/acoustics/worker.ts`, mince : `job.ts` porte le calcul pur) calcule le champ sur la grille `audience` puis `foh` à la hauteur d’oreille ; les **sources** (`coverageSources`) sont les seules enceintes alimentées, sous tension, non en sourdine, vérifiées, avec une couverture sourcée (`lRefDb = gainDb`) ; les autres sont listées avec leur raison. Les points d’écoute nommés et le point épinglé sont des sondes du même job (échelle de la grille, peuvent dépasser 0). Recalcul sur changement seulement (anti-rebond 150 ms). Journal : L30.
- **« ≈ dB SPL estimé ».** La règle est codée (chaque enceinte contributrice : `sensitivity_db` et `max_spl_db` sourcés) et testée avec un catalogue synthétique ; **aucune formule** n’est donnée ici ni inventée (`L_ref` est un gain relatif, pas une puissance) : tant qu’aucune enceinte n’a de sensibilité, la ligne n’existe pas ; si elle existait, le panneau dirait seulement « non calculé ».
- **Limites ajoutées.** L’origine acoustique est la position de pose (le dessous de l’appareil) ; le balance et les canaux L/R ne changent pas le niveau.
- **Face avant des .glb : décidé (controller, 2026-10-29) : convention gardée.** La refonte des modèles 3D (spécification 2026-10-29-3d-model-rebuild-design.md) oriente la face E/S vers −Z, pivot bas-centre, sans rotation : exactement cette convention, qu’elle devrait donc rendre vraie. **Cette section est la source unique des faits mesurés sur les `.glb` d’aujourd’hui** (le journal L30, l’en-tête de `tests/assets/speakerFront.test.ts` et le rapport y renvoient, sans répéter les chiffres). Le noyau et le modèle de référence supposent « lacet 0 = l’enceinte regarde +z » (et les connecteurs en −z, par `DeviceSpawner`). Mesuré sur les fichiers : le **K12.2** a ses empties de connecteurs sur l’extrémité la plus **large** de son plan (14 po contre 6,6 po à l’autre bout, qui porte le panneau d’ampli en retrait et les poignées) : si ce côté large est la baffle, la face avant du modèle regarde **−z** à lacet 0, à l’opposé de l’axe acoustique ; le **DBR12** est un modèle mal proportionné (boîte longue, grille sur un grand côté) dont aucune face avant ne se lit. Les traits d’axe de la couverture rendent la convention visible. Un décalage par appareil (`FRONT_YAW_OFFSET_DEG`, vide) est prévu et testé mais **non utilisé**. Tests : `tests/assets/speakerFront.test.ts` (les faits des fichiers), e2e (j) (côté des connecteurs dans la scène), `tests/creation/coverageModel.test.ts` (un lacet de 180° renverse le champ : `maxDb` chute de plus de 20 dB).

## Addendum (Task 39) : l'écoute (mixage par enceinte, transport, sécurité d'écoute)

- **Mixage.** `src/audio/listenerMix.ts` est pur (aucun import, ni DOM ni Web Audio ; un test de couche le vérifie, avec une fixture « le garde mord »). Par enceinte alimentée : **gain** = `1 / max(r, 0,5 m)` × `10^(gainDb/20)` × `10^(dirDb/20)` (0 exactement si l'enceinte est en mute ou si le fader est à −inf) ; **retard** = `r / 343` moins le plus petit `r / 343` des enceintes (la plus proche n'a aucun retard ; 34,3 m de plus = 0,1 s ; plafonné à 1 s, la ligne à retard) ; **pan** = produit scalaire du vecteur unitaire **horizontal** auditeur → enceinte avec le vecteur « droite » de l'auditeur, borné à [−1, 1]. Le plancher de 0,5 m est celui de `levelDb` (un test compare les deux). Le plus proche est cherché parmi **toutes** les enceintes, muettes comprises : couper une enceinte ne déplace pas les autres.
- **« Droite » n'est jamais supposée (P14).** `src/creation/listenerPose.ts` la lit sur la matrice de vue du rendu (l'inverse de la matrice de vue appliquée à +x) : caméra de marche en vue de marche, sinon point d'écoute actif (Régie par défaut) regardant la scène (`Matrix.LookAtLH` / `RH` selon la scène). Face à la scène (−z) la droite est −x dans le monde de Babylon : **k12-g à x = +6 sonne à gauche**. Preuves : golden de `listenerMix`, comparaison avec une vraie `FreeCamera`, et l'oracle indépendant « une enceinte dessinée dans la moitié gauche de l'image sonne à gauche » (projection écran de la caméra), plus l'e2e (Régie et vue de marche).
- **Directivité vers l'auditeur** : `directivityDb(offAxis(pose, auditeur))` de `src/acoustics/field.ts`, **non réimplémenté** ; la pose vient du placement (position, lacet, inclinaison) par la même conversion que la couverture (`speakerPose`, extraite de `coverageSources`) ; l'axe acoustique est le +z local du placement (décision L30 viii, option C). **Une enceinte sans donnée `acoustic` valide joue quand même, avec 0 dB de directivité** (le mixage n'a besoin que de sa position et de sa pose) : choix assumé, contrairement à la couverture qui l'écarte faute de pouvoir calculer un champ. Une enceinte sans placement n'a pas de position : elle ne sonne pas. Un appareil Bêta n'a jamais de flux (`signalPath`).
- **Graphe Web Audio.** Source → entrée à 2 canaux (mixage « speakers » : un fichier **mono** alimente G et D) → `ChannelSplitter(2)` → par enceinte [G et/ou D ; les deux = (G + D) / 2, pour qu'une source mono garde son niveau] → `Gain` → `Delay` (≤ 1 s) → `StereoPanner` → `Analyser` (le vumètre : valeurs RMS en texte dans le bloc « Écoute ») → gain général → limiteur → destination. `update()` ramène gain, retard et pan à leur cible par `setTargetAtTime(…, 0,02)` ; un gain cible 0 est ramené à **exactement 0** après 0,2 s. L'`AudioContext` est créé dans le geste du clic « Lecture », dans un chunk paresseux.
- **Sécurité d'écoute (décision du controller).** Le son ne démarre jamais fort : gain général **−18 dBFS** (× 0,126, `MASTER_GAIN_DB`), un `DynamicsCompressorNode` réglé en **limiteur** (seuil −3 dBFS, coude 0, rapport 20, attaque 3 ms, relâchement 100 ms) avant la destination, **fondu d'entrée 80 ms** et **fondu de sortie 80 ms** (pas de clic), fader « −inf » / mute = gain exactement 0. Le signal de test est lui-même modeste (crêtes −12 dBFS pour les bruits, −18 dBFS pour les notes). Pas d'interface de volume général : le bloc dit de régler celui de l'ordinateur.
- **Sources.** *Signal de test* : original, généré à l'exécution (bruit rose graine fixe : gauche, droite, les deux ×2 ; puis un arpège de huit notes), rendu par un `OfflineAudioContext`, aucun fichier ; *fichier local* : `URL.createObjectURL` → `<audio>` → `MediaElementAudioSourceNode`, révoqué et retiré à l'arrêt, **jamais envoyé ni stocké** (e2e : aucune requête non-GET, aucune donnée de requête, rien dans localStorage / IndexedDB) ; *morceaux* : `content/songs.json` est vide (aucun morceau CC0 vérifié) : le sous-menu « Morceau » est masqué tant qu'il n'y en a pas, aucun titre n'est écrit dans le code.
- **Cycle de vie.** Lecture seulement si `playbackReady` (la règle est vérifiée dans le contrôleur, pas seulement par le menu) ; le mute et le fader ne bloquent jamais ; une chaîne qui devient invalide **arrête** la lecture (dit, avec la première raison) ; un changement de lieu l'arrête ; le bail `meters` du planificateur n'existe que pendant la lecture (au repos : 0 rendu en 2 s) ; une réponse tardive (le chunk qui arrive après Stop, un moteur remplacé) est écartée et le moteur inutile libéré ; un Entrée maintenu enfoncé vaut une seule pression.
- **Limites dites à l'apprenant (« simulation simple »).** Niveau, retard et placement gauche-droite d'après la géométrie seulement : **ni acoustique de salle, ni réponse en fréquence, ni réflexions, ni diaphonie**, pas d'effet de tête. Déplacer l'auditeur change le retard progressivement (constante de 20 ms) : la hauteur peut glisser un instant, ce n'est pas un effet Doppler modélisé. L'origine d'une enceinte est son point de pose (le dessous de l'appareil), pas le centre du coffret ; le **balance** de la console n'est pas appliqué (comme pour la couverture) ; un gain `1/r` sans plafond autre que 0,5 m. Aucune revendication de réalisme.
