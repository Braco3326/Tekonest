---
id: 18-workflow-post-production
title_fr: Workflow de post-production son
title_en: Audio post-production workflow
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    note: "BC02 lists 'utiliser et gérer les ressources de post-production son' (checked on France Compétences RNCP37196); eduscol référentiel PDF unreachable this session."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
  - epreuve: E51
    bloc: BC03
    savoirs: "not verified"
    verified: false
    note: "BC03 includes 'analyser les supports image et son fournis pour la post-production son' and 'gérer le stockage et l'archivage des données audio'; the industrial project (E51) usually contains a post-production deliverable. Not checked against the référentiel."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
tekpractice_rules: [R2, R4, R8]
last_checked: 2026-10-22
---

# Workflow de post-production son (Audio post-production workflow)

## En bref / In short
La post-production son d'un film ou d'une série commence sur le tournage : l'ingénieur du son tourne des fichiers avec des métadonnées (scène, prise, timecode) qui permettront de retrouver chaque son. Le montage image envoie ensuite au son une liste de montage, en général un fichier AAF (Advanced Authoring Format), que l'on conforme (conformation) dans la station audionumérique. Viennent le montage des dialogues (dialogue edit), le bruitage (foley), les effets (SFX), la musique, puis le mixage, livré en mix final et en stems séparés, dont la version internationale M&E (music & effects). Le livrable doit respecter une norme de sonie : pour la diffusion en Europe, EBU R 128 et son supplément pour les contenus de fiction (R 128 s4) [3][4].

## Notions clés (Key concepts)
- **Son direct (location sound)** : prise au perchman (boom) et aux micros HF cravate (lavalier). DPA rappelle des points concrets : prévoir le temps de pose des micros sur les comédiens après costume et maquillage, travailler avec les costumes pour limiter les bruits de tissu, et vérifier le son avec le comédien après chaque réparation [1].
- **Métadonnées (metadata)** : un fichier BWF contient un chunk « bext » avec description, auteur, date, heure et TimeReference, c'est-à-dire la position du premier échantillon comptée en échantillons depuis minuit. C'est ce qui permet de recaler un son sur le timecode [2]. Les enregistreurs de tournage ajoutent souvent des métadonnées iXML (scène, prise, noms de pistes) ; ce point n'a pas été vérifié dans un manuel cette session.
- **Rapport son (sound report)** : liste des prises, pistes, remarques, à joindre aux rushes.
- **AAF / OMF** : formats d'échange de la timeline entre le montage image et le montage son. L'AMWA décrit l'AAF comme un format ouvert et interopérable pour l'échange de métadonnées de montage ; la spécification AS-01 « AAF Edit Protocol » couvre l'échange des décisions de montage avec un jeu d'effets de base [5][6]. L'OMF (Open Media Framework) est l'ancien format équivalent (pas de source vérifiée cette session).
- **Conformation (conform)** : reconstruire la session son à partir de l'AAF et des fichiers originaux du tournage. Si le montage image change, on reconforme.
- **Montage dialogues (dialogue edit)** : choix des pistes (perche ou HF), nettoyage, raccords d'ambiance (room tone), repérage des répliques à doubler en postsynchronisation (ADR).
- **Bruitage (foley)** : pas, vêtements, accessoires rejoués en auditorium, synchrones à l'image.
- **Effets (SFX) et ambiances** : sons de bibliothèque ou enregistrés, placés et édités.
- **Musique** : originale ou préexistante (droits à vérifier).
- **Mixage et stems** : le mix est livré en mix complet (printmaster) et en stems séparés : dialogues, musique, effets. Le M&E (music & effects) est le mix sans les dialogues originaux, pour le doublage.
- **Sonie des fictions (cinematic content)** : l'EBU mesure le Programme Loudness, le Dialogue Loudness et l'écart entre les deux, le LDR (Loudness-to-Dialogue Ratio). Les films peuvent atteindre un LDR de 15 LU ou plus [4]. Le LDR ne devrait pas dépasser 5 LU ; s'il est déjà dans cette limite, il ne faut pas compresser le mix [4]. Ensuite on normalise à −23,0 LUFS, avec des crêtes vraies sous −1 dBTP [4].
- **Mesure du dialogue** : elle demande une piste de dialogues isolée (stem) ou une détection de parole automatique [4]. C'est une raison de plus pour livrer des stems propres.

## Formules (Formulas)
- **LDR** [4] : LDR = PL − DL (en LU), PL = sonie du programme (LUFS), DL = sonie du dialogue (LUFS). Recommandation : LDR ≤ 5 LU.
- **Normalisation sur le dialogue (anchor-based)** [4] : si DL est normalisé à −23,0 LUFS avec LDR ≤ 5 LU, PL peut monter jusqu'à −18,0 LUFS au maximum.
- **Cible broadcast** [3] : PL = −23,0 LUFS ; crête vraie ≤ −1 dBTP ; mesure selon ITU-R BS.1770 et EBU Tech 3341.
- **Champs de sonie BWF** [2] : LoudnessValue, LoudnessRange, MaxTruePeakLevel, etc. sont stockés ×100 (exemple : −23,0 LUFS est stocké −2300).

## Erreurs fréquentes (Common mistakes)
- **Tourner sans métadonnées ni rapport son** : la conformation devient une chasse aux fichiers. On renseigne scène/prise et on garde le timecode [2].
- **Monter sur les fichiers intégrés à l'AAF au lieu des originaux** : on reconforme depuis les fichiers du tournage pour récupérer toutes les pistes.
- **Livrer un M&E incomplet** : bruits de pas ou effets enregistrés seulement dans la piste dialogue ; il faut les refaire en foley pour que le M&E soit complet.
- **Compresser pour « monter » les dialogues jusqu'au niveau du programme** : l'EBU déconseille de viser LDR = 0 [4].
- **Mesurer la sonie sur un seul élément** : R 128 demande de mesurer le signal entier, pas seulement la parole [3] ; la sonie du dialogue est une mesure séparée [4].
- **Ignorer la fiche de livraison du diffuseur ou de la plateforme** : elle prime ; R 128 s4 précise d'ailleurs qu'elle n'est pas un guide de production pour le cinéma en salle [4].
- **Mélanger les fréquences d'échantillonnage ou les horloges** entre tournage et post (R8).

## Lien avec le matériel (Equipment links)
- Tournage : `sound-devices-833`, `sound-devices-888`, `zoom-f8n-pro`, `aaton-cantar-x`, `sennheiser-mkh-416`, `schoeps-cmit-5`, `sanken-cos-11d`, `rode-ntg5`, `wisycom-mcr54`, `sennheiser-ew-dx-em-2`.
- Post : `avid-protools-hdx`, `avid-hd-io`, `avid-s6`, `avid-s1`, `antelope-ocx-hd`, `grace-m905`, `genelec-8341a`, `genelec-7360a`.
- Règles TekPractice : R2 (niveaux), R4 (phantom sur micros canon), R8 (horloge et fréquence d'échantillonnage).

## Pour aller plus loin (Best sources)
- [1] DPA, 7 points sur le son de tournage : retour d'expérience d'un ingénieur du son, utile pour la partie tournage.
- [2] EBU Tech 3285 : structure exacte du chunk bext (timecode en échantillons, champs de sonie).
- [3] EBU R 128 : cible et mesure de la sonie.
- [4] EBU R 128 s4 : le texte de référence sur les fictions longues (LDR, normalisation sur le dialogue).
- [5][6] AMWA : page AAF et liste des spécifications (AS-01, MS-01…).

## Sources
1. DPA Microphones, "7 points about working with sound in the film industry", Mic University, https://www.dpamicrophones.com/mic-university/background-knowledge/7-points-about-working-with-sound-in-the-film-industry/, accessed 2026-10-22, verified-primary
2. EBU, Tech 3285 v2 "Specification of the Broadcast Wave Format" (2011), https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3285.pdf, accessed 2026-10-22, verified-primary
3. EBU, R 128 v5.0 (Nov. 2023), https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf, accessed 2026-10-22, verified-primary
4. EBU, R 128 s4 "Loudness Normalisation of Cinematic Content" (Nov. 2023), https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128s4.pdf, accessed 2026-10-22, verified-primary
5. AMWA, "AAF" page, https://www.amwa.tv/aaf, accessed 2026-10-22, verified-primary
6. AMWA, Specifications list (AS-01 AAF Edit Protocol: https://static.amwa.tv/as-01-aaf-edit-protocol-spec.pdf), https://www.amwa.tv/specifications, accessed 2026-10-22, verified-primary (list page; spec PDF not opened)
7. France Compétences, fiche RNCP37196, https://www.francecompetences.fr/recherche/rncp/37196/, accessed 2026-10-22, verified-primary
