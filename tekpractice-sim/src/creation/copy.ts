/**
 * Every Mode Création shell string; wording owned by tekuxwriter. The rule texts R1–R8 are catalog data (`title_fr` / `teach_fr`, never edited here); the section `ruleOverride`
 * holds Mode Création's own wording of R1 to R5 (the catalog text stays for the legacy level page). Grows task by task.
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
    play: 'Lecture',
    playLocked: 'Indisponible pendant le choix du lieu.',
    stop: 'Stop',
    song: 'Morceau',
    chooseFile: 'Choisir un fichier audio…',
    testSignal: 'Signal de test',
    coverage: 'Couverture',
    /** Écoute: listen from where the view stands (Task 43b). */
    listenHere: 'Écouter depuis ici',
    panelTree: 'Panneau Projet',
    panelProps: 'Panneau Propriétés',
    shortcuts: 'Raccourcis clavier',
    siteBack: 'Retour au site Tekonest',
    /** Aide › Premiers pas (onboarding T2.4b): present only under `?design` where the tutorial is allowed. À valider (tekuxwriter, 2026-11-12). */
    firstSteps: 'Premiers pas',
    /** Why « Premiers pas » is off while the start screen shows (its description). À valider (tekuxwriter, 2026-11-12). */
    firstStepsWait: 'Répondez d’abord à l’écran de départ.',
  },
  /** « Raccourcis clavier » (night 2 wave 5, P2-1): the dialog of the Aide menu and the H key. Validé (tekuxwriter, night 2). */
  shortcuts: {
    title: 'Raccourcis clavier',
    hint: 'Les raccourcis à une seule touche (lettres, chiffres, Espace, Suppr…) n’agissent que lorsque la vue 3D a le focus. Ils sont repérés par leur position sur le clavier.',
    close: 'Fermer',
    keyArrows: 'Flèches',
    groupView: 'Vue 3D',
    groupDevices: 'Appareils',
    groupProject: 'Projet',
    orbit: 'Orbiter autour de la scène',
    quarterLeft: 'Quart de tour de la vue vers la gauche',
    quarterRight: 'Quart de tour de la vue vers la droite',
    points: 'Aller à un point d’écoute',
    frame: 'Cadrer la sélection',
    home: 'Vue d’ensemble',
    picker: 'Choisir une vue',
    walk: 'Marcher dans la salle',
    next: 'Appareil suivant',
    prev: 'Appareil précédent',
    inventory: 'Ouvrir ou fermer l’inventaire',
    rotateCw: 'Pivoter de 15° (Alt : 1°)',
    rotateCcw: 'Pivoter de 15° dans l’autre sens',
    snap: 'Activer ou désactiver le placement libre (pose ou déplacement)',
    duplicate: 'Dupliquer l’appareil sélectionné',
    delete: 'Supprimer l’appareil sélectionné',
    cancel: 'Annuler la pose, le câble en main ou la sélection',
    undo: 'Annuler la dernière action',
    redo: 'Rétablir',
    save: 'Enregistrer le projet',
    help: 'Afficher cette liste',
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
    hint: 'Choisissez un lieu pour l’ouvrir : clic, ou flèches puis Entrée.',
    /** One line under « Modèles » (night wave 2, E; rewritten T1.6): what a template is, no promise beyond the placed gear. */
    templatesPitch: 'Un lieu avec du matériel déjà posé.',
    /** Note line of a template card (T1.6), key `templateNote-<template id>`: what the model already does, or what is left to do. */
    'templateNote-premier-son-pret': 'Prêt à écouter dès l’ouverture : déjà câblé et alimenté.',
    'templateNote-concert-simple-reference': 'À compléter : sorties de la console vers les enceintes, Lecture console.',
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
    /** Said once, after a saved project is reopened (autosave or « Ouvrir… »), when it holds active gear that needs power and no power strip at all. */
    noMains: 'Aucune multiprise dans ce projet : les appareils actifs ne sont pas alimentés. Ajoutez-en une (onglet « Secteur » de l’inventaire) et branchez-y les appareils.',
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
    /** Next to the signal label when the rig holds one Bêta (proposed) device: the rules ran on declared, unverified ports. */
    unverifiedOne: '1 appareil non vérifié',
    /** {n} ≥ 2. */
    unverifiedMany: '{n} appareils non vérifiés',
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
  /**
   * The signal path's words (Task 34, C9): the status bar's « Lecture » line and « Micro OK ». src/flow/signalPath.ts reads the
   * reasons from here (plain data, no shell code). Every string here: validé (tekuxwriter, 2026-11-04).
   */
  playback: {
    /** Status bar when the signal path reaches a powered speaker (`playbackReady`). */
    ready: 'Lecture possible',
    /** Status bar, apart from the playback line, when a mic reaches a powered console input with no error. */
    micOk: 'Micro OK',
    /** NO_SOURCE: no device in the project has a playback source (the QL1 is missing). */
    noSource: 'Aucune source de lecture dans le projet.',
    /** SOURCE_OFF: the source exists but its playback control is off. */
    sourceOff: 'La lecture console est coupée.',
    /** HOST_UNPOWERED: the console is not cabled to mains or switched off (also the mic's reason). */
    hostUnpowered: 'La console n’est pas alimentée.',
    /** NO_PATH: nothing is cabled from the console to a speaker input. */
    noPath: 'Aucun chemin de la console jusqu’à une enceinte.',
    /** SPEAKER_UNPOWERED: the signal reaches a speaker that has no power. */
    speakerUnpowered: 'Une enceinte reçoit le signal mais n’est pas alimentée.',
    /** RULE_ERROR: a rule error sits on a port of the path (also the mic's reason). */
    ruleError: 'Une erreur de câblage bloque le chemin.',
    /** NO_MIC: no verified mic is cabled to a mic input. */
    noMic: 'Aucun micro branché sur une entrée micro.',
    /** Announced once when « Micro OK » is lost; {reason} = the first reason. */
    micLost: 'Plus de Micro OK. {reason}',
  },
  /**
   * Coverage (Task 37, C13, S2): Écoute › Couverture, the dots in the 3D view and the legend / statistics block at the bottom of Propriétés.
   * Honesty (brief §5): relative dB only, no intelligibility score, no regulatory level. Every string here: validé (tekuxwriter, 2026-11-04), except `chip` (à trancher, Oscar).
   */
  coverage: {
    panelTitle: 'Couverture',
    panelCollapse: 'Replier la couverture',
    panelExpand: 'Déplier la couverture',
    /** Title of the closed `<details>` under the points: the notes about the calculation (method, aim line, source, speakers, hints). Night wave 2, H. */
    aboutTitle: 'À propos du calcul',
    unit: 'dB relatif (0 = point le plus fort)',
    method: 'somme énergétique, champ direct',
    chip: 'estimation',
    chipName: 'Fidélité du calcul : estimation',
    chipPopover: 'Estimation pédagogique : les niveaux sont comparés entre eux, pas mesurés. 0 dB est le point le plus fort de la grille d’écoute (public et régie) avec ces réglages. Champ direct seulement : ni réflexions de la salle, ni interférences. La balance de la console change l’équilibre affiché comme le son (elle baisse le côté opposé) ; le fader master, commun à toutes les enceintes, ne change pas un niveau relatif ; le mute ou −inf retire les enceintes ; l’origine de l’enceinte est son point de pose.',
    legendTitle: 'Échelle',
    legendBin: '{from} à {to} dB',
    legendLast: '{from} dB et moins',
    legendCount: '{n} points',
    hatched: 'Hachuré : interférences non modélisées',
    hatchedCount: '{n} points concernés',
    aim: 'Trait clair : axe de chaque enceinte audible',
    frontCaveat: 'Face avant du modèle 3D non vérifiée pour {names} : le trait indique l’axe acoustique, pas forcément la face du modèle.',
    sourceLine: 'Couverture : {sources}',
    sourceKb: 'base de connaissances',
    sourceNominal: 'valeur nominale',
    sourceDatasheet: 'fiche constructeur',
    sourceDeduced: 'verticale déduite',
    speakersTitle: 'Enceintes prises en compte',
    speakerRow: '{name} : {h}° × {v}°',
    statsTitle: 'Statistiques',
    statMin: 'Minimum',
    statMax: 'Maximum',
    statMean: 'Moyenne',
    statSd: 'Écart-type',
    statCount: 'Points',
    statStep: 'Pas de la grille',
    dbValue: '{v} dB',
    mValue: '{v} m',
    pointsTitle: 'Niveau en un point',
    pointRow: '{name} : {value}',
    pointSilent: 'aucun son',
    pin: 'Épingler {name}',
    pinned: 'Point épinglé ({x} m ; {z} m) : {value}',
    unpin: 'Retirer l’épingle',
    pinHint: 'Cliquez sur un point coloré dans la vue 3D pour épingler son niveau.',
    probeAbove: 'Un point nommé peut dépasser 0 dB : l’échelle est celle de la grille.',
    splPending: '≈ dB SPL estimé : non calculé (estimation pédagogique, formule non sourcée).',
    computing: 'Calcul de la couverture…',
    failed: 'Calcul de la couverture indisponible (réessayez).',
    hiddenFolded: 'Couverture masquée : le panneau Propriétés est replié. Dépliez-le pour la revoir.',
    noAudience: 'Pas de public dans ce lieu : aucune zone public ni régie à couvrir. Rien à calculer.',
    noSource: 'Aucune enceinte audible : {reason}',
    reasonNotFed: 'aucune enceinte ne reçoit de signal ({why})',
    reasonNotFedBare: 'aucune enceinte ne reçoit de signal',
    reasonMuted: 'la console est en mute',
    reasonSilent: 'le fader master est à −inf',
    reasonBalance: 'la balance de la console coupe ces enceintes',
    reasonUnverified: 'appareil non vérifié (Bêta)',
    reasonNoAcoustic: 'enceinte sans données acoustiques',
    reasonUnpowered: 'enceinte hors tension',
    reasonOther: 'enceinte non utilisable',
    reasonsJoin: ' ; ',
    announceDone: 'Couverture calculée : {n} points, {min} à {max} dB, pas {step} m.',
    announceOff: 'Couverture masquée.',
    loadFailed: 'La couverture n’a pas pu se charger. Rechargez la page.',
  },
  /**
   * Listening (Task 39, C9, C14, CA-03, CA-26): Écoute › Lecture / Stop / Morceau / Choisir un fichier audio… / Signal de test, and the Écoute block at the
   * bottom of Propriétés. Honesty (brief §10): a SIMPLE simulation, said in the block. Every string here: validé (tekuxwriter, 2026-11-04).
   */
  listen: {
    panelTitle: 'Écoute',
    panelCollapse: 'Replier l’écoute',
    panelExpand: 'Déplier l’écoute',
    stopped: 'Lecture arrêtée.',
    starting: 'Démarrage de la lecture…',
    playing: 'Lecture en cours : {source} (simulation simple).',
    sourceTest: 'signal de test',
    sourceFile: 'fichier {name}',
    sourceSong: '{title}',
    silentMix: 'Aucune enceinte ne sonne pour le moment : la console est en mute ou son fader est à −inf.',
    metersTitle: 'Niveau à chaque enceinte',
    meterRow: '{name} : niveau de sortie {level}, gain {gain}, retard {delay}, pan {pan}',
    /** The same row drawn on two lines (night wave 2, G): the name and the level, then the rest muted. Not read: the screen reader gets `meterRow`. */
    meterMain: '{name} : {level}',
    meterSub: 'gain {gain} · retard {delay} · pan {pan}',
    levelDb: '{v} dBFS',
    levelSilent: 'silence',
    gainValue: '{v} dB',
    delayValue: '{v} ms',
    panLeft: 'gauche {n} %',
    panRight: 'droite {n} %',
    panCenter: 'centre',
    noSpeakers: 'Aucune enceinte à écouter.',
    /** « Écoute depuis : {point}. » above the button (night wave 2, G): where the sound is heard from; {point} = a name of `points.*`, or `fromWalk`. */
    from: 'Écoute depuis : {point}.',
    /** The point name while the walk camera listens in place of the points. */
    fromWalk: 'la caméra de marche',
    /** Always shown: what the simulation is, in one sentence. The rest of its limits is folded under `limitsTitle`. */
    simple: 'Simulation simple : niveau relatif, volume normalisé, retard et placement gauche-droite d’après la géométrie. Ni acoustique de salle, ni réponse en fréquence, ni réflexions.',
    /** Title of the closed `<details>` that holds the rest of the limits. */
    limitsTitle: 'Limites de la simulation',
    /** In the details, first: what acts on the sound, and what the volume does (the second half of the former « simple »). */
    limitsMore: 'Le fader, le mute et la balance de la console agissent sur le son. Le volume est normalisé : l’enceinte la plus forte garde le même niveau quelle que soit la distance. Pas de diaphonie (fuite d’un canal dans l’autre).',
    /** In the details, second: the limits of the numbers and of the ears. */
    limits: 'Le niveau affiché pour chaque enceinte est la moyenne de ses deux côtés (une enceinte placée sur le côté lit plus bas que sa sortie réelle). L’origine d’une enceinte est son point de pose. Déplacer l’auditeur fait glisser le retard et peut faire varier la hauteur du son ; ce n’est pas un effet Doppler simulé. Il n’y a pas de vumètre de console, seulement un niveau par enceinte. On écoute depuis la Régie, un autre point d’écoute, « Ici » (le point visé par la vue ; en marche, là où se trouve le marcheur) ou la caméra de marche, qui écoute à sa place pendant la marche.',
    volume: 'Le volume démarre bas et reste limité : réglez celui de votre ordinateur si besoin.',
    fileLocal: 'Un fichier choisi reste dans votre navigateur : il n’est ni envoyé ni enregistré.',
    fileInputName: 'Choisir un fichier audio',
    notReady: 'Lecture impossible. {reason}',
    stoppedNotReady: 'Lecture arrêtée. {reason}',
    stoppedPlace: 'Lecture arrêtée : le lieu a changé.',
    stoppedEnded: 'Lecture terminée.',
    failedFile: 'Ce fichier n’a pas pu être lu. Essayez un fichier MP3, WAV ou OGG.',
    failed: 'La lecture n’a pas pu démarrer.',
    loadFailed: 'La lecture n’a pas pu se charger. Rechargez la page.',
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
   * themselves come from `zoneLabel` (src/camera/cubeZones.ts). Every string here: validé (tekuxwriter, 2026-11-04).
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
   * Every string here: validé (tekuxwriter, 2026-11-04).
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
   * d’écoute, keys 1 / 2 / 3. Every string here: validé (tekuxwriter, 2026-11-04).
   */
  points: {
    /** Point names (tree rows, menu items). */
    regie: 'Régie',
    premierRang: 'Premier rang',
    fondDeSalle: 'Fond de salle',
    /** A blank place or a venue set: one point in the middle. */
    centre: 'Centre',
    /** The point « Écouter depuis ici » puts where the view stands (Task 43b): tree row, Vue › Aller au point d’écoute, coverage probe. */
    here: 'Ici',
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
    hint: 'Entrée ou clic : choisir l’appareil, puis cliquer dans la vue pour le poser, ou glisser l’appareil dans la vue. {key} ou Échap : fermer ; dans « Filtrer », seul Échap ferme.',
    /** Visible text of the close button. */
    close: 'Fermer',
    /** Accessible name of the close button (contains the visible text). */
    closeLabel: 'Fermer l’inventaire',
    /** Empty state when the drawer has no device. */
    empty: 'Aucun appareil disponible pour le moment.',
    /** Étiquette du champ de recherche au-dessus des onglets (aussi son nom pour les aides techniques). */
    filter: 'Filtrer',
    /** Dit poliment (et affiché dans la liste) quand le filtre ne correspond à aucun appareil. */
    filterNone: 'Aucun appareil ne correspond',
    /** Shown in the list (not spoken: the status above says the short form) when the filter matches nothing; {q} = what was typed. Night wave 2, F. */
    filterNoneHelp: 'Aucun appareil ne correspond à « {q} ». Effacez le filtre ou essayez un autre mot (micro, console, enceinte).',
    /** The button under it: clears the filter and puts the focus back in the field. */
    filterClear: 'Effacer le filtre',
    /** Nom accessible de la liste quand un filtre est actif : elle réunit les appareils de tous les onglets. */
    filterResults: 'Appareils qui correspondent',
    /** Badge on a proposed device: in the Bêta tab, in the Projet tree and in Properties once it is placed (Task 30). */
    badgeUnverified: 'non vérifié',
    /** Tooltip of a Bêta item, and the description of a placed one (Properties). */
    tipUnverified: 'Fiche proposée, pas encore vérifiée : comportement approximatif.',
    /** Note title when a reopened project has devices whose sheet is gone (a proposal no longer offered, an unknown device). */
    missingTitle: 'Appareils non rechargés',
    /** Note body; the device ids follow as a list. */
    missingBody: 'La fiche de ces appareils n’existe plus (proposition Bêta retirée ou appareil inconnu) : ils n’ont pas été rechargés.',
    /** Note title when the Bêta sheets a saved project needs could not be fetched (network or timeout): the project is NOT opened and NOT touched. */
    unavailableTitle: 'Projet non rouvert',
    /** Note body, status line and place-picker line for the same case. */
    unavailable: 'Fiches Bêta indisponibles (réseau). Rechargez la page pour retrouver votre projet.',
    /** Note body and status line when « Ouvrir… » could not fetch the Bêta sheets of the project the learner chose: nothing was opened. */
    unavailableOpen: 'Fiches Bêta indisponibles (réseau). Le projet n’a pas été ouvert. Rechargez la page, puis rouvrez-le.',
    /** Status bar while the Bêta sheets a saved project needs are fetched (reopening only). */
    loadingBeta: 'Chargement des fiches Bêta…',
    /** Status bar while the drawer module loads (first open). */
    loading: 'Ouverture de l’inventaire…',
    /** Status bar if the drawer module fails to load. */
    loadFailed: 'L’inventaire n’a pas pu s’ouvrir (réseau). Rechargez la page.',
    /** Inside the « Bêta » tab only, while the sheets are fetched (the drawer is already open and the other tabs usable). */
    betaLoading: 'Chargement…',
    /** Inside the « Bêta » tab when the sheets could not be fetched (offline, no answer within 5 s): the other tabs are not affected. */
    betaUnavailable: 'Fiches Bêta indisponibles (réseau). Rechargez la page pour les retrouver.',
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
    statusPlacing: 'Cliquez pour poser {device} (Entrée : ici). R : pivoter. Alt ou G : libre. Échap : annuler.',
    /** The visible cancel button shown while a device follows the pointer (Task 43b); its accessible name too. */
    cancelButton: 'Annuler la pose',
    /** Status bar once a device is dragged out of the inventory (announced; Task 43b). */
    statusDragging: 'Glissez dans la vue et relâchez pour poser {device}. Échap : annuler.',
    /** Status bar when the G key latches free placement on (announced, once per press; Task 43b). */
    statusSnapFree: 'Placement libre : position et rotation hors pas. G pour revenir à la grille.',
    /** Status bar when the G key turns the latch off (announced, once per press; Task 43b). */
    statusSnapGrid: 'Aimantation à la grille : 0,25 m · 15°. G pour placer librement.',
    /** Status bar when the G latch is lifted while Alt is still held (announced; the placement stays free; Task 43b fix round). */
    statusSnapLatchOff: 'Verrou G levé. Alt maintenu : placement libre.',
    /** Status bar after the drop (announced). */
    statusPlaced: 'Posé : {device}. {undo} pour annuler.',
    /** Status bar after a drag (announced). */
    statusMoved: 'Déplacé : {device}. {undo} pour annuler.',
    /** Status bar after Échap while placing (announced). */
    statusCancelled: 'Pose annulée.',
    /** Status bar after Échap during a drag (announced). */
    statusMoveCancelled: 'Déplacement annulé : {device} est resté en place.',
    /** Status bar once a drag starts on the selected device that stands on a stand: the view orbits instead, and this says how to move it (announced once per drag; night 2 wave 5, P3-3). Validé (tekuxwriter, night 2). */
    dragStand: 'Sur pied : déplacez-le avec Propriétés › Position.',
    /** Same for a flown device (announced once per drag). Validé (tekuxwriter, night 2). */
    dragFlown: 'Accroché : déplacez-le avec Propriétés › Position.',
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
    missed: 'Rien ici : cliquez sur un appareil ou ouvrez l’inventaire ({key}).',
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
    statusPending: '{port} choisie. Cliquez sur une prise verte pour brancher le câble, Échap pour annuler.',
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
    /** Nom accessible (et infobulle) du bouton de la légende dans le rail de Propriétés repliée : il déplie le panneau, légende ouverte. */
    legendRail: 'Légende des câbles : déplier Propriétés',
    /** Mention à côté d’un type de signal tracé en pointillés (le trait n’est pas le seul repère : la couleur non plus). */
    dashed: 'pointillés',
    /** Texte au survol d’un câble ; {a} / {b} = « appareil prise » de chaque bout, {signal} = type de signal. */
    hover: '{a} → {b} · {signal}',
    /** Le même texte avec la longueur du câble tracé ; {length} = « 6,4 m ». */
    hoverLength: '{a} → {b} · {signal} · {length}',
    /** Une longueur de câble en mètres ; {n} = un chiffre après la virgule (« 6,4 »). */
    length: '{n} m',
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
  /**
   * « Pourquoi je n’entends rien ? » (onboarding packs, T1.3): a read-only list over the engine's own playback reasons (`playback.*`, quoted
   * verbatim, never reworded here). Every string here: à valider (tekuxwriter, 2026-11-12).
   */
  checklist: {
    /** Chip in the status bar and title of the list. */
    title: 'Pourquoi je n’entends rien ?',
    /** The chip's tooltip. */
    chipHint: 'Afficher ce qui empêche la lecture',
    /** Under the title: what the list is, and that it changes nothing. */
    intro: 'Chaque ligne dit où en est la lecture. Rien n’est modifié ici : « Aller à » sélectionne un appareil ou ouvre l’inventaire.',
    /**
     * The intro while the power helper's button is in the list (`?design`, T3.3; T3 close review N2: only while the button is shown): its button is the one thing
     * in the list that adds something. No undo key here (S10: « Ctrl+Z les retire » was true only while the helper's entry was the last one; the status line
     * after the click names the app's own undo key).
     */
    introHelper: 'Chaque ligne dit où en est la lecture. « Aller à » sélectionne un appareil ou ouvre l’inventaire ; seul « Je branche pour vous » ajoute des câbles secteur.',
    close: 'Fermer la liste',
    /** Row names. */
    rowSource: 'Une source de lecture',
    rowConsole: 'Lecture console',
    rowPower: 'Alimentation',
    rowCable: 'Câblage jusqu’à une enceinte',
    rowMic: 'Micro',
    /** State tags (with a glyph: never colour alone). */
    tagBlocked: 'Bloqué',
    tagUnchecked: 'Pas encore vérifié',
    tagOk: 'En place',
    /**
     * The mic line when a verified mic is cabled to a console mic input. Shown only while the rig cannot play, and true there: Écoute plays a song, a file
     * or the test signal (`menu.song`, `menu.chooseFile`, `menu.testSignal`), never the mic (src/creation/listenController.ts reads no mic).
     */
    micCabled: 'Le micro est câblé, mais Écoute ne le fait pas entendre : elle lit un morceau, un fichier ou le signal de test.',
    /** Row button. */
    goTo: 'Aller à',
    /** The button's accessible name; {target} = the device (« Yamaha QL1 (ql1) ») or the inventory tab. */
    goToLabel: 'Aller à : {target}',
    targetInventory: 'l’inventaire, onglet Consoles',
    /** Under a greyed Écoute item (after the engine's reason). */
    menuHint: 'Voir « Pourquoi je n’entends rien ? » dans la barre d’état.',
    /**
     * The power helper (T3.3, spec 6.5), a button on this list's « Alimentation » row, under `?design` only: it cables the console and the speakers the
     * learner placed to the strip the learner placed, as one undo entry; it never places, never switches anything. Says « dans le simulateur »: nothing about
     * real mains.
     */
    helperButton: 'Je branche pour vous (dans le simulateur)',
    /** Under the enabled button: exactly what a click does (a statement, not a « tu » imperative: T3 close review S6); {devices} = « Yamaha QL1 (ql1), QSC K12.2 (k12) ». */
    helperWhat: 'Ce bouton relie à la multiprise posée : {devices}. Rien n’est posé ni réglé.',
    /**
     * Under the disabled button during a tutorial run while a power step is current or ahead, until Oscar offers it (spec 6.5; T3 close review S7: the list works
     * without Oscar, so no first person, and « relier » names what to cable).
     */
    helperLocked: 'Essayez d’abord de relier la console et l’enceinte à la multiprise ; l’aide sera proposée ensuite.',
    /** Under the disabled button during a tutorial run where no power step is current or ahead (T3 close review S5): it makes no promise. */
    helperLockedRun: 'Pendant le tutoriel, ce bouton reste inactif : reliez vous-même la console et l’enceinte à la multiprise.',
    /** The status line after the helper: exactly what was added. {undo} = the app's undo key label (T3 close review S10), as the other status lines. */
    helperDone: 'Branché au courant : {devices}. {undo} pour annuler.',
    /** The status line when a cable was refused on the way (everything was undone). */
    helperFailed: 'Le branchement n’a pas été fait : rien n’a changé.',
    /** The status line when another action is still in progress (a drag: T3 close review S9); nothing was done. */
    helperBusy: 'Le branchement n’a pas été fait : une autre action est en cours. Rien n’a changé.',
    /** The History entry (Édition › Annuler). */
    helperEntry: 'Branchement au courant (aide)',
  },
  /**
   * Oscar's verdict (T1.4): after the engine's reason (`playback.*`, quoted verbatim by src/guide/verdict.ts) one sentence on what to do. One per
   * signal-path reason the verdict can carry (`path.reasons[0]`); none for RULE_ERROR (the rule's own explanation is the fix) nor NO_MIC (a mic reason, never a playback one). No figure, no promise. Every string here: à valider (tekuxwriter, 2026-11-12).
   */
  assist: {
    /** After `playback.noSource` (NO_SOURCE): a source is a console that has the « Lecture console » command: today only the Yamaha QL1 (the Axia iQ has none), so the sentence NAMES it; tests/guide/verdict.test.ts fails when the catalog gets another source console. */
    noSource: 'Ajoutez la Yamaha QL1 (onglet « Consoles ») : c’est la console qui a la commande « Lecture console ».',
    /** After `playback.sourceOff` (SOURCE_OFF). */
    sourceOff: 'Sélectionnez la console, puis activez « Lecture console » dans Propriétés.',
    /** After `playback.hostUnpowered` (HOST_UNPOWERED). */
    hostUnpowered: 'Reliez la prise secteur de la console à une multiprise (onglet « Secteur » de l’inventaire) et vérifiez que « Alimentation » est activée.',
    /** After `playback.noPath` (NO_PATH). */
    noPath: 'Reliez une sortie principale de la console à l’entrée d’une enceinte.',
    /** After `playback.speakerUnpowered` (SPEAKER_UNPOWERED). */
    speakerUnpowered: 'Reliez la prise secteur de l’enceinte à une multiprise et vérifiez que « Alimentation » est activée.',
  },
  /**
   * Mode Création's own wording of the simulator rules R1 to R5 (T1.5a, spec 8.4 and Appendix A): `teach_fr` only, keyed by the RULE ID (R1 to R5), applied by
   * `creationRuleRows` (src/creation/ruleTexts.ts). The catalog text is not edited (the legacy Essais fingerprint covers it) and the legacy route keeps it.
   * Each text says what the simulator accepts or refuses: no hardware outcome, no safety claim, no figure that has no source record. R6 to R8 have no
   * override. Every string here: à valider (tekuxwriter, 2026-11-12).
   */
  ruleOverride: {
    /** R1 « Connecteurs incompatibles » (the engine refuses a connector mismatch). */
    R1: 'Dans le simulateur, un XLR mâle se branche sur un XLR femelle et une fiche TT sur un jack TT. Deux connecteurs qui ne vont pas ensemble sont refusés : choisissez une autre prise ou un autre câble.',
    /** R2 « Types de signal incompatibles » (the engine refuses SIGNAL_MISMATCH: the two ports must carry the same signal type). */
    R2: 'Dans le simulateur, les deux prises doivent porter le même type de signal : niveau micro, niveau ligne pro, niveau ligne grand public, numérique AES3… Un type différent est refusé : un micro va sur une entrée micro, une sortie ligne sur une entrée ligne.',
    /** R3 « Sens de connexion incorrect » (the engine refuses out to out and in to in; a `bidir` port, 12 in the catalog, accepts either end). */
    R3: 'Dans le simulateur, un câble va d’une sortie vers une entrée. Deux sorties reliées entre elles, ou deux entrées, sont refusées. Les ports bidirectionnels (réseau, patchbay…) acceptent les deux sens.',
    /** R4 « Alimentation fantôme (+48 V) » (an ERROR event of the evaluator, not a refusal: the mic's input has no +48 V; the cable then gets no « Micro OK »). */
    R4: 'Dans le simulateur, un micro à condensateur (U 87) branché sur une entrée sans alimentation fantôme +48 V est signalé en erreur et n’obtient pas « Micro OK » ; un micro dynamique (SM58, RE20) n’est pas concerné.',
    /** R5 « Voyant ON-AIR (tally) » (a WARNING event of the evaluator, src/logic/gpio.ts: an open mic fader channel and no console tally output cabled to an ON-AIR light; it fires with no mic plugged, the Axia iQ ships with its mic 1 fader open). */
    R5: 'Dans le simulateur, quand la voie micro d’une console est ouverte (même sans micro branché), sa sortie tally doit être reliée à un voyant ON-AIR ; sinon un avertissement s’affiche.',
  },
  /**
   * The first visit (onboarding packs, T2): the start screen, only under `?design=1..5`. Profile labels say the learner's situation. French « vous », no
   * figure, no success or school word, no duration. Every string here: à valider (tekuxwriter, 2026-11-12).
   */
  onboarding: {
    /** Situation labels of the four profile buttons (keys 1 to 4; src/creation/onboarding/profiles.ts). */
    profileDecouvre: 'Je découvre',
    profileEtudie: 'J’étudie le son',
    profileProjet: 'Je monte un projet',
    profileMetier: 'Je travaille dans le son',
    /** Heading of the profile stage of the start screen (no accented letter: the title font (Tektur) draws an acute as a macron at small sizes, see .cr-pick-confirm-title). */
    startTitle: 'Bienvenue : quelle est votre situation ?',
    /** Under the heading of the profile stage. */
    startLead: 'Vous pourrez changer de profil à tout moment.',
    /** Button under the four profiles: the place picker as it is without a start screen. */
    allPlaces: 'Tous les lieux',
    /** Heading of the offer stage. */
    offerTitle: 'Un tutoriel pour votre premier son ?',
    /** The profile just chosen, above the offer; {profile} = its label. */
    offerProfile: 'Votre profil : {profile}',
    /** Under the offer heading: what the tutorial is, and that it is advised to everyone. Package-neutral (the five packages do not start in the same room, review item 5). */
    offerLead: 'Des étapes courtes, à faire vous-même, pour arriver à votre premier son. Il est conseillé à tout le monde.',
    /** The two EQUAL answers. {n} = number of steps of the active tutorial (a count of steps, never a duration). */
    offerTutorial: 'Faire le tutoriel (conseillé · {n} étapes, à votre rythme)',
    offerSkip: 'Passer, je connais',
    /** The profile chip in the status bar (reopens the start stage). {profile} = the profile's label. */
    chip: 'Profil : {profile} · changer',
    /** The same chip while no profile is stored (the learner left the start screen, or has not been asked yet): it opens the profile stage. */
    chipChoose: 'Choisir un profil',
    /** Its `title`, for both texts. */
    chipHint: 'Rouvre l’écran de départ.',
  },
  /**
   * The tutorial « Premiers pas » (onboarding packs, T3.1, spec 6.3 and 7.2): Oscar's one sentence per step, what to do and where, never an outcome that is
   * not true yet (no sound before Écoute). Keys follow the step ids of src/guide/tutorial.ts. `{console}` and `{micro}` = the catalog labels of the source
   * console and of the SM58. The flow title is `menu.firstSteps` (by key); step 6 says `assist.sourceOff` (by key). `closingLines()` (src/guide/tutorial.ts) is `listen.simple` then
   * the checklist's own mic line (`checklist.micCabled`) by key: NOT DISPLAYED YET (plan T6.1: the step card shows it). Every string here: à valider (tekuxwriter, 2026-11-12).
   */
  /**
   * Aide while the tutorial runs (plan T3.2): the three items that replace « Premiers pas ». {k} = the step to resume at. Every string here: à valider
   * (tekuxwriter, 2026-11-12).
   */
  tutorialUi: {
    resume: 'Reprendre à l’étape {k}',
    restart: 'Recommencer le tutoriel',
    skip: 'Passer le tutoriel',
  },
  tutorial: {
    console: 'Ouvrez Matériel, puis Inventaire, onglet Consoles, et posez la {console} sur le sol.',
    micro: 'Posez le micro {micro}, onglet Micros.',
    enceinte: 'Posez une enceinte, onglet Enceintes : c’est elle qui diffuse le son.',
    consoleEnceinte: 'Sélectionnez la console, puis « Connecter à… » sur une sortie principale : la prise proposée vers l’enceinte est compatible.',
    microConsole: 'Faites de même du micro vers la console : la prise proposée est compatible.',
    multiprise: 'Dans ce simulateur, la console et l’enceinte ont besoin de courant : posez une multiprise, onglet Secteur.',
    /** Said with `multiprise`, in the same bubble. */
    powerNote: 'Ici, la multiprise est la source de courant : le simulateur ne vérifie ni la prise murale ni la puissance.',
    courantConsole: 'Reliez la console à la multiprise.',
    courantEnceinte: 'Reliez aussi l’enceinte à la multiprise.',
    ecoute: 'Ouvrez Écoute, puis Signal de test.',
    /** Package 5 only, after `ecoute` (a sound is playing): one of two speakers is unplugged. */
    debrancher: 'Pendant l’écoute, débranchez le câble de la console vers l’une des enceintes : cette enceinte se tait, l’autre continue.',
    rebrancher: 'Rebranchez-le : la prise proposée est compatible.',
    /** An accepted connection (with a nod, T5): the only acknowledgement; never « bien réglé », « bravo », « correct ». */
    accepted: 'Connexion acceptée.',
    /** Oscar's offer of the power helper (T3.3 and T3.4 wire it): cabling only, in the simulator. */
    helperOffer: 'Je peux brancher pour vous, dans le simulateur.',
    /** Before the bubble of the step that comes after steps the learner had already done (G8 review C2); {steps} = the `alreadyStep` items, comma separated. */
    alreadyInPlace: 'Déjà en place : {steps}.',
    /** One item of `alreadyInPlace`; {k} = the step's number in the tutorial. */
    alreadyStep: 'étape {k}',
  },
  /**
   * The new Oscar (onboarding packs T5.4, spec 9 and 10.2), under `?design` only. Oscar's voice: no « intelligent », « expert », « tuteur », « ingénieur »
   * (tests/creation/honesty.test.ts scans this section as a learner one). À valider (tekuxwriter, 2026-11-13).
   */
  oscar: {
    /** The badge in the header of Oscar's bubble, with every open bubble: it says what Oscar is; the icon keeps its name « Oscar, assistant IA » (founder decision). */
    badge: 'Oscar · Assistant',
  },
  /**
   * The names of the five design packages (onboarding packs, T4.1, spec 7.2), read through `DesignPackage.nameKey` (`design.name1` .. `design.name5`). Not displayed
   * anywhere yet (the packages are chosen by the address, `?design=1..5`); the founder's local run and the tester guide name them. Every string here: à valider
   * (tekuxwriter, 2026-11-12).
   */
  design: {
    name1: 'Pas à pas',
    name2: 'Atelier',
    name3: 'Salle d’abord',
    name4: 'Pupitre',
    name5: 'Modèle d’abord',
  },
}
