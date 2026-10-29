# ASSET_LOG — track assets 3D

## 2026-07-15 — Run 1 : arrêt propre (Blender MCP injoignable)

**Consigne :** générer le connector kit + devices via le Blender MCP, run autonome,
skip-on-error, arrêt propre si MCP injoignable 3× de suite.

**Résultat : ARRÊT PROPRE avant le premier asset.**

| Tentative | Vérification | Résultat |
|---|---|---|
| 1 | ToolSearch `+blender` | aucun outil |
| 2 | ToolSearch `3d model mesh scene export glb` | aucun outil Blender (résultats Figma/Canva non pertinents) |
| 3 | ToolSearch `+mcp blender cube primitive modeling` | aucun outil |

**Cause :** le serveur Blender MCP était configuré sur le Mac Studio (cf.
Claude-Code-Prompt-Pack.md). Cette session tourne sur le PC Windows — aucun
serveur MCP Blender n'y est enregistré dans Claude Code.

**Constat matériel :** Blender **5.1** est installé localement
(`C:\Program Files\Blender Foundation\Blender 5.1`), mais pas sur le PATH.

**Options pour relancer le track :**
1. **Fallback CLI headless (recommandé, dispo immédiatement)** — scripts Python
   `bpy` exécutés via `blender --background --python <script>` : mêmes
   conventions (mètres 1:1, origine fonctionnelle, −Y mating, empties
   `port_<portId>`, single PBR, export .glb), même pipeline
   (export → gltf-transform → vignette → commit par asset → manifest).
   Nécessite : `npm i -D @gltf-transform/cli` pour l'optimisation Draco/KTX2.
2. Installer/configurer un serveur Blender MCP sur ce PC (`claude mcp add`),
   puis relancer la consigne d'origine telle quelle.

**Aucun asset généré, aucun fichier modifié dans public/assets/.**

## 2026-07-15 18:31 - Run 2 : batch CLI headless (Blender 5.1)

- 50/50 assets generes (voir public/assets/ASSET_MANIFEST.json)
- Echecs: aucun
- Pipeline: blender --background + gen_asset.py -> gltf-transform draco -> vignette -> commit/push par asset

## 2026-07-16 - Run 3 : incremental via Blender MCP live (connecte, port 9876)

Decisions loggees (consigne : incremental, pas de no-op) :
- Les 50 glb du Run 2 sont conformes (ids, empties port_*, budgets, Draco) -> PAS de regeneration aveugle.
- Delta reellement genere : les 5 MICROS, jusqu'ici geometriquement identiques, differencies via le MCP live :
  sm57 (grille plate) 400 tris - sm58 (boule) 744 - re20 (gros corps beige + anneaux) 868 - re50 (boule mousse ENG) 468 - u87 (corps nickel + panier) 636.
  Chacun : export selection-only -> gltf-transform draco -> vignette EEVEE fond clair -> verif vision -> commit "asset: <id>" -> push.
- NOUVEAU : DeviceSpawner charge public/assets/<id>.glb par-dessus les placeholders (couche scene, engine intact, non bloquant).
  Verifie : 4 niveaux, 0 warning de chargement (local) - box masquee, marqueurs/labels conserves.
- Integrite round-trip : les 45 autres glb importes dans Blender live (Draco decode OK 45/45) et re-rendus en vignettes EEVEE couleur.
  Piege corrige : clip_start camera 0.1m par defaut coupait entierement les connecteurs de 2-3 cm -> clip 1mm.
- Pieges d'export MCP corriges : l'exporteur glTF embarquait le Cube de la scene utilisateur (use_active_scene=True + use_selection=True obligatoires)
  et les orphelins des runs rates suffixaient les noms d'objets (.001) -> purge + verif name_ok par asset.
- Scene utilisateur Blender intacte (Camera/Cube/Light).

Skips (loggés, pas des echecs) :
- 45 glb non regeneres (deja conformes, aucune evolution de recette).
- Kit connecteurs : pas consomme par le runtime v1 (les extremites de cable sont des tubes ; visuels de connecteurs = P2 CableRenderer).
- Budget "appareils 800-4000 tris" traite comme un PLAFOND (les micros simples restent sous 800 sans perte de lisibilite).

Restant :
- Verif prod : attendre que la file de builds Vercel serve le dernier commit (hash bundle).
- P2 : recettes v2 pour consoles/speakers (details), visuels de connecteurs sur les cables, orientation fine des glb par device.

## 2026-10-25 — Polices du Mode Création (Task 14b, décision P12)

Auto-hébergées via npm (aucun téléchargement à l'exécution), importées par `src/creation/boot.ts` ;
les woff2 sont copiés dans `dist/assets/` au build. Les deux sont sous SIL Open Font License 1.1 (OFL) :
usage, intégration et redistribution libres, pas de vente seule des polices, noms réservés non réutilisés
pour une version modifiée (nous ne les modifions pas). Texte de la licence : `node_modules/@fontsource/<nom>/LICENSE`.

| Police | Paquet (version) | Graisses chargées | Source | Copyright | Licence |
|---|---|---|---|---|---|
| Tektur | `@fontsource/tektur` 5.3.0 | 600 | https://fontsource.org/fonts/tektur — amont https://github.com/hyvyys/Tektur | © 2023 The Tektur Project Authors | OFL-1.1 |
| IBM Plex Sans | `@fontsource/ibm-plex-sans` 5.3.0 | 400, 500 | https://fontsource.org/fonts/ibm-plex-sans — amont https://github.com/IBM/plex | © 2019 IBM Corp. | OFL-1.1 |

Règle d'usage (Tasks 12 et 14b) : Tektur seulement pour les titres sans accent (marque, titre du projet,
« Choisir un lieu ») ; tout titre qui porte du français accentué (« PROPRIÉTÉS », « Aucune sélection »,
noms de lieux) est en IBM Plex Sans 500, car l'aigu de Tektur se lit comme un macron (« Ē ») aux petites tailles.

## 2026-10-28 — Multiprise secteur générique (Task 32, décisions C7 / P18)

Nouvel appareil du catalogue : `multiprise-secteur` (4 sorties IEC C13 `out-1..4`, drapeau `isMainsSource`). **Modèle 3D : pas généré.**
Ni Blender ni ffmpeg sur le poste qui a fait la tâche ; la règle P18 du plan l'autorise : la **boîte provisoire** (placeholder) est
livrée et l'appareil est déjà dans l'onglet « Secteur » du tiroir. `npm run validate:catalog` le dit par un avertissement
(`no public/assets/multiprise-secteur.glb: the placeholder box ships`), pas par une erreur.

À faire (tekdesigner, poste avec Blender) : une multiprise générique simple, œuvre propre sans marque, via `tools/blender/gen_asset.py`
(même chaîne que les autres glb), export `public/assets/multiprise-secteur.glb` ≤ 200 Ko, et une vignette
`public/assets/thumbs/multiprise-secteur.png` (sans elle le tiroir montre la silhouette ; `tests/creation/inventoryThumbs.test.ts`
attend `thumbPath('multiprise-secteur') === null` tant qu'elle n'existe pas : à mettre à jour avec la vignette).

## 2026-10-29 — Chansons de démonstration (Task 38, décisions S3 / P13)

**Aucune chanson n'est livrée pour l'instant.** `content/songs.json` vaut `[]` et `public/audio/songs/` n'existe pas.
Raison : aucune piste n'a encore été vérifiée sur sa page (texte de la dédicace CC0 / domaine public lisible, URL de licence
notée) et approuvée par le fondateur ; sans cette preuve, rien n'est téléchargé ni lié. Le Mode Création s'appuie donc sur le
signal de test généré (`src/audio/testSignal.ts`, œuvre propre) et sur « Choisir un fichier audio… » (fichier local, jamais envoyé ni conservé).

Règles pour ajouter une chanson plus tard (2 à 3 pistes au plus, 3 Mo maximum chacune, mp3 de préférence, ogg accepté) :
- Licence exactement `CC0-1.0`, page de la piste et page de licence ouvertes et lues ; l'URL de licence est notée ici.
- **Pixabay n'est pas CC0** (licence propre à Pixabay) : ne jamais l'utiliser.
- Chaque piste a UNE ligne dans ce fichier qui contient à la fois son chemin (`audio/songs/<nom>.mp3`) et son URL de licence, plus sa
  source, la date de récupération et son SHA-256 ; la même entrée existe dans `content/songs.json`.
- `npm run validate:songs` (et `tests/audio/songs.test.ts`) vérifient : fichier présent, taille égale à `bytes` et ≤ 3 Mo, SHA-256 égal,
  licence `CC0-1.0`, ligne présente dans ce journal. Ajouter une entrée est une édition de contenu, sans changement du moteur.
