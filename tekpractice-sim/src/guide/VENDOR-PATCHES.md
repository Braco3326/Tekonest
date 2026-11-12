# Patches on the vendored guide module

`src/guide/vendor` is a copy of an upstream module (see `vendor/VENDOR.json`: `sourceCommit`, one sha256 per file). The copy is not edited in
passing. A change that has to live inside it is a **patch**: it is written up here, declared in `VENDOR.json` under `patches`, marked in the code by
a comment that names its id, and pinned by `tests/guide/vendorPatches.test.ts` (that test fails when a patch is not written up in both places, when
a file or a symbol it names is gone, or when its marker comment is gone, which is what a re-vendor that overwrites the patch looks like).

After a patch the file hashes in `VENDOR.json` are the hashes of the patched files, not upstream's. A re-vendor must start from upstream, re-apply
every patch below, then recompute the hashes.

Each patch is one `### Patch <id>` section with `File:`, `Symbol:` and `Marker:` lines (the pin test reads them).

### Patch placeBeside-avoid

- File: `core/motion.ts`
- Symbol: `placeBeside`
- Symbol: `avoid`
- Marker: `PATCHED: placeBeside-avoid`

**Why.** The icon is placed beside the control it points at. The original rule only keeps it clear of the target and inside the viewport, so it could
land on another control of the page (a toggle, a field, a menu item). The host knows those controls; the module did not.

**What.** `placeBeside(t, vp, s, avoid?)` takes an optional list of rects to stay clear of, and `MotionInput.avoid` hands the same list to it for the
pickup and the drop of `planMotion`.

- Candidates are tried in the original order (gap 8, 4, 0; right, left, below, above). The first one that clears the target, is inside the viewport and
  overlaps none of the rects wins (`crowded: false`).
- When none is clean but some clear the target, the one overlapping the rects the least wins (first in order on a tie); the icon then slides to the
  nearest place that is clear of the rects and of the target (`clearOf`, patch `widget-obstacles`) when there is one within three icon sizes, and that
  answer is `crowded: false`. Otherwise the least overlapping candidate is the answer and it says `crowded: true`.
- When no candidate clears the target either (it fills the view), the original fallback applies; with a list, its answer is moved to the nearest place clear
  of the rects when one is within three icon sizes (the answer stays `crowded: true`: the icon is on the target).
- No list, an empty list, or rects that are not usable (not finite, no area): the answer is exactly the original code's answer
  (`tests/guide/vendorPatches.test.ts` compares with a verbatim copy of the original over a sweep).

**Used by.** the widget (`ui/widget.ts`), which passes the host's obstacles (patch `widget-obstacles`); with no obstacles nothing passes a list and nothing changes.

### Patch widget-obstacles

- File: `core/motion.ts`
- File: `ui/widget.ts`
- Symbol: `clearOf`
- Symbol: `obstacles`
- Marker: `PATCHED: widget-obstacles`

**Why.** The corner the icon rests in, and the place the bubble takes, were computed from the viewport and two bars only. The host's own controls (a panel
full of buttons, a drawer, a menu) were invisible to the module, so the icon and the bubble landed on them. The host knows where they are.

**What.**

- `MountOptions.obstacles?(fresh?)` (widget): a getter of rects in viewport pixels. `fresh` is true when the widget has just seen the page change (a view,
  a resize, a scroll, a mutation), so the host re-reads then and may serve a cached list otherwise.
- `clearOf(from, size, vp, avoid)` (motion): the nearest place for a box that overlaps none of the rects. It pushes the box past the edge of each rect it
  hits (four rounds, a bounded frontier), then tries a coarse grid; when nothing is clear it returns the least overlapping place seen with `crowded`. The
  starting place is returned untouched when it is already clear or when no rect is usable.
- The widget uses it for the resting position of the icon (`restPos`: the home corner, moved if a control is in the way), passes the list to `planMotion`
  as `avoid` (patch `placeBeside-avoid`) for the icon beside a target, re-plans a step whose icon no longer sits clear (`destClear`), and moves the bubble
  clear of the controls, the icon and what the step points at (`bubbleClear`).
- A control whose centre lies inside what the step points at is the target, not an obstacle to that step (`offTarget`): the ring is on it and the icon sits
  beside it. This is what keeps a step that points at a whole screen (the place picker) from being steered by the cards inside it.
- No `obstacles` option, or a getter that answers with no rect or throws: every position is the one the original code gave (the legacy level page passes
  the getter but has no shell, so it answers with no rect).
