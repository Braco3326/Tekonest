# ADR-0017 — Les paquets de design se distinguent par des rôles de couleur, pas par des couleurs en dur

- **Status:** Accepté par défaut — en attente de validation du fondateur (paquets d’accueil, 2026-11-12). Les noms des paquets (`design.name1` à `design.name5`) sont « à valider (tekuxwriter) ».
- **Sources :** spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (§7.1, §7.2, §7.3) ; plan `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (T4.1 à T4.4) ; `src/design/packages.ts`, `src/design/packageContrast.ts`, `src/design/creationTokens.ts`, `src/design/packages.css`.

## Contexte

Les cinq paquets doivent se voir au premier coup d’œil (le « test du plissement des yeux » de la spec §7.2) sans sortir de la famille de marque : Nuit `#131114`, Papier `#F3EDE3`, Ambre `#DD9349`, Prune `#612D45`, plus les tons dérivés déjà existants (`panel`, `panelLine`, `inkMuted`, `danger`, `ok`). Le code utilisait Ambre en dur dans 87 règles CSS (60 dans `creation.css`, 27 dans les cinq autres feuilles de la coque) : anneau de focus, bordures de survol, bordures de dialogues, barres de sélection, textes au survol. Sur Papier, Ambre fait **2,16 : 1** : un anneau, une bordure ou un texte Ambre y est illisible.

## Décision

### Des rôles, une table, des paires calculées

- `RoleColours` (18 rôles) dit à quoi sert une couleur : `ground` (fond d’écran : sélecteur, dialogues, pop-overs), `surface` (panneaux latéraux, tiroir, cartes), `inset` (second ton : fond d’un champ, survol), `ink`, `inkMuted`, `accent` / `accentInk` / `accentEdge` (un aplat, son texte, son bord), `accentText` (texte et glyphes d’emphase), `secondary` / `secondaryInk`, `band` / `bandInk` (bandeaux de titre), `focus`, `select` (bordures et barres de sélection et de survol), `line` (filets décoratifs, jamais seule limite d’un contrôle), `danger`, `ok`.
- La table `DESIGN_PACKAGES` (`src/design/packages.ts`) donne, pour chaque paquet, **sa** carte de couleurs ; `ALLOWED_COLOURS` interdit toute couleur hors de la famille (les quatre de marque, les dérivés existants, et cinq teintes dérivées déclarées : `#615E5C`, `#E6E0D7`, `#9B2C20`, `#2F6B3E`, `#F7A59B`). Un test refuse deux paquets qui partagent une carte, ou une mise en page.
- Chaque paire (premier plan sur fond) qu’une carte déclare est **calculée** (`declaredPairs`, `contrastRatio` WCAG 2.1) : texte ≥ 4,5 : 1, interface (anneau, bordure, barre, bord d’un aplat) ≥ 3 : 1. Un test construit à la main une paire Ambre sur Papier et vérifie qu’elle **échoue** : le vérificateur mord. Le test de navigateur (`tests/e2e/onboarding-contrast.spec.ts`) mesure ensuite les couleurs réellement calculées dans la page.

### Pourquoi Ambre n’est jamais du texte (ni une limite) sur Papier

Ambre sur Papier : 2,16 : 1, sous 4,5 (texte) et sous 3 (interface). Ambre sur Prune : 4,24 : 1 : acceptable pour une limite ou un aplat, pas pour du texte. Donc, sur Papier (paquet 3) : le focus est **Nuit** (16,13), la sélection et le texte d’emphase sont **Prune** (9,16), et un aplat Ambre porte du texte Nuit (7,46) **et un bord Nuit de 2 px**. Sur Prune (paquet 5) : le texte d’emphase est Papier, Ambre reste un aplat ou une bordure.

### Comment CSS les applique, sans test de numéro

- Les 87 usages directs sont classés : focus → `--cr-focus` ; bordures et barres de survol et de sélection → `--cr-select` ; aplats → `--cr-accent` / `--cr-accent-ink` / `--cr-accent-edge` ; textes d’emphase → `--cr-accent-text`. Seuls la barre de menus, ses menus, la barre d’état et sa pastille, le lien d’évitement et les étiquettes posées sur la vue 3D gardent Ambre en dur (liste fermée, balayée par `tests/design/packageCss.test.ts`).
- `injectCreationTokens(root, roles?)` écrit les cartes sous `--cr-role-*` (sources) et les jetons résolus (`--cr-focus` …) à partir de la carte neutre (Ambre / Nuit) : **sans `?design`, chaque valeur d’avant est exactement la même** (test de caractérisation). `src/design/packages.css` re-pointe les jetons depuis les rôles **à l’intérieur** des surfaces qu’un paquet restyle (panneaux, tiroir, sélecteur, dialogues, pop-overs) ; le chrome et tout ce qui n’est pas listé gardent l’aspect d’aujourd’hui. La feuille ne sélectionne que sur `data-surface` et `data-density` (écrits sur `<html>` par `mountShell` d’après la mise en page du paquet), jamais sur un numéro : le garde-fou `noDesignBranching` reste vrai.
- Rien de tout cela ne s’applique hors adresse de pratique : `main.ts` pose la classe `cr-practice` sur `<html>` quand `onboarding` est vrai (pas de `mode`, de `level`, de `legacy`) ; `data-design` seul (adresse d’examen avec `?design`) ne change ni couleurs, ni panneaux, ni tiroir.

### Comment les cinq paquets diffèrent

| Paquet | Équilibre | Part de Prune | Focus | Sélection |
|---|---|---|---|---|
| 1 Pas à pas | sombre ; une seule chose allumée (Ambre) ; la carte d’étape en Prune | ~3 % | Ambre | Ambre |
| 2 Atelier | mêmes panneaux sombres + bandeaux Prune de feuille d’étude | ~20 % | Ambre (Papier sur un bandeau) | Ambre |
| 3 Salle d’abord | feuille Papier de plein jour, encre Nuit | encre et sélection | Nuit | Prune |
| 4 Pupitre | à plat, filets fins, aucun Prune | 0 % | Papier | Ambre |
| 5 Modèle d’abord | panneaux et cadre Prune autour de la vue 3D | ~45 % | Papier | Ambre |

Le guide (Oscar) reste une carte sombre sur tous les paquets : il lit les valeurs **racine** des jetons, et son anneau garde Ambre sur son halo Nuit, qui porte le contraste sur Papier comme sur la vue sombre.

## Conséquences

- Ajouter un paquet ou changer une couleur est une édition de table ; si une paire déclarée tombe sous son seuil, le test dit laquelle.
- La mise en page (panneaux initiaux, tiroir qui reste ouvert, coin d’Oscar) suit la même règle : des champs du paquet lus par la coque, jamais son numéro. L’accordéon sous 760 px l’emporte sur tout préréglage.
- À revoir par le fondateur : les cinq équilibres sur écran (captures dans `test-results/screens/`), et le nom de chaque paquet.
