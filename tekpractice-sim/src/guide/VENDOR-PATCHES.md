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
- When none is clean but some clear the target, the one overlapping the rects the least wins (first in order on a tie) and the answer says
  `crowded: true`.
- When no candidate clears the target either, the original fallback applies unchanged.
- No list, an empty list, or rects that are not usable (not finite, no area): the answer is exactly the original code's answer
  (`tests/guide/vendorPatches.test.ts` compares with a verbatim copy of the original over a sweep).

**Used by.** the widget (`ui/widget.ts`) once it is given the host's obstacles; until then nothing passes a list and nothing changes.
