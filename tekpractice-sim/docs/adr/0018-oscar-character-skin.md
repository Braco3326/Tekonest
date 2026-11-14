# ADR-0018 — Le nouvel Oscar : un personnage hôte posé sur le widget fourni, sans patch du code fourni

- **Status:** Accepté par défaut — en attente de validation du fondateur (paquets d’accueil, 2026-11-13). Le badge `oscar.badge` est « à valider (tekuxwriter) ».
- **Amendé le 2026-11-14 (G15b)** après relecture contre le code : la section « Ce qui n’est pas mesuré » est complétée (états hors « point », place par rapport à l’appareil montré, absence d’Oscar au chargement).
- **Sources :** spécification `docs/superpowers/specs/2026-11-12-onboarding-packs-design.md` (§9, §10.1 à §10.3, §11 items 5 et 6, erratum T5 du 2026-11-13) ; plan `docs/superpowers/plans/2026-11-12-onboarding-packs.md` (T5.1 à T5.5) ; `src/guide/character.ts`, `src/guide/character.css`, `src/guide/skin.ts`, `src/guide/mount.ts`, `src/guide/theme.css`, `src/guide/restore.ts`.

## Contexte

Le guide Oscar est du code fourni (`src/guide/vendor/**`, figé par empreinte dans `VENDOR.json`, trois patchs connus dans `VENDOR-PATCHES.md`). Sa mascotte (`ui/mascot.ts`) est une tête ronde ; le fondateur veut un personnage propre à la marque : **le casque est le personnage**. `mountGuide` fabrique sa mascotte lui-même et n’a pas d’option d’habillage. Aucun nouveau patch du code fourni n’est permis.

## Décision

### Le personnage

`src/guide/character.ts` construit le SVG par appels DOM (ni `innerHTML`, ni image, ni URI de données) : un arceau Ambre, une tête Papier, deux écouteurs Ambre, un contour Nuit, une pièce Prune, un bras à main carrée, un voyant de veille. Le SVG est décoratif (`aria-hidden`) ; le bouton garde son nom « Oscar, assistant IA ». L’état dessiné est une fonction pure de l’état du contrôleur fourni et d’un état hôte (`stateFor`), avec un seul minuteur (`step`), effacé à la destruction. `character.css` porte la feuille de mouvement : chaque animation est finie ; les boucles infinies fournies (anneau, mascotte) sont arrêtées sous la classe hôte, sans `!important`, donc les règles « mouvement réduit » fournies l’emportent toujours.

### La couture (skin.ts)

- La classe hôte `tp-oscar-host` va sur la racine `.oscar-guide` (l’anneau est un frère de l’icône, pas un enfant).
- Le SVG du personnage est ajouté dans `.oscar-icon` et prend toute la boîte de 56 px ; `theme.css` cache `svg.oscar-mascot`, rend le fond de l’icône transparent, sans bordure ni ombre (la pièce Prune du personnage est la seule pièce).
- **Un seul `MutationObserver`, attributs seulement, aucun écouteur d’événement** : `data-state` sur `svg.oscar-mascot` (là où le `setState` fourni l’écrit), `style` / `hidden` de l’anneau principal et `style` de `.oscar-icon-wrap` (pour l’orientation du bras), `aria-expanded` de l’icône (la première ouverture fait un salut). Le nombre d’écouteurs de page épinglé dans `guide-creation.spec.ts` ne change pas.
- Le bras pointe vers l’anneau : `data-dir` (est, ouest, nord, sud) d’après le relèvement centre de l’icône → centre de l’anneau ; la plus grande composante l’emporte, l’égalité va à l’horizontale (cas diagonal figé dans `tests/guide/skin.test.ts`).
- **Test d’épinglage** (`tests/guide/mount.test.ts`) : il cite les appels fournis exacts (`.oscar-guide`, `.oscar-icon-wrap`, `.oscar-icon`, `aria-expanded`, `svg.oscar-mascot` et son `setAttribute("data-state", …)`, `.oscar-ring` et `.oscar-ring-drop`, `.oscar-header`, `.oscar-title`, la règle de boîte `.oscar-mascot`, la clé de sourdine). Si une nouvelle livraison renomme une pièce, le test échoue ; à l’exécution, une pièce absente n’attache rien et la mascotte fournie revient.

### Portée

Le nouvel Oscar n’existe qu’en Mode Création **avec `?design=1..5`, en pratique** (la même adresse qui applique l’aspect d’un paquet). L’adresse sans `?design` et la page de niveau gardent la mascotte fournie, telle qu’aujourd’hui ; examen et `?oscar=0` : pas d’Oscar du tout. **Décision ouverte du fondateur :** adopter le nouvel Oscar sur l’adresse sans `?design` une fois un paquet choisi.

### États hôtes et événements

- Le contrôleur fourni émet sept états ; `no` est dessiné en haussement d’épaules (`shrug`). L’hôte ajoute `nod` (une étape faite, une connexion acceptée ensuite), `wave` (la première ouverture de la bulle dans la page), `celebrate` et `shrug` (une connexion refusée). Rangs : `celebrate` > `shrug` > `nod` > `wave` ; un état plus bas ne coupe pas un état plus haut en cours. `celebrate`, `no` et `sleep` du contrôleur l’emportent sur tout état hôte (un Oscar en sourdine ne célèbre rien).
- **Célébrer avec parcimonie (spec §10.2) :** seulement la première connexion acceptée et le premier son de la page. Une fois ces deux célébrations faites, le `celebrate` fourni de fin de parcours est dessiné comme un `nod` (il tombe au même moment que le premier son à la fin du tutoriel ; le compte exact, 2, est vérifié dans le navigateur). Avant, il reste une célébration.
- Le pont ajoute trois événements qui ne vont jamais au contrôleur fourni : `connectRefused` (le compteur `connectRefusals()` de Mode Création monte : `history.onRefused`, CONNECT seulement), `profileChosen` (le profil de l’accueil change) et `appChange` (le changement du relevé vient de l’application : annulation, rétablissement, chargement d’un lieu, d’un projet ou d’un modèle — une entrée `APPLY_DESIGN` —, ou l’aide au branchement). Les câbles d’un `appChange` ne sont ni célébrés ni salués ; une restauration de plus de `RESTORE_BURST` appareils (`src/guide/restore.ts`, une seule constante) non plus.
- Une étape passée par la puce « Passer cette étape » n’est pas saluée ; le drapeau ne vaut que pour le changement de tutoriel qui suit le clic, et seulement si un tutoriel tourne.

### Sourdine par défaut

- Au premier montage, tant que rien n’est enregistré sous `oscar-guide.state.v1.muted`, le contrôleur lit « 1 » pour le paquet 4 (`proactive: false`) et pour le profil « Je travaille dans le son » (`metier`) : `muteDefaultStorage` autour du stockage du tutoriel. La valeur par défaut n’est jamais écrite ; un choix de l’apprenant (« 0 » après « Réactiver ») l’emporte toujours.
- **Le profil choisi après le montage** (l’écran de départ est ouvert quand le guide arrive) : une fois par page, si rien n’est enregistré et qu’aucune bulle n’est ouverte, l’hôte envoie les puces fournies `mute` puis `close`, puis **retire aussitôt** le « 1 » que la sourdine fournie a écrit (la clé n’a pas de portée par paquet : sinon l’adresse sans `?design` et un profil changé par la puce resteraient en sourdine). La page reste en sourdine (en mémoire du contrôleur) ; le montage suivant redérive la valeur du profil.
- En sourdine, le tutoriel garde son texte : le démarrer ouvre la bulle de l’étape 1, et les étapes suivantes rafraîchissent la bulle ouverte (vérifié dans le navigateur pour le paquet 4 et pour le profil `metier`). Ce qui manque en sourdine : une fois la bulle fermée, ni relance ni indice automatique.

### Le badge et le titre répété

Un `<span class="tp-oscar-badge">` « Oscar · Assistant » (COPY `oscar.badge`, 12 px) est posé juste après `.oscar-title` dans l’en-tête de la bulle. Le titre fourni dit déjà « Oscar, assistant IA » : le badge est `aria-hidden` (le titre porte le sens pour un lecteur d’écran) et la répétition visuelle est un défaut connu. **Question ouverte du fondateur (« IA ») :** garder « IA » (le cerveau est une recherche par mots-clés, sans modèle ni réseau), ou titre « Oscar » + badge « Assistant ».

## Ce qui n’est pas mesuré

- Les couleurs forcées : l’icône garde un contour (`outline` CanvasText, vérifié), mais les remplissages du SVG (attributs de présentation) ne sont pas vérifiés sous couleurs forcées dans Chromium.
- L’en-tête de la bulle à 375 px de large avec le badge.
- La cible de clic : un cercle de 56 px, alors que le personnage visible fait environ 46 px ; les coins montrent la scène 3D (à l’étape 4, l’icône se pose sur le bord de la console).
- Le pointage pendant la transition de 220 ms du bras (les mesures se font en mouvement réduit, poses statiques).
- **Les états autres que « point » dans une image** : les images fixes du storyboard sont prises au repos, donc toutes dans la pose « point » ; le hochement, le salut et la célébration ne figurent dans aucune capture (la silhouette à 24 px, elle, est mesurée pour quatre états : `tests/e2e/character.spec.ts`, spéc. §11.6).
- **La place du personnage par rapport à l’appareil montré** n’est pas une propriété du dessin : relevé à 1366 px, l’icône repose sur l’appareil visé (0 à 4 px de l’anneau) aux paquets 2, 3 et 4 (aux étapes 4, 6 et 8 pour 2 et 4 ; à l’étape 9 pour 2, 3 et 4), et la bulle ou l’icône couvrent le centre de la vue aux paquets 2, 3 et 4 (`tests/e2e/onboarding-geometry.spec.ts`, listes `KNOWN_*`, ADR-0021).
- **Un Oscar qui ne se charge pas** : le guide démarre après la coque et attend neuf modules paresseux sans délai ni repli ; un morceau qui reste ouvert laisse l’apprenant sans Oscar et sans message (cas non reproduit en 390 chargements ; `tests/e2e/onboarding-mount-rate.spec.ts` mesure 30 visites sans échec sur une machine).
- **Aucune personne** n’a vu le personnage bouger : les mesures sont des programmes (silhouette, mouvement fini, mouvement réduit), pas un regard.

## Conséquences

- Changer le dessin, la feuille de mouvement ou les règles de célébration est une édition hôte ; le code fourni ne change pas.
- Une nouvelle livraison du guide passe d’abord le test d’épinglage ; une structure changée sous des noms gardés se voit au premier e2e (la mascotte fournie revient, pas de badge).
