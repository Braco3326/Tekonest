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
    raise BuildError("shape 'trs-plug' is not implemented yet")


def build_rj45_plug(plan: Plan) -> bpy.types.Object:
    raise BuildError("shape 'rj45-plug' is not implemented yet")


def build_rack_box(plan: Plan) -> bpy.types.Object:
    raise BuildError("shape 'rack-box' is not implemented yet")


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
