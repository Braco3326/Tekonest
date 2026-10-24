# Fohhn FSD Viewer (Fohhn Speaker Viewer) and speaker-data formats

Access date for every source: 2026-10-24. Labels: **[Documented]** (official source and section named), **[Inferred]**, **[Unknown]**. Nothing was downloaded from Fohhn, and the web app was not used past its public entry page. No FSD file, proprietary data, code or logo was saved or reproduced.

Source register:

| # | URL | Publisher | Section used | Covers |
|---|-----|-----------|--------------|--------|
| S1 | https://services.fohhn.com/fsd-viewer/ | Fohhn | Public entry page | Login gate, browser-support notice, footer links |
| S2 | https://www.fohhn.com/en/products | Fohhn | Software / digital tools tiles ("Fohhn Speaker Viewer", "Fohhn Optimizer", "Fohhn Designer", "Simulation Data") | Official description of the viewer and its link |
| S3 | https://www.fohhn.com/en/series/software | Fohhn | Software series list | Audio Soft, Designer, Optimizer (the viewer is not listed) |
| S4 | https://www.fohhn.com/en/products/fohhn-designer | Fohhn | Feature list | Designer features: database, beam steering, STI, browser-based |
| S5 | https://fohhn.com/en/products/at-05 | Fohhn | Technical data, Downloads, Simulation data | AT-05 specs |
| S6 | https://www.fohhn.com/en/support/downloads/list/filters/dl_simulationdata | Fohhn | Download centre | Fetch returned a BIM-filtered list, so no simulation-format details |
| S7 | http://www.clfgroup.org/faq.htm | CLF Group | FAQ | CLF resolutions, authoring rules |
| S8 | http://www.clfgroup.org/clfdocuments.htm | CLF Group | Downloads, release notes | CLF versions and dates, viewer features, supporting manufacturers |
| S9 | http://www.clfgroup.org/viewer.htm | CLF Group | Viewer | CLF viewer display types, secure binary distribution |
| S10 | https://www.afmg.eu/en/gll-viewer | AFMG | GLL Viewer (via search summary) | The free GLL Viewer |
| S11 | https://www.afmg.eu/en/ease-focus-3-licensing-manufacturers | AFMG | Licensing for manufacturers (via search summary) | Who pays for GLL authorization |
| S12 | http://www.aes.org/standards/blog/2019/8/updated-and-reaffirmed-version-of-aes56 | AES | Standards blog | AES56 scope and reaffirmation |
| S13 | https://www.qscaudio.com/resource-files/whitepapers/q_wp_cin_loudspeakerresponseinrealrooms.pdf | QSC | White paper (via search summary) | DI definition |
| S14 | https://www.doctorproaudio.com/doctor/cajondesastre/pdfs/brusi_understanding_directivity_game_numbers_doctorproaudio.pdf | Joe Brusi / DoctorProAudio | Article (via search summary) | Polar, isobar, −6 dB coverage |
| S15 | https://odeon.dk/downloads/directivity-files/ | Odeon | Directivity files (via search summary) | CF1 and CF2 angular spacing |
| S16 | https://www.researchgate.net/profile/Rahulram-Sridhar/publication/324900006_A_Database_of_Loudspeaker_Polar_Radiation_Measurements/links/5aea1780aca2725dabb64181/A-Database-of-Loudspeaker-Polar-Radiation-Measurements.pdf | AES e-Brief 230 (Sridhar et al., 2018) | Methods (via search summary) | A polar database measured at 5° steps |

Rows marked "via search summary" were read only as search-result extracts, not as full pages. Their claims should be rechecked before they are quoted in a final report.

---

## 1. What official Fohhn sources say about the FSD Viewer

### Takeaway
On its public site, Fohhn calls the tool "Fohhn Speaker Viewer" and gives it one line: it shows a speaker's dispersion pattern at each frequency and opens all of its measurement charts. It links to services.fohhn.com/fsd-viewer/, which needs a Fohhn Services login. I found no public manual, help text, release note or press release that lists the views or the comparison features, and no launch date.

### Cited Findings
- **[Documented]** The products page has a tile called "Fohhn Speaker Viewer", headed "Diving deep into Sound Characteristics". It calls the tool a simple way to learn about Fohhn speaker systems, which shows the dispersion pattern at each frequency and gives access to all measurement charts. The tile links to https://services.fohhn.com/fsd-viewer/. — [S2 Fohhn products page, software/digital tools tiles](https://www.fohhn.com/en/products)
- **[Documented, with a conflict]** Whether the tile is marked "New" depends on the fetch. One fetch found no "New" label on the Speaker Viewer tile and found it on the Optimizer tile. A search-engine summary of the same page said the viewer was labelled "New". — [S2](https://www.fohhn.com/en/products)
- **[Documented]** The public URL shows only a "Sign in to Fohhn Services" page with sign-up and password-recovery links. It has a browser notice listing Firefox 70+, Chrome 78+, Edge 80+, Opera 65+ and Vivaldi 2+, and footer links to Imprint, Privacy Policy and Terms of use. The entry page has no help text, view list, version or date. — [S1 services.fohhn.com/fsd-viewer](https://services.fohhn.com/fsd-viewer/)
- **[Documented]** The Software series page lists only Fohhn Audio Soft (device control), Fohhn Designer (browser-based 3D simulation) and Fohhn Optimizer (smartphone tuning web tool). It does not list the Speaker Viewer. — [S3](https://www.fohhn.com/en/series/software)
- **[Documented]** Fohhn Designer is browser-based with a personal login and server-side calculation. It includes a database of all Fohhn loudspeakers and native support for Fohhn Beam Steering systems. It calculates frequency-dependent direct and total sound level, and STI per DIN EN 60268-16, and it exports to PDF and to Audio Soft projects. The Designer page does not mention FSD or the Speaker Viewer. — [S4](https://www.fohhn.com/en/products/fohhn-designer)
- **[Documented, analogous product only]** The free CLF viewer from a different organisation offers the same kinds of views listed in the task: directivity as coloured 3D balloons or spheres, horizontal and vertical polars, and balloon spectra. It plots frequency-dependent data such as impedance and Q, and it has a "Cabinet 3D view", 6 dB beamwidth display and Q/DI. — [S8 CLF downloads, release notes v2.0b/v2.0c/v2.1a](http://www.clfgroup.org/clfdocuments.htm); [S9 CLF viewer page](http://www.clfgroup.org/viewer.htm)

### Inferences
- **[Inferred]** The view list in the task (Cabinet, Balloon, Frequency Response, Impedance, Isobars, Polar, Directivity Index, plus comparison) probably comes from inside the logged-in app. No public Fohhn text I found confirms it. The live browser audit should be the source for it.
- **[Inferred]** The view set closely matches the standard set in CLF and EASE viewers, including the "Cabinet" view of the 3D box. This is the industry norm and does not show what the Fohhn tool does internally.
- **[Inferred]** The tool appears to belong to Fohhn's newer web-tool family (Designer, Optimizer) on the shared Fohhn Services login, rather than being a desktop program.

### Gaps
- **[Unknown]** Launch date, version history and release notes. No news item, newsletter, press release, YouTube description or LinkedIn post turned up in English or German searches ("Fohhn FSD Viewer", "Fohhn Speaker Viewer", "Fohhn Lautsprecherdaten Viewer").
- **[Unknown]** The official list of views, the comparison feature (how many speakers, overlay or side-by-side), and the units and normalisation shown in each view.
- **[Unknown]** Whether a login is needed to see any data, or whether a guest mode exists behind the sign-in page.

---

## 2. What an FSD file is

### Takeaway
I found no public Fohhn document that defines "FSD", says who creates FSD files, or describes their contents or schema. The acronym appears only in the viewer's URL path. Treat the format as unpublished and proprietary. Do not reverse-engineer it.

### Cited Findings
- **[Documented]** "FSD" appears in the viewer URL (/fsd-viewer/), but the product tile calls the tool "Fohhn Speaker Viewer" and does not expand the acronym. — [S2](https://www.fohhn.com/en/products); [S1](https://services.fohhn.com/fsd-viewer/)
- **[Documented]** The AT-05 product page lists EASE, CLF, ulysses and Fohhn Designer as supported simulation formats. It does not mention FSD or GLL. — [S5 AT-05, Simulation data section](https://fohhn.com/en/products/at-05)
- **[Documented]** Fohhn's products page says Fohhn offers loudspeaker databases for EASE, Ulysses and CATT-Acoustic, and describes CLF as the platform-independent Common Loudspeaker Format. — [S2, "Simulation Data" tile](https://www.fohhn.com/en/products)
- **[Documented]** Fohhn Audio Soft has a built-in speaker database that is updated through the software to get new speaker presets. This refers to DSP presets, not to directivity files. — [Fohhn Audio Soft catalog page (via search summary)](https://www.fohhn.com/en/catalog/fohhn-audio-soft)
- **[Documented, only as a search snippet, not verified]** A 2013 Fohhn catalogue reportedly says its polar data comes from several hundred robot-positioned measurements, can take up to 12 hours per system, and can be used in EASE or ULYSSES. — [Fohhn Neuheiten 2013 EN catalogue, hosted by a dealer](http://www.commpunt.be/cms/app/galery/other/Catalogs/Fohhn_Neuheiten2013_EN_.pdf)
- **[Documented]** "Fohhn Source Division Waveguide" is a separate Fohhn technology name in the site navigation. Nothing ties it to the "FSD" acronym. — [S4 page navigation](https://www.fohhn.com/en/products/fohhn-designer)

### Inferences
- **[Inferred]** "FSD" most plausibly means "Fohhn Speaker Data", based on the tile name and the URL. This is not confirmed and should not be cited as fact.
- **[Inferred]** The same measurement set that feeds the EASE, CLF and ulysses exports and the Designer database probably feeds the viewer. Fohhn has not published the link between the Designer database and FSD.

### Gaps
- **[Unknown]** The FSD file structure, balloon resolution, frequency resolution, angular step, whether data is complex or magnitude-only, and whether files can be downloaded at all.
- **[Unknown]** How FSD relates to Audio Soft presets, the Optimizer and Designer.
- The Fohhn simulation-data download list could not be read: the fetch returned the BIM filter. Its formats, versions and terms are unconfirmed.

---

## 3. Fohhn AT-05: public specifications

### Takeaway
Fohhn's own page describes the AT-05 as a compact passive 2-way point-source box, not a column, line or beam-steered loudspeaker. The task brief's description is wrong on this point. Use another product, such as a Fohhn Linea or Focus model, if a column or beam-steering example is needed.

### Cited Findings (all [Documented], [S5 AT-05 product page, Technical data](https://fohhn.com/en/products/at-05))
- Type: compact passive 2-way full-range loudspeaker, vented, the smallest passive full-range model in the Arc series, built for fixed installation.
- Drivers: 5" woofer and 1" dome tweeter with short horn, with self-resetting HF protection.
- Nominal dispersion: 90° × 90° (H × V).
- Frequency range: 60 Hz to 20 kHz (−10 dB, anechoic half-space, with speaker preset).
- Sensitivity: 88 dB (2.83 V / 8 Ω, 1 m, anechoic half-space).
- Max SPL: 110 dB. The page does not state the measurement condition.
- Impedance: 8 Ω nominal. Power: 80 W nominal, 160 W program, 320 W peak.
- Dimensions: 166 × 286 × 199 mm (W × H × D). Weight: 4.5 kg.
- Options and notes: 100 V transformer, 8-pin terminal block, M6 points, RAL 9005 or 9016. The page requires a Fohhn system amplifier with the correct preset.
- Enclosure material: the page conflicts with itself, listing multiplex birch in the specs and MDF in the feature list.
- Beam steering: not mentioned. Downloads include a data sheet, CAD, BIM and a tender text. Simulation formats listed are EASE, CLF, ulysses and Fohhn Designer.
- Retailer listings broadly agree (MDF, 88 dB, 60 Hz to 20 kHz). — [muziekhuisdacapo.nl](https://www.muziekhuisdacapo.nl/products/fohhn-at-05); [spikeisland.org.uk](https://www.spikeisland.org.uk/production-services/equipment-hire/exhibition-audio/fohhn-at-05-compact-full-range-passive-loudspeaker/)

### Inferences
- **[Inferred]** For a 90° × 90° box with a 5" woofer, the published coverage angle will hold only in the upper-mid and high frequencies. Below a few hundred hertz the box will be close to omnidirectional. This is general physics, not AT-05 data.

### Gaps
- The datasheet PDF was not opened because downloading was out of scope. No AT-05 polar, balloon or impedance data is public in the fetched text.

---

## 4. What each view means in general acoustics

### Takeaway
Each standard view answers one question. The balloon shows where the sound goes in 3D at one frequency. A polar plot shows that on one plane. An isobar plot shows how coverage changes with frequency. DI shows how much the speaker concentrates energy compared with an omni source. The frequency response shows the on-axis tonal balance. The impedance curve shows the load the amplifier sees. Resolution conventions vary by format: octave bands at 10° (CLF1), third-octave at 5° (CLF2), and down to 1/24 octave at 5° for AFMG transducer balloons.

### Cited Findings
- **[Documented]** AES56 sets out how loudspeaker polar radiation data should be measured and documented for room-acoustic and sound-system prediction and for data sheets. It was reaffirmed and reformatted to IEC style in 2019. The standard text is paywalled, so I could not confirm its exact angular and frequency resolutions. — [S12 AES Standards blog](http://www.aes.org/standards/blog/2019/8/updated-and-reaffirmed-version-of-aes56)
- **[Documented]** Resolutions in CLF: Type 1 files hold octave-band data at 10°, and Type 2 files hold third-octave data at 5°. Authors are encouraged to publish data "as measured". — [S7 CLF FAQ](http://www.clfgroup.org/faq.htm); also [S15 Odeon directivity files](https://odeon.dk/downloads/directivity-files/)
- **[Documented, via search summary]** AFMG's measurement guidance says 5° angular resolution and about 1/24-octave frequency resolution is generally enough for transducer balloons. — [S10 AFMG](https://www.afmg.eu/en/gll-viewer)
- **[Documented, via search summary]** An AES e-Brief database measured horizontal and vertical orbits at about 1.6 m radius in 5° steps. — [S16](https://www.researchgate.net/profile/Rahulram-Sridhar/publication/324900006_A_Database_of_Loudspeaker_Polar_Radiation_Measurements/links/5aea1780aca2725dabb64181/A-Database-of-Loudspeaker-Polar-Radiation-Measurements.pdf)
- **[Documented, via search summary]** A polar plot is level against rotation angle on one plane, usually horizontal and vertical, with one curve per frequency band. Coverage angle is usually read at the −6 dB points. An isobar plot is a contour map of equal level, with frequency on the x-axis and angle on the y-axis, showing level relative to on-axis. — [S14 Brusi](https://www.doctorproaudio.com/doctor/cajondesastre/pdfs/brusi_understanding_directivity_game_numbers_doctorproaudio.pdf); [Audiofanzine](https://en.audiofanzine.com/pa-speaker-cabinet/editorial/articles/understanding-directivity.html); [Q-SYS blog](https://blogs.qsc.com/systems/2021/11/04/a-deeper-dive-into-loudspeaker-directivity/)
- **[Documented, via search summary]** DI is the on-axis level gain in dB compared with an omnidirectional source radiating the same total power. Low frequencies tend toward omnidirectional, and horns or waveguides give more constant directivity. — [S13 QSC white paper](https://www.qscaudio.com/resource-files/whitepapers/q_wp_cin_loudspeakerresponseinrealrooms.pdf)
- **[Documented]** The CLF viewer shows 6 dB beamwidths and Q/DI per band, and stores sensitivity, the axial spectrum, impedance and an optional phase balloon. — [S8 release notes](http://www.clfgroup.org/clfdocuments.htm); [S9](http://www.clfgroup.org/viewer.htm)
- **[Documented]** Fohhn states AT-05 sensitivity at 2.83 V / 1 m in an anechoic half-space. This is the "1 W at 8 Ω, 1 m" convention. — [S5](https://fohhn.com/en/products/at-05)

### Inferences (general textbook conventions; no primary source was fetched)
- **[Inferred]** Balloon: a 3D surface of level by direction at one frequency band, usually normalised to 0 dB on-axis so its shape shows directivity rather than loudness. Colour or radius encodes dB, typically over a 30 to 40 dB range.
- **[Inferred]** Polar: 0° on-axis at the top, with dB rings in 6 dB steps on a scale of about −30 to 0 dB, normalised on-axis, drawn per band.
- **[Inferred]** Frequency response: log frequency axis from 20 Hz to 20 kHz and dB SPL at 1 m for 1 W or 2.83 V, often smoothed to 1/3 octave for readability. Smoothing method is not standardised across vendors.
- **[Inferred]** Impedance: magnitude in ohms against log frequency. It shows the resonance peaks and the minimum, which must not fall far below nominal (IEC 60268-5 allows the minimum to be no less than 80% of the rated impedance).
- **[Inferred]** For a game, a minimal set would be on-axis response, a horizontal polar at 3 to 4 bands, an isobar heat map and a DI line. Each has one teaching question, such as "Where is it −6 dB?" or "Why does coverage narrow at high frequency?"

### Gaps
- The IEC 60268-5 and AES2 texts were not accessed because they are paywalled. The 80% impedance rule above comes from memory and must be verified before use.
- No university course notes were fetched. The NPL directivity page (https://resource.npl.co.uk/acoustics/techguides/concepts/direct.html) failed with a TLS certificate error.

---

## 5. Open or licensable alternatives for an educational game

### Takeaway
None of the common loudspeaker formats is openly licensed. CLF files are a secure binary format that only registered authors can create. GLL files and viewers are free for end users, but the data belongs to each manufacturer, and I found no reuse licence. The legally cleanest choice for TekPractice is synthetic data generated from textbook models, such as a piston in a baffle, a line array or a cardioid. Manufacturer data should be used only with written permission.

### Cited Findings
- **[Documented]** CLF is controlled by a small group of software developers and data authors. CLF files are distributed in a secure binary format and viewed with the free CLF viewer. Authoring needs a free author key and is "primarily meant" for manufacturers and independent measurement services. — [S7 FAQ](http://www.clfgroup.org/faq.htm); [S9 viewer](http://www.clfgroup.org/viewer.htm)
- **[Documented]** CLF v1 was released on 15 April 2005 and CLF2 v2 in September 2011, adding phase, filters and multipart files for beam steering and multi-way speakers. The latest software update is dated 4 March 2020 and the latest manufacturer-list update 15 December 2017. The End-user kit and the Trial Authoring kit (with the text-format specification) can be downloaded. — [S8](http://www.clfgroup.org/clfdocuments.htm)
- **[Documented]** No open licence (CC or similar) is stated for the CLF format or data on the pages I read. — [S7](http://www.clfgroup.org/faq.htm), [S8](http://www.clfgroup.org/clfdocuments.htm), [S9](http://www.clfgroup.org/viewer.htm)
- **[Documented, via search summary]** AFMG's GLL Viewer is free and may be distributed so that people without EASE can view GLLs. Manufacturers pay AFMG to have models authorised for EASE Focus and Address. Unauthorised GLLs still load but are shown as not authorised. I found no end-user licence text covering reuse of the data. — [S10](https://www.afmg.eu/en/gll-viewer); [S11](https://www.afmg.eu/en/ease-focus-3-licensing-manufacturers)
- **[Documented]** Fohhn publishes EASE, CLF, ulysses and CATT data for planners. Its pages state no licence allowing reuse in third-party products. — [S2](https://www.fohhn.com/en/products); [S5](https://fohhn.com/en/products/at-05)
- **[Documented, via search summary]** An AES e-Brief describes a published research database of loudspeaker polar measurements. It may be an academic source, but its licence was not checked. — [S16](https://www.researchgate.net/profile/Rahulram-Sridhar/publication/324900006_A_Database_of_Loudspeaker_Polar_Radiation_Measurements/links/5aea1780aca2725dabb64181/A-Database-of-Loudspeaker-Polar-Radiation-Measurements.pdf)

### Inferences
- **[Inferred]** Recommended route: generate data in-game from closed-form models. Use a baffled circular piston (2·J1(ka sinθ)/(ka sinθ)) for cones, a line-source sinc function for columns, an angle-independent box-baffle approximation for low frequencies, and a simple RLC impedance model for a vented box. These are textbook physics and carry no licence burden. They can be gridded at 5° and in third-octave bands to mirror CLF2.
- **[Inferred]** Manufacturer-published data sheets (nominal coverage angle, sensitivity, frequency range) are facts and can reasonably be used as reference numbers. Copying measured balloons or polars without permission is a copyright, database-right and terms risk. This is especially so under the EU database directive, which applies because Fohhn and AFMG are German.
- **[Inferred]** The only CLF text that could be legally studied is the text-format specification in the Trial Authoring kit. Check its licence before using it even as a design reference.

### Gaps
- **[Unknown]** The exact licence wording of the CLF viewer, the CLF author agreement, the GLL Viewer EULA and the terms on Fohhn's simulation-data downloads. None was found in public page text.
- **[Unknown]** Whether any fully open (CC-BY or CC0) loudspeaker directivity dataset exists. This needs a separate search of Zenodo and university repositories.
