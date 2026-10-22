# TekPractice - 3D model candidates (catalogue)

_Generated 2026-10-22. Link-only catalogue: nothing was downloaded. Source of truth: `knowledge-base/3d-models.json` (80 entries). Licences were read from the Sketchfab Data API v3 (`/v3/models/<uid>`), Poly Haven API + licence page, and each Poly Pizza model page; manufacturer pages were read directly._

**Totals:** 80 entries - suitable "yes" 29, "with work" 40, "no" (reference only) 11.

"with work" = licence OK but needs decimation, reshaping and/or logo removal (genericizing) on top of the mandatory rig pass.

## Top 15 recommendations for Oscar

| # | Target | Model | Why |
|---|---|---|---|
| 1 | `ev-re20` | [Broadcast Microphone - Atilla Kutluay Erdoğay (CC BY)](https://sketchfab.com/3d-models/broadcast-microphone-09dbff49d6da4521970b08e5bc0d1e33) | Fixes the known mismatch (ev-re20 currently uses an SM7B mesh). Unbranded broadcast dynamic, 21k faces; reshape to the RE20 long body. No RE20 replica exists under CC. |
| 2 | `shure-sm7b` | [Shure SM7B microphone - a1oo (CC BY)](https://sketchfab.com/3d-models/shure-sm7b-microphone-7321ebc1b2634b4a8e56508dfe8b4d6e) | Gives the SM7B its own mesh once ev-re20 stops borrowing it. Decimate (100k faces) and genericize. |
| 3 | `neumann-tlm-103 (+ m-149, ela-m-251e)` | [Condenser Microphone - Kyler Michaelson (CC BY)](https://sketchfab.com/3d-models/condenser-microphone-4d32ad54ac72488995da9474e3436bbd) | Unbranded LDC, 21k faces, PBR - ships generic out of the box. Same author series gives a matching monitor and compressor. |
| 4 | `neumann-kh-120-ii / genelec-8341a` | [Studio Monitors - Kyler Michaelson (CC BY)](https://sketchfab.com/3d-models/studio-monitors-12b3ce23f32a4aa99cd5ba07330bf086) | Custom unbranded 2-way monitor, 11.6k faces: one generic mesh for several high-value monitors. |
| 5 | `yamaha-hs8` | [Yamaha HS8 Studio Monitor - Ivan_WSK (CC BY)](https://sketchfab.com/3d-models/yamaha-hs8-studio-monitor-d82ed6ea096c40358229fc0c31b0e8e8) | Exact match, 20k faces. Remove the Yamaha logo for the generic track. |
| 6 | `sony-mdr-7506` | [Sony MDR-7506 Headphones - AndreiVNK (CC BY)](https://sketchfab.com/3d-models/sony-mdr-7506-headphones-05735b74d3524f00b648231138122a28) | Exact match, 10.8k faces. |
| 7 | `behringer-ha400` | [Behringer MicroAMP HA400 - homeleon (CC BY)](https://sketchfab.com/3d-models/behringer-microamp-ha400-360af575ce6a42baa050c0238c7e19ab) | Exact match of a sim_value "high" device; decimate 102k faces. |
| 8 | `focusrite-scarlett-2i2-4th-gen` | [Focusrite Scarlett Solo 4th Gen - Ivan_WSK (CC BY)](https://sketchfab.com/3d-models/focusrite-scarlett-solo-4th-gen-9cdbec90442a4fd1a6aa7fd4b1be136a) | Same enclosure family, already 4k faces; add second combo input. |
| 9 | `yamaha-mg10xu` | [Yamaha MG06 Mixer Lowpoly - Ivan_WSK (CC BY)](https://sketchfab.com/3d-models/yamaha-mg06-mixer-lowpoly-a03a0da5a3b84402a8751b75dd9bffb9) | MG-family look at 3.8k faces; widen to 10 channels. |
| 10 | `l-acoustics-kara-ii (and k2)` | [Line Array - Wilmer.Jose.Saumeth.Suarez (CC BY)](https://sketchfab.com/3d-models/line-array-cc558455c6d141ccb69c23222af46c8a) | Unbranded low-poly line array (8k faces). Use the L-Acoustics CAD files only as dimension reference. |
| 11 | `generic PA top + sub` | [PA concert speaker / bass_speaker - clean - cabriocat (CC BY)](https://sketchfab.com/3d-models/pa-concert-speaker-clean-b6d18dc5a9ae49aa872b5d2af72da659) | Matching unbranded pair (5.3k + 1.5k faces): instant concert/theatre PA. |
| 12 | `l-acoustics-x15-hiq (any wedge)` | [Floor Monitor - Peter Simcoe (Poly Pizza, CC BY 3.0)](https://poly.pizza/m/2827m06VfIA) | Low-poly generic wedge; reproportion. |
| 13 | `sennheiser-mkh-416 + boom` | [Shotgun Mic - Tall3 / Boom Mic - Glowbox 3D (CC BY)](https://sketchfab.com/3d-models/shotgun-mic-555254fb99114159bf0dde499d5f52d0) | Covers the ENG/film use case; boom: https://sketchfab.com/3d-models/boom-mic-2b8236d4329a439baff0bc2056fcbb80 |
| 14 | `room:conference-installed` | [Conference Room1 - MozillaHubs (CC BY)](https://sketchfab.com/3d-models/conference-room1-b69e2a5dd7de4d7a8e091768d54a63e6) | 742 faces: built for WebGL (Mozilla Hubs) - ideal Babylon.js room shell. |
| 15 | `room:concert-open-air` | [Simple Concert Stage - gluttonia (CC BY) + Truss Structure - JanoschR (CC BY)](https://sketchfab.com/3d-models/simple-concert-stage-d5c7733d06d24947bf60b3a0fe203f69) | Low-poly VR-made stage (6.5k faces) + truss for flown PA: https://sketchfab.com/3d-models/truss-structure-5d4285d6ba444b648d5fb9407a337b16 |

Honourable mentions: Poly Haven CC0 props (portable generator, projector screen, office desk, power box) for ENG / conference / radio rooms; "Studio TV talk show" (17.8k faces) for the TV set after a logo check.

## Microphones

| Target id | Model (site) | Author | Licence | Polys | Logos | Suitable |
|---|---|---|---|---|---|---|
| `ev-re20` | [Broadcast Microphone](https://sketchfab.com/3d-models/broadcast-microphone-09dbff49d6da4521970b08e5bc0d1e33) (Sketchfab) | Atilla Kutluay Erdoğay | CC Attribution | 21452 faces / 10800 vertices | unknown | **with work** |
| `ev-re20` | [Electro Voice microphone](https://sketchfab.com/3d-models/electro-voice-microphone-e7b87940f67f4f318ff5c43a88bca7fd) (Sketchfab) | Kesenkai | CC Attribution | 91539 faces / 46949 vertices | unknown | **with work** |
| `shure-sm7b` | [Shure SM7B microphone](https://sketchfab.com/3d-models/shure-sm7b-microphone-7321ebc1b2634b4a8e56508dfe8b4d6e) (Sketchfab) | a1oo | CC Attribution | 99783 faces / 48750 vertices | unknown | **with work** |
| `shure-sm7b` | [Shure Sm7b](https://sketchfab.com/3d-models/shure-sm7b-37c21283fcc84f7c9a98e3389e79506c) (Sketchfab) | Yanis | CC Attribution | 139446 faces / 69893 vertices | unknown | **with work** |
| `neumann-tlm-103` | [Condenser Microphone](https://sketchfab.com/3d-models/condenser-microphone-4d32ad54ac72488995da9474e3436bbd) (Sketchfab) | Kyler Michaelson | CC Attribution | 21434 faces / 11535 vertices | no | **yes** |
| `generic:large-diaphragm-condenser` | [Studio Microphone](https://sketchfab.com/3d-models/studio-microphone-104d0ec3f7cb4c4d8a60f13cd9bcbc29) (Sketchfab) | CheBe | CC Attribution | 242998 faces / 104711 vertices | unknown | **with work** |
| `sennheiser-mkh-416` | [Shotgun Mic](https://sketchfab.com/3d-models/shotgun-mic-555254fb99114159bf0dde499d5f52d0) (Sketchfab) | Tall3 | CC Attribution | 23496 faces / 11750 vertices | unknown | **with work** |
| `rode-ntg2` | [Shotgun Microphone](https://sketchfab.com/3d-models/shotgun-microphone-19ae1e0ac5634d1195de95f0cf1b468b) (Sketchfab) | Helindu | CC Attribution | 137550 faces / 69105 vertices | unknown | **with work** |
| `generic:boom-pole-with-shotgun` | [Boom Mic](https://sketchfab.com/3d-models/boom-mic-2b8236d4329a439baff0bc2056fcbb80) (Sketchfab) | Glowbox 3D | CC Attribution | 6150 faces / 3167 vertices | no | **yes** |
| `generic:handheld-wireless-mic` | [Wireless Microphone](https://sketchfab.com/3d-models/wireless-microphone-1f48a1a02fa448e5b9b2f350f05a401d) (Sketchfab) | CARTE 3D | CC Attribution | 22704 faces / 9006 vertices | unknown | **yes** |
| `generic:mic-stand-straight` | [Microphone Stand](https://sketchfab.com/3d-models/microphone-stand-16cfa90113ee43f4812d062d37d26462) (Sketchfab) | yuliia | CC Attribution | 2880 faces / 1458 vertices | no | **yes** |
| `beyerdynamic-dt-770-pro` | [beyerdynamics DT900 PRO X](https://sketchfab.com/3d-models/beyerdynamics-dt900-pro-x-ca0da01d2ff84c5fb6ef0e2a2423b7da) (Sketchfab) | niko.rummukainen | CC Attribution | 20564 faces / 10456 vertices | unknown | **with work** |

## Headphones & headphone amps

| Target id | Model (site) | Author | Licence | Polys | Logos | Suitable |
|---|---|---|---|---|---|---|
| `sony-mdr-7506` | [Sony MDR-7506 Headphones](https://sketchfab.com/3d-models/sony-mdr-7506-headphones-05735b74d3524f00b648231138122a28) (Sketchfab) | AndreiVNK | CC Attribution | 10795 faces / 5655 vertices | unknown | **with work** |
| `sennheiser-hd-600` | [6XX Model Sennheiser  Headphone](https://sketchfab.com/3d-models/6xx-model-sennheiser-headphone-0afa8eee78da4955b27e8800e5566658) (Sketchfab) | jenimdeans | CC Attribution | 49216 faces / 24626 vertices | unknown | **with work** |
| `behringer-ha400` | [Behringer MicroAMP HA400](https://sketchfab.com/3d-models/behringer-microamp-ha400-360af575ce6a42baa050c0238c7e19ab) (Sketchfab) | homeleon | CC Attribution | 102204 faces / 52033 vertices | unknown | **with work** |
| `generic:closed-headphones` | [Sennheiser HD 280](https://sketchfab.com/3d-models/sennheiser-hd-280-11d7fc895b3d43cd943cb1a5f3a758a0) (Sketchfab) | Qlone | CC Attribution-NoDerivs | 245848 faces / 122892 vertices | unknown | **no** |

## Consoles, interfaces & auto-mixers

| Target id | Model (site) | Author | Licence | Polys | Logos | Suitable |
|---|---|---|---|---|---|---|
| `yamaha-mg10xu` | [Yamaha MG06 Mixer Lowpoly](https://sketchfab.com/3d-models/yamaha-mg06-mixer-lowpoly-a03a0da5a3b84402a8751b75dd9bffb9) (Sketchfab) | Ivan_WSK | CC Attribution | 3782 faces / 2034 vertices | unknown | **with work** |
| `behringer-xenyx-x1204usb` | [Xenyx music mixer](https://sketchfab.com/3d-models/xenyx-music-mixer-6d50a62f7cb54ce5a70e68f57954d5ab) (Sketchfab) | CheBe | CC Attribution | 164970 faces / 83959 vertices | unknown | **with work** |
| `generic:analog-mixing-console` | [audio mixing console](https://sketchfab.com/3d-models/audio-mixing-console-2de856e665044d41897ec6047f41aa91) (Sketchfab) | SURVIVED | CC Attribution | 6552 faces / 4062 vertices | unknown | **yes** |
| `ssl-origin` | [SSL 9000 J-K Console](https://sketchfab.com/3d-models/ssl-9000-j-k-console-0230be42cc7f4a3a9ad5d6bc13051670) (Sketchfab) | Actiondyne Industries | CC Attribution | 257254 faces / 228243 vertices | unknown | **with work** |
| `generic:rack-mount-mixer` | [YAMAHA MV1602 - VINTAGE RACK MOUNT MIXER](https://sketchfab.com/3d-models/yamaha-mv1602-vintage-rack-mount-mixer-cd6a73ac8da842be96fea6b148c3085f) (Sketchfab) | Dave.Maak | CC Attribution | 106795 faces / 58033 vertices | unknown | **with work** |
| `focusrite-scarlett-2i2-4th-gen` | [Focusrite Scarlett Solo 4th Gen](https://sketchfab.com/3d-models/focusrite-scarlett-solo-4th-gen-9cdbec90442a4fd1a6aa7fd4b1be136a) (Sketchfab) | Ivan_WSK | CC Attribution | 4032 faces / 2145 vertices | unknown | **with work** |
| `audient-id14-mkii` | [MOTU M2 Audio Interface](https://sketchfab.com/3d-models/motu-m2-audio-interface-54f8df4246b24c7a9fec2a364b09321e) (Sketchfab) | blenderbirb | CC Attribution | 3622 faces / 2036 vertices | unknown | **with work** |
| `shure-scm820` | [ATDM-0604](https://sketchfab.com/3d-models/atdm-0604-281c1395c2144be9a2230d40112bbe33) (Sketchfab) | MD | CC Attribution | 417629 faces / 224043 vertices | unknown | **with work** |
| `generic:dj-mixer` | [Rodec Mixetta - mixing console](https://sketchfab.com/3d-models/rodec-mixetta-mixing-console-a848812574b141d7bb2b6af2e9bdb5ee) (Sketchfab) | João Desager | CC Attribution-NonCommercial | 50607 faces / 29008 vertices | unknown | **no** |
| `generic:digital-rack-mixer` | [Behringer Xair 18](https://sketchfab.com/3d-models/behringer-xair-18-bfdb50952a0340b494c00c0f56699d84) (Sketchfab) | samueland | Free Standard | 99973 faces / 50274 vertices | unknown | **no** |

## Monitors, loudspeakers & amps

| Target id | Model (site) | Author | Licence | Polys | Logos | Suitable |
|---|---|---|---|---|---|---|
| `yamaha-hs8` | [Yamaha HS8 Studio Monitor](https://sketchfab.com/3d-models/yamaha-hs8-studio-monitor-d82ed6ea096c40358229fc0c31b0e8e8) (Sketchfab) | Ivan_WSK | CC Attribution | 19984 faces / 11800 vertices | unknown | **with work** |
| `neumann-kh-120-ii` | [Studio Monitors](https://sketchfab.com/3d-models/studio-monitors-12b3ce23f32a4aa99cd5ba07330bf086) (Sketchfab) | Kyler Michaelson | CC Attribution | 11612 faces / 5810 vertices | no | **yes** |
| `generic:studio-monitor-2way` | [Modern Studio Speaker - PBR](https://sketchfab.com/3d-models/modern-studio-speaker-pbr-3fb8a259ca3e4c7e9c82963d5336b1cb) (Sketchfab) | TranHung | CC Attribution | 16984 faces / 8634 vertices | unknown | **yes** |
| `focal-shape-65` | [Enceinte Focal CMS-50](https://sketchfab.com/3d-models/enceinte-focal-cms-50-7f4d45c05728430b819788fd5969a5a4) (Sketchfab) | Antoine | CC Attribution | 402094 faces / 203330 vertices | unknown | **with work** |
| `generic:monitor-stand` | [Studio Monitor Stand](https://sketchfab.com/3d-models/studio-monitor-stand-efe18c5e0cd94b2887c5dc58f971ed35) (Sketchfab) | Paw Inspector | CC Attribution | 5521 faces / 2864 vertices | no | **yes** |
| `l-acoustics-k2` | [LIne Array](https://sketchfab.com/3d-models/line-array-df55816eeb9f40019519d22ae234f486) (Sketchfab) | Pachecko | CC Attribution | 117512 faces / 60777 vertices | unknown | **with work** |
| `l-acoustics-kara-ii` | [Line Array](https://sketchfab.com/3d-models/line-array-cc558455c6d141ccb69c23222af46c8a) (Sketchfab) | Wilmer.Jose.Saumeth.Suarez | CC Attribution | 8038 faces / 4053 vertices | unknown | **with work** |
| `l-acoustics-ks28` | [Subwoofer Stage Speaker](https://sketchfab.com/3d-models/subwoofer-stage-speaker-78aa11be4ae24065aa9bedf3c4146ff0) (Sketchfab) | Eveston - Elite Big Speakerman - Hugo | CC Attribution | 24130 faces / 12510 vertices | unknown | **with work** |
| `generic:pa-subwoofer` | [PA concert bass_speaker - clean](https://sketchfab.com/3d-models/pa-concert-bass-speaker-clean-d1830b98d13b43619e704ca96f0f3663) (Sketchfab) | cabriocat | CC Attribution | 1472 faces / 768 vertices | no | **yes** |
| `generic:pa-top` | [PA concert speaker - clean](https://sketchfab.com/3d-models/pa-concert-speaker-clean-b6d18dc5a9ae49aa872b5d2af72da659) (Sketchfab) | cabriocat | CC Attribution | 5282 faces / 2856 vertices | no | **yes** |
| `generic:stage-speaker` | [Stage Speaker - black](https://sketchfab.com/3d-models/stage-speaker-black-f3209a6a45b844df92560099f982a508) (Sketchfab) | Sousinho | CC Attribution | 6940 faces / 3500 vertices | unknown | **yes** |
| `crown-xls-2502` | [Travel Rack with Amps](https://sketchfab.com/3d-models/travel-rack-with-amps-8fc873e47fa445dc817b6bfac3ee4b35) (Sketchfab) | sonidero | CC Attribution | 136604 faces / 70892 vertices | unknown | **with work** |
| `generic:studio-monitor-2way` | [studio monitors/speaker (Presonus, 3.5in)](https://sketchfab.com/3d-models/studio-monitorsspeaker-presonus-35in-ac0a0181e3f144578bd0e543c4d95442) (Sketchfab) | skeeeyee | Free Standard | 146767 faces / 75820 vertices | unknown | **no** |
| `l-acoustics-x15-hiq` | [Floor Monitor](https://poly.pizza/m/2827m06VfIA) (Poly Pizza) | Peter Simcoe | Creative Commons Attribution | not shown | no | **with work** |
| `generic:speaker-stand` | [Rolling Music Speaker Stand](https://poly.pizza/m/2QYyKRb68QD) (Poly Pizza) | Peter Simcoe | Creative Commons Attribution | not shown | no | **yes** |
| `generic:small-speaker` | [Speaker](https://poly.pizza/m/GWfUJDmiOO) (Poly Pizza) | Kenney | Public Domain (CC0) | not shown | no | **yes** |
| `l-acoustics-k2` | [K2 - CAD / Revit / SketchUp files](https://www.l-acoustics.com/result-documentation-center/?choice=K2) (L-Acoustics Documentation Center) | L-Acoustics | not stated on download page | not shown | unknown | **no** |
| `l-acoustics-x15-hiq` | [X15 HiQ - CAD / Revit / SketchUp files](https://www.l-acoustics.com/result-documentation-center/?choice=X15%20HiQ) (L-Acoustics Documentation Center) | L-Acoustics | not stated on download page | not shown | unknown | **no** |
| `l-acoustics-ks28` | [KS28 - CAD / Revit / SketchUp files](https://www.l-acoustics.com/result-documentation-center/?choice=KS28) (L-Acoustics Documentation Center) | L-Acoustics | not stated on download page | not shown | unknown | **no** |

## Processors, recorders & wireless

| Target id | Model (site) | Author | Licence | Polys | Logos | Suitable |
|---|---|---|---|---|---|---|
| `universal-audio-teletronix-la-2a` | [Warm Audio WA-2A](https://sketchfab.com/3d-models/warm-audio-wa-2a-c7308083ec5641cabf26e6678b10ab54) (Sketchfab) | Haderium | CC Attribution | 453235 faces / 231111 vertices | unknown | **with work** |
| `generic:rack-compressor` | [Audio Compressor](https://sketchfab.com/3d-models/audio-compressor-78b8446ee6d245b3a981dd1e682aea58) (Sketchfab) | Kyler Michaelson | CC Attribution | 337136 faces / 169314 vertices | no | **with work** |
| `zoom-h6essential` | [Zoom H2n Handy Recorder](https://sketchfab.com/3d-models/zoom-h2n-handy-recorder-973c7f2ee56e46ebaea86c0d48a72425) (Sketchfab) | 3DSCANPRO | CC Attribution | 43192 faces / 21601 vertices | unknown | **with work** |
| `nagra-4-2` | [Reel-to-Reel Tape Recorder](https://sketchfab.com/3d-models/reel-to-reel-tape-recorder-160ba370260b4f2b87effeaa0765f705) (Sketchfab) | YJ_ | CC Attribution | 24544 faces / 13754 vertices | unknown | **with work** |
| `sennheiser-ew-100-g4` | [ATW-R3210N](https://sketchfab.com/3d-models/atw-r3210n-125fbbff617648af93ea551a217bb0ea) (Sketchfab) | MD | CC Attribution | 166058 faces / 87672 vertices | unknown | **with work** |
| `generic:portable-recorder` | [Portable Studio Audio Recorder](https://poly.pizza/m/dEFy5xbf8rZ) (Poly Pizza) | Peter Simcoe | Creative Commons Attribution | not shown | no | **with work** |

## Props & scene dressing

| Target id | Model (site) | Author | Licence | Polys | Logos | Suitable |
|---|---|---|---|---|---|---|
| `generic:ldc-on-broadcast-arm` | [Rode NT1-A + Arm](https://sketchfab.com/3d-models/rode-nt1-a-arm-7f60562716c64d149021bf05473e7812) (Sketchfab) | Vivien Deroche | CC Attribution | 152750 faces / 79104 vertices | unknown | **with work** |
| `generic:tv-studio-camera` | [TV Camera](https://sketchfab.com/3d-models/tv-camera-3795b3283e9447c391efdab9a4efe27a) (Sketchfab) | merlincodes | CC Attribution | 1172 faces / 600 vertices | no | **yes** |
| `generic:truss` | [Truss Structure](https://sketchfab.com/3d-models/truss-structure-5d4285d6ba444b648d5fb9407a337b16) (Sketchfab) | JanoschR | CC Attribution | 24480 faces / 21004 vertices | no | **yes** |
| `generic:cable-reels` | [Cable reels](https://sketchfab.com/3d-models/cable-reels-53d00d26d6e14cd5bca1d7cedd4eb3b4) (Sketchfab) | Lassi Kaukonen | CC Attribution | 330628 faces / 166608 vertices | no | **with work** |
| `generic:recording-flight-case` | [LJAS - Audio Recording Flight Case](https://sketchfab.com/3d-models/ljas-audio-recording-flight-case-c71c3769c73d49688db1e3ebf368a306) (Sketchfab) | La Jarre à Son | Free Standard | 5240 faces / 3528 vertices | unknown | **no** |
| `generic:power-distro-box` | [Power Box 01](https://polyhaven.com/a/power_box_01) (Poly Haven) | Rico Cilliers, Yann Kervran | CC0 | 21272 polys | no | **yes** |
| `generic:megaphone` | [Megaphone 01](https://polyhaven.com/a/Megaphone_01) (Poly Haven) | Ethan Simon-Law | CC0 | 15814 polys | no | **yes** |
| `generic:cables` | [Modular Electric Cables](https://polyhaven.com/a/modular_electric_cables) (Poly Haven) | Kuutti Siitonen | CC0 | 42078 polys | no | **yes** |

## Rooms / installations

| Target id | Model (site) | Author | Licence | Polys | Logos | Suitable |
|---|---|---|---|---|---|---|
| `room:recording-studio` | [Recording Studio](https://sketchfab.com/3d-models/recording-studio-3304add0c13f416597dd393a76867f96) (Sketchfab) | Noah Lupowitz | CC Attribution | 95802 faces / 80045 vertices | unknown | **with work** |
| `room:recording-studio` | [Band Home Recording Studio Room](https://sketchfab.com/3d-models/band-home-recording-studio-room-7d10f6176c8f4e4da153021ba05ac24c) (Sketchfab) | fabriminal | CC Attribution | 400140 faces / 211912 vertices | unknown | **with work** |
| `room:post-production-room` | [Recording Studio Desk](https://sketchfab.com/3d-models/recording-studio-desk-a008b56baa774184a808cf393823c462) (Sketchfab) | sevenstudiocolombia | CC Attribution | 198785 faces / 102525 vertices | unknown | **with work** |
| `room:radio-booth` | [AB Radio Studio](https://sketchfab.com/3d-models/ab-radio-studio-44a60d726b194b1e87614d7bcedcb074) (Sketchfab) | Amasah Blankson | CC Attribution | 131788 faces / 80808 vertices | unknown | **with work** |
| `room:tv-set` | [Studio TV talk show](https://sketchfab.com/3d-models/studio-tv-talk-show-2f68aa7a4c08496fb8941585218de24f) (Sketchfab) | RIK Cyprus 12 | CC Attribution | 17808 faces / 14979 vertices | unknown | **with work** |
| `room:tv-set` | [Quizshow TV Studio WIP](https://sketchfab.com/3d-models/quizshow-tv-studio-wip-0b0c0c94cffe442a9e891ee24a0593ee) (Sketchfab) | Miguelangelo Rosario | CC Attribution | 93586 faces / 45873 vertices | unknown | **with work** |
| `room:tv-set` | [ARD Tagesschau Studio Night 27.08-16.09.2016](https://sketchfab.com/3d-models/ard-tagesschau-studio-night-2708-16092016-1b84fca08e5b4fcdb66d56dc75cfb3d1) (Sketchfab) | alekseenkogalina585 | CC Attribution | 6186 faces / 7542 vertices | unknown | **no** |
| `room:theatre` | [Theatre stage](https://sketchfab.com/3d-models/theatre-stage-5c53624a0a334242ad04d7a11a2dcf8e) (Sketchfab) | mynameismary | CC Attribution | 21180 faces / 8464 vertices | unknown | **yes** |
| `room:theatre` | [Theater Stage Curtains](https://sketchfab.com/3d-models/theater-stage-curtains-8633a0c7ef7540c099d4a1796fc12fef) (Sketchfab) | fuglee | CC Attribution | 15032 faces / 7894 vertices | no | **yes** |
| `room:concert-open-air` | [Simple Concert Stage](https://sketchfab.com/3d-models/simple-concert-stage-d5c7733d06d24947bf60b3a0fe203f69) (Sketchfab) | gluttonia | CC Attribution | 6458 faces / 4394 vertices | no | **yes** |
| `room:concert-open-air` | [Concert Stage](https://sketchfab.com/3d-models/concert-stage-4f0cbcb0b1b64d5e88ec1122e23d9d4c) (Sketchfab) | Koekphon | CC Attribution | 10146 faces / 6172 vertices | unknown | **yes** |
| `room:concert-open-air` | [Festival Stage [LowPoly]](https://sketchfab.com/3d-models/festival-stage-lowpoly-080542b9b54c4f3aa6c389dab6b00b3e) (Sketchfab) | Mareon | CC Attribution | 594 faces / 666 vertices | no | **yes** |
| `room:conference-installed` | [Conference Room1](https://sketchfab.com/3d-models/conference-room1-b69e2a5dd7de4d7a8e091768d54a63e6) (Sketchfab) | MozillaHubs | CC Attribution | 742 faces / 646 vertices | no | **yes** |
| `room:conference-installed` | [Press Conference Room](https://sketchfab.com/3d-models/press-conference-room-1a3dcbbdd5c140b788ab73353d7311a6) (Sketchfab) | ARKURNIAWAN | CC Attribution | 48990 faces / 37142 vertices | unknown | **with work** |
| `room:eng-outdoor-reportage` | [Low poly News Van](https://sketchfab.com/3d-models/low-poly-news-van-e17dd3c0b1584c8f8a23ca4790db48da) (Sketchfab) | steblecovmark | CC Attribution | 14703 faces / 12904 vertices | unknown | **yes** |
| `room:concert-open-air` | [Concert Stage](https://sketchfab.com/3d-models/concert-stage-8074957c9ad24d878d2c0b91b41339b7) (Sketchfab) | wessel.huizenga | CC Attribution-NonCommercial | 5827 faces / 6685 vertices | unknown | **no** |
| `room:recording-studio` | [Recording Studio](https://sketchfab.com/3d-models/recording-studio-8dac457c4e6443f684e5ce8666dd728c) (Sketchfab) | Home Design 3D | CC Attribution-NonCommercial-ShareAlike | 106471 faces / 58946 vertices | unknown | **no** |
| `room:eng-outdoor-reportage` | [Portable Generator](https://polyhaven.com/a/portable_generator) (Poly Haven) | James Ray Cock | CC0 | 26419 polys | no | **yes** |
| `room:conference-installed` | [Projector Screen](https://polyhaven.com/a/projector_screen) (Poly Haven) | PeterM | CC0 | 8727 polys | no | **yes** |
| `room:radio-booth` | [Metal Office Desk](https://polyhaven.com/a/metal_office_desk) (Poly Haven) | Ulan Cabanilla | CC0 | 6898 polys | no | **yes** |
| `room:tv-set` | [Mounted Fluorescent Lights](https://polyhaven.com/a/mounted_fluorescent_lights) (Poly Haven) | Ulan Cabanilla | CC0 | 17820 polys | no | **yes** |

## Gaps (not found)

- **Sketchfab API: "RE20", "electro-voice" (no RE20 found), "ribbon microphone", "ribbon mic"** - No downloadable CC model of an RE20, Royer R-121, Coles 4038, AEA R84 or beyerdynamic M 160. Recommend AI image-to-3D or hand-model from photos.
- **Sketchfab API: "large diaphragm condenser microphone", "lavalier microphone", "bodypack"** - No relevant downloadable hits (lavalier / bodypack transmitters: nothing usable). Sanken COS-11D, Rode Lavalier II, ew-dp-ek bodypacks: hand-model (simple shapes).
- **Sketchfab API: "stagebox", "rack unit 19 inch", "19 inch rack", "server rack audio", "power amplifier rack", "equalizer rack", "patch bay", "DI box"** - No usable hits. Stageboxes, DI boxes, 1U/2U processors, amps (LA12X, D80, NXAMP), patchbays: procedural 19-inch box generator in Blender is faster than sourcing.
- **Sketchfab API: "yamaha mg10", "mackie mixer", "allen heath", "behringer x32", "1176 compressor", "neve 1073", "sound devices", "zoom f8"** - No downloadable hits for these exact products.
- **Sketchfab API: "LA-2A", "on air light", "ENG camera", "tripod camera broadcast", "digital mixer"** - Only irrelevant results (search matches unrelated words).
- **Genelec 8341A page + genelec.com/design-tools** - Only EASE/CLF/GLL acoustic simulation files and PDFs; no 3D/CAD geometry found.
- **Neumann KH 120 II product page** - Only manuals / dealer text / file finder; no 3D/CAD listed.
- **Shure, d&b audiotechnik, Sennheiser BIM/CAD pages; BlenderKit** - Not checked in this pass (budget). To do: d&b and Shure publish CAD/BIM for installed products; BlenderKit needs per-asset check (Royalty Free vs CC0).
- **Poly Pizza listings** - Search listing does not show licences; each kept model page was opened and its licence read.

Still without a candidate (high sim_value): stageboxes (midas-dl16, digico-sd-rack, db-audiotechnik-ds10/ds20), DI boxes (radial-*), power amps (la12x, d80, nxamp4x4mk2), wireless bodypacks/IEM (psm-300/900, ew-iem-g4), Sound Devices 833 / Nagra VI, ribbon mics. Recommended route: procedural 19-inch box generator (rack gear) + AI image-to-3D from `assets-source/**/photos/` for handhelds.

## Licences & trademarks / Licences et marques

**EN.** Two separate layers. (1) *Copyright of the file* = the model licence. CC0: use freely. CC BY (Sketchfab "CC Attribution", Poly Pizza "Creative Commons Attribution"): commercial use and modification allowed, but the credit line must be logged (ASSET_MANIFEST `attributionText` + `assets-source/CREDITS.md`). CC BY-SA: allowed but share-alike can spread to our derived files - avoid. NonCommercial (NC), NoDerivs (ND), Editorial, Sketchfab Standard / "Free Standard" (no stand-alone redistribution, product must not get its main value from the model), store royalty-free, GrabCAD and manufacturer CAD with no stated terms (e.g. L-Acoustics documentation center): **reference only, never shipped**. (2) *Trademark / trade dress* of the real product is never granted by any file licence. A CC BY "Yamaha HS8" still shows a Yamaha product: strip logos/text and alter the look before any commercial release (CLAUDE.md: generic visual equivalents only; real references stay internal). Replicas of real TV sets (e.g. ARD Tagesschau) are excluded for the same reason.

**FR.** Deux couches distinctes. (1) *Droit d'auteur du fichier* = la licence du modele. CC0 : usage libre. CC BY (« CC Attribution ») : usage commercial et modification autorises, credit obligatoire, au format « Titre » par Auteur (URL) — Creative Commons Attribution, consigne dans ASSET_MANIFEST et CREDITS.md. CC BY-SA : a eviter (partage a l'identique contagieux). NC, ND, Editorial, Standard / Free Standard Sketchfab, licences de boutique, GrabCAD et fichiers CAO constructeur sans conditions affichees : **reference uniquement, jamais livres**. (2) *Marque et apparence du produit* : aucune licence de fichier ne les couvre. Un modele CC BY d'un produit de marque doit etre « genericise » (logos et textes retires, design modifie) avant toute sortie commerciale ; les references reelles restent internes.


## Catalogue étendu (run 2, 2026-10-22)

Le run 2 porte le catalogue à 966 candidats (pièces, salles, accessoires, instruments, personnages, matériaux et HDRI), chacun avec un `id` et un `kind`. 44 nouveaux fichiers `.glb` CC0/CC-BY optimisés (Draco, textures WebP 1024 px, ≤ 100 k triangles) sont commités avec leurs crédits. Liste complète : [`3d-models-catalogue.md`](3d-models-catalogue.md). Attention : les licences Sketchfab ajoutées au run 2 viennent de l'API de recherche (l'API par modèle renvoyait HTTP 429) et doivent être revérifiées sur la page du modèle avant tout téléchargement.
