# Copy deck — Mode Création

Owner: **tekuxwriter**. Source of truth for every string of the Mode Création shell; `src/creation/copy.ts` mirrors it key by key (`tests/creation/copyDeck.test.ts` checks both match). Change both together.

Rules: French first, English technical terms kept as students meet them (XLR, Dante, gain, fader, mute). Short, concrete, never blaming. No string ships with `[À REMPLACER`.

Status column:
- **brief** — wording given verbatim by the plan (Task 7 brief / council), validated with it.
- **validé** — reviewed and accepted by tekuxwriter.
- **à valider (tekuxwriter)** — authored by tekfrontenddesigner in Task 7 (or carried over from Task 6), awaiting tekuxwriter.

## shell

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `shell.skip` | Aller à la vue 3D | brief | Lien d'évitement, premier arrêt Tab (C10) |
| `shell.menubar` | Menu principal | brief | `aria-label` de la barre de menus |
| `shell.untitled` | Projet sans titre | à valider (tekuxwriter) | Titre du projet tant qu'il n'a pas de nom (C16 le rendra éditable) |
| `shell.tree` | Projet | brief | Panneau gauche (landmark `nav`) |
| `shell.props` | Propriétés | brief | Panneau droit (landmark `aside`) |
| `shell.treeCollapse` | Replier le panneau Projet | brief | Bouton, panneau ouvert |
| `shell.treeExpand` | Déplier le panneau Projet | brief | Bouton, panneau replié (rail 32 px) |
| `shell.propsCollapse` | Replier le panneau Propriétés | brief | Bouton, panneau ouvert |
| `shell.propsExpand` | Déplier le panneau Propriétés | brief | Bouton, panneau replié |
| `shell.canvas` | Vue 3D : flèches = orbiter, [ ] = appareil suivant/précédent, Entrée = cadrer | brief | `aria-label` du canvas (touches livrées en Task 8) |
| `shell.propsEmpty` | Sélectionnez un appareil pour voir ses réglages. | à valider (tekuxwriter) | Propriétés : état vide |
| `shell.statusNoPlace` | Choisissez un lieu pour commencer. | à valider (tekuxwriter) | Barre d'état, avant le premier lieu |
| `shell.statusLoading` | Chargement du lieu… | à valider (tekuxwriter) | Barre d'état pendant un changement de lieu (`role="status"`) |
| `shell.statusReady` | Prêt | à valider (tekuxwriter) | Barre d'état, lieu affiché |
| `shell.siteBack` | Retour au site Tekonest | validé | Lien vers le site, à droite de la barre du haut (même nom accessible que l'ancien `#site-link`) |
| `shell.brand` | TekPractice | validé | Nom du produit, non traduit |
| `shell.appTitle` | TekPractice, Mode Création | à valider (tekuxwriter) | Task 8 : `h1` de la page, visuellement masqué (navigation par titres au lecteur d'écran ; le sélecteur de lieu passe en `h2`) |
| `shell.statusSelected` | Sélectionné : {device} | à valider (tekuxwriter) | Task 8 : barre d'état (`role="status"`, annoncé) après `[` / `]` dans la vue 3D ; `{device}` = nom catalogue de l'appareil |
| `shell.statusNoSelection` | Aucun appareil sélectionné | à valider (tekuxwriter) | Task 8 : barre d'état, Échap dans la vue 3D a vidé la sélection |
| `shell.statusNothingToSelect` | Aucun appareil à sélectionner. Ajoutez-en depuis l’inventaire. | à valider (tekuxwriter) | Task 8 : barre d'état, `[` / `]` pressé sans matériel installé (retour sur chaque touche manquée) |

## keys

Noms de touches affichés à droite des entrées de menu (carte des touches, Task 8). Les lettres et chiffres s'affichent tels quels (« Ctrl+Z », « Alt+H », « 1 »), ainsi que « [ » et « ] ».

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `keys.delete` | Suppr | brief | Touche Suppr (action Supprimer) |
| `keys.space` | Espace | brief | Barre d'espace (inventaire) |
| `keys.escape` | Échap | à valider (tekuxwriter) | Touche Échap (annuler / fermer) |
| `keys.enter` | Entrée | à valider (tekuxwriter) | Touche Entrée (cadrer depuis la vue 3D) |
| `keys.shift` | Maj | à valider (tekuxwriter) | Modificateur Maj (« Maj+V », « Maj+R ») ; Ctrl et Alt restent tels quels |

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
| `menu.save` | Enregistrer | à valider (tekuxwriter) | Projet ; inactif jusqu'à l'autosave/Ctrl+S (C16) |
| `menu.choosePlace` | Choisir un lieu… | à valider (tekuxwriter) | Lieu ; affiché seulement si aucune liste de lieux n'est fournie (le vrai sélecteur arrive en Task 12) |
| `menu.inventory` | Ouvrir l’inventaire | à valider (tekuxwriter) | Matériel ; inactif jusqu'au tiroir d'inventaire |
| `menu.connectTo` | Connecter à… | à valider (tekuxwriter) | Câblage ; même libellé que l'action Propriétés « Connecter à… » (C10) |
| `menu.play` | Écouter le morceau | à valider (tekuxwriter) | Écoute ; inactif tant que la lecture n'existe pas |
| `menu.panelTree` | Panneau Projet | à valider (tekuxwriter) | Vue ; replie / déplie le panneau |
| `menu.panelProps` | Panneau Propriétés | à valider (tekuxwriter) | Vue ; idem |
| `menu.shortcuts` | Raccourcis clavier | à valider (tekuxwriter) | Aide ; affiche « H » depuis Task 8, inactif jusqu'au panneau d'aide |
| `menu.siteBack` | Retour au site Tekonest | validé | Aide ; même libellé que `shell.siteBack` |

Lieu also lists the places offered by the temporary picker, with their room names from `content/rooms/index.json` (`name_fr`) and `picker.blank`.

## tree

Arbre « Projet » (Task 9, modèle WAI-ARIA tree). Remplace les clés `shell.treePlace`, `shell.treeGear`, `shell.treeNoPlace` et `shell.treeNoGear` (Task 7), supprimées. Les lignes d'appareil s'affichent « {nom catalogue} ({id}) », ex. « Yamaha QL1 (ql1) » ; les câbles « {id} {port} → {id} {port} », ex. « ql1 out-main-l → k12-g in-line-a » (nom de port français quand le catalogue en aura un) ; les zones par leur type en français (section `zoneKind`), numérotées quand un type se répète (« Public », « Public 2 »).

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `tree.place` | Lieu : {place} | à valider (tekuxwriter) | Première ligne de l'arbre ; Entrée = retour à la vue d'ensemble ; `{place}` = nom du lieu |
| `tree.noPlace` | aucun lieu choisi | à valider (tekuxwriter) | `{place}` avant le premier lieu (« Lieu : aucun lieu choisi ») |
| `tree.zones` | Zones | brief | Groupe (brief §3) |
| `tree.gear` | Matériel | brief | Groupe (brief §3) |
| `tree.cables` | Câbles | brief | Groupe (brief §3) |
| `tree.points` | Points d’écoute | brief | Groupe (brief §3) ; vide jusqu'à l'acoustique |
| `tree.hide` | Masquer {item} | brief | Nom du bouton œil (Task 9) ; `{item}` = libellé de la ligne |
| `tree.show` | Afficher {item} | brief | Idem, élément masqué |
| `tree.noGear` | Aucun appareil installé | à valider (tekuxwriter) | Sous le groupe « Matériel » vide (et sa description). Reprend l'ancienne `shell.treeNoGear` ; quand l'inventaire existera, ajouter « Ouvrez l'inventaire pour en ajouter. » |
| `tree.zone` | Zone | à valider (tekuxwriter) | Zone d'un type sans nom dans `zoneKind` |
| `tree.hiddenState` | masqué | à valider (tekuxwriter) | Lu après le nom d'une ligne masquée (lecteur d'écran ; à l'écran : texte barré) |
| `tree.help` | Flèches pour parcourir, Entrée pour sélectionner et cadrer, flèche droite sur un élément pour atteindre son bouton Masquer. | à valider (tekuxwriter) | Description de l'arbre (`aria-describedby`, lue à l'entrée dans l'arbre) |
| `tree.statusHidden` | Masqué : {item} | à valider (tekuxwriter) | Barre d'état (annoncé) après le bouton œil |
| `tree.statusShown` | Affiché : {item} | à valider (tekuxwriter) | Idem |
| `tree.statusFramed` | Cadré : {item} | à valider (tekuxwriter) | Barre d'état (annoncé) après Entrée sur une zone ou un câble |

## zoneKind

Types de zones des salles (`content/rooms/*.json`, `zones[].kind`), nommés dans l'arbre « Projet » (Task 9 review). Clé = le type tel qu'écrit dans les données.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `zoneKind.stage` | Scène | à valider (tekuxwriter) | Arbre, groupe Zones |
| `zoneKind.audience` | Public | à valider (tekuxwriter) | Idem (fosse, balcon : « Public », « Public 2 ») |
| `zoneKind.foh` | Régie façade | à valider (tekuxwriter) | Idem |
| `zoneKind.monitor-world` | Régie retours | à valider (tekuxwriter) | Idem |
| `zoneKind.backstage` | Coulisses | à valider (tekuxwriter) | Idem |
| `zoneKind.control-room` | Régie | à valider (tekuxwriter) | Idem (studios) |
| `zoneKind.booth` | Cabine | à valider (tekuxwriter) | Idem |
| `zoneKind.desk` | Poste de régie | à valider (tekuxwriter) | Idem |
| `zoneKind.machine-room` | Local technique | à valider (tekuxwriter) | Idem |
| `zoneKind.vocal-booth` | Cabine voix | à valider (tekuxwriter) | Idem |
| `zoneKind.iso-booth` | Cabine isolée | à valider (tekuxwriter) | Idem |
| `zoneKind.live-room` | Salle de prise | à valider (tekuxwriter) | Idem |
| `zoneKind.pit` | Fosse | à valider (tekuxwriter) | Idem (fosse d'orchestre) |
| `zoneKind.gallery` | Galerie | à valider (tekuxwriter) | Idem |
| `zoneKind.other` | Autre zone | à valider (tekuxwriter) | Idem |

## picker

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `picker.title` | Choisir un lieu | validé | Titre (h2 depuis Task 8, sous le `h1` `shell.appTitle`) du sélecteur temporaire, dans la vue 3D avant le premier lieu |
| `picker.blank` | Salle vide neutre | brief | Carte de la salle vide (L1) |

## place

Dialogue « Changer de lieu » (C3), ouvert quand du matériel est déjà installé.

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `place.dialogTitle` | Changer de lieu | à valider (tekuxwriter) | Titre du dialogue ; aussi le libellé de l'entrée d'historique. Revu en Task 7 : verbe d'action + objet, clair, gardé. |
| `place.dialogBody` | Du matériel est déjà installé. Gardez-le pour le placer dans le nouveau lieu, ou repartez d’une scène vide. | à valider (tekuxwriter) | Revu en Task 7. Avant : « Que voulez-vous en faire dans le nouveau lieu ? » (question ouverte). Maintenant le corps nomme les deux choix avec les mêmes verbes que les boutons (garder / repartir), Annuler reste implicite. |
| `place.keep` | Garder le matériel | brief | Bouton principal (C3) |
| `place.empty` | Repartir à vide | brief | Bouton (C3) |
| `place.cancel` | Annuler | validé | Bouton ; Échap fait pareil |

## Glossaire

- **lieu** : la salle (modèle TEK Brain), le décor .glb ou la salle vide. Jamais « scène » pour le lieu (la scène = le plateau).
- **matériel / appareil** : « matériel » pour l'ensemble, « appareil » pour un élément.
- **réglages** : les contrôles d'un appareil (gain, mute, +48V…), dans Propriétés.
