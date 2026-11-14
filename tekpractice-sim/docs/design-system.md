# Teknest Design System — v1 (night run 2026-07-17)

> Source de vérité visuelle : `src/design/tokens.ts` (LE fichier unique de tokens).
> Direction : VISION_TekPractice-Game.md §6 — blanc galerie, calme, premium
> (Teenage Engineering × Apple × vrai studio). Le blanc est un dispositif
> pédagogique : il baisse l'anxiété (StudentJourney Beat 1) et fait du matériel
> réel le héros. JAMAIS de valeur en dur hors tokens.
>
> **Deux systèmes.** Cette page décrit d'abord le système historique (blanc, `--tk-*`). Le Mode Création a le sien (Nuit / Papier / Ambre / Prune,
> `--cr-*`, angles droits) : voir « Mode Création chrome » plus bas, et « Scène 3D — Mode Création » pour la vue. Les cinq paquets d'accueil (`?design=1..5`, branche `design/onboarding-packs`) sont des variantes de ce second système : voir « Packages de design ».

## Principes

1. **Le matériel est la star.** Fond `bg` #F5F6F8, sol `floor` #FCFCFD, objets sombres → contraste maximal sur les devices, minimal sur l'UI.
2. **Un seul accent** : `accent` #2E5FE6 (bleu calme). Tout le reste est encre/neutres. Les couleurs sémantiques (success/error/warning) n'apparaissent que comme FEEDBACK pédagogique.
3. **Whitespace généreux, typographie soignée** : Inter/system-ui, poids 450/550/650, letter-spacing négatif sur les titres, labels uppercase espacés pour les métadonnées.
4. **Motion subtile et signifiante** : 140/240/420 ms, easing `cubic-bezier(0.2,0,0,1)` (départ décidé, atterrissage doux). Le motion EST du feedback (toast-in, toggle, snap) — jamais décoratif.
5. **Accessibilité WCAG AA** : ink 15.4:1, inkMuted 6.4:1, blanc sur accent 4.6:1, blanc sur success 3.9:1 (grands éléments/badges uniquement — glyphes ≥ 14px bold).

## Tokens (résumé — la vérité est dans tokens.ts)

| Groupe | Tokens |
|---|---|
| Surfaces | `bg` `floor` `surface` `surfaceBorder` `overlay` |
| Encre | `ink` `inkMuted` `inkFaint` |
| Accent | `accent` `accentInk` |
| Sémantique | `success` `error` `warning` `info` |
| Ports | `portIn` (bleu) `portOut` (orange) `portBidir` (violet) |
| Scène | `deviceBody` `cable*` `contactShadow` |
| Type | famille + tailles xs→xl + poids |
| Espace/Rayon/Élévation | échelles sm→xl, ombres `card`/`raised` |
| Motion | `fast/base/slow` + `ease` |
| Focus & Patch (ADR-0008) | `glowOutline` `glowOutlineWidth` `glowOverlayAlpha` `dimVisibility` `heldCableRadius` `flyMs` |

Diffusion : `injectTokens()` pousse tout sur `:root` en `--tk-*` ; le CSS du HUD
(index.html) ne consomme QUE ces variables ; la scène Babylon lit `TOKENS.*`
directement (Color3.FromHexString).

## Scène 3D (white gallery)

- Clear color `bg`, sol `floor` (le léger écart crée l'horizon doux).
- Lumière de musée : hémisphérique 0.95 (groundColor #DDE1E8) + directionnelle 0.35 pour modeler.
- **Ombres de contact** : blob radial-gradient (`contactShadow`, DynamicTexture partagée) sous chaque device — pas de vraies shadow maps (budget perf, calme visuel).
- Câbles : caténaires fines, `cable` sombre commité (rayon fixe) ; drag neutre/`cableOk`/`cableBad`.
  Le câble **tenu** (drag) utilise `focus.heldCableRadius` (0.02) — plus épais que le commité
  pour rester lisible en vue Ensemble ; matériau neutral doux (émissif 0.35, pas de flash).
- **Focus & Patch** (tokens `focus.*`, lus directement côté scène, PAS injectés en CSS) :
  le halo des cibles compatibles = `glowOutline` (= l'accent, jamais néon) + un lavis translucide
  `glowOverlayAlpha` (0.3, valeur UNIQUE pour corps et cartels — cohérence sur fond blanc) ;
  les ports incompatibles reculent à `dimVisibility` (0.35) ; le vol caméra dure `flyMs` (300 ms).
- Labels 3D : cartels encre-sur-blanc (texture opaque). ⚠️ Piège appris : l'opacityTexture Babylon dérive l'alpha de la LUMINANCE → texte sombre sur transparent = invisible. On n'utilise PLUS d'alpha pour les labels. Police canvas : `bold Npx sans-serif` uniquement (`500 … system-ui` ne parse pas dans le canvas headless).

## Scène 3D — Mode Création (Task 14b, tokens `CREATION_TOKENS.scene` / `.light`)

Le viewport du Mode Création suit le chrome (Nuit / Papier / Ambre / Prune), pas la galerie blanche
ci-dessus, qui reste le look legacy (`?legacy=1`, `?level=`). Thème opt-in : `src/creation/sceneTheme.ts`
passe `RoomTheme` à `buildRoom` et `DeviceTheme` à `DeviceSpawner` ; sans thème, sortie legacy identique (testé).

- Sol `#2E2830` sur clear Nuit, grille 1 m (`gridMinor`, majeure tous les 5 m `gridMajor`) aussi dans les salles,
  au-dessus des zones plates. Murs `#221E23`, plafond `#1A171B` : ils cadrent sans concurrencer.
- Zones : un seul remplissage opaque `zoneFill` + un liseré 1 px `zoneEdge` (Prune-gris) ; plus de teintes saturées par type.
- Placeholders : corps `deviceBody`, dessus teinté par famille (mixage / sources / diffusion / infra), ~35 % vers une teinte ;
  auto-illumination `bodyGlow` pour que les faces à l'ombre ne se fondent pas dans le sol. Les .glb ne sont jamais recolorés.
- Ports : `portIn` bleu / `portOut` jaune / `portBidir` lilas, ≥ 3:1 sur le corps et le sol, `portGlow` 0.55.
- Labels : encre Papier + halo `labelBg` sur texture transparente (alpha = couverture du glyphe), IBM Plex Sans bold.
  Hiérarchie (`THEMED_LABELS`) : nom 0.4 × 0.1 m (moitié du legacy), labels de port ≈ 0.8× la hauteur du nom ; grille de ports
  au pas fixe 0.26 × 0.10 m (un label ne touche jamais le marqueur voisin), labels de port dans le rendering group 1 (au-dessus) ;
  sur un .glb (ports réels serrés), les voisins alternent dessus / dessous et rétrécissent pour tenir.
  ⚠️ `DynamicTexture.drawText(y = null)` lit la taille comme TOUS les chiffres de la police : jamais de graisse numérique.
- Lumière : une hémisphérique `fill` 0.5 + une clé 0.5 quasi neutres : le sol éclairé rend ≈ son token (#352D35 mesuré),
  `fillGround` neutre pour décoller les faces verticales ; pas de shadow map, aucun travail par frame (idle = 0 rendu).
- Sélection : UN trait écran Ambre autour de la silhouette entière de l'appareil (`HighlightLayer` isStroke ; corps + pièces .glb
  + marqueurs écrivent le stencil, labels / ombre / sphères de pick exclus du masque) + lavis Ambre 0.22. Survol : trait Papier,
  sans lavis. Le group 1 n'efface que la profondeur (effacer le stencil remplirait le corps d'Ambre).
- Focus clavier du canvas : anneau Papier, jamais Ambre (Ambre dans la vue = « appareil sélectionné »).

## Mode Création chrome (tokens `CREATION_TOKENS`, variables `--cr-*`)

Tout ce qui précède décrit le système historique (blanc galerie, `--tk-*`). **Le Mode Création a son propre système**, qui est celui du chrome
(menus, panneaux, tiroir, barre d'état, boîtes de dialogue) : `src/design/creationTokens.ts` est la source de vérité (`injectCreationTokens` pose les
variables `--cr-*` sur `<html>`), `src/creation/shell/creation.css` (et les CSS paresseux `inventoryDrawer.css`, `listen.css`, `coverage.css`, `toast.css`,
`connectDialog.css`) les consomme : les couleurs de marque passent par les `--cr-*`, jamais en dur. **Ce qui reste en dur** : des voiles et ombres en `rgba` (`creation.css` lignes 185, 665, 751, 759, 787 et 907 au 2026-11-04) et une partie des tailles de texte en `px`. Un token manquant se demande à tekdesigner, il ne se
code pas en dur. (Le nom de fichier `creationTokens.ts` n'est pas dans `src/creation/shell/` : il est dans `src/design/`.)

| Token | Valeur | Rôle |
|---|---|---|
| `--cr-nuit` | `#131114` | fond de l'app, champs, vue 3D ; l'encre des boutons pleins Ambre |
| `--cr-papier` | `#F3EDE3` | texte principal (16,1 : 1 sur Nuit, 14,95 : 1 sur panel) |
| `--cr-ambre` | `#DD9349` | **sélection et action** (7,5 : 1 sur Nuit) : barre de ligne choisie, anneau de focus, bouton principal |
| `--cr-prune` | `#612D45` | accent calme : bordures des fenêtres et du tiroir, zone « scène » des plans (1,76 : 1 sur Nuit : décoratif, la pastille « scène » porte donc un bord `ink-muted`) |
| `--cr-panel` | `#1C191D` | Nuit surélevé : barres, panneaux, tiroir, cartes |
| `--cr-panel-line` | `#3A3339` | séparateur discret (≈ 1,4 : 1 : **décoratif seulement**, jamais le bord d'un contrôle) |
| `--cr-ink-muted` | `#B3AAA0` | texte secondaire (≥ 4,5 : 1) **et bord d'un contrôle** (7,6 : 1 sur le panneau, WCAG 1.4.11) |
| `--cr-danger` | `#F08A7E` | erreur (texte et filet), jamais seul |
| `--cr-ok` | `#8CCB9B` | succès / prêt (texte et pastille) |
| `--cr-font-title` | Tektur | titres courts sans accent aigu (marque, titre du projet, titre du tiroir) |
| `--cr-font-ui` | IBM Plex Sans | tout le reste ; **tout texte à accents** (« PROPRIÉTÉS », noms de lieux) : l'aigu de Tektur se lit comme un macron à petite taille |
| `--cr-menubar-h` / `--cr-status-h` | 32 / 28 px | hauteurs des barres (48 / 48 au toucher, voir plus bas) |
| `--cr-tree-w` / `--cr-props-w` / `--cr-rail-w` | 200 / 260 / 32 px | colonnes ; replié = un rail (45 px au toucher) |
| `--cr-drawer-ms` / `--cr-fly-ms` | 180 / 450 ms | les deux seuls mouvements du Mode Création |

**Forme.** Angles droits partout : il n'y a volontairement **pas de token de rayon**, et `.cr *, .cr *:focus-visible { border-radius: 0 !important }` bat le
`a:focus-visible` historique. Un `border-radius` écrit dans une feuille du Mode Création est du code mort.

**Mouvement.** Aucune transition, sauf la glissade du tiroir (`--cr-drawer-ms`, aucune sous `prefers-reduced-motion`). Chaque contrôle porte `transition: none` : le
`button { transition: all }` historique animerait sinon l'anneau de focus, et la règle de mouvement réduit (0,01 ms) retarderait `visibility`.

**Focus.** Anneau de 2 px **Ambre**, décalé de 1 px, avec un halo **Nuit** de 3 px (`box-shadow`), pour tout `:focus-visible` du chrome et des dialogues. Règles
dérivées : (a) dans un panneau qui rogne (lignes de l'arbre, bascules de légende, onglets, rails) l'anneau est tracé **vers l'intérieur** (`outline-offset: -3px`
+ halo `inset`), pour n'être jamais coupé ; (b) sur un **bouton plein Ambre** (« Lecture ») l'anneau reste l'anneau extérieur : un anneau Ambre intérieur
disparaîtrait sur son fond ; (c) l'anneau de la **vue 3D** est **Papier**, jamais Ambre : dans la vue, Ambre veut dire « appareil sélectionné ».

**Sens des couleurs.** Ambre = ce qui est choisi ou ce qu'on peut faire ; jamais pour un état désactivé (désactivé = encre atténuée et **bord en tirets**, le contrôle
reste focalisable avec `aria-disabled`). La couleur n'est jamais seule : une barre, un glyphe, un mot ou un bord double le message (barre Ambre de la ligne choisie,
⚠ ⓘ ⊘ devant les erreurs, « non vérifié » en pastille à bord `ink-muted`).

**Tailles tactiles : la règle des 44 px.** Sous `@media (pointer: coarse)` (un doigt est le pointeur principal), tout contrôle que le doigt peut rencontrer fait **au moins
44 × 44 px** : onglets et « Fermer » du tiroir, outils du cube, fermeture des notes et de la liste d'erreurs, boutons − / + (les réglages passent en une colonne, texte à
16 px pour que iOS ne zoome pas), bascules, « Débrancher », lignes de l'arbre, œil, éléments de menu, sélecteur et « Fermer » du choix de lieu, en-têtes et rails
de panneaux (45 px : 44 + la bordure de 1 px), boutons, pastille et résumés d'Écoute et de couverture. Les deux barres passent à 48 px (un contrôle de 44 px dans une barre
perd 1 px à sa bordure). Avec une souris **rien ne change** (32 / 28 / 28 px, e2e de géométrie à 1366 × 768). `tests/e2e/creation-touch.spec.ts` balaie tous les éléments
interactifs affichés, dans neuf états, et liste ceux qui font moins de 44 px.

**Fenêtres étroites.** Points de rupture : 1200 px (Propriétés démarre repliée, `layout.ts`), 1000 px (la marque et le titre du projet s'effacent), **760 px** (Projet démarre
replié ; la barre d'état ne garde que le message, l'avertissement de sauvegarde en pause et le bouton Signal ; marge des menus réduite), 720 px (le titre du tiroir s'efface), 520 px
(le libellé « Filtrer » du tiroir cède la place à un texte indicatif du même mot), 480 px (boîte « Connecter à… »). Propriétés est **un seul défilement** (`.cr-props`) : aucun
bloc ne défile en lui-même, la rangée de titre reste collée en haut.

**Motif `data-placing` (ne pas le réinventer en JS).** Tant qu'un appareil suit le pointeur, la vue porte `data-placing="true"` (posé par `cancelPlacement.ts`) et **le CSS** réagit :
les notes montent à 68 px, le toast aussi, la liste « appareils non rechargés » se range, la liste d'erreurs (hors de la vue, donc `body:has(.cr-viewport[data-placing='true'])`) monte
au-dessus du bouton « Annuler la pose » (44 px, en bas à gauche de la vue), et la barre d'état retire le nom du lieu pour laisser lire les raccourcis. Même idée pour
l'écran de départ : `.cr:has(.cr-pick:not([hidden]) .cr-pick-close[hidden])` (le choix de lieu sans « Fermer » = rien n'est encore affiché) retire de la barre d'état la sélection, la lecture,
le micro et le bouton Signal (« Rien de branché » y serait lu comme un avertissement).

**Défilement.** Barres fines aux couleurs du chrome (`scrollbar-width: thin`, `scrollbar-color: ink-muted` sur `panel`) pour tout ce qui défile.

## Packages de design

Cinq identités d’accueil du Mode Création, choisies par l’adresse : `?design=1` à `?design=5`. **Sans `?design`, rien de ce qui suit n’existe : le jeu est celui d’aujourd’hui.** Un paquet change l’aspect (couleurs, disposition des panneaux), la première visite et le tutoriel ; il ne change **jamais un résultat de la simulation** (voir « Le mécanisme `?design` et la règle de neutralité »). Tout est local à la branche `design/onboarding-packs` : rien n’est publié. Sources : `src/design/packages.ts` (la table), `src/design/creationTokens.ts` (`RoleColours`, `contrastRatio`), `src/design/packageContrast.ts` (les paires), `src/design/packages.css` (l’application), spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` §7, ADR-0017.

Chaque figure ci-dessous porte sa source. **Calculé** = la formule WCAG 2.1 (`contrastRatio`) appliquée aux couleurs déclarées ; **mesuré** = lu dans un navigateur (Chromium, Windows) sur la page construite ; **non mesuré** est dit comme tel, en dernière sous-section.

### Les cinq identités

Valeurs de `src/design/packages.ts` (`DESIGN_PACKAGES`) ; noms = clés COPY `design.name1` à `design.name5` (« à valider », non affichés dans l’application) ; « meilleur pour » et « risque » = spécification §7.2.

| | 1 Pas à pas | 2 Atelier | 3 Salle d’abord | 4 Pupitre | 5 Modèle d’abord |
|---|---|---|---|---|---|
| Signe distinctif (`tell`) | une seule chose allumée sur un écran sombre | bandeaux Prune de feuille d’étude | une feuille Papier de plein jour | à plat, console à filets, aucun panneau en relief | un cadre Prune autour de la vue 3D |
| Meilleur pour | le débutant | l’étudiant | l’entrepreneur | l’ingénieur | mixte |
| Panneaux Projet / Propriétés au départ | repliés / repliés | ouverts / ouverts | repliés / ouvert | ouverts / ouverts | ouvert / replié |
| Tiroir d’inventaire | reste ouvert | reste ouvert | reste ouvert | se ferme après la pose | se ferme après la pose |
| Densité | confortable | dense | confortable | dense | confortable |
| Style de surface (`data-surface`) | `raised` | `banded` | `sheet` | `flat` | `framed` |
| Coin d’Oscar | bas droit | bas gauche | haut droit | bas droit | bas gauche |
| Raccourcis à côté des commandes | non | oui | non | oui | non |
| Liste « Pourquoi je n’entends rien ? » | pastille | panneau | pastille | pastille | pastille |
| Présentateur principal | fiche d’étape | liste | fiche d’étape | liste | fiche d’étape |
| Oscar | mène, proactif | ne mène pas, proactif | mène, proactif | ne mène pas, en sourdine par défaut | mène, proactif |
| Départ | salle vide neutre | salle vide neutre | salle vide neutre | salle vide neutre | modèle jouable `premier-son-pret` |
| Étapes du tutoriel | dix | dix | dix | dix | trois (`ecoute`, `debrancher`, `rebrancher`) |
| Indice après (`hintAfterMs`) | 20 s | 30 s | 20 s | aucun | 25 s |
| Risque | condescendant | dense en 1366 × 768 | salles non relues après le premier son | un débutant s’y perd | dépend du modèle jouable |

Le profil choisi à l’écran de départ peut ouvrir les panneaux (« J’étudie le son » et « Je travaille dans le son » ouvrent les deux, là où la fenêtre le permet) ; la largeur borne toute ouverture automatique (Projet dès 760 px, Propriétés dès 1200 px ; ADR-0017). La fiche d’étape existe dans les cinq (parité du DOM) ; pour 2 et 4 elle est une compagne plus serrée (`data-presenter`). Aucun paquet ne partage ni sa carte de couleurs ni son préréglage de disposition (`tests/design/packages.test.ts`).

### Les cartes de rôles (19 rôles par paquet)

`RoleColours` (`src/design/creationTokens.ts`) dit à quoi sert une couleur ; la table dit laquelle. Une couleur est une des quatre de marque (Nuit `#131114`, Papier `#F3EDE3`, Ambre `#DD9349`, Prune `#612D45`), un dérivé existant (`panel` `#1C191D`, `panelLine` `#3A3339`, `inkMuted` `#B3AAA0`, `danger` `#F08A7E`, `ok` `#8CCB9B`) ou une des **six** teintes dérivées déclarées dans `packages.ts` (`ALLOWED_COLOURS`) : `#615E5C` (encre atténuée sur Papier), `#E6E0D7` (second ton de la feuille Papier), `#9B2C20` et `#2F6B3E` (erreur et succès sur Papier), `#F7A59B` (erreur sur Prune), `#704055` (lavis sur Prune). Rien d’autre n’est permis (`tests/design/packages.test.ts`).

| Rôle | 1 Pas à pas | 2 Atelier | 3 Salle d’abord | 4 Pupitre | 5 Modèle d’abord |
|---|---|---|---|---|---|
| `ground` (fond d’écran, dialogues) | Nuit | Nuit | Papier | Nuit | Nuit |
| `surface` (panneaux, tiroir, cartes) | panel | panel | Papier | Nuit | Prune |
| `inset` (champ, second ton) | Nuit | Nuit | `#E6E0D7` | panel | Nuit |
| `wash` (ligne survolée ou choisie) | `#3A3339` | `#3A3339` | `#E6E0D7` | `#3A3339` | `#704055` |
| `ink` | Papier | Papier | Nuit | Papier | Papier |
| `inkMuted` | `#B3AAA0` | `#B3AAA0` | `#615E5C` | `#B3AAA0` | `#B3AAA0` |
| `accent` (aplat) | Ambre | Ambre | Ambre | Ambre | Ambre |
| `accentInk` (texte sur l’aplat) | Nuit | Nuit | Nuit | Nuit | Nuit |
| `accentEdge` (bord de l’aplat) | Ambre | Ambre | Nuit | Ambre | Ambre |
| `accentText` (texte d’emphase) | Ambre | Ambre | Prune | Ambre | Papier |
| `secondary` | Prune | Prune | Prune | Nuit | Nuit |
| `secondaryInk` | Papier | Papier | Papier | Papier | Papier |
| `band` (tête de panneau) | panel | Prune | Papier | Nuit | Prune |
| `bandInk` | Papier | Papier | Nuit | Papier | Papier |
| `focus` (anneau) | Ambre | Ambre | Nuit | Papier | Papier |
| `select` (bordures, barres) | Ambre | Ambre | Prune | Ambre | Ambre |
| `line` (filet décoratif) | `#3A3339` | `#3A3339` | `#615E5C` | `#B3AAA0` | `#B3AAA0` |
| `danger` | `#F08A7E` | `#F08A7E` | `#9B2C20` | `#F08A7E` | `#F7A59B` |
| `ok` | `#8CCB9B` | `#8CCB9B` | `#2F6B3E` | `#8CCB9B` | `#8CCB9B` |

Fixe pour les cinq : la barre de menus, la barre d’état, la scène 3D, les angles droits, Tektur pour les titres, IBM Plex Sans pour l’interface ; le guide (Oscar) reste une carte sombre (ADR-0017). Un `line` est un filet : jamais le seul bord d’un contrôle (les contrôles sont bordés en `inkMuted`).

### Contraste

**Règle :** texte ≥ 4,5 : 1, interface (anneau de focus, bordure, barre, bord d’un aplat) ≥ 3 : 1. Chaque paire qu’une carte déclare est **calculée** par `declaredPairs(c)` (`src/design/packageContrast.ts`) puis vérifiée par `tests/design/packageContrast.test.ts` pour les cinq paquets ; un test fabrique une paire Ambre sur Papier et vérifie qu’elle **échoue** (le vérificateur mord). Ambre sur Papier (2,16 : 1) n’est ni du texte ni une limite : c’est le piège du paquet 3, d’où le focus Nuit, la sélection Prune et le bord Nuit de 2 px sur un aplat Ambre.

**D’où viennent les chiffres.** Le test affirme les *seuils*, pas les rapports exacts (il écrit seulement 2,16 pour Ambre sur Papier). Les rapports ci-dessous sont les chiffres *calculés* inscrits dans la spécification §7.3 (calculés le 2026-11-12), dans les commentaires de `src/design/packages.ts` (teintes dérivées) et dans l’ADR-0017 (lavis) ; la colonne « Source » dit lequel. Aucun n’a été recalculé pour ce document.

| Paire (premier plan sur fond) | Rapport | Besoin | Paquets | Source |
|---|---|---|---|---|
| Papier sur Nuit (texte, anneau du paquet 4) | 16,13 | texte 4,5 ; anneau 3 | 1, 2, 4, 5 (fond), 4 (anneau) | spéc. §7.3 |
| Papier sur panel (texte courant) | 14,95 | 4,5 | 1, 2 | spéc. §7.3 ; `creationTokens.ts` (en-tête) |
| `inkMuted` sur panel / sur Nuit | 7,61 / 8,21 | 4,5 | 1, 2, 4 | spéc. §7.3 |
| Ambre sur panel (anneau, sélection, emphase) | 6,92 | texte 4,5 ; interface 3 | 1, 2, 4 (second ton) | spéc. §7.3 |
| Ambre sur Nuit (sélection, emphase) | 7,46 | 4,5 | 1, 2, 4 | spéc. §7.3 |
| Nuit sur Ambre (texte d’un aplat Ambre) | 7,46 | 4,5 | 1 à 5 | spéc. §7.3 ; ADR-0017 |
| Papier sur Prune (texte d’une bande ou de la fiche, anneau sur bande) | 9,16 | 4,5 / 3 | 1, 3 (fiche, liens), 2 (bande), 5 | spéc. §7.3 |
| `inkMuted` sur Prune | 4,66 | 4,5 | 2 (bande), 5 | spéc. §7.3 ; `onboarding-contrast.spec.ts` en imprime la lecture |
| Ambre sur Prune (barre, bord d’aplat : **interface seulement**) | 4,24 | 3 (pas du texte : 4,24 < 4,5) | 2 (bande), 5 | spéc. §7.3 ; `packageContrast.test.ts` (paire fabriquée : texte refusé, interface acceptée) |
| Nuit sur Papier (encre, anneau, bord d’aplat) | 16,13 | 4,5 / 3 | 3 | spéc. §7.3 |
| Prune sur Papier (sélection, liens, emphase) | 9,16 | 4,5 / 3 | 3 | spéc. §7.3 ; ADR-0017 |
| `#615E5C` sur Papier / sur `#E6E0D7` | 5,53 / 4,90 | 4,5 | 3 | `packages.ts` (commentaire de `D`) |
| Nuit sur `#E6E0D7` / Prune sur `#E6E0D7` | 14,32 / 8,13 | 4,5 / 3 | 3 | `packages.ts` (commentaire de `D`) |
| `#9B2C20` (erreur), `#2F6B3E` (succès) sur Papier | 6,50 ; 5,48 | 4,5 | 3 | `packages.ts` (commentaire de `D`) |
| `#F7A59B` (erreur) sur Prune | 5,49 | 4,5 | 5 | `packages.ts` (commentaire de `D`) |
| Lavis `#3A3339` : encre / barre Ambre / contre le panneau | 10,53 / 4,87 / 1,42 | 4,5 / 3 / (visible : ≥ 1,25) | 1, 2, 4 | ADR-0017 ; `packageContrast.test.ts` (≥ 1,25) |
| Lavis `#704055` : encre / barre Ambre / contre le panneau | 7,06 / 3,27 / 1,30 | 4,5 / 3 / (≥ 1,25) | 5 | `packages.ts` (commentaire de `D`) ; ADR-0017 |

Les paires les plus justes : `inkMuted` sur Prune 4,66 (marge de 0,16 sur 4,5), la barre du lavis du paquet 5 à 3,27 (marge de 0,27 sur 3 ; une teinte plus claire la ferait passer sous 3) et Ambre sur Prune 4,24 (interface seulement). **Jamais du texte** (spéc. §7.3 et `packageContrast.test.ts`) : l’erreur et le succès clairs sur Papier (2,09 et 1,62), Prune sur Nuit (1,76), `panelLine` sur Nuit (1,53) ; l’encre sur `line` aux paquets 4 et 5 fait 1,97 (le test exige moins de 2,2 : c’est pourquoi `line` n’est jamais un remplissage).

**Mesuré dans le navigateur.** `tests/e2e/onboarding-contrast.spec.ts` lit les styles calculés de la page, par paquet, dans six états (écran de départ, lieux, salle avec tiroir, Propriétés et arbre ouverts, une boîte de dialogue, les deux fenêtres flottantes) : anneau de focus = rôle `focus` du paquet à ≥ 3 : 1 contre son fond ; bordure de survol = `select` ≥ 3 ; texte de survol = `accentText` ≥ 4,5 ; **aucun** élément ne résout Ambre en texte, contour, bordure ou barre là où il ne se lit pas (paquet 3 : Papier) ; **tout** texte visible ≥ 4,5 sur son fond calculé ; axe `color-contrast` propre dans les cinq paquets. Ce que ce test ne mesure pas : l’anneau Ambre du guide sur Papier (voir plus bas).

### Équilibre Nuit / Papier / Ambre / Prune

Le « signe » de chaque paquet est celui de la spécification §7.2. Le test du plissement des yeux (`tests/e2e/onboarding-visual.spec.ts`, spéc. §11.7) réduit la capture de la salle de chaque paquet (vue 3D masquée en magenta, Oscar caché dans la seconde passe) et compte, sur une grille de 128 × 72 cellules, la part de chaque famille. Une cellule est rangée dans une famille à moins de ΔE 12 de ses couleurs de référence ; la famille Nuit inclut `panel` et `panelLine`, Papier inclut `#E6E0D7`, Prune inclut `#704055`. Chiffres **mesurés** (1366 × 768, première salle, étape 1), identiques sur six exécutions ; source : rapport G14d (non versionné) et `KNOWN_BALANCE` du fichier de test.

| Paquet | Nuit | Papier | Ambre | Prune | Part de Prune **déclarée** (spéc. §7.2) | Écart |
|---|---|---|---|---|---|---|
| 1 Pas à pas | 89,6 % | 0 | 0,4 % | 10,0 % | environ 3 % | **hors de la ligne** (+7 points) |
| 2 Atelier | 92,0 % | 0 | 0,3 % | 7,7 % | environ 20 % | **hors de la ligne** (−12 points) |
| 3 Salle d’abord | 25,3 % | 74,3 % | 0,3 % | 0,0 % | seulement en sélection, liens et emphase | conforme (l’encre est Nuit) |
| 4 Pupitre | 99,7 % | 0 | 0,3 % | 0,0 % | 0 % | conforme |
| 5 Modèle d’abord | 45,7 % | 0 | 0,2 % | 54,1 % | environ 45 % | **hors de la ligne** (+9 points) |

« Environ N % » se lit N ± 5 points dans le test (`ABOUT_PTS`). Le test fixe les trois écarts par leur nom (`KNOWN_BALANCE`) : il échoue le jour où l’un disparaît ou qu’un autre apparaît. **À regarder à l’écran** (décision du fondateur) : le paquet 1 a plus de Prune que prévu, le paquet 2 beaucoup moins (les bandeaux sont fins). Les paquets se distinguent bien : la paire la plus proche, 2 contre 4, diffère sur **14,2 %** des cellules de la grille de 32 × 18 (seuil 8 %) ; toutes les autres paires font 33 % ou plus (avec Oscar caché : 1-2 33,2 %, 1-3 60,9 %, 1-4 37,5 %, 1-5 50,3 %, 2-3 67,5 %, 2-5 61,5 %, 3-4 67,5 %, 3-5 67,5 %, 4-5 56,1 % ; source : rapport G14e, S5).

### Le mécanisme `?design` et la règle de neutralité

- **Une adresse, un paquet.** `designFromSearch` (`src/design/packages.ts`) accepte exactement une clé `design` valant `1` à `5` ; rien d’autre ne compte (aucune, deux, `0`, `6`, `01`, vide : le jeu d’aujourd’hui). `applyDesignAttribute` écrit `data-design` sur `<html>` ; le paquet n’est **jamais mémorisé** et on change de paquet en changeant l’adresse (rechargement), pas à chaud.
- **Pratique seulement.** L’aspect et la disposition ne s’appliquent que sur une adresse de pratique : `src/main.ts` pose la classe `cr-practice` sur `<html>` quand il n’y a ni `mode`, ni `level`, ni `legacy` ; `lookOfRoot` exige `data-design` **et** cette classe. Une adresse d’examen avec `?design` porte l’attribut et ne change ni couleur, ni panneau, ni tiroir (`tests/e2e/design-attribute.spec.ts`, `tests/design/packages.test.ts`).
- **Comment une carte devient du CSS.** `injectCreationTokens(root, roles?)` écrit la carte en `--cr-role-*` ; `packages.css` re-pointe les jetons résolus (`--cr-focus`, `--cr-select`, `--cr-accent`…) **à l’intérieur** des surfaces qu’un paquet restyle (panneaux, tiroir, sélecteur, dialogues, fenêtres flottantes). La feuille sélectionne sur `data-surface`, `data-density`, `data-drawer`, `data-shortcuts` (écrits par `applyLookAttributes` d’après la disposition du paquet), jamais sur un numéro de paquet : aucune règle CSS de `src` ne contient `data-design`.
- **Neutralité : un seul moteur.** Les cinq paquets sont des *données* (`DESIGN_PACKAGES`, un tableau **gelé en profondeur** : `deepFreeze`, et `tests/design/packages.test.ts` vérifie qu’une écriture dans un objet partagé lève une erreur au lieu de fuir dans les quatre autres) lues par les mêmes composants, qui lisent des **champs** du paquet actif, jamais son numéro. Le garde-fou `tests/design/noDesignBranching.test.ts` refuse, hors `packages.ts`, `design ===`, `switch (design)`, une lecture de `data-design`, `DESIGN_PACKAGES[`, `pkg.id === <nombre>`, `packageById(<littéral>)` et la lecture de la clé `design` de l’adresse (limite dite dans le test : le balayage est ligne par ligne, un numéro copié d’abord dans une variable n’est pas vu). Le moteur, le chemin du signal, les contrôles R4 à R8 et le magasin n’importent jamais les paquets ni le code d’accueil (`tests/engineImports.test.ts`, graphe d’imports suivi jusqu’au bout), n’ont aucune différence avec `ee396da` (`tests/engineDiff.test.ts`), et un même banc donne les mêmes sorties du moteur sur `/` et sur `/?design=1..5` (`tests/e2e/engine-neutrality.spec.ts`, comparateur prouvé capable d’échouer). Ajouter un paquet ou changer une couleur = éditer la table ; si une paire déclarée tombe sous son seuil, le test dit laquelle.

### Ce qui n’est pas mesuré

- **Aucun passage humain** : ni regard sur écran des cinq équilibres, ni lecteur d’écran, ni apprenant réel. Les contrastes sont calculés et lus dans Chromium, pas jugés par une personne.
- **Couleurs forcées** (mode contraste élevé de Windows) : non mesurées pour les paquets.
- **Largeur de 375 px** : non mesurée pour les paquets (la géométrie d’Oscar est mesurée à 1366 × 768, 1024 × 768 et 820 × 1180).
- **L’anneau Ambre du guide sur Papier** (paquet 3) : choix de conception, ni l’anneau ni son halo Nuit ne sont mesurés contre Papier ; décision ouverte du fondateur (ADR-0017).
- **Les captures de référence** (`onboarding-visual.spec.ts`) ne sont faites que sous Windows (`-win32.png`) et **la scène 3D n’y est pas** : la vue 3D est masquée ; le style de la scène n’est donc pas protégé par ces images.
- Trois paquets ont une part de Prune hors de la ligne déclarée (tableau ci-dessus).

## HUD

Cartes blanches `surface` + bord `surfaceBorder` + `elev-card`, rayon `md`.
Pills de niveaux (accent = actif). Checklist : cases → ✓ `success` rempli.
Toasts : carte blanche, liseré gauche sémantique 4px, titre uppercase.
Win screen : scrim `overlay` + blur léger, carte `radius-lg` + `elev-raised`.
Toggles : switch 28×16 (blanc sur `success` quand ON). Matrice de routage : cellules 18px, accent quand routé.

## À relire par Oscar (jugements design de la nuit)

- Le choix d'accent #2E5FE6 (bleu) — alternative naturelle : un vert studio.
- Cartels port-labels : micro-cartes blanches par port — un peu de bruit en vue
  large sur les racks denses (D1) ; option : ne les afficher qu'au hover/drag.
- Poids visuel des blobs d'ombre (0.20) — assombrir/alléger au goût.
