# Copy deck : navigation de la vue et Essais / View navigation and Essais

Owner: tekuxwriter. Status: draft for review (night build 2026-10-24). Phase 1 only: Essais carry **no acoustic numbers**.

Conventions
- Columns: `key | FR | EN gloss | where it shows | notes`. The EN column is a gloss for reviewers, not shipped text.
- Tone: short, calm, never blames the learner. Learner-facing word is **Essai** (code word `Trial`).
- `{x}` = variable filled by code. Plural handled by developers (`{n} essai(s)` shown as two keys where wording differs).
- Strings marked **[reused]** come from `prototype-brief.md` §2.2 to §2.7 (the research prototype brief) and must not be reworded without Oscar.
- Strings marked **[brief]** come from Task 6 of the night brief.
- Existing controls (walk, focus, Esc chain) keep their wording from `docs/CONTROLS.md`; only the new ones are below.

## Fact checks

| Claim | Status | Source |
|---|---|---|
| From the audience, jardin = left, cour = right | **Partly verified.** TEK Brain concept `american-seating` (`knowledge-base/tek-brain/concepts/orchestra-classical.json`) says "côté jardin vu de la salle, house left", so **jardin = left from the audience** is cited. **Cour is not defined in any TEK Brain term**: "cour = right" is common theatre usage (the opposite side). | `american-seating`; rooms files also use "jardin"/"cour" as zone names (e.g. `concert-hall-medium.json`, id `coulisse-jardin`) |
| No glossary entry | `knowledge-base/tek-brain/glossary/*.json` has no match for "jardin" or "cour". | grep |
| Flag | **Flag for Oscar:** confirm "cour = droite (vue de la salle)", and consider adding a glossary term `cote-jardin-cote-cour`. Note: in the "Face" view the camera sits in the audience looking at the stage (N3), so the learner's left is jardin: the tooltip is correct for that view only. | |

## 1. View cube (cube de vue)

Faces follow N3: "Face" = looking from the audience toward the stage (camera at +z, `alpha = +π/2`); "Arrière" = the opposite side.

### 1.1 Face labels (drawn on the cube, Papier 11 px)

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `viewCube.face.face.label` | Face | Front | Cube face | **[brief]** Numpad1 |
| `viewCube.face.arriere.label` | Arrière | Back | Cube face | **[brief]** Ctrl+Numpad1 |
| `viewCube.face.gauche.label` | Gauche | Left | Cube face | **[brief]** Numpad4 |
| `viewCube.face.droite.label` | Droite | Right | Cube face | **[brief]** Numpad6 |
| `viewCube.face.dessus.label` | Dessus | Top | Cube face | **[brief]** Numpad7 |
| `viewCube.face.dessous.label` | Dessous | Bottom | Cube face | **[brief]** Ctrl+Numpad7 |
| `viewCube.corner.faceGauche.label` | Face-gauche | Front-left | Cube corner | **[brief]** three-quarter view |
| `viewCube.corner.faceDroite.label` | Face-droite | Front-right | Cube corner | **[brief]** |
| `viewCube.corner.arriereGauche.label` | Arrière-gauche | Back-left | Cube corner | **[brief]** |
| `viewCube.corner.arriereDroite.label` | Arrière-droite | Back-right | Cube corner | **[brief]** |

Left/right are always the viewer's own left/right **when looking at that face**; keep it short on the cube and explain in the tooltip (1.4).

### 1.2 Accessible names (aria-label) and tooltips for faces

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `viewCube.face.face.aria` | Vue de face | Front view | aria-label + tooltip | **[brief]** |
| `viewCube.face.arriere.aria` | Vue arrière | Back view | aria-label + tooltip | |
| `viewCube.face.gauche.aria` | Vue de gauche | Left view | aria-label + tooltip | |
| `viewCube.face.droite.aria` | Vue de droite | Right view | aria-label + tooltip | |
| `viewCube.face.dessus.aria` | Vue de dessus | Top view | aria-label + tooltip | Same words as the "Vue de dessus" button in the brief §2.2 **[reused]** |
| `viewCube.face.dessous.aria` | Vue de dessous | Bottom view | aria-label + tooltip | |
| `viewCube.corner.faceGauche.aria` | Vue de trois quarts, face-gauche | Front-left three-quarter view | aria-label | |
| `viewCube.corner.faceDroite.aria` | Vue de trois quarts, face-droite | Front-right three-quarter view | aria-label | |
| `viewCube.corner.arriereGauche.aria` | Vue de trois quarts, arrière-gauche | Back-left three-quarter view | aria-label | |
| `viewCube.corner.arriereDroite.aria` | Vue de trois quarts, arrière-droite | Back-right three-quarter view | aria-label | |
| `viewCube.face.active.aria` | {face}, vue actuelle | {face}, current view | aria-label suffix on the active face | Active face is also outlined Ambre; never colour alone |
| `viewCube.root.aria` | Cube de vue : choisir un point de vue | View cube: choose a viewpoint | aria-label on the cube group | |

### 1.3 Buttons, home, keys

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `viewCube.rotateLeft.label` | Tourner à gauche (90°) | Turn left (90°) | Button beside the cube | **[brief]** 90° is an angle, not an acoustic value |
| `viewCube.rotateRight.label` | Tourner à droite (90°) | Turn right (90°) | Button beside the cube | **[brief]** |
| `viewCube.home.label` | Vue d'ensemble | Overview | Button / house icon on the cube | **[brief]** Alt+H |
| `viewCube.home.tooltip` | Vue d'ensemble (Alt+H) | Overview (Alt+H) | Tooltip | Shows the remapped key if changed |
| `viewCube.home.aria` | Revenir à la vue d'ensemble de la salle | Go back to the room overview | aria-label | |
| `viewCube.key.face` | Numpad 1 | | Tooltip key hint, face "Face" | Key hints show the physical key (`code`), as in CONTROLS.md |
| `viewCube.key.arriere` | Ctrl + Numpad 1 | | Tooltip, "Arrière" | |
| `viewCube.key.droiteCorner` | Numpad 3 | | Tooltip, "Face-droite" | Corner not named in the brief; confirm with tekfrontenddesigner |
| `viewCube.key.arriereCorner` | Ctrl + Numpad 3 | | Tooltip, ¾ back view | **Open:** brief lists Numpad3 and Ctrl+Numpad3 without naming the corner; fill after the input map is final |
| `viewCube.key.dessus` | Numpad 7 | | Tooltip, "Dessus" | |
| `viewCube.key.gauche` | Numpad 4 | | Tooltip, "Gauche" | |
| `viewCube.key.droite` | Numpad 6 | | Tooltip, "Droite" | |
| `viewCube.noNumpad.hint` | Pas de pavé numérique ? Cliquez le cube. | No numpad? Click the cube. | Help overlay, under the cube keys | Many school laptops have no numpad; every action has a button |

### 1.4 Jardin / cour hint

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `viewCube.face.gauche.hint` | Côté jardin (à gauche vu de la salle) | Stage-left-of-house side: "jardin" (left, seen from the audience) | Tooltip of "Gauche" | jardin cited: TEK Brain `american-seating` |
| `viewCube.face.droite.hint` | Côté cour (à droite vu de la salle) | "cour" side (right, seen from the audience) | Tooltip of "Droite" | **Flag for Oscar:** cour not in TEK Brain, common theatre usage |
| `viewCube.jardinCour.help` | Au théâtre, « jardin » est à gauche et « cour » à droite, vus depuis la salle (le public). | In theatre, "jardin" is left and "cour" is right, seen from the audience. | Help overlay (H), one line under the cube | Same flag |
| `viewCube.jardinCour.noRoom` | Sans salle dans ce niveau, « Face » regarde les appareils du côté sans connecteurs. | Without a room in this level, "Face" looks at the devices from the side without connectors. | Help overlay | Follows N3. Show the jardin/cour hint **only** in levels with a room |

### 1.5 Coach hint

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `viewCube.coach.hint` | Cliquez une face pour tourner autour de l'objet sélectionné. | Click a face to turn around the selected object. | Coach bubble, first time the cube is shown | **[brief]** |
| `viewCube.coach.noSelection` | Rien n'est sélectionné : le cube tourne autour de la salle. | Nothing selected: the cube turns around the room. | Coach / tooltip when no pivot | Calm fallback, not an error |
| `viewCube.coach.reducedMotion` | Mouvement réduit : la vue change sans animation. | Reduced motion: the view changes without animation. | Settings help line | Cuts instead of flights (accessibility constraint) |

## 2. Camera presets (Vue 1 / 2 / 3)

Keys Digit1/2/3 recall a view. Right-click or long-press **saves** the current view to that slot.

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `preset.slot1.label` | Vue 1 | View 1 | Preset button | **[brief]** |
| `preset.slot2.label` | Vue 2 | View 2 | Preset button | **[brief]** |
| `preset.slot3.label` | Vue 3 | View 3 | Preset button | **[brief]** |
| `preset.group.aria` | Vues enregistrées | Saved views | aria-label on the button group | |
| `preset.slot.aria` | Vue {n} : aller à cette vue | View {n}: go to this view | aria-label, filled slot | |
| `preset.slot.tooltip` | Vue {n} (touche {key}). Clic droit ou appui long pour la remplacer. | View {n} (key {key}). Right-click or long-press to replace it. | Tooltip, filled slot | |
| `preset.empty.tooltip` | Vue {n} vide. Placez la caméra, puis clic droit ou appui long pour l'enregistrer. | View {n} empty. Position the camera, then right-click or long-press to save. | Tooltip, empty slot | **[brief]** |
| `preset.empty.aria` | Vue {n} : vide, appui long pour enregistrer | View {n}: empty, long-press to save | aria-label, empty slot | |
| `preset.save.button` | Enregistrer ici | Save here | Context-menu item / focusable "save" button (keyboard path) | Every action has a named button; right-click is not the only way |
| `preset.save.toast` | Vue {n} enregistrée. | View {n} saved. | Toast | **[brief]** |
| `preset.replace.toast` | Vue {n} remplacée. | View {n} replaced. | Toast | When the slot was filled |
| `preset.empty.toast` | La vue {n} est vide. Clic droit ou appui long pour l'enregistrer. | View {n} is empty. Right-click or long-press to save it. | Toast on Digit{n} for an empty slot | Teaches the gesture at the moment of need |
| `preset.saveFailed.toast` | La vue n'a pas pu être enregistrée dans ce navigateur. | The view could not be saved in this browser. | Toast | Storage write failures are always shown (council NN2) |

## 3. Essais: panel and Montage actuel

Panel on the left, one panel open at a time. Names follow brief §2.2.

### 3.1 Panel and list

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `essais.panel.title` | Essais | Trials | Panel title, toolbar button | Learner-facing word is Essai |
| `essais.panel.open.aria` | Ouvrir le panneau des essais | Open the trials panel | aria-label of the toolbar button | |
| `essais.panel.close.aria` | Fermer le panneau des essais | Close the trials panel | aria-label | Esc closes it (top panel) |
| `essais.empty` | Aucun essai. Placez le matériel, écrivez votre prédiction, puis figez. | No trial yet. Place the gear, write your prediction, then freeze. | Empty list (state 1) | **[reused]** §2.7 state 1, "Aucun essai — placez le matériel, écrivez votre prédiction, puis Figer"; dash replaced by a period, "figez" for the verb |
| `essais.list.aria` | Liste des essais | List of trials | aria-label | Arrow Up/Down moves in it |
| `essais.item.name` | Essai {name} | Trial {name} | List row | name = A, B, B1 ... |
| `essais.item.time` | figé à {time} | frozen at {time} | List row | |
| `essais.item.state.current` | à jour | up to date | List row state, caption | **[reused]** "à jour" |
| `essais.item.state.modified` | Montage actuel : modifié | Current setup: modified | Caption | **[reused]** |
| `essais.item.displayed` | affiché | displayed | Badge on the displayed row | Text, not only colour |

### 3.2 "Montage actuel" row (pinned)

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `essais.current.title` | Montage actuel | Current setup | Pinned row | **[reused]** Live state, autosaved, never an Essai |
| `essais.current.state.fresh` | identique à l'essai {name} | same as trial {name} | Row state | |
| `essais.current.state.modified` | modifié depuis l'essai {name} | modified since trial {name} | Row state | |
| `essais.current.state.none` | pas encore figé | not frozen yet | Row state, no Essai | |
| `essais.current.autosaved` | Enregistré automatiquement dans ce navigateur. | Saved automatically in this browser. | Row sub-label | Honest about the storage location |
| `essais.current.help` | Votre montage en cours. Il n'est un essai que lorsque vous le figez. | Your work in progress. It only becomes a trial when you freeze it. | "?" pop-over | |

### 3.3 Buttons and keys

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `essais.freeze.label` | Figer l'essai | Freeze the trial | Button | **[reused]** Key G |
| `essais.freeze.tooltip` | Figer l'essai (G) | Freeze the trial (G) | Tooltip | |
| `essais.freeze.aria` | Figer le montage actuel en un nouvel essai | Freeze the current setup as a new trial | aria-label | |
| `essais.compare.label` | Comparer | Compare | Button | **[reused]** |
| `essais.compare.tooltip` | Comparer (B : alterner A et B) | Compare (B: flip A and B) | Tooltip | Key B = flip at the same camera pose |
| `essais.compare.disabled` | Il faut deux essais pour comparer. | Two trials are needed to compare. | Disabled-button explanation (visible text, not title only) | |
| `essais.restore.label` | Repartir de cet essai | Start again from this trial | Button | **[reused]** one label for restore |
| `essais.restore.confirm` | Votre montage actuel sera remplacé par celui de l'essai {name}. Il reste figé dans la liste. | Your current setup will be replaced by trial {name}'s. It stays frozen in the list. | Confirm dialog body | Shown only if the current setup is modified and not frozen |
| `essais.restore.confirm.ok` | Repartir de l'essai {name} | Start again from trial {name} | Confirm button | |
| `essais.restore.confirm.cancel` | Annuler | Cancel | Confirm button | |
| `essais.frozen.toast` | Essai {name} figé. | Trial {name} frozen. | Toast after Figer | |
| `essais.restored.toast` | Vous repartez de l'essai {name}. | You are starting again from trial {name}. | Toast | |

### 3.4 "Rien n'a changé" toast (freeze is a no-op)

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `essais.noChange.toast` | Rien n'a changé depuis l'essai {name}. | Nothing has changed since trial {name}. | Toast on G / Figer when fingerprint and content refs are unchanged | **[brief]** Neutral, no blame; nothing is created |
| `essais.noChange.hint` | Modifiez un élément (placement, câblage ou salle), puis figez à nouveau. | Change one thing (placement, wiring or room), then freeze again. | Optional second line | Teaches one-change-at-a-time |

### 3.5 Prediction, note, flags

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `essais.prediction.label` | Prédiction | Prediction | Field label | |
| `essais.prediction.placeholder` | Je change…, je m'attends à… | I change..., I expect... | Field placeholder | **[reused]** |
| `essais.prediction.help` | Écrivez-la avant de figer : c'est ce qui compte quand on compare. | Write it before freezing: it is what counts when comparing. | "?" pop-over | |
| `essais.note.label` | Note | Note | Field label | |
| `essais.note.placeholder` | Ce que j'ai observé, ce que je ferais ensuite. | What I observed, what I would do next. | Placeholder | |
| `essais.note.locked` | Cet essai a un essai enfant : la prédiction et la note sont verrouillées. Vous pouvez ajouter un complément. | This trial has a child: prediction and note are locked. You can add an amendment. | Locked-field line | Brief §2.2: locked once a child exists, amendments allowed |
| `essais.amendment.add` | Ajouter un complément | Add an amendment | Button | |
| `essais.amendment.label` | Complément du {date} | Amendment of {date} | Amendment heading | |
| `essais.flag.multiChange` | plusieurs changements à la fois | several changes at once | Flag on an Essai | **[reused]** Calm, informational; add the pop-over below |
| `essais.flag.multiChange.help` | Cet essai change plusieurs choses : difficile de savoir laquelle a eu un effet. | This trial changes several things: hard to tell which one had an effect. | Pop-over | |

## 4. Caption bar, stale result, fidelity chip

Phase 1 has no result overlay yet; these strings are shared with phase 2 and must hold without numbers.

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `caption.displayed` | Affiché : Essai {name} | Displayed: Trial {name} | Caption bar (always starts with this) | **[reused]** "Affiché : …" |
| `caption.separator` | · | | Between caption parts | |
| `caption.current.modified` | Montage actuel : modifié | Current setup: modified | Caption bar | **[reused]** |
| `caption.current.fresh` | Montage actuel : à jour | Current setup: up to date | Caption bar | **[reused]** |
| `caption.full.example` | Affiché : Essai B · Montage actuel : modifié | Displayed: Trial B · Current setup: modified | Caption bar (assembled) | Phase 1 drops the "niveau direct relatif" part (phase 2) |
| `stale.label` | Résultat à refaire | Result to redo | Over a stale overlay / result area | **[reused]** Text, not only hatching |
| `stale.button` | Refaire l'évaluation | Redo the evaluation | Button | **[reused]** |
| `stale.help` | Le montage a changé depuis cet essai. Le résultat affiché n'est plus à jour. | The setup has changed since this trial. The displayed result is no longer current. | Under the label | |
| `content.changed` | Salle ou fiche modifiée depuis cet essai | Room or sheet changed since this trial | Banner on an Essai (state 7) | **[reused]** Result is kept, never recomputed silently |
| `content.changed.button` | Refaire avec les données actuelles | Redo with current data | Button (creates a new Essai) | **[reused]** |
| `eval.failed` | Données manquantes pour {appareil} | Missing data for {device} | Banner (state 6) | **[reused]** Live setup is kept; add "Votre montage est conservé." |
| `eval.failed.kept` | Votre montage est conservé. | Your setup is kept. | Second line | |
| `eval.busy` | Évaluation en cours… | Evaluation in progress... | Busy button | |
| `fidelity.chip` | relatif | relative | Chip (phase 2) | **[reused]** One word. No numbers on it |
| `fidelity.pop` | Valeurs relatives, calculées sur des données synthétiques TekPractice. Elles ne remplacent pas une mesure. | Relative values, computed from TekPractice synthetic data. They do not replace a measurement. | Chip pop-over (phase 2) | Phase 2 only; no acoustic term needed |

## 5. Compare (read-only)

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `compare.title` | Comparer les essais | Compare trials | Compare header | |
| `compare.pick.a` | Essai A | Trial A | Selector | Names are the Essais' own names |
| `compare.pick.b` | Essai B | Trial B | Selector | |
| `compare.flip.label` | Alterner A / B | Flip A / B | Button | Key B; same camera pose |
| `compare.flip.aria` | Afficher l'autre essai à la même place de caméra | Show the other trial at the same camera position | aria-label | |
| `compare.close.label` | Fermer la comparaison | Close the comparison | Button | Esc chain step 3b |
| `compare.readonly` | Comparaison en lecture seule : rien n'est modifié. | Read-only comparison: nothing is changed. | Banner | Why Esc can close it safely |
| `compare.col.a` | A | A | Table header | **[reused]** columns A / B / Δ |
| `compare.col.b` | B | B | Table header | |
| `compare.col.delta` | Δ | Δ | Table header | In phase 1: "Changé" / "Identique" text, no numbers |
| `compare.row.changed` | Changé | Changed | Table cell | |
| `compare.row.same` | Identique | Same | Table cell | |
| `compare.diff.placements` | Placements | Placements | Section | What moved: gear and position |
| `compare.diff.wiring` | Câblage | Wiring | Section | Cables added, removed |
| `compare.diff.room` | Salle | Room | Section | |
| `compare.diff.rules` | Règles | Rules | Section | Which rules now pass or fail (R1 to R3 ids stay as code) |
| `compare.rule.nowPasses` | respectée maintenant | now respected | Cell | Calm wording, no "fail" shout |
| `compare.rule.nowFails` | à revoir maintenant | to review now | Cell | |
| `compare.prediction.held` | Votre prédiction se vérifie. | Your prediction holds. | Verdict line | Only when the app can decide it from rules; otherwise do not show |
| `compare.prediction.notHeld` | Votre prédiction ne se vérifie pas ici. Relisez ce qui a bougé. | Your prediction does not hold here. Look again at what moved. | Verdict line | Never blames the learner; invites reading |
| `compare.prediction.manual` | Relisez votre prédiction : s'est-elle vérifiée ? | Reread your prediction: did it hold? | Fallback line | Default in phase 1 (free text cannot be graded) |
| `compare.scale.locked` | Échelle commune verrouillée pendant la comparaison. | Shared scale locked during the comparison. | Caption (phase 2) | |
| `compare.overlap.hatched` | interférences non modélisées | interference not modelled | Label on hatched overlap (phase 2) | **[reused]** |

## 6. First-year limit (3 Essais)

1st year: flat list, A/B only, maximum 3 Essais. 2nd year: mini-tree.

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `limit.counter` | {n} essai(s) sur 3 | {n} of 3 trials | Panel footer | Always visible in 1st year |
| `limit.reached.title` | Vous avez 3 essais. | You have 3 trials. | Dialog / inline message on Figer | |
| `limit.reached.body` | En première année, on garde 3 essais au maximum. Supprimez-en un ou exportez-les, puis figez à nouveau. | In 1st year, 3 trials is the maximum. Delete one or export them, then freeze again. | Same | Never says "refusé" |
| `limit.reached.export` | Exporter mes essais | Export my trials | Button in that message | |
| `limit.reached.delete` | Supprimer un essai | Delete a trial | Button | |
| `limit.delete.confirm` | Supprimer l'essai {name} ? Cette action est définitive. | Delete trial {name}? This cannot be undone. | Confirm | Add "Exportez d'abord si vous voulez le garder." |
| `limit.delete.confirm.hint` | Exportez d'abord si vous voulez le garder. | Export first if you want to keep it. | Second line | |
| `limit.delete.confirm.ok` | Supprimer | Delete | Button | |
| `limit.delete.hasChild` | Cet essai a des essais enfants : supprimez-les d'abord. | This trial has child trials: delete those first. | Disabled-delete explanation | 2nd year only |

## 7. Same-name rig overwrite

A saved rig ("montage enregistré", `SavedRig`) with the same name.

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `rig.overwrite.title` | Un montage porte déjà ce nom. | A rig already has this name. | Confirm dialog title | |
| `rig.overwrite.body` | Remplacer « {name} » ? L'ancienne version sera perdue. | Replace "{name}"? The old version will be lost. | Dialog body | Honest; add the rename path |
| `rig.overwrite.replace` | Remplacer | Replace | Button | Not the default focus |
| `rig.overwrite.rename` | Choisir un autre nom | Choose another name | Button | Default focus (safe choice) |
| `rig.overwrite.cancel` | Annuler | Cancel | Button | |
| `rig.saved.toast` | Montage « {name} » enregistré. | Rig "{name}" saved. | Toast | |
| `rig.replaced.toast` | Montage « {name} » remplacé. | Rig "{name}" replaced. | Toast | |

## 8. Export, import, quarantine, storage

Brief §2.7 states 8 and 9 and risks table (storage full: "Exporter puis archiver" prompt, hard stop only at the absolute budget).

### 8.1 Export and import

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `export.button` | Exporter | Export | Panel button | File extension `.essai.json` |
| `export.button.aria` | Exporter les essais dans un fichier | Export the trials to a file | aria-label | |
| `export.done.toast` | Fichier enregistré : {filename} | File saved: {filename} | Toast | |
| `export.help` | Ce fichier peut être ouvert par votre enseignant, hors ligne, sur n'importe quel appareil. | Your teacher can open this file, offline, on any device. | Pop-over | Links to the teacher page |
| `export.declaratif` | Les essais sont déclaratifs : ce fichier est ce que vous avez saisi et figé, il n'est pas signé. | Trials are declarative: this file is what you entered and froze; it is not signed. | Pop-over, export dialog, teacher page footer | **[reused]** the "déclaratif" disclaimer (brief §2.6, exported file can be forged) |
| `import.button` | Importer | Import | Panel button | |
| `import.button.aria` | Importer des essais depuis un fichier | Import trials from a file | aria-label | |
| `import.done.toast` | {n} essai(s) importé(s). | {n} trial(s) imported. | Toast | |
| `import.done.partial` | {n} essai(s) importé(s), {m} ignoré(s) car déjà présent(s). | {n} imported, {m} skipped because already present. | Toast | Fingerprint de-duplication |
| `import.error.format` | Ce fichier n'est pas un fichier d'essais TekPractice. | This is not a TekPractice trials file. | Error message | Calm; says what the file is, not what the learner did |
| `import.error.version` | Ce fichier vient d'une version plus récente de TekPractice. Mettez la page à jour, puis réessayez. | This file comes from a newer TekPractice version. Reload the page, then try again. | Error message | |
| `import.error.corrupt` | Ce fichier est abîmé ou incomplet. Rien n'a été importé. | This file is damaged or incomplete. Nothing was imported. | Error message | |
| `import.error.limit` | L'import dépasserait la limite de 3 essais. Rien n'a été importé. | The import would exceed the 3-trial limit. Nothing was imported. | Error message | 1st year |
| `import.error.read` | Le fichier n'a pas pu être lu par le navigateur. | The browser could not read the file. | Error message | |
| `import.choose.aria` | Choisir un fichier .essai.json | Choose an .essai.json file | File-input label | |

### 8.2 Quarantine

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `quarantine.notice` | Données d'essais illisibles — mises de côté (quarantaine), exportables. | Trial data unreadable, set aside (quarantine), exportable. | Banner (state 8) | **[reused]** with "mises de côté (quarantaine)" |
| `quarantine.reassure` | Rien n'est effacé. Votre progression n'est pas touchée. | Nothing is erased. Your progress is not affected. | Second line | Lowers anxiety; true only because quarantine does not delete (ADR-0011) |
| `quarantine.export` | Exporter les données mises de côté | Export the data set aside | Button | |
| `quarantine.continue` | Continuer sans elles | Continue without them | Button | |
| `quarantine.export.done` | Données mises de côté exportées : {filename} | Quarantined data exported: {filename} | Toast | |
| `quarantine.migration.toast` | Vos montages enregistrés ont été copiés vers le nouveau format. Les anciens sont conservés. | Your saved rigs were copied to the new format. The old ones are kept. | Toast after rigs v1 to v2 | Copy migration, no clobber |

### 8.3 Storage, 80 % and over budget

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `storage.near.title` | La mémoire des essais est presque pleine ({percent} %). | Trial storage is nearly full ({percent}%). | Banner at 80 % of budget | **[brief]** 80 % is a storage figure, not an acoustic one |
| `storage.near.body` | Exporter puis archiver les anciens essais. | Export, then archive the old trials. | Banner body | **[reused]** "Exporter puis archiver" (state 9) |
| `storage.near.button` | Exporter puis archiver | Export, then archive | Button | **[reused]** Archive = remove from browser after the file is saved |
| `storage.near.dismiss` | Plus tard | Later | Button | Does not hide it permanently |
| `storage.archive.confirm` | Les essais exportés seront retirés de ce navigateur. Le fichier reste chez vous. | Exported trials will be removed from this browser. The file stays with you. | Confirm after export | Archive only after a successful export |
| `storage.archive.done.toast` | {n} essai(s) archivé(s). | {n} trial(s) archived. | Toast | |
| `storage.over.title` | La mémoire des essais est pleine. | Trial storage is full. | Blocking message at the **absolute** budget | Hard stop only here (D3) |
| `storage.over.body` | Exportez puis archivez des essais pour continuer. Votre montage actuel n'est pas perdu. | Export then archive some trials to continue. Your current setup is not lost. | Same | |
| `storage.over.button` | Exporter puis archiver | Export, then archive | Button | |
| `storage.writeFailed` | L'enregistrement dans ce navigateur a échoué. Exportez vos essais pour ne rien perdre. | Saving in this browser failed. Export your trials so nothing is lost. | Error banner | Every write failure is shown (council NN2) |
| `storage.private.hint` | Le navigateur est peut-être en navigation privée : vos essais ne seront pas gardés. | The browser may be in private mode: your trials will not be kept. | Under `storage.writeFailed` when detectable | |

## 9. Exam mode

Essais are off in exam mode unless a level declares them (D2).

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `exam.essais.off` | Les essais ne sont pas disponibles pendant l'examen. | Trials are not available during the exam. | Disabled toolbar button tooltip | Visible text, since the button has a name and a reason |
| `exam.essais.on` | Dans cet examen, vos essais sont conservés pour la correction. | In this exam, your trials are kept for marking. | Banner, only if the level declares Essais | **Open (Oscar):** wording depends on the contested exam decision (brief §2.6) |

## 10. Teacher page (`teacher.html`, read-only)

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `teacher.title` | Parcours d'essais : lecture enseignant | Trial trail: teacher view | Page title and h1 | |
| `teacher.subtitle` | Page en lecture seule, ouverte à partir d'un fichier .essai.json. Rien n'est envoyé sur un serveur. | Read-only page, opened from an .essai.json file. Nothing is sent to a server. | Under the title | True per design: DOM-only, offline |
| `teacher.drop` | Déposez un fichier .essai.json ici, ou choisissez-le. | Drop an .essai.json file here, or choose it. | File zone | |
| `teacher.choose.button` | Choisir un fichier | Choose a file | Button | Keyboard path for the drop zone |
| `teacher.empty` | Aucun fichier ouvert. | No file open. | Empty state | |
| `teacher.error.read` | Ce fichier n'a pas pu être lu. Vérifiez qu'il vient bien de TekPractice. | This file could not be read. Check it comes from TekPractice. | Error | |
| `teacher.student` | Élève | Student | Header field | Only what the learner typed, if anything |
| `teacher.level` | Niveau ou salle | Level or room | Header field | |
| `teacher.trail` | Parcours | Trail | Section | A, B, B1 ... in order |
| `teacher.trial.prediction` | Prédiction | Prediction | Per-trial label | |
| `teacher.trial.rules` | Règles | Rules | Per-trial label | Frozen `ruleResults` |
| `teacher.trial.levelState` | État du niveau | Level state | Per-trial label | |
| `teacher.trial.note` | Note et compléments | Note and amendments | Per-trial label | |
| `teacher.trial.map` | Plan 2D | 2D map | Per-trial label | Static, from the exported setup |
| `teacher.map.alt` | Plan vu de dessus de l'essai {name} : placement du matériel dans la salle. | Top-down plan of trial {name}: gear placement in the room. | Alt text of the map | Text alternative for accessibility |
| `teacher.rubric.title` | Grille de lecture | Reading rubric | Section | **[reused]** teacher rubric (brief §2.7 state 10, §1 success criteria) |
| `teacher.rubric.1` | La prédiction a-t-elle été écrite avant de figer ? | Was the prediction written before freezing? | Rubric item | Draft derived from the brief's "graded on the value written before evaluating"; **Oscar to confirm the final rubric wording** |
| `teacher.rubric.2` | Un seul changement entre deux essais ? | One change between two trials? | Rubric item | Links to the multi-change flag |
| `teacher.rubric.3` | Les règles de câblage sont-elles respectées dans l'essai final ? | Are the wiring rules respected in the final trial? | Rubric item | R1 to R3 stay code ids in tooltips only |
| `teacher.rubric.4` | La note explique-t-elle ce qui a été observé ? | Does the note explain what was observed? | Rubric item | |
| `teacher.rubric.5` | L'élève a-t-il relu sa prédiction après comparaison ? | Did the student reread the prediction after comparing? | Rubric item | |
| `teacher.disclaimer` | Les essais sont déclaratifs : ils montrent ce que l'élève a saisi et figé. Le fichier n'est pas signé et peut être modifié. | Trials are declarative: they show what the student entered and froze. The file is not signed and can be edited. | Page footer, always visible | **[reused]** the "déclaratif" disclaimer |
| `teacher.print.button` | Imprimer ou enregistrer en PDF | Print or save as PDF | Button | |

## 11. Website copy: `tekpractice.html` and the game link

Registers: the website is French first, same calm tone. Status wording per the brief. No acoustic claims, no vendor names.

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `site.link.play` | Jouer à TekPractice | Play TekPractice | Link to `/tekpractice/jouer/` (menu, hero, footer) | **[brief]** link text |
| `site.cta.play` | Jouer maintenant | Play now | Primary button in the hero | **[brief]** |
| `site.cta.play.aria` | Jouer à TekPractice maintenant (s'ouvre dans la même fenêtre) | Play TekPractice now (opens in the same window) | aria-label | Matches "Jouer à TekPractice" link name |
| `site.badge.new` | Nouveau cette nuit | New tonight | Badge near the title | **[brief]** Revise after launch day: "tonight" ages; **flag:** swap to "Nouveau" or a date within a week |
| `site.status` | En développement · version d'essai | In development · trial version | Status line under the hero | **[brief]** "essai" here means "test", distinct from learner Essais; consider "version de test" (flag below) |
| `site.hero.title` | TekPractice | TekPractice | h1 | Product name |
| `site.hero.lead` | Branchez, placez, essayez : un atelier de sonorisation dans le navigateur, pour apprendre en manipulant. | Plug, place, try: a sound-system workshop in the browser, to learn by doing. | Hero paragraph | No claim of realism or measurement |
| `site.feature.explore.title` | Explorez la salle | Explore the room | Feature card | |
| `site.feature.explore.body` | Marchez dans la salle, tournez autour du matériel, retrouvez vos vues préférées en un clic. | Walk through the room, turn around the gear, return to your favourite views in one click. | Card body | Covers camera, view cube, presets |
| `site.feature.patch.title` | Câblez comme sur scène | Wire it like on stage | Feature card | |
| `site.feature.patch.body` | Branchez les ports, le jeu vérifie les connecteurs, le signal et le sens. | Plug the ports; the game checks connectors, signal and direction. | Card body | Reflects R1 to R3 only |
| `site.feature.essais.title` | Figez vos essais | Freeze your trials | Feature card | |
| `site.feature.essais.body` | Écrivez ce que vous attendez, changez une chose, figez, comparez. Vous gardez une trace de votre méthode. | Write what you expect, change one thing, freeze, compare. You keep a trail of your method. | Card body | Method, not result |
| `site.feature.teacher.title` | Pour les enseignants | For teachers | Feature card | |
| `site.feature.teacher.body` | Vos élèves exportent un fichier ; vous le lisez hors ligne, sans compte. | Your students export a file; you read it offline, without an account. | Card body | No account is true (out of scope in CLAUDE.md) |
| `site.requirements` | Fonctionne dans un navigateur récent sur ordinateur (écran 1366 × 768 ou plus). | Works in a recent desktop browser (1366 × 768 screen or larger). | Under the CTA | Target size from the brief; not a claim about mobile |
| `site.storage.note` | Vos montages et essais restent dans votre navigateur. Exportez-les pour les garder ou les partager. | Your rigs and trials stay in your browser. Export them to keep or share them. | Info line | Honest storage statement |
| `site.beta.note` | TekPractice est en développement : certaines choses changeront. Dites-nous ce qui vous gêne. | TekPractice is in development: some things will change. Tell us what gets in your way. | Footer note | Feedback channel link is for Oscar to supply |
| `site.teacher.link` | Ouvrir la page enseignant | Open the teacher page | Link | Opens `teacher.html` |
| `site.meta.title` | TekPractice : s'exercer à la sonorisation dans le navigateur | TekPractice: practise sound reinforcement in the browser | `<title>` | |
| `site.meta.description` | Un jeu de câblage et de placement pour les élèves de BTS Métiers de l'audiovisuel option son. En développement. | A wiring and placement game for BTS audiovisual (sound) students. In development. | Meta description | **Flag:** check the exact BTS name with Oscar before publishing |

## 12. New keys: help overlay (H) entries

Key ids for the help table. Existing rows stay as in `CONTROLS.md`.

| key | FR | EN gloss | where it shows | notes |
|---|---|---|---|---|
| `help.action.overview` | Vue d'ensemble | Overview | Help overlay, row label | Alt+H |
| `help.action.preset.recall` | Aller à la vue 1, 2 ou 3 | Go to view 1, 2 or 3 | Help overlay | Digit1 / Digit2 / Digit3 |
| `help.action.preset.save` | Enregistrer la vue 1, 2 ou 3 | Save view 1, 2 or 3 | Help overlay | Right-click or long-press the slot |
| `help.action.cube.faces` | Vues du cube : face, arrière, gauche, droite, dessus | Cube views: front, back, left, right, top | Help overlay | Numpad1, Ctrl+Numpad1, Numpad4, Numpad6, Numpad7 |
| `help.action.cube.corners` | Vues de trois quarts | Three-quarter views | Help overlay | Numpad3, Ctrl+Numpad3 (see open point in 1.3) |
| `help.action.freeze` | Figer l'essai | Freeze the trial | Help overlay | G |
| `help.action.compare` | Comparer : alterner A et B | Compare: flip A and B | Help overlay | B |
| `help.action.toggleOverlay` | Afficher ou masquer la couche de résultat | Show or hide the result layer | Help overlay (phase 2) | O |
| `help.action.essais.list` | Parcourir les essais | Browse the trials | Help overlay | Arrow Up / Down inside the panel |
| `help.keysIgnoredInField` | Les touches ne fonctionnent pas quand vous écrivez dans un champ. | Keys do nothing while you type in a field. | Help overlay footer | Explains the text-field rule |

## Open points for Oscar / reviewers

1. **Cour = droite** is common theatre usage, not in TEK Brain; jardin = gauche is backed by `american-seating`. Consider a glossary term.
2. `viewCube.key.droiteCorner` / `arriereCorner`: the brief lists Numpad3 and Ctrl+Numpad3 without naming the corners; complete with tekfrontenddesigner.
3. `site.badge.new` ("Nouveau cette nuit") will age; `site.status` uses "essai" for "test", which can be confused with the learner Essais; consider "version de test".
4. Teacher rubric items 1 to 5 are a draft based on the brief's criteria; the brief §2.7 only names "teacher rubric".
5. Exam copy depends on the contested exam-mode decision.
6. BTS name in `site.meta.description` to confirm.

Checked: no acoustic numbers, no vendor tool names, no banned terms from the brief.
