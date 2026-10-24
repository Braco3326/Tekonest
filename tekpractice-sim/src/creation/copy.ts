/**
 * Every Mode Création shell string (wording owned by tekuxwriter). Grows task by task.
 * Mirror of the copy deck docs/copy/creation-mode.md: change both together.
 */
export const COPY: { readonly [section: string]: Readonly<Record<string, string>> } = {
  shell: {
    /** Skip link, first tab stop (C10). */
    skip: 'Aller à la vue 3D',
    /** Top bar landmark. */
    menubar: 'Menu principal',
    /** Shown in the title slot until a project has a name. */
    untitled: 'Projet sans titre',
    tree: 'Projet',
    props: 'Propriétés',
    treeCollapse: 'Replier le panneau Projet',
    treeExpand: 'Déplier le panneau Projet',
    propsCollapse: 'Replier le panneau Propriétés',
    propsExpand: 'Déplier le panneau Propriétés',
    canvas: 'Vue 3D : flèches = orbiter, [ ] = appareil suivant/précédent, Entrée = cadrer',
    /** Tree: the place row label (followed by the place name). */
    treePlace: 'Lieu',
    /** Tree: the gear group. */
    treeGear: 'Matériel',
    treeNoPlace: 'Aucun lieu choisi',
    treeNoGear: 'Aucun appareil installé',
    propsEmpty: 'Sélectionnez un appareil pour voir ses réglages.',
    statusNoPlace: 'Choisissez un lieu pour commencer.',
    statusLoading: 'Chargement du lieu…',
    statusReady: 'Prêt',
    siteBack: 'Retour au site Tekonest',
    /** Product name in the top bar (brand, not translated). */
    brand: 'TekPractice',
    /** The page's h1 (visually hidden): names the app for screen-reader heading navigation. */
    appTitle: 'TekPractice, Mode Création',
    /** Status bar after [ / ] (announced, `role="status"`); {device} = the device name. */
    statusSelected: 'Sélectionné : {device}',
    /** Status bar: Échap in the 3D view cleared the selection. */
    statusNoSelection: 'Aucun appareil sélectionné',
    /** Status bar: [ / ] pressed while the place has no gear. */
    statusNothingToSelect: 'Aucun appareil à sélectionner. Ajoutez-en depuis l’inventaire.',
  },
  keys: {
    /** Key names shown next to menu items (French keyboard labels). */
    delete: 'Suppr',
    space: 'Espace',
    escape: 'Échap',
    enter: 'Entrée',
    shift: 'Maj',
  },
  menu: {
    projet: 'Projet',
    lieu: 'Lieu',
    materiel: 'Matériel',
    cablage: 'Câblage',
    ecoute: 'Écoute',
    vue: 'Vue',
    aide: 'Aide',
    undo: 'Annuler',
    redo: 'Rétablir',
    save: 'Enregistrer',
    choosePlace: 'Choisir un lieu…',
    inventory: 'Ouvrir l’inventaire',
    connectTo: 'Connecter à…',
    play: 'Écouter le morceau',
    panelTree: 'Panneau Projet',
    panelProps: 'Panneau Propriétés',
    shortcuts: 'Raccourcis clavier',
    siteBack: 'Retour au site Tekonest',
  },
  picker: {
    title: 'Choisir un lieu',
    /** L1: the neutral blank room card. */
    blank: 'Salle vide neutre',
  },
  place: {
    dialogTitle: 'Changer de lieu',
    dialogBody: 'Du matériel est déjà installé. Gardez-le pour le placer dans le nouveau lieu, ou repartez d’une scène vide.',
    keep: 'Garder le matériel',
    empty: 'Repartir à vide',
    cancel: 'Annuler',
  },
}
