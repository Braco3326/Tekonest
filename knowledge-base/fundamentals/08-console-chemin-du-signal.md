---
id: 08-console-chemin-du-signal
title_fr: "Console de mixage : le chemin du signal"
title_en: "Mixing console signal flow"
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Le PDF du référentiel (eduscol) a renvoyé ECONNRESET à chaque tentative. Le câblage et l'exploitation d'une console sont au cœur de l'épreuve pratique E4 (Techniques et mise en œuvre)."
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    source: https://sti.eduscol.education.fr/sites/eduscol.education.fr.sti/files/textes/bts/bts-metiers-de-laudiovisuel/4874-bts-metiers-audiovisuel.pdf
    note: "Le synoptique d'une console (bus, départs pré/post) sert de support aux questions de chaîne technique en E3 PTES. Référentiel non consultable pendant cette session."
tekpractice_rules: [R2, R3, R6]
last_checked: 2026-10-22
---

# Console de mixage : le chemin du signal (Mixing console signal flow)

## En bref / In short
Une console de mixage (mixing console) reçoit des sources, les met au bon niveau, les traite, puis les distribue vers plusieurs mélanges : la façade (main / master), les retours (aux / monitor mixes), les groupes (groups / subgroups) et les matrices (matrix). Chaque tranche d'entrée (input channel strip) suit un ordre logique : gain d'entrée, filtres, insert, égaliseur, dynamique, fader, puis départs. Savoir à quel endroit on prélève le signal (avant ou après le fader, pre-fader / post-fader) est la clé de presque toutes les pannes de retour et de mélange. Les consoles numériques reprennent le même synoptique que les analogiques, mais l'ordre de certains blocs y est réglable [1].

## Notions clés (Key concepts)
- **Gain d'entrée / préampli (input gain, head amp)** : premier étage, il amène un niveau micro au niveau de travail de la console. Sur une console numérique avec boîtier de scène, le gain analogique est réglé à distance dans le stagebox et complété par un trim numérique (analogue gain / digital trim) [1]. Avec deux consoles (façade + retours) sur le même boîtier, on utilise un suivi de gain (gain tracking) pour qu'un opérateur ne casse pas le mélange de l'autre [1].
- **Phase / polarité (phase reverse)** : inversion de polarité de la tranche, utile pour deux micros sur une même source [1].
- **Filtres passe-haut / passe-bas (HPF / LPF)** : coupent ce qui est hors de la bande utile de la source (grondements, bruit de manipulation). Sur la DiGiCo SD12, une paire de filtres réglables précède l'EQ paramétrique à quatre bandes [1].
- **Insert (insert point)** : coupure du chemin pour envoyer la tranche dans un traitement externe ou interne puis la récupérer (insert send / insert return). La SD12 propose deux inserts par tranche, A et B [1].
- **Égaliseur (EQ)** et **dynamique (dynamics : compresseur, gate, de-esser)** : sur beaucoup de consoles numériques, l'ordre EQ ↔ dynamique peut être inversé par un bouton [1].
- **Fader et mute** : niveau de la tranche dans les mélanges post-fader ; le mute coupe la tranche.
- **Départs auxiliaires (aux sends)** : chaque tranche alimente plusieurs bus auxiliaires avec un niveau propre. Le point de prélèvement est choisi : **post-fader**, **pre-fader** ou **pre-mute** (pré-fader et pré-mute) [1].
  - pré-fader → retours de scène (le mélange du musicien ne bouge pas quand l'ingénieur façade touche ses faders) ;
  - post-fader → effets (réverbération) et sorties qui doivent suivre le fader.
- **Sortie directe (direct out)** : sortie individuelle de la tranche, prélevée elle aussi pré-fader, post-fader ou pré-mute, utile pour l'enregistrement multipiste [1].
- **Bus et groupes (busses / groups)** : un groupe additionne réellement des tranches dans un bus audio, que l'on peut traiter (compresseur de groupe batterie, par exemple).
- **VCA / DCA / groupes de contrôle (control groups)** : ils ne transportent aucun audio ; ils pilotent à distance le fader, le mute ou le solo des membres. Sur la SD12, une variation de +2 dB du fader de groupe ajoute +2 dB à chaque membre, quelle que soit sa position ; les mutes de plusieurs groupes de contrôle se combinent « en série » (un seul groupe muté suffit à couper la tranche) [1]. Yamaha appelle ces groupes DCA.
- **Matrice (matrix)** : mélangeur de bus. On y envoie des bus (par exemple master gauche et droite) avec des niveaux de point de croisement (crosspoint levels) pour alimenter des zones (rappels, délais, régie d'enregistrement) [1]. Exemple de capacité : Yamaha DM7, « 48 MIX + 12 MATRIX + 2 STEREO » [2].
- **Master** : bus principal stéréo ou LCR, envoyé à la diffusion façade [1].
- **Écoute solo (solo / cue)** :
  - **PFL (pre-fade listen)** : écoute de la tranche avant fader, pour vérifier une source sans la mettre dans le mélange ;
  - **AFL (after-fade listen)** : écoute après fader (et après panoramique) ;
  - la SD12 dispose de deux bus solo, chacun réglable en PFL ou AFL, en mode solo unique ou multiple ; on peut par exemple dédier le solo 1 aux ear-monitors et le solo 2 à un wedge d'écoute [1].
- **Console de diffusion radio** : même logique, avec en plus des automatismes. Sur l'Axia iQ, ouvrir la tranche micro (bouton On) coupe les haut-parleurs de la régie ; on passe alors au casque [3]. Voir la fiche 09 et la règle R6.

## Formules (Formulas)
Aucune formule n'est propre au synoptique. Un seul repère chiffré est sourcé : une variation de N dB sur un groupe de contrôle s'applique en dB à chaque membre (+2 dB sur le maître = +2 dB sur chaque tranche) [1].

## Erreurs fréquentes (Common mistakes)
- **Retours en post-fader** : le musicien entend son mélange bouger à chaque geste de l'ingénieur façade. Correct : départs de retours en pré-fader, ou pré-mute si le retour doit rester actif quand la façade est mutée [1].
- **Réverbération en pré-fader** : quand on baisse le fader, l'effet reste. Correct : départ d'effet post-fader.
- **Confondre groupe audio et VCA/DCA** : un compresseur ne s'insère que sur un groupe audio ; un VCA ne fait que piloter des niveaux [1].
- **Gain trop bas compensé au fader** : le bruit monte avec le gain de fader. Correct : régler le gain d'entrée en premier (pré-écoute PFL et vumètre), puis mixer aux faders.
- **Écoute AFL laissée active pour régler un gain** : l'écoute AFL dépend du fader. Utiliser le PFL pour juger le niveau d'entrée.
- **Deux consoles sur un même stagebox sans suivi de gain** : l'une modifie le préampli de l'autre. Utiliser le gain tracking ou un mode « receive only / isolate » [1].
- **Branchements à l'envers** : sortie console vers sortie, ou niveau micro dans une entrée ligne (règles R2 et R3 du simulateur).

## Lien avec le matériel (Equipment links)
- Consoles numériques : `yamaha-ql1`, `yamaha-cl5`, `yamaha-dm7`, `allen-heath-sq-6`, `digico-sd12`, `avid-venue-s6l`, `lawo-ruby`, `calrec-brio`, `axia-iq`.
- Consoles analogiques (synoptique plus lisible pour débuter) : `yamaha-mg10xu`, `mackie-1604vlz4`, `allen-heath-zed-22fx`, `soundcraft-gb4`.
- Stageboxes dont le gain est télécommandé par la console : `yamaha-rio3224-d2`, `digico-sd-rack`, `allen-heath-ar2412`.
- Règles TekPractice : R2 (types de signal), R3 (sens du signal), R6 (coupure des écoutes quand un micro est ouvert sur la console radio).

## Pour aller plus loin (Best sources)
- [1] DiGiCo SD12 Getting Started : bonne description concrète d'une tranche numérique moderne (gain/trim, inserts A/B, ordre EQ/dynamique, aux pré/post/pré-mute, matrice, groupes de contrôle, deux bus solo PFL/AFL).
- [2] Manuel de référence Yamaha DM7 : pour la terminologie Yamaha (MIX, MATRIX, STEREO, DCA) et les capacités de bus.
- [3] Guide de démarrage Axia iQ : pour la logique radio (bouton On, programme PGM 1, coupure des enceintes de régie).
- Pour aller plus loin, comparer avec le manuel d'une console analogique (Allen & Heath ZED, Mackie VLZ) ; ces PDF dépassaient la taille lisible par l'outil pendant cette session.

## Sources
1. DiGiCo, *SD12 – Getting Started* (Issue A), DiGiCo UK Ltd, https://digico.biz/wp-content/uploads/2020/02/SD12_Getting_Started_A.pdf, accessed 2026-10-22, verified-primary
2. Yamaha, *DM7 Series Reference Manual – General specifications*, Yamaha Corporation, https://manual.yamaha.com/pa/mixers/dm7/rm/en-US/9546033675.html, accessed 2026-10-22, verified-primary
3. Telos Alliance / Axia, *Axia iQ Quick Start Guide*, https://telosalliance-uat.s3.amazonaws.com/public/Axia Products/iQ/Support Files/Axia_iQ_QSG_C21116017_Web.pdf, accessed 2026-10-22, verified-primary
