"""fixup.py - Blender fix-up of one raw GLB for the TekPractice 3D pipeline (Task 7).

Called by tools/assets3d/runFixup.ts, headless:

  blender --background --factory-startup --python-exit-code 1 --python fixup.py -- \
      --in <raw.glb> --out <fixed.glb> --plan <plan.json> --report <report.json>

plan.json (written by Node): {id, kind, yawDeg, placement, extras}. The placement is in GLB file space
(glTF: +Y up, right-handed, metres, the 'io' face at z=+d/2). Blender is Z-up, so a glTF point or direction
(x, y, z) is authored here at (x, -z, y); the exporter with export_yup=True converts back, so the exported
positions equal the placement.

Steps, in order:
  1. wipe the factory scene (Cube, Camera, Light, the default collection, orphan data)
  2. import the GLB, bake every mesh's world transform into its vertices, join all meshes into one
  3. clean: merge by distance, fill holes, recalculate normals; keep one material on every face
  4. rotate by the best of the 24 proper 90-degree rotations so the extents match the spec's (w, h, d), then by
     yawDeg about glTF +Y (a human picks the I/O side from the contact sheet)
  5. measure the pre-scale size (spec axis order), scale non-uniformly to the exact spec size
  6. pivot: device = bottom-centre (glTF min y = 0, centre x, z = 0); connector = centre of the mating face,
     body along glTF +Z (min z = 0, centre x, y = 0)
  7. socket recess: a 2 mm deep boolean cylinder per port that has openingM (a failure is logged, not fatal)
  8. one root Empty named <id> parenting the mesh, the port_<id> and ctrl_<id> empties; extras under
     the custom property 'tekpractice' on the root
  9. export GLB (+Y up, custom properties, no cameras or lights), re-read the file and check it, write report.json

report.json: {preScaleSizeM: {w, h, d}, scaleApplied: [x, y, z], rotatedDegrees}. On any failure the script
prints one line 'FIXUP_FAIL <reason>' to stderr and exits 1. Nothing is rejected on proportions here: the
orchestrator evaluates the drift gate from preScaleSizeM.
"""
from __future__ import annotations

import itertools
import json
import math
import re
import struct
import sys
import traceback
from typing import Any

import bmesh
import bpy
from mathutils import Matrix, Vector

RECESS_DEPTH_M = 0.002
RECESS_PROTRUDE_M = 0.001
RECESS_SEGMENTS = 24
MERGE_FRACTION = 1e-5
POS_TOL_M = 1e-5
BBOX_TOL_M = 1e-6
SUFFIX = re.compile(r"\.\d{3}$")

Mat3 = list[list[float]]
Vec3 = tuple[float, float, float]


class FixupError(Exception):
    """A failure with a message meant for the user (one line)."""


def log(msg: str) -> None:
    print(f"FIXUP {msg}", flush=True)


def parse_args() -> dict[str, str]:
    if "--" not in sys.argv:
        raise FixupError("no '--' in the command line: pass --in, --out, --plan, --report after it")
    argv = sys.argv[sys.argv.index("--") + 1:]
    if len(argv) % 2 != 0:
        raise FixupError(f"arguments after '--' must be --flag value pairs, got {argv}")
    args = {argv[i].lstrip("-"): argv[i + 1] for i in range(0, len(argv), 2)}
    for key in ("in", "out", "plan", "report"):
        if key not in args:
            raise FixupError(f"missing --{key}")
    return args


# --- glTF <-> Blender axes -------------------------------------------------------------------------------

def g2b(v: Any) -> Vector:
    """glTF point or direction (x, y, z) -> Blender (x, -z, y)."""
    return Vector((float(v[0]), -float(v[2]), float(v[1])))


# glTF -> Blender change of basis: v_b = C v_g.
C_G2B: Mat3 = [[1.0, 0.0, 0.0], [0.0, 0.0, -1.0], [0.0, 1.0, 0.0]]


def mat_mul(a: Mat3, b: Mat3) -> Mat3:
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def transpose(a: Mat3) -> Mat3:
    return [[a[j][i] for j in range(3)] for i in range(3)]


def det(a: Mat3) -> float:
    return (a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
            - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
            + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]))


def angle_deg(r: Mat3) -> float:
    """Rotation angle of a proper rotation matrix, degrees in [0, 180]."""
    c = max(-1.0, min(1.0, (r[0][0] + r[1][1] + r[2][2] - 1.0) / 2.0))
    return math.degrees(math.acos(c))


def to_matrix4(r: Mat3) -> Matrix:
    return Matrix((
        (r[0][0], r[0][1], r[0][2], 0.0),
        (r[1][0], r[1][1], r[1][2], 0.0),
        (r[2][0], r[2][1], r[2][2], 0.0),
        (0.0, 0.0, 0.0, 1.0),
    ))


def proper_rotations() -> list[Mat3]:
    """The 24 signed permutation matrices with determinant +1."""
    out: list[Mat3] = []
    for perm in itertools.permutations(range(3)):
        for signs in itertools.product((1.0, -1.0), repeat=3):
            m = [[0.0] * 3 for _ in range(3)]
            for i in range(3):
                m[i][perm[i]] = signs[i]
            if det(m) > 0:
                out.append(m)
    return out


def yaw_matrix(deg: int) -> Mat3:
    """Rotation about glTF +Y by a multiple of 90 degrees (exact integers, no float noise)."""
    c, s = {0: (1.0, 0.0), 90: (0.0, 1.0), 180: (-1.0, 0.0), 270: (0.0, -1.0)}[deg]
    return [[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]]


def drift_score(ext: Vec3, spec: Vec3) -> float:
    """Scale-invariant mismatch of two size vectors: variance of the log ratios (0 = same proportions)."""
    logs = [math.log(ext[i] / spec[i]) for i in range(3)]
    mean = sum(logs) / 3.0
    return sum((v - mean) ** 2 for v in logs)


def choose_rotation(ext_g: Vec3, spec_g: Vec3) -> Mat3:
    """Best of the 24 rotations for the extents; ties go to the smallest rotation angle (identity first)."""
    best: Mat3 | None = None
    best_key = (math.inf, math.inf)
    for r in proper_rotations():
        rotated = tuple(sum(abs(r[i][j]) * ext_g[j] for j in range(3)) for i in range(3))
        key = (round(drift_score(rotated, spec_g), 9), round(angle_deg(r), 6))
        if key < best_key:
            best, best_key = r, key
    assert best is not None
    return best


# --- scene -------------------------------------------------------------------------------------------------

def wipe_scene() -> None:
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(block):
            block.remove(item)
    if len(bpy.data.objects) != 0:
        raise FixupError("the factory scene could not be wiped")


def bbox_b(me: bpy.types.Mesh) -> tuple[Vector, Vector]:
    """Axis-aligned bounds of a mesh's vertices (Blender space, the object has an identity transform)."""
    if len(me.vertices) == 0:
        raise FixupError("the mesh has no vertices")
    lo = Vector((math.inf, math.inf, math.inf))
    hi = Vector((-math.inf, -math.inf, -math.inf))
    for v in me.vertices:
        for k in range(3):
            lo[k] = min(lo[k], v.co[k])
            hi[k] = max(hi[k], v.co[k])
    return lo, hi


def extents_g(me: bpy.types.Mesh) -> Vec3:
    """Extents in glTF order (x, y, z) = Blender (x, z, y)."""
    lo, hi = bbox_b(me)
    e = hi - lo
    return (e.x, e.z, e.y)


def import_and_join(src: str, name: str) -> tuple[bpy.types.Object, bpy.types.Material | None]:
    """Imports the GLB, bakes world transforms, joins every mesh into one object `name` at identity."""
    result = bpy.ops.import_scene.gltf(filepath=src)
    if "FINISHED" not in result:
        raise FixupError(f"the glTF importer did not finish ({result}) for {src}")
    bpy.context.view_layer.update()

    meshes = [ob for ob in bpy.data.objects if ob.type == "MESH"]
    if not meshes:
        raise FixupError("the imported model has no mesh")

    material = None
    for ob in meshes:
        for slot in ob.material_slots:
            if slot.material is not None:
                material = slot.material
                break
        if material is not None:
            break

    worlds = [ob.matrix_world.copy() for ob in meshes]
    bm = bmesh.new()
    for ob, mw in zip(meshes, worlds):
        # A mirrored world matrix flips the winding; recalc_face_normals in clean_mesh fixes it.
        tmp = ob.data.copy()
        tmp.transform(mw)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)

    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    for mat in list(bpy.data.materials):
        if material is None or mat.name != material.name:
            bpy.data.materials.remove(mat)

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(body)
    return body, material


def clean_mesh(me: bpy.types.Mesh) -> None:
    """Merge by distance (relative to the model size), fill holes, recalculate normals."""
    size = max(extents_g(me))
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=max(size * MERGE_FRACTION, 1e-9))
    bmesh.ops.holes_fill(bm, edges=list(bm.edges), sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    me.update()


def single_material(me: bpy.types.Mesh, material: bpy.types.Material | None) -> None:
    me.materials.clear()
    if material is not None:
        me.materials.append(material)
    me.polygons.foreach_set("material_index", [0] * len(me.polygons))
    me.update()


def cylinder_cutter(name: str, pos_g: Any, outward_g: Any, radius: float) -> bpy.types.Object:
    """A closed cylinder along the port's outward axis: 2 mm into the body, 1 mm out of it."""
    p = g2b(pos_g)
    n = g2b(outward_g).normalized()
    helper = Vector((0.0, 0.0, 1.0)) if abs(n.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    u = helper.cross(n).normalized()
    v = n.cross(u)
    bm = bmesh.new()
    rings = []
    for t in (-RECESS_DEPTH_M, RECESS_PROTRUDE_M):
        ring = []
        for k in range(RECESS_SEGMENTS):
            a = 2.0 * math.pi * k / RECESS_SEGMENTS
            ring.append(bm.verts.new(p + n * t + (u * math.cos(a) + v * math.sin(a)) * radius))
        rings.append(ring)
    low, high = rings
    for k in range(RECESS_SEGMENTS):
        j = (k + 1) % RECESS_SEGMENTS
        bm.faces.new((low[k], low[j], high[j], high[k]))
    bm.faces.new(list(reversed(low)))
    bm.faces.new(high)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def cut_recess(body: bpy.types.Object, port: dict[str, Any]) -> None:
    """Boolean difference of a cylinder at the port; any failure restores the mesh and is only logged."""
    original = body.data
    backup = original.copy()
    before = bbox_b(original)
    faces_before = len(original.polygons)
    cutter = None
    ok = False
    try:
        cutter = cylinder_cutter("recess_cutter", port["pos"], port["outward"], float(port["openingM"]) / 2.0)
        mod = body.modifiers.new(name="recess", type="BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = cutter
        try:
            mod.solver = "EXACT"
        except (TypeError, AttributeError):
            pass
        bpy.context.view_layer.objects.active = body
        body.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        after = bbox_b(body.data)
        same = all(abs(before[i][k] - after[i][k]) <= BBOX_TOL_M for i in range(2) for k in range(3))
        ok = same and len(body.data.polygons) > 0
        if not ok:
            log(f"recess for {port['name']} changed the bounds or emptied the mesh: reverted")
        elif len(body.data.polygons) == faces_before:
            log(f"recess for {port['name']} left the face count unchanged (nothing cut?)")
    except Exception as exc:  # noqa: BLE001 - a recess must never abort the asset (R3)
        log(f"recess for {port['name']} failed ({type(exc).__name__}: {exc}): skipped")
    finally:
        for m in list(body.modifiers):
            body.modifiers.remove(m)
        if cutter is not None:
            cutter_mesh = cutter.data
            bpy.data.objects.remove(cutter, do_unlink=True)
            bpy.data.meshes.remove(cutter_mesh)
    if ok:
        bpy.data.meshes.remove(backup)
        log(f"recess cut for {port['name']}")
    else:
        broken = body.data
        body.data = backup
        if broken.name != backup.name:
            bpy.data.meshes.remove(broken)


def new_empty(name: str, parent: bpy.types.Object | None, pos_g: Any, display: str, size: float) -> bpy.types.Object:
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = display
    ob.empty_display_size = size
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    ob.location = g2b(pos_g)
    if ob.name != name:
        raise FixupError(f"object name {name!r} came out as {ob.name!r} (a leftover holds the name)")
    return ob


# --- export and verification -------------------------------------------------------------------------------

def export_glb(dst: str) -> None:
    """Exports with the options this Blender version has; fails clearly if a required one is missing."""
    available = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    required = {"export_format": "GLB", "export_yup": True, "export_extras": True}
    optional = {"use_selection": False, "export_cameras": False, "export_lights": False, "export_animations": False}
    missing = [k for k in required if k not in available]
    if missing:
        raise FixupError(f"this Blender's glTF exporter lacks the options {missing} (GLB / +Y up / custom properties)")
    kwargs: dict[str, Any] = {"filepath": dst, **required}
    kwargs.update({k: v for k, v in optional.items() if k in available})
    log(f"export options {sorted(kwargs)}")
    result = bpy.ops.export_scene.gltf(**kwargs)
    if "FINISHED" not in result:
        raise FixupError(f"the glTF exporter did not finish ({result})")


def read_glb_json(path: str) -> dict[str, Any]:
    with open(path, "rb") as f:
        data = f.read()
    if len(data) < 20 or data[0:4] != b"glTF":
        raise FixupError(f"{path} is not a GLB")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise FixupError(f"{path}: first chunk is not JSON")
    return json.loads(data[20:20 + length].decode("utf-8"))


def close(a: Any, b: Any, tol: float = POS_TOL_M) -> bool:
    """Deep comparison of JSON values, numbers within `tol`."""
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(close(a[k], b[k], tol) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(close(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return abs(a - b) <= tol
    return a == b


def verify_export(path: str, plan: dict[str, Any]) -> None:
    """Re-reads the exported GLB: one root named <id> without transform, exact part names, extras, no cameras/lights."""
    gltf = read_glb_json(path)
    nodes = gltf.get("nodes", [])
    scene = gltf.get("scenes", [{}])[gltf.get("scene", 0)]
    roots = scene.get("nodes", [])
    if len(roots) != 1:
        raise FixupError(f"export has {len(roots)} top-level nodes, expected 1")
    root = nodes[roots[0]]
    if root.get("name") != plan["id"]:
        raise FixupError(f"export root is named {root.get('name')!r}, expected {plan['id']!r}")
    for key in ("translation", "rotation", "scale", "matrix"):
        if key in root:
            raise FixupError(f"export root carries a {key}: {root[key]}")
    if gltf.get("cameras") or "KHR_lights_punctual" in gltf.get("extensionsUsed", []):
        raise FixupError("export contains a camera or a light")

    names = [n.get("name", "") for n in nodes]
    suffixed = [n for n in names if SUFFIX.search(n)]
    if suffixed:
        raise FixupError(f"export node names carry a numeric suffix: {suffixed}")
    placement = plan["placement"]
    wanted = {p["name"]: p["pos"] for p in placement["ports"] + placement["controls"]}
    parts = sorted(n for n in names if n.startswith(("port_", "ctrl_")))
    if parts != sorted(wanted):
        raise FixupError(f"export part nodes {parts} differ from the placement {sorted(wanted)}")
    for n in nodes:
        if n.get("name") in wanted:
            got = n.get("translation", [0.0, 0.0, 0.0])
            if not close(got, wanted[n["name"]]):
                raise FixupError(f"{n['name']} exported at {got}, placement {wanted[n['name']]} (axis conversion?)")

    extras = root.get("extras", {}).get("tekpractice")
    if not close(extras, plan["extras"]):
        raise FixupError(f"export root extras.tekpractice {extras!r} differ from the plan's")


# --- main --------------------------------------------------------------------------------------------------

def run() -> None:
    args = parse_args()
    with open(args["plan"], encoding="utf-8") as f:
        plan = json.load(f)
    spec_id: str = plan["id"]
    kind: str = plan["kind"]
    yaw = int(plan.get("yawDeg", 0))
    if yaw not in (0, 90, 180, 270):
        raise FixupError(f"yawDeg must be 0, 90, 180 or 270, got {yaw}")
    placement = plan["placement"]
    size = placement["sizeM"]
    spec_g: Vec3 = (float(size["w"]), float(size["h"]), float(size["d"]))

    wipe_scene()
    body_name = f"{spec_id}-body"
    body, material = import_and_join(args["in"], body_name)
    me = body.data
    clean_mesh(me)
    single_material(me, material)

    raw = extents_g(me)
    if min(raw) <= 1e-9:
        raise FixupError(f"the imported model is flat or empty (extents {raw})")
    r_axis = choose_rotation(raw, spec_g)
    r_total_g = mat_mul(yaw_matrix(yaw), r_axis)
    r_total_b = mat_mul(mat_mul(C_G2B, r_total_g), transpose(C_G2B))
    me.transform(to_matrix4(r_total_b))
    rotated = round(angle_deg(r_total_g), 6)
    log(f"rotation {rotated} degrees (yaw {yaw}), raw extents {raw}")

    pre = extents_g(me)
    if min(pre) <= 1e-9:
        raise FixupError(f"the rotated model is flat (extents {pre})")
    scale_g = [spec_g[i] / pre[i] for i in range(3)]
    # glTF (x, y, z) scale -> Blender axes (x, y, z) = glTF (x, z, y).
    me.transform(Matrix((
        (scale_g[0], 0.0, 0.0, 0.0),
        (0.0, scale_g[2], 0.0, 0.0),
        (0.0, 0.0, scale_g[1], 0.0),
        (0.0, 0.0, 0.0, 1.0),
    )))

    lo, hi = bbox_b(me)
    centre = (lo + hi) / 2.0
    if kind == "device":
        shift = Vector((-centre.x, -centre.y, -lo.z))
    elif kind == "connector":
        # glTF min z = 0 is Blender max y = 0; centre glTF x, y = Blender x, z.
        shift = Vector((-centre.x, -hi.y, -centre.z))
    else:
        raise FixupError(f"unknown spec kind {kind!r}")
    me.transform(Matrix.Translation(shift))
    me.update()

    for port in placement["ports"]:
        if port.get("openingM"):
            cut_recess(body, port)
    me = body.data
    me.name = body_name
    single_material(me, material)

    root = bpy.data.objects.new(spec_id, None)
    bpy.context.scene.collection.objects.link(root)
    if root.name != spec_id:
        raise FixupError(f"root name {spec_id!r} came out as {root.name!r}")
    body.parent = root
    if body.name != body_name:
        raise FixupError(f"mesh object name {body_name!r} came out as {body.name!r}")
    for port in placement["ports"]:
        new_empty(port["name"], root, port["pos"], "PLAIN_AXES", 0.01)
    for ctrl in placement["controls"]:
        s = ctrl["sizeM"]
        new_empty(ctrl["name"], root, ctrl["pos"], "CUBE", max(s["w"], s["h"], s["d"]) / 2.0)

    root["tekpractice"] = plan["extras"]
    back = root["tekpractice"].to_dict()
    if not close(json.loads(json.dumps(back)), plan["extras"]):
        raise FixupError("the tekpractice custom property does not read back as the plan's extras")

    stray = [ob.name for ob in bpy.data.objects if ob.type in ("CAMERA", "LIGHT")]
    if stray:
        raise FixupError(f"cameras or lights left in the scene: {stray}")
    suffixed = [ob.name for ob in bpy.data.objects if SUFFIX.search(ob.name)]
    if suffixed:
        raise FixupError(f"object names carry a numeric suffix: {suffixed}")
    top = [ob.name for ob in bpy.data.objects if ob.parent is None]
    if top != [spec_id]:
        raise FixupError(f"top-level objects are {top}, expected only {spec_id!r}")

    export_glb(args["out"])
    verify_export(args["out"], plan)

    report = {
        "preScaleSizeM": {"w": pre[0], "h": pre[1], "d": pre[2]},
        "scaleApplied": scale_g,
        "rotatedDegrees": rotated,
    }
    with open(args["report"], "w", encoding="utf-8") as f:
        json.dump(report, f)
    log(f"OK {spec_id} pre-scale {pre} scale {scale_g} rotated {rotated}")


def main() -> None:
    try:
        run()
    except FixupError as exc:
        sys.stderr.write(f"FIXUP_FAIL {exc}\n")
        sys.stderr.flush()
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 - every failure must exit non-zero with one clear line
        traceback.print_exc()
        sys.stderr.write(f"FIXUP_FAIL unexpected {type(exc).__name__}: {exc}\n")
        sys.stderr.flush()
        sys.exit(1)


main()
