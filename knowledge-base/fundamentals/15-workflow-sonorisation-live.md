---
id: 15-workflow-sonorisation-live
title_fr: Workflow de sonorisation live
title_en: Live sound reinforcement workflow
bts_mapping:
  - epreuve: E4
    bloc: BC02
    savoirs: "not verified"
    verified: false
    note: "BC02 lists 'installer, configurer, tester les équipements de sonorisation' (checked on France Compétences RNCP37196); the référentiel PDF (eduscol) refused connection this session, so no S-code. E4 is the practical mise-en-œuvre exam, which is where a live setup is assessed."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
  - epreuve: E3
    bloc: BC02
    savoirs: "not verified"
    verified: false
    note: "Gain-before-feedback (PAG) and the 3:1 rule are calculation topics typical of the PTES written exam; not checked against the référentiel."
    source: https://www.francecompetences.fr/recherche/rncp/37196/
tekpractice_rules: [R1, R2, R3, R4, R6]
last_checked: 2026-10-22
---

# Workflow de sonorisation live (Live sound reinforcement workflow)

## En bref / In short
Une sonorisation de concert suit toujours la même chaîne : préparer à partir de la fiche technique (technical rider) et de la patch list (input list), installer le système, câbler la scène vers la régie façade (FOH, front of house) par un boîtier de scène (stage box), vérifier chaque ligne (line check), faire la balance (soundcheck), régler les retours (monitors), assurer le concert (show), puis démonter (derig). La difficulté technique principale est le gain avant larsen (gain-before-feedback) : plus il y a de micros ouverts et plus les retours sont près des micros, moins on a de marge [1]. Ce workflow correspond au niveau TekPractice A1 (Live) : console Yamaha QL1, stage box Rio3224-D2, SM58/SM57, enceintes actives.

## Notions clés (Key concepts)
- **Fiche technique / rider (technical rider)** : document de l'artiste qui liste ses besoins : patch, backline, nombre de mixes retours, plan de scène. On la lit et on y répond *avant* le jour J, en signalant ce qui manque.
- **Patch list (input list)** : tableau numéroté entrée par entrée (n°, source, micro/DI, pied, phantom, insert). C'est la référence commune entre le plateau et la régie. Une DI (direct box) convertit une source instrument ou ligne asymétrique en signal micro symétrique.
- **Plan de scène (stage plot)** : position des musiciens, des retours (wedges), des alimentations secteur et des boîtiers de scène.
- **Stage box et patch** : les micros arrivent sur le boîtier de scène. Avec un boîtier en réseau (Dante sur etherCON, comme le Rio3224-D2), on fait le routage dans la console (patch logique) au lieu de tirer un multipaire analogique.
- **Line check** : on vérifie chaque entrée (signal présent, bon canal, phantom si besoin) avant l'arrivée des musiciens. On gratte ou on parle dans chaque micro et on suit la patch list.
- **Balance (soundcheck)** : on règle le gain d'entrée, puis l'égalisation, la dynamique et les effets, d'abord instrument par instrument puis tous ensemble.
- **Retours (monitors)** : wedges au sol ou ears (IEM, in-ear monitors). Les ears suppriment le problème de gain avant larsen parce que le « haut-parleur » est fermé dans le conduit auditif [1]. Le guide Shure montre comment regrouper les besoins en peu de mixes : chanteur·se principal·e, instruments, batterie [1].
- **Nombre de micros ouverts (NOM, number of open microphones)** : chaque doublement du nombre de micros ouverts fait perdre 3 dB de gain disponible avant larsen, donc 4 micros au lieu d'1 coûtent 6 dB [1]. Il faut couper les micros qui ne servent pas.
- **Directivité** : on oriente l'angle de rejet du micro vers le retour. Rejet latéral approximatif : cardioïde environ 6 dB à ±90°, supercardioïde environ 9 dB (rejet maximal vers ±125°), hypercardioïde environ 12 dB [2]. Avec un supercardioïde, on ne place pas le retour pile derrière (lobe arrière à 180°) [2].
- **Filtrage en peigne et règle 3:1 (comb filtering, 3:1 rule)** : deux micros ouverts sur la même source créent un filtrage en peigne. On place le micro voisin au moins trois fois plus loin de la source que le micro principal, ce qui donne environ −10 dB [3].
- **Façade (FOH)** : mix pour le public, réglage du système (alignement, égalisation) et contrôle du niveau du public (voir 19-securite : 102 dB(A) / 118 dB(C) sur 15 min).
- **Démontage (derig)** : on coupe dans l'ordre inverse (amplis et enceintes actives d'abord), on enroule, on range et on fait l'inventaire.

## Formules (Formulas)
- **Gain acoustique potentiel (PAG, potential acoustic gain)** [1] :
  PAG = 20·(log D1 − log D2 + log D0 − log Ds) − 10·log NOM − 6
  D0 = distance source–auditeur, Ds = distance source–micro, D1 = distance micro–enceinte, D2 = distance enceinte–auditeur (en mètres, la même unité partout) ; NOM = nombre de micros ouverts ; −6 dB = marge de sécurité. Résultat en dB. Cette équation suppose des micros omnidirectionnels et une réponse plate [1].
  Sens : rapprocher le micro de la bouche (Ds petit) et éloigner le micro de l'enceinte (D1 grand) donne plus de gain avant larsen.
- **Effet du NOM** : chaque doublement du NOM réduit le gain disponible de 10·log 2 ≈ 3 dB [1].
- **Règle 3:1** : 20·log(1/3) ≈ −10 dB d'écart de niveau entre le micro voisin et le micro principal (sensibilité et gain égaux) [3].

## Erreurs fréquentes (Common mistakes)
- **Faire la balance sans line check** : on perd du temps devant les musiciens. On vérifie toutes les lignes avec la patch list avant.
- **Laisser tous les micros ouverts** : le NOM augmente et on perd du gain avant larsen [1]. On coupe ou on gate ce qui ne joue pas.
- **Retour placé dans l'axe du micro** : on oriente le rejet du micro vers le wedge [2].
- **Mettre le phantom n'importe où** : un dynamique (SM58) le tolère, un ruban ancien peut être abîmé, et un statique (condenser) ne marche pas sans lui (règle R4).
- **Mic dans une entrée ligne, ou ligne dans un préampli micro** : environ 40 dB d'écart de niveau (règle R2). On utilise une DI pour les sources instrument.
- **Forcer un connecteur** : XLR mâle dans XLR femelle, sortie vers entrée (R1, R3).
- **Corriger le larsen uniquement à l'égaliseur** : l'égaliseur graphique aide parce que certaines fréquences accrochent avant les autres [1], mais la première solution reste le placement (distances, directivité, NOM).
- **Monter le niveau des retours sans limite** : les systèmes d'ears peuvent dépasser 130 dB SPL ; garder le limiteur actif [1].

## Lien avec le matériel (Equipment links)
- Console / stage box : `yamaha-ql1`, `yamaha-rio3224-d2`, `allen-heath-sq-6`, `digico-sd12`, `midas-dl16`, `allen-heath-dx168`.
- Micros : `shure-sm58`, `shure-sm57`, `shure-beta-52a`, `sennheiser-e-906`, `akg-d112-mkii`.
- DI : `radial-jdi`, `radial-prodi`, `klark-teknik-dn100-v2`, `behringer-di100`.
- Retours : `shure-psm-300`, `shure-psm-900`, `sennheiser-ew-iem-g4`, `shure-se215`.
- Diffusion : `qsc-k12-2`, `yamaha-dbr12`, `l-acoustics-kara-ii`, `l-acoustics-ks28`, `db-audiotechnik-d80`.
- Anti-larsen : `dbx-afs2`.
- Règles TekPractice : R1 (connecteurs), R2 (niveaux), R3 (sens du signal), R4 (phantom), R6 (micro ouvert et enceintes dans la même pièce = larsen).

## Pour aller plus loin (Best sources)
- [1] Guide Shure sur les retours : l'historique des wedges, l'équation PAG, le NOM, la répartition des mixes et l'écoute sans danger. C'est la meilleure source pour justifier un choix entre wedges et ears.
- [2] DPA, chant au micro main : chiffres de rejet selon la directivité et effet de proximité.
- [3] DPA, filtrage en peigne : règle 3:1 et délais.
- [4] Manuel d'accroche d&b : rappel que le système est conçu sur logiciel (ArrayCalc) avant d'être accroché (voir 19-securite).

## Sources
1. Sigismondi G., *Personal Monitor Systems: Selection and Operation*, 3rd ed., Shure Educational Publication, https://www.shure.com/damfiles/default/global/documents/publications/en/performance-production/us_pro_guidepersonalmonitor_ea.pdf-a99329954f383dc535fac48bca2396ec.pdf, accessed 2026-10-22, verified-primary
2. DPA Microphones, "How to mic vocals with handheld mics on stage", Mic University, https://www.dpamicrophones.com/mic-university/how-to-mic/how-to-mic-vocals-with-handheld-mics-on-stage/, accessed 2026-10-22, verified-primary
3. DPA Microphones, "The basics about comb filtering (and how to avoid it)", Mic University, https://www.dpamicrophones.com/mic-university/audio-production/the-basics-about-comb-filtering-and-how-to-avoid-it/, accessed 2026-10-22, verified-primary
4. d&b audiotechnik, *V-Series Rigging manual 1.12 en*, https://www.dbaudio.com/assets/products/downloads/manuals-documentation/accessories/dbaudio-rigging-manual-v-series-1.12-en.pdf, accessed 2026-10-22, verified-primary
5. France Compétences, fiche RNCP37196 (BTS Métiers de l'audiovisuel option métiers du son), https://www.francecompetences.fr/recherche/rncp/37196/, accessed 2026-10-22, verified-primary
