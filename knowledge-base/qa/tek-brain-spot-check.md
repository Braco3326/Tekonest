# TEK Brain spot-check (independent QA, 2026-10-22)

Sample: `random.seed(20261022)`, at least 10 % per group (with the requested minimums), ids listed in `tek-brain-spot-check.json` (`sample`). For every record I re-fetched the cited sources and checked each claim against the source text.

## Result

- Records checked: **207**
- Pass: **157**, minor: **49**, fail: **1**, unreachable: **0**
- Strict pass rate: **75.8 %**; records with no factual error (pass + minor): **99.5 %**
- Findings: 56 (unsupported-or-wrong-content 32, confidence-label 22, licence/attribution 2)

| Group | Population | Sampled | Pass | Minor | Fail | Unreachable |
|---|---|---|---|---|---|---|
| concepts | 414 | 45 | 30 | 15 | 0 | 0 |
| skills | 60 | 6 | 3 | 3 | 0 | 0 |
| procedures | 96 | 10 | 7 | 3 | 0 | 0 |
| rules | 82 | 10 | 5 | 5 | 0 | 0 |
| faults | 101 | 12 | 9 | 3 | 0 | 0 |
| scenarios | 41 | 6 | 2 | 3 | 1 | 0 |
| glossary | 780 | 78 | 67 | 11 | 0 | 0 |
| rooms | 32 | 6 | 4 | 2 | 0 | 0 |
| learning_resources | 259 | 26 | 24 | 2 | 0 | 0 |
| 3d_downloads | 44 | 8 | 6 | 2 | 0 | 0 |

## Fails

- **talk-show-four-guests** (tek-brain/scenarios/broadcast-radio.json), field `required_gear[behringer-ha400] vs required_gear[beyerdynamic-dt-770-pro qty 5]`
  - Record: 1 x Behringer HA400 "distribution casque" for 5 casques (animateur + 4 invités)
  - Source: HA400 MicroAMP is a 4-channel headphone amp (4 outputs, one stereo input) per the KB's own equipment record ("4-channel stereo headphone distribution amplifier ... one stereo line input"); 5 headphones cannot be served
  - Fix: Use 2 x HA400, or an 8-output amp (e.g. Behringer HA8000), or the console's own headphone outputs; also note the HA400 gives every guest the same mix

## Most worrying patterns

1. Unsourced 'field-practice' sentences appended to otherwise well-sourced explanations/fixes/criteria, with `covers` claiming the source supports the whole field (most of the 32 content findings: concepts, rules, faults, skills, procedures, glossary).
2. Scenario required_gear / signal_flow are not checked against equipment specs or any source: the only FAIL (one 4-output HA400 feeding 5 headphones) and a mis-wired DHD RX2 (surface used as I/O) come from there.
3. Inconsistent confidence labels: manufacturer/regulator documents (DPA, Rane, TI, Genelec, Yamaha, Ampetronic, ARS) labelled verified-secondary while the same publishers are verified-primary elsewhere; and two supporting blogs labelled unverified. 22 findings, harmless to facts but undermines the label as a trust signal.

## All minor findings

| Group | Record | Field | Record says | Source says | Fix |
|---|---|---|---|---|---|
| concepts | antenna-types-wireless | definition | directionnelles (Yagi, log-périodique, hélice, panneau « paddle ») | Shure (Vear) names Yagi, log-periodic and helical only; no source mentions a "paddle"/panel antenna; PSM 1000 guide lists PA805SWB passive directional and HA-8089 helical. | Drop « panneau paddle » or add a source that describes paddle/panel antennas. |
| concepts | dynamic-range | sources[].confidence (https://www.ranecommercial.com/legacy/pdf/ranenotes/Setting_Sound_System_Level_Controls.pdf) | verified-secondary with kind=manufacturer (Rane RaneNote 135) | Document is published by the manufacturer itself (own technical note / own site) | Set confidence to verified-primary (KB rule: manufacturer = verified-primary), or set kind to other/trade-press if the intent is to mark it as non-authoritative. |
| concepts | steerable-column-array | explanation | peut supprimer des échos dans les architectures difficiles (églises, halls, gares) | Renkus-Heinz: 'drastically reduces long reverberation tail or eliminates echoes in spaces that might have architecturally challenging elements' (examples elsewhere on page: churches, LAX airport, Great Hall); no 'train stations'. | Replace « gares » by « aéroports » or remove the example list. |
| concepts | diffraction | explanation | Pour un micro, la taille du corps du micro influe aussi sur sa réponse dans l'aigu. | Neither DPA "10 important facts" nor CIDB fiche A4 mentions microphone body size or diffraction; CIDB A4 does not discuss diffraction at all. | Remove the sentence or cite a DPA page on microphone body diffraction; drop CIDB A4 from covers[explanation] (it does not support it). |
| concepts | dialogue-editing | explanation | choisit ... la meilleure source (perche ou HF) ; ... sépare les voix sur des pistes distinctes pour que le mixeur puisse les traiter | Wikipedia Dialogue editor: production tracks, alternates, ADR, ADR editor, walla group, hand-off to re-recording mixer. No mention of boom vs radio mic choice or splitting voices to separate tracks. | Remove or source those two practices (e.g. a dialogue-editing guide). |
| concepts | headroom | sources[].confidence (https://www.ranecommercial.com/legacy/pdf/ranenotes/Setting_Sound_System_Level_Controls.pdf) | verified-secondary with kind=manufacturer (Rane RaneNote 135) | Document is published by the manufacturer itself (own technical note / own site) | Set confidence to verified-primary (KB rule: manufacturer = verified-primary), or set kind to other/trade-press if the intent is to mark it as non-authoritative. |
| concepts | spot-microphones | sources[].confidence (https://www.dpamicrophones.com/mic-university/audio-production/multimiking-a-classical-orchestra/) | verified-secondary with kind=manufacturer (DPA Mic University, E. B. Brixen) | Document is published by the manufacturer itself (own technical note / own site) | Set confidence to verified-primary (KB rule: manufacturer = verified-primary), or set kind to other/trade-press if the intent is to mark it as non-authoritative. |
| concepts | spot-microphones | explanation | Exemple : un appoint sur les cors, mixé trop fort et sans retard, « tire » les cors vers l'avant de l'image. | Not in the DPA article (no horn example). | Flag as illustrative example (non sourcé) or remove. |
| concepts | side-fill-monitor | definition / explanation | c'est souvent une enceinte de façade standard ; posés de chaque côté (souvent sur un sub) ; mix général vers tout le plateau ; risque de larsen | Wikipedia Foldback only says 'larger cabinets called sidefill cabinets to help the musicians to hear' and historical sidefill use; none of the listed specifics. | Keep only what Wikipedia supports or add a source (e.g. a monitor-engineering guide) for placement/mix content. |
| concepts | subgroup | explanation | sur la 1604VLZ4, les sous-groupes n'ont pas d'insert ; il faut passer par les sorties sub out pour insérer un processeur | Mackie manual lists inserts only on channels and describes sub outs as feeds to a multitrack or secondary amps; it does not state the workaround. Absence of group inserts is an inference. | Rephrase as inference (« le manuel ne prévoit pas d'insert de groupe ») and drop or source the sub-out workaround. |
| concepts | quantization-noise | sources[].confidence (https://www.ti.com/lit/an/slaa013/slaa013.pdf) | verified-secondary with kind=manufacturer (Texas Instruments SLAA013) | Document is published by the manufacturer itself (own technical note / own site) | Set confidence to verified-primary (KB rule: manufacturer = verified-primary), or set kind to other/trade-press if the intent is to mark it as non-authoritative. |
| concepts | quantization-noise | explanation | environ 98 dB en 16 bits et 146 dB en 24 bits | TI gives SNR = 6.02n + 1.76 dB only; 98/146 dB are computed, not quoted. | Mark as calculated: « (calcul : 6,02×16+1,76 ≈ 98 dB ; ×24 ≈ 146 dB) ». |
| concepts | microphone-split-foh-monitor | explanation | un splitter à transformateur isolé ... les câbles en Y fonctionnent mais sont fragiles | Wikipedia Foldback: 'split snake cable or Y-cable' and 'microphone splitter'; no transformer isolation, no fragility statement. Shure PSM guide's Y-cable mention is about monitor outputs, not mic split. | Source transformer-isolated splitters (e.g. Radial/Whirlwind) or remove; drop « fragiles ». |
| concepts | audio-codec-ip | explanation | Le retour envoyé au codec doit toujours être un N-1. | Neither EBU Tech 3326 nor the AETA page mentions N-1 / mix-minus / clean feed. | Add a source for N-1 or move it to a rule record with its own source. |
| concepts | audio-over-ip | explanation | technologies de couche 3 (IP routable : Dante, RAVENNA, Livewire, Q-LAN) ... un switch mal réglé produit des clics | Cited sources list Dante, Q-LAN, AES67, RAVENNA, Milan/AVB (gPTP at Layer 2 per Kaltheuner et al.); Livewire and the layer-3 grouping and the "clicks" claim are not in any cited source. | Remove Livewire or add a source; mark layer-3 grouping and the clicks remark as unsourced or cite. |
| concepts | crest-factor | sources[].confidence (https://www.ranecommercial.com/legacy/pdf/ranenotes/Setting_Sound_System_Level_Controls.pdf) | verified-secondary with kind=manufacturer (Rane RaneNote 135) | Document is published by the manufacturer itself (own technical note / own site) | Set confidence to verified-primary (KB rule: manufacturer = verified-primary), or set kind to other/trade-press if the intent is to mark it as non-authoritative. |
| concepts | choir-microphone-coverage | sources[].confidence (https://www.dpamicrophones.com/mic-university/how-to-mic/how-to-mic-a-choir/) | verified-secondary with kind=manufacturer (DPA Mic University) | Document is published by the manufacturer itself (own technical note / own site) | Set confidence to verified-primary (KB rule: manufacturer = verified-primary), or set kind to other/trade-press if the intent is to mark it as non-authoritative. |
| skills | control-vocal-dynamics | success_criteria[3] / description | de-esser ... Les sifflantes ne dépassent plus sans que les voyelles changent de timbre | Neither cited source (dbx 166xs manual, UA 1176LN manual) covers de-essing; criterion is uncited though sources[].covers claims success_criteria | Add a de-esser source (e.g. a manufacturer de-esser manual) or limit covers to criteria 1-3. |
| skills | verify-accessibility-and-interpretation | sources[0].confidence | verified-secondary (kind: manufacturer, Ampetronic commissioning page) | Manufacturer content; policy = verified-primary | Relabel verified-primary for consistency with sources[1] (same manufacturer, labelled primary). |
| skills | design-dante-network-live | success_criteria[2] | Tous les appareils Dante ont une adresse dans le même sous-réseau (169.254.x.x ou plan DHCP) | Audinate: devices self-assign 169.254.*.* on primary and 172.31.*.* on the secondary network; same-subnet on two interfaces is an error | Say "toutes les interfaces primaires dans le même sous-réseau (169.254.x.x ou DHCP) et les secondaires en 172.31.x.x (ou DHCP du secondaire)" - otherwise contradicts criterion 1 and procedure build-redundant-dante-network. |
| procedures | build-redundant-dante-network | sources[2].confidence | verified-secondary (kind: manufacturer, Yamaha PC-D/DI manual) | Yamaha is the manufacturer; per labelling policy manufacturer docs = verified-primary | Set confidence to verified-primary (or change kind if it was deliberately downgraded because it documents another product, and say so in a note). |
| procedures | mix-session-stems-export | steps[4].action (example file name) | Nommer chaque fichier selon la convention (ex. AI_Titre_Drums_MI_01_48k24.wav) | P&E Wing example: "AI_SongTitle_MI01_Master_96k24.wav" - fields in order ArtistInitials_SongTitle_MixerInitials+number_Version/Stem_SampleRateBitDepth | Use the P&E order, e.g. "AI_Titre_MI01_Drums_48k24.wav" (mixer initials + version number before the stem name, no underscore inside MI01). |
| procedures | atmos-session-bed-objects | steps[2].action / typical_mistakes | le LFE ne se trouve que dans le bed ... Envoyer un objet vers le LFE (impossible) | None of the 4 cited pages (Dolby Atmos content creation, Renderer product page, 7.1.4 setup guide, Wikipedia) mention LFE or bed-only LFE. Claim is technically correct but unsourced. | Cite the Dolby Atmos Renderer guide (section on beds/objects: objects carry no LFE) or drop "(impossible)". |
| procedures | atmos-session-bed-objects | steps[3].action | contrôler en écoute sur les replis (7.1, 5.1, stéréo) | Renderer page only says it renders "to standard channel-based layouts"; specific re-render list not given | Acceptable; optionally cite the Renderer guide for the re-render formats. |
| rules | headphone-only-balance-judgement | sources[0].confidence | verified-secondary (kind: manufacturer, DPA Mic University) | DPA is a manufacturer; policy: manufacturer = verified-primary | Set verified-primary (or document why manufacturer educational content is downgraded, and apply consistently). |
| rules | audio-clock-not-referenced-to-video | explanation | sinon son et image peuvent avancer à des vitesses légèrement différentes même avec un timecode de départ juste | Sync X guide documents VIDEO REF IN (tri-level / black burst) for clock reference and "Connecting a Video Reference Source - To resolve Pro Tools / Sync X to external video reference"; it does not state the drift consequence explicitly | Keep (technically correct) but mark as editorial explanation, or add a source that states the drift consequence. |
| rules | connector-mate-mismatch | explanation | un jack TS et un jack TRS ne sont pas interchangeables ... le TS court-circuite le point froid d'une liaison symétrique ; ... adaptateur câblé selon le tableau de Rane | Extractable text of RaneNote 110 says "Balanced interconnect is not compatible with unbalanced" and covers balanced/unbalanced interfacing, but the TS-shorts-cold statement and wiring table are not in the HTML text (likely in figure images); not verifiable from text | Point to the specific RaneNote 110 figure (e.g. the interconnection chart) that shows TS/TRS wiring, or cite a source stating the ring-to-sleeve short explicitly. |
| rules | connector-mate-mismatch | sources[1].confidence | verified-secondary (kind: manufacturer, Rane) | Rane is a manufacturer; policy manufacturer = verified-primary | Relabel verified-primary. |
| rules | loudness-out-of-tolerance | condition | fires only when integrated loudness < -24.0 or > -22.0 LUFS for every programme | EBU R 128 h): target -23.0 LUFS; ±1.0 LU tolerance only "where attaining the Target Level is not achievable practically (for example, live programmes)"; i) ±0.2 LU in QC for measurement error | Make the band depend on session.is_live: ±1.0 LU for live, ±0.2 LU otherwise (explanation already says this; condition does not implement it). |
| rules | frequency-outside-authorised-band-fr | explanation | par exemple une variante C ou D d'un ew G4, ou P51 en ULX-D | Neither ARCEP page nor decision 2015-0830 mentions any product band variants (manufacturer data needed). The example is plausible (G4 C/D and ULX-D P51 lie in the 700/800 MHz region) but unsourced | Cite Sennheiser ew G4 and Shure ULX-D frequency-range tables, or remove the product examples. |
| faults | adat-channels-missing-96k | fixes[0] | Travailler à 44,1/48 kHz, ou ajouter un second port ADAT, ou passer en MADI | RME 10.2/17.4/27.4 and Audient p.17 confirm 4 ch at 88.2/96 kHz (S/MUX) and 2 ch at 176.4/192 kHz (S/MUX4); neither cited source mentions a second ADAT port or MADI as a remedy (both cited interfaces have a single optical input) | Keep "travailler à 44,1/48 kHz"; either drop "second port ADAT / MADI" or mark it as general advice not covered by the cited sources |
| faults | recording-too-dry | fixes[2] | Utiliser un cône ou un couple plus large pour plus d'ambiance | DPA AB article: Nose Cone adds ambience; spacing is increased "with the size of the orchestra" and "to improve channel separation in more reverberant rooms" - not to add ambience | Keep the Nose Cone fix; replace "couple plus large" with "reculer/monter le couple" (DPA: distance and height set the amount of ambience) |
| faults | recording-too-dry | sources[*].confidence | confidence "verified-secondary" with kind "manufacturer" (DPA Mic University) | Page is published by DPA Microphones itself (manufacturer); project rule: manufacturer = verified-primary | Set confidence to "verified-primary" (or change kind to "trade-press/educational" if secondary is intended, and document that convention) |
| faults | noisy-take-gain-staging | probable_causes[0] / fixes[0] (sources[*].covers) | Cause (high): "Gain de préampli trop faible puis remonté en numérique"; fix: "régler le gain pour une marge raisonnable"; Shure covers causes/checks/fixes, R68 covers fixes | Shure booklet covers room noise, sample recordings, avoiding fans/AC, mic closer = less background noise; it does not discuss low preamp gain/digital make-up gain. EBU R68 only defines alignment level (sine) relative to max digital level; it says nothing about noise or recording margin | Cite a gain-staging source for cause[0]/fix[0] (e.g. Shure/Audient gain-structure doc) or remove R68 and narrow Shure covers to causes[1-2], checks[2], fixes[1-2] |
| scenarios | opera-with-pit-recording | sources[1..2].confidence | confidence "verified-secondary" with kind "manufacturer" (DPA Mic University) | Page is published by DPA Microphones itself (manufacturer); project rule: manufacturer = verified-primary | Set confidence to "verified-primary" (or change kind to "trade-press/educational" if secondary is intended, and document that convention) |
| scenarios | auditorium-powered-pa-with-delays | required_gear[dbx-driverack-pa2].role / signal_flow | DriveRack PA2 = "processeur de diffusion (retards, égalisation)" feeding 2 mains + 2 mid-hall delays on separate outputs | No cited source covers the gear. dbx product page lists output processing as crossover (full range/2-way/3-way), PEQ, limiter and "Driver Alignment Delays", plus one input delay "for delaying the FOH system to the backline"; no documented independent delay-zone output mode for mid-hall fills | Cite the PA2 manual showing an output configuration and delay range that support delay fills, or use the QL1 output/matrix delay (or a processor with per-output delay) for the fills |
| scenarios | talk-show-four-guests | signal_flow.edges (m1..m5 -> desk) | Mics wired XLR directly into "dhd-rx2" console | DHD RX2 page describes a modular control surface (6 to 60 faders); mic inputs live on the DHD core/I-O modules, not the surface (brief itself says to check mic input count) | Add a DHD core/IO node between mics and surface, or label the node "RX2 + core" |
| scenarios | orchestra-recording-concert-hall | sources[1],sources[3].confidence | confidence "verified-secondary" with kind "manufacturer" (DPA Mic University) | Page is published by DPA Microphones itself (manufacturer); project rule: manufacturer = verified-primary | Set confidence to "verified-primary" (or change kind to "trade-press/educational" if secondary is intended, and document that convention) |
| glossary | antenne-yagi | sources[0].confidence | verified-secondary (kind: manufacturer, Shure Educational Publication) | Document is a Shure (manufacturer) educational publication; text confirms Yagi = dipole + reflector + directors, excellent directivity, fairly narrow bandwidth | Set confidence to verified-primary (manufacturer), or keep secondary but note the reason (third-party GMU-hosted copy) |
| glossary | field-strength-meter | sources[1].confidence | verified-secondary (Ampetronic Learning zone, kind manufacturer) | Ampetronic is the manufacturer; page states 400 mA/m @1 kHz +/-3 dB and FSM use | Set to verified-primary |
| glossary | piano-lid | sources[0].confidence | verified-secondary (DPA Microphones, kind manufacturer) | DPA Mic University is manufacturer content; supports lid angle/shorter stick directing reflections to audience or mics | Set to verified-primary |
| glossary | unity-gain | sources[0..1].confidence | verified-secondary (Rane RaneNotes, kind manufacturer) | RaneNotes are manufacturer application notes; content supports definition | Set to verified-primary |
| glossary | rolling-riser | sources[0..1].confidence | unverified (Ticket Fairy blog, Substack) | Both pages do support the definition (rolling risers used to pre-stage kit offstage; wheeled drum platform) | Set to verified-secondary (blog/trade press that supports the claim) rather than unverified |
| glossary | iso-17651 | definition | Série de normes de 2024 ... partie 1 cabines permanentes, partie 2 cabines mobiles | AFNOR pages confirm ISO 17651-1:2024 (permanent booths) and 17651-2:2024 (mobile booths); the series also has a Part 3 (interpreting hubs, 2022, from QA background knowledge, not on cited pages), so "série de 2024" is slightly inexact | Reword to 'Parties 1 et 2 (2024) de la série ISO 17651 ...' |
| glossary | sabine-formula | definition | « estimation valable surtout pour les salles assez réverbérantes » | sengpielaudio RT60 page gives RT60 = 0.161 V/A (metres) but says nothing about validity being limited to reverberant rooms (no Eyring/diffuse-field caveat on the cited page) | Either cite a source for the validity caveat (e.g. a text discussing Sabine vs Eyring) or drop the qualifier |
| glossary | stage-manager | sources[0..1].confidence | unverified (Substack, Ticket Fairy blog) | Both pages support: stage manager keeps the clock and signals remaining time during changeovers | Set to verified-secondary |
| glossary | unbalanced-line | sources[0].confidence | verified-secondary (DPA, kind manufacturer) | DPA article (E. B. Brixen): in the unbalanced connection the cable shield is part of the circuit | Set to verified-primary |
| glossary | headphone-console | definition | Poste dédié aux mixages casque des musiciens lors d'une séance de musique de film. | CineMontage only names the role ('at the headphone console, Christine Sirois') in a scoring-session article; it gives no definition | Plausible inference, but mark as editorial/inferred or add a source that describes the headphone console function |
| glossary | sound-pressure-limiter | sources[0].confidence | verified-secondary (kind: regulator, ARS Ile-de-France) | ARS is the state regional health agency; page states LPA must be installed and set by a professional (certificate) and EINS may prescribe it | Set to verified-primary (regulator), consistent with the label rule |
| rooms | museum-installed-sound-medium | sources[1].confidence, sources[2].confidence | verified-secondary (kind: manufacturer) | Genelec reference/case-study pages published by the manufacturer itself | Set confidence to verified-primary (manufacturer), or change kind to trade/case-study if secondary is intended; be consistent with sources[0]. |
| rooms | church-worship-medium | rt60_s.band_note | 11 églises portugaises de 8 470 à 14 207 m³ (XIVe–XXe s.) | ICSV2012 comparison table lists 11 churches with volume, RT 500-1k Hz and RASTI only; no construction dates/centuries are given (the two case-study churches are described as mid-20th-century). | Remove '(XIVe–XXe s.)' or cite a source for the construction dates. |
| learning_resources | l-acoustics-aes-audio-networking-requirements | author_or_publisher | L-Acoustics authors / AES | Henning Kaltheuner (consultant for d&b audiotechnik), Genio Kronauer and Etienne Corteel (L-Acoustics), Morten Lave (consultant for Adamson); AES conference paper, Le Mans, 23-26 Jan 2024 | author_or_publisher: 'Henning Kaltheuner, Genio Kronauer, Morten Lave, Etienne Corteel - AES (PDF hosted by L-Acoustics)' |
| learning_resources | audinate-dante-over-distance-technical-dive | type | white-paper | The file is a slide deck (case-study slides: Sydney Trains, Blue Note...) catalogued by Audinate under technical-guides | type: 'presentation' (or 'manufacturer-guide'); optionally note it is slides. |
| 3d_downloads | objv-vintage-microphone-klasy.glb | attribution_text | « Vintage Microphone » par Klasy (https://sketchfab.com/3d-models/a5986...) — Creative Commons Attribution | Sketchfab: license CC Attribution, url creativecommons.org/licenses/by/4.0/ | End the attribution with 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)' so the credit itself names the version and links the licence. |
| 3d_downloads | objv-battery-guitar-amp-camilote.glb | attribution_text | « Guitar Amp » par Gustavo Camilote (...) — Creative Commons Attribution | Sketchfab: license CC Attribution 4.0 (creativecommons.org/licenses/by/4.0/) | Append 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)'. |

## Caveats

- learning-resources.json has 259 entries with added_by (brief said 260); population = 259.
- PDF text extracted with pypdf (and PyMuPDF for the font-garbled KMR 1176LN manual) from site-packages, run under python -I, not a pure-stdlib parser.
- Pages returning 403 to scripts (tech.ebu.ch publication pages, Focusrite, studios-ferber.com, CISA PDF, n2t.net, hal.science) were verified via WebFetch, the official PDF, or the publisher API (HAL API, Smithsonian Open Access API, Poly Haven API, Sketchfab API).
- The talk-show-four-guests FAIL relies on the HA400 being a 4-output amp (KB equipment.csv row + well-known spec); Behringer/Thomann/Sweetwater pages were 404/403 at check time.
- 0 WebSearch calls used.

## Fixes applied (2026-10-22)

All 57 findings (1 fail + 56 minor) were handled. Every changed tek-brain record has a `conflicts[]` entry, prefixed "QA spot-check 2026-10-22", that keeps the old value. This was skipped for rooms and learning resources, whose record shape was left as is. After the fixes, `validate_tekbrain.py --strict` reports 0 errors, 0 warnings and 0 unresolved refs. `3d-models.json` and `learning-resources.json` parse. `build_index.py` was re-run (1832 chunks) and its tests pass. 1 WebSearch was used. The pages behind the new sources were re-opened on 2026-10-22.

Summary: 15 claims deleted or replaced by the source's own wording, 6 claims newly sourced, 11 corrected or reworded, 1 accepted as is (QA said acceptable). 20 of the 22 label findings were applied as suggested, 2 were kept on purpose, and 163 source labels changed in total.

### Fail

| Record | Change |
|---|---|
| talk-show-four-guests | `behringer-ha400` qty 1 → 2 (2 × 4 = 8 headphone outputs for 5 headphones). The role now says each HA400 has a single stereo input, so every headphone on one amp gets the same mix. New `signal_flow` node `core` (`equipment_id: null`, "Cœur DSP DHD XC3/XD3 + modules d'E/S XLR … non catalogué"). No DHD core id exists in `equipment/*.json`. The 5 mics, hybrid (both ways), both headphone amps and the ON-AIR GPIO now connect to `core`. The surface `desk` (dhd-rx2) connects to `core` over rj45, as in the dhd-rx2 equipment record. Node `hpa` was replaced by `hpa1` and `hpa2`. The dhd-rx2 role was updated. The minor DHD finding is fixed by the same change. |

### Unsupported or wrong content

| Record | Change |
|---|---|
| antenna-types-wireless | Deleted « panneau paddle ». |
| steerable-column-array | « (églises, halls, gares) » replaced by the Renkus-Heinz page's own examples (churches, an airport, great halls). |
| diffraction | Deleted the mic-body sentence. Removed the CIDB A4 source, which supported nothing in the record. |
| dialogue-editing | Deleted the boom/radio-mic choice and the "voices on separate tracks" sentences. |
| spot-microphones | Deleted the horn example. |
| side-fill-monitor | Definition and explanation rewritten to what Wikipedia Foldback says (re-fetched): upright on the side of the stage, covers areas the wedges do not reach, often standard FOH speakers, drum fill as a special case. Dropped the sub placement, "general mix" and feedback-risk content. |
| subgroup | Lack of a group insert now stated as an inference from the manual. Deleted the sub-out workaround. |
| quantization-noise | 98 dB and 146 dB are now explicitly "valeurs calculées avec cette formule" (6,02×n + 1,76). |
| microphone-split-foh-monitor | Deleted transformer isolation and "Y-cables are fragile". Text now follows Wikipedia: splitter in the snake or monitor desk, split snake, Y-cable. |
| audio-codec-ip | N-1 sentence rephrased. **Newly sourced**: Telos Hx1/Hx2 QSG p.3 mix-minus definition, verified-primary. |
| audio-over-ip | Deleted Livewire, the "layer 3" grouping and the "clicks" remark. AVB/Milan gPTP described as layer 2, per Kaltheuner et al. |
| control-vocal-dynamics | **Newly sourced**: the de-esser criterion is backed by the dbx 166xs manual's "De-Essing" section, re-read ("greatly attenuates the essing without affecting the basic sound quality or balance of the voice"). Criterion reworded to match. `covers` narrowed per criterion. |
| design-dante-network-live | Criterion 3 now says primaries are in 169.254.x.x or the primary DHCP range, and secondaries in 172.31.x.x or the secondary DHCP range. |
| mix-session-stems-export | File-name example changed to `AI_Titre_MI01_Drums_48k24.wav` (P&E order). |
| atmos-session-bed-objects | **Newly sourced**: LFE is bed-only, per Audient's "Objects and Beds Explained" ("objects can't feed the LFE channel (only beds can)"). Labelled verified-secondary because it is a third-party manufacturer describing a Dolby format. The re-render list was accepted as is and noted in `conflicts`. |
| audio-clock-not-referenced-to-video | Deleted the drift consequence. The explanation now only states what the Sync X guide documents (VIDEO REF IN). |
| connector-mate-mismatch | Deleted "le TS court-circuite le point froid" and "tableau de Rane". Kept Rane's verified "balanced is not compatible with unbalanced". Fix now points to a DI or a suitable interface cable. |
| loudness-out-of-tolerance | `condition` now branches on `session.is_live`: [−24,0 ; −22,0] LUFS when live, [−23,2 ; −22,8] LUFS otherwise, true peak > −1 dBTP always. Explanation updated to match. |
| frequency-outside-authorised-band-fr | Deleted the ew G4 C/D and ULX-D P51 examples. |
| adat-channels-missing-96k | `fixes[0]` limited to working at 44,1/48 kHz. Deleted the second-ADAT-port and MADI remedies. |
| recording-too-dry | `fixes[2]` is now the Nose Cone only. "Couple plus large" dropped; moving the pair back or up was already `fixes[1]`. |
| noisy-take-gain-staging | Removed EBU R68, which says nothing about noise. `probable_causes[0]` and `fixes[0]` reworded and **newly sourced** from RaneNote 135 (re-read, section "Console/Mic Preamp Gain Settings": set the trim until OL "just occasionally flickers … any less and you are hurting your best possible S/N"). Shure `covers` narrowed. |
| auditorium-powered-pa-with-delays | dbx DriveRack PA2 replaced by `meyer-sound-galileo-galaxy-816` (already in the KB) in `required_gear` and in the `proc` node. **Newly sourced**: the Meyer datasheet (re-read) gives "Gain, 2000 ms delay range …" on each of its 16 outputs. |
| iso-17651 | Reworded to « Parties 1 et 2 (2024) de la série ISO 17651 ». |
| sabine-formula | **Newly sourced**: validity caveat from Wikipedia Reverberation (re-fetched). Sabine over-predicts in small, highly absorptive rooms, where Eyring is preferred, and the two formulas are identical for very live rooms. |
| headphone-console | Definition now says the function is inferred from the role name, which is all CineMontage gives. |
| church-worship-medium | Deleted « (XIVe–XXe s.) » from `rt60_s.band_note`. |
| l-acoustics-aes-audio-networking-requirements | `author_or_publisher` = "Henning Kaltheuner, Genio Kronauer, Morten Lave, Etienne Corteel - AES (PDF hosted by L-Acoustics)". Also changed in `learning-resources-candidates/res-manufacturer.json` and `learning-resources-catalogue.md`. |
| audinate-dante-over-distance-technical-dive | `type` changed to `manufacturer-guide`, an existing type ("presentation" is not used in the file). `why_recommended` notes it is a slide deck. Candidate file also updated. |

### Licence and attribution

| Record | Change |
|---|---|
| objv-vintage-microphone-klasy, objv-battery-guitar-amp-camilote | Attribution now ends with "— Creative Commons Attribution 4.0 (CC BY 4.0) : http://creativecommons.org/licenses/by/4.0/". That is the licence URL exactly as returned by the Sketchfab API, re-checked 2026-10-22 ("CC Attribution", by/4.0). Changed in `3d-models.json` (3 strings, including the duplicate sketchfab-props entry for the guitar amp), `3d-models/downloads.json`, `3d-models/CREDITS.md`, and `3d-models/candidates/models-open-access-cad*.json` plus `models-sketchfab-props.json`, so a re-merge does not revert it. |

### Confidence labels

20 of the 22 findings were applied. The correction was made for the same URL everywhere in `tek-brain/**/*.json`, only where the label was `verified-secondary` and `kind` was manufacturer or regulator. That is **163 source labels across 154 records**:

| URL | Labels changed |
|---|---|
| RaneNote 135 PDF | 28 |
| RaneNote 110 | 20 |
| DPA multimiking | 19 |
| DPA AB orchestra | 14 |
| DPA 10 facts | 14 |
| Yamaha PC-D/DI Dante page | 13 |
| ARS Île-de-France LDSA | 12 |
| DPA choir | 11 |
| Ampetronic commissioning | 10 |
| DPA piano | 7 |
| DPA balanced/unbalanced | 6 |
| RaneNote 124 | 4 |
| TI SLAA013 | 3 |
| Genelec Bob Dylan Center | 1 |
| Genelec Parkano | 1 |

Two findings were not applied as suggested:

- **antenne-yagi**: kept verified-secondary. This is the alternative the reviewer allowed, because the copy is a third-party GMU mirror of a Shure PDF. The reason is now a source `note`. The other 72 uses of the same mirror were left as they are.
- **rolling-riser, stage-manager**: kept `unverified`. The KB policy is that blogs and forums are unverified, and that policy wins over the suggestion to make them verified-secondary. The decision is recorded in each record's `conflicts`.

Other pages from the same publishers are still labelled secondary and were not changed, because the brief scoped the fix to publisher + URL. These are 15 other DPA sources, 12 other Rane sources and 4 other Yamaha sources. They are worth a follow-up pass.
