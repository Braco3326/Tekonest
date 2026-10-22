---
id: 17-workflow-radio-broadcast
title_fr: Workflow radio et diffusion
title_en: Radio and broadcast workflow
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    note: "BC02 lists 'exploiter les outils de diffusion sonore' and 'gérer les ressources de codage audio pour le transfert et/ou la diffusion' (checked on France Compétences RNCP37196); eduscol référentiel PDF unreachable this session."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
  - epreuve: E3
    bloc: BC01
    savoirs: "not verified"
    verified: false
    note: "BC01 includes 'analyser les spécificités des transferts et/ou du canal de diffusion'; loudness (LUFS) and codec/IP transport are PTES-style topics, not checked against the référentiel."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
tekpractice_rules: [R2, R5, R6, R7, R8]
last_checked: 2026-10-22
---

# Workflow radio et diffusion (Radio and broadcast workflow)

## En bref / In short
Une radio s'organise autour d'un studio (studio, où sont les micros des animateurs et des invités) et d'une régie (control room, où se trouve la console d'antenne, on-air console). La console d'antenne est conçue pour la sécurité de l'antenne : bus programme (program buses), pré-écoute (cue/preview), talkback, mixes N-1 automatiques pour les invités à distance, commandes logiques (GPIO) qui allument le voyant ON-AIR [1]. Les invités en duplex arrivent par un codec (codec) audio sur IP ou par le téléphone, et doivent recevoir un retour sans leur propre voix : c'est le N-1 (mix-minus). En diffusion, l'EBU recommande de produire à −23,0 LUFS avec des crêtes vraies sous −1 dBTP, y compris pour la radio [2][3]. Ces notions correspondent aux niveaux TekPractice B1 (Radio) et C1 (Duplex/N-1).

## Notions clés (Key concepts)
- **Studio / régie** : séparés par une vitre. La régie a ses écoutes ; le studio a des casques et parfois des écoutes coupées automatiquement quand un micro du studio est ouvert (règle R6).
- **Console d'antenne (on-air console)** : exemple de l'Axia iQ, 3 bus programme stéréo plus un bus utilitaire (téléphone, enregistrement hors antenne), pré-écoute sur chaque tranche, talkback vers les invités et les sources téléphone/codec, et jusqu'à 8 mix-minus automatiques en même temps [1]. Le moteur combine E/S audio, mixage et commutateur AoIP (audio over IP) [1].
- **GPIO et voyant ON-AIR** : la console envoie des contacts (contact closures) et des commandes GPIO vers les appareils du studio [1]. Quand un micro est ouvert à l'antenne, le voyant rouge doit s'allumer (règle R5).
- **Diffusion automatisée (playout)** : un logiciel joue la playlist, les jingles et les pubs ; la console peut déclencher ses événements depuis des touches de tranche [1].
- **Codec et duplex** : un codec comme l'AETA Scoop5 S est un appareil rack « full duplex » qui transmet et reçoit en même temps, en IP (Ethernet, 3G/4G, Wi-Fi) ou en RNIS (ISDN) selon les options, avec des algorithmes comme G.711, G.722, MPEG Layer II, AAC ou Opus, et la signalisation SIP [4].
- **Interopérabilité des codecs** : la spécification EBU Tech 3326 impose RTP sur UDP comme transport et des codecs obligatoires : G.711, G.722 à 64 kbit/s, MPEG-1/2 Layer II et PCM 16 bits ; ports par défaut 5004 (RTP) et 5005 (RTCP) [5]. La gestion de session se fait en SIP [5].
- **N-1 (mix-minus)** : le retour envoyé à un invité distant contient tout le programme *sauf* sa propre voix. Sinon l'invité s'entend avec retard et l'écho rend l'échange impossible (règle R7). Les consoles d'antenne génèrent ce mix automatiquement par tranche [1].
- **Sonie (loudness) en radio** : le supplément R 128 s3 demande de séparer production et distribution. On produit à −23,0 LUFS et ≤ −1 dBTP, on échange les programmes avec ces valeurs [3]. Par défaut la distribution vise aussi −23,0 LUFS ; si une station choisit un autre niveau de distribution, il devrait se situer entre −20,0 et −16,0 LUFS [3].
- **Mesure** : sonie de programme selon ITU-R BS.1770 et EBU Tech 3341 ; tolérance ±1,0 LU pour le direct quand la cible n'est pas atteignable [2].

## Formules (Formulas)
- **Cible de production** [2][3] : L_programme = −23,0 LUFS ; crête vraie ≤ −1 dBTP ; tolérance ±1,0 LU pour les programmes en direct [2] ; ±0,2 LU de marge d'erreur de mesure en contrôle qualité [2].
- **Niveau de distribution radio** [3] : −23,0 LUFS par défaut, sinon dans [−20,0 ; −16,0] LUFS.
- **N-1 (définition)** : retour_invité = programme − voix_invité (l'invité reçoit tout sauf son propre signal ; R7).

## Erreurs fréquentes (Common mistakes)
- **Renvoyer le programme complet à l'invité en duplex** : il entend sa voix retardée. On utilise le N-1 (R7) [1].
- **Micro ouvert sans voyant ON-AIR** : quelqu'un entre en parlant pendant le direct (R5).
- **Écoutes de la régie ouvertes avec un micro ouvert dans la même pièce** : larsen (R6).
- **Régler la radio « au crête-mètre » seulement** : la normalisation par les crêtes crée de gros écarts de sonie entre programmes ; l'EBU recommande de normaliser sur la sonie [2].
- **Confondre production et distribution** : on produit à −23 LUFS ; le traitement FM et le niveau de distribution sont décidés ensuite [3].
- **Codecs incompatibles** : vérifier l'algorithme, le transport (RTP/UDP) et la signalisation SIP des deux côtés [4][5].
- **Horloges numériques non synchronisées** entre la console et les E/S : clics (R8).

## Lien avec le matériel (Equipment links)
- Consoles : `axia-iq`, `lawo-ruby`, `calrec-brio`.
- Micros : `ev-re20` (studio), `ev-re50` (reportage).
- Écoute : `genelec-8030c`, `beyerdynamic-dt-770-pro`, `sennheiser-hmd-26`.
- Enregistreurs : `tascam-ss-cdr250n`.
- Appareils du catalogue TekPractice pas encore dans `knowledge-base/equipment` : `aeta-scoop5-s`, `aeta-scoopy-plus-s`, `yellowtec-mika`, `yellowtec-litt`, `playout-pc`.
- Règles TekPractice : R2, R5 (ON-AIR), R6 (coupure des écoutes), R7 (N-1), R8 (horloge).

## Pour aller plus loin (Best sources)
- [1] Brochure Axia iQ : bonne illustration concrète d'une console d'antenne (bus, mix-minus, talkback, GPIO).
- [2] EBU R 128 : la base de la sonie en diffusion, 5 pages.
- [3] EBU R 128 s3 : le texte spécifique à la radio (production et distribution, FM).
- [4] Fiche AETA Scoop5 S : exemple de codec de reportage et de studio.
- [5] EBU Tech 3326 : interopérabilité des codecs IP (transport, codecs obligatoires).
- [6] EBU Tech 3401 : guide pratique pour appliquer R 128 en radio (FM, DAB, streaming).

## Sources
1. Telos Alliance, *Axia iQ — The Smarter IP Console* (brochure), https://telosalliance-uat.s3.us-east-1.amazonaws.com/public/Axia+Products/iQ/Brochures/Axia-iQ+Console-Brochure-C25316094.pdf, accessed 2026-10-22, verified-primary
2. EBU, R 128 "Loudness normalisation and permitted maximum level of audio signals", v5.0 (Nov. 2023), https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf, accessed 2026-10-22, verified-primary
3. EBU, R 128 s3 "Loudness in Radio" (v2.0, Nov. 2023), https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128s3.pdf, accessed 2026-10-22, verified-primary
4. AETA Audio Systems, Scoop5 S product page, https://www.aeta-audio.com/products/scoop5s/, accessed 2026-10-22, verified-primary
5. EBU, Tech 3326 "Audio Contribution over IP — Requirements for Interoperability", Rev. 4 (Nov. 2014), https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3326.pdf, accessed 2026-10-22, verified-primary
6. EBU, Tech 3401 "Guidelines for Radio production and distribution in accordance with EBU R 128" (v2.0, Nov. 2023), https://tech.ebu.ch/publications/tech3401, accessed 2026-10-22, verified-secondary (publication page only)
7. France Compétences, fiche RNCP37196, https://www.francecompetences.fr/recherche/rncp/37196/, accessed 2026-10-22, verified-primary
