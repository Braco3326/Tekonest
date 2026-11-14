# ADR-0017 — Les paquets de design se distinguent par des rôles de couleur, pas par des couleurs en dur

- **Status:** Accepté par défaut — en attente de validation du fondateur (paquets d’accueil, 2026-11-12). Les noms des paquets (`design.name1` à `design.name5`) sont « à valider (tekuxwriter) ».
- **Amendé le 2026-11-14 (G15b)** après relecture contre le code : six teintes dérivées (et non cinq), parts de Prune mesurées à côté des parts déclarées, section « Ce qui n’est pas mesuré ».
- **Sources :** spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (§7.1, §7.2, §7.3) ; plan `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (T4.1 à T4.4) ; `src/design/packages.ts`, `src/design/packageContrast.ts`, `src/design/creationTokens.ts`, `src/design/packages.css`.

## Contexte

Les cinq paquets doivent se voir au premier coup d’œil (le « test du plissement des yeux » de la spec §7.2) sans sortir de la famille de marque : Nuit `#131114`, Papier `#F3EDE3`, Ambre `#DD9349`, Prune `#612D45`, plus les tons dérivés déjà existants (`panel`, `panelLine`, `inkMuted`, `danger`, `ok`). Le code utilisait Ambre en dur dans 87 règles CSS (60 dans `creation.css`, 27 dans les cinq autres feuilles de la coque) : anneau de focus, bordures de survol, bordures de dialogues, barres de sélection, textes au survol. Sur Papier, Ambre fait **2,16 : 1** : un anneau, une bordure ou un texte Ambre y est illisible.

## Décision

### Des rôles, une table, des paires calculées

- `RoleColours` (19 rôles) dit à quoi sert une couleur : `ground` (fond d’écran : sélecteur, dialogues, pop-overs), `surface` (panneaux latéraux, tiroir, cartes), `inset` (second ton : fond d’un champ), `wash` (fond d’une ligne survolée ou active : la boîte « Connecter à… »), `ink`, `inkMuted`, `accent` / `accentInk` / `accentEdge` (un aplat, son texte, son bord), `accentText` (texte et glyphes d’emphase), `secondary` / `secondaryInk`, `band` / `bandInk` (bandeaux de titre), `focus`, `select` (bordures et barres de sélection et de survol), `line` (filets décoratifs, jamais seule limite d’un contrôle), `danger`, `ok`.
- La table `DESIGN_PACKAGES` (`src/design/packages.ts`) donne, pour chaque paquet, **sa** carte de couleurs ; `ALLOWED_COLOURS` interdit toute couleur hors de la famille (les quatre de marque, les dérivés existants, et **six** teintes dérivées déclarées : `#615E5C`, `#E6E0D7`, `#9B2C20`, `#2F6B3E`, `#F7A59B`, et `#704055`, le lavis du paquet 5, ajouté avec le rôle `wash`). Un test refuse deux paquets qui partagent une carte, ou une mise en page.
- Chaque paire (premier plan sur fond) qu’une carte déclare est **calculée** (`declaredPairs`, `contrastRatio` WCAG 2.1) : texte ≥ 4,5 : 1, interface (anneau, bordure, barre, bord d’un aplat) ≥ 3 : 1. Un test construit à la main une paire Ambre sur Papier et vérifie qu’elle **échoue** : le vérificateur mord. Le test de navigateur (`tests/e2e/onboarding-contrast.spec.ts`) mesure ensuite les couleurs réellement calculées dans la page.

### Pourquoi Ambre n’est jamais du texte (ni une limite) sur Papier

Ambre sur Papier : 2,16 : 1, sous 4,5 (texte) et sous 3 (interface). Ambre sur Prune : 4,24 : 1 : acceptable pour une limite ou un aplat, pas pour du texte. Donc, sur Papier (paquet 3) : le focus est **Nuit** (16,13), la sélection et le texte d’emphase sont **Prune** (9,16), et un aplat Ambre porte du texte Nuit (7,46) **et un bord Nuit de 2 px**. Sur Prune (paquet 5) : le texte d’emphase est Papier, Ambre reste un aplat ou une bordure.

### Comment CSS les applique, sans test de numéro

- Les 87 usages directs sont classés : focus → `--cr-focus` ; bordures et barres de survol et de sélection → `--cr-select` ; aplats → `--cr-accent` / `--cr-accent-ink` / `--cr-accent-edge` ; textes d’emphase → `--cr-accent-text`. Seuls la barre de menus, ses menus, la barre d’état et sa pastille, le lien d’évitement et les étiquettes posées sur la vue 3D gardent Ambre en dur (liste fermée, balayée par `tests/design/packageCss.test.ts`).
- `injectCreationTokens(root, roles?)` écrit les cartes sous `--cr-role-*` (sources) et les jetons résolus (`--cr-focus` …) à partir de la carte neutre (Ambre / Nuit) : **sans `?design`, chaque valeur d’avant est exactement la même** (test de caractérisation). `src/design/packages.css` re-pointe les jetons depuis les rôles **à l’intérieur** des surfaces qu’un paquet restyle (panneaux, tiroir, sélecteur, dialogues, pop-overs) ; le chrome et tout ce qui n’est pas listé gardent l’aspect d’aujourd’hui. La feuille ne sélectionne que sur `data-surface` et `data-density` (écrits sur `<html>` par `mountShell` d’après la mise en page du paquet), jamais sur un numéro : le garde-fou `noDesignBranching` reste vrai.
- Rien de tout cela ne s’applique hors adresse de pratique : `main.ts` pose la classe `cr-practice` sur `<html>` quand `onboarding` est vrai (pas de `mode`, de `level`, de `legacy`) ; `data-design` seul (adresse d’examen avec `?design`) ne change ni couleurs, ni panneaux, ni tiroir.

### Comment les cinq paquets diffèrent

| Paquet | Équilibre | Part de Prune déclarée (spéc. §7.2) | Part de Prune **mesurée** | Focus | Sélection |
|---|---|---|---|---|---|
| 1 Pas à pas | sombre ; une seule chose allumée (Ambre) ; la carte d’étape en Prune | ~3 % | **10,0 %** (hors de la ligne) | Ambre | Ambre |
| 2 Atelier | mêmes panneaux sombres + bandeaux Prune de feuille d’étude | ~20 % | **7,7 %** (hors de la ligne) | Ambre (Papier sur un bandeau) | Ambre |
| 3 Salle d’abord | feuille Papier de plein jour, encre Nuit | sélection, liens et texte d’emphase (l’encre est Nuit) | 0,0 % (conforme) | Nuit | Prune |
| 4 Pupitre | à plat, filets fins, aucun Prune | 0 % | 0,0 % (conforme) | Papier | Ambre |
| 5 Modèle d’abord | panneaux et cadre Prune autour de la vue 3D | ~45 % | **54,1 %** (hors de la ligne) | Papier | Ambre |

Mesure : le test du plissement des yeux (`tests/e2e/onboarding-visual.spec.ts`, spéc. §11.7), grille de 128 × 72 cellules, vue 3D masquée, 1366 × 768, identique sur six exécutions (rapport G14e, non versionné). « Environ N % » se lit N ± 5 points dans le test ; les trois paquets hors de la ligne sont fixés par leur nom dans `KNOWN_BALANCE` (le test échoue le jour où l’un rentre dans la ligne ou qu’un autre en sort). Les paquets se distinguent : la paire la plus proche (2 et 4) diffère sur 14,2 % des cellules de la grille de 32 × 18 (seuil 8 %). Les cartes de couleurs déclarées ne sont pas en cause : l’écart vient de la part d’écran que chaque rôle occupe ; ajuster la mise en page ou la ligne déclarée est une décision du fondateur, après avoir vu les écrans.

Le guide (Oscar) reste une carte sombre sur tous les paquets : il lit les valeurs **racine** des jetons, et son anneau garde Ambre sur son halo Nuit. C’est un **choix de conception, non mesuré par la suite** : l’anneau et son halo ne sont pas mesurés contre Papier (décision ouverte pour le fondateur, voir l’erratum de la spécification).

## Conséquences

- Ajouter un paquet ou changer une couleur est une édition de table ; si une paire déclarée tombe sous son seuil, le test dit laquelle.
- La mise en page (panneaux initiaux, tiroir qui reste ouvert, coin d’Oscar) suit la même règle : des champs du paquet lus par la coque, jamais son numéro. L’accordéon sous 760 px l’emporte sur tout préréglage **et sur tout profil** : ce que la coque ouvre d’elle-même (état initial, profil de première visite) est borné par la largeur (`panelFits` : Projet dès 760 px, Propriétés dès 1200 px, la vue 3D garde au moins 60 %) ; un clic de l’apprenant n’est jamais borné. Les profils 2 et 4 gardent leur intention là où la fenêtre le permet.
- Les lignes de la boîte « Connecter à… » (survol, option active) prennent le rôle `wash` (`--cr-wash`), ni `inset` (1,08 : 1 contre un panneau sombre : presque invisible, vu sur capture) ni `line` (ink sur `line` : 1,97 : 1 aux paquets 4 et 5). `wash` vaut `#3A3339` aux paquets 1, 2 et 4 (le survol d’aujourd’hui : ink 10,53, barre Ambre 4,87, 1,42 contre le panneau), `#E6E0D7` au paquet 3, `#704055` (Prune 90 % + Papier 10 %) au paquet 5 (ink 7,06, barre 3,27, 1,30 contre le panneau : plus clair ferait passer la barre sous 3). Le test statique refuse tout `background` en `--cr-panel-line`, `--cr-ink-muted` ou `--cr-line` hors une liste d’exceptions motivées.
- Compromis d’usage connu (`stay-open`, mot du fondateur : « reste ouvert après une pose ») : le tiroir rouvert recouvre le tiers bas de la vue ; un appareil posé bas passe sous lui. Il se referme d’un geste (Échap, Espace, « Fermer »).
- À revoir par le fondateur : les cinq équilibres sur écran (captures : `$env:ONBOARDING_SCREENS='1'; $env:E2E_PORT='4391'; npx.cmd playwright test onboarding-screens` après un build neuf, dans `test-results/screens/`, une fois par paquet : départ, salle et boîte « Connecter à… »), et le nom de chaque paquet.

## Ce qui n’est pas mesuré

- **Aucun humain n’a regardé les cinq équilibres.** Les contrastes sont calculés (`tests/design/packageContrast.test.ts`) puis lus dans Chromium (`tests/e2e/onboarding-contrast.spec.ts`, axe compris) ; ni jugement d’une personne, ni lecteur d’écran.
- **L’anneau Ambre du guide et son halo Nuit sur Papier** (paquet 3) : choix de conception, jamais mesuré contre Papier ; décision ouverte du fondateur (garder, ou donner un rôle de paquet à l’anneau).
- **Les couleurs forcées** (contraste élevé de Windows) et la largeur de **375 px** : non mesurées pour les paquets.
- **La scène 3D** : sa couleur n’est pas un rôle de paquet (inchangée) et elle n’est **pas dans les captures de référence** (`onboarding-visual.spec.ts` masque la vue 3D ; captures faites sous Windows seulement, `-win32.png`). Un paquet qui changerait la scène ne serait pas vu par ce test.
- **Les rapports de contraste exacts** : `packageContrast.test.ts` affirme des seuils (4,5 et 3), pas les rapports ; les rapports cités (spéc. §7.3, commentaires de `packages.ts`, `docs/design-system.md`) sont les chiffres calculés au moment de l’écriture, pas recalculés à chaque exécution.
- **Le balayage CSS** (`tests/design/packageCss.test.ts`) est statique : il lit les sélecteurs et les valeurs, il ne voit pas une couleur produite par du JavaScript (le test navigateur lit les styles calculés dans six états seulement).
