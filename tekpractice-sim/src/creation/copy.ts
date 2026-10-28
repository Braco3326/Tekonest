/**
 * Every Mode Création shell string except the R1–R8 rule texts, which are catalog data (`title_fr` / `teach_fr`); wording owned by tekuxwriter. Grows task by task.
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
    canvas: 'Vue 3D : flèches = orbiter, [ ] = appareil suivant/précédent, Entrée = cadrer, 1 2 3 = points d’écoute',
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
    statusNothingToSelect: 'Aucun appareil à sélectionner : ce lieu est vide.',
    /** Status bar: a place was asked for while another one is still loading. */
    statusBusy: 'Un lieu est déjà en cours d’ouverture. Patientez un instant.',
    /** Status bar after « Avec le matériel du modèle » / a template; {n} = devices installed. */
    statusGearLoaded: 'Appareils installés : {n}.',
    /** Status bar after « Remplacer le matériel »; {n} = devices now installed, {undo} = the undo key label. */
    statusReplaced: 'Matériel remplacé. Appareils installés : {n}. {undo} pour revenir en arrière.',
  },
  keys: {
    /** Key names shown next to menu items (French keyboard labels). */
    delete: 'Suppr',
    space: 'Espace',
    escape: 'Échap',
    enter: 'Entrée',
    shift: 'Maj',
    /** Prefix of a numeric keypad key (« Pavé num. 6 »). À valider (tekuxwriter). */
    numpad: 'Pavé num.',
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
    exportKept: 'Exporter les données mises de côté…',
    choosePlace: 'Choisir un lieu…',
    inventory: 'Inventaire',
    rotate: 'Pivoter',
    duplicate: 'Dupliquer',
    delete: 'Supprimer',
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
    name: 'Identifiant',
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
    /** Task 28: the « Connecter à… » button of a free port (opens the dialog). */
    connect: 'Connecter à…',
    /** Its full name; {port} = this port. */
    connectName: 'Connecter à… (depuis {port})',
    /** A Connexions row's accessible name: the keyboard / screen-reader equivalent of the port's hover label. {state} = « branché à … » or « libre ». */
    portName: '{port} · {connector} · {signal} · {state}',
    /** {other} = « Appareil (id) · prise » of the other end. */
    portStateConnected: 'branché à {other}',
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
    'usb-audio': 'Audio USB',
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
    confirmGearHint: 'Les appareils disponibles dans le jeu ({n}) seront installés à leur place.',
    confirmOpen: 'Ouvrir',
    confirmCancel: 'Annuler',
    /** A chosen card could not be opened (the picker stays open); {place} = card name. */
    openFailed: 'Impossible d’ouvrir {place}. Rien n’a changé : réessayez ou choisissez un autre lieu.',
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
    unavailableBody: 'Ces appareils du modèle ne sont pas encore dans le jeu ({n}) :',
    /** The room could not be built: the blank room is shown instead. */
    fallbackTitle: 'Lieu indisponible',
    /** {place} = the place name. */
    fallbackBody: 'Impossible de charger {place} : la salle vide neutre est affichée à la place. Lieu > Choisir un lieu… pour en ouvrir un autre.',
  },
  place: {
    dialogTitle: 'Changer de lieu',
    dialogBody: 'Du matériel est déjà installé. Gardez-le pour le placer dans le nouveau lieu, ou repartez à vide.',
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
    blocked: 'Le navigateur bloque la sauvegarde : votre travail ne sera pas gardé.',
    blockedTitle: 'Sauvegarde impossible',
    reset: 'Sauvegarde incompatible, on repart de zéro.',
    resetBody: 'L’ancienne sauvegarde n’est pas effacée : elle est gardée à part dans ce navigateur. Projet > Exporter les données mises de côté… la télécharge.',
    /** Unreadable data could not be set aside (5 items at most, or quota): autosave waits for the export. */
    keptFullTitle: 'Données mises de côté : plus de place',
    keptFull: 'Des données illisibles n’ont pas pu être mises de côté. Exportez-les avec Projet > Exporter les données mises de côté… : la sauvegarde automatique reprendra ensuite.',
    /** A named save that had to set another tab's copy of this project aside first, without room for it (a new name needs no setting aside). */
    quarantineFull: 'Rien n’a été enregistré : la version enregistrée depuis un autre onglet doit d’abord être mise de côté, et la place est pleine. Pour garder votre travail, utilisez Projet > Enregistrer sous… avec un autre nom.',
    /** Same, but the unreadable project list is what could not be set aside: any name fails until it is exported and confirmed. */
    quarantineFullList: 'Rien n’a été enregistré : la liste des projets, illisible, ne peut pas être mise de côté (place pleine). Exportez-la avec Projet > Exporter les données mises de côté…, confirmez avec « J’ai vérifié le fichier », puis enregistrez à nouveau.',
    /** After the export: the note waits for this confirmation before the autosave resumes. */
    keptFullExported: 'Fichier téléchargé. Ouvrez-le pour vérifier qu’il contient vos données, puis confirmez : la sauvegarde automatique reprendra et remplacera l’ancienne sauvegarde illisible.',
    checkedFile: 'J’ai vérifié le fichier',
    /** The other-tab note's button. */
    resumeHere: 'Reprendre ici',
    /** Saved; the unreadable project list was kept aside. {name}. */
    listReset: 'Projet « {name} » enregistré. L’ancienne liste de projets, illisible, est gardée à part.',
    /** Saved; the copy another tab had saved under this name was kept aside. {name}. */
    conflictKept: 'Projet « {name} » enregistré. La version enregistrée depuis un autre onglet est gardée à part.',
    /** Another tab wrote: this tab's autosave pauses. {save} = the save key label. */
    otherTabTitle: 'Projet ouvert dans un autre onglet',
    otherTab: 'Ce projet est ouvert dans un autre onglet : la sauvegarde automatique est en pause ici. « Reprendre ici » ou {save} dans cet onglet la reprend.',
    /** « Exporter les données mises de côté… ». {file} = the downloaded file name. */
    exported: 'Données mises de côté exportées : {file}',
    exportNothing: 'Aucune donnée mise de côté.',
    /** « Ouvrir… » when the stored list cannot be read. */
    openUnreadable: 'La liste des projets enregistrés est illisible. Elle n’est pas effacée : Projet > Exporter les données mises de côté… la télécharge.',
    /** « Ouvrir… » with unsaved changes; body = `newBody`. */
    openDirtyTitle: 'Ouvrir un autre projet ?',
    openDirtyConfirm: 'Choisir un projet',
    autosaveFull: 'Stockage du navigateur plein : sauvegarde automatique en pause. Votre travail reste affiché tant que la page est ouverte ; rien de déjà enregistré n’est effacé.',
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
    openFailed: 'Impossible d’ouvrir le projet « {name} ». Rien n’a changé.',
  },
  /** Status bar (Task 14, C17): selection, snapping, autosave state, signal button and its error list. */
  status: {
    /** {device} = « Yamaha QL1 (ql1) ». */
    selection: 'Sélection : {device}',
    selectionNone: 'Aucune sélection',
    snapping: 'Aimantation : 0,25 m · 15°',
    snappingFree: 'Aimantation : libre',
    /** Only when the signal path can truly play (`playbackReady`, L5). */
    signalOk: 'Signal OK',
    /** 0 errors, but the chain is not known to play (L5): neutral, never « OK ». */
    signalNoError: 'Aucune erreur détectée',
    /** The rig has no cable yet (L5). */
    signalNothing: 'Rien de branché',
    errorsOne: '1 erreur',
    /** {n} ≥ 2. */
    errorsMany: '{n} erreurs',
    warningsOne: '1 avertissement',
    warningsMany: '{n} avertissements',
    /** Next to the signal label while the last refused connection is listed. */
    refusedMark: 'connexion refusée',
    /** Announced before the new label when a change adds or clears an error (« Signal : 1 erreur »). */
    signalAnnounce: 'Signal :',
    /** The signal button's tooltip. */
    signalHint: 'Afficher les erreurs et avertissements',
    /** The pop-over (role="dialog"). */
    listTitle: 'Erreurs et avertissements',
    listEmpty: 'Aucune erreur ni avertissement pour l’instant.',
    listClose: 'Fermer la liste',
    listHint: 'Choisissez une ligne pour sélectionner l’appareil concerné.',
    /** Row tags (with a glyph: never colour alone). */
    tagRefused: 'Connexion refusée',
    tagError: 'Erreur',
    tagWarning: 'Avertissement',
    /** {ports} = « K12.2 (k12-g) · power-in → Yamaha QL1 (ql1) · in-mic-2 ». */
    ports: 'Prises : {ports}',
    /** Announced when a connection is refused; {title} = the reason. */
    statusRefused: 'Connexion refusée : {title}',
    /** A refused connection that is not one of the rules. */
    occupiedTitle: 'Prise déjà utilisée',
    occupiedDetail: 'Cette prise a déjà un câble. Débranchez-le d’abord.',
    selfTitle: 'Même prise aux deux bouts',
    selfDetail: 'Une prise ne peut pas être reliée à elle-même.',
    otherTitle: 'Connexion impossible',
    otherDetail: 'Ces deux prises ne peuvent pas être reliées.',
    /** Rule without any text (never expected). {id} = the rule id. */
    unknownRule: 'Règle {id}',
    /** Autosave state: visible prefix, then one of the three states. */
    autosave: 'Sauvegarde auto :',
    autosaveSaved: 'Enregistré',
    autosaveModified: 'Modifié',
    autosavePaused: 'En pause',
    /** Persistent lines while the autosave is off, each with its action button. */
    pausedKept: 'Sauvegarde automatique en pause : exportez les données mises de côté pour la reprendre.',
    pausedKeptExported: 'Sauvegarde automatique en pause : vérifiez le fichier exporté, puis confirmez.',
    pausedOtherTab: 'Sauvegarde automatique en pause : ce projet est ouvert dans un autre onglet.',
    pausedFull: 'Sauvegarde automatique en pause : stockage du navigateur plein.',
    pausedBlocked: 'Sauvegarde automatique impossible : le navigateur la bloque.',
    actionExport: 'Exporter…',
  },
  /** The shell could not start (Phase 1 review): a persistent alert with the way out. */
  boot: {
    /** No WebGL on this computer / browser: the 3D view cannot start. */
    noWebglTitle: 'Vue 3D indisponible',
    noWebglBody: 'La vue 3D ne peut pas démarrer sur cet ordinateur : ce navigateur n’a pas accès à WebGL. Vous pouvez vous entraîner avec la version 2D.',
    /** Link to the legacy 2D board (`?level=a1&render=2d`). */
    open2d: 'Ouvrir la version 2D',
    /** A part of the app (code chunk, models list) could not be downloaded. */
    loadTitle: 'Le Mode Création n’a pas pu se charger',
    loadBody: 'Une partie de l’application n’a pas pu être téléchargée. Vérifiez votre connexion, puis rechargez la page.',
    reload: 'Recharger la page',
  },
  /** The view cube (Task 17, C11): face labels painted on the cube. */
  cube: {
    face: 'FACE',
    arriere: 'ARRIÈRE',
    gauche: 'GAUCHE',
    droite: 'DROITE',
    dessus: 'DESSUS',
    dessous: 'DESSOUS',
  },
  /**
   * Named views (Task 18, C11, CA-05): the Vue menu and the `V` picker. The 26 view names
   * themselves come from `zoneLabel` (src/camera/cubeZones.ts). Every string here: à valider (tekuxwriter).
   */
  views: {
    /** Vue › submenu holding the 26 views. */
    menu: 'Vues',
    /** Submenu group headings. */
    faces: 'Faces',
    edges: 'Arêtes',
    corners: 'Coins',
    /** Vue menu items (shortcut shown from the key map). */
    frame: 'Cadrer la sélection',
    home: 'Vue d’ensemble',
    pick: 'Choisir une vue…',
    /** Vue menu items: a quarter turn of the view (Task 21 review, brief §3). À valider (tekuxwriter). */
    rotateLeftMenu: 'Tourner la vue à gauche',
    rotateRightMenu: 'Tourner la vue à droite',
    /** The ↺ ↻ buttons beside the cube (accessible names; ⌂ uses `home`). À valider (tekuxwriter). */
    rotateLeft: 'Tourner de 90° à gauche',
    rotateRight: 'Tourner de 90° à droite',
    /** The `V` picker dialog. */
    pickerTitle: 'Choisir une vue',
    pickerHelp: 'Flèches : changer de vue. Entrée : y aller. Échap : annuler.',
    cancel: 'Annuler',
    /** First sentence of the picker's description; {view} = the view the camera is closest to (focus starts there). */
    current: 'Vue actuelle : {view}.',
    /** Status bar after a view is chosen; {view} = the view name. */
    status: 'Vue : {view}',
  },
  /**
   * Walking (Task 19, C11, S6): Vue › Marcher (Maj+V) and the ear height in Écoute.
   * Every string here: à valider (tekuxwriter).
   */
  walk: {
    /** Vue menu item (checkbox; shortcut shown from the key map). */
    menu: 'Marcher',
    /** Écoute menu items (radio pair). */
    earSeated: 'Hauteur d’oreille : assis 1,2 m',
    earStanding: 'Hauteur d’oreille : debout 1,7 m',
    /** Status bar when the walk starts (announced); {walk} = the walk key label (« Maj+V »). */
    statusOn: 'Marche : flèches ou ZQSD (WASD en QWERTY) pour avancer et tourner, {walk} ou Échap pour revenir à l’orbite.',
    /** Status bar when the walk ends (announced). */
    statusOff: 'Retour à l’orbite',
    /** Canvas `aria-label` while walking (replaces `shell.canvas`); {walk} = the walk key label. */
    canvas: 'Vue 3D en marche : flèches = avancer et tourner, glisser = regarder, {walk} ou Échap = revenir à l’orbite',
  },
  /**
   * Named listening points (Task 20): the « Points d’écoute » tree rows, Vue › Aller au point
   * d’écoute, keys 1 / 2 / 3. Every string here: à valider (tekuxwriter).
   */
  points: {
    /** Point names (tree rows, menu items). */
    regie: 'Régie',
    premierRang: 'Premier rang',
    fondDeSalle: 'Fond de salle',
    /** A blank place or a venue set: one point in the middle. */
    centre: 'Centre',
    /** Vue › submenu listing the points. */
    menu: 'Aller au point d’écoute',
    /** Status bar after going to a point (announced); {point} = its name. */
    status: 'Point d’écoute : {point}',
    /** Status bar: a key 1 / 2 / 3 with no point behind it in this place; {n} = the key. */
    none: 'Pas de point d’écoute {n} dans ce lieu.',
  },
  /** The inventory drawer (Task 23, CA-09). `TAB_LABELS` (src/creation/inventory.ts) is built from the `tab*` strings. */
  inventory: {
    /** Drawer title (h2) and the dialog's accessible name; same word as Matériel › Inventaire. */
    title: 'Inventaire',
    /** Accessible name of the tab list. */
    tabs: 'Catégories d’appareils',
    /** Line under the title; {key} = the inventory key label (Space by default). */
    hint: 'Entrée ou clic : choisir l’appareil, puis cliquer dans la vue pour le poser. {key} ou Échap : fermer.',
    /** Visible text of the close button. */
    close: 'Fermer',
    /** Accessible name of the close button (contains the visible text). */
    closeLabel: 'Fermer l’inventaire',
    /** Empty state when the drawer has no device. */
    empty: 'Aucun appareil disponible pour le moment.',
    /** Badge on a proposed device: in the Bêta tab, in the Projet tree and in Properties once it is placed (Task 30). */
    badgeUnverified: 'non vérifié',
    /** Tooltip of a Bêta item, and the description of a placed one (Properties). */
    tipUnverified: 'Fiche proposée, pas encore vérifiée : comportement approximatif.',
    /** Note title when a reopened project has devices whose sheet is gone (a proposal no longer offered, an unknown device). */
    missingTitle: 'Appareils non rechargés',
    /** Note body; the device ids follow as a list. */
    missingBody: 'La fiche de ces appareils n’existe plus (proposition Bêta retirée ou appareil inconnu) : ils n’ont pas été rechargés.',
    /** Status bar while the Bêta sheets a saved project needs are fetched (reopening only). */
    loadingBeta: 'Chargement des fiches Bêta…',
    /** Status bar while the drawer module loads (first open). */
    loading: 'Ouverture de l’inventaire…',
    /** Status bar if the drawer module fails to load. */
    loadFailed: 'L’inventaire n’a pas pu s’ouvrir. Réessayez avec Espace ou le menu Matériel.',
    /** History entry label; {device} = device name. */
    entry: 'Ajouter {device}',
    /** Tab « Micros » (inventory category). */
    tabMicros: 'Micros',
    /** Tab « Consoles » (inventory category). */
    tabConsoles: 'Consoles',
    /** Tab « Enceintes » (inventory category). */
    tabEnceintes: 'Enceintes',
    /** Tab « Sources » (inventory category). */
    tabSources: 'Sources',
    /** Tab « Réseau » (inventory category). */
    tabReseau: 'Réseau',
    /** Tab « Secteur » (inventory category). */
    tabSecteur: 'Secteur',
    /** Tab « Éclairage » (inventory category). */
    tabEclairage: 'Éclairage',
    /** Tab « Bêta » (inventory category). */
    tabBeta: 'Bêta',
    /** Tab « Autres » (inventory category). */
    tabAutres: 'Autres',
  },
  /** Placing and moving devices in the 3D view (Task 24, CA-10). {device} = device name, {undo} = undo key label. */
  placement: {
    /** History entry label of a drag. */
    entryMove: 'Déplacer {device}',
    /** Status bar once a device is chosen and follows the pointer (announced). */
    statusPlacing: 'Cliquez pour poser {device} (Entrée : ici). R : pivoter. Alt : libre. Échap : annuler.',
    /** Status bar after the drop (announced). */
    statusPlaced: 'Posé : {device}. {undo} pour annuler.',
    /** Status bar after a drag (announced). */
    statusMoved: 'Déplacé : {device}. {undo} pour annuler.',
    /** Status bar after Échap while placing (announced). */
    statusCancelled: 'Pose annulée.',
    /** Status bar after Échap during a drag (announced). */
    statusMoveCancelled: 'Déplacement annulé : {device} est resté en place.',
    /** Status bar if the device cannot be placed (announced). */
    statusRefused: 'Impossible de poser {device}.',
  },  /** Rotate, duplicate and delete the selected device (Task 25, CA-11). {device} = device name, {undo} = undo key label, {deg} = yaw in degrees. */
  edit: {
    /** History entry label of one rotation step. */
    entryRotate: 'Pivoter {device}',
    /** History entry label of a duplication. */
    entryDuplicate: 'Dupliquer {device}',
    /** History entry label of a deletion (the device and its cables). */
    entryDelete: 'Supprimer {device}',
    /** Status bar after a rotation step (announced). */
    statusRotated: 'Pivoté : {device}, {deg}°. {undo} pour annuler.',
    /** Status bar after R while a device follows the pointer (announced). */
    statusGhostYaw: 'Orientation : {deg}°.',
    /** Status bar after a duplication (announced); the copy is the selected device. */
    statusDuplicated: 'Dupliqué : {device}. La copie est sélectionnée. {undo} pour annuler.',
    /** Status bar after a deletion (announced). */
    statusDeleted: 'Supprimé : {device}, avec ses câbles. {undo} pour annuler.',
    /** Status bar when the device has no position to turn or copy (announced). */
    statusNoPose: '{device} n’a pas de position : impossible de le pivoter ou de le dupliquer.',
    /** Status bar when Suppr / Ctrl+D is pressed while a device follows the pointer (announced); the selected device is left alone. */
    statusWhilePlacing: 'Terminez ou annulez la pose d’abord (Échap).',
    /** Status bar when the edit was refused by the rig (announced). */
    statusRefused: 'Modification impossible pour {device}.',
  },
  /** Feedback on a click that hit nothing (Task 25, CA-12). {key} = the inventory key label. */
  feedback: {
    /** Toast (`role="status"`, 2.5 s) after a click on the empty floor, the sky or a hidden device; the selection is cleared. */
    missed: 'Rien ici : clique un appareil ou ouvre l’inventaire ({key}).',
  },
  /** Click-to-patch on the scene's ports (Task 26, CA-19, CA-20). {a} / {b} / {port} / {other} = « Appareil · prise ». */
  patch: {
    /** Étiquette au survol d’une prise (jamais permanente) ; {port} = nom de la prise, {connector} = connecteur, {signal} = type de signal. */
    hoverLabel: '{port} · {connector} · {signal}',
    /** Libellé de l’entrée d’historique d’un branchement. */
    entryConnect: 'Brancher {a} à {b}',
    /** Libellé de l’entrée d’historique d’un débranchement. */
    entryUnplug: 'Débrancher {a} de {b}',
    /** Barre d’état après le clic sur la première prise (annoncé). */
    statusPending: '{port} choisie. Cliquez une prise verte pour brancher le câble, Échap pour annuler.',
    /** Barre d’état après Échap ou un second clic sur la même prise (annoncé). */
    statusCancelled: 'Câblage annulé.',
    /** Barre d’état après un branchement réussi (annoncé) ; {undo} = touche d’annulation. */
    statusConnected: 'Branché : {a} à {b}. {undo} pour annuler.',
    /** Barre d’état après « Débrancher » sur une prise (annoncé). */
    statusUnplugged: 'Débranché : {a} de {b}. {undo} pour annuler.',
    /** Message épinglé sur la deuxième prise quand le branchement est refusé (`role="alert"`) ; {title} = titre de la règle. */
    errorLabel: 'Branchement refusé : {title}',
    /** Bulle sur une prise déjà branchée ; propose « Débrancher ». */
    offerText: '{port} est branchée à {other}.',
    /** Nom accessible de la bulle « Débrancher ». */
    offerGroup: 'Prise déjà branchée',
    /** Texte visible du bouton de la bulle. */
    offerUnplug: 'Débrancher',
    /** Nom complet du bouton de la bulle. */
    offerName: 'Débrancher {port} de {other}',
  },
  /** « Connecter à… » (Task 28, CA-02): patching with the keyboard and a screen reader. */
  connect: {
    /** Titre de la boîte de dialogue. */
    title: 'Connecter à…',
    /** Sous le titre, lue comme sa description ; {port} = la prise de départ avec son connecteur et son signal. */
    body: 'Depuis {port}. Tapez pour filtrer, flèches haut et bas pour choisir, Entrée pour brancher, Échap pour fermer.',
    /** Libellé du champ de filtre (saisie qui réduit la liste). */
    filter: 'Filtrer',
    /** Nom de la liste des prises compatibles. */
    listName: 'Prises compatibles',
    /** Annonce (polite) du nombre de prises après une frappe. */
    countOne: '1 prise compatible.',
    /** Idem ; {n} = nombre. */
    countMany: '{n} prises compatibles.',
    /** Rien de compatible du tout (aucun filtre) : dit en clair dans la boîte. */
    none: 'Aucune prise compatible n’est libre.',
    /** Le filtre ne retient rien ; {query} = le texte tapé. */
    noMatch: 'Aucune prise ne correspond à « {query} ».',
    /** Bouton qui déplie le groupe des prises refusées ; {n} = nombre. */
    rejectedToggle: 'Incompatibles ({n})',
    /** Phrase au-dessus du groupe des prises refusées (elles ne se choisissent pas). */
    rejectedHint: 'Ces prises ne peuvent pas recevoir ce câble ; chacune dit pourquoi.',
    /** Bouton qui ferme sans brancher. */
    cancel: 'Annuler',
    /** Barre d’état après un branchement par la boîte (annoncé poliment, une fois) ; {a} / {b} = « Appareil (id) · prise », {undo} = touche d’annulation. */
    statusConnected: 'Connecté : {a} à {b}. {undo} pour annuler.',
    /** Barre d’état quand la boîte se ferme parce que le matériel a changé pendant qu’elle était ouverte. */
    statusClosedStale: 'Connecter à… fermé : le matériel a changé. Rouvrez-le pour voir les prises à jour.',
  },
  /** Câbles colorés par type de signal, légende et survol (Task 27, C18). */
  cables: {
    /** Titre visible du bloc légende (bas du panneau Propriétés), aussi nom accessible de la liste. */
    legendTitle: 'Légende des câbles',
    /** Nom accessible du bouton de la légende quand elle est dépliée (il la replie). */
    legendCollapse: 'Replier la légende des câbles',
    /** Nom accessible du bouton quand elle est repliée (il la déplie). */
    legendExpand: 'Déplier la légende des câbles',
    /** Mention à côté d’un type de signal tracé en pointillés (le trait n’est pas le seul repère : la couleur non plus). */
    dashed: 'pointillés',
    /** Texte au survol d’un câble ; {a} / {b} = « appareil prise » de chaque bout, {signal} = type de signal. */
    hover: '{a} → {b} · {signal}',
  },
  /** Connectors (catalog `connectorTypes[].id`) as the hover label names them: faithful renderings of the catalog labels. */
  connector: {
    'xlr3-m': 'XLR3 mâle',
    'xlr3-f': 'XLR3 femelle',
    'xlr5-m': 'XLR5 mâle (DMX)',
    'xlr5-f': 'XLR5 femelle (DMX)',
    'trs-quarter': 'Jack TRS 6,35 mm (symétrique / stéréo)',
    'ts-quarter': 'Jack TS 6,35 mm (asymétrique)',
    'trs-35mm': 'Mini-jack TRS 3,5 mm',
    rca: 'RCA / cinch',
    'rj45': 'RJ45 (Cat5e/6)',
    ethercon: 'Neutrik etherCON (RJ45 renforcé)',
    'speakon-nl4': 'Neutrik Speakon NL4',
    'powercon-blue': 'Neutrik powerCON (bleu, entrée secteur)',
    'powercon-true1': 'Neutrik powerCON TRUE1',
    'iec-c13': 'IEC C13 (fiche secteur)',
    'iec-c14': 'IEC C14 (embase secteur)',
    'schuko-plug': 'Fiche Schuko (CEE 7/7)',
    'schuko-socket': 'Prise murale Schuko (CEE 7/3)',
    bnc: 'BNC 75 Ω (word clock / MADI coaxial)',
    'tt-bantam': 'TT / Bantam 4,4 mm (baie de brassage)',
    'dsub25': 'D-sub 25 (TASCAM analogique / AES59 numérique)',
    toslink: 'TOSLINK optique',
    'usb-a': 'USB Type-A',
    'usb-b': 'USB Type-B',
    'usb-c': 'USB Type-C / Thunderbolt 3',
    digilink: 'Avid DigiLink',
    'gpio-terminal': 'Bornier GPIO / port logique D-sub',
  },
}
