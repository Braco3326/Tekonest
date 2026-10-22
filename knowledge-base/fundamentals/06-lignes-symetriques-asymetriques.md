---
id: 06-lignes-symetriques-asymetriques
title_fr: Liaisons symétriques et asymétriques, masse et boucles de masse
title_en: Balanced and unbalanced lines, grounding and ground loops
bts_mapping:
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel PDF injoignable (ECONNRESET). Liaison symétrique, CMRR et masse sont au programme de l'unité e3-u2 de la plateforme (annales E3)."
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Câblage, diagnostic de ronflette et usage des DI = pratique évaluée en E4; codes non lus."
tekpractice_rules: [R1, R2, R4]
last_checked: 2026-10-22
---

# Liaisons symétriques et asymétriques (Balanced and unbalanced lines)

## En bref / In short
Dans une liaison asymétrique (unbalanced), le blindage (shield) fait partie du circuit de retour du signal, ce qui l'expose aux parasites électromagnétiques [1]. Dans une liaison symétrique (balanced), le signal circule sur deux conducteurs, le blindage ne transporte pas le signal, et chaque conducteur présente la même impédance par rapport à la masse : un parasite induit identiquement sur les deux (mode commun, common mode) est rejeté par l'entrée différentielle [1]. La qualité de ce rejet se mesure par le CMRR (common mode rejection ratio) [2]. Sur la XLR, la broche 1 est le blindage, la broche 2 le point chaud (hot), la broche 3 le point froid (cold) [3][4]. Les ronflettes (hum) viennent le plus souvent de boucles de masse et du « pin 1 problem » [5][6].

## Notions clés (Key concepts)
- **Symétrie d'impédance avant tout** : ce qui définit une ligne symétrique, c'est l'égalité des impédances de chaque conducteur vers la masse, sur l'appareil émetteur, le câble et le récepteur ; sinon la ligne n'est plus symétrique [1][2].
- **Symétrie de signal vs symétrie d'impédance (impedance balancing)** : on peut avoir les deux conducteurs en opposition de phase (électronique ou transformateur), ou seulement une impédance équilibrée avec le signal sur la broche 2 et la broche 3 en référence ; avantage du second : même amplitude que l'entrée soit symétrique ou non [1].
- **CMRR** : exprime la suppression du bruit induit en mode commun ; plus il est élevé, mieux c'est [2]. Exemples : ≈ 65 dB pour un préampli DPA MMP-A [2] ; ≈ 80 dB possible avec un étage à transformateur, ≥ 60 dB avec l'équilibrage d'impédance actif DPA [7].
- **Appariement** : l'écart entre les résistances d'alimentation fantôme doit être < 0,4 % pour préserver le CMRR [8] (voir 05-alimentation-fantome).
- **Brochage XLR (pin 2 hot)** : broche 1 masse/blindage, 2 = polarité positive (hot), 3 = polarité négative (cold) ; l'AES14-1992 couvre polarité et genre des XLR ; l'IEC 61076-2-103 en fixe les dimensions [3]. Les fabricants confirment : sur le Shure SM58, une pression positive donne une tension positive sur la broche 2 par rapport à la 3 [4] ; Schoeps : broche 2 = +phase [8]. L'IEC 60268-12 (souvent citée pour le brochage) n'a pas été vérifiée dans une source lue (gap).
- **Historique** : avant la normalisation, les Américains câblaient souvent en pin 3 hot, les Européens et Japonais en pin 2 hot ; pin 3 hot subsiste sur du matériel ancien [3].
- **Jack TRS** : tip = chaud, ring = froid, sleeve = masse (convention de la plateforme, unité e3-u2) ; le jack mono TS est asymétrique.
- **Boucle de masse (ground loop)** : se forme quand deux appareils sont reliés à la masse par plus d'un chemin (terre secteur + blindage, rails de rack) ; la ronflette apparaît quand le courant de boucle passe par la masse de signal d'un appareil [5]. Des liaisons symétriques bien réalisées rejettent ce courant [5].
- **Pin 1 problem** : beaucoup d'appareils relient le blindage (broche 1) à la masse de signal plutôt qu'au châssis ; le courant de blindage module alors la masse audio et produit ronflette et buzz [6]. Remède côté conception : relier le blindage au châssis au point d'entrée ; « le blindage doit fonctionner comme une extension du boîtier » [6].
- **AES48** : *AES48-2005: AES standard on interconnections – Grounding and EMC practices – Shields of connectors in audio equipment containing active circuitry* ; recommande des liaisons symétriques avec blindage relié au châssis au point d'entrée, aux deux extrémités [5].
- **Lever la masse (ground lift)** : couper le blindage côté récepteur supprime la ronflette basse fréquence mais expose davantage aux interférences radio (RF) ; un condensateur céramique de 0,1 ou 0,01 µF entre blindage levé et châssis restitue un chemin RF [5][6]. Rane juge que les interrupteurs de ground lift améliorent rarement le bruit et doivent rester une solution temporaire [5].
- **Sécurité** : les moyens de mise à la terre d'origine doivent être conservés pour la sécurité ; vérifier que chaque châssis est relié à une bonne terre [5]. On ne coupe jamais la terre secteur pour supprimer une ronflette ; on agit sur le blindage audio ou on isole par transformateur.
- **Mélange symétrique/asymétrique** : les deux mondes ne sont pas conçus pour se raccorder directement [5][6]. Garder les liaisons asymétriques sous 3 m (10 ft) et les isoler par transformateur si possible [5].
- **Boîte de direct (DI box)** : convertit une source asymétrique haute impédance (instrument) en sortie symétrique basse impédance. Radial JDI (passive, transformateur) : entrée 140 kΩ asymétrique, sortie 150 Ω symétrique, ground lift [9]. Radial J48 (active, alimentée en +48 V) : entrée 220 kΩ, sortie 200 Ω, ground lift [10].

## Formules (Formulas)
- **CMRR (définition usuelle)** : CMRR_dB = 20·log10(G_d / G_mc), G_d gain différentiel, G_mc gain de mode commun (sans unité). Cette équation n'apparaît pas telle quelle dans les sources lues ; elle est cohérente avec DPA, pour qui 60 à 65 dB signifient que moins d'un millième du bruit passe (20·log10(1000) = 60 dB) [2][7]. Formule utilisée par la plateforme (unité e3-u2).
- **Perte avec certaines adaptations sym/asym** : un des câblages spéciaux du tableau de Rane entraîne 6 dB de perte, à compenser par le niveau du système [5].

## Erreurs fréquentes (Common mistakes)
- Penser que le blindage « fait » la symétrie : c'est l'égalité des impédances et l'entrée différentielle qui rejettent le bruit [1].
- Relier un jack TS à une sortie symétrique active sans vérifier : risque de perte ou de bruit ; utiliser un câblage adapté ou un transformateur [5].
- Supprimer la terre secteur (adaptateur sans terre, broche coupée) pour chasser une ronflette : les moyens de mise à la terre d'origine doivent rester intacts pour la sécurité [5].
- Mélanger polarités (pin 3 hot sur matériel ancien) : inversion de phase entre micros [3].
- Brancher une sortie instrument directement sur une entrée micro : utiliser une DI (règle R2, signal `instrument-hiz`).
- Laisser le fantôme sur une liaison asymétrique ou un adaptateur douteux (R4) [8].

## Lien avec le matériel (Equipment links)
- DI : `radial-jdi`, `radial-prodi`, `radial-j48`, `countryman-type-85`, `klark-teknik-dn100-v2`, `behringer-di100`, `palmer-pan-01`.
- Isolation/ligne : `radial-jcr`, `radial-js2`, `radial-proms2`, `ebtech-hum-eliminator-he-2`.
- TekPractice **R1** (`xlr3-m` ↔ `xlr3-f`, `trs-quarter` vs `ts-quarter`), **R2** (`line-level-pro` symétrique vs `line-level-consumer` asymétrique : `playout-pc` sortie `trs-35mm`), **R4** (fantôme sur ligne asymétrique).

## Pour aller plus loin (Best sources)
- [5] RaneNote 110 *Sound System Interconnection* : la référence pratique (AES48, boucles de masse, tableau de câblages sym/asym).
- [6] RaneNote 151 *Grounding and Shielding Audio Devices* : le pin 1 problem expliqué côté conception.
- [1][2] DPA : définitions simples de la ligne symétrique et du CMRR, adaptées à une première approche.
- Normes AES14 et AES48 (aes.org, inaccessible en 403 pendant la session) : à consulter directement pour citer les textes.

## Sources
1. DPA Microphones, "About balanced and unbalanced lines", Mic University, https://www.dpamicrophones.com/mic-university/technology/about-balanced-and-unbalanced-lines/, accessed 2026-10-22, verified-primary
2. DPA Microphones, "Electromagnetic interference: EMC, RFI immunity and CMRR", https://www.dpamicrophones.com/mic-university/technology/electromagnetic-interference-emc-rfi-immunity-and-cmrr/, accessed 2026-10-22, verified-primary
3. Wikipedia, "XLR connector" (cites AES14-1992, IEC 61076-2-103, AES48-2005), https://en.wikipedia.org/wiki/XLR_connector, accessed 2026-10-22, verified-secondary
4. Shure, "SM58 Product Specifications" (polarity statement), https://collegeofsanmateo.edu/theatre/docs/sm58_specsheet.pdf, accessed 2026-10-22, verified-primary
5. Rane (Dennis Bohn), "RaneNote 110 – Sound System Interconnection", https://www.ranecommercial.com/legacy/note110.html, accessed 2026-10-22, verified-primary
6. Rane (Steve Macatee), "RaneNote 151 – Grounding and Shielding Audio Devices", https://www.ranecommercial.com/legacy/note151.html, accessed 2026-10-22, verified-primary
7. DPA Microphones, "Impedance balancing with active drive vs. transformer coupled output", https://www.dpamicrophones.com/mic-university/technology/impedance-balancing-with-active-drive-vs-transformer-coupled-output/, accessed 2026-10-22, verified-primary
8. SCHOEPS GmbH, "Colette Series – CMC/MK user manual (EN)", https://schoeps.de/fileadmin/user_upload/user_upload/Downloads/Bedienungsanleitungen/SCHOEPS_Manual_CMC_MK_E_2015-10-03_1444311033__1_.pdf, accessed 2026-10-22, verified-primary
9. Radial Engineering, "JDI – Specifications", https://www.radialeng.com/product/jdi/specifications/, accessed 2026-10-22, verified-primary
10. Radial Engineering, "J48 – Specifications", https://www.radialeng.com/product/j48/specifications/, accessed 2026-10-22, verified-primary
