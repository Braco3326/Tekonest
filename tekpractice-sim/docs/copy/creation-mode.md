# Copy deck — Mode Création

Owner: **tekuxwriter**. Source of truth for every `copy.ts` string; the R1–R8 rule texts are catalog data (`content/catalog.json`, see « Textes des règles »). `src/creation/copy.ts` mirrors the deck key by key (`tests/creation/copyDeck.test.ts` checks both match). Change both together.

Rules: French first, English technical terms kept as students meet them (XLR, Dante, gain, fader, mute). Short, concrete, never blaming. No string ships with `[À REMPLACER`.

Status column:
- **brief** — wording given verbatim by the plan (Task 7 brief / council), validated with it.
- **validé** — reviewed and accepted (or rewritten) by tekuxwriter; the Phase 1 pass (L9) signed off every string authored by tekfrontenddesigner.
- **à trancher (Oscar)** — tekuxwriter could not decide alone; the question is in the notes column.

Typography: plain spaces before « : ; ! ? » and inside « » (no U+00A0 / U+202F), as every shipped string does.

## shell

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `shell.skip` | Aller à la vue 3D | brief | Lien d'évitement, premier arrêt Tab (C10) |
| `shell.menubar` | Menu principal | brief | `aria-label` de la barre de menus |
| `shell.untitled` | Projet sans titre | validé | Titre du projet tant qu'il n'a pas de nom (C16 le rendra éditable) |
| `shell.tree` | Projet | brief | Panneau gauche (landmark `nav`) |
| `shell.props` | Propriétés | brief | Panneau droit (landmark `aside`) |
| `shell.treeCollapse` | Replier le panneau Projet | brief | Bouton, panneau ouvert |
| `shell.treeExpand` | Déplier le panneau Projet | brief | Bouton, panneau replié (rail 32 px) |
| `shell.propsCollapse` | Replier le panneau Propriétés | brief | Bouton, panneau ouvert |
| `shell.propsExpand` | Déplier le panneau Propriétés | brief | Bouton, panneau replié |
| `shell.canvas` | Vue 3D : flèches = orbiter, [ ] = appareil suivant/précédent, Entrée = cadrer, 1 2 3 = points d’écoute | brief ; « 1 2 3 » à valider (tekuxwriter) | `aria-label` du canvas (touches livrées en Task 8 ; 1 2 3 en Task 20, lues par position : la touche « & 1 » en AZERTY) |
| `shell.propsEmpty` | Sélectionnez un appareil pour voir ses réglages. | validé | Propriétés : état vide |
| `shell.statusNoPlace` | Choisissez un lieu pour commencer. | validé | Barre d'état, avant le premier lieu |
| `shell.statusLoading` | Chargement du lieu… | validé | Barre d'état pendant un changement de lieu (`role="status"`) |
| `shell.statusReady` | Prêt | validé | Barre d'état, lieu affiché |
| `shell.siteBack` | Retour au site Tekonest | validé | Lien vers le site, à droite de la barre du haut (même nom accessible que l'ancien `#site-link`) |
| `shell.brand` | TekPractice | validé | Nom du produit, non traduit |
| `shell.appTitle` | TekPractice, Mode Création | validé | Task 8 : `h1` de la page, visuellement masqué (navigation par titres au lecteur d'écran ; le sélecteur de lieu passe en `h2`) |
| `shell.statusSelected` | Sélectionné : {device} | validé | Task 8 : barre d'état (`role="status"`, annoncé) après `[` / `]` dans la vue 3D ; `{device}` = nom catalogue de l'appareil |
| `shell.statusNoSelection` | Aucun appareil sélectionné | validé | Task 8 : barre d'état, Échap dans la vue 3D a vidé la sélection |
| `shell.statusNothingToSelect` | Aucun appareil à sélectionner : ce lieu est vide. | validé | Task 8 : barre d'état, `[` / `]` pressé sans matériel installé (retour sur chaque touche manquée). L9 : ne renvoie plus vers l'inventaire, encore inactif ; rajouter « Ajoutez-en depuis l’inventaire. » quand il existera |
| `shell.statusBusy` | Un lieu est déjà en cours d’ouverture. Patientez un instant. | validé | Task 12 : barre d'état (annoncé) quand un lieu est demandé pendant qu'un autre s'ouvre (résultat « busy ») |
| `shell.statusReplaced` | Matériel remplacé. Appareils installés : {n}. {undo} pour revenir en arrière. | validé | Task 12 (revue) : barre d'état (annoncé) après « Remplacer le matériel » ; `{undo}` = libellé de la touche Annuler (« Ctrl+Z ») |
| `shell.statusGearLoaded` | Appareils installés : {n}. | validé | Task 12 : barre d'état (annoncé) après un modèle ou « Avec le matériel du modèle ». L9 : forme « libellé : nombre », juste au singulier comme au pluriel |

## keys

Noms de touches affichés à droite des entrées de menu (carte des touches, Task 8). Les lettres et chiffres s'affichent tels quels (« Ctrl+Z », « Alt+H », « 1 »), ainsi que « [ » et « ] ».

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `keys.delete` | Suppr | brief | Touche Suppr (action Supprimer) |
| `keys.space` | Espace | brief | Barre d'espace (inventaire) |
| `keys.escape` | Échap | validé | Touche Échap (annuler / fermer) |
| `keys.enter` | Entrée | validé | Touche Entrée (cadrer depuis la vue 3D) |
| `keys.shift` | Maj | validé | Modificateur Maj (« Maj+V », « Maj+R ») ; Ctrl et Alt restent tels quels |
| `keys.numpad` | Pavé num. | à valider (tekuxwriter) | Préfixe d'une touche du pavé numérique (« Pavé num. 6 ») |

## menu

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `menu.projet` | Projet | brief | Menu 1 |
| `menu.lieu` | Lieu | brief | Menu 2 |
| `menu.materiel` | Matériel | brief | Menu 3 |
| `menu.cablage` | Câblage | brief | Menu 4 |
| `menu.ecoute` | Écoute | brief | Menu 5 |
| `menu.vue` | Vue | brief | Menu 6 |
| `menu.aide` | Aide | brief | Menu 7 |
| `menu.undo` | Annuler | brief | Projet ; raccourci affiché depuis la carte des touches (Task 8) |
| `menu.redo` | Rétablir | brief | Projet ; idem |
| `menu.newProject` | Nouveau | brief | Task 13 : Projet, 1er élément ; demande confirmation s'il y a des modifications non enregistrées (C16) |
| `menu.open` | Ouvrir… | brief | Task 13 : Projet ; liste des projets enregistrés, Entrée ouvre |
| `menu.save` | Enregistrer | brief | Projet ; Ctrl+S (Task 13, C16) ; demande un nom la première fois |
| `menu.saveAs` | Enregistrer sous… | brief | Task 13 : Projet ; demande toujours un nom |
| `menu.exportKept` | Exporter les données mises de côté… | validé | Task 13 (revue) : Projet ; télécharge en JSON les données illisibles gardées à part (rien n'est supprimé, N19) |
| `menu.choosePlace` | Choisir un lieu… | validé | Lieu ; ouvre l'écran « Choisir un lieu » par-dessus le lieu affiché (Task 12) |
| `menu.inventory` | Inventaire | à valider (tekuxwriter) | Matériel ; ouvre / ferme le tiroir (Espace, Task 23) ; remplace « Ouvrir l’inventaire » |
| `menu.rotate` | Pivoter | à valider (tekuxwriter) | Matériel ; tourne l’appareil sélectionné de 15° (R, Task 25) ; grisé sans sélection |
| `menu.duplicate` | Dupliquer | à valider (tekuxwriter) | Matériel ; copie l’appareil sélectionné à 0,5 m (Ctrl+D) ; grisé sans sélection |
| `menu.delete` | Supprimer | à valider (tekuxwriter) | Matériel ; supprime l’appareil sélectionné et ses câbles (Suppr) ; annulable ; grisé sans sélection |
| `menu.connectTo` | Connecter à… | validé | Câblage ; même libellé que l'action Propriétés « Connecter à… » (C10) |
| `menu.play` | Écouter le morceau | validé | Écoute ; inactif tant que la lecture n'existe pas |
| `menu.coverage` | Couverture | à valider (tekuxwriter) | Écoute › Couverture : case à cocher (décochée au départ) |
| `menu.panelTree` | Panneau Projet | validé | Vue ; replie / déplie le panneau |
| `menu.panelProps` | Panneau Propriétés | validé | Vue ; idem |
| `menu.shortcuts` | Raccourcis clavier | validé | Aide ; affiche « H » depuis Task 8, inactif jusqu'au panneau d'aide |
| `menu.siteBack` | Retour au site Tekonest | validé | Aide ; même libellé que `shell.siteBack` |

Since Task 12, Lieu holds only « Choisir un lieu… »; the place names are on the picker cards (`content/rooms/*.json` `name_fr`, `picker.set-*`, `picker.blank`).

## tree

Arbre « Projet » (Task 9, modèle WAI-ARIA tree). Remplace les clés `shell.treePlace`, `shell.treeGear`, `shell.treeNoPlace` et `shell.treeNoGear` (Task 7), supprimées. Les lignes d'appareil s'affichent « {nom catalogue} ({id}) », ex. « Yamaha QL1 (ql1) » ; les câbles « {id} {port} → {id} {port} », ex. « ql1 out-main-l → k12-g in-line-a » (nom de port français quand le catalogue en aura un) ; les zones par leur type en français (section `zoneKind`), numérotées quand un type se répète (« Public », « Public 2 »).

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `tree.place` | Lieu : {place} | validé | Première ligne de l'arbre ; Entrée = retour à la vue d'ensemble ; `{place}` = nom du lieu |
| `tree.noPlace` | aucun lieu choisi | validé | `{place}` avant le premier lieu (« Lieu : aucun lieu choisi ») |
| `tree.zones` | Zones | brief | Groupe (brief §3) |
| `tree.gear` | Matériel | brief | Groupe (brief §3) |
| `tree.cables` | Câbles | brief | Groupe (brief §3) |
| `tree.points` | Points d’écoute | brief | Groupe (brief §3) ; vide jusqu'à l'acoustique |
| `tree.hide` | Masquer {item} | brief | Nom du bouton œil (Task 9) ; `{item}` = libellé de la ligne |
| `tree.show` | Afficher {item} | brief | Idem, élément masqué |
| `tree.noGear` | Aucun appareil installé | validé | Sous le groupe « Matériel » vide (et sa description). Reprend l'ancienne `shell.treeNoGear` ; quand l'inventaire existera, ajouter « Ouvrez l'inventaire pour en ajouter. » |
| `tree.zone` | Zone | validé | Zone d'un type sans nom dans `zoneKind` |
| `tree.hiddenState` | masqué | validé | Lu après le nom d'une ligne masquée (lecteur d'écran ; à l'écran : texte barré) |
| `tree.help` | Flèches pour parcourir, Entrée pour sélectionner et cadrer, flèche droite sur un élément pour atteindre son bouton Masquer. | validé | Description de l'arbre (`aria-describedby`, lue à l'entrée dans l'arbre) |
| `tree.statusHidden` | Masqué : {item} | validé | Barre d'état (annoncé) après le bouton œil |
| `tree.statusShown` | Affiché : {item} | validé | Idem |
| `tree.statusFramed` | Cadré : {item} | validé | Barre d'état (annoncé) après Entrée sur une zone ou un câble |

## zoneKind

Types de zones des salles (`content/rooms/*.json`, `zones[].kind`), nommés dans l'arbre « Projet » (Task 9 review). Clé = le type tel qu'écrit dans les données.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `zoneKind.stage` | Scène | validé | Arbre, groupe Zones |
| `zoneKind.audience` | Public | validé | Idem (fosse, balcon : « Public », « Public 2 ») |
| `zoneKind.foh` | Régie façade | validé | Idem |
| `zoneKind.monitor-world` | Régie retours | validé | Idem |
| `zoneKind.backstage` | Coulisses | validé | Idem |
| `zoneKind.control-room` | Régie | validé | Idem (studios) |
| `zoneKind.booth` | Cabine | validé | Idem |
| `zoneKind.desk` | Poste de régie | validé | Idem |
| `zoneKind.machine-room` | Local technique | validé | Idem |
| `zoneKind.vocal-booth` | Cabine voix | validé | Idem |
| `zoneKind.iso-booth` | Cabine isolée | validé | Idem |
| `zoneKind.live-room` | Salle de prise | validé | Idem |
| `zoneKind.pit` | Fosse | validé | Idem (fosse d'orchestre) |
| `zoneKind.gallery` | Galerie | à trancher (Oscar) | Idem. L9 : le même type sert à « tribune-orgue » (église : « Tribune ») et à « production-gallery » (TV : « Régie ») ; « Galerie » ne convient à aucun des deux. Corriger les données (un type par usage) ou choisir un mot |
| `zoneKind.other` | Autre zone | validé | Idem |

## props

Panneau « Propriétés » (Task 10) : l'appareil sélectionné. Libellés de tekfrontenddesigner, validés par tekuxwriter (L9).

**Convention d'inclinaison (lue par l'acoustique, Task 36)** : `tiltDeg` positif = l'avant de l'appareil (son axe acoustique, z local +, P9 / ADR-0015) vise **vers le haut** ; négatif = vise vers le bas (vers le public). Bornée à [−90°, 90°]. Le lacet est ramené dans [0°, 360°). Voir `src/creation/shell/propertiesModel.ts` et l'addendum d'ADR-0013.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `props.none` | Aucune sélection | validé | Propriétés vide : titre (h3) |
| `props.noneHint` | Choisissez un appareil dans le panneau Projet, ou parcourez-les avec [ et ] dans la vue 3D. | validé | Propriétés vide : indication sous le titre |
| `props.sectionPosition` | Position | brief | Légende de la section (fieldset) |
| `props.sectionOrientation` | Orientation | brief | Idem |
| `props.sectionMount` | Montage | brief | Idem |
| `props.sectionControls` | Réglages | brief | Idem (contrôles du catalogue : +48V, mute, fader…) |
| `props.sectionConnections` | Connexions | brief | Idem (liste des prises, lecture seule + « Débrancher ») |
| `props.name` | Identifiant | validé | Champ en lecture seule : l'identifiant de l'appareil (ql1, k12-g) |
| `props.x` | X | validé | Champ, en m |
| `props.y` | Hauteur | validé | Champ, en m ; lecture seule quand le montage est « Sol » |
| `props.z` | Z | validé | Champ, en m |
| `props.yaw` | Lacet | brief | Champ, en ° (pas 15°, comme la touche R) |
| `props.tilt` | Inclinaison | validé | Champ, en ° (pas 1°), voir la convention ci-dessus |
| `props.mount` | Montage | validé | Liste déroulante |
| `props.mountFloor` | Sol | brief | Option ; force la hauteur au niveau du sol |
| `props.mountStand` | Pied | brief | Option |
| `props.mountFlown` | Accroché | brief | Option |
| `props.positionHint` | En mètres, depuis le centre du lieu. La hauteur se règle quand l’appareil est sur pied ou accroché. | validé | Description de la section Position (`aria-describedby`) |
| `props.orientationHint` | Lacet : rotation autour de la verticale. Inclinaison positive : l’avant vise vers le haut. | validé | Description de la section Orientation |
| `props.decrease` | Diminuer {field} | brief | Nom du bouton − ; `{field}` = libellé du champ (« Diminuer X ») |
| `props.increase` | Augmenter {field} | brief | Nom du bouton + (« Augmenter Lacet ») |
| `props.adjust` | Régler {field} | brief | Libellé de l'entrée d'historique (saisie ou rafale de ±) |
| `props.invalidNumber` | Valeur non valide : entrez un nombre, par exemple 2,5. | validé | Erreur sous le champ (`aria-invalid`, `aria-describedby`, annoncée) ; rien n'est appliqué |
| `props.unitMetres` | en mètres | validé | Description lue d'un champ en m (l'unité visible « m » est masquée au lecteur d'écran) |
| `props.unitDegrees` | en degrés | validé | Idem pour « ° » |
| `props.dirIn` | entrée | validé | Sens de la prise, liste Connexions |
| `props.dirOut` | sortie | validé | Idem |
| `props.dirBidir` | entrée et sortie | validé | Idem (Dante, GPIO…) |
| `props.toggleOn` | Activé | validé | État visible d'un interrupteur (`aria-pressed` le dit au lecteur d'écran) |
| `props.toggleOff` | Désactivé | validé | Idem |
| `props.noControls` | Aucun réglage sur cet appareil. | validé | Section Réglages vide |
| `props.noPorts` | Aucune prise sur cet appareil. | validé | Section Connexions vide (pied de micro…) |
| `props.portFree` | libre | validé | Prise sans câble |
| `props.unplug` | Débrancher | validé | Texte visible du bouton par câble |
| `props.unplugName` | Débrancher {port} de {other} | validé | Nom complet du bouton ; `{other}` = « K12.2 (k12-g) · in-line-a » |
| `props.statusUnplugged` | Débranché : {port} de {other} | validé | Barre d'état (annoncé) après « Débrancher » |
| `props.connect` | Connecter à… | à valider (tekuxwriter) | Task 28 : bouton visible d'une prise libre (ouvre la boîte « Connecter à… ») |
| `props.connectName` | Connecter à… (depuis {port}) | à valider (tekuxwriter) | Nom complet du bouton ; `{port}` = la prise de la ligne |
| `props.portName` | {port} · {connector} · {signal} · {state} | à valider (tekuxwriter) | Nom accessible d'une ligne de Connexions : l'équivalent clavier de l'étiquette au survol d'une prise ; `{state}` = « branché à … » ou « libre » |
| `props.portStateConnected` | branché à {other} | à valider (tekuxwriter) | `{other}` = « K12.2 (k12-g) · in-line-a » |

## signal

Types de signal du catalogue (`signalTypes[].id`), tels que Propriétés les nomme. Termes techniques anglais gardés (AES3, MADI, Word clock, GPIO).

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `signal.mic-level` | Niveau micro | validé | Connexions |
| `signal.line-level-pro` | Niveau ligne pro (+4 dBu) | validé | Idem |
| `signal.line-level-consumer` | Niveau ligne grand public (−10 dBV) | validé | Idem |
| `signal.instrument-hiz` | Instrument (Hi-Z) | validé | Idem |
| `signal.speaker-level` | Niveau haut-parleur | validé | Idem |
| `signal.headphone-level` | Niveau casque | validé | Idem |
| `signal.aes3` | AES3 numérique | validé | Idem |
| `signal.spdif` | S/PDIF numérique | validé | Idem |
| `signal.madi` | MADI multicanal | validé | Idem |
| `signal.aoip` | Audio sur IP (Dante) | validé | Idem |
| `signal.wordclock` | Word clock | validé | Idem |
| `signal.usb-audio` | Audio USB | validé | Idem |
| `signal.gpio-tally` | GPIO / tally | validé | Idem |
| `signal.dmx512` | DMX512 | validé | Idem |
| `signal.phantom-48v` | Alimentation fantôme +48 V | validé | Idem |
| `signal.mains-power` | Secteur 230 V | validé | Idem |

## picker

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `picker.title` | Choisir un lieu | validé | Titre (h2, sous le `h1` `shell.appTitle`) de l'écran de départ « Choisir un lieu » (Task 12) ; ouvert au premier lancement et par Lieu → « Choisir un lieu… » |
| `picker.blank` | Salle vide neutre | brief | Carte de la salle vide (L1) |
| `picker.hint` | Flèches pour parcourir, Entrée pour ouvrir. | validé | Task 12 : sous le titre ; aussi la description (`aria-describedby`) des deux grilles. Les flèches ne changent jamais de lieu (CA-13) |
| `picker.legendIntro` | Plans vus depuis le public, scène en haut : | validé | Task 12 : légende des vignettes (même sens que la vue Face, ADR-0011 / P14), suivie de trois pastilles |
| `picker.legendStage` | scène | validé | Pastille Prune (zones stage / pit) |
| `picker.legendOperator` | régie | validé | Pastille Ambre (régie façade, retours, régie, poste, galerie, cabine) |
| `picker.legendAudience` | public | validé | Pastille en pointillés (zones audience) |
| `picker.filter` | Type de lieu | validé | Task 12 : étiquette du filtre (liste déroulante) |
| `picker.filterAll` | Tous les types | validé | Task 12 : première option du filtre |
| `picker.templates` | Modèles | validé | Task 12 : titre (h3) de la rangée des modèles de départ |
| `picker.places` | Lieux ({n}) | validé | Task 12 : titre (h3) de la grille des lieux ; `{n}` = cartes affichées (36, ou moins après filtre) |
| `picker.withGearBadge` | Avec le matériel | brief | Task 12 : badge des 5 cartes L2 |
| `picker.devices` | {n} appareils | validé | Task 12 : badge d'une carte modèle (« 4 appareils ») |
| `picker.close` | Fermer | validé | Task 12 : bouton visible quand un lieu est déjà affiché ; Échap fait pareil |
| `picker.set-plateau` | Plateau live (décor 3D) | validé | Task 12 : carte du décor .glb `plateau` (le nom de `content/environments` est « Plateau / scene live », sans accent) |
| `picker.set-radio` | Studio radio (décor 3D) | validé | Task 12 : carte du décor .glb `radio` |
| `picker.set-theatre` | Théâtre (décor 3D) | validé | Task 12 : carte du décor .glb `theatre` |
| `picker.confirmTitle` | Ouvrir {place} | validé | Task 12 : titre du petit dialogue des cartes « Avec le matériel » ; `{place}` = nom de la carte |
| `picker.confirmEmpty` | Salle vide | brief | Task 12 : bouton radio (coché par défaut) |
| `picker.confirmGear` | Avec le matériel du modèle | brief | Task 12 : bouton radio (L2) |
| `picker.confirmGearHint` | Les appareils disponibles dans le jeu ({n}) seront installés à leur place. | validé | Task 12 : description du bouton radio ; `{n}` = appareils du modèle présents au catalogue |
| `picker.confirmOpen` | Ouvrir | validé | Task 12 : bouton principal du dialogue (Entrée) |
| `picker.confirmCancel` | Annuler | validé | Task 12 : retour à la carte ; Échap fait pareil |
| `picker.openFailed` | Impossible d’ouvrir {place}. Rien n’a changé : réessayez ou choisissez un autre lieu. | validé | Task 12 (revue) : ligne d'erreur dans l'en-tête du sélecteur (`role="alert"`) et barre d'état, quand une carte n'a pas pu être ouverte ; le sélecteur reste ouvert |

## placeType

Type affiché sur chaque carte et proposé dans le filtre (Task 12). Familles des salles (`content/rooms/*.json` `family`), puis décors, salle vide, modèles.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `placeType.live` | Concert / live | validé | Carte, filtre |
| `placeType.education` | Enseignement | validé | Idem |
| `placeType.worship` | Lieu de culte | validé | Idem |
| `placeType.conference` | Conférence | validé | Idem |
| `placeType.broadcast` | Radio / TV | validé | Idem |
| `placeType.outdoor` | Plein air | validé | Idem |
| `placeType.post` | Post-production | validé | Idem |
| `placeType.studio` | Studio | validé | Idem |
| `placeType.installed` | Installation fixe | validé | Idem |
| `placeType.classical` | Musique classique | validé | Idem |
| `placeType.theatre` | Théâtre | validé | Idem |
| `placeType.set` | Décor 3D | validé | Les 3 décors .glb |
| `placeType.blank` | Salle neutre | validé | « Salle vide neutre » |
| `placeType.template` | Modèle | validé | Cartes de la rangée « Modèles » |
| `placeType.other` | Autre lieu | validé | Famille inconnue |

## note

Notes refermables en bas à gauche de la vue 3D (Task 12) : ce que l'apprenant doit voir, pas seulement la console.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `note.close` | Fermer la note | validé | Nom du bouton « × » de chaque note |
| `note.unavailableTitle` | Matériel non disponible dans le jeu | brief | Titre (h3) de la note après « Avec le matériel du modèle » (L2) |
| `note.unavailableBody` | Ces appareils du modèle ne sont pas encore dans le jeu ({n}) : | validé | Suivi de la liste des identifiants (« dhd-rx2 », « × 2 » si répété) |
| `note.fallbackTitle` | Lieu indisponible | validé | Titre de la note quand une salle n'a pas pu être chargée ou construite |
| `note.fallbackBody` | Impossible de charger {place} : la salle vide neutre est affichée à la place. Lieu > Choisir un lieu… pour en ouvrir un autre. | validé | Corps de la note, aussi annoncé dans la barre d'état ; `{place}` = nom du lieu |

## place

Dialogue « Changer de lieu » (C3), ouvert quand du matériel est déjà installé.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `place.dialogTitle` | Changer de lieu | validé | Titre du dialogue ; aussi le libellé de l'entrée d'historique. Revu en Task 7 : verbe d'action + objet, clair, gardé. |
| `place.dialogBody` | Du matériel est déjà installé. Gardez-le pour le placer dans le nouveau lieu, ou repartez à vide. | validé | L9 : « scène vide » → « à vide » (glossaire : jamais « scène » pour le lieu ; même mot que le bouton). Revu en Task 7. Avant : « Que voulez-vous en faire dans le nouveau lieu ? » (question ouverte). Maintenant le corps nomme les deux choix avec les mêmes verbes que les boutons (garder / repartir), Annuler reste implicite. |
| `place.keep` | Garder le matériel | brief | Bouton principal (C3) |
| `place.empty` | Repartir à vide | brief | Bouton (C3) |
| `place.cancel` | Annuler | validé | Bouton ; Échap fait pareil |
| `place.replaceTitle` | Remplacer le matériel ? | validé | Task 12 (revue) : titre du dialogue quand un modèle (carte « Modèles » ou « Avec le matériel du modèle ») est ouvert alors que du matériel est installé |
| `place.replaceBody` | Ce modèle installe son propre matériel : celui déjà en place sera retiré. {undo} permet de revenir en arrière. | validé | Idem, corps ; `{undo}` = libellé de la touche Annuler |
| `place.replace` | Remplacer le matériel | validé | Idem, bouton principal ; « Annuler » (`place.cancel`) et Échap ne changent rien |

## project

Sauvegarde automatique, marque « * », Ctrl+S et projets nommés (Task 13, C16, CA-14). Les textes « brief » sont repris tels quels du plan, sauf `project.blocked` passé au vouvoiement (revue).

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `project.docTitle` | {name} · Mode Création · TekPractice | brief | Titre de l'onglet ; précédé de « * » tant qu'il y a des modifications non enregistrées ; `{name}` = nom du projet ou `project.untitledDoc` |
| `project.untitledDoc` | Sans titre | brief | `{name}` du titre d'onglet tant que le projet n'a pas de nom (la barre du haut garde `shell.untitled`) |
| `project.dirty` | modifications non enregistrées | validé | Lu après le « * » visible du titre de projet (texte masqué, lecteur d'écran) |
| `project.saved` | Projet « {name} » enregistré | brief | Barre d'état (annoncé) après Ctrl+S / Enregistrer |
| `project.saveNoPlace` | Choisissez un lieu avant d’enregistrer. | validé | Barre d'état : Ctrl+S avant le premier lieu (le dialogue d'enregistrement du navigateur ne s'ouvre jamais) |
| `project.saveFull` | Plus de place pour enregistrer : 20 projets au maximum, ou stockage du navigateur plein. Rien n’a été enregistré. | validé | Barre d'état : 21e projet ou quota du navigateur atteint |
| `project.blocked` | Le navigateur bloque la sauvegarde : votre travail ne sera pas gardé. | validé | Note persistante + barre d'état quand localStorage est bloqué (navigation privée stricte, cookies bloqués). Revue Task 13 : brief « ton travail » passé au vouvoiement du shell |
| `project.blockedTitle` | Sauvegarde impossible | validé | Titre (h3) de cette note |
| `project.reset` | Sauvegarde incompatible, on repart de zéro. | brief | Titre de la note quand la sauvegarde automatique est illisible ou d'une autre version |
| `project.resetBody` | L’ancienne sauvegarde n’est pas effacée : elle est gardée à part dans ce navigateur. Projet > Exporter les données mises de côté… la télécharge. | validé | Corps de cette note (données mises en quarantaine, jamais supprimées) |
| `project.keptFullTitle` | Données mises de côté : plus de place | validé | Titre de la note quand des données illisibles n'ont pas pu être mises de côté (5 au maximum, ADR-0012) |
| `project.keptFull` | Des données illisibles n’ont pas pu être mises de côté. Exportez-les avec Projet > Exporter les données mises de côté… : la sauvegarde automatique reprendra ensuite. | validé | Corps de cette note ; l'autosave attend l'export (rien n'est jamais jeté sans le dire) |
| `project.quarantineFull` | Rien n’a été enregistré : la version enregistrée depuis un autre onglet doit d’abord être mise de côté, et la place est pleine. Pour garder votre travail, utilisez Projet > Enregistrer sous… avec un autre nom. | validé | Barre d'état : Ctrl+S refusé, conflit d'onglets et quarantaine pleine (un autre nom n'a rien à mettre de côté) ; nomme la sortie. L9 (revue) : ne couvre plus le cas de la liste illisible |
| `project.quarantineFullList` | Rien n’a été enregistré : la liste des projets, illisible, ne peut pas être mise de côté (place pleine). Exportez-la avec Projet > Exporter les données mises de côté…, confirmez avec « J’ai vérifié le fichier », puis enregistrez à nouveau. | validé | Barre d'état : Ctrl+S refusé parce que la liste illisible ne peut pas être mise de côté ; tout nom échoue. Sortie réelle : l'export puis la confirmation (le prochain enregistrement repart d'une liste neuve). L9 (revue) : séparé de `quarantineFull`, qui disait le contraire de la note « plus de place » |
| `project.keptFullExported` | Fichier téléchargé. Ouvrez-le pour vérifier qu’il contient vos données, puis confirmez : la sauvegarde automatique reprendra et remplacera l’ancienne sauvegarde illisible. | validé | Note après l'export (même logique que l'archive des Essais) : l'autosave attend la confirmation |
| `project.checkedFile` | J’ai vérifié le fichier | validé | Bouton de cette note ; reprend l'autosave |
| `project.resumeHere` | Reprendre ici | validé | Bouton de la note « autre onglet » ; reprend l'autosave de cet onglet |
| `project.listReset` | Projet « {name} » enregistré. L’ancienne liste de projets, illisible, est gardée à part. | validé | Barre d'état : enregistré, la liste illisible a été mise de côté |
| `project.conflictKept` | Projet « {name} » enregistré. La version enregistrée depuis un autre onglet est gardée à part. | validé | Barre d'état : un autre onglet avait enregistré ce projet entre-temps (ADR-0012 §6) |
| `project.otherTabTitle` | Projet ouvert dans un autre onglet | validé | Titre de la note quand un autre onglet écrit la sauvegarde ou les projets |
| `project.otherTab` | Ce projet est ouvert dans un autre onglet : la sauvegarde automatique est en pause ici. « Reprendre ici » ou {save} dans cet onglet la reprend. | validé | Corps de cette note ; `{save}` = libellé de la touche Enregistrer (« Ctrl+S ») |
| `project.exported` | Données mises de côté exportées : {file} | validé | Barre d'état après l'export ; `{file}` = nom du fichier JSON téléchargé |
| `project.exportNothing` | Aucune donnée mise de côté. | validé | Barre d'état : rien à exporter |
| `project.openUnreadable` | La liste des projets enregistrés est illisible. Elle n’est pas effacée : Projet > Exporter les données mises de côté… la télécharge. | validé | Dialogue « Ouvrir… » quand la liste est illisible (jamais « aucun projet ») |
| `project.openDirtyTitle` | Ouvrir un autre projet ? | validé | « Ouvrir… » avec des modifications non enregistrées (corps : `project.newBody`) |
| `project.openDirtyConfirm` | Choisir un projet | validé | Bouton principal de ce dialogue |
| `project.autosaveFull` | Stockage du navigateur plein : sauvegarde automatique en pause. Votre travail reste affiché tant que la page est ouverte ; rien de déjà enregistré n’est effacé. | validé | Note + barre d'état quand l'écriture automatique dépasse le quota. L9 (réponse coordinateur) : « Enregistrer sous » écrit dans le même stockage et l'app ne supprime aucun projet, donc aucun remède n'est promis ; export / suppression de projet prévus plus tard |
| `project.restored` | Travail de la dernière séance rouvert. | validé | Barre d'état au démarrage quand la sauvegarde automatique est rouverte (le sélecteur de lieu ne s'affiche pas) |
| `project.nameTitle` | Enregistrer le projet | validé | Titre du dialogue de nom (Ctrl+S la première fois) |
| `project.nameTitleAs` | Enregistrer sous | validé | Titre du même dialogue pour « Enregistrer sous… » |
| `project.nameLabel` | Nom du projet | validé | Étiquette du champ texte ; Entrée enregistre |
| `project.nameSubmit` | Enregistrer | validé | Bouton principal du dialogue de nom |
| `project.nameCancel` | Annuler | validé | Bouton ; Échap fait pareil |
| `project.nameEmpty` | Donnez un nom au projet. | validé | Erreur sous le champ vide (`aria-invalid`, annoncée) |
| `project.overwriteTitle` | Remplacer « {name} » ? | validé | Dialogue : un projet porte déjà ce nom |
| `project.overwriteBody` | Un projet porte déjà ce nom. Il sera remplacé par le projet affiché. | validé | Corps de ce dialogue |
| `project.overwrite` | Remplacer | validé | Bouton principal ; « Annuler » ne change rien |
| `project.newTitle` | Nouveau projet ? | validé | Dialogue « Nouveau » quand il y a des modifications non enregistrées |
| `project.newBody` | Les modifications non enregistrées seront abandonnées. {undo} permet de revenir en arrière. | validé | Corps ; `{undo}` = libellé de la touche Annuler |
| `project.newConfirm` | Nouveau projet | validé | Bouton principal |
| `project.newEntry` | Nouveau projet | validé | Libellé de l'entrée d'historique (« Nouveau » est annulable) |
| `project.openTitle` | Ouvrir un projet | validé | Titre du dialogue « Ouvrir… » |
| `project.openHint` | Flèches ou Tab pour parcourir, Entrée pour ouvrir. | validé | Sous le titre (description de la liste) |
| `project.openEmpty` | Aucun projet enregistré pour l’instant. | validé | Liste vide |
| `project.openItem` | {name}, enregistré le {date} | validé | Nom accessible d'une ligne ; `{date}` = date et heure locales |
| `project.openEntry` | Ouvrir « {name} » | validé | Libellé de l'entrée d'historique (ouvrir est annulable) |
| `project.opened` | Projet « {name} » ouvert. {undo} pour revenir en arrière. | validé | Barre d'état (annoncé) |
| `project.openFailed` | Impossible d’ouvrir le projet « {name} ». Rien n’a changé. | validé | Barre d'état : projet illisible ou refusé |

Task 14 (barre d'état, liste d'erreurs persistante) : les textes des règles R1–R8 ne sont pas dans `copy.ts` mais dans le catalogue (`content/catalog.json`, `rules[].title_fr` / `teach_fr`, Task 29) ; voir la section « Textes des règles » ci-dessous.

## status

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `status.selection` | Sélection : {device} | brief | Barre d'état, texte fixe ; `{device}` = « Yamaha QL1 (ql1) » |
| `status.selectionNone` | Aucune sélection | brief | Barre d'état, rien de sélectionné |
| `status.snapping` | Aimantation : 0,25 m · 15° | brief | Barre d'état : pas de placement (grille, rotation R) ; affiché seulement pendant une pose ou un déplacement |
| `status.snappingFree` | Aimantation : libre | brief | Barre d'état : placement libre (touche Alt, décision de la Task 24) ; affiché seulement pendant une pose ou un déplacement |
| `status.signalOk` | Signal OK | brief | Bouton signal, couleur ok + glyphe ✓, UNIQUEMENT quand le chemin du signal peut jouer (`playbackReady`, décision L5) |
| `status.signalNoError` | Aucune erreur détectée | validé | Bouton signal, 0 erreur mais lecture non prouvée (L5) : couleur neutre (ink-muted), glyphe ○ |
| `status.signalNothing` | Rien de branché | validé | Bouton signal, aucun câble dans le montage (L5) : neutre, glyphe ○ |
| `status.errorsOne` | 1 erreur | brief | Bouton signal (couleur danger + glyphe ⚠) |
| `status.errorsMany` | {n} erreurs | brief | Idem, `{n}` ≥ 2 |
| `status.warningsOne` | 1 avertissement | validé | À côté du bouton signal (les avertissements ne comptent pas comme erreurs) |
| `status.warningsMany` | {n} avertissements | validé | Idem, `{n}` ≥ 2 |
| `status.unverifiedOne` | 1 appareil non vérifié | à valider (tekuxwriter) | À côté du signal quand le montage contient un appareil Bêta : les règles ont tourné sur des ports déclarés, non vérifiés (Task 30) |
| `status.unverifiedMany` | {n} appareils non vérifiés | à valider (tekuxwriter) | Idem, `{n}` ≥ 2 |
| `status.refusedMark` | connexion refusée | validé | À côté du bouton signal tant que la dernière connexion refusée est listée |
| `status.signalAnnounce` | Signal : | validé | Annoncé (`role="status"`) avant le nouveau libellé quand une modification ajoute ou retire une erreur (« Signal : 1 erreur ») |
| `status.signalHint` | Afficher les erreurs et avertissements | validé | Infobulle (`title`) du bouton signal |
| `status.listTitle` | Erreurs et avertissements | validé | Titre de la liste (pop-over `role="dialog"`) |
| `status.listEmpty` | Aucune erreur ni avertissement pour l’instant. | validé | Liste vide |
| `status.listClose` | Fermer la liste | validé | Bouton × (nom accessible) |
| `status.listHint` | Choisissez une ligne pour sélectionner l’appareil concerné. | validé | Sous le titre (description du dialogue) |
| `status.tagRefused` | Connexion refusée | validé | Étiquette de ligne + glyphe ⊘ (suivie de « : ») |
| `status.tagError` | Erreur | validé | Étiquette de ligne + glyphe ⚠ |
| `status.tagWarning` | Avertissement | validé | Étiquette de ligne + glyphe ⓘ |
| `status.ports` | Prises : {ports} | validé | Ligne des prises ; `{ports}` = « appareil (id) · prise » séparés par → |
| `status.statusRefused` | Connexion refusée : {title} | validé | Annoncé (`role="status"`) quand une connexion est refusée ; `{title}` = la raison |
| `status.occupiedTitle` | Prise déjà utilisée | validé | Refus PORT_OCCUPIED |
| `status.occupiedDetail` | Cette prise a déjà un câble. Débranchez-le d’abord. | validé | Idem (explication) |
| `status.selfTitle` | Même prise aux deux bouts | validé | Refus SELF_CONNECTION |
| `status.selfDetail` | Une prise ne peut pas être reliée à elle-même. | validé | Idem |
| `status.otherTitle` | Connexion impossible | validé | Autre refus sans règle |
| `status.otherDetail` | Ces deux prises ne peuvent pas être reliées. | validé | Idem |
| `status.unknownRule` | Règle {id} | validé | Règle sans texte (jamais attendu) ; `{id}` |
| `status.autosave` | Sauvegarde auto : | validé | Préfixe visible de l'état de la sauvegarde automatique |
| `status.autosaveSaved` | Enregistré | validé | État : écrite |
| `status.autosaveModified` | Modifié | validé | État : modification en attente d'écriture (1 s) |
| `status.autosavePaused` | En pause | validé | État : en pause |
| `status.pausedKept` | Sauvegarde automatique en pause : exportez les données mises de côté pour la reprendre. | validé | Ligne persistante (la note peut être fermée) ; bouton « Exporter… » |
| `status.pausedKeptExported` | Sauvegarde automatique en pause : vérifiez le fichier exporté, puis confirmez. | validé | Ligne persistante après l’export ; bouton « J’ai vérifié le fichier » |
| `status.pausedOtherTab` | Sauvegarde automatique en pause : ce projet est ouvert dans un autre onglet. | validé | Ligne persistante ; bouton « Reprendre ici » |
| `status.pausedFull` | Sauvegarde automatique en pause : stockage du navigateur plein. | validé | Ligne persistante, quota plein |
| `status.pausedBlocked` | Sauvegarde automatique impossible : le navigateur la bloque. | validé | Ligne persistante, stockage bloqué |
| `status.actionExport` | Exporter… | validé | Bouton de la ligne « en pause » (même action que Projet > Exporter les données mises de côté…) |

## playback

Lecture et micro (Task 34, C9) : la ligne « Lecture » de la barre d’état et l’indicateur « Micro OK ». Les raisons sont renvoyées par `src/flow/signalPath.ts` ; la première s’affiche quand la lecture n’est pas possible. Toutes les formulations sont des brouillons.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `playback.ready` | Lecture possible | à valider (tekuxwriter) | Barre d’état : le chemin du signal atteint une enceinte alimentée |
| `playback.micOk` | Micro OK | à valider (tekuxwriter) | Barre d’état, à part de la lecture : un micro atteint une entrée micro d’une console alimentée, sans erreur |
| `playback.noSource` | Aucune source de lecture dans le projet. | à valider (tekuxwriter) | Raison NO_SOURCE : aucune console avec lecture dans le projet |
| `playback.sourceOff` | La lecture console est coupée. | à valider (tekuxwriter) | Raison SOURCE_OFF : la commande « Lecture console » est éteinte |
| `playback.hostUnpowered` | La console n’est pas alimentée. | à valider (tekuxwriter) | Raison HOST_UNPOWERED (lecture et micro) : pas reliée au secteur ou éteinte |
| `playback.noPath` | Aucun chemin de la console jusqu’à une enceinte. | à valider (tekuxwriter) | Raison NO_PATH : aucun câble de la console vers une entrée d’enceinte |
| `playback.speakerUnpowered` | Une enceinte reçoit le signal mais n’est pas alimentée. | à valider (tekuxwriter) | Raison SPEAKER_UNPOWERED : enceinte câblée en signal, sans secteur ou éteinte |
| `playback.ruleError` | Une erreur de câblage bloque le chemin. | à valider (tekuxwriter) | Raison RULE_ERROR (lecture et micro) : une erreur de règle sur un port du chemin |
| `playback.noMic` | Aucun micro branché sur une entrée micro. | à valider (tekuxwriter) | Raison NO_MIC : aucun micro vérifié câblé sur une entrée micro |

## Textes des règles (catalogue)

Les titres et textes pédagogiques des règles R1–R8 sont des **données du catalogue**, pas des chaînes de `copy.ts` : `content/catalog.json`, `rules[].title_fr` (titre) et `rules[].teach_fr` (texte pédagogique), obligatoires (schéma zod, `npm run validate:catalog`). Les champs anglais `title` / `teach` restent pour le mode historique (`?legacy=1`). Le Mode Création ne montre que le français : `ruleTextFor` (`src/creation/shell/statusModel.ts`) est le seul endroit qui les choisit, pour la liste d'erreurs de la barre d'état (titre + texte), le refus épinglé sur la prise (titre) et les prises incompatibles de « Connecter à… » (titre, puis texte sur une 2e ligne).

Statut : **brouillons du développeur (Task 29) à relire par tekuxwriter** (traductions fidèles de `title` / `teach`, sans nouvelle affirmation technique, sans clé `copy.ts`). Les 8 paires sont dans le catalogue ; la relecture se fait là (pas de copie ici, pour éviter deux sources).

## boot

Le shell n'a pas pu démarrer (revue Phase 1) : une alerte persistante (`role="alert"`) dans la vue, avec la sortie.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `boot.noWebglTitle` | Vue 3D indisponible | validé | Titre de l'alerte quand WebGL manque (le moteur 3D ne peut pas être créé) |
| `boot.noWebglBody` | La vue 3D ne peut pas démarrer sur cet ordinateur : ce navigateur n’a pas accès à WebGL. Vous pouvez vous entraîner avec la version 2D. | validé | Corps de l'alerte sans WebGL |
| `boot.open2d` | Ouvrir la version 2D | validé | Lien vers le plateau 2D (`?level=a1&render=2d`), reçoit le focus |
| `boot.loadTitle` | Le Mode Création n’a pas pu se charger | validé | Titre de l'alerte quand un morceau de l'application (code, modèles) n'a pas pu être téléchargé |
| `boot.loadBody` | Une partie de l’application n’a pas pu être téléchargée. Vérifiez votre connexion, puis rechargez la page. | validé | Corps de cette alerte |
| `boot.reload` | Recharger la page | validé | Bouton de l'alerte de chargement, reçoit le focus |

## cube

Le cube de vue (Task 17, C11) en haut à gauche de la vue 3D : libellés peints sur ses faces (capitales). Le calque de clic est masqué aux lecteurs d'écran (`aria-hidden`, sans nom) et n'est pas un arrêt de tabulation : les vues nommées vivent dans le menu Vue et le sélecteur `V` (Task 18).

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `cube.face` | FACE | à valider | Libellé de la face avant du cube (côté public), aussi sur la flèche de la boussole |
| `cube.arriere` | ARRIÈRE | à valider | Libellé de la face arrière |
| `cube.gauche` | GAUCHE | à valider | Libellé de la face gauche (vue depuis le public) |
| `cube.droite` | DROITE | à valider | Libellé de la face droite (vue depuis le public) |
| `cube.dessus` | DESSUS | à valider | Libellé de la face du dessus |
| `cube.dessous` | DESSOUS | à valider | Libellé de la face du dessous |

## views

Les vues nommées (Task 18, C11, CA-05) : le sous-menu Vue › Vues (26 vues groupées Faces / Arêtes / Coins) et le sélecteur `V` (grille 8 × 3 + les deux pôles). Les 26 noms de vue viennent de `zoneLabel` (`src/camera/cubeZones.ts`, ex. « Dessus · Face · Droite ») ; ce sont aussi les noms du survol du cube. « Marcher » (Maj+V) : voir `walk`.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `views.menu` | Vues | à valider (tekuxwriter) | Vue ; sous-menu des 26 vues |
| `views.faces` | Faces | à valider (tekuxwriter) | Titre du groupe des 6 faces dans le sous-menu |
| `views.edges` | Arêtes | à valider (tekuxwriter) | Titre du groupe des 12 arêtes |
| `views.corners` | Coins | à valider (tekuxwriter) | Titre du groupe des 8 coins |
| `views.frame` | Cadrer la sélection | à valider (tekuxwriter) | Vue ; raccourci F (vue 3D) |
| `views.home` | Vue d’ensemble | à valider (tekuxwriter) | Vue ; raccourci Alt+H ; retour à la vue d'ouverture du lieu |
| `views.pick` | Choisir une vue… | à valider (tekuxwriter) | Vue ; raccourci V (vue 3D) ; ouvre le sélecteur |
| `views.rotateLeftMenu` | Tourner la vue à gauche | à valider (tekuxwriter) | Vue ; raccourci Pavé num. 4 (vue 3D) ; quart de tour |
| `views.rotateRightMenu` | Tourner la vue à droite | à valider (tekuxwriter) | Vue ; raccourci Pavé num. 6 (vue 3D) ; quart de tour |
| `views.rotateLeft` | Tourner de 90° à gauche | à valider (tekuxwriter) | Nom accessible et infobulle du bouton ↺ à côté du cube |
| `views.rotateRight` | Tourner de 90° à droite | à valider (tekuxwriter) | Nom accessible et infobulle du bouton ↻ à côté du cube (⌂ reprend `views.home`) |
| `views.pickerTitle` | Choisir une vue | à valider (tekuxwriter) | Titre du sélecteur `V` (dialogue) |
| `views.pickerHelp` | Flèches : changer de vue. Entrée : y aller. Échap : annuler. | à valider (tekuxwriter) | Sous le titre ; description du dialogue |
| `views.cancel` | Annuler | à valider (tekuxwriter) | Bouton du sélecteur (même effet qu'Échap) |
| `views.current` | Vue actuelle : {view}. | à valider (tekuxwriter) | Début de la description du sélecteur ; {view} = la vue la plus proche de la caméra (le focus part de sa case, marquée `aria-current`) |
| `views.status` | Vue : {view} | à valider (tekuxwriter) | Barre d'état après le choix d'une vue (annoncé) ; {view} = nom de la vue |

## walk

Marcher dans le lieu (Task 19, C11, S6) : Vue › Marcher (Maj+V, la vue 3D a le focus) et la hauteur d'oreille dans Écoute (assis 1,2 m par défaut, debout 1,7 m ; réglage de vue, gardé d'une visite à l'autre, jamais annulable). Échap ou Maj+V reviennent à l'orbite. Les touches de marche sont lues par position : ZQSD sur un clavier AZERTY, WASD en QWERTY.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `walk.menu` | Marcher | à valider (tekuxwriter) | Vue ; case à cocher ; raccourci Maj+V (vue 3D) |
| `walk.earSeated` | Hauteur d’oreille : assis 1,2 m | à valider (tekuxwriter) | Écoute ; bouton radio (défaut) ; aussi annoncé dans la barre d'état |
| `walk.earStanding` | Hauteur d’oreille : debout 1,7 m | à valider (tekuxwriter) | Écoute ; bouton radio ; aussi annoncé dans la barre d'état |
| `walk.statusOn` | Marche : flèches ou ZQSD (WASD en QWERTY) pour avancer et tourner, {walk} ou Échap pour revenir à l’orbite. | à valider (tekuxwriter) | Barre d'état à l'entrée en marche (annoncé) ; {walk} = « Maj+V » |
| `walk.statusOff` | Retour à l’orbite | à valider (tekuxwriter) | Barre d'état à la sortie de la marche (annoncé) |
| `walk.canvas` | Vue 3D en marche : flèches = avancer et tourner, glisser = regarder, {walk} ou Échap = revenir à l’orbite | à valider (tekuxwriter) | `aria-label` du canvas pendant la marche (remplace `shell.canvas`) |

## points

Points d'écoute nommés (Task 20 ; seule la Régie est obligatoire). Lignes du groupe « Points d’écoute » de l'arbre Projet, Vue › Aller au point d’écoute, touches 1 / 2 / 3 (lues par position, la vue 3D a le focus). Aller à un point quitte la marche et place la caméra au point, à hauteur d'oreille, tournée vers la scène. Le point choisi devient le point d'écoute actif (bouton radio coché). « Premier rang » et « Fond de salle » n'existent que si le lieu a une zone public.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `points.regie` | Régie | à valider (tekuxwriter) | Point de la zone régie façade, sinon de la régie (control room), sinon centre du lieu aux 2/3 de la profondeur ; touche 1 (touches fixes : 2 = Premier rang, 3 = Fond de salle, même si un point manque) |
| `points.premierRang` | Premier rang | à valider (tekuxwriter) | 2 m devant le bord de scène, dans le public |
| `points.fondDeSalle` | Fond de salle | à valider (tekuxwriter) | 1 m avant le fond de la dernière zone public |
| `points.centre` | Centre | à valider (tekuxwriter) | Salle vide neutre et décors 3D : seul point, au centre |
| `points.menu` | Aller au point d’écoute | à valider (tekuxwriter) | Vue ; sous-menu (boutons radio, raccourcis 1 / 2 / 3) |
| `points.status` | Point d’écoute : {point} | à valider (tekuxwriter) | Barre d'état après le choix d'un point (annoncé) ; {point} = nom du point |
| `points.none` | Pas de point d’écoute {n} dans ce lieu. | à valider (tekuxwriter) | Barre d'état : touche 2 ou 3 sans point derrière (ex. salle vide) ; {n} = la touche |

## inventory

Tiroir d'inventaire (Task 23, CA-09) : Matériel › Inventaire (Espace, la vue 3D a le focus), tiroir en bas de la vue 3D, onglets par catégorie (les neuf noms d'onglets sont les lignes `inventory.tab*` ci-dessous ; `TAB_LABELS`, src/creation/inventory.ts, en est construit). Entrée ou clic sur un appareil le choisit : il suit alors le pointeur dans la vue 3D et se pose d'un clic (section `placement`, Task 24). Espace ou Échap ferment et rendent le focus à la vue 3D ; dans le champ « Filtrer », Espace écrit une espace et seul Échap ferme.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `inventory.title` | Inventaire | à valider (tekuxwriter) | Titre du tiroir (h2) et nom accessible de la boîte de dialogue ; même mot que Matériel › Inventaire |
| `inventory.tabs` | Catégories d’appareils | à valider (tekuxwriter) | Nom accessible de la liste d’onglets (tablist) ; les noms d’onglets sont les lignes `inventory.tab*` de copy.ts |
| `inventory.hint` | Entrée ou clic : choisir l’appareil, puis cliquer dans la vue pour le poser. {key} ou Échap : fermer ; dans « Filtrer », seul Échap ferme. | à valider (tekuxwriter) | Sous le titre ; {key} = touche de l’inventaire (« Espace » par défaut) |
| `inventory.close` | Fermer | à valider (tekuxwriter) | Texte du bouton |
| `inventory.closeLabel` | Fermer l’inventaire | à valider (tekuxwriter) | Nom accessible du bouton Fermer (contient le texte visible) |
| `inventory.filter` | Filtrer | à valider (tekuxwriter) | Étiquette du champ de recherche au-dessus des onglets (aussi son nom pour les aides techniques) |
| `inventory.filterNone` | Aucun appareil ne correspond | à valider (tekuxwriter) | Dit poliment (et affiché dans la liste) quand le filtre ne correspond à aucun appareil |
| `inventory.filterResults` | Appareils qui correspondent | à valider (tekuxwriter) | Nom accessible de la liste quand un filtre est actif : elle réunit les appareils de tous les onglets |
| `inventory.empty` | Aucun appareil disponible pour le moment. | à valider (tekuxwriter) | État vide d’un onglet sans appareil |
| `inventory.badgeUnverified` | non vérifié | à valider (tekuxwriter) | Pastille sur un appareil proposé : onglet Bêta, arbre Projet et Propriétés une fois posé (Task 30) |
| `inventory.tipUnverified` | Fiche proposée, pas encore vérifiée : comportement approximatif. | à valider (tekuxwriter) | Info-bulle d’un appareil Bêta (tiroir) et description de l’appareil posé (Propriétés) |
| `inventory.missingTitle` | Appareils non rechargés | à valider (tekuxwriter) | Titre de la note quand un projet rouvert contient des appareils dont la fiche n’existe plus |
| `inventory.missingBody` | La fiche de ces appareils n’existe plus (proposition Bêta retirée ou appareil inconnu) : ils n’ont pas été rechargés. | à valider (tekuxwriter) | Corps de la note ; les identifiants des appareils suivent en liste |
| `inventory.unavailableTitle` | Projet non rouvert | à valider (tekuxwriter) | Titre de la note quand les fiches Bêta dont un projet enregistré a besoin n’ont pas pu être chargées (réseau, délai de 5 s) : le projet n’est ni ouvert ni modifié |
| `inventory.unavailable` | Fiches Bêta indisponibles (réseau). Rechargez la page pour retrouver votre projet. | à valider (tekuxwriter) | Corps de la note, ligne d’état et ligne du sélecteur de lieu pour le même cas |
| `inventory.unavailableOpen` | Fiches Bêta indisponibles (réseau). Le projet n’a pas été ouvert. Rechargez la page, puis rouvrez-le. | à valider (tekuxwriter) | Corps de la note et ligne d’état quand « Ouvrir… » n’a pas pu charger les fiches Bêta du projet choisi : rien n’est ouvert ni modifié |
| `inventory.loadingBeta` | Chargement des fiches Bêta… | à valider (tekuxwriter) | Barre d’état pendant le chargement des fiches Bêta dont un projet enregistré a besoin (réouverture seulement) |
| `inventory.loading` | Ouverture de l’inventaire… | à valider (tekuxwriter) | Barre d’état pendant le chargement du tiroir (première ouverture) |
| `inventory.loadFailed` | L’inventaire n’a pas pu s’ouvrir (réseau). Rechargez la page. | à valider (tekuxwriter) | Barre d’état si le module du tiroir ne se charge pas (hors ligne) |
| `inventory.entry` | Ajouter {device} | à valider (tekuxwriter) | Libellé de l’entrée d’historique (Annuler / Rétablir) ; {device} = nom de l’appareil |
| `inventory.tabMicros` | Micros | à valider (tekuxwriter) | Onglet ; Micros, d’après la catégorie « microphone » du catalogue ; les onglets vides sont masqués |
| `inventory.tabConsoles` | Consoles | à valider (tekuxwriter) | Onglet ; Consoles, stageboxes, préamplis et contrôleurs d’écoute ; les onglets vides sont masqués |
| `inventory.tabEnceintes` | Enceintes | à valider (tekuxwriter) | Onglet ; Enceintes amplifiées et moniteurs de studio ; les onglets vides sont masqués |
| `inventory.tabSources` | Sources | à valider (tekuxwriter) | Onglet ; Ordinateurs et interfaces audio ; les onglets vides sont masqués |
| `inventory.tabReseau` | Réseau | à valider (tekuxwriter) | Onglet ; Codecs et horloges maîtresses ; les onglets vides sont masqués |
| `inventory.tabSecteur` | Secteur | à valider (tekuxwriter) | Onglet ; Alimentation secteur ; onglet masqué tant que le catalogue n’en contient pas ; les onglets vides sont masqués |
| `inventory.tabEclairage` | Éclairage | à valider (tekuxwriter) | Onglet ; Éclairage ; onglet masqué tant que le catalogue n’en contient pas ; les onglets vides sont masqués |
| `inventory.tabBeta` | Bêta | à valider (tekuxwriter) | Onglet ; Propositions seulement (jamais un appareil du catalogue), badge « non vérifié » (Task 30) ; masqué sans proposition ; les onglets vides sont masqués |
| `inventory.tabAutres` | Autres | à valider (tekuxwriter) | Onglet ; Accessoires, câbles, signalisation, patchbays et catégories inconnues ; toujours en dernier ; les onglets vides sont masqués |

## Glossaire

- **lieu** : la salle (modèle TEK Brain), le décor .glb ou la salle vide. Jamais « scène » pour le lieu (la scène = le plateau).
- **matériel / appareil** : « matériel » pour l'ensemble, « appareil » pour un élément.
- **réglages** : les contrôles d'un appareil (gain, mute, +48V…), dans Propriétés.

## placement

Pose et déplacement d'un appareil dans la vue 3D (Task 24, CA-10). Choisir un appareil dans l'inventaire le fait suivre le pointeur (fantôme à moitié transparent) ; un clic le pose, Entrée le pose là où il est, Échap annule. Un glisser qui commence sur l'appareil déjà sélectionné le déplace (un seul pas dans l'historique) ; Échap pendant le glisser le remet en place. Alt = sans aimantation. `{device}` = nom de l'appareil, `{undo}` = touche d'annulation.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `placement.entryMove` | Déplacer {device} | à valider (tekuxwriter) | Libellé de l’entrée d’historique d’un glisser (Annuler / Rétablir) |
| `placement.statusPlacing` | Cliquez pour poser {device} (Entrée : ici). R : pivoter. Alt : libre. Échap : annuler. | à valider (tekuxwriter) | Barre d’état dès qu’un appareil est choisi (annoncé) |
| `placement.statusPlaced` | Posé : {device}. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après la pose (annoncé) |
| `placement.statusMoved` | Déplacé : {device}. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après un glisser (annoncé) |
| `placement.statusCancelled` | Pose annulée. | à valider (tekuxwriter) | Barre d’état après Échap pendant la pose (annoncé) |
| `placement.statusMoveCancelled` | Déplacement annulé : {device} est resté en place. | à valider (tekuxwriter) | Barre d’état après Échap pendant un glisser (annoncé) |
| `placement.statusRefused` | Impossible de poser {device}. | à valider (tekuxwriter) | Barre d’état si l’appareil ne peut pas être posé (annoncé) |

## edit

Pivoter, dupliquer et supprimer l'appareil sélectionné (Task 25, CA-11). R tourne de 15° (Maj+R en sens inverse, Alt+R et Alt+Maj+R de 1°) ; pendant une pose, R tourne le fantôme. Ctrl+D copie l'appareil à 0,5 m avec ses réglages (sans ses câbles) et sélectionne la copie. Suppr supprime l'appareil et ses câbles ; Ctrl+Z ramène les deux. Chaque action est une seule entrée d'historique. `{device}` = nom de l'appareil, `{undo}` = touche d'annulation, `{deg}` = orientation en degrés.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `edit.entryRotate` | Pivoter {device} | à valider (tekuxwriter) | Libellé de l’entrée d’historique d’un pas de rotation (Annuler / Rétablir) |
| `edit.entryDuplicate` | Dupliquer {device} | à valider (tekuxwriter) | Libellé de l’entrée d’historique d’une duplication |
| `edit.entryDelete` | Supprimer {device} | à valider (tekuxwriter) | Libellé de l’entrée d’historique d’une suppression (l’appareil et ses câbles) |
| `edit.statusRotated` | Pivoté : {device}, {deg}°. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après un pas de rotation (annoncé) |
| `edit.statusGhostYaw` | Orientation : {deg}°. | à valider (tekuxwriter) | Barre d’état après R pendant une pose (annoncé) |
| `edit.statusDuplicated` | Dupliqué : {device}. La copie est sélectionnée. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après Ctrl+D (annoncé) |
| `edit.statusDeleted` | Supprimé : {device}, avec ses câbles. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après Suppr (annoncé) |
| `edit.statusNoPose` | {device} n’a pas de position : impossible de le pivoter ou de le dupliquer. | à valider (tekuxwriter) | Barre d’état si l’appareil n’a pas de position enregistrée (annoncé) |
| `edit.statusWhilePlacing` | Terminez ou annulez la pose d’abord (Échap). | à valider (tekuxwriter) | Barre d’état si Suppr ou Ctrl+D est pressé pendant une pose : l’appareil sélectionné n’est pas touché (annoncé) |
| `edit.statusRefused` | Modification impossible pour {device}. | à valider (tekuxwriter) | Barre d’état si le rig refuse la modification (annoncé) |

## feedback

Retour sur un clic qui ne touche rien (Task 25, CA-12) : un message bref (`role="status"`, poli, 2,5 s), sans prendre le focus ; la sélection est levée. `{key}` = nom de la touche d'inventaire (Espace par défaut).

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `feedback.missed` | Rien ici : clique un appareil ou ouvre l’inventaire ({key}). | à valider (tekuxwriter) | Message bref après un clic sur le sol vide, le ciel ou un appareil masqué ; la sélection est levée |

## patch

Câbler au clic sur les prises de la scène (Task 26, CA-19, CA-20). Survoler une prise affiche son étiquette ; cliquer une première prise la choisit (les prises compatibles passent au vert, les autres s’atténuent), cliquer une seconde prise branche le câble. Un branchement refusé épingle le titre de la règle sur la seconde prise et l’ajoute à la liste d’erreurs de la barre d’état. Cliquer une prise déjà branchée propose « Débrancher ». Échap annule. `{a}` / `{b}` / `{port}` / `{other}` = « Appareil · prise », `{undo}` = touche d’annulation.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `patch.hoverLabel` | {port} · {connector} · {signal} | à valider (tekuxwriter) | Étiquette au survol d’une prise (jamais permanente) ; {port} = nom de la prise, {connector} = connecteur, {signal} = type de signal |
| `patch.entryConnect` | Brancher {a} à {b} | à valider (tekuxwriter) | Libellé de l’entrée d’historique d’un branchement |
| `patch.entryUnplug` | Débrancher {a} de {b} | à valider (tekuxwriter) | Libellé de l’entrée d’historique d’un débranchement |
| `patch.statusPending` | {port} choisie. Cliquez une prise verte pour brancher le câble, Échap pour annuler. | à valider (tekuxwriter) | Barre d’état après le clic sur la première prise (annoncé) |
| `patch.statusCancelled` | Câblage annulé. | à valider (tekuxwriter) | Barre d’état après Échap ou un second clic sur la même prise (annoncé) |
| `patch.statusConnected` | Branché : {a} à {b}. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après un branchement réussi (annoncé) ; {undo} = touche d’annulation |
| `patch.statusUnplugged` | Débranché : {a} de {b}. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après « Débrancher » sur une prise (annoncé) |
| `patch.errorLabel` | Branchement refusé : {title} | à valider (tekuxwriter) | Message épinglé sur la deuxième prise quand le branchement est refusé (`role="alert"`) ; {title} = titre de la règle |
| `patch.offerText` | {port} est branchée à {other}. | à valider (tekuxwriter) | Bulle sur une prise déjà branchée ; propose « Débrancher » |
| `patch.offerGroup` | Prise déjà branchée | à valider (tekuxwriter) | Nom accessible de la bulle « Débrancher » |
| `patch.offerUnplug` | Débrancher | à valider (tekuxwriter) | Texte visible du bouton de la bulle |
| `patch.offerName` | Débrancher {port} de {other} | à valider (tekuxwriter) | Nom complet du bouton de la bulle |

## connect

« Connecter à… » (Task 28, CA-02) : brancher un câble au clavier ou au lecteur d’écran. Depuis une prise libre de Propriétés › Connexions, une boîte de dialogue liste les prises libres des autres appareils, groupées par appareil. Un champ « Filtrer » réduit la liste, Entrée branche. Les prises impossibles sont dans un groupe replié « Incompatibles », avec la raison, et ne se choisissent pas.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `connect.title` | Connecter à… | à valider (tekuxwriter) | Titre de la boîte de dialogue |
| `connect.body` | Depuis {port}. Tapez pour filtrer, flèches haut et bas pour choisir, Entrée pour brancher, Échap pour fermer. | à valider (tekuxwriter) | Sous le titre, lue comme sa description ; {port} = la prise de départ avec son connecteur et son signal |
| `connect.filter` | Filtrer | à valider (tekuxwriter) | Libellé du champ de filtre (saisie qui réduit la liste) |
| `connect.listName` | Prises compatibles | à valider (tekuxwriter) | Nom de la liste des prises compatibles |
| `connect.countOne` | 1 prise compatible. | à valider (tekuxwriter) | Annonce (polite) du nombre de prises après une frappe |
| `connect.countMany` | {n} prises compatibles. | à valider (tekuxwriter) | Idem ; {n} = nombre |
| `connect.none` | Aucune prise compatible n’est libre. | à valider (tekuxwriter) | Rien de compatible du tout (aucun filtre) : dit en clair dans la boîte |
| `connect.noMatch` | Aucune prise ne correspond à « {query} ». | à valider (tekuxwriter) | Le filtre ne retient rien ; {query} = le texte tapé |
| `connect.rejectedToggle` | Incompatibles ({n}) | à valider (tekuxwriter) | Bouton qui déplie le groupe des prises refusées ; {n} = nombre |
| `connect.rejectedHint` | Ces prises ne peuvent pas recevoir ce câble ; chacune dit pourquoi. | à valider (tekuxwriter) | Phrase au-dessus du groupe des prises refusées (elles ne se choisissent pas) |
| `connect.cancel` | Annuler | à valider (tekuxwriter) | Bouton qui ferme sans brancher |
| `connect.statusConnected` | Connecté : {a} à {b}. {undo} pour annuler. | à valider (tekuxwriter) | Barre d’état après un branchement par la boîte (annoncé poliment, une fois) ; {a} / {b} = « Appareil (id) · prise », {undo} = touche d’annulation |
| `connect.statusClosedStale` | Connecter à… fermé : le matériel a changé. Rouvrez-le pour voir les prises à jour. | à valider (tekuxwriter) | Barre d’état quand la boîte se ferme parce que le matériel a changé pendant qu’elle était ouverte |

Chaque prise refusée du groupe « Incompatibles » affiche sous son nom deux lignes qui ne sont pas des clés `copy.ts` : le titre de la règle (`title_fr`, en rouge) puis son texte pédagogique (`teach_fr`, classe `.cr-connect-teach`, Task 29), tous deux lus dans le catalogue (voir « Textes des règles »).

## cables

Câbles colorés par type de signal (Task 27, C18). La couleur n’est jamais le seul repère : le secteur est tracé en pointillés, et la légende comme le texte au survol nomment le signal. La légende est un bloc repliable en bas du panneau Propriétés (jamais sur la vue 3D) ; elle ne liste que les types de signal présents. Survoler un câble le met en évidence et affiche « ql1 out-main-l → k12-g in-line-a · Niveau ligne pro (+4 dBu) » (les noms de signal sont ceux de la section `signal`).

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `cables.legendTitle` | Légende des câbles | à valider (tekuxwriter) | Titre visible du bloc légende (bas du panneau Propriétés), aussi nom accessible de la liste |
| `cables.legendCollapse` | Replier la légende des câbles | à valider (tekuxwriter) | Nom accessible du bouton de la légende quand elle est dépliée (il la replie) |
| `cables.legendExpand` | Déplier la légende des câbles | à valider (tekuxwriter) | Nom accessible du bouton quand elle est repliée (il la déplie) |
| `cables.dashed` | pointillés | à valider (tekuxwriter) | Mention à côté d’un type de signal tracé en pointillés (le trait n’est pas le seul repère : la couleur non plus) |
| `cables.hover` | {a} → {b} · {signal} | à valider (tekuxwriter) | Texte au survol d’un câble ; {a} / {b} = « appareil prise » de chaque bout, {signal} = type de signal |
| `cables.hoverLength` | {a} → {b} · {signal} · {length} | à valider (tekuxwriter) | Le même texte avec la longueur du câble tracé ; {length} = « 6,4 m » |
| `cables.length` | {n} m | à valider (tekuxwriter) | Une longueur de câble en mètres ; {n} = un chiffre après la virgule (« 6,4 ») |

## connector

Noms français des connecteurs du catalogue (`connectorTypes[].id`), repris dans l’étiquette au survol d’une prise : rendus fidèles des libellés du catalogue, sans fait technique nouveau.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `connector.xlr3-m` | XLR3 mâle | à valider (tekuxwriter) | Étiquette de prise |
| `connector.xlr3-f` | XLR3 femelle | à valider (tekuxwriter) | Étiquette de prise |
| `connector.xlr5-m` | XLR5 mâle (DMX) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.xlr5-f` | XLR5 femelle (DMX) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.trs-quarter` | Jack TRS 6,35 mm (symétrique / stéréo) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.ts-quarter` | Jack TS 6,35 mm (asymétrique) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.trs-35mm` | Mini-jack TRS 3,5 mm | à valider (tekuxwriter) | Étiquette de prise |
| `connector.rca` | RCA / cinch | à valider (tekuxwriter) | Étiquette de prise |
| `connector.rj45` | RJ45 (Cat5e/6) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.ethercon` | Neutrik etherCON (RJ45 renforcé) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.speakon-nl4` | Neutrik Speakon NL4 | à valider (tekuxwriter) | Étiquette de prise |
| `connector.powercon-blue` | Neutrik powerCON (bleu, entrée secteur) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.powercon-true1` | Neutrik powerCON TRUE1 | à valider (tekuxwriter) | Étiquette de prise |
| `connector.iec-c13` | IEC C13 (fiche secteur) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.iec-c14` | IEC C14 (embase secteur) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.schuko-plug` | Fiche Schuko (CEE 7/7) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.schuko-socket` | Prise murale Schuko (CEE 7/3) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.bnc` | BNC 75 Ω (word clock / MADI coaxial) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.tt-bantam` | TT / Bantam 4,4 mm (baie de brassage) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.dsub25` | D-sub 25 (TASCAM analogique / AES59 numérique) | à valider (tekuxwriter) | Étiquette de prise |
| `connector.toslink` | TOSLINK optique | à valider (tekuxwriter) | Étiquette de prise |
| `connector.usb-a` | USB Type-A | à valider (tekuxwriter) | Étiquette de prise |
| `connector.usb-b` | USB Type-B | à valider (tekuxwriter) | Étiquette de prise |
| `connector.usb-c` | USB Type-C / Thunderbolt 3 | à valider (tekuxwriter) | Étiquette de prise |
| `connector.digilink` | Avid DigiLink | à valider (tekuxwriter) | Étiquette de prise |
| `connector.gpio-terminal` | Bornier GPIO / port logique D-sub | à valider (tekuxwriter) | Étiquette de prise |

## coverage

Couverture (Task 37, C13, S2) : Écoute › Couverture, l’échelle, les statistiques et les mentions d’honnêteté. Aucun score d’intelligibilité, aucune limite réglementaire : niveaux relatifs seulement (brief §5). Toutes les formulations sont des brouillons.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `coverage.panelTitle` | Couverture | à valider (tekuxwriter) | Titre du bloc, bas de Propriétés (jamais sur la vue 3D) |
| `coverage.panelCollapse` | Replier la couverture | à valider (tekuxwriter) | Nom du bouton quand le bloc est déplié |
| `coverage.panelExpand` | Déplier la couverture | à valider (tekuxwriter) | Nom du bouton quand le bloc est replié |
| `coverage.unit` | dB relatif (0 = point le plus fort) | à valider (tekuxwriter) | Unité de l’échelle. Mot pour mot (brief §5) |
| `coverage.method` | somme énergétique, champ direct | à valider (tekuxwriter) | Ce que le calcul fait. Mot pour mot (brief §5) |
| `coverage.chip` | relatif | à valider (tekuxwriter) | Pastille de fidélité (brief §5) |
| `coverage.chipName` | Fidélité du calcul : relatif | à valider (tekuxwriter) | Nom accessible de la pastille (bouton qui ouvre l’explication) |
| `coverage.chipPopover` | Estimation pédagogique : les niveaux sont comparés entre eux, pas mesurés. 0 dB est le point le plus fort de la grille d’écoute (public et régie) avec ces réglages. Champ direct seulement : ni réflexions de la salle, ni interférences. Le balance et les canaux L/R de la console ne changent pas le niveau affiché ; l’origine de l’enceinte est son point de pose. | à valider (tekuxwriter) | Explication de la pastille |
| `coverage.legendTitle` | Échelle | à valider (tekuxwriter) | Titre de la légende des couleurs |
| `coverage.legendBin` | {from} à {to} dB | à valider (tekuxwriter) | Une ligne de légende ; {from} / {to} = bornes de la classe de 3 dB |
| `coverage.legendLast` | {from} dB et moins | à valider (tekuxwriter) | Dernière ligne de légende (classe ouverte vers le bas) |
| `coverage.legendCount` | {n} points | à valider (tekuxwriter) | Nombre de points dans la classe (texte lu avec la couleur) |
| `coverage.hatched` | Hachuré : interférences non modélisées | à valider (tekuxwriter) | Ligne de légende des points à recouvrement (deux enceintes à 6 dB ou moins l’une de l’autre). Mot pour mot (brief §5) |
| `coverage.hatchedCount` | {n} points concernés | à valider (tekuxwriter) | Nombre de points hachurés |
| `coverage.aim` | Trait clair : axe de chaque enceinte audible | à valider (tekuxwriter) | Légende des traits d’axe tracés dans la vue 3D tant que la couverture est affichée |
| `coverage.frontCaveat` | La direction de chaque enceinte est indiquée par le trait ; la forme du modèle 3D peut ne pas correspondre à la vraie face avant (modèles en cours de refonte). | à valider (tekuxwriter) | Mention honnête affichée tant que la couverture est affichée (décision controller, L30 viii : on garde la convention lacet 0 = +z ; les modèles 3D sont en refonte). Ne dit pas que le modèle a tort ou raison |
| `coverage.sourceLine` | Couverture : {sources} | à valider (tekuxwriter) | Provenance des angles ; {sources} = liste construite avec les clés ci-dessous |
| `coverage.sourceKb` | données KB | à valider (tekuxwriter) | Angle issu de la base de connaissances |
| `coverage.sourceNominal` | valeur nominale | à valider (tekuxwriter) | Angle par défaut 90° × 60° (aucune donnée constructeur) |
| `coverage.sourceDatasheet` | fiche constructeur | à valider (tekuxwriter) | Angle issu d’une fiche constructeur |
| `coverage.sourceDeduced` | V déduit | à valider (tekuxwriter) | À ajouter à « données KB » quand l’angle vertical est une déduction (K12.2 : « axisymmetric ») |
| `coverage.speakersTitle` | Enceintes prises en compte | à valider (tekuxwriter) | Titre de la liste des enceintes du calcul |
| `coverage.speakerRow` | {name} : {h}° × {v}° | à valider (tekuxwriter) | Une enceinte ; {name} = identifiant, {h} / {v} = couverture horizontale / verticale |
| `coverage.statsTitle` | Statistiques | à valider (tekuxwriter) | Titre du bloc de statistiques (équivalent texte des points) |
| `coverage.statMin` | Minimum | à valider (tekuxwriter) | Statistique |
| `coverage.statMax` | Maximum | à valider (tekuxwriter) | Statistique |
| `coverage.statMean` | Moyenne | à valider (tekuxwriter) | Statistique |
| `coverage.statSd` | Écart-type | à valider (tekuxwriter) | Statistique (écart-type de population) |
| `coverage.statCount` | Points | à valider (tekuxwriter) | Nombre de points d’écoute calculés |
| `coverage.statStep` | Pas de la grille | à valider (tekuxwriter) | Distance entre deux points d’écoute |
| `coverage.dbValue` | {v} dB | à valider (tekuxwriter) | Un niveau relatif ; {v} = nombre |
| `coverage.mValue` | {v} m | à valider (tekuxwriter) | Une distance ; {v} = nombre |
| `coverage.pointsTitle` | Niveau en un point | à valider (tekuxwriter) | Titre de la liste des points d’écoute nommés et du point épinglé |
| `coverage.pointRow` | {name} : {value} | à valider (tekuxwriter) | Un point nommé ; {value} = niveau relatif |
| `coverage.pointSilent` | aucun son | à valider (tekuxwriter) | Valeur d’un point qui ne reçoit rien |
| `coverage.pin` | Épingler {name} | à valider (tekuxwriter) | Nom du bouton d’un point nommé ; {name} = Régie… |
| `coverage.pinned` | Point épinglé ({x} m ; {z} m) : {value} | à valider (tekuxwriter) | Valeur du point cliqué dans la vue 3D ; {x} / {z} = position |
| `coverage.unpin` | Retirer l’épingle | à valider (tekuxwriter) | Bouton |
| `coverage.pinHint` | Cliquez un point coloré dans la vue 3D pour épingler son niveau. | à valider (tekuxwriter) | Aide sous la liste |
| `coverage.probeAbove` | Un point nommé peut dépasser 0 dB : l’échelle est celle de la grille. | à valider (tekuxwriter) | Note sous la liste des points quand un point nommé est plus fort que le point le plus fort de la grille |
| `coverage.splPending` | ≈ dB SPL estimé : non calculé (estimation pédagogique, formule non sourcée). | à valider (tekuxwriter) | Seulement si chaque enceinte a une sensibilité et un SPL max sourcés (aucune aujourd’hui : jamais affiché) |
| `coverage.computing` | Calcul de la couverture… | à valider (tekuxwriter) | État pendant le calcul |
| `coverage.failed` | Calcul de la couverture indisponible (réessayez). | à valider (tekuxwriter) | Le Worker n’a pas répondu ou a refusé le calcul |
| `coverage.hiddenFolded` | Couverture masquée : Propriétés est replié. | à valider (tekuxwriter) | Annoncé une fois quand on replie Propriétés alors que la couverture est cochée (les points reviennent au dépliage) |
| `coverage.noAudience` | Pas de public dans ce lieu : aucune zone public ni régie à couvrir. Rien à calculer. | à valider (tekuxwriter) | Lieu sans zone « audience » ni « foh » |
| `coverage.noSource` | Aucune enceinte audible : {reason} | à valider (tekuxwriter) | Aucun son à montrer ; {reason} = une raison ci-dessous |
| `coverage.reasonNotFed` | aucune enceinte ne reçoit de signal ({why}) | à valider (tekuxwriter) | Le chemin du signal n’atteint aucune enceinte ; {why} = la première raison de la lecture |
| `coverage.reasonNotFedBare` | aucune enceinte ne reçoit de signal | à valider (tekuxwriter) | Idem sans raison détaillée |
| `coverage.reasonMuted` | la console est en mute | à valider (tekuxwriter) | Toutes les enceintes alimentées sont en sourdine |
| `coverage.reasonSilent` | le fader master est à −inf | à valider (tekuxwriter) | Toutes les enceintes alimentées sont à −inf |
| `coverage.reasonUnverified` | appareil non vérifié (Bêta) | à valider (tekuxwriter) | Enceinte Bêta : aucune donnée acoustique vérifiée |
| `coverage.reasonNoAcoustic` | enceinte sans données acoustiques | à valider (tekuxwriter) | Enceinte du catalogue sans angles de couverture |
| `coverage.reasonUnpowered` | enceinte hors tension | à valider (tekuxwriter) | Enceinte alimentée en signal mais sans secteur |
| `coverage.reasonOther` | enceinte non utilisable | à valider (tekuxwriter) | Raison de repli (position ou couverture invalide) |
| `coverage.reasonsJoin` |  ;  | à valider (tekuxwriter) | Séparateur de plusieurs raisons |
| `coverage.announceDone` | Couverture calculée : {n} points, {min} à {max} dB, pas {step} m. | à valider (tekuxwriter) | Annoncé une fois par résultat (zone d’état) |
| `coverage.announceOff` | Couverture masquée. | à valider (tekuxwriter) | Annoncé quand on la masque |
| `coverage.loadFailed` | La couverture n’a pas pu se charger. Rechargez la page. | à valider (tekuxwriter) | Le morceau de code de la couverture n’a pas pu être téléchargé (hors ligne) ; annoncé, la case reste décochée |
