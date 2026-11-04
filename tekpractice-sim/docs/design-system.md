# Teknest Design System — v1 (night run 2026-07-17)

> Source de vérité visuelle : `src/design/tokens.ts` (LE fichier unique de tokens).
> Direction : VISION_TekPractice-Game.md §6 — blanc galerie, calme, premium
> (Teenage Engineering × Apple × vrai studio). Le blanc est un dispositif
> pédagogique : il baisse l'anxiété (StudentJourney Beat 1) et fait du matériel
> réel le héros. JAMAIS de valeur en dur hors tokens.
>
> **Deux systèmes.** Cette page décrit d'abord le système historique (blanc, `--tk-*`). Le Mode Création a le sien (Nuit / Papier / Ambre / Prune,
> `--cr-*`, angles droits) : voir « Mode Création chrome » plus bas, et « Scène 3D — Mode Création » pour la vue.

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
