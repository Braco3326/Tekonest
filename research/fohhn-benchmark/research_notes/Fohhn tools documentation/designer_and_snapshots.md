# Fohhn Designer and its Snapshots feature (public documentation)

All sources accessed 2026-10-24. The app was not signed in to or operated. Labels: **[D]** = Documented (official or official-partner source, section named); **[I]** = Inferred; **[U]** = Unknown.

Source register:
- **S1**: Fohhn, product page "Fohhn Designer / Our universal simulation tool", https://www.fohhn.com/en/products/fohhn-designer. Sections used: intro, "Room Model", "The Fohhn Speaker-Setup", "Simulation & Evaluation", "The Report Configurator", and the links list. Covers the official feature list. Canonical alias: /en/catalog/fohhn-designer.
- **S2**: Fohhn, "Software" series page, https://fohhn.com/en/series/software. Covers the short positioning of Designer next to Fohhn Audio Soft and Fohhn Optimizer.
- **S3**: TPi Magazine, "Fohhn Presents a Brand-New Online Acoustic Simulator", 10 Apr 2019, https://tpimagazine.com/?p=33251. Trade press, close to Fohhn's launch press release. Covers the launch feature list.
- **S4**: novelty group (French Fohhn distributor), training handout "novelty session Fohhn Designer Basics Online", V1, dated 17/04/2020, https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf. In French. Covers a menu-by-menu walkthrough: Dashboard, workspace, the Project, Room, Listener plane, Loudspeaker, Simulation, Snapshots and Export tabs, tools, and the room-acoustics theory slides. It is a distributor document, not a Fohhn manual, and is from 2020, so the UI may have changed since. Page numbers are not printed; sections are cited by their slide headings.
- **S5**: Fohhn Services login page, https://services.fohhn.com/designer/projects, and the help-centre article URL https://services.fohhn.com/hc/course/ar6yjy1H/article/28V4qYuu. Both redirect to the login screen. Covers the browser-support banner and the sign-up and login links. The help-centre content is behind the login.
- **S6**: Fohhn tutorials page, https://cloud.fohhn.com/en/tutorials (mirror: https://marketing.fohhn.com/en/tutorials). Covers links to the YouTube playlists "Fohhn Designer" (https://www.youtube.com/playlist?list=PLF5B4Vw0YGpdecpqSGvN32P7UumvQJCDt) and "SketchUp – Model your room!" (https://www.youtube.com/playlist?list=PLF5B4Vw0YGpe9x_wlKBf_4aVYm453jZ2D). The playlist contents could not be retrieved: a YouTube consent redirect blocked them and the RSS feed returned 404.
- **S7**: Fohhn webinars page, https://cloud.fohhn.com/en/webinars, and search-result snippets for the "Fohhn Basics 2: Fohhn Designer" page (https://cloud.fohhn.com/en/webinar-basics-2, which now returns 404). Covers the webinar description.

---

## 1. Purpose, launch, access model, browser, and relation to other tools

### Takeaway
Fohhn Designer is Fohhn's in-house, browser-based 3D simulation tool for Fohhn loudspeakers only, with calculations done on Fohhn's servers. It was announced in April 2019. It is free, but it needs a Fohhn Services account. It imports EASE and SketchUp geometry and EASE speaker setups, and it exports to Fohhn Audio Soft.

### Cited Findings
- **[D]** Fohhn describes Designer as a simulation tool for planning sound reinforcement and presenting the results, "from the smallest conference room to the largest arena". It is developed in-house. — [S1 intro](https://www.fohhn.com/en/products/fohhn-designer)
- **[D]** It is web-based and platform-independent, needs no download, runs in a browser with a personal login, and does its calculations server-side, which Fohhn calls "resource-efficient". — [S1](https://www.fohhn.com/en/products/fohhn-designer); [S3](https://tpimagazine.com/?p=33251)
- **[D]** It simulates "all Fohhn audio systems in a three-dimensional room space, taking into account specific acoustic conditions". — [S2](https://fohhn.com/en/series/software)
- **[D]** Launch: TPi presented it as a "brand-new" online acoustic simulator on 10 April 2019, which puts the launch around Prolight + Sound in spring 2019 [I]. — [S3](https://tpimagazine.com/?p=33251)
- **[D]** Access: you register or sign in through the Fohhn Services portal (Register: https://services.fohhn.com/dashboard/auth/welcome; Login: https://services.fohhn.com/dashboard/auth/login). — [S1 links](https://www.fohhn.com/en/products/fohhn-designer); [S5](https://services.fohhn.com/designer/projects)
- **[D]** Price: free. A Fohhn webinar description calls it "the free 3D simulation software Fohhn Designer" and asks users to register for free access. This comes from search snippets of the webinar page, which now returns 404. — [S7](https://cloud.fohhn.com/en/webinars). S4 lists "Compte utilisateur / License" under "Fohhn Services philosophie" without stating a price ([S4](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)).
- **[D]** Browsers: the login page lists Firefox 70+ and Chromium-based browsers (Chrome 78+, Edge (Chromium) 80+, Opera 65+, Vivaldi 2+). Any other browser gets a warning that some functions may not work. — [S5](https://services.fohhn.com/designer/projects). The 2020 distributor handout strongly recommends Google Chrome for stability and updates. — [S4 "Présentation brève", "Tableau de bord"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** After login, the dashboard shows two tiles: "Fohhn Designer" and "Help Centre" (online help), plus a "Profile" tab. — [S4 "Tableau de bord"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Project-level actions on the dashboard are: edit details, delete, duplicate, archive, and share with any number of people, with or without edit permission. In 2020 a planned update would share folders automatically between users with the same Company name. — [S4 "Tableau de bord"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Relation to Fohhn Audio Soft: Designer natively supports Fohhn Beam Steering "with the parameters from Fohhn Audio Soft", and it can export to Fohhn Audio Soft projects. — [S1 "Speaker-Setup"](https://www.fohhn.com/en/products/fohhn-designer); [S3](https://tpimagazine.com/?p=33251)
- **[D]** Relation to EASE: room geometry can be uploaded "from SketchUp/EASE/…" ([S1 "Room Model"](https://www.fohhn.com/en/products/fohhn-designer)). The Room import accepts EASE .xfc files ([S4 "Onglet Room -1"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)). The Loudspeaker tab has "Import EASE Speaker setup", for Fohhn speakers that are not in the Designer database, such as mobile models ([S4 "Onglet Loudspeaker -2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)).
- **[D]** The distributor positions it as acoustic-prediction software that is "much simpler, cheaper and more accessible" than EASE or CATT. — [S4 "Présentation brève"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Related web tools: the free online "Simple Room Generator" (https://services.fohhn.com/webtools/simple-room-generator/) and a paid "Request model creation" service (https://www.fohhn.com/en/room-model-service). — [S1 "Room Model"](https://www.fohhn.com/en/products/fohhn-designer)

### Inferences
- **[I]** "FSD data" has no public link to Designer. No source mentions an FSD format. If the browser audit sees FSD, it should be treated as a separate finding.
- **[I]** Since the calculation runs on the server, results depend on Fohhn's backend, and offline use is probably impossible.
- A 2019 ProSoundWeb item mentions "Arisono" as a new Fohhn acoustic simulation package. Its link to Designer is **[U]**: unverified, and the item was not opened.

### Gaps
- **[U]** Terms of use and licence limits (number of projects, commercial use). The terms are behind https://services.fohhn.com/dashboard/legal/terms-of-use, which was not read.
- **[U]** Exact public launch date or version history. No release notes were found.

---

## 2. The documented chain and the top menus

### Takeaway
The 2020 handout documents eight top tabs in the workspace and a left panel named "Snapshots" by default. The workflow it teaches runs Dashboard → Room model → Listener plane → Speaker → Simulation → Snapshots → PDF report (Report configurator).

### Cited Findings
- **[D]** Course outline, in order: Dashboard; workspace navigation; venue creation "Room model (Wizard, Import)"; audience zones "Listener Plan (Offset tool, Draw, Import)"; speakers "Speaker (Position, Import)" with Positioning, Settings and List/Mute/Sort; Simulation; Instantanés (Snapshots); PDF report creation (Report configurator). — [S4 "Sommaire"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Workspace layout:
  - a 3D space with X red, Y green, Z blue (Z vertical)
  - a left context panel, named "Snapshots" by default
  - 8 tabs at top left ("Project, Room, Listener plane, etc.")
  - 4 icons at top right
  - a vertical toolbar right of the 3D view, with 3 programmable "camera" icons below it
  - along the bottom: position read-outs in metres relative to the origin, plus reminders of the 3D view and the selected frequency range

  — [S4 "Espace de travail"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Tab names explicitly documented in S4: Project, Room, Listener plane, Loudspeaker, Simulation, Snapshot(s), Export, and "View", which is mentioned under navigation. That makes 8. — [S4 tab slides](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Project tab, which works like a File menu: Undo/Redo, New, Open, Save, Save as (with shortcuts), plus editing the project name and a description that shows on the Dashboard. — [S4 "Onglet Project"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Navigation: left-drag orbits around the origin, right-drag pans, the wheel zooms, and Ctrl+left-drag "turns the head", which is useful inside the room. A view cube at top left of the 3D view gives preset views. — [S4 "Navigation dans l'espace 3D"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Fohhn's own chain (S1): Room Model → Speaker-Setup (with snapshots) → Simulation & Evaluation → Report Configurator. — [S1](https://www.fohhn.com/en/products/fohhn-designer)

### Inferences
- **[I]** The "View" tab is mentioned but its contents are not described in S4. The audit should record them.
- **[I]** The UI may have changed since 2020, because S4 is V1 dated 17/04/2020.

### Gaps
- **[U]** Any current official menu reference. The Help Centre needs a login.

---

## 3. Room geometry: creation, import, units, materials

### Takeaway
A room is created either with a rectangular wizard ("Create"/"Wizard") or by importing .dae (Collada/SketchUp), .xfc (EASE) or .obj. Materials are assigned per surface. The data comes from a built-in database of about 800 materials, a personal "Own database", and a fixed "Global database". RT60 can be measured and entered, or calculated from the wall materials.

### Cited Findings
- **[D]** Room tab methods:
  - "Create" (also called "Wizard"), which is always rectangular.
  - "Import" of a Collada .dae (SketchUp), an EASE .xfc, or a Wavefront .obj.

  For transparency, the original elements must not be extruded. Deleting the walls gives a free field. Centring the room symmetrically on the origin is recommended. — [S4 "Onglet Room -1"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Fohhn lists the import routes as a built-in tool for rectangular models, "Upload from SketchUp/EASE/…", the Simple Room Generator, and the paid model service. — [S1 "Room Model"](https://www.fohhn.com/en/products/fohhn-designer)
- **[D]** Room tab commands:
  - "Select all walls": ceiling and floors count as walls.
  - "Global room properties": a panel where you enter measured reverberation data or extrapolate it from the materials. Absorption can be entered as octave-band averages. It also includes General → Model Status → Show Errors.
  - "Invert room areas": works around model errors so the room can be displayed.
  - Clicking any wall shows its acoustic properties.

  — [S4 "Onglet Room -2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** "Manage materials" has three tabs:
  - "Used materials": materials used per simulation (snapshot). They can be edited and saved to the personal database.
  - "Global database": a generic database with fixed characteristics. Entries can be copied to your own database.
  - "Own database": imported materials, and you can create new ones.

  There is also a "List" view. — [S4 "Onglet Room -3"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Reverberation time can be set two ways in Room → Global room properties → Reverberation time: "Measured" (enter an on-site RT60 measurement) or "Calculate from wall materials". The built-in database has 800 materials. New materials in the Own database can carry both absorption and diffusion data. — [S4 "L'incidence de l'acoustique de la pièce -2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Other room parameters that can be entered: RT60, material absorption coefficients, temperature, atmospheric pressure, and humidity. — [S4 "Présentation brève"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Units: positions are shown in metres. — [S4 "Espace de travail"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)

### Inferences
- **[I]** DXF import is not documented anywhere. Treat it as not supported unless the audit shows otherwise.
- **[I]** S4 points to the per-snapshot "Used materials" view and says snapshots hold "room info". Together these suggest material assignments and RT settings are stored per snapshot while the geometry is not (see §6).

### Gaps
- **[U]** Where the 800-material data comes from (publisher or literature). It is not stated.
- **[U]** Whether imperial units are offered.

---

## 4. Listener planes, speaker placement and aim, beam steering

### Takeaway
Listener planes are drawn, offset from existing surfaces, or imported. Speakers come from a Fohhn-only database and are placed with a gizmo, Clone, Mirror, Aim at point, and Align. Beam-steered Fohhn models use the Audio Soft beam parameters, which can be copied and pasted between units.

### Cited Findings
- **[D]** Listener plane tab: "Select all listener planes"; "Draw" (rectangular by default); "Create by offset" (traces a plane from an existing surface, with defaults under "options"); "Import" (from other projects or SketchUp); "List". Set the plane height above the floor: about 1.20 m for a seated listener and 1.60 m for a standing one. "Remesh" only matters if the resolution changes. — [S4 "Onglet Listener plane"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Fohhn: listener planes can be made "from existing geometries in any form, or via import function". — [S1](https://www.fohhn.com/en/products/fohhn-designer); [S3](https://tpimagazine.com/?p=33251)
- **[D]** Loudspeaker tab:
  - A gizmo sits under the selected speaker. White surface edges show that the speaker touches that surface.
  - "Select all loudspeaker", and Ctrl+click for multiple speakers. Orange values mean the selected speakers differ.
  - "Add" from the Fohhn database. In 2020 the database was still being updated, and ARC-series subwoofers were "soon" to come.
  - "Clone" keeps the rotation.
  - "Mirror" mirrors both position and rotation.
  - "Aim at point" makes the selected speakers follow a point.
  - "Align" places speakers between a Start (S) and End (E) point. It can also model bass arrays.
  - "Copy beams" and "Paste beams" are active only for steerable-directivity speakers of the same family.
  - "Import EASE Speaker setup" and "List".

  — [S4 "Onglet Loudspeaker -1/-2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Fohhn: there is a database of all Fohhn loudspeakers, native Fohhn Beam Steering with the Audio Soft parameters, and "smart positioning and alignment tools". — [S1](https://www.fohhn.com/en/products/fohhn-designer); [S3](https://tpimagazine.com/?p=33251)
- **[D]** The course outline lists Speaker List/Mute/Sort functions. — [S4 "Sommaire"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)

### Inferences
- **[I]** "Arc", "Focus" and "Linea Focus" are Fohhn product lines. The sources only say "Fohhn Beam Steering" and "speakers with controllable directivity" and do not name these lines as steerable in Designer.

### Gaps
- **[U]** The beam-steering UI fields (opening angle, tilt, focus distance). They are not documented publicly.
- **[U]** The resolution or format of the loudspeaker directivity data (for example GLL or CLF).

---

## 5. Simulation: bands, weighting, SPL, STI, method, resolution

### Takeaway
A simulation computes frequency-dependent Direct SPL and Total SPL in octave or one-third-octave bands, with a broadband view and A, C or no weighting. It also computes STI for male and female voices per IEC/DIN EN 60268-16. Total SPL and STI combine the direct sound with a diffuse-field term built from total speaker energy, room volume and reverberation time. The handout's theory slides use Sabine, with Eyring advised when the mean absorption is above 0.25. No ray tracing is documented.

### Cited Findings
- **[D]** Fohhn's list: frequency-dependent direct and total sound level; STI for male and female voices per DIN EN 60268-16; evaluation with single values, spectra and histograms; PDF export. — [S1 "Simulation & Evaluation"](https://www.fohhn.com/en/products/fohhn-designer); [S3](https://tpimagazine.com/?p=33251)
- **[D]** Simulation tab: "Start", "Stop" and "Setup". Setup holds:
  - name and description
  - octave or one-third-octave results
  - background noise, optionally included in STI
  - a simplified method, "Calculate Multi-Source as Single-Source"
  - "Consider air damping"
  - "Consider room collision" (wall influence)

  When a simulation finishes, the Snapshot panel opens automatically on the left. — [S4 "Onglet Simulation"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Display modes in the Snapshots panel: coverage at a chosen frequency (octave or one-third octave), coverage in "broadband" mode (adjustable), coverage with weighting (none, A or C), and STI male or STI female. — [S4 "Onglet Snapshots-1"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Evaluation tools:
  - measure distance and time
  - place a measurement label at a point (the "pipette")
  - frequency response at the clicked point, showing Direct SPL and Total SPL
  - histogram of mean SPL over all listener planes
  - scale min and max editable by clicking the bold values

  — [S4 "Les outils d'évaluation"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Room acoustics: once RT60 and/or material data are entered, Designer shows "complete" results, either extrapolated, measured, or both. That means Total SPL (diffuse plus direct) and STI (male/female). The theory slides show these inputs:
  - Total SPL = direct sound + diffuse sound, with the diffuse part built from the energy of all speakers, the room volume and the reverberation time.
  - STI = direct + diffuse, citing IEC 60268-16.
  - Sabine's formula with frequency-dependent α. For mean α above 0.25, the Eyring method is recommended.

  — [S4 "L'incidence de l'acoustique de la pièce -1", "TOTAL SPL", "INTELIGIBILITÉ", "Formule de Sabine"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** STI is only valid if RT60 is entered or calculated correctly. Designer cannot calculate RT60 itself unless the room is "closed". — [S4 "Onglet Snapshots-2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** The Fohhn webinar promises "quick and easy simulation" and "advanced acoustical simulations including room acoustics". — [S7](https://cloud.fohhn.com/en/webinars)

### Inferences
- **[I]** The diffuse-field model (energy + volume + RT feeding a diffuse level) has the shape of a statistical reverberant-field (Hopkins-Stryker-type) approach. Fohhn does not name the algorithm, so this must not be presented as Fohhn's documented method. The Sabine/Eyring slide comes from the distributor's theory section and does not necessarily describe Designer's code.
- **[I]** "Consider room collision" may mean a direct-path occlusion check by walls, not reflections. Its exact meaning is not documented.
- **[I]** No ray tracing, image-source method, impulse-response, STIPA or C80/D50 outputs are documented. The S4 slide titled "room impulse response" is explanatory theory, not a listed output.

### Gaps
- **[U]** Frequency range (for example 63 Hz–8 kHz versus 250 Hz–4 kHz), the default broadband range, the grid resolution of listener planes (the "Remesh" control suggests it is configurable), and whether STIPA is offered.
- **[U]** Whether speaker interference is summed coherently or incoherently. The "Multi-Source as Single-Source" option hints that there is a choice.

---

## 6. Snapshots (priority)

### Takeaway
A snapshot is a stored simulation state: speakers, listener planes, room info (acoustic properties) and simulation data, but **not the room model geometry**. Snapshots form a tree with a root and branches (Root → A → A1/A2, B → B1/B2), which supports "evolutionary" design and comparison by clicking between them. One is created when a simulation finishes, and it holds the results. Nothing documented says that changing the room re-runs earlier snapshots.

### Cited Findings
- **[D]** Fohhn: "Evolutionary concept development based on snapshots", with "room and loudspeaker properties, simulation settings and the corresponding results per snapshot", plus a "modification history". — [S1 "The Fohhn Speaker-Setup"](https://www.fohhn.com/en/products/fohhn-designer); [S3](https://tpimagazine.com/?p=33251)
- **[D]** In the slide "Faites évoluer votre projet, avec des SNAPSHOTS", a diagram shows a tree labelled Root, A, A1, A2, B, B1, B2. Snapshots contain the loudspeakers, the listening zones, the room info and the simulation data. They do **not** contain the room model. — [S4](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** The left context panel is named "Snapshots" by default. — [S4 "Espace de travail"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Creation: when a simulation completes, the Snapshot window opens automatically. Simulation Setup lets you set a name and description. — [S4 "Onglet Simulation"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** The Snapshot tab has only two commands:
  - "Show" brings back the snapshots window. It shows the tree ("arborescence") of shots, so you can compare by clicking from one view to another. It also holds the result views listed in §5.
  - "Result Labels" manages pipette labels: Delete all, Hide or Show. A label keeps its position across views and shows the variations at the picked point.

  — [S4 "Onglet Snapshots-1/-2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Materials are viewable "per simulation (snapshot)" under Manage materials → Used materials. — [S4 "Onglet Room -3"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)

### Inferences
- **[I]** Results are frozen per snapshot: Fohhn says each snapshot stores "the corresponding results", and comparison means clicking between stored snapshots. Nothing documents automatic re-calculation. The audit should test this.
- **[I]** Since geometry is excluded, all snapshots in a project share one room model. Editing the geometry could make older snapshots inconsistent, and how the app handles that is undocumented.
- **[I]** The tree suggests that a new simulation branches from the currently selected snapshot. This is not stated.
- **[I]** Report labels and the report's auto-update ("whenever project data is changed") probably refer to a chosen snapshot. This is not documented.

### Gaps
- **[U]** Rename and delete operations, a List/Tree view toggle, side-by-side or difference comparison, and per-snapshot export. None is documented publicly in the sources found.
- **[U]** Whether snapshots can be restored, making their speaker and listener state current again.

---

## 7. Export and reporting

### Takeaway
The Export tab produces a configurable PDF report (German or English), a loudspeaker table, a full loudspeaker list, and composed screenshots. Fohhn also documents export to Fohhn Audio Soft projects.

### Cited Findings
- **[D]** Export tab:
  - "Report configurator" generates an automatic PDF report that you can edit, in the project language (English or German in 2020).
  - "Loudspeaker table" is a simplified table.
  - "Loudspeaker list" includes all physical and electronic parameters used.
  - "Screenshot" is a composed capture of the Editor view with the chosen parameters, a frequency response at a point, or the histogram. These PDFs can be inserted in the final report.

  — [S4 "Onglet Export"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Report Configurator: a wizard, automatic screenshots and project variables, text templates, automatic report updates "whenever project data is changed", and customisation of views, evaluations, texts and images. — [S1](https://www.fohhn.com/en/products/fohhn-designer); [S3](https://tpimagazine.com/?p=33251) (S3 mentions the German and English templates)
- **[D]** "Export to Fohhn Audio Soft projects". — [S1](https://www.fohhn.com/en/products/fohhn-designer)

### Gaps
- **[U]** Project-file export or import (a native file format), and image formats (PNG?).

---

## 8. Example projects

### Takeaway
No public source describes built-in example projects (Hall, Conference Room, Theatre).

### Cited Findings
- **[D]** In 2020 the distributor linked an exercise set at download.fohhn.com/20200310/Fohhn_Designer/index.html. The TLS certificate had expired when fetched, so its contents are unread. — [S4 "Liens utiles"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)

### Gaps
- **[U]** The contents of the example projects. This needs the live audit or the YouTube playlist (S6).

---

## 9. Limitations and accuracy disclaimers

### Takeaway
No formal accuracy disclaimer was found. The documented practical limits are: Fohhn speakers only, STI that depends on RT60, RT calculation only for closed rooms, model-error handling, and browser restrictions.

### Cited Findings
- **[D]** STI values are only meaningful if RT60 is entered or calculated correctly, and Designer cannot calculate RT60 for a room that is not closed. — [S4 "Onglet Snapshots-2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Model errors can be shown (Model Status → Show Errors) or bypassed with "Invert room areas". Extruded source elements block transparency. — [S4 "Onglet Room -1/-2"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** In 2020 the speaker database was still being completed (ARC subs pending). — [S4 "Onglet Loudspeaker -1"](https://www.novelty-group.com/media/Formations/novelty-session-Fohhn-Designer-Basics-Online.pdf)
- **[D]** Only listed browsers are supported. — [S5](https://services.fohhn.com/designer/projects)
- **[D]** Database scope is "all Fohhn loudspeakers". No third-party speakers are mentioned. — [S1](https://www.fohhn.com/en/products/fohhn-designer)

### Gaps
- **[U]** An official accuracy statement, a validation study, or terms-of-use liability language. These would sit in the Help Centre or the ToS, both behind login.
- Searches in German ("Fohhn Designer" with Simulation, Hörfläche, Sprachverständlichkeit, Schnappschuss) found no German-language documentation. The German catalog URL (/de/katalog/fohhn-designer) exists but was not fetched. Trade-press coverage beyond TPi (Production Partner, Professional System, InAVate, Installation) and Fohhn LinkedIn posts did not appear in searches.
