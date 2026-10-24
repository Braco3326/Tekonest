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
    /** Status bar: a place was asked for while another one is still loading. */
    statusBusy: 'Un lieu est déjà en cours d’ouverture. Patientez un instant.',
    /** Status bar after « Avec le matériel du modèle » / a template; {n} = devices installed. */
    statusGearLoaded: '{n} appareils installés.',
    /** Status bar after « Remplacer le matériel »; {n} = devices now installed, {undo} = the undo key label. */
    statusReplaced: 'Matériel remplacé : {n} appareils installés. {undo} pour revenir en arrière.',
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
    newProject: 'Nouveau',
    open: 'Ouvrir…',
    save: 'Enregistrer',
    saveAs: 'Enregistrer sous…',
    choosePlace: 'Choisir un lieu…',
    inventory: 'Ouvrir l’inventaire',
    connectTo: 'Connecter à…',
    play: 'Écouter le morceau',
    panelTree: 'Panneau Projet',
    panelProps: 'Panneau Propriétés',
    shortcuts: 'Raccourcis clavier',
    siteBack: 'Retour au site Tekonest',
  },
  tree: {
    /** Root row; {place} = the place name, or `tree.noPlace`. */
    place: 'Lieu : {place}',
    noPlace: 'aucun lieu choisi',
    zones: 'Zones',
    gear: 'Matériel',
    cables: 'Câbles',
    points: 'Points d’écoute',
    /** Eye button names; {item} = the row's label. */
    hide: 'Masquer {item}',
    show: 'Afficher {item}',
    /** Under an empty « Matériel » group (also its description). */
    noGear: 'Aucun appareil installé',
    /** A zone whose kind has no `zoneKind` name. */
    zone: 'Zone',
    /** Read after a hidden row's name (visually: struck through). */
    hiddenState: 'masqué',
    /** The tree's keyboard help (aria-describedby). */
    help: 'Flèches pour parcourir, Entrée pour sélectionner et cadrer, flèche droite sur un élément pour atteindre son bouton Masquer.',
    /** Status bar after the eye button. */
    statusHidden: 'Masqué : {item}',
    statusShown: 'Affiché : {item}',
    /** Status bar after Entrée on a zone or a cable row. */
    statusFramed: 'Cadré : {item}',
  },
  /** Room zone kinds (content/rooms/*.json `zones[].kind`) as the tree names them. */
  zoneKind: {
    stage: 'Scène',
    audience: 'Public',
    foh: 'Régie façade',
    'monitor-world': 'Régie retours',
    backstage: 'Coulisses',
    'control-room': 'Régie',
    booth: 'Cabine',
    desk: 'Poste de régie',
    'machine-room': 'Local technique',
    'vocal-booth': 'Cabine voix',
    'iso-booth': 'Cabine isolée',
    'live-room': 'Salle de prise',
    pit: 'Fosse',
    gallery: 'Galerie',
    other: 'Autre zone',
  },
  /** The « Propriétés » panel (Task 10). */
  props: {
    none: 'Aucune sélection',
    noneHint: 'Choisissez un appareil dans le panneau Projet, ou parcourez-les avec [ et ] dans la vue 3D.',
    sectionPosition: 'Position',
    sectionOrientation: 'Orientation',
    sectionMount: 'Montage',
    sectionControls: 'Réglages',
    sectionConnections: 'Connexions',
    name: 'Nom',
    x: 'X',
    y: 'Hauteur',
    z: 'Z',
    yaw: 'Lacet',
    tilt: 'Inclinaison',
    mount: 'Montage',
    mountFloor: 'Sol',
    mountStand: 'Pied',
    mountFlown: 'Accroché',
    positionHint: 'En mètres, depuis le centre du lieu. La hauteur se règle quand l’appareil est sur pied ou accroché.',
    orientationHint: 'Lacet : rotation autour de la verticale. Inclinaison positive : l’avant vise vers le haut.',
    /** Stepper button names; {field} = the field label. */
    decrease: 'Diminuer {field}',
    increase: 'Augmenter {field}',
    /** History entry of a field edit or a stepper burst. */
    adjust: 'Régler {field}',
    invalidNumber: 'Valeur non valide : entrez un nombre, par exemple 2,5.',
    /** Read as a numeric field's description (the visible unit is a symbol). */
    unitMetres: 'en mètres',
    unitDegrees: 'en degrés',
    /** Port direction, Connexions list. */
    dirIn: 'entrée',
    dirOut: 'sortie',
    dirBidir: 'entrée et sortie',
    toggleOn: 'Activé',
    toggleOff: 'Désactivé',
    noControls: 'Aucun réglage sur cet appareil.',
    noPorts: 'Aucune prise sur cet appareil.',
    portFree: 'libre',
    unplug: 'Débrancher',
    /** The « Débrancher » button's full name; {port} = this port, {other} = the other end. */
    unplugName: 'Débrancher {port} de {other}',
    statusUnplugged: 'Débranché : {port} de {other}',
  },
  /** Signal types (catalog `signalTypes[].id`) as Propriétés names them. */
  signal: {
    'mic-level': 'Niveau micro',
    'line-level-pro': 'Niveau ligne pro (+4 dBu)',
    'line-level-consumer': 'Niveau ligne grand public (−10 dBV)',
    'instrument-hiz': 'Instrument (Hi-Z)',
    'speaker-level': 'Niveau haut-parleur',
    'headphone-level': 'Niveau casque',
    aes3: 'AES3 numérique',
    spdif: 'S/PDIF numérique',
    madi: 'MADI multicanal',
    aoip: 'Audio sur IP (Dante)',
    wordclock: 'Word clock',
    'usb-audio': 'Liaison audio ordinateur (USB)',
    'gpio-tally': 'GPIO / tally',
    dmx512: 'DMX512',
    'phantom-48v': 'Alimentation fantôme +48 V',
    'mains-power': 'Secteur 230 V',
  },
  picker: {
    title: 'Choisir un lieu',
    /** L1: the neutral blank room card. */
    blank: 'Salle vide neutre',
    /** Under the title; also the grids' description. */
    hint: 'Flèches pour parcourir, Entrée pour ouvrir.',
    /** Plan legend under the hint (the thumbnails: seen from the audience, stage at the top). */
    legendIntro: 'Plans vus depuis le public, scène en haut :',
    legendStage: 'scène',
    legendOperator: 'régie',
    legendAudience: 'public',
    filter: 'Type de lieu',
    filterAll: 'Tous les types',
    /** Row headings; {n} = number of cards shown. */
    templates: 'Modèles',
    places: 'Lieux ({n})',
    /** L2 badge on a card. */
    withGearBadge: 'Avec le matériel',
    /** Template card badge; {n} = devices. */
    devices: '{n} appareils',
    close: 'Fermer',
    /** Card names of the three .glb venue sets. */
    'set-plateau': 'Plateau live (décor 3D)',
    'set-radio': 'Studio radio (décor 3D)',
    'set-theatre': 'Théâtre (décor 3D)',
    /** « Salle vide » / « Avec le matériel du modèle » (radio group + Ouvrir). {place} = card name. */
    confirmTitle: 'Ouvrir {place}',
    confirmEmpty: 'Salle vide',
    confirmGear: 'Avec le matériel du modèle',
    /** Under « Avec le matériel du modèle »; {n} = catalog devices installed. */
    confirmGearHint: '{n} appareils du jeu sont installés à leur place.',
    confirmOpen: 'Ouvrir',
    confirmCancel: 'Annuler',
    /** A chosen card could not be opened (the picker stays open); {place} = card name. */
    openFailed: '{place} n’a pas pu être ouvert. Rien n’a changé.',
  },
  /** Card type labels: room families (content/rooms `family`), sets, blank room, templates. */
  placeType: {
    live: 'Concert / live',
    education: 'Enseignement',
    worship: 'Lieu de culte',
    conference: 'Conférence',
    broadcast: 'Radio / TV',
    outdoor: 'Plein air',
    post: 'Post-production',
    studio: 'Studio',
    installed: 'Installation fixe',
    classical: 'Musique classique',
    theatre: 'Théâtre',
    set: 'Décor 3D',
    blank: 'Salle neutre',
    template: 'Modèle',
    other: 'Autre lieu',
  },
  /** Dismissible notes in the 3D view (Task 12). */
  note: {
    close: 'Fermer la note',
    /** « Avec le matériel du modèle »: KB gear the catalog does not have (L2). */
    unavailableTitle: 'Matériel non disponible dans le jeu',
    /** {n} = items listed below. */
    unavailableBody: '{n} appareils du modèle ne sont pas encore dans le jeu :',
    /** The room could not be built: the blank room is shown instead. */
    fallbackTitle: 'Lieu indisponible',
    /** {place} = the place name. */
    fallbackBody: '{place} n’a pas pu être chargé. La salle vide neutre est affichée à la place.',
  },
  place: {
    dialogTitle: 'Changer de lieu',
    dialogBody: 'Du matériel est déjà installé. Gardez-le pour le placer dans le nouveau lieu, ou repartez d’une scène vide.',
    keep: 'Garder le matériel',
    empty: 'Repartir à vide',
    cancel: 'Annuler',
    /** A model (template / « Avec le matériel du modèle ») over installed gear. {undo} = the undo key label. */
    replaceTitle: 'Remplacer le matériel ?',
    replaceBody: 'Ce modèle installe son propre matériel : celui déjà en place sera retiré. {undo} permet de revenir en arrière.',
    replace: 'Remplacer le matériel',
  },
  /** Autosave, dirty marker, Ctrl+S and named projects (Task 13, C16). */
  project: {
    /** The browser tab's title; {name} = the project name or `untitledDoc`. Prefixed with « * » while dirty. */
    docTitle: '{name} · Mode Création · TekPractice',
    untitledDoc: 'Sans titre',
    /** Read after the visible « * » in the top bar's project title (visually hidden). */
    dirty: 'modifications non enregistrées',
    /** Status bar after Ctrl+S; {name} = the project name. */
    saved: 'Projet « {name} » enregistré',
    /** Ctrl+S before any place is chosen. */
    saveNoPlace: 'Choisissez un lieu avant d’enregistrer.',
    saveFull: 'Plus de place pour enregistrer : 20 projets au maximum, ou stockage du navigateur plein. Rien n’a été enregistré.',
    blocked: 'Le navigateur bloque la sauvegarde : ton travail ne sera pas gardé.',
    blockedTitle: 'Sauvegarde impossible',
    reset: 'Sauvegarde incompatible, on repart de zéro.',
    resetBody: 'L’ancienne sauvegarde n’est pas effacée : elle est gardée à part dans ce navigateur.',
    autosaveFull: 'Stockage du navigateur plein : la sauvegarde automatique est en pause. Enregistrez sous un autre nom ou libérez de la place.',
    /** Status bar after the autosave was reopened at start. */
    restored: 'Travail de la dernière séance rouvert.',
    /** Name dialog (Ctrl+S the first time, « Enregistrer sous… »). Entrée enregistre. */
    nameTitle: 'Enregistrer le projet',
    nameTitleAs: 'Enregistrer sous',
    nameLabel: 'Nom du projet',
    nameSubmit: 'Enregistrer',
    nameCancel: 'Annuler',
    nameEmpty: 'Donnez un nom au projet.',
    /** A project with this name exists; {name} = that name. */
    overwriteTitle: 'Remplacer « {name} » ?',
    overwriteBody: 'Un projet porte déjà ce nom. Il sera remplacé par le projet affiché.',
    overwrite: 'Remplacer',
    /** « Nouveau » with unsaved changes; {undo} = the undo key label. */
    newTitle: 'Nouveau projet ?',
    newBody: 'Les modifications non enregistrées seront abandonnées. {undo} permet de revenir en arrière.',
    newConfirm: 'Nouveau projet',
    /** History entry label of « Nouveau ». */
    newEntry: 'Nouveau projet',
    /** « Ouvrir… » list. */
    openTitle: 'Ouvrir un projet',
    openHint: 'Flèches ou Tab pour parcourir, Entrée pour ouvrir.',
    openEmpty: 'Aucun projet enregistré pour l’instant.',
    /** One row's accessible name; {name}, {date} = when it was saved. */
    openItem: '{name}, enregistré le {date}',
    /** History entry label of an opened project; {name}. */
    openEntry: 'Ouvrir « {name} »',
    /** Status bar; {name}, {undo}. */
    opened: 'Projet « {name} » ouvert. {undo} pour revenir en arrière.',
    openFailed: '« {name} » n’a pas pu être ouvert. Rien n’a changé.',
  },
}
