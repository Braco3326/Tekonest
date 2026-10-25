# Copy deck — Mode Création

Owner: **tekuxwriter**. Source of truth for every string of the Mode Création shell; `src/creation/copy.ts` mirrors it key by key (`tests/creation/copyDeck.test.ts` checks both match). Change both together.

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
| `shell.canvas` | Vue 3D : flèches = orbiter, [ ] = appareil suivant/précédent, Entrée = cadrer | brief | `aria-label` du canvas (touches livrées en Task 8) |
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
| `menu.inventory` | Ouvrir l’inventaire | validé | Matériel ; inactif jusqu'au tiroir d'inventaire |
| `menu.connectTo` | Connecter à… | validé | Câblage ; même libellé que l'action Propriétés « Connecter à… » (C10) |
| `menu.play` | Écouter le morceau | validé | Écoute ; inactif tant que la lecture n'existe pas |
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

Task 14 (barre d'état, liste d'erreurs persistante) : les textes des règles R1–R8 (`rule.*`) sont des rendus fidèles du catalogue (`title` / `check`), sans nouvelle affirmation technique.

## status

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `status.selection` | Sélection : {device} | brief | Barre d'état, texte fixe ; `{device}` = « Yamaha QL1 (ql1) » |
| `status.selectionNone` | Aucune sélection | brief | Barre d'état, rien de sélectionné |
| `status.snapping` | Aimantation : 0,25 m · 15° | brief | Barre d'état : pas de placement (grille, rotation R) ; masqué tant que l'aimantation de placement n'existe pas |
| `status.snappingFree` | Aimantation : libre | brief | Barre d'état : placement libre (Maj) ; masqué tant que l'aimantation de placement n'existe pas |
| `status.signalOk` | Signal OK | brief | Bouton signal, couleur ok + glyphe ✓, UNIQUEMENT quand le chemin du signal peut jouer (`playbackReady`, décision L5) |
| `status.signalNoError` | Aucune erreur détectée | validé | Bouton signal, 0 erreur mais lecture non prouvée (L5) : couleur neutre (ink-muted), glyphe ○ |
| `status.signalNothing` | Rien de branché | validé | Bouton signal, aucun câble dans le montage (L5) : neutre, glyphe ○ |
| `status.errorsOne` | 1 erreur | brief | Bouton signal (couleur danger + glyphe ⚠) |
| `status.errorsMany` | {n} erreurs | brief | Idem, `{n}` ≥ 2 |
| `status.warningsOne` | 1 avertissement | validé | À côté du bouton signal (les avertissements ne comptent pas comme erreurs) |
| `status.warningsMany` | {n} avertissements | validé | Idem, `{n}` ≥ 2 |
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

## rule

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `rule.R1Title` | Connecteurs incompatibles | validé | Source : catalog.json `rules[R1].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R1Detail` | Les deux connecteurs doivent pouvoir s’emboîter physiquement. Si ça ne rentre pas, ce n’est pas le bon câble : ne forcez jamais. | validé | Source : catalog.json `rules[R1].check` + `teach` (« never force it »), traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R2Title` | Types de signal incompatibles | validé | Source : catalog.json `rules[R2].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R2Detail` | La source et la destination doivent transporter des signaux compatibles : micro vers préampli micro, ligne vers ligne, numérique vers le même format numérique. | validé | Source : catalog.json `rules[R2].check`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R3Title` | Sens de connexion incorrect | validé | Source : catalog.json `rules[R3].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R3Detail` | Une sortie doit être reliée à une entrée (sortie → entrée). Sortie vers sortie ou entrée vers entrée n’est pas valide. Une prise bidirectionnelle accepte l’un ou l’autre sens. | validé | Source : catalog.json `rules[R3].check`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R4Title` | Alimentation fantôme (+48 V) | validé | Source : catalog.json `rules[R4].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R4Detail` | Un appareil qui demande le +48 V doit arriver sur une entrée qui le fournit, avec le +48 V activé. | validé | Source : catalog.json `rules[R4].check`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R5Title` | Voyant ON-AIR (tally) | validé | Source : catalog.json `rules[R5].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R5Detail` | Quand un fader micro est ouvert sur une console de diffusion, sa sortie GPIO (tally) doit allumer un voyant ON-AIR. | validé | Source : catalog.json `rules[R5].check`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R6Title` | Écoutes non coupées, micro ouvert (larsen) | validé | Source : catalog.json `rules[R6].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R6Detail` | Ouvrir un micro dans la même pièce que des écoutes actives doit couper ces écoutes ; sinon une boucle de larsen est détectée. | validé | Source : catalog.json `rules[R6].check`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R7Title` | Mix-minus (N-1) : écho du retour | validé | Source : catalog.json `rules[R7].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R7Detail` | Le départ vers un codec distant doit être le programme moins le retour de ce codec (N-1). Si ce retour est dans son propre départ, il y a écho. | validé | Source : catalog.json `rules[R7].check`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R8Title` | Word clock maître/esclave et fréquence d’échantillonnage | validé | Source : catalog.json `rules[R8].title`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |
| `rule.R8Detail` | Chaque liaison audio numérique a besoin d’une seule horloge maître en amont. Deux maîtres, aucun maître ou des fréquences différentes sur une liaison sont des erreurs. | validé | Source : catalog.json `rules[R8].check`, traduction fidèle sans fait nouveau ; remplacé par `title_fr` / `teach_fr` du catalogue en Task 29 |

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

## Glossaire

- **lieu** : la salle (modèle TEK Brain), le décor .glb ou la salle vide. Jamais « scène » pour le lieu (la scène = le plateau).
- **matériel / appareil** : « matériel » pour l'ensemble, « appareil » pour un élément.
- **réglages** : les contrôles d'un appareil (gain, mute, +48V…), dans Propriétés.
