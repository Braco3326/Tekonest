# Teknest Design System — v1 (night run 2026-07-17)

> Source de vérité visuelle : `src/design/tokens.ts` (LE fichier unique de tokens).
> Direction : VISION_TekPractice-Game.md §6 — blanc galerie, calme, premium
> (Teenage Engineering × Apple × vrai studio). Le blanc est un dispositif
> pédagogique : il baisse l'anxiété (StudentJourney Beat 1) et fait du matériel
> réel le héros. JAMAIS de valeur en dur hors tokens.

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
