# Catalogue numeric and capability data inventory (starting list for the data-rule audit 4.6)

Written 2026-11-12 by the Waves 2 to 5 commit-and-gate agent, BEFORE the Wave 2 to 5 stage 2 (so it covers the 44 devices that were in `content/catalog.json`: the first 25 verified devices and the 19 devices promoted by the Wave 1 stage 2). Founder rule (2026-11-12): every number or capability a catalogue entry states must come from that exact model's manufacturer sheet, recorded with its source; unknown stays unknown. Nothing in this list was rewritten in this step. "No source record" means the entry carries no per-datum source field. Statuses for the audit: `sheet-read` / `to-check` / `unknown`; every row below is `to-check` unless its source column cites a datasheet or knowledge-base note, which the audit still has to re-read against the sheet.

Not listed: connector and signal types of ports (structure, listed in the asset specs with their cited pages), route graphs, port ids, labels, and the physical size in millimetres (cited per plan row in `content/proposals/equipment-plan.json`).

Notable: the Wave 1 promoted speaker `neumann-kh-120-ii` carries a **nominal 90 x 60 degree coverage** (kind `nominal`, "valeur nominale"): the exact default the rule forbids, written by the template before this step; the Wave 2 to 5 templates no longer write it. It, and the desks' / preamps' invented option lists below, are the first things to correct in 4.6.

## Devices in content/catalog.json

| device | field | value | current source |
|---|---|---|---|
| yamaha-ql1 | control playback-usb (toggle, default false) | switch | verified (hand-written); no source record |
| yamaha-ql1 | control mute-master (toggle, default false) | switch | verified (hand-written); no source record |
| yamaha-ql1 | control fader-master options | -inf / -30 / -20 / -10 / -6 / -3 / 0 / +6 / +10 (default 0) | verified (hand-written); no source record |
| yamaha-ql1 | control balance-master options | G100 / G50 / C / D50 / D100 (default C) | verified (hand-written); no source record |
| yamaha-ql1 | port flag providesPhantom | in-mic-1, in-mic-2 | verified (hand-written); KB / hand-written (to-check) |
| yamaha-rio3224-d2 | port flag providesPhantom | in-mic-1, in-mic-2 | verified (hand-written); KB / hand-written (to-check) |
| qsc-k12-2 | acoustic.coverage_h_deg | 75 | kb: knowledge-base/equipment/loudspeakers.json#qsc-k12-2 key_specs.coverage « 75° nominal, axisymmetric » (read 2026-10-22) |
| qsc-k12-2 | acoustic.coverage_v_deg | 75 | kb: knowledge-base/equipment/loudspeakers.json#qsc-k12-2 key_specs.coverage « 75° nominal, axisymmetric » (V déduit de « axisymmetric » : même a (read 2026-10-22) |
| qsc-k12-2 | acoustic.max_spl_db | 132 | kb: knowledge-base/equipment/loudspeakers.json#qsc-k12-2 key_specs.max_spl « 132 dB @ 1 m peak; 126 dB @ 1 m continuous » (read 2026-10-22) |
| qsc-k12-2 | modelFront.axis | -z | measured on the GLB (not a sheet datum) |
| yamaha-dbr12 | acoustic.coverage_h_deg | 90 | kb: knowledge-base/equipment/loudspeakers.json#yamaha-dbr12 key_specs.coverage « H90° x V60° Constant Directivity Horn » (read 2026-10-22) |
| yamaha-dbr12 | acoustic.coverage_v_deg | 60 | kb: knowledge-base/equipment/loudspeakers.json#yamaha-dbr12 key_specs.coverage « H90° x V60° Constant Directivity Horn » (read 2026-10-22) |
| yamaha-dbr12 | acoustic.max_spl_db | 131 | kb: knowledge-base/equipment/loudspeakers.json#yamaha-dbr12 key_specs.max_spl « 131 dB SPL (Measured Maximum SPL (Peak) IEC noise@1m) » (read 2026-10-22) |
| axia-iq | control fader-in-mic-1 (toggle, default true) | switch | verified (hand-written); no source record |
| axia-iq | control monitor-mute (toggle, default false) | switch | verified (hand-written); no source record |
| axia-iq | control route-in-mic-1-to-out-n1 (toggle, default false) | switch | verified (hand-written); no source record |
| axia-iq | control route-in-line-1-to-out-n1 (toggle, default true) | switch | verified (hand-written); no source record |
| axia-iq | port flag providesPhantom | in-mic-1 | verified (hand-written); KB / hand-written (to-check) |
| genelec-8030c | acoustic.coverage_h_deg | 90 | nominal: valeur nominale (pas de donnée constructeur dans la KB) (read 2026-10-22) |
| genelec-8030c | acoustic.coverage_v_deg | 60 | nominal: valeur nominale (pas de donnée constructeur dans la KB) (read 2026-10-22) |
| genelec-8030c | modelFront.axis | -z | measured on the GLB (not a sheet datum) |
| aeta-scoopy-plus-s | port flag providesPhantom | in-mic | verified (hand-written); KB / hand-written (to-check) |
| avid-protools-hdx | control sample-rate options | 44100 / 48000 / 96000 (default 48000) | verified (hand-written); no source record |
| avid-hd-io | control sample-rate options | 44100 / 48000 / 96000 (default 48000) | verified (hand-written); no source record |
| focusrite-isa-one | control phantom-48v (toggle, default false) | gates flag providesPhantom on in-mic | verified (hand-written); no source record |
| focusrite-isa-one | port flag providesPhantom | in-mic | verified (hand-written); KB / hand-written (to-check) |
| neumann-u87-ai | port flag requiresPhantom | out-xlr | verified (hand-written); KB / hand-written (to-check) |
| antelope-ocx-hd | control sample-rate options | 44100 / 48000 / 96000 (default 48000) | verified (hand-written); no source record |
| mackie-profx12v3 | control fader-master options | -inf / -30 / -20 / -10 / -6 / -3 / 0 / +6 / +10 (default 0) | promoted (template); no source record |
| mackie-profx12v3 | port flag providesPhantom | 7 ports (in-mic-1, in-mic-2, in-mic-3, ...) | promoted (template); template-derived from traits (data rule: to-check) |
| rode-nt1-5th-gen | port flag requiresPhantom | out-xlr | promoted (template); template-derived from traits (data rule: to-check) |
| rode-rodecaster-pro-ii | control fader-master options | -inf / -30 / -20 / -10 / -6 / -3 / 0 / +6 / +10 (default 0) | promoted (template); no source record |
| rode-rodecaster-pro-ii | port flag providesPhantom | in-combo-1, in-combo-2, in-combo-3, in-combo-4 | promoted (template); template-derived from traits (data rule: to-check) |
| neumann-km-184 | port flag requiresPhantom | out-xlr | promoted (template); template-derived from traits (data rule: to-check) |
| neumann-tlm-103 | port flag requiresPhantom | out-xlr | promoted (template); template-derived from traits (data rule: to-check) |
| sennheiser-mkh-416 | port flag requiresPhantom | out-xlr | promoted (template); template-derived from traits (data rule: to-check) |
| neumann-kh-120-ii | acoustic.coverage_h_deg | 90 | nominal: valeur nominale (pas de donnée constructeur retenue dans le plan) (read 2026-11-12) |
| neumann-kh-120-ii | acoustic.coverage_v_deg | 60 | nominal: valeur nominale (pas de donnée constructeur retenue dans le plan) (read 2026-11-12) |
| neumann-kh-120-ii | modelFront.axis | -z | measured on the GLB (not a sheet datum) |

## Bêta proposals: phantom and ribbon flags

11 flagged ports, 84 proposals own a model (a Bêta proposal never carries acoustic, routing or controls, so these flags are the only capability claims it makes).

| device | field | ports | source |
|---|---|---|---|
| radial-jpc | port flag requiresPhantom | out-l-r-balanced-mic-level-outputs-each-needs-48v-phantom-1, out-l-r-balanced-mic-level-outputs-each-needs-48v-phantom-2 | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| beyerdynamic-dt-297-pv-mkii | port flag requiresPhantom | out-microphone-output-k-190-40-cable | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| schoeps-cmc-6-mk-4 | port flag requiresPhantom | out-mic-output-xlr-3m-on-cmc-6-phantom-power-in | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| royer-r-121 | port flag isRibbon | out-mic-output-male-xlr-3-pin-pin-2-hot | Bêta proposal (with model), from the knowledge base or a spec: to-check |
| sennheiser-mkh-418-s | port flag requiresPhantom | out-stereo-m-s-output-m-and-s-channels-p48-on-both | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| schoeps-mstc-74 | port flag requiresPhantom | out-stereo-l-r-output-2-channels-phantom-on-each | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| sanken-cos-11d | port flag requiresPhantom | out-mic-output-on-the-48-v-interface-cos-11d | Bêta proposal (with model), from the knowledge base or a spec: to-check |
| rode-nt4 | port flag requiresPhantom | out-stereo-output-l-r-on-the-mic-body | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| neumann-ku-100 | port flag requiresPhantom | out-balanced-stereo-output-l-r | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| neumann-usm-69-i | port flag requiresPhantom | out-stereo-output-two-independent-channels | Bêta proposal (no model), from the knowledge base or a spec: to-check |
| rode-nt-sf1 | port flag requiresPhantom | out-one-balanced-output-per-capsule-lf-1-rf-2-lb-3-rb-4-on-the-supplied-4-x-xlr-breakout-cable-1, out-one-balanced-output-per-capsule-lf-1-rf-2-lb-3-rb-4-on-the-supplied-4-x-xlr-breakout-cable-2 | Bêta proposal (with model), from the knowledge base or a spec: to-check |

## Update after the Waves 2 to 5 review fixes (2026-11-12)

Findings 3, 4 and 13 of the independent review changed the data below; nothing above was rewritten.

**Bêta proposals, phantom flags (finding 3).** `mergeSpecFlags` / `proposalFromSpec` copied 62 `providesPhantom` flags (plus `isMicInput`) from specs whose ports are NOT documented (`portsDocumented` absent) onto 13 proposals. Rule now: a phantom flag (`providesPhantom`, `requiresPhantom`) crosses from a spec to a proposal only when the spec says `portsDocumented: true` or the port carries a `flagsSource` page. The flags were removed from the specs and the proposals of allen-heath-sq-5, behringer-x32-compact, behringer-xr18, yamaha-dm3, yamaha-mg16xu, yamaha-tf1, behringer-xenyx-q1202usb, rode-rodecaster-duo, allen-heath-qu-16, allen-heath-zed-14, apogee-symphony-desktop (phantom to-check: no page read). Kept with their page (`flagsSource`): crown-pzm-30d (dealer page, search summary), rode-nt-sf1 (manufacturer datasheet), tascam-model-12 (manufacturer spec page). Proposals that still carry a phantom flag: 12 devices, 17 ports (the 11 knowledge-base devices of the table above plus tascam-model-12 and crown-pzm-30d); the table above lists the KB ones.

**Promoted devices, phantom without a citation (finding 4).** Cited now (page and what it says in the spec sources, `flagsSource` on the port): ua-la-610-mkii, focusrite-clarett-plus-8pre, midas-m32 (eight mic inputs; the TALKBACK input lost the flag), zoom-f8n-pro, audient-id14-mkii, presonus-studio-24c, presonus-studiolive-iii-se-16, behringer-flow-8 (two ports, the page says inputs 1 / 2 only: the two combo ports lost the flag). Removed, phantom to-check: rode-rodecaster-pro-ii (the page read does not say how many of the four inputs have it). Not re-confirmed against a sheet (the flag came from the Wave 1 trait template and was kept; declared in the spec so a regeneration keeps it): neumann-tlm-103, neumann-km-184, sennheiser-mkh-416 (phantom to-check).

**Template datum removed (finding 13).** `neumann-kh-120-ii` no longer carries the nominal 90 x 60 degree coverage (regenerated from its spec: no `acoustic`, the coverage panel says « valeur non vérifiée »). `mackie-profx12v3` and `rode-rodecaster-pro-ii` no longer carry the `fader-master` option list (-inf .. +10 dB: no sheet states it); the Rodecaster has no control and no layout left, the ProFX12 keeps its power switch.

**The 25 original devices, listed again (not touched; task 4.6 decides).** Numeric or capability data still to audit: yamaha-ql1 control `fader-master` options (-inf / -30 / -20 / -10 / -6 / -3 / 0 / +6 / +10, default 0) and `balance-master` options (G100 / G50 / C / D50 / D100); yamaha-ql1 / yamaha-rio3224-d2 `providesPhantom` on in-mic-1, in-mic-2; focusrite-isa-one `phantom-48v` control; avid-protools-hdx, avid-hd-io, antelope-ocx-hd `sample-rate` option lists; the `acoustic` blocks of genelec-8030c, qsc-k12-2 (coverage 75, sourced to the knowledge base), yamaha-dbr12; every `requiresPhantom` flag of the condenser microphones (u87 and the others); the port flags `isMicInput`, clock flags and `isDantePrimary`. The detailed per-datum rows are in the table above.
