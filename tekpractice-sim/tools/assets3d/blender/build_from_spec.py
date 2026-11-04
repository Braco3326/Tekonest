"""build_from_spec.py - Blender builder of one raw GLB for the TekPractice 3D pipeline (scripted track, no Meshy).

Called by tools/assets3d/runBuilder.ts, headless:

  blender --background --factory-startup --python-exit-code 1 --python build_from_spec.py -- \
      --plan <plan.json> --out <raw.glb>

plan.json (written by Node): {id, kind, shape, sizeMm: {w, h, d}, matingOuterMm?, params: {name: mm}}. Sizes always come
from the spec's realSizeMm; params hold only the extra shape dimensions (see tools/assets3d/shapes.ts).

Authoring rule: every vertex is built in glTF space (x, y, z) in metres and placed at Blender (x, -z, y), like g2b in
fixup.py; the exporter with export_yup=True converts back, so the exported positions equal what is written here.
  - connector: the mating face at z = 0, the body along +Z, centred on x and y (pivot = centre of the mating face)
  - device: bottom at y = 0, centred on x and z (pivot = bottom-centre)
The output is the raw input of attempt 1 of buildAsset: the fix-up still orients (identity must win), scales to the exact
spec size and adds the port_/ctrl_ empties, so this script builds geometry only: one mesh, one material
('tekpractice-body', dark grey, no textures), fixed object and mesh names. It is deterministic: bmesh only (no boolean
modifiers), no randomness, no timestamps.

On any failure the script prints one line 'BUILD_FAIL <reason>' to stderr and exits 1.
"""
from __future__ import annotations

import json
import math
import sys
import traceback
from typing import Any, Callable

import bmesh
import bpy
from mathutils import Vector

MM = 0.001
SEGMENTS = 32

# The cylinder-plug (XLR) pin layout is stylised, not a measured copy of any vendor part.
PIN_HOLE_DIAMETER_MM = 1.5
PIN_HOLE_DEPTH_MM = 3.0
PIN_CIRCLE_RADIUS_MM = 4.4
PIN_HOLE_SEGMENTS = 12
DEFAULT_FRONT_LEN_MM = 12.0

DEFAULT_CHAMFER_MM = 1.0

# trs-plug: 24 segments keep a plug with grooves inside the 800-triangle connector budget.
TRS_SEGMENTS = 24
DEFAULT_BARREL_MM = 19.0
TRS_GROOVE_WIDTH_MM = 1.0
TRS_GROOVE_DEPTH_MM = 0.4
TRS_GROOVE_AT = (0.30, 0.55)  # start of each insulator groove as a fraction of the barrel length

# rj45-plug (stylised, not a measured copy of any vendor part)
RJ45_LATCH_STEP_MM = 1.5
RJ45_LATCH_START = 0.6        # the step starts at this fraction of the length
RJ45_SLOTS = 8
RJ45_SLOT_WIDTH_MM = 0.6
RJ45_SLOT_HEIGHT_MM = 3.0
RJ45_SLOT_DEPTH_MM = 1.0
RJ45_SLOT_PITCH_MM = 1.02
RJ45_SLOT_BOTTOM_MM = 1.5     # slots start this far above the bottom (the side opposite the latch)

Plan = dict[str, Any]


class BuildError(Exception):
    """A failure with a message meant for the user (one line)."""


def log(msg: str) -> None:
    print(f"BUILD {msg}", flush=True)


def parse_args() -> dict[str, str]:
    if "--" not in sys.argv:
        raise BuildError("no '--' in the command line: pass --plan and --out after it")
    argv = sys.argv[sys.argv.index("--") + 1:]
    if len(argv) % 2 != 0:
        raise BuildError(f"arguments after '--' must be --flag value pairs, got {argv}")
    args = {argv[i].lstrip("-"): argv[i + 1] for i in range(0, len(argv), 2)}
    for key in ("plan", "out"):
        if key not in args:
            raise BuildError(f"missing --{key}")
    return args


# --- helpers ----------------------------------------------------------------------------------------------

def g2b(x: float, y: float, z: float) -> Vector:
    """glTF point (x, y, z) -> Blender (x, -z, y)."""
    return Vector((x, -z, y))


def positive(value: Any, name: str) -> float:
    """`value` as a float, or a BuildError naming `name` when it is not a finite number above zero."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise BuildError(f"{name} must be a positive finite number, got {value!r}")
    return float(value)


def size_m(plan: Plan) -> tuple[float, float, float]:
    """(w, h, d) of the plan in metres, validated."""
    size = plan.get("sizeMm")
    if not isinstance(size, dict):
        raise BuildError("plan has no sizeMm")
    return tuple(positive(size.get(k), f"sizeMm.{k}") * MM for k in ("w", "h", "d"))  # type: ignore[return-value]


def param_m(plan: Plan, name: str, default_mm: float) -> float:
    """The shape param `name` in metres (the default when the plan gives none), validated."""
    params = plan.get("params") or {}
    return positive(params.get(name, default_mm), f"params.{name}") * MM


def ring(bm: bmesh.types.BMesh, radius: float, z: float, n: int = SEGMENTS, cx: float = 0.0, cy: float = 0.0) -> list[bmesh.types.BMVert]:
    """n vertices around the glTF z axis at height z, starting at +x, counter-clockwise seen from +z."""
    return [
        bm.verts.new(g2b(cx + radius * math.cos(2 * math.pi * i / n), cy + radius * math.sin(2 * math.pi * i / n), z))
        for i in range(n)
    ]


def band(bm: bmesh.types.BMesh, lo: list[bmesh.types.BMVert], hi: list[bmesh.types.BMVert]) -> None:
    """Quads between two rings of the same length (closed)."""
    n = len(lo)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def new_body_object(bm: bmesh.types.BMesh, name: str) -> bpy.types.Object:
    """Finishes the bmesh (consistent outward normals) and turns it into the one scene object with the one material."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    mat = bpy.data.materials.new("tekpractice-body")
    mat.diffuse_color = (0.08, 0.08, 0.09, 1.0)
    if mat.node_tree is not None:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = (0.08, 0.08, 0.09, 1.0)
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Roughness"].default_value = 0.6
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# --- shapes -----------------------------------------------------------------------------------------------

def build_cylinder_plug(plan: Plan) -> bpy.types.Object:
    """XLR-like cable plug: a front section of the mating diameter (z = 0 .. frontLen) in a larger shell (to z = d)."""
    w, h, d = size_m(plan)
    shell_r = min(w, h) / 2.0
    front_r = positive(plan.get("matingOuterMm"), "matingOuterMm") * MM / 2.0
    front_len = param_m(plan, "frontLenMm", DEFAULT_FRONT_LEN_MM)
    if front_r >= shell_r:
        raise BuildError(f"matingOuterMm ({front_r * 2000:.2f}) must be smaller than the shell diameter ({shell_r * 2000:.2f})")
    if front_len >= d:
        raise BuildError(f"params.frontLenMm ({front_len / MM:.2f}) must be shorter than sizeMm.d ({d / MM:.2f})")
    hole_r = PIN_HOLE_DIAMETER_MM * MM / 2.0
    hole_depth = PIN_HOLE_DEPTH_MM * MM
    pin_circle = PIN_CIRCLE_RADIUS_MM * MM
    if pin_circle + hole_r >= front_r or hole_depth >= front_len:
        raise BuildError("the front section is too small for the three pin holes")

    bm = bmesh.new()
    a = ring(bm, front_r, 0.0)
    b = ring(bm, front_r, front_len)
    c = ring(bm, shell_r, front_len)
    e = ring(bm, shell_r, d)
    band(bm, a, b)          # front section side
    band(bm, b, c)          # the step from the front section to the shell
    band(bm, c, e)          # shell side
    bm.faces.new(e[::-1])   # back end (cable side), a flat cap

    # Mating face with three blind pin holes: the outer ring plus three small rings are filled as one region with holes.
    fill_edges = [bm.edges.get((a[i], a[(i + 1) % SEGMENTS])) for i in range(SEGMENTS)]
    for k in range(3):
        ang = 2 * math.pi * k / 3 + math.pi / 2
        cx, cy = pin_circle * math.cos(ang), pin_circle * math.sin(ang)
        top = ring(bm, hole_r, 0.0, PIN_HOLE_SEGMENTS, cx, cy)
        bottom = ring(bm, hole_r, hole_depth, PIN_HOLE_SEGMENTS, cx, cy)
        band(bm, top, bottom)
        bm.faces.new(bottom[::-1])
        for i in range(PIN_HOLE_SEGMENTS):
            fill_edges.append(bm.edges.get((top[i], top[(i + 1) % PIN_HOLE_SEGMENTS])))
    result = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=fill_edges, normal=g2b(0.0, 0.0, -1.0))
    if not result["geom"]:
        raise BuildError("could not fill the mating face around the pin holes")
    return new_body_object(bm, "xlr-plug")


def build_trs_plug(plan: Plan) -> bpy.types.Object:
    """6.35 mm style TRS plug: a rounded-tip barrel of the mating diameter (z = 0 .. barrelMm) with two insulator
    grooves, then a body cylinder of the spec's width to z = d."""
    w, h, d = size_m(plan)
    body_r = min(w, h) / 2.0
    barrel_r = positive(plan.get("matingOuterMm"), "matingOuterMm") * MM / 2.0
    barrel_len = param_m(plan, "barrelMm", DEFAULT_BARREL_MM)
    if barrel_r >= body_r:
        raise BuildError(f"matingOuterMm ({barrel_r * 2000:.2f}) must be smaller than the body diameter ({body_r * 2000:.2f})")
    if barrel_len >= d:
        raise BuildError(f"params.barrelMm ({barrel_len / MM:.2f}) must be shorter than sizeMm.d ({d / MM:.2f})")
    groove_w = TRS_GROOVE_WIDTH_MM * MM
    groove_r = barrel_r - TRS_GROOVE_DEPTH_MM * MM
    tip_len = barrel_r * 0.5
    if tip_len + groove_w >= barrel_len * TRS_GROOVE_AT[0] or groove_r <= 0:
        raise BuildError("params.barrelMm is too short for the tip and the two insulator grooves")

    # (radius, z) profile of the revolved body, tip first. Rounded tip: a flat face of radius 0.55 R, then a quarter-round.
    profile: list[tuple[float, float]] = [
        (barrel_r * 0.55, 0.0),
        (barrel_r * 0.80, tip_len * 0.20),
        (barrel_r * 0.95, tip_len * 0.55),
        (barrel_r, tip_len),
    ]
    for frac in TRS_GROOVE_AT:
        z0 = barrel_len * frac
        profile += [(barrel_r, z0), (groove_r, z0), (groove_r, z0 + groove_w), (barrel_r, z0 + groove_w)]
    profile += [(barrel_r, barrel_len), (body_r, barrel_len), (body_r, d)]

    bm = bmesh.new()
    rings = [ring(bm, r, z, TRS_SEGMENTS) for r, z in profile]
    for lo, hi in zip(rings, rings[1:]):
        band(bm, lo, hi)
    bm.faces.new(rings[0])          # tip face (normals are recalculated at the end)
    bm.faces.new(rings[-1][::-1])   # cable end
    return new_body_object(bm, "trs-plug")


def build_rj45_plug(plan: Plan) -> bpy.types.Object:
    """RJ45 plug: a w x h x d box (centred on x and y, mating face at z = 0) with a latch step on the +Y side
    (the top is 1.5 mm lower from 60 % of the length to the far end) and eight contact slots in the mating face."""
    w, h, d = size_m(plan)
    step = RJ45_LATCH_STEP_MM * MM
    z_step = d * RJ45_LATCH_START
    slot_w = RJ45_SLOT_WIDTH_MM * MM
    slot_h = RJ45_SLOT_HEIGHT_MM * MM
    slot_depth = RJ45_SLOT_DEPTH_MM * MM
    pitch = RJ45_SLOT_PITCH_MM * MM
    if step >= h / 2.0:
        raise BuildError(f"sizeMm.h ({h / MM:.2f}) is too small for the latch step")
    if (RJ45_SLOTS - 1) * pitch + slot_w >= w or slot_depth >= z_step:
        raise BuildError("the box is too small for the eight contact slots")

    x0, x1 = -w / 2.0, w / 2.0
    y0, y1 = -h / 2.0, h / 2.0
    # Side profile (z, y), going round from the mating-face top: the latch step is on the +Y side.
    profile = [(0.0, y1), (0.0, y0), (d, y0), (d, y1 - step), (z_step, y1 - step), (z_step, y1)]
    bm = bmesh.new()
    left = [bm.verts.new(g2b(x0, y, z)) for z, y in profile]
    right = [bm.verts.new(g2b(x1, y, z)) for z, y in profile]
    n = len(profile)
    bm.faces.new(left)
    bm.faces.new(right[::-1])
    for i in range(1, n):       # edge 0 (i = 0 -> 1) is the mating face, filled below around the slots
        j = (i + 1) % n
        bm.faces.new((left[i], right[i], right[j], left[j]))
    # Mating face: its outline plus eight rectangular slot rings, filled as one region with holes.
    fill_edges = [bm.edges.get((left[0], left[1])), bm.edges.get((left[1], right[1])),
                  bm.edges.get((right[1], right[0])), bm.edges.get((right[0], left[0]))]
    y_lo = y0 + RJ45_SLOT_BOTTOM_MM * MM
    for k in range(RJ45_SLOTS):
        cx = (k - (RJ45_SLOTS - 1) / 2.0) * pitch
        corners = [(cx - slot_w / 2.0, y_lo), (cx + slot_w / 2.0, y_lo), (cx + slot_w / 2.0, y_lo + slot_h), (cx - slot_w / 2.0, y_lo + slot_h)]
        top = [bm.verts.new(g2b(x, y, 0.0)) for x, y in corners]
        bottom = [bm.verts.new(g2b(x, y, slot_depth)) for x, y in corners]
        band(bm, top, bottom)
        bm.faces.new(bottom[::-1])
        fill_edges += [bm.edges.get((top[i], top[(i + 1) % 4])) for i in range(4)]
    result = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=fill_edges, normal=g2b(0.0, 0.0, -1.0))
    if not result["geom"]:
        raise BuildError("could not fill the mating face around the contact slots")
    return new_body_object(bm, "rj45-plug")


def build_rack_box(plan: Plan) -> bpy.types.Object:
    """Plain box w x h x d, centred on x and z with its bottom at y = 0, every edge chamfered by chamferMm (one segment).
    No panel inset and no ear flanges in wave 1: ports sit on the bounding-box face (2026-10-29 spec 4.5)."""
    w, h, d = size_m(plan)
    chamfer = param_m(plan, "chamferMm", DEFAULT_CHAMFER_MM)
    if chamfer >= min(w, h, d) / 2.0:
        raise BuildError(f"params.chamferMm ({chamfer / MM:.2f}) must be smaller than half the smallest side ({min(w, h, d) / 2.0 / MM:.2f})")

    bm = bmesh.new()
    corners = [(sx * w / 2.0, y, sz * d / 2.0) for y in (0.0, h) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    v = [bm.verts.new(g2b(*c)) for c in corners]
    for q in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([v[i] for i in q])
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=chamfer, offset_type="OFFSET", segments=1, affect="EDGES")
    return new_body_object(bm, "rack-box")


# One entry per shape of tools/assets3d/shapes.ts (a test compares the two lists).
SHAPES: dict[str, Callable[[Plan], bpy.types.Object]] = {
    "cylinder-plug": build_cylinder_plug,
    "trs-plug": build_trs_plug,
    "rj45-plug": build_rj45_plug,
    "rack-box": build_rack_box,
}


# --- scene and export -------------------------------------------------------------------------------------

def wipe_scene() -> None:
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(block):
            block.remove(item)
    if len(bpy.data.objects) != 0:
        raise BuildError("the factory scene could not be wiped")


def export_glb(dst: str) -> None:
    """Exports with the options this Blender version has; fails clearly if a required one is missing."""
    available = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    required = {"export_format": "GLB", "export_yup": True}
    optional = {"use_selection": False, "export_cameras": False, "export_lights": False, "export_animations": False}
    missing = [k for k in required if k not in available]
    if missing:
        raise BuildError(f"this Blender's glTF exporter lacks the options {missing} (GLB / +Y up)")
    kwargs: dict[str, Any] = {"filepath": dst, **required}
    kwargs.update({k: v for k, v in optional.items() if k in available})
    result = bpy.ops.export_scene.gltf(**kwargs)
    if "FINISHED" not in result:
        raise BuildError(f"the glTF exporter did not finish ({result})")


def run() -> None:
    args = parse_args()
    try:
        with open(args["plan"], encoding="utf-8") as f:
            plan: Plan = json.load(f)
    except (OSError, ValueError) as exc:
        raise BuildError(f"cannot read the plan {args['plan']}: {exc}") from exc
    shape = plan.get("shape")
    builder = SHAPES.get(shape) if isinstance(shape, str) else None
    if builder is None:
        raise BuildError(f"unknown shape {shape!r} (known: {', '.join(sorted(SHAPES))})")
    wipe_scene()
    builder(plan)
    export_glb(args["out"])
    log(f"{plan.get('id')}: built {shape}")


def main() -> None:
    try:
        run()
    except BuildError as exc:
        sys.stderr.write(f"BUILD_FAIL {exc}\n")
        sys.stderr.flush()
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 - every failure must exit non-zero with one clear line
        traceback.print_exc()
        sys.stderr.write(f"BUILD_FAIL unexpected {type(exc).__name__}: {exc}\n")
        sys.stderr.flush()
        sys.exit(1)


main()
