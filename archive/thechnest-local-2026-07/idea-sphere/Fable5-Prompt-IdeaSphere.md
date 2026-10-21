# Fable 5 — Build Prompt: "IdeaSphere" (local 3D project-tracking website)
Paste everything inside the code block below into Fable 5. It asks for one self-contained HTML file, pre-seeded with the real project data.

---

```
ROLE
You are a senior creative front-end engineer. Build a single self-contained HTML file called `idea-sphere.html` — a 3D interactive "idea sphere" for tracking my projects. Think Obsidian's graph view, but far nicer visually and in 3D. It must run by simply double-clicking the file (file:// in a Chromium browser), with NO build step and NO server.

GOAL
A rotating 3D sphere of connected nodes (projects, modules, ideas, tasks). I can explore it, see status at a glance by color, click any node to read/edit its details, add nodes and links in-app, and it remembers everything. It is pre-loaded with my current projects.

HARD CONSTRAINTS
- ONE file: `idea-sphere.html`. All CSS and JS inline. No frameworks build step.
- 3D via three.js from CDN (e.g. https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js) plus OrbitControls from a CDN. If a CDN module fails, degrade gracefully, never blank-screen.
- Works offline after first load is not required, but must run from a local file with no install.
- No localStorage-blocking assumptions; persistence = localStorage + JSON export/import (see PERSISTENCE).

DATA MODEL
node = { id:string, label:string, type:"project"|"module"|"idea"|"task", status:"idea"|"in-progress"|"done"|"blocked", progress:0-100, notes:string, tags:string[] }
link = { source:id, target:id, kind:"child"|"relates"|"depends" }
Store everything in one state object { nodes:[], links:[] }.

SEED DATA (bake this in as the default state; load it on first run if no saved state exists)
nodes:
- { id:"tech-nest", label:"Tech Nest", type:"project", status:"in-progress", progress:30, tags:["vision"], notes:"AI platform to help BTS Audiovisuel option Son students succeed (Paris/France). Be #1 at student success." }
- { id:"tn-kb", label:"BTS Son Knowledge Base", type:"module", status:"done", progress:100, tags:["research"], notes:"Official référentiel, épreuves E1–E6, coefficients (total 17), grille horaire, RNCP blocs, annales index." }
- { id:"tn-comp", label:"Competitive Landscape", type:"module", status:"done", progress:100, tags:["research"], notes:"~70 platforms in 4 clusters. 3 white spaces: Son specialization, teach-don't-cheat AI, AI feedback on real audio." }
- { id:"tn-phase3", label:"Phase 3 Research", type:"idea", status:"idea", progress:0, tags:["research"], notes:"User interviews, SEO audit, AI-audio-feedback feasibility, RGPD." }
- { id:"tn-site", label:"Website Build", type:"idea", status:"idea", progress:0, tags:["build"], notes:"Design system + structure + student journey." }
- { id:"audio-sim", label:"Audio Engineering Simulator", type:"project", status:"in-progress", progress:20, tags:["build","3D"], notes:"Browser 3D audio-wiring simulator (Babylon.js + TS + Vite). Logic-first vertical slice. 4 domains: Live, Radio, Duplex/N-1, Post." }
- { id:"as-claude", label:"CLAUDE.md + Scaffold", type:"module", status:"done", progress:100, tags:["setup"], notes:"Rulebook + Vite/TS scaffold created in Claude Code." }
- { id:"as-catalog", label:"Catalog authoring (Prompt 0.5)", type:"module", status:"blocked", progress:10, tags:["content"], notes:"Cas 3: reference files never existed on Windows. Authoring catalog.json fresh as canonical v1." }
- { id:"as-engine", label:"Engine + Level A1 (Prompt 1)", type:"idea", status:"idea", progress:0, tags:["engine"], notes:"Vertical slice: A1 playable with placeholder boxes, tests, Vercel." }
- { id:"as-levels", label:"Levels B1/C1/D1", type:"idea", status:"idea", progress:0, tags:["engine"], notes:"GPIO, mix-minus N-1, patchbay normalling + clock." }
- { id:"as-assets", label:"3D Assets (Blender)", type:"task", status:"in-progress", progress:40, tags:["assets"], notes:"Autonomous overnight Blender MCP run: connector kit + device models." }
- { id:"as-ship", label:"Verify & Ship P1", type:"idea", status:"idea", progress:0, tags:["qa"], notes:"deep-scan, full tests, Vercel prod." }
links:
- children: tech-nest→tn-kb, tech-nest→tn-comp, tech-nest→tn-phase3, tech-nest→tn-site (kind:"child")
- children: audio-sim→as-claude, audio-sim→as-catalog, audio-sim→as-engine, audio-sim→as-levels, audio-sim→as-assets, audio-sim→as-ship (kind:"child")
- relates: audio-sim→tech-nest (kind:"relates", note conceptually: simulator fills Tech Nest's "AI feedback on practical sound skills" white space)
- depends: as-engine→as-catalog, as-levels→as-engine, as-ship→as-levels (kind:"depends")

VISUAL DESIGN (make it beautiful — this is the point)
- Dark space background with a subtle starfield/gradient. Tasteful, calm, premium.
- Layout: arrange nodes in 3D as a gentle sphere/cloud. Use a light force-directed layout constrained toward a spherical shell so it reads as a "sphere of ideas", with children clustered near their parent project. Slow auto-rotation that pauses while the user interacts.
- Node color BY STATUS: idea = cool grey-blue, in-progress = amber, done = green, blocked = red. Provide a legend.
- Node SIZE by type: project largest, module medium, idea/task smaller.
- PROGRESS shown as an emissive glow intensity and/or a thin ring around the node scaled to progress%.
- Links: thin glowing lines; "child" solid, "relates" dashed, "depends" a distinct hue. Slight curve if easy.
- Labels: billboarded text sprites; always show project labels, fade smaller nodes' labels by camera distance; full label on hover.
- Bloom/glow is a nice-to-have (only if a CDN post-processing pass is reliable); never let it break the base render.

INTERACTIONS
- OrbitControls: drag = rotate, scroll = zoom, right-drag = pan.
- Hover: highlight node + connected links, show tooltip.
- Click node: open a glassmorphism side panel showing label, type, status (dropdown), progress (slider), tags, notes (editable textarea), and a list of linked nodes (clickable). Editing any field updates state and autosaves immediately, and the node's color/glow updates live.
- Toolbar (top or corner): 
  • Add Node (prompt for label/type, drops it near center)  
  • Link Mode (click two nodes to connect; pick kind)  
  • Search box + filter chips by status and by tag (dim non-matching nodes)  
  • Legend toggle  
  • Export JSON, Import JSON, Reset to Seed (with confirm).
- Keyboard: Esc closes panel; "/" focuses search.

PERSISTENCE (critical, since it runs from a local file)
- Autosave the entire state to localStorage on every change (key "ideaSphere:v1").
- On load: if saved state exists use it, else load SEED DATA.
- Export JSON: download the current state as `ideasphere.json`.
- Import JSON: file-picker to load a state file, validate shape, replace state, re-render.
- Reset to Seed: restore the baked-in seed (confirm first).

QUALITY / ACCEPTANCE
- Opens from a double-click, shows the seeded sphere within ~1s, smooth at 60fps for a few hundred nodes.
- All CRUD (add/edit node, add/remove link, change status/progress) works and survives a reload.
- Export then Import round-trips identically. Reset restores seed.
- Clean, commented, single file. Dispose three.js resources properly; use requestAnimationFrame.
- Graceful: if WebGL or a CDN is unavailable, show a readable message, not a blank page.

BUILD STEPS (do in this order, then output the full file)
1. Scaffold the HTML shell + inline CSS (dark theme, panel + toolbar styling).
2. Embed the state module with SEED DATA + localStorage load/save + export/import.
3. Set up three.js scene, camera, renderer, OrbitControls, starfield, resize handling.
4. Build the layout (force-to-sphere positioning) and render nodes (color/size/glow by status/type/progress) + links.
5. Add labels (sprites), hover highlighting, and the click→detail panel with live editing.
6. Add the toolbar: add node, link mode, search/filter, legend, export/import/reset.
7. Polish visuals (easing, glow, dashed relates links, auto-rotate pause-on-interact).
8. Self-test the acceptance list, then output the COMPLETE `idea-sphere.html` in one code block. After the code, give me a 3-line "how to use" (open the file, edit nodes, export to back up).

Output only the reasoning you need, then the full file. Make it feel premium.
```

---

## How to use it
1. Give the block above to Fable 5. It returns one file, `idea-sphere.html`.
2. Save it anywhere and double-click to open in Chrome/Edge.
3. It opens pre-loaded with Tech Nest + Audio Sim. Edit nodes, drag to explore, and click **Export JSON** whenever you want a backup on disk.

## Notes / options for later
- Want it to instead **read your Obsidian vault** (`.md` files with `[[links]]`) directly? That's a different build (needs the browser folder-picker / File System Access API or a tiny local server) — say the word and I'll write that variant.
- Want status/progress to **auto-sync from the Claude Code task list or git**? Also doable later as an upgrade.
