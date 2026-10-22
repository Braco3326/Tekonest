---
id: 09-ecoute-retours-mix-minus
title_fr: "Écoute, retours et mix-minus (N-1)"
title_en: "Monitoring, foldback and mix-minus (N-1)"
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Référentiel eduscol inaccessible (ECONNRESET). Mettre en place les retours, l'écoute régie et un duplex N-1 relève de la mise en œuvre pratique (E4)."
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Les conditions d'écoute normalisées (niveau de référence, géométrie stéréo) sont des notions de physique et de technique attendues en E3 PTES. Non vérifié dans le référentiel."
tekpractice_rules: [R5, R6, R7]
last_checked: 2026-10-22
---

# Écoute, retours et mix-minus (Monitoring, foldback and mix-minus)

## En bref / In short
« Écouter » recouvre plusieurs circuits distincts : l'écoute de la régie (control room monitoring), la pré-écoute ou cue (PFL/AFL), les retours de scène en wedges (foldback) ou en ear-monitors (in-ear monitors, IEM), et le retour envoyé à un intervenant distant (codec, téléphone). Pour ce dernier, la règle d'or est le **mix-minus**, appelé **N-1** en France : on envoie à l'invité tout le programme **sauf sa propre voix** [1]. Sinon, il s'entend revenir avec le retard de la liaison, ce qui le rend inutilisable (règle R7). En studio radio, ouvrir un micro doit couper les haut-parleurs de la pièce pour éviter le larsen (feedback) [2] (règle R6).

## Notions clés (Key concepts)
- **Écoute régie (control room monitoring)** : enceintes de proximité (nearfield) alimentées par la sortie monitor de la console. La source écoutée est sélectionnable : programme (PGM), pré-écoute, entrée externe.
- **Niveau d'écoute de référence (reference listening level)** : selon l'EBU, on règle chaque voie avec un bruit rose à −18 dBFS (−9 dB sous le niveau maximal permis en analogique), et on ajuste le gain pour obtenir au point d'écoute 85 − 10·log(n) dB(A), n étant le nombre d'enceintes principales [3]. L'écart entre deux voies ne doit pas dépasser 1 dB [3].
- **Géométrie stéréo** : angle de base optimal de 60° (±30°), distance d'écoute h ≈ 0,9 × b, base b comprise entre 2 et 4 m, tête à environ 1,2 m du sol [3].
- **Acoustique de la régie** : les réflexions précoces (moins de 15 ms après le son direct) doivent être au moins 10 dB sous le son direct entre 1 et 8 kHz ; la surface de la console est une source typique de réflexion forte [3].
- **Pré-écoute / cue (PFL, AFL)** : vérifier une source au casque ou dans une enceinte de cue sans la passer à l'antenne. Voir la fiche 08.
- **Coupure des écoutes sur micro ouvert (monitor mute)** : sur une console radio (Axia iQ), dès que la tranche micro passe sur On, les haut-parleurs de la régie se coupent et l'animateur passe au casque [2]. Le même état « micro ouvert » commande en général le voyant ON AIR (tally) par GPIO (règle R5).
- **Retours de scène (foldback, wedges)** : mélanges auxiliaires **pré-fader**, un par musicien ou par groupe de musiciens. On peut aussi écouter un bus solo dans un wedge de contrôle : la SD12 permet d'affecter un bus solo aux IEM et l'autre à un wedge [4].
- **Ear-monitors (IEM)** : liaison HF stéréo vers un récepteur de ceinture. En mode **Focus** (Sennheiser G4), les deux voies émises sont additionnées en mono au récepteur et la balance règle le dosage entre elles, par exemple « ma voix » contre « le reste du groupe » [5]. Le limiteur du récepteur protège l'audition ; le fabricant recommande de le régler le plus bas possible [5].
- **Mix-minus / N-1** : « le mélange de toutes les sources que l'appelant doit entendre, moins l'appelant » [1]. L'appelant téléphonique s'entend déjà dans son combiné (effet local, side-tone) [1] ; en codec IP, sa voix reviendrait avec la latence de la liaison.
- **Types de contribution (EBU)** : unidirectionnelle sans retour (satellite) ; bidirectionnelle avec retour bande étroite pour le cue (concert, commentaire sportif), où la latence n'est pas gênante ; bidirectionnelle large bande (interview, débat), où la latence devient un problème [6].
- **Codecs (audio contribution over IP)** : pour l'interopérabilité, l'EBU Tech 3326 impose G.711 et G.722 à 64 kbit/s [6], ainsi que l'établissement de session par SIP.
- **Hybride téléphonique (telephone hybrid)** : sépare la voix de l'appelant de ce qu'on lui envoie sur une ligne analogique 2 fils. Ses performances se mesurent par l'affaiblissement trans-hybride (trans-hybrid loss), supérieur à 55 dB sur le Telos Hx [7].

## Formules (Formulas)
- **Niveau d'écoute de référence** : L_LISTref = 85 − 10·log10(n) dB(A), mesuré en pondération A, RMS, constante lente (slow), avec un bruit rose à −18 dBFS par voie ; n = nombre d'enceintes principales [3]. Exemple : en stéréo, n = 2, donc L ≈ 82 dB(A) par voie.
- **Distance d'écoute stéréo** : h ≈ 0,9·b (h = distance d'écoute en m, b = écartement des enceintes en m, 2 m < b < 4 m) [3].
- **Mix-minus** : N-1 = Σ(sources du programme) − (retour de l'intervenant concerné). Avec plusieurs intervenants distants, il faut **un N-1 par intervenant** [1].

## Erreurs fréquentes (Common mistakes)
- **Envoyer le PGM complet au codec** : l'invité entend sa propre voix retardée (écho). Correct : un bus N-1 dédié, dont la tranche retour codec est exclue (règle R7) [1].
- **Un seul N-1 pour deux appelants** : chacun doit entendre l'autre, mais pas lui-même. Correct : un mix-minus par ligne. Le Telos Hx2 sait fabriquer un mix-minus interne si la console n'en fournit qu'un [1].
- **Vérifier le N-1 à l'oreille seulement** : le guide Telos conseille de contrôler les vumètres d'émission et de réception avec la tonalité de ligne [1].
- **Micro ouvert avec les enceintes de régie actives** : larsen. Correct : coupure automatique des écoutes (règle R6) [2] et voyant ON AIR (règle R5).
- **Calibrer l'écoute « à l'oreille »** : sans niveau de référence, les mixages varient d'une séance à l'autre. Correct : bruit rose à −18 dBFS et sonomètre réglé en dB(A) slow [3].
- **IEM sans limiteur ou trop forts** : risque auditif. Garder le limiteur actif et le régler bas [5].
- **Retours en post-fader** : voir la fiche 08.

## Lien avec le matériel (Equipment links)
- Console radio avec N-1, coupure des écoutes et GPIO tally : `axia-iq` (et `lawo-ruby`, `calrec-brio` pour la diffusion).
- Écoutes de régie et contrôleurs : `genelec-8030c`, `neumann-kh-120-ii`, `grace-m905`, `mackie-big-knob-studio`, `drawmer-mc2-1`.
- Retours : `yamaha-dbr12` (wedge actif), `shure-psm-300`, `shure-psm-900`, `shure-psm-1000`, `sennheiser-ew-iem-g4`, écouteurs `shure-se215`, `shure-se846`.
- Casques et distribution casque : `beyerdynamic-dt-770-pro`, `sennheiser-hd-25`, `behringer-ha400`.
- Règles TekPractice : R5 (ON AIR tally), R6 (coupure des écoutes sur micro ouvert), R7 (mix-minus / N-1).

## Pour aller plus loin (Best sources)
- [1] Telos Hx1/Hx2 Quick Start Guide : définition la plus nette du mix-minus et procédure de vérification.
- [3] EBU Tech 3276 : la référence gratuite pour les conditions d'écoute (niveau, géométrie, acoustique) ; elle sert en E3.
- [6] EBU Tech 3326 : pourquoi les codecs doivent interopérer, quels codecs sont obligatoires, et la typologie des liaisons avec ou sans retour.
- [4] DiGiCo SD12 Getting Started : bus solo PFL/AFL appliqués au mixage retours.
- [5] Notice Sennheiser ew IEM G4 (en allemand) : modes Stereo/Focus et limiteur.

## Sources
1. Telos Alliance, *Telos Hx1 & Hx2 Quick Start Guide*, https://telosalliance-uat.s3.amazonaws.com/public/Telos%20Products/Hx/Telos_Hx1%20Hx2_QSG_C21117016_Web.pdf, accessed 2026-10-22, verified-primary
2. Telos Alliance / Axia, *Axia iQ Quick Start Guide*, https://telosalliance-uat.s3.amazonaws.com/public/Axia Products/iQ/Support Files/Axia_iQ_QSG_C21116017_Web.pdf, accessed 2026-10-22, verified-primary
3. EBU, *Tech 3276 – Listening conditions for the assessment of sound programme material: monophonic and two-channel stereophonic* (1998), https://tech.ebu.ch/docs/tech/tech3276.pdf, accessed 2026-10-22, verified-primary
4. DiGiCo, *SD12 – Getting Started*, https://digico.biz/wp-content/uploads/2020/02/SD12_Getting_Started_A.pdf, accessed 2026-10-22, verified-primary
5. Sennheiser, *ew IEM G4 Bedienungsanleitung* (05/2026, DE), https://assets.sennheiser.com/download/assets/ew-iem-g4_bedienungsanleitung_05_2026_de.pdf/facce9cce7b611f08a557aeaa9c3764a?attachment=true, accessed 2026-10-22, verified-primary
6. EBU, *Tech 3326 – Audio contribution over IP: requirements for interoperability* (Rev. 4, Nov. 2014), https://tech.ebu.ch/docs/tech/tech3326.pdf, accessed 2026-10-22, verified-primary
7. Telos Alliance, *Telos Hx1 & Hx2 Digital Hybrids* (product page), https://www.telosalliance.com/broadcast-phone-systems/telos-hx1-hx2-digital-hybrids, accessed 2026-10-22, verified-primary
