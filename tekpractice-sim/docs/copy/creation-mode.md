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
| `shell.treePlace` | Lieu | à valider (tekuxwriter) | Arbre : en-tête du groupe lieu |
| `shell.treeGear` | Matériel | à valider (tekuxwriter) | Arbre : en-tête du groupe matériel |
| `shell.treeNoPlace` | Aucun lieu choisi | à valider (tekuxwriter) | Arbre : avant le premier lieu |
| `shell.treeNoGear` | Aucun appareil installé | à valider (tekuxwriter) | Arbre : état vide du matériel (l'inventaire arrive plus tard ; ajouter alors « Ouvrez l'inventaire pour en ajouter. ») |
| `shell.propsEmpty` | Sélectionnez un appareil pour voir ses réglages. | à valider (tekuxwriter) | Propriétés : état vide |
| `shell.statusNoPlace` | Choisissez un lieu pour commencer. | à valider (tekuxwriter) | Barre d'état, avant le premier lieu |
| `shell.statusLoading` | Chargement du lieu… | à valider (tekuxwriter) | Barre d'état pendant un changement de lieu (`role="status"`) |
| `shell.statusReady` | Prêt | à valider (tekuxwriter) | Barre d'état, lieu affiché |
| `shell.siteBack` | Retour au site Tekonest | validé | Lien vers le site, à droite de la barre du haut (même nom accessible que l'ancien `#site-link`) |
| `shell.brand` | TekPractice | validé | Nom du produit, non traduit |

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
| `menu.shortcuts` | Raccourcis clavier | à valider (tekuxwriter) | Aide ; inactif jusqu'à Task 8 |
| `menu.siteBack` | Retour au site Tekonest | validé | Aide ; même libellé que `shell.siteBack` |

Lieu also lists the places offered by the temporary picker, with their room names from `content/rooms/index.json` (`name_fr`) and `picker.blank`.

## picker

| Key | Texte | Statut | Où / notes |
|---|---|---|---|
| `picker.title` | Choisir un lieu | validé | Titre (h1) du sélecteur temporaire, dans la vue 3D avant le premier lieu |
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
