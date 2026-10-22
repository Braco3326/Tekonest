---
id: 19-securite
title_fr: Sécurité (audition, électricité, accroche et travail en hauteur)
title_en: Safety (hearing, electrical, rigging and working at height)
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    note: "France Compétences RNCP37196 has no competence titled 'sécurité'; BC02 covers installing/testing sonorisation and maintenance ('sûreté de fonctionnement'). Safe practice is assessed whenever students set up gear in E4. eduscol référentiel PDF unreachable this session, so no S-code."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
  - epreuve: E52
    bloc: BC03
    savoirs: "not verified"
    verified: false
    note: "E52 (environnement économique et juridique) is the likely place for legal obligations such as décret 2017-1244 and Code du travail noise rules; not checked against the référentiel."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
tekpractice_rules: [R1, R3]
last_checked: 2026-10-22
---

# Sécurité : audition, électricité, accroche (Safety: hearing, electrical, rigging)

## En bref / In short
Un technicien son est exposé à trois grands risques : le bruit (pour lui et pour le public), l'électricité (alimentation des systèmes, armoires, groupes) et les chutes ou chutes d'objets (travail en hauteur, enceintes accrochées). En France, le Code du travail fixe des seuils d'exposition au bruit des salariés : 80, 85 et 87 dB(A) [1]. Le décret n° 2017-1244 fixe des limites pour le public des lieux diffusant des sons amplifiés : 102 dB(A) et 118 dB(C) sur 15 minutes [2]. Toute intervention électrique demande une habilitation délivrée par l'employeur (norme NF C 18-510) [3], et l'accroche se fait selon les instructions du fabricant, avec élingue de sécurité (secondary safety), par du personnel qualifié [8]. Cette fiche ne reprend que des règles sourcées.

## Notions clés (Key concepts)

### 1. Bruit au travail (Code du travail, articles R. 4431-1 à R. 4437-4) [1]
- Deux grandeurs : l'exposition quotidienne moyenne **LEX,8h** en dB(A) et le **niveau de crête LpC** en dB(C) [1].
- **VAI (valeur d'exposition inférieure déclenchant l'action)** : 80 dB(A) / 135 dB(C). Au-dessus, l'employeur met à disposition des protecteurs individuels contre le bruit (PICB, hearing protectors), informe et forme les salariés, et un examen audiométrique est possible à la demande [1].
- **VAS (valeur supérieure)** : 85 dB(A) / 137 dB(C). Au-dessus : programme de réduction du bruit, signalisation des zones bruyantes avec accès limité, et contrôle du port effectif des PICB [1].
- **VLE (valeur limite d'exposition)** : 87 dB(A) / 140 dB(C). Elle tient compte de l'atténuation des PICB, contrairement à la VAI et à la VAS. Au-dessus, il faut réduire le bruit immédiatement [1].
- **Règle d'égale énergie** : 8 h à 80 dB(A) sont aussi dangereuses qu'1 h à 89 dB(A) [4].
- **Ears (IEM)** : ils protègent autant que des bouchons, mais peuvent dépasser 130 dB SPL ; garder le limiteur actif et faire contrôler son audition régulièrement [9].

### 2. Public et sons amplifiés (décret 2017-1244, CSP art. R. 1336-1 et suivants ; C. env. art. R. 571-25 à R. 571-28) [2]
- Lieux concernés : salles de concert, discothèques, bars, festivals, plein air, etc. [2].
- Limites : **102 dB(A) et 118 dB(C) sur 15 minutes**, à aucun moment et en aucun endroit accessible au public ; **94 dB(A) et 104 dB(C)** pour les activités destinées aux enfants jusqu'à 6 ans révolus [2].
- Selon la catégorie du lieu : enregistrement en continu des niveaux dB(A) et dB(C), conservés au moins 6 mois ; affichage en continu près de la régie ; information du public ; protections auditives gratuites ; zone ou périodes de repos auditif [2].
- Voisinage : étude d'impact des nuisances sonores (EINS) et, si l'étude le demande, un limiteur installé et réglé par un professionnel [2].

### 3. Électricité [3][5][6][7]
- **Effets du courant** (INRS) : dès 0,5 mA, contractions musculaires involontaires possibles ; 10 mA pendant quelques secondes peuvent provoquer des brûlures et des troubles respiratoires ou circulatoires ; 40 mA peuvent tuer [6]. Toute tension au-delà de 50 V est potentiellement mortelle, et la basse tension va jusqu'à 1 000 V en alternatif [6].
- **Habilitation électrique** : l'employeur reconnaît qu'un salarié formé et médicalement apte peut faire certaines opérations en sécurité ; elle s'appuie sur la norme NF C 18-510 et les articles R. 4544-9 à R. 4544-11 du Code du travail [3]. Le symbole indique le domaine de tension (B, H), le type d'opération (0 = non électrique, 1 = exécutant, 2 = chargé de travaux) et la nature (R, S, C, V…) [3]. Révision annuelle de l'habilitation, recyclage conseillé tous les 3 ans [3].
- **Contacts indirects** : la protection repose sur la mise à la terre des masses avec coupure automatique de l'alimentation, la double isolation (classe II) ou la très basse tension de sécurité (TBTS : ≤ 50 V en général, ≤ 12 V en milieu mouillé, en alternatif et en intérieur) [5].
- **Différentiel 30 mA** : la NF C 15-100 impose des dispositifs différentiels haute sensibilité de 30 mA au plus sur tous les circuits terminaux des logements. Pour les locaux de travail, la NF C 15-100 est la norme d'installation de référence citée par l'arrêté du 12 avril 2012 [7]. Nous n'avons pas trouvé de source officielle qui fixe le 30 mA pour les installations temporaires de spectacle ; ne pas l'affirmer sans source.
- **Installations temporaires** : les structures de foires, cirques et lieux de spectacle font partie des installations électriques visées par le Code du travail (R. 4226-1 à R. 4226-4) [10].
- **Dix règles INRS** : ne pas bricoler, vérifier son matériel avant usage, ne jamais laisser une rallonge sous tension sans rien de branché, se méfier de l'eau, ne pas ouvrir une armoire sans habilitation, repérer la coupure d'urgence, signaler les anomalies (odeur de brûlé, grésillement, étincelles) [6].

### 4. Travail en hauteur et accroche [8][11][12]
- **Protection collective d'abord** (garde-corps), protection individuelle (harnais antichute) seulement si la protection collective est impossible (R. 4323-58 à R. 4323-61) [11].
- **Échelles et escabeaux** : pas de poste de travail, sauf impossibilité technique ou travaux courts, peu risqués et non répétitifs (R. 4323-63) [11].
- **Nacelles (PEMP)** : conduite seulement avec une autorisation de conduite délivrée par l'employeur ; interdite aux moins de 18 ans [11].
- **Harnais (EPI antichute)** : formation spécifique, vérification avant chaque usage, contrôle annuel [11].
- **Charge maximale d'utilisation (CMU, working load limit)** : elle est marquée sur l'élingue et vaut pour un brin unique. Avec deux élingues, la charge admissible dépend de l'angle : l'exemple INRS indique qu'à 60°, deux élingues de CMU 1 000 kg ne lèvent pas 2 000 kg mais 1 000 kg [12]. Un facteur de mode, fonction de l'angle de chaque brin par rapport à la verticale (β) et du nombre de brins, se multiplie par la CMU d'un brin ; pour 2 brins : 1,4 de 0 à 45°, 1 au-delà de 45° jusqu'à 60° [12].
- **Accroche d'enceintes (d&b, série V)** : installation par du personnel qualifié et autorisé ; vérifier que les points d'accroche conviennent ; inspection visuelle et fonctionnelle avant usage ; deux personnes pour monter ; personne sous la charge pendant le levage ; ne jamais grimper sur le système ; calcul de la configuration dans le logiciel ArrayCalc ; élingue de sécurité (secondary safety) sur les points prévus [8]. Vent : pas d'enceintes accrochées au-delà de 6 Beaufort ; au-delà de 8 Beaufort, évacuer la zone, descendre et sécuriser le système [8].

## Formules (Formulas)
- **Égale énergie (temps)** [4] : +3 dB ⇔ durée d'exposition équivalente divisée par 2 (80 dB(A)·8 h ≡ 83·4 h ≡ 86·2 h ≡ 89·1 h ≡ 92·30 min ≡ 95·15 min ≡ 98·7,5 min).
- **Distance** [4] : en champ libre, environ −6 dB par doublement de distance (moins en intérieur à cause des réflexions).
- **Élingage** [12] : capacité maximale = CMU d'un brin × facteur de mode. Exemple : 2 brins de CMU 1 000 kg avec β entre 45° et 60° → facteur 1 → 1 000 kg ; avec β ≤ 45° → facteur 1,4 → 1 400 kg.

## Erreurs fréquentes (Common mistakes)
- **Confondre les seuils salariés et public** : 80/85/87 dB(A) en LEX,8h pour les travailleurs [1] ; 102 dB(A) / 118 dB(C) sur 15 min pour le public [2].
- **Croire que les bouchons permettent de dépasser la VAS sans rien faire** : au-dessus de 85 dB(A), l'employeur doit aussi réduire l'exposition et signaler la zone [1].
- **« C'est de la basse tension, donc sans danger »** : la BT va jusqu'à 1 000 V et 40 mA peuvent tuer [6].
- **Ouvrir une armoire ou réarmer un disjoncteur sans habilitation** [6].
- **Accrocher sans élingue de sécurité, ou sans vérifier le point d'accroche** [8].
- **Additionner les CMU de deux élingues sans tenir compte de l'angle** [12].
- **Monter sur un escabeau pour orienter une enceinte pendant longtemps** au lieu d'utiliser une plateforme avec garde-corps [11].
- **Débrancher en tirant sur le câble, laisser des câbles dans l'eau ou sous la pluie** [6].

## Lien avec le matériel (Equipment links)
- Systèmes accrochés : `l-acoustics-k2`, `l-acoustics-kara-ii`, `l-acoustics-a15-focus`, `l-acoustics-ks28`.
- Amplification (alimentation secteur) : `l-acoustics-la12x`, `db-audiotechnik-d80`, `crown-xls-2502`.
- Ears avec limiteur : `shure-psm-300`, `shure-psm-900`, `shure-psm-1000`, `sennheiser-ew-iem-g4`.
- Règles TekPractice : R1 (ne jamais forcer un connecteur, y compris secteur Schuko/powerCON/IEC), R3 (sens du signal ; deux sorties reliées peuvent abîmer le matériel). Aucune règle R1–R8 ne couvre encore le bruit, l'électricité ou l'accroche : c'est une piste pour de futurs niveaux.

## Pour aller plus loin (Best sources)
- [1] INRS, réglementation bruit : tableau clair VAI / VAS / VLE et actions associées.
- [2] ARS Île-de-France, LDSA : la synthèse officielle la plus lisible du décret 2017-1244.
- [3][5][10] INRS, risque électrique : habilitation, mesures de prévention, réglementation.
- [6] INRS ED 6344 : 10 règles en 16 pages, idéal pour un premier cours.
- [8] Manuel d'accroche d&b série V : exemple concret de consignes fabricant (vent, élingue de sécurité, ArrayCalc).
- [11] INRS, réglementation du travail en hauteur : articles R. 4323-58 et suivants.
- [12] INRS ED 6278 : CMU et facteur de mode d'élingage.

## Sources
1. INRS, « Bruit — Réglementation », https://www.inrs.fr/risques/bruit/reglementation.html, accessed 2026-10-22, verified-primary
2. ARS Île-de-France, « Les lieux diffusant des sons amplifiés (LDSA) », https://www.iledefrance.ars.sante.fr/les-lieux-diffusant-des-sons-amplifies-ldsa, accessed 2026-10-22, verified-primary (décret 2017-1244 itself not readable on Légifrance this session)
3. INRS, « Habilitation électrique », https://www.inrs.fr/risques/electriques/habilitation-electrique.html, accessed 2026-10-22, verified-primary
4. INRS, « Bruit — Exposition et risque », https://www.inrs.fr/risques/bruit/exposition-risque.html, accessed 2026-10-22, verified-primary
5. INRS, « Prévention du risque électrique », https://www.inrs.fr/risques/electriques/prevention-risque-electrique.html, accessed 2026-10-22, verified-primary
6. INRS, ED 6344 « Électricité : 10 règles élémentaires de sécurité » (2019), https://www.inrs.fr/dam/inrs/CataloguePapier/ED/TI-ED-6344.pdf, accessed 2026-10-22, verified-primary
7. SéQuélec (Enedis, FFIE, Consuel…), Fiche n° 2 V2 « Disjoncteur de branchement » (2021), https://enedis.fr/media/2226/download, accessed 2026-10-22, verified-secondary (industry guide quoting the arrêté of 3 Aug 2016 and NF C 15-100)
8. d&b audiotechnik, *V-Series Rigging manual 1.12 en*, https://www.dbaudio.com/assets/products/downloads/manuals-documentation/accessories/dbaudio-rigging-manual-v-series-1.12-en.pdf, accessed 2026-10-22, verified-primary
9. Sigismondi G., *Personal Monitor Systems*, 3rd ed., Shure, https://www.shure.com/damfiles/default/global/documents/publications/en/performance-production/us_pro_guidepersonalmonitor_ea.pdf-a99329954f383dc535fac48bca2396ec.pdf, accessed 2026-10-22, verified-primary
10. INRS, « Réglementation — prévention du risque électrique », https://www.inrs.fr/risques/electriques/reglementation-prevention-risque-electrique.html, accessed 2026-10-22, verified-primary
11. INRS, « Réglementation du travail en hauteur », https://www.inrs.fr/risques/chutes-hauteur/reglementation-travail-hauteur.html, accessed 2026-10-22, verified-primary
12. INRS, ED 6278 « Grue de chargement » (chapitre élingage), https://inrs.fr/dam/jcr:907c237a-be6c-4c82-8b40-cc2623460c40/ed6278.pdf, accessed 2026-10-22, verified-primary
13. France Compétences, fiche RNCP37196, https://www.francecompetences.fr/recherche/rncp/37196/, accessed 2026-10-22, verified-primary
