# Taxonomie du matériel son (Sound equipment taxonomy)

Guide bilingue qui reprend `taxonomy.json` (même ordre, mêmes identifiants). Pour chaque catégorie : rôle, principe physique, sous-types, usages et sources. Termes français d'abord, anglais entre parenthèses.

Bilingual guide mirroring `taxonomy.json` (same order and ids). French first, English in parentheses or in the EN lines.

**Niveaux de confiance (confidence levels)** : `verified-primary` = constructeur, organisme de normalisation ou source officielle ; `verified-secondary` = presse spécialisée, Wikipédia, revendeur ou page pédagogique ; `unverified` = aucune source ouverte pendant la session (à vérifier avant usage pédagogique). Les entrées marquées *proposé (proposed)* sont des ajouts à valider. Consultation des sources : 22/10/2026.

## Sommaire (contents)

- [Microphones (Microphones)](#microphones)
- [Systèmes HF (sans fil) (Wireless systems)](#wireless-systems)
- [Consoles de mixage (Mixing consoles)](#consoles)
- [Boîtiers de scène et réseaux audio (Stage boxes & audio networking)](#stageboxes-networking)
- [Interfaces audio, convertisseurs et horloges (Audio interfaces, converters & clocks)](#interfaces-converters-clocks)
- [Préamplis, traitements et périphériques (Preamps, processors & outboard)](#processors-outboard)
- [Boîtes de direct (DI) et splitters (DI boxes & splitters)](#di-splitters)
- [Enceintes de sonorisation (Loudspeakers (sound reinforcement))](#loudspeakers)
- [Écoutes de studio et contrôle d'écoute (Studio monitors & monitor control)](#studio-monitors)
- [Amplificateurs et gestion de diffusion (Amplifiers & loudspeaker management)](#amplifiers-processors)
- [Casques et écouteurs intra-auriculaires (Headphones & in-ear monitors)](#headphones-iem)
- [Enregistreurs et lecture (Recorders & playback)](#recorders-playback)
- [Équipements broadcast et radio (Broadcast & radio systems)](#broadcast-radio)
- [Câbles et connecteurs (Cables & connectors)](#cables-connectors)
- [Baies de brassage (patch) (Patchbays)](#patchbays)
- [Mesure et outils de test (Measurement & test tools)](#measurement-tools)
- [Pieds, suspensions et accessoires micro (Stands, mounts & mic accessories)](#accessories-mounting)
- [Logiciels audio (STAN, contrôle, analyse) (Audio software (DAW, control, analysis))](#software)
- [Installations et lieux (contextes) (Installations & rooms (contexts, no devices))](#installations-rooms)
- [Distribution électrique et sécurité (Power distribution & electrical safety)](#power-distribution) — *proposé*
- [Interfaces de contrôle de spectacle et lumière (marginal) (Show-control & lighting interfaces (marginal))](#show-control-interfaces) — *proposé*

<a id="microphones"></a>
## Microphones (Microphones)

`microphones`

**Rôle** : Transducteurs qui convertissent une onde de pression acoustique en signal électrique. Premier maillon de toute chaîne de prise de son.

*What it does:* Transducers that convert an acoustic pressure wave into an electrical signal. They are the first link of any recording or reinforcement chain.

**Principe** : Une membrane suit les variations de pression (ou de gradient de pression) de l'air. Son mouvement est converti en tension soit par induction électromagnétique (dynamique, ruban), soit par variation de capacité (statique, électret), soit par effet piézoélectrique (capteurs de contact).

*Principle:* A diaphragm follows the air's pressure (or pressure-gradient) variations. Its motion becomes a voltage through electromagnetic induction (dynamic, ribbon), variable capacitance (condenser, electret) or the piezoelectric effect (contact pickups).

**Usages typiques (typical uses)** : prise de son studio (studio recording) ; sonorisation live (live sound reinforcement) ; tournage / reportage (film and ENG location sound) ; radio et podcast (radio and podcast) ; mesure acoustique (acoustic measurement)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `dynamic-moving-coil` | Dynamique (à bobine mobile) (Dynamic (moving coil)) | Micro robuste à bobine mobile, sans alimentation, qui supporte de très forts niveaux de pression acoustique. | Une bobine solidaire de la membrane se déplace dans le champ d'un aimant permanent : par induction électromagnétique, une tension proportionnelle à la vitesse de la bobine apparaît à ses bornes. | A coil attached to the diaphragm moves inside a permanent magnet's field; electromagnetic induction generates a voltage in the coil. | verified-primary |
| `ribbon` | À ruban (Ribbon) | Micro à ruban : son naturel et doux, directivité en figure 8 le plus souvent, fragile. | Un ruban métallique très fin suspendu dans un champ magnétique bouge avec la vitesse particulaire de l'air et produit une tension par induction. Les deux faces étant exposées, la directivité naturelle est bidirectionnelle (figure 8). Les modèles passifs ne doivent pas recevoir d'alimentation fantôme via un câble défectueux. | A very thin metal ribbon suspended in a magnetic field moves with air particle velocity and generates a voltage by induction. Both faces are open to the sound field, so the natural pattern is figure-8. Passive models can be damaged by phantom power through a faulty cable. | verified-primary, verified-secondary |
| `condenser-large-diaphragm` | Statique grande membrane (Large-diaphragm condenser) | Micro statique à grande membrane (environ 1 pouce) : sensible, détaillé, souvent multi-directivité ; référence pour la voix en studio. | La membrane forme l'armature mobile d'un condensateur face à une contre-électrode polarisée. Le déplacement de la membrane fait varier la capacité, donc la tension, qu'un étage électronique interne convertit en basse impédance. Il faut une alimentation (souvent fantôme 48 V). | The diaphragm is the moving plate of a capacitor facing a charged backplate. Diaphragm motion changes the capacitance and hence the voltage, buffered by internal electronics. Needs power, usually 48 V phantom. | verified-primary |
| `condenser-small-diaphragm` | Statique petite membrane (Small-diaphragm condenser) | Micro statique à petite membrane (crayon) : réponse transitoire précise et directivité régulière en fréquence. | Même principe capacitif que la grande membrane ; la membrane plus petite et plus légère suit mieux les hautes fréquences et perturbe moins le champ acoustique. | Same capacitive principle as large-diaphragm models; the smaller, lighter diaphragm tracks high frequencies better and disturbs the sound field less. | verified-primary |
| `electret` | Électret (Electret condenser) | Micro statique dont la polarisation est permanente (électret) : petit, peu coûteux, alimenté par pile ou faible tension. | Un matériau électret, sorte d'équivalent électrostatique d'un aimant permanent, est déposé le plus souvent sur la contre-électrode et conserve une charge fixe. Il n'y a donc pas besoin de tension de polarisation, seulement d'une petite alimentation pour le transistor (FET) d'adaptation. | An electret material, the electrostatic counterpart of a permanent magnet, usually sits on the backplate and holds a fixed charge. No polarisation voltage is needed, only a small supply for the FET impedance converter. | verified-primary |
| `tube-valve` | Statique à lampe (Tube / valve condenser) | Micro statique dont l'étage d'adaptation d'impédance utilise une lampe (tube) au lieu d'un transistor ; alimentation dédiée. | Capsule capacitive identique à un statique classique ; la lampe sert de convertisseur d'impédance et apporte une coloration (harmoniques). Elle demande tension de chauffage et haute tension, fournies par une alimentation externe et un câble multibroche. | Same capacitive capsule as other condensers; the tube acts as the impedance converter and adds harmonic colour. It needs heater and high voltages, supplied by an external PSU over a multi-pin cable. | unverified, verified-secondary |
| `boundary-pzm` | Microphone de surface (PZM) (Boundary / PZM) | Micro de surface posé sur une paroi (sol, table, mur) : capte sans filtrage en peigne dû à la réflexion de la surface. | La capsule est placée très près d'une plaque réfléchissante : son direct et réfléchi arrivent en phase (zone de pression), ce qui donne environ +6 dB et repousse les interférences en peigne au-delà de la bande audible. PZM est une marque de Crown. | The capsule sits very close to a reflective plate, so direct and reflected sound arrive in phase (the pressure zone), giving about +6 dB and pushing comb-filter notches above the audible band. PZM is a Crown trademark. | verified-secondary |
| `shotgun-interference-tube` | Canon (tube à interférences) (Shotgun / interference tube) | Micro canon : très directif dans l'axe, utilisé à la perche pour capter une source à distance. | Un tube fendu latéralement (tube à interférences) est placé devant une capsule (souvent supercardioïde). Le son arrivant dans l'axe passe directement ; le son latéral entre par les fentes avec des trajets de longueurs différentes et s'annule partiellement par interférence. La directivité augmente avec la fréquence et la réponse hors axe est irrégulière. | A slotted tube (interference tube) sits in front of a capsule (often supercardioid). On-axis sound passes straight through; off-axis sound enters the slots over different path lengths and partly cancels by interference. Directivity rises with frequency and the off-axis response is irregular. | verified-primary |
| `lavalier` | Micro-cravate (Lavalier) | Micro miniature porté sur le vêtement ou caché, souvent relié à un émetteur HF. | Presque toujours une capsule statique électret miniature (omnidirectionnelle le plus souvent) ; la petite taille impose la technologie statique. | Almost always a miniature electret condenser capsule (mostly omnidirectional); the small size calls for condenser technology. | verified-primary |
| `headset` | Micro serre-tête (Headset) | Micro serre-tête : capsule tenue près de la bouche par un arceau, distance constante et bon gain avant larsen. | Capsule électret miniature (omni ou directionnelle) ; la proximité de la bouche améliore le rapport signal / ambiance. | Miniature electret capsule (omni or directional); proximity to the mouth improves the voice-to-ambience ratio. | verified-primary |
| `measurement` | Microphone de mesure (Measurement) | Micro omnidirectionnel étalonné à réponse en fréquence plate et connue, pour mesurer niveaux et réponses de systèmes. | Capsule statique (polarisée ou pré-polarisée) étalonnée soit en champ libre (onde frontale), soit en champ de pression ; les micros étalons de laboratoire sont décrits par la série IEC 61094. | Condenser capsule (externally or pre-polarised) calibrated either for free-field (frontal incidence) or pressure-field use; laboratory standard microphones are covered by the IEC 61094 series. | verified-primary |
| `contact-piezo` | Capteur de contact / piézo (Contact / piezo) | Capteur collé sur un objet ou un instrument : capte les vibrations solidiennes et non le son aérien. | Un élément piézoélectrique se déforme sous la vibration et libère une charge électrique proportionnelle. Sa nature capacitive et sa haute impédance imposent une entrée haute impédance (sinon perte de graves). | A piezoelectric element deforms with the vibration and releases a proportional charge. Its capacitive, high-impedance nature needs a high-impedance input, otherwise the low end is lost. | verified-secondary |
| `usb` | Microphone USB (USB microphone) | Micro intégrant préampli et convertisseur A/N, relié directement à l'ordinateur en USB. | Capsule → préampli interne → convertisseur analogique/numérique → interface USB audio : le micro est aussi sa propre carte son. Le gain analogique avant conversion conditionne la dynamique utile. | Capsule → internal preamp → A/D converter → USB audio interface: the mic is its own sound card. The analog gain set before conversion determines usable dynamic range. | verified-primary, verified-secondary |
| `stereo-ambisonic` | Stéréo / ambisonique / multicapsule (Stereo / ambisonic / multi-capsule) | Micros à plusieurs capsules pour la prise de son stéréo (XY, M/S) ou 3D (ambisonique). | Plusieurs capsules coïncidentes ou proches sont combinées. En ambisonique du 1er ordre, quatre capsules en tétraèdre (format A) sont matricées en format B : W (omni) et X, Y, Z (figures 8 selon les trois axes). | Several coincident or closely spaced capsules are combined. In first-order ambisonics, four capsules in a tetrahedron (A-format) are matrixed into B-format: W (omni) and X, Y, Z (figure-8s along the three axes). | verified-primary, verified-secondary |

### Attribut `polar_patterns`

| Valeur | FR | EN |
|---|---|---|
| `omnidirectional` | Omnidirectionnel : même sensibilité dans toutes les directions (capteur de pression) ; pas d'effet de proximité. | Omnidirectional: equal sensitivity in all directions (pressure transducer); no proximity effect. |
| `cardioid` | Cardioïde : capte l'avant, atténue les côtés (environ -6 dB à 90°) et rejette l'arrière ; angle d'ouverture à -3 dB d'environ 131°. | Cardioid: picks up the front, about -6 dB at 90°, rejects the rear; -3 dB acceptance angle about 131°. |
| `supercardioid` | Supercardioïde : plus étroit que le cardioïde, petit lobe arrière ; meilleur rejet latéral. | Supercardioid: narrower than cardioid with a small rear lobe; better side rejection. |
| `hypercardioid` | Hypercardioïde : encore plus étroit, lobe arrière plus marqué ; on l'oriente pour placer les retours dans ses zones de moindre sensibilité. | Hypercardioid: narrower still, with a larger rear lobe; aim it so monitors sit in its null zones. |
| `figure-8` | Bidirectionnel (figure 8) : avant et arrière à égalité, côtés annulés ; angle d'ouverture à -3 dB d'environ 90° ; utilisé en M/S et Blumlein. | Figure-8 (bidirectional): front and back equal, sides cancelled; -3 dB acceptance about 90°; used for M/S and Blumlein. |
| `lobar-shotgun` | Lobaire (canon) : lobe avant très étroit qui se resserre avec la fréquence ; mieux décrit par l'indice de directivité en fonction de la fréquence. | Lobar (shotgun): very narrow front lobe that tightens with frequency; best described by directivity index versus frequency. |
| `multi-pattern` | Multi-directivité : double membrane dont on combine les sorties pour choisir omni, cardio, figure 8, etc. | Multi-pattern: dual-diaphragm capsule whose outputs are combined to select omni, cardioid, figure-8 and so on. |
| `subcardioid` | Infracardioïde (cardioïde large) : entre omni et cardioïde ; rejet arrière modéré, son plus naturel. | Subcardioid (wide cardioid): between omni and cardioid; mild rear rejection, more natural sound. |

Sources :
- [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/technology/how-to-read-microphone-specifications/) — `verified-primary` — cardioid -3/-6 dB angles, acceptance angles, frequency-dependent polar plots
- [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/technology/how-to-specify-the-directivity-of-a-shotgun-mic/) — `verified-primary` — lobar-shotgun
- [Wikipedia](https://en.wikipedia.org/wiki/Ribbon_microphone) — `verified-secondary` — figure-8
- *unverified* — multi-pattern dual-diaphragm detail, subcardioid, hypercardioid rear lobe : aucune source ouverte (no source opened).

### Sources

- [Shure](https://www.shure.com/en-US/insights/mic-basics-transducers) — `verified-primary` — principle, dynamic, condenser, phantom power
- [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/technology/how-to-read-microphone-specifications/) — `verified-primary` — polar patterns, specification reading
- [Neumann](https://www.neumann.com/en-de/knowledge-base/neumann-im-homestudio/homestudio-academy/what-is-the-difference-between-electret-condenser-and-true-condenser-microphones) — `verified-primary` — condenser polarisation

Sources des sous-types (sub-type sources) :
  - `dynamic-moving-coil` [Shure](https://www.shure.com/en-US/insights/mic-basics-transducers) — `verified-primary` — principle, high SPL handling, ruggedness
  - `ribbon` [Wikipedia](https://en.wikipedia.org/wiki/Ribbon_microphone) — `verified-secondary` — principle, velocity, figure-8
  - `ribbon` [Royer Labs](https://royerlabs.com/pdf/manuals/R-122MKIImanual.pdf) — `verified-primary` — active ribbon variant
  - `ribbon` [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/know-the-basics-about-phantom-power) — `verified-primary` — phantom risk for ribbons
  - `condenser-large-diaphragm` [Shure](https://www.shure.com/en-US/insights/mic-basics-transducers) — `verified-primary` — principle, phantom power
  - `condenser-large-diaphragm` [Neumann](https://www.neumann.com/en-de/knowledge-base/neumann-im-homestudio/homestudio-academy/what-is-the-difference-between-electret-condenser-and-true-condenser-microphones) — `verified-primary` — polarisation voltage
  - `condenser-small-diaphragm` [Shure](https://www.shure.com/en-US/insights/mic-basics-transducers) — `verified-primary` — condenser principle, high-frequency detail
  - `electret` [Neumann](https://www.neumann.com/en-de/knowledge-base/neumann-im-homestudio/homestudio-academy/what-is-the-difference-between-electret-condenser-and-true-condenser-microphones) — `verified-primary` — principle, permanent charge, back-electret
  - `tube-valve` [Vintage King (retailer)](https://vintageking.com/products/neumann-m-149-tube) — `verified-secondary` — tube as impedance converter
  - `tube-valve` [Wikipedia](https://en.wikipedia.org/wiki/Neumann_U_47) — `verified-secondary` — history
  - `tube-valve` *unverified* — external PSU and multipin cable detail : aucune source ouverte (no source opened).
  - `boundary-pzm` [Sound On Sound](https://www.soundonsound.com/sound-advice/q-pzm-and-boundary-mics-whats-difference) — `verified-secondary` — principle, terminology
  - `boundary-pzm` [Wikipedia](https://en.wikipedia.org/wiki/Boundary_microphone) — `verified-secondary` — pressure zone, comb filtering
  - `shotgun-interference-tube` [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/the-interference-tube-and-its-use-in-microphones) — `verified-primary` — principle, off-axis irregularity
  - `shotgun-interference-tube` [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/technology/how-to-specify-the-directivity-of-a-shotgun-mic/) — `verified-primary` — directivity index vs frequency
  - `lavalier` [Shure](https://www.shure.com/en-US/insights/mic-basics-transducers) — `verified-primary` — condenser used for lavalier and headworn
  - `lavalier` [Neumann](https://www.neumann.com/en-de/knowledge-base/neumann-im-homestudio/homestudio-academy/what-is-the-difference-between-electret-condenser-and-true-condenser-microphones) — `verified-primary` — electret
  - `headset` [Shure](https://www.shure.com/en-US/insights/mic-basics-transducers) — `verified-primary` — condenser used for headworn
  - `measurement` [IEC TC 29 (Electroacoustics)](https://tc29.iec.ch/?p=3255) — `verified-primary` — IEC 61094 laboratory standard microphones
  - `measurement` [Brüel & Kjær / HBK](https://www.bksv.com/transducers/acoustic/microphones/microphone-cartridges/4145) — `verified-primary` — free-field type, IEC 61672 class 1 use
  - `contact-piezo` [LOM (knowledge base)](https://knowledge.lom.audio/_export/xhtml/research/contact_mics) — `verified-secondary` — principle, coupling, low-frequency loss
  - `usb` [Samson Technologies](https://samsontech.com/blog/whats-in-the-box-understanding-usb-audio-devices) — `verified-primary` — USB audio device architecture
  - `usb` [Sound On Sound](https://www.soundonsound.com/node/4912377) — `verified-secondary` — fixed vs variable gain before ADC
  - `stereo-ambisonic` [Sennheiser](https://docs.cloud.sennheiser.com/en-us/ambeo-vr-mic/product-info.html) — `verified-primary` — A-format to B-format conversion
  - `stereo-ambisonic` [Production Expert](https://www.production-expert.com/production-expert-1/2019/12/10/ambeo-and-ambisonic-formats-a-bluffers-guide) — `verified-secondary` — B-format channels, AmbiX vs FuMa

<a id="wireless-systems"></a>
## Systèmes HF (sans fil) (Wireless systems)

`wireless-systems`

**Rôle** : Liaisons radio (HF) qui remplacent le câble entre un micro ou une source et la console, ou entre la console et les retours ear des artistes.

*What it does:* Radio (RF) links that replace the cable between a mic or source and the console, or between the console and performers' in-ear monitors.

**Principe** : L'audio module une porteuse radio (le plus souvent en bande UHF). Chaque émetteur occupe sa propre fréquence et chaque récepteur n'écoute qu'un émetteur ; le plan de fréquences doit éviter les produits d'intermodulation et respecter la réglementation (en France : régime PMSE fixé par l'Arcep, bande 700 MHz réaffectée à la téléphonie mobile).

*Principle:* Audio modulates a radio carrier (usually in the UHF band). Each transmitter needs its own frequency and each receiver hears one transmitter; frequency plans must avoid intermodulation products and follow regulation (France: PMSE regime set by Arcep, 700 MHz band reallocated to mobile).

**Usages typiques (typical uses)** : chant et présentation (vocals and presenters) ; théâtre et comédie musicale (theatre and musicals) ; tournage (film location) ; retours ear (in-ear monitoring)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `analog-uhf` | HF analogique UHF (Analog UHF wireless mic) | Système HF analogique en UHF (émetteur main ou de poche + récepteur). | Modulation de fréquence (FM) analogique ; un compresseur-expandeur (compander) améliore la dynamique. Les récepteurs en diversité utilisent deux antennes pour limiter les décrochages. Latence quasi nulle. | Analog frequency modulation (FM); a compander extends dynamic range. Diversity receivers use two antennas to reduce dropouts. Near-zero latency. | verified-primary, verified-secondary |
| `digital-wireless` | HF numérique (Digital wireless mic) | Système HF numérique : l'audio est converti puis transmis sous forme de données. | Conversion A/N puis modulation numérique ; plus besoin de compander, mais une latence de conversion de l'ordre de la milliseconde (1,9 ms annoncés pour un système Sennheiser EW-DP). Non compatible avec les systèmes analogiques de la même marque. | A/D conversion then digital modulation; no compander needed, but a conversion latency of a few milliseconds (1.9 ms quoted for Sennheiser EW-DP). Not cross-compatible with the same brand's analog systems. | verified-primary, verified-secondary |
| `wireless-iem` | Retour ear HF (émetteur/récepteur) (Wireless in-ear monitor transmitter/receiver) | Émetteur en rack + récepteur de poche stéréo qui envoie un mixage de retour dans les écouteurs de l'artiste. | Même technologie radio que les micros HF, mais dans l'autre sens (de la console vers l'artiste) ; le récepteur intègre un limiteur pour protéger l'audition. | Same RF technology as wireless mics but in the other direction (console to performer); the receiver includes a limiter to protect hearing. | verified-primary, verified-secondary |
| `antenna-distribution` | Antennes et distribution (Antennas & distribution) | Antennes (fouet, log-périodiques, hélicoïdales) et distributeurs/combineurs permettant à plusieurs récepteurs ou émetteurs de partager peu d'antennes. | Un distributeur actif amplifie puis répartit le signal d'une paire d'antennes vers plusieurs récepteurs ; un combineur réunit plusieurs émetteurs IEM sur une antenne. Les antennes directives augmentent la portée ; l'hélicoïdale (polarisation circulaire) capte quelle que soit l'orientation de l'émetteur. | An active splitter amplifies and shares a pair of antennas among several receivers; a combiner merges several IEM transmitters into one antenna. Directional antennas extend range; a helical (circular polarisation) antenna receives regardless of transmitter orientation. | unverified, verified-secondary |
| `camera-eng-wireless` | HF caméra / reportage (Camera / ENG plug-on & slot wireless) | Récepteurs HF compacts montés sur caméra (fixation griffe ou slot) et émetteurs enfichables (plug-on) sur un micro XLR. | Même technologie HF que les autres systèmes, en format réduit et alimenté par piles ou par la caméra. | Same RF technology in a small format, powered by batteries or the camera. | unverified |

### Sources

- [Shure](https://www.shure.com/en-US/insights/shure-whiteboard-session-how-to-coordinate-a-wireless-system) — `verified-primary` — one receiver per transmitter, frequency coordination
- [Shure](https://www.shure.com/en-eu/insights/tell-me-about-wireless-mic-frequencies) — `verified-primary` — frequency bands
- [Arcep (régulateur français)](https://www.arcep.fr/la-regulation/grands-dossiers-reseaux-mobiles/les-frequences-pour-les-professionnels-de-laudiovisuel-et-du-spectacle/les-equipements-auxiliaires-sonores-de-conception-de-programmes-et-de-radiodiffusion.html) — `verified-primary` — French PMSE regulatory regime
- [ANFR](https://www.anfr.fr/fileadmin/mediatheque/documents/Communiques_Presse/CP_ouverture_PMSE.pdf) — `verified-primary` — 700 MHz band change in France

Sources des sous-types (sub-type sources) :
  - `analog-uhf` [Adorama (retailer guide)](https://www.adorama.com/alc/how-to-choose-a-wireless-microphone-system/) — `verified-secondary` — analog latency, companding
  - `analog-uhf` [Shure](https://www.shure.com/en-US/insights/shure-whiteboard-session-how-to-coordinate-a-wireless-system) — `verified-primary` — frequency coordination
  - `digital-wireless` [Sennheiser](https://www.sennheiser.com/en-de/catalog/products/wireless-systems/ew-dp-835-set/ew-dp-835-set-t13-14-700471) — `verified-primary` — no compander, latency figure, no analog compatibility
  - `digital-wireless` [Adorama (retailer guide)](https://www.adorama.com/alc/how-to-choose-a-wireless-microphone-system/) — `verified-secondary` — digital latency
  - `wireless-iem` [Shure](https://www.shure.com/es-latam/productos/sistemas-de-monitoreo-in-ear/psm1000) — `verified-primary` — transmitter + bodypack system
  - `wireless-iem` [Gear4music (retailer guide)](https://www.gear4music.com/blog/shure-in-ear-monitor-guide) — `verified-secondary` — same RF tech as wireless mics, peak limiter, MixMode
  - `antenna-distribution` [AVL Gear (retailer, Shure HA-8089 listing)](https://www.avlgear.com/product/shure-ha8089-pws-helical-antenna/) — `verified-secondary` — helical antenna, polarisation
  - `antenna-distribution` *unverified* — splitter/combiner operation : aucune source ouverte (no source opened).
  - `camera-eng-wireless` [Sennheiser](https://www.sennheiser.com/en-ee/catalog/products/wireless-systems/ew-dp-eng-set) — `unverified` — example product family (page seen, content not read)
  - `camera-eng-wireless` *unverified* — principle : aucune source ouverte (no source opened).

<a id="consoles"></a>
## Consoles de mixage (Mixing consoles)

`consoles`

**Rôle** : Appareils qui reçoivent de nombreuses sources, les amplifient, les traitent (égalisation, dynamique), les mélangent et les distribuent vers différentes sorties (façade, retours, enregistrement).

*What it does:* Devices that take many sources, amplify and process them (EQ, dynamics), mix them and route them to several outputs (front of house, monitors, recording).

**Principe** : Chaque tranche suit un même chemin : préampli → filtre/égaliseur → dynamique → fader → bus (master, auxiliaires, groupes). En analogique, la sommation se fait électriquement ; en numérique, les signaux sont convertis et calculés par DSP, ce qui permet rappels de scènes et contrôle à distance.

*Principle:* Each channel follows the same path: preamp → filter/EQ → dynamics → fader → buses (master, aux, groups). Analog consoles sum electrically; digital consoles convert and compute with DSP, enabling scene recall and remote control.

**Usages typiques (typical uses)** : façade (FOH) (front of house) ; retours (monitor mixing) ; enregistrement studio (studio recording) ; radio / TV (radio and TV)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `analog-live` | Console analogique live (Analog live console) | Console analogique pour la sonorisation : préamplis, EQ, auxiliaires pré/post-fader, groupes et matrices. | Sommation électrique des tranches sur des bus ; chaque fonction a son bouton physique (pas de mémoire). | Electrical summing of channels onto buses; every function has a physical control (no memory). | unverified |
| `analog-studio-inline` | Console analogique studio / in-line (Analog studio / in-line console) | Console analogique de studio dont chaque tranche contient à la fois le chemin d'enregistrement et le retour d'écoute du multipiste (in-line), par opposition à la console 'split'. | In-line : deux chemins par tranche, ce qui double le nombre d'entrées au mixage. Split : sections entrées et retours séparées, plus simple à lire. | In-line: two paths per strip, doubling inputs at mixdown. Split: separate input and monitor sections, easier to read. | verified-secondary |
| `small-mixer` | Petite console / mixette (Small / compact mixer) | Petite console compacte (mixette) avec quelques entrées micro/ligne, parfois interface USB. | Même chaîne de base qu'une grande console, fonctions réduites. | Same basic chain as a large console with fewer functions. | unverified |
| `digital-live` | Console numérique live (Digital live console) | Console numérique de sonorisation : traitements intégrés, mémoires de scènes, boîtiers de scène déportés en réseau. | Conversion A/N au plus près des micros (stagebox), traitement DSP, transport numérique (AES50, Dante, MADI...). | A/D conversion close to the mics (stage box), DSP processing, digital transport (AES50, Dante, MADI, etc.). | unverified, verified-primary |
| `digital-broadcast-radio` | Console numérique broadcast / radio (Digital broadcast / radio console) | Console numérique de radio/TV : ouverture d'antenne, N-1 automatiques, logique de signalisation (tally, ON AIR), souvent sur réseau AoIP. | Mélangeur DSP piloté par une surface ; la logique GPIO et les bus N-1 sont intégrés. | DSP mixer driven by a surface; GPIO logic and mix-minus buses built in. | unverified, verified-primary, verified-secondary |
| `digital-studio-post` | Console numérique studio / post-production (Digital studio / post console) | Console numérique de studio ou de post-production (mixage multicanal, formats immersifs). | Moteur DSP ou station de travail pilotée par une surface dédiée. | DSP engine or DAW driven by a dedicated surface. | unverified |
| `control-surface` | Surface de contrôle (DAW control surface) | Surface de faders et boutons qui pilote une station audionumérique (STAN) sans traiter l'audio elle-même. | Envoie des messages de contrôle (MIDI, protocoles HUI/Mackie Control, EuCon via Ethernet) au logiciel. | Sends control messages (MIDI, HUI/Mackie Control protocols, EuCon over Ethernet) to the software. | unverified |

### Sources

- [Puremix](https://www.puremix.com/blog/andrew-scheps-inline-a-split-line-consoles) — `verified-secondary` — split vs in-line
- [Sound On Sound](https://www.soundonsound.com/reviews/studiomaster-mixdown-classic-8) — `verified-secondary` — in-line monitor inputs
- [Yamaha Pro Audio](https://usa.yamaha.com/products/contents/proaudio/musicianspa/effects/equlizer.html) — `verified-primary` — parametric EQ per mixer channel, graphic EQ on outputs
- *unverified* — generic channel signal flow, digital console DSP : aucune source ouverte (no source opened).

Sources des sous-types (sub-type sources) :
  - `analog-live` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `analog-studio-inline` [Puremix](https://www.puremix.com/blog/andrew-scheps-inline-a-split-line-consoles) — `verified-secondary` — split vs in-line
  - `analog-studio-inline` [Sound On Sound](https://www.soundonsound.com/reviews/studiomaster-mixdown-classic-8) — `verified-secondary` — monitor input per channel
  - `small-mixer` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `digital-live` [Audio Engineering Society](https://aes.org/audio-topics/audio-networking-2/) — `verified-primary` — digital audio transports
  - `digital-live` *unverified* — console description : aucune source ouverte (no source opened).
  - `digital-broadcast-radio` [Sound On Sound (glossary)](https://www.soundonsound.com/glossary/mix-minus) — `verified-secondary` — mix-minus
  - `digital-broadcast-radio` [Telos Alliance (Axia)](https://telosalliance.com/Livewire) — `verified-primary` — AoIP in broadcast
  - `digital-broadcast-radio` *unverified* — console description : aucune source ouverte (no source opened).
  - `digital-studio-post` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `control-surface` *unverified* — description, protocols : aucune source ouverte (no source opened).

<a id="stageboxes-networking"></a>
## Boîtiers de scène et réseaux audio (Stage boxes & audio networking)

`stageboxes-networking`

**Rôle** : Équipements qui transportent de nombreux canaux audio entre la scène et la régie : multipaires analogiques, boîtiers de scène numériques et réseaux audio (AoIP).

*What it does:* Equipment that carries many audio channels between stage and control position: analog multicores, digital stage boxes and audio networks (AoIP).

**Principe** : En numérique, les échantillons de plusieurs canaux sont multiplexés sur un seul câble (coaxial, Cat5e/6, fibre). Tous les appareils doivent partager la même horloge : horloge maître ou protocole de synchronisation réseau (PTP, IEEE 1588) pour les réseaux IP.

*Principle:* Digitally, samples from many channels are multiplexed onto one cable (coax, Cat5e/6, fibre). All devices must share one clock: a master clock, or a network timing protocol (PTP, IEEE 1588) on IP networks.

**Usages typiques (typical uses)** : liaison scène-régie (stage to FOH link) ; partage d'entrées façade/retours/enregistrement (sharing inputs between FOH, monitors and recording) ; infrastructures broadcast (broadcast plants)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `analog-multicore` | Multipaire analogique (Analog multicore / snake) | Câble multipaire avec boîtier de scène et éclaté (ou connecteur multibroche) : chaque canal reste une paire symétrique analogique. | Plusieurs paires blindées dans une même gaine ; aucune conversion, donc aucune latence, mais poids et pertes en longueur. | Several shielded pairs in one jacket; no conversion and no latency, but heavy and subject to long-run losses. | unverified, verified-primary |
| `digital-stagebox` | Boîtier de scène numérique (Digital stage box) | Boîtier de scène avec préamplis pilotés à distance et convertisseurs, relié à la console par un seul lien numérique. | Conversion A/N sur scène, transport numérique multicanal (AES50, Dante, MADI, propriétaire). | A/D conversion on stage, multichannel digital transport (AES50, Dante, MADI or proprietary). | verified-primary, verified-secondary |
| `dante-device` | Interface Dante (Dante interface / adapter) | Interface ou adaptateur qui met des entrées/sorties analogiques ou numériques sur un réseau Dante. | Dante (Audinate) transporte de l'audio non compressé en paquets IP sur Ethernet standard ; un appareil est élu horloge leader PTP et les autres s'y asservissent ; la latence de réception est réglable (par défaut 1 ms). | Dante (Audinate) carries uncompressed audio in IP packets over standard Ethernet; one device is elected PTP leader clock and the others follow; receive latency is adjustable (1 ms default). | unverified, verified-primary |
| `avb-milan-device` | Équipement AVB / Milan (AVB / Milan device) | Équipement compatible AVB/Milan (standards IEEE 802.1 'Time-Sensitive Networking'). | AVB réserve la bande passante et synchronise les horloges au niveau du switch (IEEE 802.1AS) ; Milan (Avnu Alliance) ajoute des règles de format, d'horloge et de redondance pour garantir l'interopérabilité ; il faut des switchs certifiés. | AVB reserves bandwidth and synchronises clocks in the switches (IEEE 802.1AS); Milan (Avnu Alliance) adds format, clocking and redundancy rules to guarantee interoperability; certified switches are required. | verified-primary, verified-secondary |
| `madi-device` | Équipement MADI (MADI device) | Équipement MADI (AES10) : liaison point à point jusqu'à 64 canaux. | Flux série multicanal sur coaxial 75 Ω (BNC) ou fibre optique ; 56 puis 64 canaux à 48 kHz, moins aux fréquences supérieures. | Serial multichannel stream on 75 Ω coax (BNC) or optical fibre; 56 then 64 channels at 48 kHz, fewer at higher rates. | verified-primary, verified-secondary |
| `aes50-device` | Équipement AES50 (AES50 device) | Équipement AES50 : liaison point à point bidirectionnelle sur câble Cat5e (Midas, Behringer, Klark Teknik). | Couche physique Ethernet 100 Mbit/s mais protocole non IP ; 48 canaux dans chaque sens à 48 kHz, horloge transportée dans le lien. | Uses a 100 Mbit/s Ethernet physical layer but not IP; 48 channels each way at 48 kHz with clock carried on the link. | verified-primary, verified-secondary |
| `format-converter` | Convertisseur de format / passerelle (Format converter / bridge) | Passerelle qui traduit un format numérique en un autre (MADI optique/coax, MADI↔Dante, AES3↔ADAT...). | Désérialise puis resérialise les échantillons, en gérant l'horloge et le nombre de canaux selon la fréquence d'échantillonnage. | De-serialises and re-serialises samples, handling clock and channel count versus sample rate. | verified-primary, verified-secondary |
| `network-switch` | Switch réseau AoIP (Network switch for AoIP) | Switch Ethernet adapté à l'audio sur IP (AoIP). | Switch géré, Gigabit, avec QoS (DSCP, priorité stricte) pour l'horloge PTP et l'audio, IGMP snooping pour le multicast, et économie d'énergie EEE désactivée. | Managed Gigabit switch with QoS (DSCP, strict priority) for PTP and audio, IGMP snooping for multicast, and Energy-Efficient Ethernet disabled. | verified-secondary |

### Attribut `transport_formats`

| Valeur | FR | EN |
|---|---|---|
| `dante` | Dante : AoIP propriétaire d'Audinate, couche 3 IP, synchronisation PTP ; mode compatible AES67. | Dante: Audinate's proprietary Layer-3 AoIP with PTP sync; AES67-compatible mode. |
| `aes67` | AES67 : norme AES d'interopérabilité AoIP (2013) ; PCM linéaire, PTPv2 (IEEE 1588-2008), RTP ; ne définit pas la découverte des appareils. | AES67: AES AoIP interoperability standard (2013); linear PCM, PTPv2 (IEEE 1588-2008), RTP; does not mandate discovery. |
| `avb-milan` | AVB/Milan : réseau IEEE 802.1 à bande passante réservée ; Milan garantit l'interopérabilité via certification Avnu. | AVB/Milan: IEEE 802.1 network with reserved bandwidth; Milan guarantees interoperability via Avnu certification. |
| `madi-aes10` | MADI (AES10) : jusqu'à 64 canaux point à point sur coaxial 75 Ω ou fibre. | MADI (AES10): up to 64 channels point-to-point on 75 Ω coax or fibre. |
| `aes50` | AES50 : 48 canaux bidirectionnels à 48 kHz sur Cat5e, couche physique Ethernet 100 Mbit/s. | AES50: 48 bidirectional channels at 48 kHz over Cat5e, 100 Mbit/s Ethernet physical layer. |
| `aes3-aes-ebu` | AES3 (AES/EBU) : 2 canaux, symétrique 110 Ω sur XLR (variante AES-3id sur BNC 75 Ω). | AES3 (AES/EBU): 2 channels, balanced 110 Ω on XLR (AES-3id variant on 75 Ω BNC). |
| `adat` | ADAT Lightpipe : 8 canaux à 44,1/48 kHz sur fibre TOSLINK ; même connecteur que le S/PDIF optique mais codage différent. | ADAT Lightpipe: 8 channels at 44.1/48 kHz on TOSLINK fibre; same connector as optical S/PDIF but a different encoding. |
| `spdif` | S/PDIF : version grand public de l'AES3, 2 canaux, RCA coaxial ou optique TOSLINK. | S/PDIF: consumer version of AES3, 2 channels, RCA coax or TOSLINK optical. |
| `ravenna` | RAVENNA : AoIP ouverte (ALC NetworX, désormais Lawo) basée sur PTPv2 et RTP, compatible AES67 et ST 2110. | RAVENNA: open AoIP (ALC NetworX, now Lawo) based on PTPv2 and RTP, AES67 and ST 2110 compatible. |
| `livewire-plus` | Livewire+ : AoIP de Telos/Axia pour la radio, compatible AES67, transporte aussi contrôle et GPIO. | Livewire+: Telos/Axia AoIP for radio, AES67 compatible, also carries control and GPIO. |
| `smpte-st-2110-30` | SMPTE ST 2110-30 : audio PCM des infrastructures broadcast IP, profil contraint d'AES67 (multicast, horloge SMPTE 2059-2). | SMPTE ST 2110-30: PCM audio in IP broadcast plants, a constrained AES67 profile (multicast, SMPTE 2059-2 timing). |

Sources :
- [Audio Engineering Society](https://aes.org/audio-topics/audio-networking-2/) — `verified-primary` — aes3-aes-ebu, madi-aes10, aes50, aes67
- [Audio Engineering Society](https://secure.aes.org/forum/standards/aes67/?ID=320) — `verified-primary` — aes67
- [Wikipedia](https://en.wikipedia.org/wiki/AES67) — `verified-secondary` — aes67, PTP
- [Audinate](https://dev.audinate.com/GA/dante-controller/userguide/pdf/latest/) — `verified-primary` — dante
- [Meyer Sound](https://docs.meyersound.com/products/en/user-guide---managingavbnetworks.html) — `verified-primary` — avb-milan
- [Wikipedia](https://en.wikipedia.org/wiki/MADI) — `verified-secondary` — madi-aes10
- [Wikipedia](https://en.wikipedia.org/wiki/AES50) — `verified-secondary` — aes50
- [Sound On Sound](https://www.soundonsound.com/techniques/expanding-your-audio-setup-adat) — `verified-secondary` — adat, spdif, aes3-aes-ebu
- [Wikipedia](https://en.wikipedia.org/wiki/ADAT_Lightpipe) — `verified-secondary` — adat
- [Wikipedia](https://en.wikipedia.org/wiki/Ravenna_(networking)) — `verified-secondary` — ravenna
- [RAVENNA / ALC NetworX](https://www.ravenna-network.com/partners/alc-networx/) — `verified-primary` — ravenna
- [Telos Alliance (Axia)](https://telosalliance.com/Livewire) — `verified-primary` — livewire-plus
- [SMPTE](https://pub.smpte.org/doc/st2110-30/20170918-pub/st2110-30-2017.pdf) — `verified-primary` — smpte-st-2110-30
- [AIMS Alliance (A. Hildebrand)](https://www.aimsalliance.org/wp-content/uploads/2018/11/The-Audio-Parts-of-SMPTE-ST-2110-Explained.pdf) — `verified-secondary` — smpte-st-2110-30

### Sources

- [Audio Engineering Society](https://aes.org/audio-topics/audio-networking-2/) — `verified-primary` — AES3, AES10, AES50, AES67 overview
- [Audinate](https://dev.audinate.com/GA/dante-controller/userguide/pdf/latest/) — `verified-primary` — PTP clock leader, latency
- [Wikipedia](https://en.wikipedia.org/wiki/AES67) — `verified-secondary` — PTP profile

Sources des sous-types (sub-type sources) :
  - `analog-multicore` [Shure (Audio Systems Guide for Video and Film Production)](https://content-files.shure.com/Pubs/audio-systems-guide-for-video-and-film-production/audio-systems-guide-for-video-and-film-production-english.pdf) — `verified-primary` — balanced lines
  - `analog-multicore` *unverified* — multicore description : aucune source ouverte (no source opened).
  - `digital-stagebox` [Wikipedia](https://en.wikipedia.org/wiki/AES50) — `verified-secondary` — AES50 stage box links
  - `digital-stagebox` [Audio Engineering Society](https://aes.org/audio-topics/audio-networking-2/) — `verified-primary` — transports
  - `dante-device` [Audinate](https://dev.audinate.com/GA/dante-controller/userguide/pdf/latest/) — `verified-primary` — PTP leader election, latency
  - `dante-device` [Audinate](https://go.audinate.com/hubfs/campaign/DDM/broadcast/audinate-dante-domain-manager-broadcast-aes67-smpte-2110-interoperability-wp.pdf) — `unverified` — Dante / AES67 / ST 2110 relationship (title only)
  - `avb-milan-device` [Meyer Sound](https://docs.meyersound.com/products/en/user-guide---managingavbnetworks.html) — `verified-primary` — Milan principle, certified switches
  - `avb-milan-device` [AV Network (trade press)](https://avnetwork.com/news/avnu-alliances-launches-milan-network-protocol) — `verified-secondary` — launch 2018, founding manufacturers
  - `madi-device` [Audio Engineering Society](https://aes.org/audio-topics/audio-networking-2/) — `verified-primary` — AES10 channel counts and media
  - `madi-device` [Wikipedia](https://en.wikipedia.org/wiki/MADI) — `verified-secondary` — history, coax and fibre
  - `aes50-device` [Wikipedia](https://en.wikipedia.org/wiki/AES50) — `verified-secondary` — principle, channel count, SuperMAC origin
  - `aes50-device` [Audio Engineering Society](https://aes.org/audio-topics/audio-networking-2/) — `verified-primary` — AES50-2011
  - `format-converter` [Pro Audio Design (retailer, SSL listing)](https://proaudiodesign.com/products/ssl-madi-opti-coax) — `verified-secondary` — MADI optical/coax conversion
  - `format-converter` [Focusrite](https://us.focusrite.com/ethernet-audio-interfaces/rednet-6) — `verified-primary` — channel count vs sample rate
  - `network-switch` [Sonifex](https://sonifex.co.uk/technical/faq/Incompatible_Network_Switches.shtml) — `verified-secondary` — EEE, IGMP snooping
  - `network-switch` [Clear-Com knowledge base](https://clear-com.atlassian.net/wiki/spaces/SF/pages/158787622/Matrix+What+type+of+Network+Switch+is+compatible+with+an+E-Dante+card) — `verified-secondary` — Gigabit for 32+ channels, QoS

<a id="interfaces-converters-clocks"></a>
## Interfaces audio, convertisseurs et horloges (Audio interfaces, converters & clocks)

`interfaces-converters-clocks`

**Rôle** : Appareils qui font le lien entre le monde analogique et l'ordinateur ou le réseau : interfaces audio, convertisseurs A/N et N/A, horloges de synchronisation.

*What it does:* Devices bridging the analog world and the computer or network: audio interfaces, A/D and D/A converters, synchronisation clocks.

**Principe** : Le convertisseur A/N échantillonne le signal à intervalles réguliers (fréquence d'échantillonnage) et quantifie chaque échantillon (résolution en bits). Tous les appareils numériques d'un système doivent suivre une seule horloge maître ; l'instabilité de cette horloge (gigue) dégrade la conversion.

*Principle:* An A/D converter samples the signal at regular intervals (sample rate) and quantises each sample (bit depth). All digital devices in a system must follow one master clock; clock instability (jitter) degrades conversion.

**Usages typiques (typical uses)** : enregistrement sur ordinateur (computer recording) ; conversion haut de gamme (high-end conversion) ; synchronisation de systèmes (system synchronisation)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `usb-thunderbolt-interface` | Interface audio USB / Thunderbolt (USB / Thunderbolt audio interface) | Interface audio reliée à l'ordinateur en USB ou Thunderbolt : préamplis, convertisseurs, sorties casque et écoutes. | Préampli → convertisseur A/N → bus informatique (pilote audio) ; retour N/A vers les écoutes. | Preamp → A/D → computer bus (audio driver); D/A back to monitors. | verified-primary |
| `network-interface` | Interface audio réseau (Network (AoIP) audio interface) | Interface audio qui échange les canaux avec l'ordinateur ou le système via un réseau AoIP (Dante, AVB, RAVENNA). | Les canaux transitent en paquets IP synchronisés par PTP ; carte réseau ou carte son virtuelle côté ordinateur. | Channels travel as PTP-synchronised IP packets; network card or virtual sound card on the computer side. | verified-primary |
| `ad-da-converter` | Convertisseur A/N – N/A (AD/DA converter) | Convertisseur dédié analogique→numérique et/ou numérique→analogique, sans préampli micro, à hautes performances. | Échantillonnage et quantification ; la qualité dépend de la plage dynamique, de la distorsion et de la stabilité d'horloge. | Sampling and quantisation; quality depends on dynamic range, distortion and clock stability. | unverified, verified-secondary |
| `pcie-dsp-system` | Système DAW PCIe / DSP (PCIe / DSP-based DAW system) | Système STAN avec cartes PCIe dotées de DSP qui exécutent les traitements à faible latence, indépendamment du processeur de l'ordinateur. | Le mixage et les plug-ins tournent sur les DSP de la carte ; l'ordinateur gère l'interface et le stockage. | Mixing and plug-ins run on the card's DSPs; the computer handles UI and storage. | unverified |
| `master-clock` | Horloge maître (word clock) (Master / word clock generator) | Générateur d'horloge (word clock) qui cadence tous les appareils numériques d'une installation. | Signal carré à la fréquence d'échantillonnage, distribué en coaxial 75 Ω (BNC) ; un seul maître, tous les autres esclaves. Une bonne horloge maître a peu de gigue mais ne garantit pas à elle seule un système sans gigue. | Square wave at the sample rate distributed over 75 Ω coax (BNC); one master, all others slaved. A good master has low jitter but does not by itself guarantee a jitter-free system. | verified-secondary |
| `timecode-sync` | Générateur de timecode / boîtier de synchro (Timecode generator / sync box) *proposé* | Petit boîtier qui génère du timecode SMPTE (LTC) et le distribue aux caméras et enregistreurs pour les synchroniser. | Code temporel heures:minutes:secondes:images (25 i/s en Europe) transmis comme signal audio (LTC) ; les boîtiers sont 'jammés' sur un maître puis tournent en roue libre. | Hours:minutes:seconds:frames code (25 fps in Europe) carried as an audio signal (LTC); boxes are jammed to a master then free-run. | verified-secondary |

### Sources

- [Sound On Sound](https://www.soundonsound.com/techniques/does-your-studio-need-digital-master-clock) — `verified-secondary` — single master clock, jitter at conversion
- [AudioTechnology magazine](https://audiotechnology.com/PDF/14/AT14_Word_Clock_Explained.pdf) — `verified-secondary` — word clock signal
- [Samson Technologies](https://samsontech.com/blog/whats-in-the-box-understanding-usb-audio-devices) — `verified-primary` — USB audio device architecture
- *unverified* — sampling and quantisation description : aucune source ouverte (no source opened).

Sources des sous-types (sub-type sources) :
  - `usb-thunderbolt-interface` [Samson Technologies](https://samsontech.com/blog/whats-in-the-box-understanding-usb-audio-devices) — `verified-primary` — USB audio chain
  - `network-interface` [Audinate](https://dev.audinate.com/GA/dante-controller/userguide/pdf/latest/) — `verified-primary` — PTP, latency
  - `network-interface` [Focusrite](https://us.focusrite.com/ethernet-audio-interfaces/rednet-6) — `verified-primary` — example network interface
  - `ad-da-converter` [Sound On Sound](https://www.soundonsound.com/techniques/does-your-studio-need-digital-master-clock) — `verified-secondary` — jitter at A/D and D/A
  - `ad-da-converter` *unverified* — converter description : aucune source ouverte (no source opened).
  - `pcie-dsp-system` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `master-clock` [Sound On Sound](https://www.soundonsound.com/techniques/does-your-studio-need-digital-master-clock) — `verified-secondary` — single master, jitter
  - `master-clock` [AudioTechnology magazine](https://audiotechnology.com/PDF/14/AT14_Word_Clock_Explained.pdf) — `verified-secondary` — square wave on 75 Ω BNC
  - `timecode-sync` [Production Expert](https://www.production-expert.com/home-page/2016/12/6/timecode-101-part-1) — `verified-secondary` — LTC, sync boxes
  - `timecode-sync` [Ableton (help centre)](https://help.ableton.com/hc/en-us/articles/360010120320) — `verified-secondary` — SMPTE frame rates
  - `timecode-sync` [Videocraft (retailer, Sound Devices listing)](https://www.videocraft.com.au/sound-devices-mixpre-3-ii-32-bit-5-track-field-audio-recorder) — `verified-secondary` — jam-sync, free run

<a id="processors-outboard"></a>
## Préamplis, traitements et périphériques (Preamps, processors & outboard)

`processors-outboard`

**Rôle** : Appareils qui amplifient le signal micro ou modifient le timbre, la dynamique ou l'espace : préamplis, égaliseurs, compresseurs, portes de bruit, effets.

*What it does:* Devices that amplify mic signals or shape tone, dynamics or space: preamps, equalisers, compressors, gates, effects.

**Principe** : Selon le traitement : gain (préampli), filtrage en fréquence (égaliseur), variation de gain commandée par le niveau du signal (compresseur, porte), ou retards et réflexions artificielles (réverbération, délai).

*Principle:* Depending on the process: gain (preamp), frequency filtering (EQ), gain changes driven by signal level (compressor, gate), or delays and artificial reflections (reverb, delay).

**Usages typiques (typical uses)** : studio (studio) ; live (live) ; broadcast (broadcast) ; conférence (conferences)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `mic-preamp` | Préampli micro (Microphone preamp) | Amplificateur qui élève le niveau micro (quelques µV à mV) au niveau ligne. | Gain réglable typiquement jusqu'à 60-70 dB ; fournit souvent l'alimentation fantôme ; le bruit propre et la marge déterminent sa qualité. | Adjustable gain typically up to 60-70 dB; often supplies phantom power; self-noise and headroom define its quality. | verified-primary, verified-secondary |
| `channel-strip` | Tranche de console (channel strip) (Channel strip) | Appareil regroupant préampli, égaliseur et compresseur, comme une tranche de console. | Enchaînement en série des traitements de la tranche. | Series chain of channel processes. | unverified |
| `compressor-limiter` | Compresseur / limiteur (Compressor / limiter) | Réduit automatiquement le gain quand le signal dépasse un seuil ; le limiteur est un compresseur à taux très élevé. | Un détecteur de niveau pilote un élément à gain variable (VCA, FET, cellule optique ou lampe 'vari-mu'). Paramètres : seuil, taux (ex. 5:1 = +1 dB en sortie pour +5 dB au-dessus du seuil), attaque, relâchement, genou. | A level detector drives a variable-gain element (VCA, FET, optical cell or vari-mu tube). Controls: threshold, ratio (5:1 = 1 dB out per 5 dB over threshold), attack, release, knee. | verified-primary, verified-secondary |
| `equalizer` | Égaliseur (paramétrique / graphique) (Equalizer (parametric / graphic)) | Modifie le niveau de certaines bandes de fréquences : paramétrique (fréquence, gain, largeur Q réglables) ou graphique (bandes fixes au 1/3 d'octave par exemple). | Réseaux de filtres (passe-haut, plateau, cloche) ; le Q règle l'étroitesse de la cloche. Le graphique se place souvent sur les sorties pour corriger le système ou traiter le larsen. | Filter networks (high-pass, shelf, bell); Q sets the bell's width. Graphic EQs often sit on outputs to correct the system or tame feedback. | verified-primary |
| `gate-expander` | Noise gate / expandeur (Gate / expander) | Atténue le signal quand il passe sous un seuil (porte de bruit) ou augmente l'écart de dynamique sous le seuil (expandeur). | Détection de niveau inverse du compresseur ; paramètres seuil, profondeur (range), maintien (hold), hystérésis pour éviter le battement. | Level detection, the reverse of a compressor; controls threshold, range, hold and hysteresis to prevent chatter. | verified-secondary |
| `effects-reverb` | Réverbération / délai / effets (Reverb / delay / effects) | Crée de l'espace ou des effets temporels : réverbération, délai, chorus, etc. | Réverbération algorithmique (réseaux de retards, filtres, boucles de réinjection) ou à convolution (réponse impulsionnelle enregistrée dans un lieu réel). | Algorithmic reverb (networks of delays, filters and feedback loops) or convolution (an impulse response recorded in a real space). | verified-secondary |
| `feedback-suppressor` | Anti-larsen / automixeur (Feedback suppressor / automixer) | Anti-larsen (filtres coupe-bande automatiques) ou automixeur qui ouvre seulement les micros utilisés. | L'automixeur réduit le gain global à mesure que le nombre de micros ouverts (NOM) augmente (environ 10·log(NOM)), ce qui préserve la marge avant larsen. L'anti-larsen détecte une fréquence qui s'emballe et place un filtre étroit dessus. | An automixer lowers overall gain as the number of open mics (NOM) rises (about 10·log NOM), preserving feedback margin. A feedback suppressor detects a ringing frequency and places a narrow notch on it. | unverified, verified-primary, verified-secondary |

### Sources

- [Sound On Sound](https://www.soundonsound.com/sound-advice/q-how-does-compressor-work) — `verified-secondary` — compressor
- [Rane (legacy note)](https://www.ranecommercial.com/legacy/note101.html) — `verified-primary` — equaliser types
- [Sound On Sound](https://www.soundonsound.com/techniques/using-your-daws-gates-expanders) — `verified-secondary` — gate/expander

Sources des sous-types (sub-type sources) :
  - `mic-preamp` [Wikipedia](https://en.wikipedia.org/wiki/Microphone_preamplifier) — `verified-secondary` — gain range, mic to line
  - `mic-preamp` [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/know-the-basics-about-phantom-power) — `verified-primary` — phantom power
  - `channel-strip` *unverified* — description : aucune source ouverte (no source opened).
  - `compressor-limiter` [Sound On Sound](https://www.soundonsound.com/sound-advice/q-how-does-compressor-work) — `verified-secondary` — gain reduction principle
  - `compressor-limiter` [QSC](https://support.qsc.com/en_US/sound-advice/sound-advice-%7C-compression-explained) — `verified-primary` — threshold, ratio, attack, release, knee
  - `compressor-limiter` [iZotope](https://www.izotope.com/en/learn/4-types-of-analog-compression-and-why-they-matter-in-a-digital-world.html) — `verified-primary` — VCA, FET, optical, vari-mu
  - `equalizer` [Rane (legacy note)](https://www.ranecommercial.com/legacy/note101.html) — `verified-primary` — graphic vs parametric, ISO bands
  - `equalizer` [Yamaha Pro Audio](https://usa.yamaha.com/products/contents/proaudio/musicianspa/effects/equlizer.html) — `verified-primary` — usage on mixers and outputs
  - `gate-expander` [Sound On Sound](https://www.soundonsound.com/techniques/using-your-daws-gates-expanders) — `verified-secondary` — hysteresis, hold, range, gate vs expander
  - `effects-reverb` [Whipped Cream Sounds (blog)](https://www.whippedcreamsounds.com/algorithmic-reverb-vs-convolution/) — `verified-secondary` — algorithmic vs convolution
  - `feedback-suppressor` [Shure](https://www.shure.com/en-US/insights/automatic-microphone-mixers-when-your-need-them) — `verified-primary` — NOM attenuation
  - `feedback-suppressor` [Shure](https://shure.com/en-us/insights/why-use-shure-automatic-mixers) — `verified-primary` — feedback margin
  - `feedback-suppressor` [Yamaha / Dugan white paper (hosted by Bax-shop)](https://www.bax-shop.be/downloads/products/9000-0008-3692/yamaha_dugan-my16_automixer_interface_kaart_white_paper.pdf) — `verified-secondary` — 10·log(NOM), gain sharing
  - `feedback-suppressor` *unverified* — notch-filter feedback suppressor detail : aucune source ouverte (no source opened).

<a id="di-splitters"></a>
## Boîtes de direct (DI) et splitters (DI boxes & splitters)

`di-splitters`

**Rôle** : Boîtiers d'adaptation : la DI convertit un signal d'instrument haute impédance asymétrique en signal micro basse impédance symétrique ; le splitter duplique un micro vers plusieurs consoles.

*What it does:* Interfacing boxes: a DI converts a high-impedance unbalanced instrument signal into a low-impedance balanced mic-level signal; a splitter feeds one mic to several consoles.

**Principe** : Adaptation d'impédance et symétrisation, soit par transformateur (passif, isolation galvanique qui coupe les boucles de masse), soit par électronique (actif, alimenté).

*Principle:* Impedance matching and balancing, either by transformer (passive, galvanic isolation that breaks ground loops) or by electronics (active, powered).

**Usages typiques (typical uses)** : basse, clavier, guitare acoustique en direct (bass, keys, acoustic guitar direct) ; partage façade/retours/enregistrement (FOH/monitor/recording split)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `di-passive` | DI passive (Passive DI box) | DI à transformateur, sans alimentation. | Le transformateur abaisse l'impédance, symétrise et isole galvaniquement (bloque le continu), ce qui supprime les ronflements de boucle de masse. | The transformer lowers impedance, balances and galvanically isolates (blocks DC), removing ground-loop hum. | verified-primary |
| `di-active` | DI active (Active DI box) | DI électronique alimentée (pile, fantôme 48 V ou secteur). | Un étage tampon à haute impédance d'entrée charge peu les micros piézo et les micros de guitare passifs ; risque de saturation si l'entrée dépasse la marge. | A high-input-impedance buffer barely loads piezo and passive guitar pickups; can clip if input exceeds headroom. | verified-primary |
| `mic-splitter` | Splitter micro (passif / actif) (Microphone splitter (passive / active)) | Duplique chaque micro vers plusieurs destinations (façade, retours, enregistrement, car régie). | Sortie directe (qui laisse passer le fantôme) + sorties isolées par transformateur avec levée de masse ; le splitter actif utilise des amplis tampons. | Direct output (passes phantom) plus transformer-isolated outputs with ground lift; active splitters use buffer amplifiers. | unverified, verified-secondary |
| `isolation-reamp` | Isolateur de ligne / re-amp (Line isolator / re-amp) | Isolateur de ligne (supprime les boucles de masse) ou boîtier de re-amp (renvoie une piste enregistrée vers un ampli guitare). | Le re-amp convertit un signal ligne symétrique basse impédance en signal instrument asymétrique haute impédance, avec forte atténuation (souvent par transformateur). Ce n'est pas simplement une DI à l'envers. | A re-amp converts low-impedance balanced line level into high-impedance unbalanced instrument level with large attenuation (often by transformer). It is not simply a DI in reverse. | verified-secondary |

### Sources

- [Radial Engineering](https://www.radialeng.com/comparing-direct-boxes) — `verified-primary` — active vs passive DI
- [Radial Engineering](https://www.radialeng.com/di-questions) — `verified-primary` — DI purpose

Sources des sous-types (sub-type sources) :
  - `di-passive` [Radial Engineering](https://www.radialeng.com/comparing-direct-boxes) — `verified-primary` — transformer principle, ground loop isolation
  - `di-active` [Radial Engineering](https://www.radialeng.com/comparing-direct-boxes) — `verified-primary` — active circuit, headroom
  - `mic-splitter` [ProSoundWeb](https://www.prosoundweb.com/radial-introduces-proms2-single-channel-mic-splitter/) — `verified-secondary` — direct + isolated outputs, ground lift
  - `mic-splitter` *unverified* — active splitter : aucune source ouverte (no source opened).
  - `isolation-reamp` [ProSoundWeb](https://www.prosoundweb.com/in-the-studio-understanding-applying-reamping/) — `verified-secondary` — re-amp principle
  - `isolation-reamp` [DIY Recording Equipment](https://www.diyrecordingequipment.com/blogs/news/15851828-exactly-how-the-line2amp-reamping-box-works-and-why) — `verified-secondary` — transformer turns ratio

<a id="loudspeakers"></a>
## Enceintes de sonorisation (Loudspeakers (sound reinforcement))

`loudspeakers`

**Rôle** : Transducteurs qui convertissent le signal électrique amplifié en son pour le public ou les artistes.

*What it does:* Transducers converting amplified electrical signals into sound for an audience or performers.

**Principe** : Un moteur électrodynamique (bobine dans un aimant, solidaire d'un cône ou d'une membrane de compression) déplace l'air. Plusieurs haut-parleurs couvrent chacun une bande de fréquences via un filtre. Une source ponctuelle perd environ 6 dB par doublement de distance ; un line array bien couplé tend vers 3 dB dans son champ proche, selon la fréquence et la longueur de la ligne.

*Principle:* An electrodynamic motor (voice coil in a magnet driving a cone or compression diaphragm) moves air. Several drivers each cover a band via a crossover. A point source loses about 6 dB per doubling of distance; a well-coupled line array approaches 3 dB in its near field, depending on frequency and line length.

**Usages typiques (typical uses)** : concerts (concerts) ; théâtre (theatre) ; conférences (conferences) ; installations fixes (installed sound)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `passive` | Enceinte passive (Passive loudspeaker) | Enceinte sans amplificateur intégré, alimentée par un ampli externe via câble HP. | Filtre passif interne (ou bi-amplification externe) ; impédance nominale (4, 8 Ω) à respecter vis-à-vis de l'ampli. | Internal passive crossover (or external bi-amping); nominal impedance (4 or 8 Ω) must suit the amplifier. | unverified |
| `active-powered` | Enceinte active / amplifiée (Active / powered loudspeaker) | Enceinte amplifiée avec électronique intégrée (ampli, filtrage DSP, protections). | Reçoit un signal ligne ; le DSP interne gère filtrage, égalisation et limiteurs adaptés aux haut-parleurs. | Takes a line-level signal; internal DSP handles crossover, EQ and limiters matched to the drivers. | unverified, verified-secondary |
| `line-array` | Système line array (Line array) | Ensemble de modules empilés verticalement qui se comportent comme une source unique, avec une directivité verticale contrôlée. | Couplage des sources : les éléments doivent être plus proches qu'environ une demi-longueur d'onde et la surface rayonnante couvrir plus de 80 % de la hauteur (critères WST de L-Acoustics). Les angles entre modules répartissent l'énergie sur le public. | Source coupling: elements must be closer than about half a wavelength and radiating area must fill over 80% of the height (L-Acoustics WST criteria). Inter-cabinet angles spread energy over the audience. | verified-primary, verified-secondary |
| `point-source` | Source ponctuelle (Point source) | Enceinte unique (ou multivoies coaxiale) rayonnant comme d'un point, avec un pavillon de dispersion fixe (ex. 90°×60°). | Décroissance sphérique d'environ 6 dB par doublement de distance. | Spherical spreading, about 6 dB loss per doubling of distance. | verified-secondary |
| `subwoofer` | Caisson de basses (sub) (Subwoofer) | Enceinte dédiée aux basses fréquences (environ < 100 Hz). | Les grandes longueurs d'onde rendent un sub presque omnidirectionnel ; on obtient de la directivité en combinant plusieurs subs avec retards et polarités (configuration cardioïde : rejet arrière, au prix d'une perte de niveau avant). | Long wavelengths make a single sub nearly omnidirectional; directivity comes from combining subs with delay and polarity (cardioid arrays reject the rear at some cost in front level). | verified-primary, verified-secondary |
| `stage-monitor-wedge` | Retour de scène (wedge) (Stage monitor / wedge) | Retour de scène posé au sol (forme en biseau) qui renvoie un mixage vers l'artiste. | Enceinte coaxiale ou 2 voies orientée vers l'artiste ; placée dans la zone de moindre sensibilité du micro pour limiter le larsen. | Coaxial or 2-way cabinet aimed at the performer; placed in the mic's null to limit feedback. | unverified, verified-primary |
| `column` | Enceinte colonne (Column loudspeaker) | Enceinte colonne : haut-parleurs alignés verticalement, dispersion verticale étroite ; versions orientables par DSP. | Ligne de haut-parleurs ; en retardant chaque haut-parleur on incline le faisceau vers le public et on évite plafonds et sols réfléchissants, ce qui améliore l'intelligibilité dans les lieux réverbérants. | A line of drivers; delaying each driver tilts the beam toward the audience and away from reflective ceilings and floors, improving intelligibility in reverberant spaces. | verified-primary, verified-secondary |

### Sources

- [AudioTechnology magazine](https://www.audiotechnology.com/PDF/11/AT11_Line_Arrays_Explained.pdf) — `verified-secondary` — 6 dB vs 3 dB per doubling, finite lines
- [L-Acoustics](https://www.l-acoustics.com/wp-content/uploads/2026/06/Wavefront_Sculpture_Technology_convention.pdf) — `verified-primary` — coupling criteria
- [ProSoundWeb / Live Sound](https://www.prosoundweb.com/tech-topic-hyped-or-not/) — `verified-secondary` — limits of cylindrical-wave explanation

Sources des sous-types (sub-type sources) :
  - `passive` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `active-powered` [Procom (distributor listing)](https://www.procom-me.com/product/dsp-23-loudspeaker-system-management-processor/) — `verified-secondary` — crossover/EQ/limiter/delay functions
  - `active-powered` *unverified* — integrated amplifier description : aucune source ouverte (no source opened).
  - `line-array` [L-Acoustics](https://www.l-acoustics.com/wp-content/uploads/2026/06/Wavefront_Sculpture_Technology_convention.pdf) — `verified-primary` — coupling criteria
  - `line-array` [AudioTechnology magazine](https://www.audiotechnology.com/PDF/11/AT11_Line_Arrays_Explained.pdf) — `verified-secondary` — cylindrical wave behaviour
  - `point-source` [AudioTechnology magazine](https://www.audiotechnology.com/PDF/11/AT11_Line_Arrays_Explained.pdf) — `verified-secondary` — point source 6 dB per doubling
  - `subwoofer` [L-Acoustics](https://l-acoustics.com/documentation/GLOBAL/EN/Subwoofer%20Configuration%20TB/Cardioid_configurations_TB_EN.pdf) — `verified-primary` — cardioid configuration, wall distance
  - `subwoofer` [Precision Audio Services (blog)](https://www.precisionaudioservices.com/blog/understanding-2-element-cardioid-subwooferarrays) — `verified-secondary` — quarter-wavelength spacing and delay
  - `stage-monitor-wedge` [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/technology/how-to-read-microphone-specifications/) — `verified-primary` — polar nulls (rear rejection)
  - `stage-monitor-wedge` *unverified* — wedge description : aucune source ouverte (no source opened).
  - `column` [QSC (blog)](https://blogs.qsc.com/live-sound/?p=3298) — `verified-primary` — history and applications
  - `column` [Acoustical Society of America](https://acoustics.org/1paa6-listening-for-solutions-to-a-speech-intelligibility-problem-anthony-hoover-fasa/) — `verified-secondary` — speech intelligibility in reverberant spaces

<a id="studio-monitors"></a>
## Écoutes de studio et contrôle d'écoute (Studio monitors & monitor control)

`studio-monitors`

**Rôle** : Enceintes d'écoute de studio conçues pour une reproduction neutre, et contrôleurs qui gèrent sources, enceintes et niveau d'écoute.

*What it does:* Studio loudspeakers designed for neutral reproduction, plus controllers managing sources, speakers and listening level.

**Principe** : Réponse en fréquence plate et bonne dispersion, souvent actives (bi- ou tri-amplifiées). Le choix dépend de la distance d'écoute et du niveau requis ; la pièce (réflexions précoces, temps de réverbération) influe autant que l'enceinte.

*Principle:* Flat frequency response and controlled dispersion, usually active (bi- or tri-amped). Choice depends on listening distance and required level; the room (early reflections, reverberation time) matters as much as the speaker.

**Usages typiques (typical uses)** : mixage (mixing) ; mastering (mastering) ; post-production (post-production)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `nearfield` | Écoute de proximité (near-field) (Near-field monitor) | Petite écoute placée à environ 1 à 2 m, en triangle équilatéral avec l'auditeur. | Le son direct domine le son réfléchi de la pièce à courte distance. | At short distance direct sound dominates room reflections. | unverified, verified-primary |
| `midfield` | Écoute mid-field (Mid-field monitor) | Écoute plus grande pour des distances intermédiaires, avec davantage de niveau et de grave. | Plus grands haut-parleurs et amplification plus puissante. | Bigger drivers and more amplifier power. | verified-primary |
| `farfield-main` | Écoute principale (far-field) (Far-field / main monitor) | Écoute principale encastrée ou de grande taille pour régies importantes. | Fort niveau à grande distance ; souvent intégrée à la conception acoustique de la pièce. | High level at long distance; often integrated into the room's acoustic design. | verified-primary |
| `studio-subwoofer` | Caisson de studio (Studio subwoofer) | Caisson qui étend la réponse grave des écoutes ou reproduit le canal LFE. | Filtrage (bass management) qui envoie le grave au caisson. | Bass management filters route low frequencies to the sub. | unverified |
| `monitor-controller` | Contrôleur d'écoute (Monitor controller) | Contrôleur d'écoute : sélection de sources et d'enceintes, volume, mono, dim, talkback, départs casques. | Commutation et atténuation de haute qualité entre la sortie de la STAN/console et les écoutes. | High-quality switching and attenuation between DAW/console output and monitors. | verified-secondary |

### Sources

- [Genelec](https://www.genelec.com/correct-monitors) — `verified-primary` — select by listening distance and SPL
- [ITU-R](https://itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1116-3-201502-I!!TOC-HTM-E.htm) — `verified-primary` — reference listening conditions
- [EBU](https://tech-qual.ebu.ch/publications/tech3276) — `verified-primary` — control room listening conditions

Sources des sous-types (sub-type sources) :
  - `nearfield` [Genelec](https://www.genelec.com/correct-monitors) — `verified-primary` — listening distance
  - `nearfield` *unverified* — triangle placement : aucune source ouverte (no source opened).
  - `midfield` [Genelec](https://www.genelec.com/correct-monitors) — `verified-primary` — distance-based selection
  - `farfield-main` [Genelec](https://www.genelec.com/correct-monitors) — `verified-primary` — distance-based selection
  - `studio-subwoofer` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `monitor-controller` [Sound On Sound](https://www.soundonsound.com/reviews/high-end-monitor-controllers) — `verified-secondary` — functions

<a id="amplifiers-processors"></a>
## Amplificateurs et gestion de diffusion (Amplifiers & loudspeaker management)

`amplifiers-processors`

**Rôle** : Amplificateurs de puissance qui fournissent l'énergie aux enceintes passives, et processeurs qui gèrent filtrage, alignement et protection du système.

*What it does:* Power amplifiers supplying energy to passive loudspeakers, and processors managing crossover, alignment and protection.

**Principe** : L'ampli élève un signal ligne à une tension et un courant capables de déplacer les haut-parleurs ; la classe désigne le fonctionnement de l'étage de sortie (A, AB linéaires ; D à commutation). Le processeur applique filtres, égalisation, retards et limiteurs par voie.

*Principle:* The amplifier raises a line signal to the voltage and current needed to drive speakers; its class describes the output stage (A, AB linear; D switching). The processor applies crossover, EQ, delay and limiting per output.

**Usages typiques (typical uses)** : sonorisation (sound reinforcement) ; installations (installations)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `class-ab` | Ampli de puissance classe AB (Class AB power amplifier) | Ampli linéaire classe AB : les deux transistors de sortie conduisent un peu au passage à zéro. | Polarisation légère qui supprime la distorsion de croisement de la classe B ; rendement typique autour de 50 % (dissipation en chaleur importante). | Light bias removes class B crossover distortion; typical efficiency around 50% (significant heat). | verified-secondary |
| `class-d` | Ampli de puissance classe D (Class D power amplifier) | Ampli à découpage : léger et à haut rendement, standard actuel de la sonorisation. | Le signal audio est converti en impulsions de largeur variable (PWM) qui commutent les transistors entièrement ouverts ou fermés à haute fréquence (100 kHz à 1 MHz) ; un filtre passe-bas restitue l'audio. Peu de pertes : rendement pratique proche de 90 %. | Audio is converted into pulse-width modulation (PWM) that switches the transistors fully on or off at high frequency (100 kHz-1 MHz); a low-pass filter recovers the audio. Low losses: practical efficiency near 90%. | verified-secondary |
| `class-a` | Amplificateur classe A (Class A amplifier) | Ampli classe A : le transistor conduit en permanence, très linéaire mais très peu efficace. | Courant de repos permanent ; rendement théorique maximal 25 % (50 % avec couplage par transformateur). Utilisé surtout pour préamplis, amplis casque et hi-fi. | Constant standing current; theoretical maximum efficiency 25% (50% transformer-coupled). Mostly used in preamps, headphone amps and hi-fi. | verified-secondary |
| `dsp-amplifier` | Ampli DSP / contrôleur amplifié (DSP amplifier / amplified controller) | Ampli intégrant un processeur DSP (filtres, presets d'enceintes, limiteurs) et souvent une entrée réseau. | Classe D + DSP : le constructeur fournit des réglages par modèle d'enceinte ; contrôle à distance. | Class D plus DSP: manufacturer presets per speaker model; remote control. | unverified, verified-secondary |
| `loudspeaker-processor` | Processeur / contrôleur de diffusion (Loudspeaker processor / system controller) | Processeur/contrôleur de diffusion : filtrage multivoie, égalisation, retards, limiteurs, matrice. | Filtres programmables par sortie (Linkwitz-Riley, Butterworth...), retards pour aligner voies et enceintes, limiteurs réglés selon ampli et haut-parleurs. | Programmable per-output filters (Linkwitz-Riley, Butterworth, etc.), delays to align drivers and cabinets, limiters set to match amp and speaker. | verified-primary, verified-secondary |

### Sources

- [Learnabout Electronics](https://learnabout-electronics.org/Amplifiers/amplifiers56.php) — `verified-secondary` — class AB
- [Elliott Sound Products](https://sound-au.com/articles/pwm.htm) — `verified-secondary` — class D PWM
- [Procom (distributor listing)](https://www.procom-me.com/product/dsp-23-loudspeaker-system-management-processor/) — `verified-secondary` — processor functions

Sources des sous-types (sub-type sources) :
  - `class-ab` [Learnabout Electronics](https://learnabout-electronics.org/Amplifiers/amplifiers56.php) — `verified-secondary` — conduction near crossover, efficiency
  - `class-ab` [Wikipedia (Power amplifier classes)](https://www.wikipedia.org/wiki/Class_AB) — `verified-secondary` — conduction angle
  - `class-d` [Elliott Sound Products](https://sound-au.com/articles/pwm.htm) — `verified-secondary` — PWM switching, switching frequency
  - `class-d` [Digi-Key (technical article)](https://www.digikey.com/en/articles/simplify-portable-low-power-audio-circuit-design-class-d-amplifiers) — `verified-secondary` — efficiency, losses
  - `class-a` [Wikipedia (Power amplifier classes)](https://www.wikipedia.org/wiki/Class_AB) — `verified-secondary` — efficiency, standing current
  - `dsp-amplifier` [Procom (distributor listing)](https://www.procom-me.com/product/dsp-23-loudspeaker-system-management-processor/) — `verified-secondary` — DSP functions
  - `dsp-amplifier` *unverified* — integrated amplifier : aucune source ouverte (no source opened).
  - `loudspeaker-processor` [Procom (distributor listing)](https://www.procom-me.com/product/dsp-23-loudspeaker-system-management-processor/) — `verified-secondary` — functions
  - `loudspeaker-processor` [Dolby](https://professional.dolby.com/siteassets/products/sls-audio-products/sls-cs1090-cinema-surround-speaker-system/cs1090-processor-settings-180730---r1.1-1.pdf) — `verified-primary` — limiter setup

<a id="headphones-iem"></a>
## Casques et écouteurs intra-auriculaires (Headphones & in-ear monitors)

`headphones-iem`

**Rôle** : Transducteurs portés sur ou dans l'oreille pour l'écoute de contrôle, le retour des artistes ou la communication.

*What it does:* Transducers worn on or in the ear for monitoring, performer foldback or communication.

**Principe** : Petit haut-parleur (dynamique, ou armature équilibrée pour les intra-auriculaires) couplé à l'oreille ; la conception ouverte ou fermée règle le compromis entre isolation et naturel.

*Principle:* A small driver (dynamic, or balanced armature in in-ears) coupled to the ear; open or closed design sets the trade-off between isolation and naturalness.

**Usages typiques (typical uses)** : prise de son (recording) ; tournage (location sound) ; retours artistes (performer monitoring) ; radio (radio)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `closed-back` | Casque fermé (Closed-back headphones) | Casque fermé : coques étanches, bonne isolation, peu de fuite vers le micro. | Le volume clos isole des bruits extérieurs et empêche le son de sortir ; grave souvent plus présent. | The sealed volume isolates from outside noise and keeps sound in; bass often stronger. | verified-secondary |
| `open-back` | Casque ouvert (Open-back headphones) | Casque ouvert : son plus aéré et naturel, aucune isolation. | Coques ouvertes : moins de réflexions internes, scène sonore plus large, mais fuite dans les deux sens. | Open cups: fewer internal reflections and wider soundstage, but leakage both ways. | verified-secondary |
| `broadcast-headset` | Micro-casque broadcast (Broadcast headset (with mic)) | Micro-casque pour commentateurs, intercom ou radio. | Casque (souvent fermé) + micro à proximité de la bouche, distance constante. | Headphones (often closed) plus a close boom mic at constant distance. | unverified |
| `in-ear-monitor` | Écouteurs intra (ear monitors) (In-ear monitor earphones) | Écouteurs intra-auriculaires (universels ou moulés) pour les retours de scène. | Embouts qui obturent le conduit auditif : isolation passive, niveau d'écoute réduit possible ; limiteur conseillé côté récepteur. | Tips seal the ear canal: passive isolation and lower listening levels possible; limiter recommended at the receiver. | unverified, verified-secondary |
| `headphone-amplifier` | Ampli casque / distribution (Headphone amplifier / distribution) | Ampli et distributeur casque : alimente plusieurs casques depuis une source. | Amplificateurs à faible impédance de sortie, un réglage de niveau par sortie. | Low-output-impedance amplifiers with level control per output. | unverified |

### Sources

- [RTINGS](https://www.rtings.com/headphones/learn/open-vs-closed-back) — `verified-secondary` — open vs closed
- [Gear4music (retailer guide)](https://www.gear4music.com/blog/shure-in-ear-monitor-guide) — `verified-secondary` — in-ear monitoring

Sources des sous-types (sub-type sources) :
  - `closed-back` [RTINGS](https://www.rtings.com/headphones/learn/open-vs-closed-back) — `verified-secondary` — isolation, leakage
  - `open-back` [RTINGS](https://www.rtings.com/headphones/learn/open-vs-closed-back) — `verified-secondary` — soundstage, leakage
  - `broadcast-headset` *unverified* — description : aucune source ouverte (no source opened).
  - `in-ear-monitor` [Gear4music (retailer guide)](https://www.gear4music.com/blog/shure-in-ear-monitor-guide) — `verified-secondary` — peak limiter importance
  - `in-ear-monitor` *unverified* — seal and driver types : aucune source ouverte (no source opened).
  - `headphone-amplifier` *unverified* — description, principle : aucune source ouverte (no source opened).

<a id="recorders-playback"></a>
## Enregistreurs et lecture (Recorders & playback)

`recorders-playback`

**Rôle** : Appareils qui enregistrent ou rediffusent du son de façon autonome, hors ordinateur ou en complément.

*What it does:* Devices that record or play back audio standalone, without or alongside a computer.

**Principe** : Conversion A/N et écriture de fichiers (WAV/BWF polyphoniques) sur carte mémoire ou disque ; synchronisation par timecode SMPTE (LTC) pour le tournage.

*Principle:* A/D conversion and file writing (polyphonic WAV/BWF) to cards or drives; SMPTE timecode (LTC) sync for film work.

**Usages typiques (typical uses)** : tournage (location sound) ; reportage (reporting) ; radio (radio) ; spectacle (theatre playback)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `field-recorder` | Enregistreur de terrain (tournage) (Professional field / location recorder) | Enregistreur-mélangeur professionnel de tournage avec timecode intégré. | Préamplis + conversion (parfois 32 bits flottants) + générateur de timecode précis pour caler le son sur l'image. | Preamps + conversion (sometimes 32-bit float) + accurate timecode generator to sync sound with picture. | verified-secondary |
| `handheld-recorder` | Enregistreur portable de poche (Handheld recorder) | Enregistreur de poche à micros intégrés. | Couple stéréo intégré + conversion et carte SD. | Built-in stereo pair + conversion and SD card. | unverified |
| `multitrack-recorder` | Enregistreur multipiste (Multitrack recorder) | Enregistreur multipiste autonome (concerts, sauvegarde). | Reçoit de nombreux canaux (MADI, Dante, analogique) et les écrit en fichiers séparés. | Receives many channels (MADI, Dante, analog) and writes separate files. | unverified |
| `playout-system` | Système de diffusion (playout) (Playout / automation system) | Système d'automation radio : programmation et diffusion des musiques, jingles, publicités. | Logiciel qui génère un conducteur à partir de grilles horaires et de règles, puis le diffuse en mode automatique ou assisté. | Software that builds a log from hourly clocks and rules, then plays it in automatic or live-assist mode. | verified-primary |
| `playback-device` | Lecteur de diffusion (spectacle / cart) (Show playback / cart player) | Lecteur pour le spectacle ou l'antenne : déclenchement d'effets et de musiques (cartouches, cues). | Lecture instantanée de fichiers sur commande. | Instant playback of files on command. | unverified |

### Sources

- [Videocraft (retailer, Sound Devices listing)](https://www.videocraft.com.au/sound-devices-mixpre-3-ii-32-bit-5-track-field-audio-recorder) — `verified-secondary` — 32-bit float, internal timecode
- [Production Expert](https://www.production-expert.com/home-page/2016/12/6/timecode-101-part-1) — `verified-secondary` — LTC
- [PlayIt Software](https://docs.playitsoftware.com/PlayItLive/218/introduction/what-is-playit-live/) — `verified-primary` — playout

Sources des sous-types (sub-type sources) :
  - `field-recorder` [Videocraft (retailer, Sound Devices listing)](https://www.videocraft.com.au/sound-devices-mixpre-3-ii-32-bit-5-track-field-audio-recorder) — `verified-secondary` — 32-bit float, timecode accuracy
  - `field-recorder` [Production Expert](https://www.production-expert.com/home-page/2016/12/6/timecode-101-part-1) — `verified-secondary` — LTC sync
  - `handheld-recorder` *unverified* — description : aucune source ouverte (no source opened).
  - `multitrack-recorder` *unverified* — description : aucune source ouverte (no source opened).
  - `playout-system` [PlayIt Software](https://docs.playitsoftware.com/PlayItLive/218/introduction/what-is-playit-live/) — `verified-primary` — scheduling and playout, live assist
  - `playout-system` [AEQ](https://aeq.es/automation-sw-audioplus) — `verified-primary` — playout machines, safe mode
  - `playback-device` *unverified* — description : aucune source ouverte (no source opened).

<a id="broadcast-radio"></a>
## Équipements broadcast et radio (Broadcast & radio systems)

`broadcast-radio`

**Rôle** : Équipements propres à la radio et à la TV : liaisons de contribution, traitement d'antenne, intercom, signalisation, téléphone en direct, contrôle du loudness.

*What it does:* Broadcast-specific gear: contribution links, on-air processing, intercom, signalling, live telephone, loudness control.

**Principe** : Transport de l'audio entre sites (codecs IP), normalisation du niveau perçu (EBU R 128 : -23 LUFS, mesure selon ITU-R BS.1770, crête vraie max. -1 dBTP) et mixages N-1 pour que chaque intervenant distant n'entende pas sa propre voix retardée.

*Principle:* Audio transport between sites (IP codecs), perceived-loudness normalisation (EBU R 128: -23 LUFS, measured per ITU-R BS.1770, max true peak -1 dBTP) and mix-minus feeds so remote contributors do not hear their own delayed voice.

**Usages typiques (typical uses)** : radio (radio) ; télévision (television) ; duplex / reportage (remote broadcasts)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `ip-codec` | Codec audio IP (IP audio codec) | Codec qui transporte de l'audio de qualité diffusion sur réseau IP (internet, 4G/5G) entre un site distant et le studio. | Compression (AAC, MPEG Layer II...) ou PCM, signalisation SIP et transport RTP selon EBU Tech 3326 (N/ACIP) pour l'interopérabilité entre marques. | Compression (AAC, MPEG Layer II, etc.) or PCM, SIP signalling and RTP transport per EBU Tech 3326 (N/ACIP) for cross-brand interoperability. | verified-primary, verified-secondary |
| `isdn-codec-legacy` | Codec RNIS (historique) (ISDN codec (legacy)) | Codec sur RNIS (ISDN), technologie historique remplacée par l'IP. | Liaison numérique commutée à débit garanti ; l'arrêt annoncé du RNIS a motivé la norme EBU N/ACIP. | Circuit-switched digital line with guaranteed bitrate; ISDN's announced phase-out prompted EBU N/ACIP. | verified-secondary |
| `on-air-processor` | Processeur antenne (FM/DAB) (On-air / FM-DAB processor) | Processeur d'antenne FM/DAB : densifie et uniformise le son et protège l'émetteur. | AGC large bande → compression/limitation multibande → écrêteur final (avec pré-accentuation FM) pour maximiser la sonie sans dépasser la déviation autorisée. | Wideband AGC → multiband compression/limiting → final clipper (with FM pre-emphasis) to maximise loudness without over-modulating. | verified-primary, verified-secondary |
| `intercom-talkback` | Intercom / ordres (Intercom / talkback) | Système d'ordres entre régie, plateau et techniciens (party-line ou matrice, filaire ou sans fil). | Party-line : boucle partagée où chacun parle/écoute (souvent sur câble XLR) ; matrice : routage point à point entre postes, comme un routeur. | Party-line: shared loop where everyone talks/listens (often on XLR cable); matrix: point-to-point routing between stations, like a router. | verified-primary, verified-secondary |
| `tally-on-air-light` | Tally / signalisation antenne (Tally / ON-AIR signalling) | Signalisation 'ON AIR' / tally : voyants indiquant micro ouvert ou caméra à l'antenne. | Contacts GPIO de la console ou du mélangeur vidéo qui commandent des voyants. | GPIO contacts from the console or vision mixer drive lamps. | unverified |
| `telephone-hybrid` | Coupleur téléphonique (Telephone hybrid / talk-show system) | Coupleur téléphonique : passe un appel à l'antenne en séparant la voix de l'auditeur de celle du studio. | Interface 2 fils / 4 fils : une ligne téléphonique transporte les deux sens sur une paire ; le coupleur les sépare par équilibrage d'impédance, aidé par une annulation d'écho adaptative. | 2-wire/4-wire interface: a phone line carries both directions on one pair; the hybrid separates them by impedance balancing, helped by adaptive echo cancellation. | verified-secondary |
| `mix-minus-system` | Système N-1 (mix-minus) (Mix-minus (N-1) system) | Système de N-1 : fournit à chaque intervenant distant le programme complet moins sa propre voix. | Bus dédié par intervenant ; évite que la voix revienne avec le retard de la liaison (et les boucles avec un coupleur). | Dedicated bus per contributor; prevents their voice returning with link delay (and loops via hybrids). | verified-secondary |
| `loudness-monitoring` | Mesure de loudness / contrôle antenne (Loudness / broadcast monitoring) | Mesure du loudness et contrôle d'antenne : vérifie la conformité aux normes (EBU R 128). | Mesure de sonie intégrée (LUFS), plage de loudness (LRA) et crête vraie (dBTP) selon ITU-R BS.1770 / EBU Tech 3341-3342. | Integrated loudness (LUFS), loudness range (LRA) and true peak (dBTP) per ITU-R BS.1770 / EBU Tech 3341-3342. | verified-primary, verified-secondary |

### Sources

- [EBU](https://tech.ebu.ch/publications/r128) — `verified-primary` — -23 LUFS, version 5.0 2023
- [Wikipedia](https://en.wikipedia.org/wiki/EBU_R_128) — `verified-secondary` — BS.1770, -1 dBTP
- [EBU](https://tech.ebu.ch/publications/tech3326) — `verified-primary` — IP contribution
- [Sound On Sound (glossary)](https://www.soundonsound.com/glossary/mix-minus) — `verified-secondary` — mix-minus

Sources des sous-types (sub-type sources) :
  - `ip-codec` [EBU](https://tech.ebu.ch/publications/tech3326) — `verified-primary` — interoperability requirements
  - `ip-codec` [Radio World](https://www.radioworld.com/news-and-business/get-the-most-out-of-nacip) — `verified-secondary` — SIP/RTP, codecs
  - `isdn-codec-legacy` [Radio World](https://www.radioworld.com/news-and-business/get-the-most-out-of-nacip) — `verified-secondary` — ISDN phase-out context
  - `on-air-processor` [Telos Alliance (Omnia)](https://telosalliance.com/Omnia/Omnia9) — `verified-primary` — processing architecture
  - `on-air-processor` [BSW (retailer, Omnia XII listing)](https://bswusa.com/omnia-xii-audio-processor/) — `verified-secondary` — AGC, multiband, limiter chain
  - `intercom-talkback` [Clear-Com](https://clearcom.com/Admin/Resources/partyline-intercoms-1) — `verified-primary` — party-line
  - `intercom-talkback` [TV Technology](https://www.tvtechnology.com/news/intercoms-a-history-of-distance) — `verified-secondary` — party-line vs matrix
  - `tally-on-air-light` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `telephone-hybrid` [Wikipedia](https://en.wikipedia.org/wiki/Telephone_hybrid) — `verified-secondary` — 2-wire/4-wire, echo cancellation
  - `mix-minus-system` [Sound On Sound (glossary)](https://www.soundonsound.com/glossary/mix-minus) — `verified-secondary` — definition, one per contributor
  - `loudness-monitoring` [EBU](https://tech.ebu.ch/publications/r128) — `verified-primary` — target, related EBU Tech 3341/3342
  - `loudness-monitoring` [Wikipedia](https://en.wikipedia.org/wiki/EBU_R_128) — `verified-secondary` — true peak

<a id="cables-connectors"></a>
## Câbles et connecteurs (Cables & connectors)

`cables-connectors`

**Rôle** : Câbles et connecteurs qui relient tous les équipements : audio analogique, HP, numérique, réseau, fibre, alimentation.

*What it does:* Cables and connectors linking all equipment: analog audio, speaker, digital, network, fibre, power.

**Principe** : En liaison symétrique, le signal circule sur deux conducteurs en opposition de phase dans un blindage : le récepteur différentiel annule les parasites induits également sur les deux (réjection de mode commun). En asymétrique, le blindage sert de retour et la réjection n'existe pas. Norme XLR : broche 1 masse, 2 point chaud, 3 point froid.

*Principle:* In a balanced line the signal runs on two conductors in opposite polarity inside a shield; the differential receiver cancels interference induced equally on both (common-mode rejection). In unbalanced lines the shield is the return and there is no rejection. XLR convention: pin 1 shield, pin 2 hot, pin 3 cold.

**Usages typiques (typical uses)** : câblage scène (stage cabling) ; studio (studio wiring) ; réseaux (networks) ; alimentation (power)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `connector` | Connecteur (Connector (product family)) | Famille de connecteurs (XLR, jack, speakON, etherCON...). | Voir les notes d'attributs 'connector_families'. | See attribute notes for connector_families. | verified-primary |
| `microphone-cable` | Câble micro / ligne symétrique (Balanced microphone / line cable) | Câble symétrique blindé (paire torsadée + blindage) pour micro et ligne. | Paire torsadée et blindée pour la réjection de mode commun ; transporte aussi l'alimentation fantôme sur les broches 2 et 3. | Shielded twisted pair for common-mode rejection; also carries phantom power on pins 2 and 3. | verified-primary |
| `speaker-cable` | Câble HP (Loudspeaker cable) | Câble de forte section non blindé reliant ampli et enceinte passive. | La résistance du câble (fonction de la section et de la longueur) cause des pertes et réduit le contrôle de l'ampli sur le haut-parleur. | Cable resistance (set by gauge and length) causes loss and reduces the amp's control of the driver. | unverified |
| `multicore-cable` | Câble multipaire (Multicore cable (bulk)) | Câble multipaire en vrac (plusieurs paires blindées individuellement). | Chaque paire est une liaison symétrique indépendante. | Each pair is an independent balanced line. | unverified |
| `digital-audio-cable` | Câble audionumérique (Digital audio cable (AES 110 Ω / 75 Ω coax)) | Câble audionumérique : AES3 110 Ω symétrique ou coaxial 75 Ω (AES-3id, MADI, word clock). | Impédance caractéristique contrôlée pour éviter les réflexions sur les signaux à haute fréquence. | Controlled characteristic impedance avoids reflections at high data rates. | verified-primary, verified-secondary |
| `network-cable` | Câble réseau (Network cable (Cat5e/6/6A, tactical)) | Câble réseau Cat5e/6/6A, souvent en version 'tactique' renforcée pour la scène. | Paires torsadées Ethernet ; 100 m max par segment cuivre ; Gigabit recommandé pour l'AoIP. | Ethernet twisted pairs; 100 m max per copper segment; Gigabit recommended for AoIP. | unverified, verified-secondary |
| `fibre` | Fibre optique (Optical fibre / tactical fibre) | Fibre optique (multimode/monomode), souvent en connecteurs durcis pour la scène. | Transmission lumineuse insensible aux parasites électriques et isolante ; très longues distances (km). | Light transmission, immune to electrical interference and galvanically isolating; very long runs (km). | verified-secondary |
| `breakout-adapter` | Éclaté / adaptateur (Breakout loom / adapter) | Éclatés et adaptateurs (multibroche vers XLR, XLR vers jack...). | Attention : passer d'un symétrique à un asymétrique supprime la réjection de mode commun. | Note: going from balanced to unbalanced removes common-mode rejection. | verified-primary |

### Attribut `connector_families`

| Valeur | FR | EN |
|---|---|---|
| `xlr` | XLR : 3 broches pour micro/ligne symétrique (1 masse, 2 chaud, 3 froid) ; 5 broches pour DMX ; verrouillage. | XLR: 3-pin for balanced mic/line (1 shield, 2 hot, 3 cold); 5-pin used for DMX; latching. |
| `trs-jack` | Jack 6,35 mm TRS (pointe-bague-corps) : ligne symétrique mono, stéréo asymétrique ou insert. | 6.35 mm TRS jack: balanced mono line, unbalanced stereo or insert. |
| `ts-jack` | Jack 6,35 mm TS : asymétrique mono (instrument, ligne grand public). | 6.35 mm TS jack: unbalanced mono (instrument, consumer line). |
| `mini-jack` | Mini-jack 3,5 mm : grand public, casques, timecode sur certains appareils. | 3.5 mm mini-jack: consumer, headphones, timecode on some devices. |
| `rca` | RCA (cinch) : asymétrique grand public, S/PDIF coaxial. | RCA: unbalanced consumer audio, coaxial S/PDIF. |
| `speakon` | speakON (Neutrik) : connecteur HP verrouillable (NL2/NL4/NL8), évite les contacts accidentels. | speakON (Neutrik): locking loudspeaker connector (NL2/NL4/NL8), prevents accidental contact. |
| `powercon` | powerCON (Neutrik) : connecteur secteur verrouillable pour appareils et chaînage. | powerCON (Neutrik): locking mains connector for devices and daisy-chaining. |
| `ethercon-rj45` | etherCON : RJ45 dans un boîtier durci type XLR pour le réseau sur scène. | etherCON: RJ45 in a rugged XLR-style shell for stage networking. |
| `bnc` | BNC : coaxial verrouillable 75 Ω (word clock, MADI, AES-3id, vidéo) ou 50 Ω (antennes HF). | BNC: locking coax, 75 Ω (word clock, MADI, AES-3id, video) or 50 Ω (RF antennas). |
| `toslink` | TOSLINK : fibre optique plastique pour S/PDIF optique et ADAT. | TOSLINK: plastic optical fibre for optical S/PDIF and ADAT. |
| `opticalcon-fibre` | opticalCON (Neutrik) : fibre en boîtier durci pour la scène. | opticalCON (Neutrik): ruggedised fibre connector for stage. |
| `dsub25` | D-Sub 25 : 8 canaux symétriques analogiques ou AES (brochage Tascam/Yamaha à vérifier). | D-Sub 25: 8 balanced analog or AES channels (check Tascam vs Yamaha pinout). |
| `multipin` | Multibroche (Harting, VEAM, Socapex...) : multipaire sur un seul connecteur. | Multipin (Harting, VEAM, Socapex, etc.): multicore on one connector. |
| `tt-bantam` | TT/Bantam : petit jack de patch professionnel (4,4 mm). | TT/Bantam: small professional patch jack (4.4 mm). |
| `mini-xlr-ta4` | Mini-XLR TA4 : entrée micro des émetteurs de poche. | Mini-XLR TA4: mic input on bodypack transmitters. |
| `lemo` | LEMO : connecteurs circulaires push-pull (timecode, émetteurs, caméras). | LEMO: push-pull circular connectors (timecode, transmitters, cameras). |
| `iec` | IEC (C13/C14...) : cordons secteur des appareils. | IEC (C13/C14, etc.): equipment mains leads. |
| `schuko-cee` | Schuko / CEE (P17) : prises secteur domestiques et industrielles (16/32/63 A). | Schuko / CEE (P17): domestic and industrial mains plugs (16/32/63 A). |

Sources :
- [Shure (Audio Systems Guide for Video and Film Production)](https://content-files.shure.com/Pubs/audio-systems-guide-for-video-and-film-production/audio-systems-guide-for-video-and-film-production-english.pdf) — `verified-primary` — xlr, trs-jack, ts-jack
- [Sound On Sound](https://www.soundonsound.com/sound-advice/q-why-do-get-no-sound-when-connect-my-two-vintage-devices) — `verified-secondary` — xlr pin 2 hot
- [Neutrik](https://www.neutrik.com/en/neutrik/products/speakon-loudspeaker-connectors/speakon-chassis-connectors/speakon-chassis-connectors) — `verified-primary` — speakon
- [Neutrik](https://www.neutrik.com/en/products/lightning/powercon) — `verified-primary` — powercon
- [Neutrik](https://www.neutrik.com/en/neutrik/products/ethercon-rj45-connectors/ethercon-chassis-connectors) — `verified-primary` — ethercon-rj45
- [Wikipedia](https://en.wikipedia.org/wiki/MADI) — `verified-secondary` — bnc 75 ohm, SC fibre
- [AudioTechnology magazine](https://audiotechnology.com/PDF/14/AT14_Word_Clock_Explained.pdf) — `verified-secondary` — bnc
- [Sound On Sound](https://www.soundonsound.com/techniques/expanding-your-audio-setup-adat) — `verified-secondary` — toslink, rca
- [Wikipedia](https://en.wikipedia.org/wiki/DMX512) — `verified-secondary` — xlr 5-pin DMX
- [AVL Gear (retailer, Shure HA-8089 listing)](https://www.avlgear.com/product/shure-ha8089-pws-helical-antenna/) — `verified-secondary` — bnc 50 ohm RF
- *unverified* — mini-jack, dsub25, multipin, tt-bantam, mini-xlr-ta4, lemo, iec, schuko-cee, opticalcon-fibre : aucune source ouverte (no source opened).

### Attribut `line_types`

| Valeur | FR | EN |
|---|---|---|
| `balanced` | Symétrique : deux conducteurs + blindage, signaux opposés ; le récepteur différentiel rejette les parasites communs. Indispensable en grande longueur et requis pour le fantôme. | Balanced: two conductors plus shield in opposite polarity; the differential receiver rejects common noise. Essential on long runs and required for phantom power. |
| `unbalanced` | Asymétrique : un conducteur, le blindage sert de retour ; sensible aux parasites, à réserver aux courtes distances. | Unbalanced: one conductor with the shield as return; prone to interference, keep runs short. |

Sources :
- [Shure (Audio Systems Guide for Video and Film Production)](https://content-files.shure.com/Pubs/audio-systems-guide-for-video-and-film-production/audio-systems-guide-for-video-and-film-production-english.pdf) — `verified-primary` — balanced, unbalanced, phantom needs balanced
- [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/know-the-basics-about-phantom-power) — `verified-primary` — phantom

### Sources

- [Shure (Audio Systems Guide for Video and Film Production)](https://content-files.shure.com/Pubs/audio-systems-guide-for-video-and-film-production/audio-systems-guide-for-video-and-film-production-english.pdf) — `verified-primary` — balanced vs unbalanced, XLR/TRS/TS
- [Sound On Sound](https://www.soundonsound.com/sound-advice/q-why-do-get-no-sound-when-connect-my-two-vintage-devices) — `verified-secondary` — pin 2 hot

Sources des sous-types (sub-type sources) :
  - `connector` [Neutrik](https://www.neutrik.com/en/neutrik/products/speakon-loudspeaker-connectors/speakon-chassis-connectors/speakon-chassis-connectors) — `verified-primary` — speakON family
  - `connector` [Neutrik](https://www.neutrik.com/en/neutrik/products/ethercon-rj45-connectors/ethercon-chassis-connectors) — `verified-primary` — etherCON family
  - `connector` [Neutrik](https://www.neutrik.com/en/products/lightning/powercon) — `verified-primary` — powerCON family
  - `microphone-cable` [Shure (Audio Systems Guide for Video and Film Production)](https://content-files.shure.com/Pubs/audio-systems-guide-for-video-and-film-production/audio-systems-guide-for-video-and-film-production-english.pdf) — `verified-primary` — balanced
  - `microphone-cable` [DPA Microphones (Mic University)](https://www.dpamicrophones.com/mic-university/know-the-basics-about-phantom-power) — `verified-primary` — phantom on pins 2 and 3
  - `speaker-cable` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `multicore-cable` *unverified* — description : aucune source ouverte (no source opened).
  - `digital-audio-cable` [Audio Engineering Society](https://aes.org/audio-topics/audio-networking-2/) — `verified-primary` — AES3, AES10 media
  - `digital-audio-cable` [Wikipedia](https://en.wikipedia.org/wiki/MADI) — `verified-secondary` — 75 Ω BNC
  - `digital-audio-cable` [AudioTechnology magazine](https://audiotechnology.com/PDF/14/AT14_Word_Clock_Explained.pdf) — `verified-secondary` — 75 Ω BNC word clock
  - `network-cable` [Clear-Com knowledge base](https://clear-com.atlassian.net/wiki/spaces/SF/pages/158787622/Matrix+What+type+of+Network+Switch+is+compatible+with+an+E-Dante+card) — `verified-secondary` — Gigabit
  - `network-cable` *unverified* — 100 m segment limit : aucune source ouverte (no source opened).
  - `fibre` [Wikipedia](https://en.wikipedia.org/wiki/MADI) — `verified-secondary` — optical reach
  - `breakout-adapter` [Shure (Audio Systems Guide for Video and Film Production)](https://content-files.shure.com/Pubs/audio-systems-guide-for-video-and-film-production/audio-systems-guide-for-video-and-film-production-english.pdf) — `verified-primary` — balanced vs unbalanced

<a id="patchbays"></a>
## Baies de brassage (patch) (Patchbays)

`patchbays`

**Rôle** : Baies de brassage qui rassemblent entrées et sorties des appareils sur une face avant pour modifier le routage avec des cordons courts.

*What it does:* Patchbays gathering equipment inputs and outputs on a front panel so routing can be changed with short cords.

**Principe** : Chaque point a une rangée haute (généralement sorties) et basse (entrées) ; des contacts de normalisation relient par défaut un point haut à son point bas, et l'insertion d'un jack interrompt ou duplique cette liaison.

*Principle:* Each point has a top row (usually outputs) and bottom row (inputs); normalling contacts connect top to bottom by default, and inserting a plug breaks or duplicates that link.

**Usages typiques (typical uses)** : studio (studio) ; régie radio/TV (broadcast control rooms)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `tt-bantam` | Patch TT / Bantam (TT / Bantam patchbay) | Baie TT/Bantam : haute densité (96 points en 1U ou plus), standard des studios et du broadcast. | Connecteur jack 4,4 mm à 3 contacts (symétrique). | 4.4 mm 3-contact jack (balanced). | unverified |
| `quarter-inch-trs` | Patch jack 6,35 mm (6.35 mm TRS patchbay) | Baie jack 6,35 mm TRS : courante en home et project studio. | Même logique de normalisation avec des jacks standard. | Same normalling logic with standard jacks. | verified-secondary |
| `xlr-panel` | Panneau XLR (XLR / connector panel) | Panneau de connecteurs XLR (ou autres) pour le câblage fixe d'une salle. | Simple traversée sans normalisation. | Simple pass-through without normalling. | unverified |
| `digital-video-patch` | Patch numérique (AES / BNC) (Digital (AES / BNC) patch) | Patch numérique : AES 110 Ω ou BNC 75 Ω (MADI, word clock, vidéo). | Impédance respectée pour les signaux haut débit. | Maintains impedance for high-rate signals. | unverified |

### Attribut `normalling_modes`

| Valeur | FR | EN |
|---|---|---|
| `normalled` | Normalisé (full-normal) : brancher en haut ou en bas coupe la liaison par défaut. | Normalled (full-normal): plugging into either top or bottom breaks the default link. |
| `half-normalled` | Semi-normalisé : brancher en haut prélève une copie sans couper ; brancher en bas coupe la liaison. | Half-normalled: plugging into the top takes a copy without breaking; plugging into the bottom breaks the link. |
| `non-normalled` | Non normalisé (thru / isolé) : avant et arrière reliés directement, aucune liaison entre haut et bas sans cordon. | Non-normalled (thru/isolated): front and rear linked directly, no top-to-bottom connection without a cord. |
| `switchable` | Commutable : le mode se choisit par point (cavalier, module réversible ou commutateur). | Switchable: mode chosen per point (jumper, reversible module or switch). |

Sources :
- [Sound On Sound](https://www.soundonsound.com/sound-advice/q-what-exactly-half-normalling) — `verified-secondary` — normalled, half-normalled, thru
- *unverified* — switchable : aucune source ouverte (no source opened).

### Sources

- [Sound On Sound](https://www.soundonsound.com/sound-advice/q-what-exactly-half-normalling) — `verified-secondary` — normalling behaviour

Sources des sous-types (sub-type sources) :
  - `tt-bantam` *unverified* — description : aucune source ouverte (no source opened).
  - `quarter-inch-trs` [Sound On Sound](https://www.soundonsound.com/sound-advice/q-what-exactly-half-normalling) — `verified-secondary` — budget bays usually half-normalled
  - `xlr-panel` *unverified* — description : aucune source ouverte (no source opened).
  - `digital-video-patch` *unverified* — description : aucune source ouverte (no source opened).

<a id="measurement-tools"></a>
## Mesure et outils de test (Measurement & test tools)

`measurement-tools`

**Rôle** : Instruments et logiciels qui mesurent niveaux, réponses en fréquence, distorsion, loudness et état des câbles.

*What it does:* Instruments and software measuring levels, frequency response, distortion, loudness and cable condition.

**Principe** : Mesure du niveau de pression acoustique pondéré (sonomètre, IEC 61672), comparaison entre un signal de référence et le signal capté (fonction de transfert par FFT bi-canal), analyse du résidu après suppression du fondamental (THD+N).

*Principle:* Weighted sound pressure level (sound level meter, IEC 61672), comparison of a reference with the measured signal (dual-channel FFT transfer function), residual analysis after removing the fundamental (THD+N).

**Usages typiques (typical uses)** : calage de sonorisation (PA tuning) ; contrôle des niveaux sonores (sound-level compliance) ; maintenance (maintenance)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `spl-meter` | Sonomètre (Sound level meter) | Sonomètre : mesure le niveau de pression acoustique en dB (pondérations A, C ; intégration Leq). | Micro de mesure + pondération fréquentielle et temporelle normalisées ; classes 1 et 2 de l'IEC 61672-1 (même objectif, tolérances plus larges en classe 2). | Measurement mic + standardised frequency and time weightings; IEC 61672-1 classes 1 and 2 (same goals, wider tolerances in class 2). | verified-primary |
| `measurement-mic-kit` | Micro de mesure / kit RTA (Measurement microphone / RTA kit) | Micro de mesure omnidirectionnel et interface pour analyseur temps réel (RTA) ou fonction de transfert. | Voir micro de mesure ; l'interface doit avoir deux entrées pour la mesure de fonction de transfert. | See measurement mic; the interface needs two inputs for transfer-function work. | verified-primary |
| `audio-analyzer` | Analyseur audio (Audio analyzer) | Analyseur audio de laboratoire : distorsion, bruit, réponse, diaphonie des appareils. | Génère un signal de test très pur et analyse la sortie ; le THD+N retire le fondamental par filtre coupe-bande et mesure le résidu. | Generates a very pure test signal and analyses the output; THD+N notches out the fundamental and measures the residual. | verified-primary |
| `analysis-software` | Logiciel d'analyse acoustique (Acoustic analysis software) | Logiciel d'analyse acoustique (ex. Smaart) : spectre, fonction de transfert, réponse impulsionnelle, RT60. | FFT bi-canal : compare le signal envoyé au système (référence) et celui capté par le micro ; la cohérence indique la fiabilité de la mesure. | Dual-channel FFT compares the signal sent to the system (reference) with the mic signal; coherence indicates measurement reliability. | verified-primary, verified-secondary |
| `cable-tester` | Testeur de câbles (Cable tester) | Testeur de câbles : continuité, courts-circuits, inversions de brochage. | Injection d'un courant ou signal broche par broche. | Pin-by-pin current or signal injection. | unverified |
| `loudness-meter` | Loudness-mètre (Loudness meter) | Loudness-mètre : mesure LUFS, LRA et crête vraie. | Algorithme ITU-R BS.1770 (pondération K, intégration avec seuillage), crête vraie par suréchantillonnage. | ITU-R BS.1770 algorithm (K-weighting, gated integration), true peak by oversampling. | verified-primary, verified-secondary |
| `signal-generator-phase` | Générateur / testeur de polarité (Signal generator / polarity checker) | Générateur de signal et testeur de polarité (bruit rose, sinus, impulsions). | Le testeur émet une impulsion asymétrique et un récepteur indique si la polarité est conservée. | The checker emits an asymmetric pulse and a receiver shows whether polarity is preserved. | unverified |
| `sound-level-limiter-logger` | Limiteur-enregistreur de niveau sonore (Sound level limiter / logger) *proposé* | Appareil qui mesure en continu le niveau sonore du public, l'enregistre et peut limiter la diffusion, pour respecter la réglementation sur les lieux diffusant de la musique amplifiée. | Micro de mesure + calcul de Leq sur une durée glissante + journalisation ; seuils réglementaires à vérifier dans les textes français. | Measurement mic + rolling Leq calculation + logging; regulatory thresholds must be checked in French law. | unverified, verified-primary |

### Sources

- [IEC (webstore, IEC 61672-1)](https://webstore.iec.ch/en/publication/5708) — `verified-primary` — sound level meter classes
- [Rational Acoustics (Smaart)](https://support.rationalacoustics.com/support/solutions/articles/150000190431-measurement-101-types-of-measurement) — `verified-primary` — measurement types
- [Audio Precision](https://www.ap.com/blog/thd-and-thdn-similar-but-not-the-same) — `verified-primary` — THD+N

Sources des sous-types (sub-type sources) :
  - `spl-meter` [IEC (webstore, IEC 61672-1)](https://webstore.iec.ch/en/publication/5708) — `verified-primary` — classes, instrument types
  - `measurement-mic-kit` [Rational Acoustics (Smaart)](https://support.rationalacoustics.com/support/solutions/articles/150000190431-measurement-101-types-of-measurement) — `verified-primary` — two-channel requirement
  - `measurement-mic-kit` [Brüel & Kjær / HBK](https://www.bksv.com/transducers/acoustic/microphones/microphone-cartridges/4145) — `verified-primary` — measurement microphone
  - `audio-analyzer` [Audio Precision](https://www.ap.com/blog/thd-and-thdn-similar-but-not-the-same) — `verified-primary` — THD+N method
  - `analysis-software` [Rational Acoustics (Smaart)](https://support.rationalacoustics.com/support/solutions/articles/150000190431-measurement-101-types-of-measurement) — `verified-primary` — measurement types
  - `analysis-software` [ProSoundWeb](https://www.prosoundweb.com/system-analysis-streamlined/) — `verified-secondary` — transfer function, coherence
  - `cable-tester` *unverified* — description : aucune source ouverte (no source opened).
  - `loudness-meter` [Wikipedia](https://en.wikipedia.org/wiki/EBU_R_128) — `verified-secondary` — BS.1770, true peak oversampling
  - `loudness-meter` [EBU](https://tech.ebu.ch/publications/r128) — `verified-primary` — target
  - `signal-generator-phase` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `sound-level-limiter-logger` [IEC (webstore, IEC 61672-1)](https://webstore.iec.ch/en/publication/5708) — `verified-primary` — sound level measurement standard
  - `sound-level-limiter-logger` *unverified* — French regulatory thresholds not sourced in this session : aucune source ouverte (no source opened).

<a id="accessories-mounting"></a>
## Pieds, suspensions et accessoires micro (Stands, mounts & mic accessories)

`accessories-mounting`

**Rôle** : Accessoires de mise en œuvre : pieds, perches, suspensions, bonnettes, anti-pop, racks et flight-cases.

*What it does:* Deployment accessories: stands, boom poles, shock mounts, windshields, pop filters, racks and flight cases.

**Principe** : Découpler mécaniquement le micro (suspension élastique), réduire les turbulences du vent ou des plosives (volume d'air calme autour de la capsule, tissus acoustiquement transparents), et protéger/standardiser le matériel (rack 19 pouces, 1U = 44,45 mm).

*Principle:* Mechanically decouple the mic (elastic suspension), reduce wind or plosive turbulence (a calm air volume around the capsule, acoustically transparent materials), and protect/standardise gear (19-inch rack, 1U = 44.45 mm).

**Usages typiques (typical uses)** : tournage (location) ; studio (studio) ; tournée (touring)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `mic-stand` | Pied de micro (Microphone stand) | Pied de micro (droit, perche/girafe, de table). | Support mécanique stable ; contrepoids pour les perchettes. | Stable mechanical support; counterweight for booms. | unverified |
| `mic-arm` | Bras micro broadcast (Broadcast mic arm) | Bras articulé de broadcast fixé au bureau. | Ressorts d'équilibrage ; garde le micro à distance constante. | Balancing springs keep the mic at a constant distance. | unverified |
| `shock-mount` | Suspension (Shock mount) | Suspension élastique qui isole le micro des vibrations du pied ou de la perche. | Système masse-ressort dont la fréquence de résonance est sous la bande utile. | Mass-spring system resonating below the useful band. | unverified, verified-secondary |
| `windshield-blimp` | Bonnette / zeppelin / poils (Windshield / blimp / fur) | Bonnette mousse, zeppelin (cage) et poils (fourrure) contre le vent. | Crée une zone d'air calme autour de la capsule ; la fourrure ajoute une atténuation supplémentaire avec peu de perte d'aigus. | Creates calm air around the capsule; fur adds further attenuation with little HF loss. | verified-secondary |
| `boom-pole` | Perche (Boom pole) | Perche télescopique pour placer un micro canon au-dessus des comédiens hors champ. | Tube léger (carbone, aluminium), câble interne ou spiralé. | Lightweight tube (carbon, aluminium), internal or coiled cable. | unverified |
| `pop-filter` | Anti-pop (Pop filter) | Écran anti-pop devant le micro voix. | Disperse le jet d'air des plosives (p, b) avant la membrane. | Breaks up the air blast of plosives (p, b) before the diaphragm. | unverified |
| `rack-case` | Rack / flight-case (Rack / flight case) | Rack 19 pouces et flight-case de transport. | Hauteur en unités (1U = 44,45 mm) selon EIA-310 ; caisse renforcée pour la tournée. | Height in units (1U = 44.45 mm) per EIA-310; reinforced case for touring. | verified-secondary |

### Sources

- [Trew Audio (retailer, Rycote WS 295 listing)](https://www.trewaudio.com/?p=331862) — `verified-secondary` — suspension and windshield
- [Wikipedia](https://en.wikipedia.org/wiki/Rack_unit) — `verified-secondary` — rack unit

Sources des sous-types (sub-type sources) :
  - `mic-stand` *unverified* — description : aucune source ouverte (no source opened).
  - `mic-arm` *unverified* — description : aucune source ouverte (no source opened).
  - `shock-mount` [Trew Audio (retailer, Rycote WS 295 listing)](https://www.trewaudio.com/?p=331862) — `verified-secondary` — Lyre suspension against handling noise
  - `shock-mount` *unverified* — mass-spring resonance : aucune source ouverte (no source opened).
  - `windshield-blimp` [Trew Audio (retailer, Rycote WS 295 listing)](https://www.trewaudio.com/?p=331862) — `verified-secondary` — wind noise suppression, fur cover
  - `boom-pole` *unverified* — description : aucune source ouverte (no source opened).
  - `pop-filter` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `rack-case` [Wikipedia](https://en.wikipedia.org/wiki/Rack_unit) — `verified-secondary` — 1U = 44.45 mm, EIA-310

<a id="software"></a>
## Logiciels audio (STAN, contrôle, analyse) (Audio software (DAW, control, analysis))

`software`

**Rôle** : Logiciels audio : stations audionumériques (STAN/DAW), contrôle de réseaux audio, conduite de spectacle, prédiction acoustique, restauration.

*What it does:* Audio software: DAWs, audio-network control, show control, acoustic prediction, restoration.

**Principe** : Traitement numérique du signal sur ordinateur (enregistrement, édition non destructive, mixage, plug-ins), modélisation de la propagation sonore, ou analyse spectrale pour isoler et retirer des bruits.

*Principle:* Computer DSP (recording, non-destructive editing, mixing, plug-ins), sound-propagation modelling, or spectral analysis to isolate and remove noise.

**Usages typiques (typical uses)** : production musicale (music production) ; post-production (post) ; conception de système (system design)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `daw` | Station audionumérique (STAN / DAW) (Digital audio workstation) | Station audionumérique (STAN) : enregistrer, éditer, mixer audio et MIDI. | Fichiers audio sur disque, édition non destructive, mixeur virtuel et plug-ins. | Audio files on disk, non-destructive editing, virtual mixer and plug-ins. | verified-secondary |
| `network-control` | Logiciel de contrôle réseau audio (Audio network control software) | Logiciel de gestion du routage et de l'horloge d'un réseau audio (ex. Dante Controller). | Découverte des appareils, abonnements émetteur→récepteur, réglage de latence, état PTP. | Device discovery, transmitter-to-receiver subscriptions, latency settings, PTP status. | verified-primary |
| `show-control-playback` | Logiciel de conduite / lecture spectacle (Show control / playback software) | Logiciel de conduite son pour le spectacle : liste de cues déclenchés en séquence. | Lecture de fichiers, niveaux et routages mémorisés par cue, commandes MIDI/OSC. | File playback with levels and routing stored per cue, MIDI/OSC commands. | unverified |
| `system-design-prediction` | Logiciel de prédiction / conception de système (System design / prediction software) | Logiciel de prédiction acoustique d'un système de diffusion (ex. d&b ArrayCalc, L-Acoustics Soundvision). | Modélisation 3D de la salle et calcul du champ direct (niveau, couverture, absorption de l'air), plus contraintes d'accroche et de sécurité. | 3D venue model and direct-field calculation (level, coverage, air absorption), plus rigging and safety constraints. | verified-primary |
| `restoration-editing` | Logiciel de restauration / édition (Restoration / editing software) | Logiciel de restauration et d'édition (ex. iZotope RX) : débruitage, suppression de clics, réparation spectrale. | Affichage spectrogramme ; un profil de bruit est soustrait ou une zone sélectionnée est reconstruite à partir de l'audio voisin. | Spectrogram display; a noise profile is subtracted or a selected area is rebuilt from surrounding audio. | verified-primary |

### Sources

- [TechTerms](https://techterms.com/definition/daw) — `verified-secondary` — DAW definition
- [d&b audiotechnik](https://www.dbaudio.com/global/en/arraycalc/) — `verified-primary` — prediction software
- [iZotope](https://www.izotope.com/en/products/rx/features/spectral-repair) — `verified-primary` — spectral repair

Sources des sous-types (sub-type sources) :
  - `daw` [TechTerms](https://techterms.com/definition/daw) — `verified-secondary` — definition, integrated vs software DAWs
  - `network-control` [Audinate](https://dev.audinate.com/GA/dante-controller/userguide/pdf/latest/) — `verified-primary` — routing, clock status, latency
  - `show-control-playback` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `system-design-prediction` [d&b audiotechnik](https://www.dbaudio.com/global/en/arraycalc/) — `verified-primary` — simulation scope, rigging safety
  - `restoration-editing` [iZotope](https://www.izotope.com/en/products/rx/features/spectral-repair) — `verified-primary` — spectral repair
  - `restoration-editing` [iZotope](https://www.izotope.com/en/products/rx/features/spectral-de-noise) — `verified-primary` — spectral de-noise

<a id="installations-rooms"></a>
## Installations et lieux (contextes) (Installations & rooms (contexts, no devices))

`installations-rooms`

**Rôle** : Contextes de travail du technicien son (lieux et situations), sans appareil propre : ils servent à relier matériel et usages dans les cours du BTS.

*What it does:* Working contexts for the sound technician (places and situations), with no device of their own; used to link gear to practice in BTS courses.

**Principe** : Chaque lieu impose ses contraintes : acoustique de la pièce (réflexions précoces, temps de réverbération), niveau sonore, bruit ambiant, mobilité, normes de diffusion.

*Principle:* Each place sets its constraints: room acoustics (early reflections, reverberation time), sound level, ambient noise, mobility, delivery standards.

**Usages typiques (typical uses)** : pédagogie BTS MAV (BTS MAV teaching)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `recording-studio` | Studio d'enregistrement (cabine + prise) (Recording studio (control room + live room)) | Studio d'enregistrement : cabine de prise (live room) + régie (control room). | Isolation entre les pièces ; régie traitée pour une écoute de référence. | Isolation between rooms; control room treated for reference listening. | verified-primary |
| `radio-booth` | Studio radio / cabine (Radio studio / booth) | Studio radio et cabine speaker. | Pièce peu réverbérante, console broadcast, signalisation ON AIR. | Low-reverb room, broadcast console, ON AIR signalling. | verified-primary |
| `tv-set` | Plateau TV et régie (TV studio set & gallery) | Plateau TV et régie son. | Micros HF/cravates, intercom, synchronisation avec l'image, normes loudness. | Wireless/lavalier mics, intercom, picture sync, loudness standards. | verified-primary |
| `theatre` | Théâtre (Theatre) | Théâtre : diffusion d'effets, micros HF, retours. | Conduite par cues, discrétion des micros, cohérence de localisation. | Cue-based operation, hidden mics, localisation consistency. | unverified |
| `concert-open-air` | Salle de concert / plein air (Concert hall / open-air festival) | Salle de concert ou festival en plein air. | Grande diffusion (line array, subs), limites de niveau, propagation sur grande distance. | Large-scale PA (line arrays, subs), level limits, long-distance propagation. | verified-secondary |
| `conference-installed` | Conférence / sonorisation fixe (Conference / installed sound) | Salle de conférence et sonorisation fixe. | Intelligibilité de la parole, automixage, enceintes colonnes. | Speech intelligibility, automixing, column speakers. | verified-primary, verified-secondary |
| `eng-outdoor-reportage` | Reportage extérieur / tournage (Outdoor reportage / ENG / film location) | Reportage extérieur, ENG, tournage en décor naturel. | Mobilité, vent, timecode, enregistreur de terrain, perche et HF. | Mobility, wind, timecode, field recorder, boom and wireless. | verified-primary, verified-secondary |
| `post-production-room` | Auditorium de post-production / mixage (Post-production / mixing room) | Auditorium de post-production et de mixage (cinéma, TV, multicanal). | Écoute calibrée multicanal, conformité aux normes de loudness. | Calibrated multichannel monitoring, loudness compliance. | verified-primary |

### Sources

- [Onisep (service public d'information sur les formations)](https://www.onisep.fr/ressources/univers-formation/formations/post-bac/bts-metiers-de-l-audiovisuel-option-metiers-du-son) — `verified-primary` — BTS métiers du son: occupations and contexts
- [ITU-R](https://itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1116-3-201502-I!!TOC-HTM-E.htm) — `verified-primary` — listening room conditions
- [EBU](https://tech-qual.ebu.ch/publications/tech3276) — `verified-primary` — control room conditions

Sources des sous-types (sub-type sources) :
  - `recording-studio` [EBU](https://tech-qual.ebu.ch/publications/tech3276) — `verified-primary` — control room listening
  - `recording-studio` [ITU-R](https://itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1116-3-201502-I!!TOC-HTM-E.htm) — `verified-primary` — reference room
  - `radio-booth` [Onisep (service public d'information sur les formations)](https://www.onisep.fr/ressources/univers-formation/formations/post-bac/bts-metiers-de-l-audiovisuel-option-metiers-du-son) — `verified-primary` — technicien d'antenne
  - `tv-set` [EBU](https://tech.ebu.ch/publications/r128) — `verified-primary` — loudness delivery
  - `theatre` *unverified* — description : aucune source ouverte (no source opened).
  - `concert-open-air` [AudioTechnology magazine](https://www.audiotechnology.com/PDF/11/AT11_Line_Arrays_Explained.pdf) — `verified-secondary` — line arrays
  - `conference-installed` [Shure](https://www.shure.com/en-US/insights/automatic-microphone-mixers-when-your-need-them) — `verified-primary` — automatic mixers
  - `conference-installed` [Acoustical Society of America](https://acoustics.org/1paa6-listening-for-solutions-to-a-speech-intelligibility-problem-anthony-hoover-fasa/) — `verified-secondary` — intelligibility
  - `eng-outdoor-reportage` [Onisep (service public d'information sur les formations)](https://www.onisep.fr/ressources/univers-formation/formations/post-bac/bts-metiers-de-l-audiovisuel-option-metiers-du-son) — `verified-primary` — opérateur de prise de son
  - `eng-outdoor-reportage` [Trew Audio (retailer, Rycote WS 295 listing)](https://www.trewaudio.com/?p=331862) — `verified-secondary` — wind protection
  - `post-production-room` [ITU-R](https://itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1116-3-201502-I!!TOC-HTM-E.htm) — `verified-primary` — reference listening
  - `post-production-room` [EBU](https://tech.ebu.ch/publications/r128) — `verified-primary` — loudness

<a id="power-distribution"></a>
## Distribution électrique et sécurité (Power distribution & electrical safety) — *proposé (proposed)*

`power-distribution`

**Rôle** : Distribution du courant secteur aux équipements son : armoires, boîtiers de distribution, câbles et connecteurs de puissance, protections.

*What it does:* Mains power distribution to sound equipment: distro boxes, power cables and connectors, protective devices.

**Principe** : Répartir les charges sur les phases, protéger par disjoncteurs et différentiels, garantir une terre commune unique pour l'audio ; séparer si possible l'alimentation son de celle des gradateurs lumière pour limiter ronflements et parasites. Ne jamais lever la terre de sécurité.

*Principle:* Spread loads across phases, protect with breakers and RCDs, keep a single common earth for audio; where possible feed sound separately from lighting dimmers to limit hum and noise. Never lift the safety earth.

**Usages typiques (typical uses)** : tournée et festivals (touring and festivals) ; installations (installations) ; sécurité électrique (programme BTS) (electrical safety (BTS syllabus))

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `power-distro-box` | Boîtier / armoire de distribution (Power distribution box) *proposé* | Boîtier recevant une alimentation (souvent CEE P17 triphasée) et la répartissant sur des départs protégés. | Disjoncteurs et différentiels par départ, répartition des charges par phase. | Breakers and RCDs per outlet, load balancing per phase. | unverified |
| `isolation-transformer-conditioner` | Transformateur d'isolement / conditionneur secteur (Isolation transformer / power conditioner) *proposé* | Transformateur d'isolement ou conditionneur qui filtre le secteur et peut casser une boucle de masse côté alimentation. | Couplage magnétique sans liaison galvanique entre primaire et secondaire. | Magnetic coupling without galvanic connection between primary and secondary. | unverified |
| `mains-cable-connector` | Câbles et connecteurs secteur (Mains cables & connectors) *proposé* | Rallonges et prolongateurs secteur : Schuko, CEE, powerCON, IEC. | Section adaptée au courant et à la longueur ; connecteurs verrouillables sur scène. | Gauge suited to current and length; locking connectors on stage. | unverified, verified-primary |

### Sources

- [Onisep (service public d'information sur les formations)](https://www.onisep.fr/ressources/univers-formation/formations/post-bac/bts-metiers-de-l-audiovisuel-option-metiers-du-son) — `verified-primary` — sécurité électrique in BTS syllabus
- [Neutrik](https://www.neutrik.com/en/products/lightning/powercon) — `verified-primary` — powerCON connector family
- [Mike Holt forums (practitioner forum)](https://forums.mikeholt.com/threads/dimmers-sound-systems.40629/post-626386) — `unverified` — separate feeds for sound and lighting (practitioner forum, not authoritative)

Sources des sous-types (sub-type sources) :
  - `power-distro-box` *unverified* — description, principle : aucune source ouverte (no source opened).
  - `isolation-transformer-conditioner` [Mike Holt forums (practitioner forum)](https://forums.mikeholt.com/threads/dimmers-sound-systems.40629/post-626386) — `unverified` — isolation transformer as a hum fix (forum)
  - `isolation-transformer-conditioner` *unverified* — principle : aucune source ouverte (no source opened).
  - `mains-cable-connector` [Neutrik](https://www.neutrik.com/en/products/lightning/powercon) — `verified-primary` — powerCON
  - `mains-cable-connector` *unverified* — sizing rule : aucune source ouverte (no source opened).

<a id="show-control-interfaces"></a>
## Interfaces de contrôle de spectacle et lumière (marginal) (Show-control & lighting interfaces (marginal)) — *proposé (proposed)*

`show-control-interfaces`

**Rôle** : Interfaces que le technicien son croise sur scène : DMX512 (lumière), MIDI, GPIO, timecode, utilisées pour synchroniser son, lumière et vidéo.

*What it does:* Interfaces a sound technician meets on stage: DMX512 (lighting), MIDI, GPIO, timecode, used to sync sound, light and video.

**Principe** : DMX512 : liaison série RS-485 unidirectionnelle à 250 kbit/s, 512 canaux par univers, connecteur XLR 5 broches, sans correction d'erreur ; transportable sur Ethernet (Art-Net, sACN).

*Principle:* DMX512: unidirectional RS-485 serial link at 250 kbit/s, 512 channels per universe, 5-pin XLR, no error correction; can be carried over Ethernet (Art-Net, sACN).

**Usages typiques (typical uses)** : synchronisation son/lumière (sound/light sync) ; théâtre (theatre)

### Sous-types (sub-types)

| id | Type | Rôle (FR) | Principe (FR) | Principle (EN) | Confiance |
|---|---|---|---|---|---|
| `dmx-interface` | Interface / nœud DMX (DMX interface / node) *proposé* | Interface USB ou réseau (Art-Net/sACN) vers DMX512. | Conversion de paquets réseau en trames DMX série. | Converts network packets into serial DMX frames. | verified-secondary |
| `midi-gpio-interface` | Interface MIDI / GPIO (MIDI / GPIO interface) *proposé* | Interface qui convertit des commandes MIDI ou des contacts secs (GPIO) pour déclencher des appareils. | Messages de contrôle ou fermeture de contact. | Control messages or contact closures. | unverified |

### Sources

- [Wikipedia](https://en.wikipedia.org/wiki/DMX512) — `verified-secondary` — DMX512 physical and protocol facts
- [Production Expert](https://www.production-expert.com/home-page/2016/12/6/timecode-101-part-1) — `verified-secondary` — timecode

Sources des sous-types (sub-type sources) :
  - `dmx-interface` [Wikipedia](https://en.wikipedia.org/wiki/DMX512) — `verified-secondary` — Art-Net/sACN
  - `midi-gpio-interface` *unverified* — description : aucune source ouverte (no source opened).

## Lacunes (gaps)

53 éléments sans source ouverte pendant la session (budget de recherche épuisé) ; liste complète dans `taxonomy.json` → `not_found_log`.
