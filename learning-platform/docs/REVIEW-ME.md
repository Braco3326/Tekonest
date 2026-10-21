# REVIEW-ME — pack de relecture pour un expert BTS Son

**À relire par : un diplômé BTS Métiers du Son.**
**Rédigé le 13 juillet 2026, par l'IA qui a construit le site.**

> ✅ **RELU ET VALIDÉ le 15 juillet 2026** par le propriétaire du projet (diplômé
> BTS Métiers du Son) : aucun point n'a nécessité de correction, y compris les
> suspicions listées en section 2. Ce document est conservé comme trace de la
> démarche de vérification ; toute nouvelle unité de cours devra passer par le
> même processus avant publication.

## Comment lire ce document

Chaque affirmation du cours E3 est citée avec sa localisation exacte (`fichier:ligne`).
Trois niveaux de gravité si l'affirmation s'avère fausse :

- 🔴 **CRITIQUE** — enseignerait un fait faux qui coûterait des points à l'examen, ou minerait la crédibilité « conforme au référentiel » du site.
- 🟠 **MODÉRÉ** — simplification pédagogique contestable, nuance manquante, ou ordre de grandeur discutable.
- 🟢 **FAIBLE** — convention standard du métier, risque faible, cité pour exhaustivité.

Les sections 1 et 2 sont **les plus importantes** : lisez-les même si vous survolez le reste.

---

## 1. ⚠️ D'où vient réellement le contenu — l'aveu principal

**Les fichiers de recherche vérifiés (`db_epreuves_coefficients.csv`, `db_blocs_competences.csv`, `db_grille_horaire.csv`, `db_annales_index.csv`, knowledge base) ne contiennent AUCUN contenu de physique.** Ils contiennent : les coefficients, les formes et durées d'épreuves, les blocs RNCP, la grille horaire, et une liste de liens vers les annales.

Conséquence : **100 % du contenu technique des 6 unités E3 et de l'examen blanc (formules, valeurs, explications, exercices, QCM) provient des connaissances générales du modèle d'IA, pas des sources vérifiées du projet.** L'arithmétique de tous les exercices et des 24 questions d'examen a été revérifiée indépendamment (elle est juste), mais la **physique elle-même n'a été validée par aucun humain**. C'est exactement ce que ce document vous demande de faire.

### 1.b Les affirmations « les annales demandent régulièrement… » ne sont pas sourcées

Le cours affirme plusieurs fois que telle notion est « récurrente dans les annales éduscol 2017–2025 ». **Personne n'a ouvert les PDF des annales** : nous n'avons que leur index (titres + liens). Ces affirmations sont des inférences plausibles présentées comme des faits — sur un site dont le positionnement est la confiance et la transparence. 🔴

Localisations :
- `unit1-acoustique.ts:166` — « Les annales E3 demandent régulièrement : conversion de niveaux…, lecture de courbes isosoniques… »
- `unit2-electricite.ts:99` — « Les annales E3 demandent régulièrement de justifier pourquoi on ne cherche plus l'adaptation d'impédance… »
- `unit4-audionumerique.ts:170` et `:223` — « question classique des annales E3 » (compression avec/sans pertes ; master/slave d'horloge)
- `unit5-traitement.ts:87` et `:190` — idem (identification de filtres ; normalisation crête vs loudness)
- `unit6-supports.ts:102` et `:218` — idem (pré/post-fader ; questions croisées)
- Les en-têtes de commentaire de chaque fichier (« Notions récurrentes des annales E3-PTES (éduscol 2017–2025) »)
- `exam.ts:10` — « construit dans l'esprit des annales officielles (éduscol 2017–2025) »

**Action suggérée** : soit vous confirmez (vous avez passé cette épreuve), soit on reformule en « notions au programme » sans invoquer les annales, soit on lit réellement 2–3 sujets pour vérifier.

---

## 2. 🔴 Les points que je soupçonne moi-même d'être faux ou mal attribués

### 2.1 L'alignement « +4 dBu ↔ −18 dBFS = EBU R68 » — attribution probablement fausse

- `unit1-acoustique.ts:103` — « on cale le niveau nominal vers −18 dBFS (alignement broadcast EBU R68 : +4 dBu ↔ −18 dBFS) »
- `unit6-supports.ts:59` — table : « Entrée convertisseur A/N | +4 dBu ↔ −18 dBFS | Alignement broadcast EBU R68 »
- `unit6-supports.ts:72-79` — l'exercice résolu du gain staging repose sur cette équivalence (−4 dBu → −26 dBFS).

Mon doute : la recommandation **EBU R68** définit le niveau d'alignement à **0 dBu ↔ −18 dBFS** (et un maximum permis à +9 dBu ↔ −9 dBFS). La convention **+4 dBu ↔ −18 dBFS** est une calibration courante de studios et d'interfaces (et la SMPTE américaine utilise +4 dBu ↔ −20 dBFS), mais l'attribuer à « EBU R68 » est vraisemblablement inexact. **L'exercice de l'unité 6 reste arithmétiquement cohérent avec la convention choisie, mais la référence normative citée serait fausse.** À trancher par vous ; correction facile (dire « convention d'alignement courante » ou corriger en « 0 dBu ↔ −18 dBFS (EBU R68) »).

### 2.2 « Ampli casque → casque : adaptation de puissance » — cadrage contestable

- `unit2-electricite.ts:62-63` — la table classe casque ET haut-parleur en « adaptation de puissance ».
- `unit2-electricite.ts:68` — le paragraphe nuance (il précise qu'il n'y a « pas de rapport ×10 recherché » et que l'ampli garde une sortie très basse impédance), mais l'étiquette de la table reste « adaptation de puissance ».

Mon doute : il n'y a **pas d'adaptation d'impédance** ampli→casque ni ampli→HP (Zout ≪ Zcharge, précisément pour le facteur d'amortissement). Dire que le transducteur « reçoit de la puissance » est vrai ; l'étiqueter « adaptation de puissance » risque de faire croire à un Z source = Z charge, ce que le quiz `e3u2-q5` (`unit2:239-249`) encourage un peu. À reformuler si vous confirmez (ex. « transfert de puissance, sans adaptation d'impédance »).

### 2.3 Liaison symétrique : « point froid (même signal, en opposition de phase, même amplitude) »

- `unit2-electricite.ts:141` — définition du symétrique par le signal inversé sur le froid, avec « +6 dB » à la sommation.

Mon doute : la définition rigoureuse du symétrique est l'**égalité des impédances** des deux conducteurs par rapport à la masse — pas la présence d'un signal inversé (les sorties « impedance-balanced » modernes n'envoient rien sur le froid). La présentation choisie est la simplification pédagogique classique, probablement acceptable au niveau BTS, mais vous êtes mieux placé pour dire si l'épreuve attend la définition par les impédances. 🟠

### 2.4 Rendement d'enceinte « typiquement 85 à 95 dB SPL/W/m en sonorisation »

- `unit3-transducteurs.ts:166`

Mon doute : 85–95 correspond plutôt à la hi-fi/monitoring ; les enceintes de **sonorisation** modernes sont souvent à 95–105 dB (voire plus pour les moteurs à compression). L'exercice `unit3:170-179` utilise 96 dB — cohérent — mais la fourchette du texte me semble basse pour de la sono. 🟠

### 2.5 AES3 : « un niveau électrique bien plus élevé que l'analogique »

- `unit4-audionumerique.ts:186`

Mon doute : AES3 c'est 2–7 V crête-à-crête ; une ligne analogique à +4 dBu ≈ 3,5 V crête-à-crête. « Bien plus élevé » est douteux ; ce qui distingue AES3, ce sont les **fronts rapides / hautes fréquences**, pas l'amplitude. Reformulation probable. 🟠

### 2.6 Célérité « c ≈ 344 m/s » à 20 °C

- `unit1-acoustique.ts:23`, table `:36-44`, `exam.ts:15-19`

La valeur standard des tables est **343 m/s** à 20 °C. 344 est utilisé partout dans le cours de façon cohérente (les λ de la table en découlent : 34,4 cm à 1 kHz), et le texte dit « on retient souvent 340 m/s dans les exercices ». Probablement sans conséquence, mais si les sujets E3 utilisent 340, tous les repères chiffrés de la table changent légèrement. 🟢/🟠 — à trancher selon l'usage réel de l'épreuve.

---

## 3. Inventaire des affirmations par thème (à valider)

### 3.1 Acoustique (`unit1-acoustique.ts`)

| Ligne | Affirmation | Gravité si faux |
|---|---|---|
| 23 | +0,6 m/s par °C ; ~1 480 m/s dans l'eau ; ~5 000 m/s dans l'acier | 🟢 |
| 36-44 | Table λ : 17,2 m @20 Hz → 1,72 cm @20 kHz (c = 344) | 🟠 (repères « à connaître ») |
| 66 | −6 dB par doublement de distance en champ libre ; ×10 → −20 dB | 🔴 (formule d'examen) |
| 87-88 | 20·log pour tension/pression, 10·log pour puissance | 🔴 (fondamental) |
| 95 | 0 dB SPL = 20 µPa ; **~94 dB SPL = 1 Pa** ; 120 dB = seuil de douleur | 🔴 (94 dB=1 Pa sert dans l'exercice `unit3:86`) |
| 96 | +4 dBu = 1,23 V ; −10 dBV = grand public | 🟢 |
| 103 | Alignement « EBU R68 : +4 dBu ↔ −18 dBFS » | 🔴 **voir §2.1** |
| 119-122 | +6 dB = tension ×2 ; +20 dB = ×10 ; +3 dB = puissance ×2 ; +10 dB = sonie ×2 | 🔴 (règles d'or) |
| 128 | Non corrélé +3 dB / corrélé +6 dB / opposition de phase = annulation | 🔴 |
| 144 | Audition 20 Hz–20 kHz ; sensibilité max **2–5 kHz** (résonance du conduit) | 🟠 |
| 149 | Courbes « Fletcher & Munson, normalisées ISO 226 » | 🟠 (F&M 1933 ≠ ISO 226:2003 — conflation ?) |
| 153 | dB(A) imite l'oreille à niveau modéré ; quiz dit « inspiré de l'isosonique 40 phones » (`:262`) | 🟠 |
| 158 | Effet de masque → fondement MP3/AAC | 🟢 |
| 159 | Haas : < ~30 ms → localisation sur le premier front | 🟠 (la fenêtre exacte varie selon les sources) |
| 160 | Bandes critiques ≈ 1/3 d'octave | 🟠 (simplification de l'échelle de Bark) |
| 171-176 | Distance critique ; TR60 ; Sabine 0,16·V/A | 🔴 (formule d'examen) |

### 3.2 Références dB et électricité (`unit2-electricite.ts`)

| Ligne | Affirmation | Gravité si faux |
|---|---|---|
| 19 | RMS = « même échauffement qu'une tension continue équivalente » ; les calculs dBu/dBV se font en RMS | 🔴 |
| 23-24 | Ucrête = URMS × √2, sinusoïde uniquement | 🔴 |
| 28 | Facteur de crête musique : « souvent 10 à 20 dB » | 🟠 |
| 43 | 600 Ω historique (téléphonie) → obsolète en audio moderne | 🟢 |
| 47-51 | Règle du bridging Zin ≥ 10 × Zout | 🔴 (règle d'examen) |
| 59-63 | Table d'impédances (micro 150–200 Ω → 1,5–2 kΩ ; ligne 100 Ω → 10 kΩ ; casque « adaptation de puissance ») | 🟠 **voir §2.2** |
| 104 | Niveau micro −60 à −40 dBu ; gain préampli 40 à 70 dB | 🟢 |
| 108 | La DI : abaisse l'impédance (transfo ou FET) et symétrise ; sortie « thru » | 🟢 |
| 118 | Ligne grand public −10 dBV ≈ 0,316 V, « souvent asymétrique (RCA) » | 🟢 |
| 123 | dBu = dBV + 2,21 | 🟢 (2,214 exact) |
| 141 | Symétrique : « même signal, en opposition de phase, même amplitude » ; signal +6 dB | 🟠 **voir §2.3** |
| 145 | CMRR = 20·log(Gdiff/Gmc) | 🟢 |
| 159-162 | XLR : 1 = masse, 2 = chaud, 3 = froid ; TRS = chaud/froid/masse | 🔴 (par-cœur d'examen) |
| 167 | Symétrique : 100 m et plus OK ; asymétrique : quelques mètres | 🟠 |
| 172 | P48 : +48 V sur broches 2 ET 3 via deux résistances de **6,8 kΩ**, invisible en différentiel | 🔴 (valeur normative P48) |
| 176 | Le +48 V alimente polarisation + FET du statique ; électret « auto-polarisé » | 🟢 |
| 181 | Rubans anciens : danger si câblage asymétrique/défaut → courant DC → démagnétisation/rupture | 🟠 (mécanisme exact du dommage à valider) |
| 186 | Boucle de masse → ronflette 50 Hz « et ses harmoniques, souvent 100 Hz » | 🟢 |
| 191 | Ground lift : coupe la masse signal, jamais la terre de sécurité (PE) | 🔴 (sécurité électrique) |

### 3.3 Transducteurs (`unit3-transducteurs.ts`)

| Ligne | Affirmation | Gravité si faux |
|---|---|---|
| 19 | Micro dynamique et HP électrodynamique : même architecture, sens réciproque | 🟢 |
| 24 | Faraday/Lenz ; tension proportionnelle à la **vitesse** | 🟠 (le « proportionnelle à la vitesse » est juste mais souvent mal enseigné) |
| 31 | Sensibilité dynamique ≈ 1–3 mV/Pa | 🟢 |
| 38 | C = ε·S/d ; polarisation +48 V ou électret ; Q = C·U | 🟢 |
| 47 | Sensibilité statique ≈ 10–50 mV/Pa ; conversion d'impédance par FET | 🟢 |
| 51 | Petites membranes < 1 cm ≈ précision/régularité ; grandes ≈ 2,5 cm, bruit propre plus faible | 🟠 (frontières et généralisations) |
| 56 | Ruban : transformateur élévateur intégré | 🟢 |
| 60 | Directivité **native** du ruban = figure en 8 | 🔴 (question d'examen classique, quiz `e3u3-q3`) |
| 73-76 | Sensibilité définie à 1 Pa = 94 dB SPL @1 kHz ; self-noise 7–20 dBA ; SPL max « souvent à 0,5 % THD » | 🟠 |
| 95 | Omni = pression (pas de zéro) ; directifs = gradient de pression | 🔴 (fondamental) |
| 101, 104-113 | Zéros : cardio 180°, **super ≈ ±126°, hyper ≈ ±110°**, huit 90°/270° | 🟠 (valeurs textbook à confirmer) |
| 117 | Effet de proximité : uniquement gradient, explication par courbure du front d'onde | 🟠 |
| 122 | Placement du retour dans un zéro pour limiter le larsen ; comparaison super/hyper | 🟢 |
| 145-148 | XY 90–135° ; AB 40 cm–1 m+ ; **ORTF 17 cm / 110°** ; MS avec matriçage M±S | 🔴 (ORTF = par-cœur d'examen) |
| 154 | Laplace F = B·l·I | 🟢 |
| 166 | Crossover 12/24 dB/oct ; rendement « 85 à 95 dB SPL/W/m en sonorisation » ; impédances 4/8/16 Ω | 🟠 **voir §2.4** |

### 3.4 Audionumérique (`unit4-audionumerique.ts`)

| Ligne | Affirmation | Gravité si faux |
|---|---|---|
| 24-25 | Shannon-Nyquist : fe **strictement** > 2·f_max | 🔴 |
| 33 | f_alias = fe − f (pour fe/2 < f < fe) | 🔴 (formule d'exercice) |
| 39 | Repliement irréversible → filtre anti-repliement avant CAN | 🔴 |
| 60-64 | 44,1 kHz CD / 48 kHz broadcast / 96 / 192 + marges Nyquist | 🟢 |
| 68 | 48 kHz : 1 920 éch/image @25, 1 600 @30, 2 000 @24 | 🟢 (arithmétique vérifiée) |
| 73 | 96/192 kHz : pas d'extension de l'audition, marge filtre + traitements | 🟠 (formulation prudente, débat audiophile) |
| 91 | SNR ≈ 6,02·n + 1,76 | 🔴 |
| 99-103 | 8 bits ≈ 50 dB ; 16 ≈ 98 ; 20 ≈ 122 ; 24 ≈ 146 (théorique) | 🟢 |
| 108 | Dynamique réelle des meilleurs convertisseurs : 120–130 dB | 🟠 |
| 126 | Dither : bruit ~dernier bit, décorrèle l'erreur, indispensable en réduction 24→16 | 🟠 |
| 131 | Niveau nominal d'enregistrement −18 à −12 dBFS | 🟢 |
| 136 | Débit = fe × n × canaux | 🔴 |
| 157-161 | CD 1,411 Mbit/s ; 48/24 stéréo 2,304 Mbit/s ; tailles/minute | 🟢 (arithmétique vérifiée) |
| 165 | FLAC : réduction « typiquement 40 à 50 % », bit-à-bit identique | 🟠 |
| 178-181 | **AES3 : XLR, 110 Ω, 2 canaux, ~100 m · S/PDIF : RCA/TOSLINK, 75 Ω · ADAT : 8 ch @48k, 4 @96k (S/MUX) · MADI (AES10) : 64 ch, BNC 75 Ω/fibre** | 🔴 (chiffres d'examen) |
| 186 | AES3 « niveau électrique bien plus élevé que l'analogique » | 🟠 **voir §2.5** |
| 191 | Câble micro ≠ câble AES3 110 Ω : réflexions, erreurs au-delà de quelques mètres | 🟠 |
| 196 | Dante : couche 3 (IP), Gigabit, Dante Controller, 64 à 512+ canaux | 🟠 (chiffres selon licences/matériel) |
| 200 | AES67 = interopérabilité (Dante, Ravenna, Livewire) ; Ravenna compatible AES67 | 🟢 |
| 205 | Latence Dante réglable 0,25–5 ms | 🟠 |
| 207 | PTP IEEE 1588, grandmaster élu, précision ~µs | 🟢 |
| 214 | Deux maîtres d'horloge → dérive, clics, dropouts | 🔴 (diagnostic d'examen, quiz `e3u4-q10`, exam `e3ex-q16`) |
| 218 | Word clock : coax 75 Ω BNC, terminaison 75 Ω en bout de chaîne ; horloge extractible de l'AES3 ou via PTP | 🟠 |
| 227 | Jitter : bruit + intermodulation à la conversion N/A | 🟠 |
| 236, 246-250 | Latence = buffer/fe ; 256 @48 kHz = 5,3 ms | 🟢 (arithmétique vérifiée) |
| 254 | Seuil de confort ≈ 10 ms | 🟠 |

### 3.5 Traitement du signal (`unit5-traitement.ts`)

| Ligne | Affirmation | Gravité si faux |
|---|---|---|
| 27-32 | Pentes : 6/12/18/24 dB/octave par ordre | 🔴 |
| 36 | Coupe-bas voix : 80–100 Hz, pente raide contre le rumble | 🟢 |
| 56 | Q = f0/Δf (Δf à −3 dB) | 🔴 |
| 74 | EQ graphique : 31 bandes tiers d'octave, fréquences ISO | 🟢 |
| 81 | Anti-larsen : coupure étroite à Q élevé | 🟢 |
| 96 | Sortie = seuil + (entrée − seuil)/ratio | 🔴 (formule d'examen, utilisée 3× dans quiz/exam) |
| 127 | Limiteur ∞:1 brickwall ; gate sous le seuil ; expandeur ; de-esser 4–9 kHz | 🟠 |
| 132 | Voix : ratio ≈ 3:1 ; attaque qq ms–dizaines de ms ; release dizaines–centaines de ms | 🟢 |
| 140 | Pompage : attaque + release trop rapides | 🟠 (l'exam `e3ex-q20` dit « release trop court » — cohérent) |
| 149-154 | Compresseur → insert ; réverb → aux/send-return | 🟠 (règle générale, exceptions existent) |
| 163 | **1 LU = 1 dB ; momentané 400 ms ; court terme 3 s ; intégré = programme entier** | 🔴 |
| 169-173 | **R128 : −23 LUFS (±0,5 à 1 LU) ; True Peak max −1 dBTP ; LRA en LU** | 🔴 (chiffres normatifs, quiz `e3u5-q9/q10`) |
| 190 | Normalisation crête vs loudness (« pondération et gating spécifiques ») | 🟢 |
| 194 | Streaming ≈ −14 LUFS, remonté par la plateforme | 🟠 (varie selon plateformes) |

### 3.6 Supports & équipements (`unit6-supports.ts`)

| Ligne | Affirmation | Gravité si faux |
|---|---|---|
| 23-34 | Chaîne type : source → micro → préampli → traitement → console → bus → conversion → support | 🟢 |
| 45 | Nominal = 0 VU = +4 dBu en pro | 🟠 (0 VU ↔ +4 dBu : convention, mais l'équivalence stricte mérite validation) |
| 49 | Les niveaux s'additionnent en dB | 🔴 |
| 59 | « +4 dBu ↔ −18 dBFS — Alignement broadcast EBU R68 » | 🔴 **voir §2.1** |
| 66 | Le SNR final se joue au préampli micro (premier gain) | 🔴 (concept d'examen, quiz `e3u6-q2`) |
| 95-96 | Pré-fader = retours ; post-fader = effets | 🔴 (règle d'examen, quiz + exam) |
| 107 | Groupe = sommation réelle ; VCA/DCA = contrôle sans audio ; matrice = routage post-bus | 🟠 |
| 112 | Console numérique : scènes, effets intégrés, contrôle déporté, stagebox AoIP | 🟢 |
| 131 | Talkback coupé automatiquement sur le monitoring | 🟠 (« souvent », dépend des consoles) |
| 136 | Line array : maîtrise de la dispersion verticale, atténuation plus lente | 🟠 (simplification de la physique des sources ligne) |
| 141 | Mix-minus (N-1) = programme moins sa propre voix | 🔴 (définition d'examen) |
| 146 | AAF/OMF pour l'échange, BWF pour le rendu | 🟢 |
| 151 | BWF = WAV + métadonnées chunk **bext** (timecode…) | 🟢 |
| 159 | Redondance : cartes miroir, checksum, sauvegarde avant effacement | 🟢 |
| 171-179 | Table connectique (XLR, TRS/TS, RCA, speakON, BNC 75 Ω, RJ45, fibre) | 🟠 |
| 184 | Jamais de XLR/jack pour du HP amplifié → speakON | 🟢 |
| 188 | Câble HP : pas de blindage, grosse section ; câble AES3 110 Ω contrôlé | 🟢 |
| 205 | Micro HF : UHF, émetteur/récepteur | 🟠 (« bande UHF » : il existe aussi du 2,4 GHz/1,9 GHz — généralisation) |
| 209 | Diversity : deux antennes contre le multipath | 🟢 |
| 213 | Réattribution des bandes UHF (téléphonie), coordination de fréquences, intermodulation | 🟠 |

### 3.7 Examen blanc (`exam.ts`) — points spécifiques

L'arithmétique des 24 questions a été revérifiée (juste). Points de fond à valider :

| Ligne | Question | Point à valider | Gravité |
|---|---|---|---|
| 15-19 | q1 | « 344 m/s » comme valeur usuelle (vs 343/340) | 🟢 |
| 151-155 | q13 | « minimale théorique = 40 kHz » alors que le cours dit fe **strictement** > 2·f_max — un puriste répondrait « au-dessus de 40 kHz ». La formulation QCM est-elle acceptable ? | 🟠 |
| 63 | q5 (explication) | « Un micro dynamique **ou à ruban** n'a besoin d'aucune alimentation externe » — vrai pour les rubans passifs, faux pour les rubans actifs | 🟠 |
| 179-186 | q16 | Diagnostic craquements = désynchro d'horloge : le scénario et sa solution sont-ils réalistes tels que formulés ? | 🟠 |
| 221-232 | q20 | Pompage attribué au release trop **court** ; certains l'attribuent aussi à un release trop long mal calé. La réponse « unique » du QCM est-elle défendable ? | 🟠 |

---

## 4. Les 13 hypothèses (ASSUMPTIONS.md) — et ce qui casse si elles sont fausses

1. **Seuil de réussite des quiz d'unité = 70 %** (comme l'examen). *Si faux* : la difficulté de progression est mal calibrée — soit trop laxiste (on arrive à l'examen sans maîtriser), soit trop dure (abandon). Réglable en une constante (`UNIT_QUIZ_PASS`).
2. **Unité complète = leçon ouverte + quiz réussi** (la leçon se marque « lue » automatiquement à l'ouverture). *Si faux* : des étudiants « valident » des leçons sans les lire ; le quiz reste le vrai verrou, mais la statistique de progression ment un peu.
3. **Les prérequis du parcours sont indicatifs, pas bloquants.** *Si faux* (si le vrai besoin est un verrouillage dur) : un étudiant peut attaquer E4 sans E3 — aujourd'hui sans conséquence (E4 est un stub), mais la logique devra devenir bloquante quand E4 ouvrira.
4. **L'examen E3 réel (écrit 6 h de résolution de problèmes) est remplacé par un QCM de 24 questions**, en le disant explicitement. *Si faux* (si les étudiants croient que réussir le QCM = niveau E3) : fausse confiance avant l'épreuve réelle. La page examen l'affiche déjà ; à renforcer si vous jugez le disclaimer insuffisant.
5. **Le certificat PDF passe par la boîte d'impression du navigateur.** *Si faux* (si un vrai PDF téléchargeable est indispensable) : friction utilisateur, mais aucune donnée perdue ; remplaçable sans toucher à l'UI.
6. **Codes de vérification générés par `Math.random` côté client.** *Si faux* (si on considère le certificat comme ayant une valeur probante) : les codes sont falsifiables — c'est déjà documenté comme limite bêta ; le vrai backend devra utiliser un CSPRNG serveur.
7. **Domaine = `tech-nest-web-gamma.vercel.app`** dans metadata/sitemap/robots. *Si faux* (achat d'un vrai domaine) : à changer dans 3 fichiers (`layout.tsx`, `sitemap.ts`, `robots.ts`) sinon le SEO pointe sur le mauvais hôte.
8. **Un cours par épreuve, y compris E51 et E52 séparés.** *Si faux* (si pédagogiquement E5 devrait être un seul cours) : restructuration du catalogue ; les coefficients restent justes.
9. **Vouvoiement, vocabulaire « épreuve/unité/enquête/examen blanc » ; certificats = attestations pédagogiques indépendantes, pas des diplômes.** *Si faux* : risque légal/de ton — le disclaimer sur le certificat est la protection principale, à faire relire si le site grossit.
10. **Le contenu des unités 2–6 + examen a été rédigé par des sous-agents IA** contre un schéma verrouillé et l'exemple de l'unité 1, puis revu (arithmétique seulement). *Si faux* (si la physique contient des erreurs) : **c'est tout l'objet de ce document** — voir sections 1 à 3.
11. **Enquête = 5 questions échelle (obligatoires) + 2 texte libre (optionnelles)**, stockée localement, lue par personne. *Si faux* (si l'enquête doit nourrir des décisions) : les données existent déjà en localStorage, structurées ; il manque juste un backend pour les collecter.
12. **Scaffold Next.js fait à la main** (create-next-app cassé par un cache npx corrompu). *Si faux* : aucune conséquence produit ; risque uniquement si une config par défaut de create-next-app manquait — le build et les tests passent.
13. **Les builds doivent se faire hors du dossier Documents** (FS Windows défaillant : Controlled Folder Access/OneDrive suspecté). *Si faux* (si le problème était transitoire) : aucune conséquence — le repo canonique est désormais `C:\dev\tech-nest-web` de toute façon.

---

## 5. Synthèse — ordre de relecture recommandé

**🔴 À vérifier en premier (30 min) :**
1. §2.1 — l'attribution « EBU R68 » de +4 dBu ↔ −18 dBFS (2 occurrences + 1 exercice).
2. §1.b — les affirmations « récurrent dans les annales » (8 occurrences) : confirmer ou reformuler.
3. Les valeurs normatives d'examen : brochage XLR, P48/6,8 kΩ, ORTF 17 cm/110°, zéros de directivité (126°/110°), AES3 110 Ω / MADI 64 ch / ADAT 8 ch, R128 (−23 LUFS/−1 dBTP/400 ms/3 s), formule du compresseur, 6,02n+1,76, Sabine 0,16, règles +3/+6/+10/+20 dB.
4. La règle pré-fader/post-fader et le mix-minus (définitions sèches d'examen).

**🟠 Ensuite (1 h) :** les simplifications signalées — symétrique par « signal inversé » (§2.3), « adaptation de puissance » casque/HP (§2.2), rendement sono 85–95 (§2.4), niveau AES3 (§2.5), fourchettes (facteur de crête 10–20 dB, self-noise, latence Dante, seuil 10 ms, bandes critiques 1/3 octave, Haas 30 ms).

**🟢 Enfin :** le reste de l'inventaire section 3, en diagonale.

**Comment corriger :** chaque affirmation vit dans un seul fichier de données (`src/data/courses/e3/*.ts`) — modifier le texte ne touche à rien d'autre. Signalez-moi les corrections, je les applique et je redéploie.

---

## 6. Brouillons des cours stubs (E1, E2, E52, E6) — ajouté le 16 juillet 2026, EN ATTENTE DE RELECTURE

Des « programmes envisagés (brouillon) » sont désormais affichés sur les pages des
cours en préparation, chaque point sourcé depuis les fichiers vérifiés (détail
complet : `docs/drafts/plans-cours-stubs.md`, données : `src/data/courses/draftPlans.ts`).
Ils sont marqués « brouillon — à valider par l'expert » dans l'UI et ne sont PAS
présentés comme du contenu de cours. À valider :

| Épreuve | Points à trancher par l'expert |
|---|---|
| E1 CAA | Programme détaillé (notions/œuvres/périodes) ; nature des « 2 situations » CCF ; attentes méthodologiques de l'écrit ; barème |
| E2 Anglais | L'anglais technique audiovisuel est-il au programme ? (plausible, mais AUCUNE source ne le dit) ; niveau CECRL ; articulation avec EF1 facultative |
| E52 EEJ | 🔴 Épreuve la moins documentée (champ notes vide) : programme éco-gestion réel ; déroulé de l'oral 15 min ; l'hypothèse « discipline Économie et gestion ↔ U52 » (similarité de nom uniquement) ; l'hypothèse « secteurs de la filière » |
| E6 Milieu pro | Structure attendue du dossier de stage ; déroulé de l'oral 30 min ; rôle du tuteur ; l'hypothèse « BC04 ↔ E6 » (similarité de nom uniquement) |

Deux entrées marquées « hypothèse à confirmer » sont visibles publiquement sur la
page E52 — si vous préférez qu'aucune hypothèse n'apparaisse tant qu'elle n'est
pas tranchée, dites-le et je les retire de l'UI (elles resteront en docs).
