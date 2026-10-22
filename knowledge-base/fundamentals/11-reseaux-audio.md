---
id: 11-reseaux-audio
title_fr: "Réseaux audio et transports numériques (AoIP, MADI, AVB/Milan)"
title_en: "Audio networks and digital transports (AoIP, MADI, AVB/Milan)"
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel eduscol inaccessible (ECONNRESET). Patcher un stagebox Dante, choisir l'horloge et configurer un switch relèvent de la mise en œuvre (E4)."
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Les transports numériques (MADI, AoIP, horloge PTP) apparaissent dans les questions de chaîne technique d'E3 PTES (unité e3-u4). Non vérifié dans le référentiel."
tekpractice_rules: [R8]
last_checked: 2026-10-22
---

# Réseaux audio (Audio networks and digital transports)

## En bref / In short
Les liaisons point à point (AES3, MADI) laissent place aux réseaux Ethernet qui transportent des centaines de canaux sur un câble. On distingue deux familles. L'**audio sur IP (AoIP)**, de couche 3 : Dante, RAVENNA, Livewire et Q-LAN, rendus interopérables par la norme **AES67** et par son cousin vidéo **SMPTE ST 2110-30** [1][2]. L'**AVB/Milan**, de couche 2 : ses switches réservent la bande passante et synchronisent le réseau avec une grande précision [5]. Dans les deux cas, l'horloge n'est plus un câble BNC mais un protocole, **PTP** (Precision Time Protocol, IEEE 1588) : un appareil devient l'horloge maître du réseau (grandmaster / leader), les autres se calent sur lui [2][6]. La règle R8 reste valable : une seule référence.

## Notions clés (Key concepts)
- **MADI (AES10)** : liaison point à point (entrée et sortie séparées), 64 canaux à 48 kHz, en coaxial 75 Ω (jusqu'à 100 m) ou en fibre multimode (jusqu'à 2000 m). C'est toujours la passerelle universelle entre systèmes [8]. Voir la fiche 10.
- **AES50** : liaison propriétaire de stagebox sur câble Ethernet, mais qui n'est pas un réseau IP (pas de switch). *Non vérifié pendant cette session : aucune source primaire consultée.*
- **Dante (Audinate)** : AoIP le plus répandu en live et en installation. La configuration (routage des flux, horloge, fréquence d'échantillonnage) se fait dans le logiciel Dante Controller ; la fréquence d'échantillonnage se règle sur l'appareil horloge maître du réseau [6]. Les appareils ont souvent deux ports, primaire et secondaire, utilisables en mode **redondant** (deux réseaux physiquement séparés) ou en mode **commuté** (switched, simple switch intégré) [6][7]. Dante utilise nativement PTP version 1 [5] ; les appareils Dante récents annoncent en plus la compatibilité AES67 (par exemple « 64 channels Dante (AES67) » chez RME) [6].
- **RAVENNA** : technologie ouverte, sans licence, de couche 3, synchronisée en PTPv2 (IEEE 1588-2008) et transportée en RTP/UDP en unicast ou multicast [1][4]. AES67 en est un profil [1].
- **AES67 (2013)** : norme d'interopérabilité, qui n'est pas un produit. Elle fixe la synchronisation (IEEE 1588-2008), le transport (RTP/UDP sur IPv4, multicast et unicast), le format (L16/L24, 48 kHz obligatoire, 1 à 8 canaux par flux) et le temps de paquet (1 ms, soit 48 échantillons, obligatoire). Elle **ne définit pas la découverte** des appareils [1][2].
- **SMPTE ST 2110-30** : partie audio de ST 2110 (vidéo sur IP), « variante » d'AES67 avec six niveaux de conformité (A, B, C, AX, BX, CX). Le niveau A correspond essentiellement à AES67 ; les niveaux B et C passent à des paquets de 6 échantillons (125 µs), et C monte à 64 canaux par flux [2]. ST 2110 impose le profil PTP SMPTE ST 2059-2 et IGMPv3, là où AES67 demande IGMPv2 [2].
- **PTP** : les appareils échangent des messages horodatés et mesurent les délais de transport pour aligner leur horloge sur le maître, élu automatiquement par l'algorithme BMCA (Best Master Clock Algorithm) [2][5]. PTPv2 ajoute des horloges dans les switches (boundary clocks / transparent clocks) qui corrigent les temps de traversée [5].
- **AVB / Milan** : AVB est une suite IEEE de couche 2 : gPTP 802.1AS (synchronisation), 802.1Qav (mise en forme du trafic à crédits, credit-based shaper), 802.1Qat SRP (réservation de bande passante de bout en bout) [5]. Milan, lancé en 2016 par d&b, L-Acoustics, Meyer Sound et d'autres sous l'égide de l'Avnu Alliance, fixe les détails d'implémentation : format AAF 32 bits, flux de 1, 2, 4, 6 ou 8 canaux (jusqu'à 60 en haute capacité), redondance, gestion des domaines d'horloge [5]. AVB ne traverse pas les routeurs (adresses MAC uniquement) [5].
- **Qualité de service (QoS, DiffServ/DSCP)** : sur un réseau IP, les paquets PTP et audio sont marqués d'une priorité (DSCP) que les switches doivent respecter. Recommandations RAVENNA : **CS6** pour les messages d'événement PTP, **EF** ou **AF41** pour l'audio, avec une priorité inférieure à celle du PTP [3]. Pour Dante (Focusrite RedNet), le switch doit offrir des ports Gigabit, une QoS à 4 files et une priorité DSCP stricte (strict priority) ; un switch administrable (managed) est recommandé [7].
- **Multicast et IGMP** : un flux multicast va à plusieurs récepteurs. Sans **IGMP snooping**, le switch le diffuse sur tous ses ports ; il faut au moins un **querier IGMP** sur le réseau [3][5].
- **Redondance (redundancy)** : deux réseaux physiquement indépendants, primaire et secondaire, portant des flux identiques ; RAVENNA prend en charge SMPTE ST 2022-7 (seamless protection switching) [3]. Un paquet perdu ne se récupère pas sur un réseau non redondant [3].

## Formules (Formulas)
- **Temps de paquet AES67** : t_paquet = N_échantillons / fe ; 48 échantillons à 48 kHz = 1 ms (valeur AES67 obligatoire), 6 échantillons = 125 µs (ST 2110-30 niveaux B et C) [2].
- **Budget de latence Milan** : par convention, un tampon de 2 ms dans les récepteurs ; avec environ 125 µs par saut de switch et une marge, cela limite le chemin à 14 sauts [5]. En Gigabit, 1 ms de latence est atteignable sur 7 sauts [5].
- **Exigence de synchronisation en sonorisation** : un écart de phase de 10° à 20 kHz entre deux éléments correspond à environ 1 µs, et entraîne au plus 0,1 dB de perte en sommation électrique [5].
- **Écarts mesurés (essai à 6 switches chargés)** : PTPv1 jusqu'à ±2500 µs au 6e saut sous fort trafic ; PTPv2 de ±4 à ±4,5 µs ; gPTP (802.1AS) ±0,063 µs [5]. Prudence : ces chiffres viennent d'un article coécrit par des fabricants membres de Milan.

## Erreurs fréquentes (Common mistakes)
- **Switch « bureautique » non administrable, sans QoS** : clics et pertes dès que le trafic de contrôle augmente. Correct : switch Gigabit administrable, DSCP en priorité stricte, IGMP snooping avec un querier [3][7].
- **Mélanger réseaux primaire et secondaire** (relier les deux sur le même switch) : la redondance disparaît. Correct : deux infrastructures physiquement séparées [3].
- **Deux horloges maîtres** (un appareil réglé en maître en word clock, un autre élu leader PTP) : instabilité. Correct : une seule référence pour tout le système, avec une fréquence d'échantillonnage fixée sur le maître (règle R8) [6].
- **Croire qu'AES67 suffit pour « voir » les appareils** : AES67 ne définit aucune découverte ; il faut configurer les flux (SDP) ou passer par l'outil du fabricant [1][2].
- **Plage multicast incohérente entre AES67 et ST 2110** : AES67 impose la plage 239.0.0.0 à 239.255.255.255, ST 2110 n'impose rien ; certains appareils AES67 stricts ne recevront pas un flux hors de cette plage [2].
- **Faire passer AVB à travers un routeur** : impossible (couche 2) ; il faut une passerelle [5].
- **Câblage** : préférer du Cat 6 blindé (STP), avec des connecteurs etherCON ou RJ45 blindés [7].

## Lien avec le matériel (Equipment links)
- Stageboxes et E/S Dante : `yamaha-rio3224-d2`, `yamaha-tio1608-d`, `focusrite-rednet-mp8r`, `focusrite-rednet-x2p`, `audinate-dante-avio-analog-input-2ch`, `audinate-dante-avio-aes3`, `rme-digiface-dante`.
- Consoles Dante natives : `yamaha-ql1`, `yamaha-cl5`, `yamaha-dm7`.
- AES50 (Midas/Klark Teknik) : `midas-dl16` ; DiGiCo/MADI/Optocore : `digico-sd-rack` ; Allen & Heath (liaison propriétaire) : `allen-heath-ar2412`, `allen-heath-dx168`.
- MADI et passerelles : `rme-m-32-ad`, `directout-prodigy-mc`.
- AoIP radio (Livewire+/AES67) : `axia-iq`, `lawo-ruby`.
- Switches : `luminex-gigacore-16t`, `netgear-m4250-10g2xf-poe-plus`.
- Milan/AVB côté diffusion : `l-acoustics-la7-16`, `l-acoustics-la12x`, `db-audiotechnik-ds10`, `db-audiotechnik-ds20`.
- Règle TekPractice : R8 (une seule horloge de référence, même fréquence partout).

## Pour aller plus loin (Best sources)
- [2] Comparatif RAVENNA / AES67 / ST 2110 (2 pages) : le meilleur tableau de synthèse (paquets, canaux, PTP, IGMP, multicast, niveaux A/B/C).
- [1] *AES67 and RAVENNA in a nutshell* : historique (AES-X192, 2013) et ce que normalise AES67.
- [3] *RAVENNA Network Requirements* : liste concrète des réglages de switch (DSCP, IGMP, redondance).
- [5] Kaltheuner et al., AES 2024 : pourquoi la sonorisation se tourne vers AVB/Milan, avec des chiffres de précision PTP. Le point de vue est celui des fabricants de Milan : à croiser avec les documents Audinate.
- [6][7] Manuels RME Digiface Dante et Focusrite RedNet : vision pratique de Dante (ports primaire/secondaire, maître d'horloge, exigences des switches).
- Lacune : les pages officielles audinate.com, avnu.org et aes.org ont renvoyé une erreur 403 pendant cette session ; les valeurs Dante par défaut (latence, DSCP) restent à vérifier dans la documentation Audinate.

## Sources
1. A. Hildebrand / ALC NetworX, *AES67 and RAVENNA in a Nutshell*, ravenna-network.com, https://ravenna-network.com/wp-content/uploads/2020/02/AES67-and-RAVENNA-in-a-nutshell.pdf, accessed 2026-10-22, verified-primary
2. RAVENNA (Lawo), *RAVENNA, AES67 & SMPTE ST 2110 – Standards Comparison* (V03), https://www.ravenna-network.com/wp-content/uploads/2024/04/RAVENNA_RAVENNA-AES67-ST-2110-Comparison_V03.pdf, accessed 2026-10-22, verified-primary
3. ALC NetworX, *RAVENNA Network Requirements* V1.4b, https://www.ravenna-network.com/wp-content/uploads/2023/01/RAVENNA-Network-Requirements-V1.4b.pdf, accessed 2026-10-22, verified-primary
4. RAVENNA, *Technology* (web page), https://www.ravenna-network.com/technology/, accessed 2026-10-22, verified-primary
5. H. Kaltheuner, G. Kronauer, M. Lave, E. Corteel, *Requirements and Solutions for Audio Networking in Sound Reinforcement Systems*, AES International Acoustics & Sound Reinforcement Conference, Le Mans, 2024 (hosted by L-Acoustics), https://prdstglaxxwe001.blob.core.windows.net/webapp-lacoustics/Education/scientific_resources/scientific_publications/2024-Requirements_and_Solutions_for_Audio_Networking_in_Sound.pdf, accessed 2026-10-22, verified-primary
6. RME, *Digiface Dante User's Guide*, https://www.rme-audio.de/downloads/dface_dante_e.pdf, accessed 2026-10-22, verified-primary
7. Focusrite, *RedNet System User Guide* 1.0, https://fael-downloads-prod.focusrite.com/customer/prod/downloads/rednet-system-user-guide_0.pdf, accessed 2026-10-22, verified-primary
8. RME, *HDSPe MADI FX User's Guide*, https://www.rme-audio.de/downloads/hdspemadifx_e.pdf, accessed 2026-10-22, verified-primary
