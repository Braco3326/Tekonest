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
('tekpractice-body', no textures), fixed object and mesh names. It is deterministic: bmesh only (no boolean modifiers),
no randomness, no timestamps.

Look (research report 2026-11-04, "Wave 1 model reference geometry"): the single material carries a per-face-corner
vertex colour (COLOR_0 in the GLB), so black plastic, nickel and gold are told apart without a second material.
Smooth shading with sharp edges above 40 degrees gives round barrels and crisp rims. Metallic 0.25 and roughness 0.45
because the game scene has no environment texture (a high metallic renders near black there); the metal look is carried by
the base colour. Parts are built one after the other and coloured with Body.done(<sRGB hex>).

On any failure the script prints one line 'BUILD_FAIL <reason>' to stderr and exits 1.
"""
from __future__ import annotations

import json
import math
import os
import sys
import traceback
from typing import Any, Callable

import bmesh
import bpy
from mathutils import Matrix, Vector

MM = 0.001
SEGMENTS = 32
MATERIAL_NAME = "tekpractice-body"
COLOUR_ATTRIBUTE = "Col"
SHARP_ANGLE_DEG = 40.0
METALLIC = 0.25
ROUGHNESS = 0.45

# Part colours, sRGB hex (research report: tuned to read under the game's two lights, no environment texture).
NICKEL = "#c9ccd0"
BLACK = "#3a3a40"
DARK = "#141417"
GOLD = "#d4af37"
# Yamaha stage box (research report, "Rio3224-D2"): slate-blue panel, black ears and chassis. All palette values are
# LIFTED: the creation scene lights vertical faces with about a quarter of the fill + key (hemispheric 0.5 from above, key 0.5),
# so a colour that is right on the real part renders near black there. Checked in Babylon with those lights.
SLATE = "#8398b8"
PLATE_IN = "#66738c"
PLATE_OUT = "#525b70"
CHASSIS = "#545661"
EAR = "#383840"
BEZEL = "#34343b"
LCD = "#2e4352"
STEEL = "#b4b8c0"
INLET = "#4a4c55"
PALE = "#b4cfe0"  # the clear RJ45 housing, drawn as an opaque pale blue-grey

DEFAULT_FRONT_LEN_MM = 12.0
XLR_SEGMENTS = 20             # a multiple of 4 so the box is exact; 20 keeps the profile near 700 triangles
XLR_SHELL_RADIUS_MM = 9.6     # the 19.2 mm nickel shell

DEFAULT_CHAMFER_MM = 1.0
REVOLVE_SEGMENTS = 32         # revolve: round enough for a mic head at close range, 34 stations stay near 2200 triangles
REVOLVE_LIFT = 3.0            # spec colours are real-part colours; lifted for the creation scene (see lift_hex)
REVOLVE_LIFT_CAP = 0.85
REVOLVE_DEFAULT_COLOUR = "#8a8a90"
EAR_RECESS = 0.05 * MM          # the ear face sits this far behind the panel plane
BEZEL_SEGMENTS = 10           # 52 connector bezels: 10 sides keep the stage box inside the 4000-triangle hero budget

# trs-plug: 16 segments keep the 23-point profile inside the 800-triangle connector budget (about 700).
TRS_SEGMENTS = 16
DEFAULT_BARREL_MM = 30.5

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


class Body:
    """A bmesh made of parts. Each finished part gets one sRGB colour (Body.done), written as a vertex colour."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.bm = bmesh.new()
        self.tag = self.bm.faces.layers.int.new("part")
        self.colours: list[str] = [""]  # index 0 = not coloured yet

    def done(self, colour: str) -> None:
        """Gives every face that has no colour yet the sRGB hex `colour` (the part just built)."""
        self.colours.append(colour)
        for f in self.bm.faces:
            if f[self.tag] == 0:
                f[self.tag] = len(self.colours) - 1

    def finish(self) -> bpy.types.Object:
        """Colours the corners, makes it one smooth-shaded object with the one material. Raises on an uncoloured face."""
        bm = self.bm
        if any(f[self.tag] == 0 for f in bm.faces):
            raise BuildError(f"{self.name}: a part was built without Body.done(colour)")
        # Every part must be a closed solid: an open edge means a missing face, which recalculated normals and the
        # fix-up's hole filling would hide or patch differently from what was built.
        open_edges = [e for e in bm.edges if len(e.link_faces) == 1]
        if open_edges:
            raise BuildError(f"{self.name}: {len(open_edges)} open edges: a part is not a closed solid")
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        layer = bm.loops.layers.float_color.new(COLOUR_ATTRIBUTE)
        linear = [srgb_hex_to_linear(c) if c else (0.5, 0.5, 0.5) for c in self.colours]
        for f in bm.faces:
            rgb = linear[f[self.tag]]
            for loop in f.loops:
                loop[layer] = (rgb[0], rgb[1], rgb[2], 1.0)
        bm.faces.layers.int.remove(self.tag)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        # Smooth faces, hard edges where the surface turns by more than 40 degrees (Blender 4.1+ replaced auto-smooth).
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(SHARP_ANGLE_DEG))
        # After every to_mesh: without an active colour attribute the exporter writes a fake white COLOR_0.
        attr = me.color_attributes[COLOUR_ATTRIBUTE]
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = list(me.color_attributes).index(attr)
        me.materials.append(make_material())
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def srgb_hex_to_linear(hexcolour: str) -> tuple[float, float, float]:
    """'#rrggbb' (sRGB) -> linear floats (Blender and glTF vertex colours are linear)."""
    text = hexcolour.lstrip("#")
    if len(text) != 6:
        raise BuildError(f"colour {hexcolour!r} must be #rrggbb")
    out = []
    for i in range(3):
        c = int(text[2 * i:2 * i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2])


def make_material() -> bpy.types.Material:
    """The one material: Principled BSDF whose base colour is the vertex colour (a Color Attribute node)."""
    mat = bpy.data.materials.new(MATERIAL_NAME)
    mat.use_backface_culling = True
    if mat.node_tree is None:
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    colour = nodes.new("ShaderNodeVertexColor")
    colour.layer_name = COLOUR_ATTRIBUTE
    mat.node_tree.links.new(colour.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = METALLIC
    bsdf.inputs["Roughness"].default_value = ROUGHNESS
    return mat


def revolve(body: Body, profile: list[tuple[float, float]], colours: list[str], n: int = SEGMENTS, cap_first: bool = False, cap_last: bool = False, cy: float = 0.0) -> list[list[bmesh.types.BMVert]]:
    """Lathe about the glTF z axis. `profile` is (radius, z) points, `colours` one sRGB hex per band between points.

    `cap_first` / `cap_last` close the open end with a flat face; every band and each cap is coloured as it is built, so a
    cap takes the colour of its neighbouring band. `cy` moves the axis along y. Returns the rings (an open end can be
    filled by the caller, e.g. around holes).
    """
    if len(colours) != len(profile) - 1:
        raise BuildError("revolve needs one colour per band")
    rings = [ring(body.bm, r, z, n, 0.0, cy) for r, z in profile]
    if cap_first:
        body.bm.faces.new(rings[0])
        body.done(colours[0])
    for i in range(len(rings) - 1):
        band(body.bm, rings[i], rings[i + 1])
        body.done(colours[i])
    if cap_last:
        body.bm.faces.new(rings[-1][::-1])
        body.done(colours[-1])
    return rings


def extrude_zy(bm: bmesh.types.BMesh, pts: list[tuple[float, float]], x0: float, x1: float) -> list[bmesh.types.BMFace]:
    """A prism: the polygon `pts` of (z, y) points (glTF space) extruded along x from x0 to x1. Returns its faces."""
    left = [bm.verts.new(g2b(x0, y, z)) for z, y in pts]
    right = [bm.verts.new(g2b(x1, y, z)) for z, y in pts]
    faces = [bm.faces.new(left), bm.faces.new(right[::-1])]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((left[i], right[i], right[j], left[j])))
    return faces


def extrude_xy(bm: bmesh.types.BMesh, pts: list[tuple[float, float]], z0: float, z1: float) -> list[bmesh.types.BMFace]:
    """A prism: the polygon `pts` of (x, y) points (glTF space) extruded along z from z0 to z1. Returns its faces."""
    back = [bm.verts.new(g2b(x, y, z0)) for x, y in pts]
    front = [bm.verts.new(g2b(x, y, z1)) for x, y in pts]
    faces = [bm.faces.new(back[::-1]), bm.faces.new(front)]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((back[i], back[j], front[j], front[i])))
    return faces


def extrude_xz(bm: bmesh.types.BMesh, pts: list[tuple[float, float]], y0: float, y1: float) -> list[bmesh.types.BMFace]:
    """A prism: the polygon `pts` of (x, z) points (glTF space, the plan seen from above) extruded along y from y0 to y1. Returns its faces."""
    low = [bm.verts.new(g2b(x, y0, z)) for x, z in pts]
    high = [bm.verts.new(g2b(x, y1, z)) for x, z in pts]
    faces = [bm.faces.new(low[::-1]), bm.faces.new(high)]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((low[i], low[j], high[j], high[i])))
    return faces


def box(bm: bmesh.types.BMesh, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float) -> list[bmesh.types.BMFace]:
    """An axis-aligned box in glTF space (12 triangles)."""
    return extrude_zy(bm, [(z0, y0), (z1, y0), (z1, y1), (z0, y1)], x0, x1)


def blind_hole(bm: bmesh.types.BMesh, cx: float, cy: float, z: float, radius: float, n: int, depth: float, sign: float) -> list[bmesh.types.BMEdge]:
    """A round hole whose mouth ring is at height z and whose floor is `depth` away along sign (+1: toward +z).

    Builds the wall and the floor and returns the mouth's edges, which the face around the hole is then filled against
    (fill_with_holes)."""
    mouth = ring(bm, radius, z, n, cx, cy)
    floor = ring(bm, radius, z + sign * depth, n, cx, cy)
    band(bm, mouth, floor)
    bm.faces.new(floor[::-1])
    return [bm.edges.get((mouth[i], mouth[(i + 1) % n])) for i in range(n)]


def rect_hole(bm: bmesh.types.BMesh, x0: float, x1: float, y0: float, y1: float, z: float, depth: float, sign: float) -> tuple[list[bmesh.types.BMEdge], list[bmesh.types.BMVert]]:
    """A rectangular hole: wall faces now, mouth edges and floor vertices returned (the floor face is made by the caller,
    so that walls and floor can take different colours)."""
    mouth = [bm.verts.new(g2b(x, y, z)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    floor = [bm.verts.new(g2b(x, y, z + sign * depth)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    band(bm, mouth, floor)
    return [bm.edges.get((mouth[i], mouth[(i + 1) % 4])) for i in range(4)], floor


def take_face(bm: bmesh.types.BMesh, z: float) -> list[bmesh.types.BMEdge]:
    """Removes the one face lying in the plane z (glTF) and returns its edges, to be refilled around holes."""
    found = [f for f in bm.faces if all(abs(-v.co.y - z) < 1e-9 for v in f.verts)]
    if len(found) != 1:
        raise BuildError(f"expected one face in the plane z = {z / MM:.2f} mm, found {len(found)}")
    edges = list(found[0].edges)
    bmesh.ops.delete(bm, geom=found, context="FACES_ONLY")
    return edges


def fill_with_holes(bm: bmesh.types.BMesh, outline: list[bmesh.types.BMEdge], holes: list[list[bmesh.types.BMEdge]], normal_g: tuple[float, float, float]) -> None:
    """Fills the planar region bounded by `outline` (edges) minus the loops `holes` with triangles."""
    edges = list(outline)
    for hole in holes:
        edges += hole
    if any(e is None for e in edges):
        raise BuildError("fill_with_holes: an outline edge does not exist")
    result = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=g2b(*normal_g))
    if not result["geom"]:
        raise BuildError("could not fill a face around its holes")


def bevel_faces(bm: bmesh.types.BMesh, faces: list[bmesh.types.BMFace], width: float) -> None:
    """One-segment chamfer of every edge of `faces` (the part just built), `width` metres."""
    edges = list(dict.fromkeys(e for f in faces for e in f.edges))  # first-seen order: no set, no memory-address ordering
    bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type="OFFSET", segments=1, affect="EDGES")


# --- shapes -----------------------------------------------------------------------------------------------

def xlr_pins_mm(count: int) -> list[tuple[float, float]]:
    """Pin centres (x, y) in mm around the axis, seen from the mating face: the 3-pole layout measured on the Neutrik NC3 drawing (pins 2 and 1 left and
    right, pin 3 below), and a 5-pole arc of 5 pins 45 degrees apart on a 4.6 mm radius over the lower half (the key and latch are on the top)."""
    if count == 3:
        return [(-4.05, 0.0), (4.05, 0.0), (0.0, -3.95)]
    if count == 5:
        return [(4.6 * math.sin(math.radians(a)), -4.6 * math.cos(math.radians(a))) for a in (-90.0, -45.0, 0.0, 45.0, 90.0)]
    raise BuildError(f"params.pins must be 3 or 5, got {count}")


def build_cylinder_plug(plan: Plan) -> bpy.types.Object:
    """3-pole female XLR cable plug (generic, Neutrik-NC3FXX-class proportions), mating face at z = 0.

    Revolved profile, front to back: dark front insert (diameter `matingOuterMm`, length `frontLenMm`), a cone out to the
    19.2 mm nickel shell, then the black bushing (the widest part, w / 2) with one groove, the tapering boot and the tail
    at z = d. A nickel latch lug sits on the +Y side of the shell and rises above the bushing, which is why the spec box is
    about 20.3 x 21.0 mm and the axis sits 0.35 mm below the box centre (the fix-up centres the box). The mating face
    carries the real pin layout (pin 2 and pin 1 left and right, pin 3 below) and a key slot at 12 o'clock.

    Verified (Neutrik drawing): shell 19.2, insert 15.75, length. Derived from one DXF parse: bushing, boot, lug, pin
    positions. Estimated: hole and slot depth, rear boot. Dimensions only, no vendor geometry or branding."""
    w, h, d = size_m(plan)
    mm = MM
    bushing_r = w / 2.0
    shell_r = XLR_SHELL_RADIUS_MM * mm
    front_r = positive(plan.get("matingOuterMm"), "matingOuterMm") * mm / 2.0
    front_len = param_m(plan, "frontLenMm", DEFAULT_FRONT_LEN_MM)
    if bushing_r <= shell_r + 0.2 * mm:
        raise BuildError(f"sizeMm.w ({w / mm:.2f}) must be wider than the 19.2 mm shell: the bushing and the latch lug are part of the box (about 20.3 mm)")
    if front_r >= shell_r - 0.5 * mm or front_len < 8.0 * mm or front_len + 2.5 * mm >= 30.0 * mm:
        raise BuildError("matingOuterMm / params.frontLenMm do not fit inside the shell")
    if d < 60.0 * mm:
        raise BuildError(f"sizeMm.d ({d / mm:.2f}) is too short for an XLR plug (needs at least 60 mm)")
    lug_top = h - bushing_r          # lug top above the axis (the bbox is bushing_r below the axis and lug_top above it)
    if lug_top <= bushing_r + 0.3 * mm or lug_top > bushing_r + 3.0 * mm:
        raise BuildError(f"sizeMm.h ({h / mm:.2f}) does not match a latch lug 0.3 to 3 mm above the bushing")
    axis_y = bushing_r - h / 2.0     # the axis sits this far from the box centre (negative: below)

    chamfer = 0.4 * mm
    profile: list[tuple[float, float]] = [
        (front_r - chamfer, 0.0),              # mating face edge
        (front_r, chamfer),
        (front_r, front_len),                  # front insert
        (shell_r, front_len + 2.5 * mm),       # shoulder cone out to the shell
        (shell_r, 30.0 * mm),                  # nickel shell
        (bushing_r, 36.0 * mm),                # bushing ramp
        (bushing_r, 43.0 * mm),
        (bushing_r - 1.25 * mm, 43.0 * mm),    # the one groove
        (bushing_r - 1.25 * mm, 44.2 * mm),
        (bushing_r, 44.2 * mm),
        (bushing_r, 47.0 * mm),
        (bushing_r - 1.95 * mm, d - 10.5 * mm),  # boot cone
        (bushing_r - 2.75 * mm, d),            # tail
    ]
    colours = [BLACK, BLACK, NICKEL, NICKEL, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK, BLACK]
    body = Body("xlr-plug")
    bm = body.bm
    rings = revolve(body, profile, colours, XLR_SEGMENTS, cap_last=True, cy=axis_y)

    # Mating face: the outer ring filled around three pin holes and the key slot.
    outline = [bm.edges.get((rings[0][i], rings[0][(i + 1) % XLR_SEGMENTS])) for i in range(XLR_SEGMENTS)]
    holes = []
    for px, py in xlr_pins_mm(int((plan.get("params") or {}).get("pins", 3))):
        holes.append(blind_hole(bm, px * mm, axis_y + py * mm, 0.0, 1.25 * mm, 8, 3.0 * mm, 1.0))
    key_mouth, key_floor = rect_hole(bm, -2.3 * mm, 2.3 * mm, axis_y + 2.4 * mm, axis_y + 6.0 * mm, 0.0, 2.5 * mm, 1.0)
    holes.append(key_mouth)
    bm.faces.new(key_floor[::-1])
    body.done(DARK)
    fill_with_holes(bm, outline, holes, (0.0, 0.0, -1.0))
    body.done(BLACK)

    # Latch lug on +Y: a trapezoid section (6.3 wide at the base, 2.3 on top) rising from 10.0 mm at the front to the top
    # of the box at the cable-side end (z = 24 mm); its base is sunk into the shell.
    base_y = axis_y + 8.9 * mm
    z_front, z_back = front_len + 2.5 * mm, 24.0 * mm   # starts where the shoulder cone meets the shell
    sections = []
    for z, top_y in ((z_front, axis_y + 10.0 * mm), (z_back, axis_y + lug_top)):
        sections.append([bm.verts.new(g2b(x, y, z)) for x, y in ((-3.15 * mm, base_y), (3.15 * mm, base_y), (1.15 * mm, top_y), (-1.15 * mm, top_y))])
    band(bm, sections[0], sections[1])
    bm.faces.new(sections[0])
    bm.faces.new(sections[1][::-1])
    body.done(NICKEL)
    return body.finish()


def build_xlr_male_plug(plan: Plan) -> bpy.types.Object:
    """XLR male cable plug (Neutrik NC3MXX / NC5MXX class), mating face at z = 0, cable at z = d, axis on the box centre.

    A 19 mm nickel shell, hollow for 14 mm with the pin insulator at the bottom of the bore and `pins` (3 or 5) gold pins standing 10.5 mm
    out of it, then a bushing (the box width), the boot cone and the tail. Verified: 19 mm shell, 68.1 to 70.1 mm length (Neutrik data via
    retail listings), STEP bounding box 20.33 x 20.33 x 69.64 mm. Estimated: bore depth, pin diameter and length, boot shape."""
    w, h, d = size_m(plan)
    mm = MM
    pins = int((plan.get("params") or {}).get("pins", 3))
    bushing_r = min(w, h) / 2.0
    shell_r = XLR_SHELL_RADIUS_MM * mm - 0.1 * mm          # 19.0 mm shell
    bore_r = 7.95 * mm
    bore_depth = 14.0 * mm
    if bushing_r <= shell_r + 0.2 * mm:
        raise BuildError(f"sizeMm.w/h ({bushing_r * 2 / mm:.2f}) must be wider than the 19 mm shell")
    if d < 60.0 * mm:
        raise BuildError(f"sizeMm.d ({d / mm:.2f}) is too short for an XLR plug (needs at least 60 mm)")
    profile: list[tuple[float, float]] = [
        (2.0 * mm, bore_depth),                # floor of the bore (a small disc)
        (bore_r, bore_depth),                  # floor out to the bore wall
        (bore_r, 0.0),                         # bore wall to the mating face
        (shell_r, 0.0),                        # the shell's front ring
        (shell_r, 30.0 * mm),                  # nickel shell
        (bushing_r, 36.0 * mm),                # bushing ramp
        (bushing_r, 47.0 * mm),
        (bushing_r - 1.95 * mm, d - 10.5 * mm),  # boot cone
        (bushing_r - 2.75 * mm, d),            # tail
    ]
    colours = [BLACK, BLACK, NICKEL, NICKEL, NICKEL, BLACK, BLACK, BLACK]
    body = Body("xlr-male-plug")
    revolve(body, profile, colours, XLR_SEGMENTS, cap_first=True, cap_last=True)
    for px, py in xlr_pins_mm(pins):
        cylinder_between(body.bm, g2b(px * mm, py * mm, bore_depth + 1.0 * mm), g2b(px * mm, py * mm, bore_depth - 10.5 * mm), 0.8 * mm, segments=8)
    body.done(GOLD)
    return body.finish()


def build_trs_plug(plan: Plan) -> bpy.types.Object:
    """6.35 mm TRS cable plug, from the tip (z = 0) to the cable: a pointed arrowhead tip with a neck and a bead,
    two thin black insulator bands between nickel tip, ring and sleeve (mating length `barrelMm`, default 30.5 as on real plugs), a conical nose into the
    handle shell, then a black boot that tapers toward the cable (z = d).

    Sourced: the diameters and the 30-31 mm mating length. The tip shape and the two insulator positions are read from the CC0
    Commons photo of a 6.35 mm TRS plug (not from the research report, whose estimates were off); the handle split of the
    93 mm is an estimate."""
    w, h, d = size_m(plan)
    body_r = min(w, h) / 2.0
    barrel_r = positive(plan.get("matingOuterMm"), "matingOuterMm") * MM / 2.0
    barrel_len = param_m(plan, "barrelMm", DEFAULT_BARREL_MM)
    if barrel_r >= body_r:
        raise BuildError(f"matingOuterMm ({barrel_r * 2000:.2f}) must be smaller than the body diameter ({body_r * 2000:.2f})")
    nose_len = 7.5 * MM
    boot_len = 23.5 * MM
    if barrel_len < 18.6 * MM or barrel_len + nose_len + boot_len + 8.0 * MM > d:
        # 18.6 mm: the second insulator band ends at 17.6 mm and the sleeve needs a little length after it
        raise BuildError(f"params.barrelMm ({barrel_len / MM:.2f}) does not fit a plug of sizeMm.d {d / MM:.2f} (needs 18.6 mm to about {(d - nose_len - boot_len - 8.0 * MM) / MM:.0f} mm)")

    r = barrel_r
    k = r / (3.175 * MM)             # the profile below is drawn for a 6.35 mm barrel; scale the radii to the spec's
    insulator_r = r - 0.1 * MM       # the black bands sit 0.1 mm below the metal, like the real insulators
    mm = MM
    shell_start = barrel_len + nose_len
    boot_start = d - boot_len
    # (radius, z from the tip). Measured by eye from the CC0 photo "Phone-connectors-labeled.jpg" (6.35 mm TRS plug,
    # ruler in frame): a pointed arrowhead tip, a narrow neck with a bead, then the barrel with the first black insulator
    # about 9.6 mm from the tip (1.6 mm wide) and the second about 16.7 mm (0.9 mm wide).
    profile: list[tuple[float, float]] = [
        (0.55 * mm * k, 0.0),            # small flat tip
        (2.65 * mm * k, 4.0 * mm),       # the arrowhead cone
        (2.65 * mm * k, 4.5 * mm),
        (1.75 * mm * k, 4.9 * mm),       # neck
        (1.75 * mm * k, 5.7 * mm),
        (2.45 * mm * k, 6.5 * mm),       # bead
        (2.50 * mm * k, 7.2 * mm),
        (r, 8.1 * mm),                   # barrel
        (r, 9.6 * mm),
        (insulator_r, 9.6 * mm),         # insulator 1
        (insulator_r, 11.2 * mm),
        (r, 11.2 * mm),                  # ring
        (r, 16.7 * mm),
        (insulator_r, 16.7 * mm),        # insulator 2
        (insulator_r, 17.6 * mm),
        (r, 17.6 * mm),                  # sleeve
        (r, barrel_len),
        (4.6 * mm, barrel_len),          # nose collar: a step, then a cone out to the shell
        (body_r, shell_start),
        (body_r, boot_start),            # shell
        (body_r * 0.925, boot_start),
        (body_r * 0.925, boot_start + 4.5 * mm),
        (body_r * 0.55, d),              # boot tapering to the cable
    ]
    colours = [
        NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL,   # tip, neck, bead, barrel
        BLACK, BLACK, BLACK, NICKEL, BLACK, BLACK, BLACK,                  # insulator 1, ring, insulator 2
        NICKEL, NICKEL, NICKEL, NICKEL,                                    # sleeve, nose, shell
        BLACK, BLACK, BLACK,                                               # boot
    ]
    body = Body("trs-plug")
    revolve(body, profile, colours, TRS_SEGMENTS, cap_first=True, cap_last=True)
    return body.finish()


def build_rj45_plug(plan: Plan) -> bpy.types.Object:
    """Bare RJ45 (8P8C) cable plug, mating face at z = 0, latch side +Y (research report, "RJ45 8P8C plug").

    The insertion part is 6.6 mm high (the contacts, 0.2 mm blades on the underside, are part of it) and the cable end
    rises to the full 8 mm; a thin hinged latch tab slopes up toward the rear between two guard shoulders, the cable hole
    is dark. Verified: overall size, 1.02 mm pitch, 6.60 mm insertion height. Estimated: latch, shoulders, rear block
    length, hole. One pale body colour stands for the clear housing, gold for the contacts."""
    w, h, d = size_m(plan)
    if w < 10.0 * MM or h < 7.0 * MM or d < 20.0 * MM:
        raise BuildError(f"an RJ45 plug needs sizeMm of at least 10 x 7 x 20 (got {w / MM:.2f} x {h / MM:.2f} x {d / MM:.2f})")
    mm = MM
    hw = w / 2.0
    y_top, y_bot = h / 2.0, -h / 2.0
    blade_t = 0.2 * mm
    front_bot = y_bot + blade_t
    front_top = y_top - 1.4 * mm          # 8.00 - 6.60: the insertion area is lower than the cable end
    z_rear = 15.5 * mm

    body = Body("rj45-plug")
    bm = body.bm
    main = extrude_zy(bm, [(0.0, front_bot), (z_rear, front_bot), (z_rear, y_bot), (d, y_bot), (d, y_top), (z_rear, y_top), (z_rear, front_top), (0.0, front_top)], -hw, hw)
    bevel_faces(bm, main, 0.15 * mm)  # smaller than the 0.2 mm underside step
    # The rear and front faces are rebuilt with their holes (cable entry, eight contact slots): drop the bevelled ones,
    # keep their boundary edges.
    rear_outline = take_face(bm, d)
    front_outline = take_face(bm, 0.0)
    body.done(PALE)
    hole = blind_hole(bm, 0.0, 0.0, d, 2.75 * mm, 8, 2.0 * mm, -1.0)
    body.done(DARK)
    fill_with_holes(bm, rear_outline, [hole], (0.0, 0.0, 1.0))
    body.done(PALE)
    slots: list[list[bmesh.types.BMEdge]] = []
    floors: list[list[bmesh.types.BMVert]] = []
    for i in range(8):
        cx = (i - 3.5) * 1.02 * mm
        mouth, floor = rect_hole(bm, cx - 0.31 * mm, cx + 0.31 * mm, front_bot + 0.45 * mm, front_bot + 3.45 * mm, 0.0, 1.0 * mm, 1.0)
        slots.append(mouth)
        floors.append(floor)
    for floor in floors:
        bm.faces.new(floor[::-1])
    body.done(GOLD)  # contact blades seen in the slots: walls and floor gold
    fill_with_holes(bm, front_outline, slots, (0.0, 0.0, -1.0))
    body.done(PALE)

    # Latch tab: hinged near the front, rising toward the rear, between the guard shoulders.
    box_latch = extrude_zy(bm, [(3.0 * mm, front_top), (z_rear, front_top + 0.5 * mm), (z_rear, front_top + 1.1 * mm), (3.0 * mm, front_top + 0.6 * mm)], -4.0 * mm, 4.0 * mm)
    del box_latch
    body.done(PALE)
    for sign in (-1.0, 1.0):
        x_in, x_out = sorted((sign * 4.34 * mm, sign * hw))
        extrude_zy(bm, [(6.0 * mm, front_top), (z_rear, front_top), (z_rear, y_top), (9.0 * mm, y_top)], x_in, x_out)
        body.done(PALE)
    # Eight gold contact blades under the insertion part, flush with the front face.
    for i in range(8):
        cx = (i - 3.5) * 1.02 * mm
        box(bm, cx - 0.25 * mm, cx + 0.25 * mm, y_bot, front_bot, 0.0, 8.2 * mm)
        body.done(GOLD)
    return body.finish()


def build_rack_box(plan: Plan) -> bpy.types.Object:
    """Plain box w x h x d, centred on x and z with its bottom at y = 0, every edge chamfered by chamferMm (one segment).
    No panel inset and no ear flanges in wave 1: ports sit on the bounding-box face (2026-10-29 spec 4.5)."""
    w, h, d = size_m(plan)
    chamfer = param_m(plan, "chamferMm", DEFAULT_CHAMFER_MM)
    if chamfer >= min(w, h, d) / 2.0:
        raise BuildError(f"params.chamferMm ({chamfer / MM:.2f}) must be smaller than half the smallest side ({min(w, h, d) / 2.0 / MM:.2f})")

    body = Body("rack-box")
    bm = body.bm
    corners = [(sx * w / 2.0, y, sz * d / 2.0) for y in (0.0, h) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    v = [bm.verts.new(g2b(*c)) for c in corners]
    for q in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([v[i] for i in q])
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=chamfer, offset_type="OFFSET", segments=1, affect="EDGES")
    body.done(CHASSIS)  # lifted grey: a near-black box vanishes against the creation scene's night background
    return body.finish()


def build_console_wedge(plan: Plan) -> bpy.types.Object:
    """A console or any wedge-shaped casing: plan.profile is the SIDE profile [[depth mm from the io face, height mm], ...] (first
    station at depth 0, last at depth d, the tallest = h), extruded across the width w, bottom flat on y = 0, every edge chamfered by
    chamferMm. Pivot bottom-centre, the io face (the tall rear) at z = +d/2. One colour (CHASSIS); a projection puts the real top on it."""
    w, h, d = size_m(plan)
    profile = plan.get("profile")
    if not isinstance(profile, list) or len(profile) < 3:
        raise BuildError("console-wedge needs plan.profile: at least three [depth_mm, height_mm] stations")
    stations: list[tuple[float, float]] = []
    for i, st in enumerate(profile):
        if not (isinstance(st, list) and len(st) == 2 and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in st)):
            raise BuildError(f"profile station {i} must be [depth_mm, height_mm], got {st!r}")
        if st[1] <= 0:
            raise BuildError(f"profile station {i} height must be positive, got {st[1]}")
        if stations and not (st[0] * MM > stations[-1][0]):
            raise BuildError(f"profile station {i} depth {st[0]} must be beyond the previous station")
        stations.append((float(st[0]) * MM, float(st[1]) * MM))
    chamfer = param_m(plan, "chamferMm", DEFAULT_CHAMFER_MM)
    if chamfer >= min(w, min(s[1] for s in stations)) / 2.0:
        raise BuildError(f"params.chamferMm ({chamfer / MM:.2f}) must be smaller than half the smallest side")

    body = Body("console-wedge")
    bm = body.bm
    # polygon of (z, y): the rear-bottom corner, the front-bottom corner, then the top profile from the front edge back to the io face
    pts = [(d / 2.0, 0.0), (-d / 2.0, 0.0)] + [(d / 2.0 - t, hh) for t, hh in reversed(stations)]
    extrude_zy(bm, pts, -w / 2.0, w / 2.0)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=chamfer, offset_type="OFFSET", segments=1, affect="EDGES")
    body.done(CHASSIS)
    return body.finish()


CABINET = "#3d3f46"          # lifted black plastic: the creation scene's night backdrop swallows a true black
CABINET_POCKET = "#25262b"   # the inside of a socket pocket, a shade darker than the cabinet
POCKET_DEFAULT_MM = 24.0
POCKET_SEGMENTS = 16
FLAT_FACE_TOL = 1e-6         # metres: how far a vertex may be from a plane and still lie in it (bmesh stores float32)


def take_flat_face(bm: bmesh.types.BMesh, z: float) -> list[bmesh.types.BMEdge]:
    """Removes the one face lying in the glTF plane z (within FLAT_FACE_TOL) and returns its edges, to be refilled around holes."""
    found = [f for f in bm.faces if all(abs(-v.co.y - z) < FLAT_FACE_TOL for v in f.verts)]
    if len(found) != 1:
        raise BuildError(f"expected one flat face in the plane z = {z / MM:.2f} mm, found {len(found)}")
    edges = list(found[0].edges)
    bmesh.ops.delete(bm, geom=found, context="FACES_ONLY")
    return edges


def build_speaker_cabinet(plan: Plan) -> bpy.types.Object:
    """A loudspeaker cabinet w x h x d, bottom at y = 0, centred on x and z, the io (rear) face at z = +d/2.

    The plan seen from above is a hexagon: full width w at the baffle (z = -d/2), midWidthMm where the rear taper starts (taperDepthMm short of
    the rear), rearWidthMm at the io face. midWidthMm defaults to w and rearWidthMm to midWidthMm (no param = a plain box, no taperDepthMm =
    a plain trapezoid from the baffle to the rear). Every edge is bevelled by chamferMm in bevelSegments segments (default
    1 and 3 mm). plan.ports: each io-face port with an insetMm gets a round pocket in the rear face, its floor insetMm behind the face
    (so the port marker sits on a real surface) and its diameter openingMm (24 mm when the port gives none). One colour (CABINET) and a
    darker one for the pockets; a projection puts the real baffle, rear panel and sides on it."""
    w, h, d = size_m(plan)
    params = plan.get("params") or {}
    chamfer = param_m(plan, "chamferMm", 3.0)
    segments = params.get("bevelSegments", 1)
    if isinstance(segments, bool) or not isinstance(segments, int) or not 1 <= segments <= 4:
        raise BuildError(f"params.bevelSegments must be a whole number from 1 to 4, got {segments!r}")
    mid = param_m(plan, "midWidthMm", w / MM) if "midWidthMm" in params else w
    if mid > w + 1e-9:
        raise BuildError(f"params.midWidthMm ({mid / MM:.1f}) cannot be wider than the width ({w / MM:.1f})")
    rear = param_m(plan, "rearWidthMm", mid / MM) if "rearWidthMm" in params else mid
    if rear > mid + 1e-9:
        raise BuildError(f"params.rearWidthMm ({rear / MM:.1f}) cannot be wider than midWidthMm ({mid / MM:.1f})")
    taper = param_m(plan, "taperDepthMm", d / MM) if "taperDepthMm" in params else 0.0
    if rear < mid - 1e-9 and not 0.0 < taper < d:
        raise BuildError("a rear narrower than the middle needs params.taperDepthMm, less than the depth")
    if chamfer * 4.0 >= min(w, rear, h, d):
        raise BuildError(f"params.chamferMm ({chamfer / MM:.2f}) is too large for the smallest side")

    body = Body("speaker-cabinet")
    bm = body.bm
    if rear < mid - 1e-9:
        plan_pts = [(-w / 2.0, -d / 2.0), (w / 2.0, -d / 2.0), (mid / 2.0, d / 2.0 - taper), (rear / 2.0, d / 2.0), (-rear / 2.0, d / 2.0), (-mid / 2.0, d / 2.0 - taper)]
    else:
        plan_pts = [(-w / 2.0, -d / 2.0), (w / 2.0, -d / 2.0), (rear / 2.0, d / 2.0), (-rear / 2.0, d / 2.0)]
    extrude_xz(bm, plan_pts, 0.0, h)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=chamfer, offset_type="OFFSET", segments=segments, affect="EDGES")
    # A side that slopes from the baffle corner to the mid corner loses a little width where the corner is bevelled (chamfer x slope, a
    # fraction of a millimetre): stretch x back to exactly w, so the size gate holds to the hundredth of a millimetre.
    span = max(v.co.x for v in bm.verts) - min(v.co.x for v in bm.verts)
    if abs(span - w) > 1e-7:
        bmesh.ops.scale(bm, vec=(w / span, 1.0, 1.0), verts=bm.verts[:])
    body.done(CABINET)

    pockets =[p for p in (plan.get("ports") or []) if isinstance(p.get("insetMm"), (int, float)) and p["insetMm"] > 0]
    if pockets:
        outline = take_flat_face(bm, d / 2.0)
        holes = []
        for p in pockets:
            radius = float(p.get("openingMm") or POCKET_DEFAULT_MM) * MM / 2.0
            cx = float(p["xMm"]) * MM - w / 2.0
            cy = float(p["yMm"]) * MM
            if abs(cx) + radius > rear / 2.0 - chamfer + 1e-9 or cy - radius < chamfer or cy + radius > h - chamfer:
                raise BuildError(f"the pocket of port {p.get('portId')!r} does not fit in the flat rear face")
            holes.append(blind_hole(bm, cx, cy, d / 2.0, radius, POCKET_SEGMENTS, float(p["insetMm"]) * MM, -1.0))
        body.done(CABINET_POCKET)  # the pocket walls and floors, built so far
        fill_with_holes(bm, outline, holes, (0.0, 0.0, 1.0))
        body.done(CABINET)  # the rear face refilled around the pockets
    return body.finish()


def build_stagebox_rio3224(plan: Plan) -> bpy.types.Object:
    """Yamaha Rio3224-D2 style 5U stage box (research report, "Rio3224-D2"; generic: no logo, no model name).

    Model frame: X right (seen from the front, the I/O face at +Z), Y up with the bottom at 0, bottom-centre pivot. The
    480 mm width includes the two black rack ears (earMm each); the slate-blue front panel is flush with the ears and
    carries the 4 x 8 input grid (round bezels), the display strip, the AES/EBU and output block (one darker L-shaped
    plate), the knob, two buttons and the rocker; every connector stands frontStepMm in front of the panel and its tip
    is the bounding-box face (so the port nodes lie on it). The back is a flat black plate with two fans, two power
    inlets and two etherCON ports standing rearStepMm behind it. No handles: the datasheet drawings show none.
    Verified: sizes, ear width, depth steps. Photo-derived (about 1.5 mm): the layout of the plates and connectors."""
    w, h, d = size_m(plan)
    mm = MM
    ear = param_m(plan, "earMm", 27.0)
    flange_depth = param_m(plan, "flangeDepthMm", 190.0)
    front_step = param_m(plan, "frontStepMm", 11.5)
    rear_step = param_m(plan, "rearStepMm", 6.0)
    if w < 400.0 * mm or h < 200.0 * mm or d < 300.0 * mm:
        raise BuildError(f"a Rio3224-D2 stage box needs sizeMm of about 480 x 220 x 368 (got {w / mm:.0f} x {h / mm:.0f} x {d / mm:.0f})")
    if ear < 15.0 * mm or ear > 40.0 * mm or flange_depth > d - front_step - rear_step - 20.0 * mm:
        raise BuildError("params.earMm / params.flangeDepthMm do not fit the box")

    hw = w / 2.0
    z_front, z_back = d / 2.0, -d / 2.0
    panel = z_front - front_step          # the panel and the ear faces
    back_plate = z_back + rear_step       # the chassis rear
    half_c = hw - ear                     # half width of the chassis and the panel
    body = Body("stagebox-rio3224")
    bm = body.bm
    segs = BEZEL_SEGMENTS

    # --- chassis, panel, ears -------------------------------------------------------------------------------
    chassis = box(bm, -half_c, half_c, 0.0, h, back_plate, panel - 1.0 * mm)
    bevel_faces(bm, chassis, 1.0 * mm)
    body.done(CHASSIS)
    box(bm, -half_c, half_c, 0.0, h, panel - 1.0 * mm, panel)
    body.done(SLATE)
    for sign in (-1.0, 1.0):
        x0, x1 = sorted((sign * half_c, sign * hw))
        # The ear plate is 0.05 mm behind the panel plane and the flange starts inside the plate, so that no vertex or edge
        # coincides with the slate panel (the fix-up merges coincident vertices and would leave 4-face edges).
        box(bm, x0, x1, 0.0, h, panel - 2.5 * mm, panel - EAR_RECESS)
        x_in, x_out = sorted((sign * half_c, sign * (half_c + 2.5 * mm)))
        z_flange = panel - flange_depth
        extrude_zy(bm, [(panel - 2.4 * mm, 0.0), (z_flange + 17.0 * mm, 0.0), (z_flange, 17.0 * mm), (z_flange, h - 17.0 * mm), (z_flange + 17.0 * mm, h), (panel - 2.4 * mm, h)], x_in, x_out)
        body.done(EAR)
        for y in (182.1, 169.5, 109.3, 49.1, 36.4):                            # five rack-hole slots (dark pads)
            box(bm, sign * 231.0 * mm - 5.25 * mm, sign * 231.0 * mm + 5.25 * mm, y * mm - 3.5 * mm, y * mm + 3.5 * mm, panel - EAR_RECESS, panel + 0.3 * mm)
        body.done(DARK)

    # --- plates on the panel (1 mm raised) -------------------------------------------------------------------
    plate = 1.0 * mm
    box(bm, -200.9 * mm, -7.2 * mm, 7.1 * mm, 204.4 * mm, panel, panel + plate)
    body.done(PLATE_IN)
    l_plate = [(-4.1, 155.7), (103.7, 155.7), (103.7, 109.1), (204.0, 109.1), (204.0, 7.1), (-4.1, 7.1)]
    extrude_xy(bm, [(x * mm, y * mm) for x, y in l_plate], panel, panel + plate)
    body.done(PLATE_OUT)
    box(bm, -4.1 * mm, 177.4 * mm, 158.3 * mm, 204.5 * mm, panel, panel + plate)  # display strip
    body.done(DARK)
    box(bm, 3.6 * mm, 169.0 * mm, 184.0 * mm, 198.4 * mm, panel + plate, panel + plate + 0.15 * mm)
    body.done(LCD)

    # --- connectors: round bezels 11.5 mm proud of the panel ------------------------------------------------------
    discs: list[list[bmesh.types.BMVert]] = []

    def bezel(cx: float, cy: float, r_out: float, r_in: float, z_tip: float) -> None:
        base = ring(bm, r_out, panel, segs, cx, cy)
        tip = ring(bm, r_out, z_tip, segs, cx, cy)
        inner = ring(bm, r_in, z_tip, segs, cx, cy)
        band(bm, base, tip)
        band(bm, tip, inner)
        bm.faces.new(base[::-1])
        discs.append(inner)

    for row_y in (166.7, 120.2, 73.8, 27.3):                                   # 32 female inputs
        for i in range(8):
            bezel((-186.2 + 23.45 * i) * mm, row_y * mm, 11.0 * mm, 8.2 * mm, z_front)
    for row_y in (73.8, 27.3):                                                 # 16 analog outputs
        for i in range(8):
            bezel((12.0 + 25.13 * i) * mm, row_y * mm, 12.0 * mm, 8.8 * mm, z_front)
    body.done(BEZEL)
    for i in range(4):                                                         # 4 AES/EBU outputs, silver rims
        bezel((12.0 + 25.1 * i) * mm, 120.2 * mm, 12.0 * mm, 8.8 * mm, z_front)
    body.done(STEEL)
    for inner in discs:
        bm.faces.new(inner)
    body.done(DARK)

    # --- display controls and the power rocker ---------------------------------------------------------------
    n_knob = 16
    knob_base = ring(bm, 9.35 * mm, panel + plate, n_knob, 139.2 * mm, 171.5 * mm)
    knob_top = ring(bm, 9.35 * mm, panel + 8.0 * mm, n_knob, 139.2 * mm, 171.5 * mm)
    band(bm, knob_base, knob_top)
    bm.faces.new(knob_base[::-1])
    bm.faces.new(knob_top)
    body.done(EAR)
    for x in (87.6, 107.3):
        box(bm, x * mm - 3.5 * mm, x * mm + 3.5 * mm, 172.0 * mm - 3.5 * mm, 172.0 * mm + 3.5 * mm, panel + plate, panel + 4.0 * mm)
    body.done(DARK)
    box(bm, 180.0 * mm, 200.6 * mm, 171.0 * mm, 204.3 * mm, panel, panel + 6.0 * mm)   # rocker frame
    body.done(DARK)
    box(bm, 182.5 * mm, 198.1 * mm, 173.5 * mm, 201.8 * mm, panel + 6.0 * mm, panel + 10.0 * mm)  # the rocker itself
    body.done(EAR)

    # --- back: fans, power inlets, etherCON ----------------------------------------------------------------------
    # Two wire-guard fans: black frame, chrome outer ring and mid ring, dark blades, chrome hub. Faces are built in three
    # passes (frame, chrome, dark) so each pass takes one colour.
    fan_depth = 3.0 * mm
    z_tip = back_plate - fan_depth
    fan_rings: list[dict[str, list[bmesh.types.BMVert]]] = []
    for fy in (152.0, 69.0):
        fx = -160.0 * mm
        fan_rings.append({
            "base": ring(bm, 40.0 * mm, back_plate, 12, fx, fy * mm),
            "tip": ring(bm, 40.0 * mm, z_tip, 12, fx, fy * mm),
            "rim": ring(bm, 36.5 * mm, z_tip, 12, fx, fy * mm),
            "mid_out": ring(bm, 24.0 * mm, z_tip, 12, fx, fy * mm),
            "mid_in": ring(bm, 21.5 * mm, z_tip, 12, fx, fy * mm),
            "hub": ring(bm, 8.0 * mm, z_tip, 12, fx, fy * mm),
        })
    for r in fan_rings:
        band(bm, r["base"], r["tip"])
        bm.faces.new(r["base"])
    body.done(CHASSIS)
    for r in fan_rings:
        band(bm, r["tip"], r["rim"])
        band(bm, r["mid_out"], r["mid_in"])
        bm.faces.new(r["hub"][::-1])
    body.done(STEEL)
    for r in fan_rings:
        band(bm, r["rim"], r["mid_out"])
        band(bm, r["mid_in"], r["hub"])
    body.done(DARK)
    # Dante plate behind the two etherCON ports (flush, a shade lighter than the black back).
    box(bm, 121.5 * mm, 215.5 * mm, 163.0 * mm, 204.0 * mm, back_plate - 0.6 * mm, back_plate)
    body.done(PLATE_OUT)
    for cx, cy, bw, bh, core_w, core_h in ((159.9, 54.3, 39.0, 23.0, 31.0, 15.0), (106.9, 54.3, 39.0, 23.0, 31.0, 15.0),
                                           (182.5, 183.7, 21.0, 21.0, 14.0, 14.0), (154.5, 183.7, 21.0, 21.0, 14.0, 14.0)):
        # The housing stops 0.5 mm short of the tip; the dark core is the part that reaches the box face.
        box(bm, (cx - bw / 2.0) * mm, (cx + bw / 2.0) * mm, (cy - bh / 2.0) * mm, (cy + bh / 2.0) * mm, z_back + 0.5 * mm, back_plate)
        body.done(INLET if bw > 30.0 else STEEL)
        box(bm, (cx - core_w / 2.0) * mm, (cx + core_w / 2.0) * mm, (cy - core_h / 2.0) * mm, (cy + core_h / 2.0) * mm, z_back, z_back + 0.5 * mm)
        body.done(DARK)
    log(f"stage box: {sum(len(f.verts) - 2 for f in bm.faces)} triangles before export")
    return body.finish()


def lift_hex(hexcolour: str, gain: float = REVOLVE_LIFT) -> str:
    """Lifts an sRGB hex colour for the creation scene's dim lighting (linear x gain, capped), back to sRGB hex.

    Spec colours are the colours of the real part; vertical faces get about a quarter of the light there, so a revolved
    shape (a mic, a stand) lifts them the way the Rio's palette was lifted by hand."""
    linear = srgb_hex_to_linear(hexcolour)
    out = []
    for c in linear:
        v = min(REVOLVE_LIFT_CAP, c * gain)
        s = 12.92 * v if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055
        out.append(max(0, min(255, round(s * 255))))
    return "#%02x%02x%02x" % (out[0], out[1], out[2])


def build_revolve(plan: Plan) -> bpy.types.Object:
    """A surface of revolution about the vertical axis from a measured profile (microphones, later stands and lamps).

    plan.profile is [[y_mm from the base, diameter_mm], ...] (at least four stations, strictly increasing y, first at 0 =
    the bottom, widest = the width), plan.colours [{fromMm, colour}] the colour zones (real-part sRGB, lifted here), and
    params.segments (default 32, a multiple of 4 so the box is exact). Pivot bottom-centre, axis along glTF Y. A station of
    diameter 0 is a pole (a fan); a first or last station with a diameter is closed by a flat cap."""
    w, h, d = size_m(plan)
    profile = plan.get("profile")
    if not isinstance(profile, list) or len(profile) < 4:
        raise BuildError("revolve needs plan.profile: at least four [y_mm, diameter_mm] stations")
    stations: list[tuple[float, float]] = []
    for i, st in enumerate(profile):
        if not (isinstance(st, list) and len(st) == 2):
            raise BuildError(f"profile station {i} must be [y_mm, diameter_mm], got {st!r}")
        y_mm, dia_mm = st
        for name, value in (("position", y_mm), ("diameter", dia_mm)):
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise BuildError(f"profile station {i} {name} must be a finite number, got {value!r}")
        if dia_mm < 0:
            raise BuildError(f"profile station {i} diameter must not be negative, got {dia_mm}")
        if stations and not (y_mm * MM > stations[-1][0]):
            raise BuildError(f"profile station {i} position {y_mm} must be above the previous station")
        stations.append((float(y_mm) * MM, float(dia_mm) * MM / 2.0))
    if abs(stations[0][0]) > 1e-9:
        raise BuildError("the first profile station must be at 0 (the base)")
    segments = int((plan.get("params") or {}).get("segments", REVOLVE_SEGMENTS))
    if segments < 12 or segments > 64 or segments % 4 != 0:
        raise BuildError(f"params.segments must be a multiple of 4 from 12 to 64, got {segments}")

    zones = plan.get("colours") or [{"fromMm": 0, "colour": REVOLVE_DEFAULT_COLOUR}]
    zones = sorted(zones, key=lambda z: z["fromMm"])
    lifted = [(float(z["fromMm"]) * MM, lift_hex(z["colour"])) for z in zones]

    def colour_at(y: float) -> str:
        chosen = lifted[0][1]
        for from_y, colour in lifted:
            if y >= from_y - 1e-12:
                chosen = colour
        return chosen

    body = Body("revolve")
    bm = body.bm

    def level(radius: float, y: float) -> list[bmesh.types.BMVert]:
        if radius <= 1e-9:                      # a pole: one vertex
            return [bm.verts.new(g2b(0.0, y, 0.0))]
        return [bm.verts.new(g2b(radius * math.cos(2 * math.pi * k / segments), y, radius * math.sin(2 * math.pi * k / segments))) for k in range(segments)]

    levels = [level(r, y) for y, r in stations]
    for i in range(len(levels) - 1):
        lo, hi = levels[i], levels[i + 1]
        if len(lo) == 1 and len(hi) == 1:
            raise BuildError(f"profile stations {i} and {i + 1} both have diameter 0")
        if len(lo) == 1:
            for k in range(segments):
                bm.faces.new((lo[0], hi[(k + 1) % segments], hi[k]))
        elif len(hi) == 1:
            for k in range(segments):
                bm.faces.new((lo[k], lo[(k + 1) % segments], hi[0]))
        else:
            band(bm, lo, hi)
        body.done(colour_at((stations[i][0] + stations[i + 1][0]) / 2.0))
    if len(levels[0]) > 1:
        bm.faces.new(levels[0][::-1])
        body.done(colour_at(stations[0][0]))
    if len(levels[-1]) > 1:
        bm.faces.new(levels[-1])
        body.done(colour_at(stations[-1][0]))
    return body.finish()


# Colours of the boom arm (real-part sRGB, lifted by lift_hex): matt black tubes, slightly lighter joints, bare metal rod and mic thread.
ARM_TUBE = "#3a3b41"
ARM_JOINT = "#4c4d54"
ARM_METAL = "#8c8e93"
ARM_SEGMENTS = 24
ARM_DEFAULTS_MM = {"elbowDxMm": 157.0, "elbowDyMm": 370.0, "headDxMm": 326.0, "headDyMm": 232.0, "tubeDiaMm": 26.0, "jointDiaMm": 46.0, "columnHeightMm": 95.0, "rodLenMm": 50.0, "headDropMm": 80.0}
ARM_MAX_SCALE_ERROR = 0.02    # the natural size of the pose may differ this much from the spec size before the spec numbers must be corrected


def cylinder_between(bm: bmesh.types.BMesh, a: Vector, b: Vector, radius: float, radius_b: float | None = None, segments: int = ARM_SEGMENTS) -> None:
    """A closed solid cylinder (or cone) from point a to point b (Blender space), flat caps, ARM_SEGMENTS sides."""
    axis = b - a
    if axis.length < 1e-9:
        raise BuildError("a boom-arm part has zero length")
    matrix = Matrix.Translation((a + b) / 2.0) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius if radius_b is None else radius_b, depth=axis.length, matrix=matrix)


def build_boom_arm(plan: Plan) -> bpy.types.Object:
    """An articulated mic arm in a posed side view, tubes in the plane z = 0 (glTF), see the shape table in shapes.ts.

    The natural pose is built in millimetres-as-metres from the params, then moved so that its box is centred on x and z with the bottom
    at y = 0 and scaled to the exact spec size (refused when that needs more than ARM_MAX_SCALE_ERROR: the spec numbers then do not match the pose)."""
    w, h, d = size_m(plan)
    p = {k: param_m(plan, k, v) for k, v in ARM_DEFAULTS_MM.items()}
    col_r = d / 2.0                      # the column's diameter is the depth of the model
    tube_r = p["tubeDiaMm"] / 2.0
    joint_r = p["jointDiaMm"] / 2.0
    head_r = joint_r * 0.37              # head joint
    joint_len = 34.0 * MM
    shoulder = (0.0, 0.0)
    elbow = (p["elbowDxMm"], p["elbowDyMm"])
    head = (elbow[0] + p["headDxMm"], elbow[1] - p["headDyMm"])
    col_top = -5.0 * MM                  # the column stops just under the shoulder hinge, which stands on it
    col_bottom = col_top - p["columnHeightMm"]
    rod_bottom = col_bottom - p["rodLenMm"]
    drop = p["headDropMm"]

    def at(x: float, y: float, z: float = 0.0) -> Vector:
        return g2b(x, y, z)

    body = Body("boom-arm")
    bm = body.bm
    cylinder_between(bm, at(0.0, col_bottom), at(0.0, col_top), col_r)                       # column housing
    body.done(lift_hex(ARM_JOINT))
    cylinder_between(bm, at(0.0, rod_bottom), at(0.0, col_bottom), 8.0 * MM)                 # threaded rod under it
    body.done(lift_hex(ARM_METAL))
    for (jx, jy), r, ln in ((shoulder, joint_r, joint_len), (elbow, joint_r, joint_len), (head, head_r, 30.0 * MM)):
        cylinder_between(bm, at(jx, jy, -ln / 2), at(jx, jy, ln / 2), r)                      # a hinge: axis along z
    body.done(lift_hex(ARM_JOINT))
    cylinder_between(bm, at(*shoulder), at(*elbow), tube_r)                                   # lower arm
    cylinder_between(bm, at(*elbow), at(*head), tube_r * 0.92)                                # upper arm (a touch slimmer)
    body.done(lift_hex(ARM_TUBE))
    post_r = head_r * 0.75
    cylinder_between(bm, at(head[0], head[1]), at(head[0], head[1] - drop * 0.62), post_r)    # head block under the hinge
    body.done(lift_hex(ARM_TUBE))
    cylinder_between(bm, at(head[0], head[1] - drop * 0.62), at(head[0], head[1] - drop), 7.0 * MM)  # the 5/8 inch mic thread
    body.done(lift_hex(ARM_METAL))

    # natural box (Blender x = glTF x, Blender y = -glTF z, Blender z = glTF y) -> centred, bottom at 0, exact spec size
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    ex, ey, ez = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    for name, natural, wanted in (("width", ex, w), ("depth", ey, d), ("height", ez, h)):
        if abs(natural / wanted - 1.0) > ARM_MAX_SCALE_ERROR:
            raise BuildError(f"the boom-arm pose is {natural / MM:.1f} mm in {name}, the spec size says {wanted / MM:.1f} mm: change the spec size or the pose params")
    bmesh.ops.translate(bm, vec=Vector((-(max(xs) + min(xs)) / 2.0, -(max(ys) + min(ys)) / 2.0, -min(zs))), verts=bm.verts[:])
    bmesh.ops.scale(bm, vec=Vector((w / ex, d / ey, h / ez)), space=Matrix.Identity(4), verts=bm.verts[:])
    log(f"boom arm: natural {ex / MM:.1f} x {ez / MM:.1f} x {ey / MM:.1f} mm, scaled to the spec; {sum(len(f.verts) - 2 for f in bm.faces)} triangles")
    return body.finish()


CABLE_DEFAULTS_MM = {"hoodWidthMm": 62.0, "hoodHeightMm": 17.0, "hoodLenMm": 45.0, "plugDiaMm": 23.2, "plugLenMm": 62.0, "tailLenMm": 160.0, "trunkDiaMm": 11.5, "pitchMm": 24.0}
CABLE_HOOD = "#b4b8c0"          # nickel D-sub shell and hood
CABLE_BOOT = "#a83232"          # red strain relief
CABLE_BLACK = "#33343a"         # trunk, tails and plug boots
CABLE_SHELL = "#c9ccd0"         # XLR shell
CABLE_SCREW = "#d4af37"         # thumbscrews


def build_cable_assembly(plan: Plan) -> bpy.types.Object:
    """A D-sub to XLR fan-out cable, see the shape table in shapes.ts. Built in spec millimetres: the io end (D-sub nose) at +z, the plug tips at -z,
    the plug grid centred on the height; then centred on x, bottom at y = 0 and scaled to the exact spec size (at most ARM_MAX_SCALE_ERROR off)."""
    w, h, d = size_m(plan)
    params = plan.get("params") or {}
    p = {k: param_m(plan, k, v) for k, v in CABLE_DEFAULTS_MM.items() if k.endswith("Mm")}
    cols, rows = int(params.get("columns", 4)), int(params.get("rows", 2))
    if cols < 1 or rows < 1 or cols * rows > 16:
        raise BuildError(f"cable-assembly needs 1 to 16 plugs, got {cols} x {rows}")
    pitch, plug_r, plug_len = p["pitchMm"], p["plugDiaMm"] / 2.0, p["plugLenMm"]
    tail_len, trunk_r = p["tailLenMm"], p["trunkDiaMm"] / 2.0
    hood_w, hood_h, hood_len = p["hoodWidthMm"], p["hoodHeightMm"], p["hoodLenMm"]
    nose_len = 10.0 * MM
    tail_r = 3.0 * MM
    z_tip, z_nose = -d / 2.0, d / 2.0
    cy = h / 2.0
    z_break = z_tip + plug_len + tail_len
    plugs = [((c - (cols - 1) / 2.0) * pitch, cy + (r - (rows - 1) / 2.0) * pitch) for r in range(rows) for c in range(cols)]

    def at(x: float, y: float, z: float) -> Vector:
        return g2b(x, y, z)

    body = Body("cable-assembly")
    bm = body.bm
    for x, y in plugs:                                                                  # plug shells
        cylinder_between(bm, at(x, y, z_tip), at(x, y, z_tip + plug_len * 0.42), plug_r)
    body.done(lift_hex(CABLE_SHELL))
    for x, y in plugs:                                                                  # plug boots
        cylinder_between(bm, at(x, y, z_tip + plug_len * 0.42), at(x, y, z_tip + plug_len), plug_r * 0.88, tail_r + 1.5 * MM)
    body.done(lift_hex(CABLE_BLACK))
    for i, (x, y) in enumerate(plugs):                                                  # tails fanning in to staggered points on the trunk axis
        cylinder_between(bm, at(x, y, z_tip + plug_len), at(0.0, cy, z_break + 6.0 * MM * i), tail_r)
    z_trunk_end = z_nose - hood_len
    cylinder_between(bm, at(0.0, cy, z_break), at(0.0, cy, z_trunk_end), trunk_r)       # trunk
    body.done(lift_hex(CABLE_BLACK))
    z_hood_back = z_nose - hood_len + 7.0 * MM
    cylinder_between(bm, at(0.0, cy, z_trunk_end), at(0.0, cy, z_hood_back), trunk_r * 1.55, trunk_r * 1.15)  # red strain relief
    body.done(lift_hex(CABLE_BOOT))
    box(bm, -hood_w / 2.0, hood_w / 2.0, cy - hood_h / 2.0, cy + hood_h / 2.0, z_hood_back, z_nose - nose_len)  # hood
    box(bm, -26.5 * MM, 26.5 * MM, cy - 6.25 * MM, cy + 6.25 * MM, z_nose - nose_len, z_nose)               # D shell nose (53 x 12.5)
    body.done(lift_hex(CABLE_HOOD))
    for sx in (-1.0, 1.0):                                                              # thumbscrews standing out of the hood face
        cylinder_between(bm, at(sx * 28.5 * MM, cy, z_nose - 24.0 * MM), at(sx * 28.5 * MM, cy, z_nose - 1.0 * MM), 3.0 * MM)
    body.done(lift_hex(CABLE_SCREW))

    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    ex, ey, ez = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    # Blender x = glTF x, Blender y = -glTF z (length), Blender z = glTF y (height)
    for name, natural, wanted in (("width", ex, w), ("length", ey, d), ("height", ez, h)):
        if abs(natural / wanted - 1.0) > ARM_MAX_SCALE_ERROR:
            raise BuildError(f"the cable-assembly is {natural / MM:.1f} mm in {name}, the spec size says {wanted / MM:.1f} mm: change the spec size or the params")
    bmesh.ops.translate(bm, vec=Vector((-(max(xs) + min(xs)) / 2.0, -(max(ys) + min(ys)) / 2.0, -min(zs))), verts=bm.verts[:])
    bmesh.ops.scale(bm, vec=Vector((w / ex, d / ey, h / ez)), space=Matrix.Identity(4), verts=bm.verts[:])
    log(f"cable assembly: natural {ex / MM:.1f} x {ez / MM:.1f} x {ey / MM:.1f} mm, scaled to the spec; {sum(len(f.verts) - 2 for f in bm.faces)} triangles")
    return body.finish()


# One entry per shape of tools/assets3d/shapes.ts (a test compares the two lists).
SHAPES: dict[str, Callable[[Plan], bpy.types.Object]] = {
    "cylinder-plug": build_cylinder_plug,
    "trs-plug": build_trs_plug,
    "rj45-plug": build_rj45_plug,
    "rack-box": build_rack_box,
    "stagebox-rio3224": build_stagebox_rio3224,
    "revolve": build_revolve,
    "console-wedge": build_console_wedge,
    "speaker-cabinet": build_speaker_cabinet,
    "boom-arm": build_boom_arm,
    "xlr-male-plug": build_xlr_male_plug,
    "cable-assembly": build_cable_assembly,
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


# --- projection: a picture of one face from a Meshy model, mapped onto our exact shape ---------------------------------------

PROJECTION_COS = math.cos(math.radians(50.0))   # a face looks at the projection when its normal is within 50 degrees of the face normal (a console top slopes up to about 33)
WRAP_MAX_NORMAL_Z = 0.9                         # a lathe's wrap picture covers the polygons whose normal is within about 64 degrees of horizontal; the flat ends and the crown of a ball take a swatch
SWATCH_PX = 32                                  # one palette swatch in the atlas: 32 x 32 px
ATLAS_MAX_PX = 4096                             # the longest side of the picture area of the atlas; longer than this, the pictures are scaled down together


def srgb_byte(linear: float) -> int:
    """Linear 0..1 -> sRGB byte (the palette swatches are written as sRGB bytes)."""
    v = max(0.0, min(1.0, linear))
    s = 12.92 * v if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055
    return max(0, min(255, round(s * 255)))


def apply_projection(ob: bpy.types.Object, plan: Plan, out_png: str) -> None:
    """Maps pictures onto the faces of `ob` that look the way each picture's face looks (planar UV), and gives every other face a
    swatch of its own colour, all in ONE atlas, so the model keeps ONE material and ONE texture.

    plan.projections = [{face: io | opposite | top | left, png: path of the face image (face-local x right, y up, seen from outside)}].
    Each image is the whole face rectangle (width x height, depth for the top face, from plan.sizeMm). The atlas puts the pictures side by
    side in one row OR stacked in one column, whichever gives the shorter longest side (a wide, short rack panel stacks, a tall cabinet face goes in
    a row), scaled together by one factor when that side is longer than ATLAS_MAX_PX (so every face keeps the same pixels per millimetre), above a
    one-row palette strip; a face goes to the FIRST projection whose face it looks at (within 50 degrees), else to a swatch.
    The vertex colours are removed (the swatches carry them). The atlas is saved to `out_png` (the exporter embeds it).
    Blender space: glTF (x, y, z) = Blender (x, -z, y), so the io face looks along Blender -Y.
    """
    projections = plan["projections"]
    w, h, d = size_m(plan)
    # face -> (outward normal in Blender space, (u, v) of a point in metres, face rectangle in metres)
    faces = {
        "io": ((0.0, -1.0, 0.0), lambda co: (co.x + w / 2, co.z), (w, h)),
        "opposite": ((0.0, 1.0, 0.0), lambda co: (w / 2 - co.x, co.z), (w, h)),
        "top": ((0.0, 0.0, 1.0), lambda co: (co.x + w / 2, d / 2 + co.y), (w, d)),
        "left": ((-1.0, 0.0, 0.0), lambda co: (d / 2 - co.y, co.z), (d, h)),
        # the unrolled side surface of a lathe: u = angle around the axis (a whole turn = the picture width), v = height. Needs a picture whose
        # left and right edges match (the polygons at the seam reach past 1 and the texture repeats).
        "wrap": ((0.0, 0.0, 0.0), None, (math.pi * w, h)),
    }
    pictures = []   # [(face, image, width px, height px, floats)]
    for proj in projections:
        face = proj["face"]
        if face not in faces:
            raise BuildError(f"projection face {face!r} is not one of {sorted(faces)}")
        if any(p[0] == face for p in pictures):
            raise BuildError(f"projection face {face!r} is given twice")
        img = bpy.data.images.load(proj["png"])
        img.colorspace_settings.name = "sRGB"
        iw, ih = img.size
        if iw < SWATCH_PX or ih < 2:
            raise BuildError(f"the projection image {proj['png']} is too small ({iw} x {ih})")
        pictures.append([face, img, iw, ih, None])
    if any(p[0] == "wrap" for p in pictures) and len(pictures) != 1:
        raise BuildError("the wrap picture covers the whole side of a lathe: it is the only projection (no other face)")
    # row or column: the layout whose longest side is shorter (a tie goes to the row)
    row_w, row_h = sum(p[2] for p in pictures), max(p[3] for p in pictures)
    col_w, col_h = max(p[2] for p in pictures), sum(p[3] for p in pictures)
    layout = "row" if max(row_w, row_h) <= max(col_w, col_h) else "column"
    longest = min(max(row_w, row_h), max(col_w, col_h))
    # one scale factor for all of them, so that the longest side fits ATLAS_MAX_PX (Blender's image.scale is bilinear: fine for a factor above 0.5)
    shrink = min(1.0, ATLAS_MAX_PX / longest)
    for p in pictures:
        if shrink < 1.0:
            p[1].scale(max(SWATCH_PX, round(p[2] * shrink)), max(2, round(p[3] * shrink)))
            p[2], p[3] = p[1].size
        p[4] = [c for c in p[1].pixels[:]]
    pictures = [tuple(p) for p in pictures]
    if layout == "row":
        atlas_w, area_h = sum(p[2] for p in pictures), max(p[3] for p in pictures)
    else:
        atlas_w, area_h = max(p[2] for p in pictures), sum(p[3] for p in pictures)

    me = ob.data
    colours = me.color_attributes[COLOUR_ATTRIBUTE]
    # which picture (index) each polygon looks at, else None (a swatch)
    looks_at: dict[int, int] = {}
    palette: list[tuple[int, int, int]] = []
    swatch_of: dict[int, int] = {}
    for poly in me.polygons:
        for k, (face, _img, _iw, _ih, _px) in enumerate(pictures):
            if face == "wrap":
                hit = abs(poly.normal.z) <= WRAP_MAX_NORMAL_Z
            else:
                hit = poly.normal.dot(Vector(faces[face][0])) >= PROJECTION_COS
            if hit:
                looks_at[poly.index] = k
                break
        else:
            c = colours.data[poly.loop_start].color
            key = (srgb_byte(c[0]), srgb_byte(c[1]), srgb_byte(c[2]))
            if key not in palette:
                palette.append(key)
            swatch_of[poly.index] = palette.index(key)
    if len(palette) > atlas_w // SWATCH_PX:
        raise BuildError(f"{len(palette)} palette colours do not fit in an atlas {atlas_w} px wide")

    # the atlas, bottom-up like Blender images: the palette strip, then the pictures (a row, or a column from the bottom up) above it
    pal_rows = SWATCH_PX
    offsets = []   # (x, y) of each picture's lower-left corner in the picture area
    cx = cy = 0
    for (_f, _img, iw, ih, _px) in pictures:
        offsets.append((cx, cy))
        if layout == "row":
            cx += iw
        else:
            cy += ih
    total_h = pal_rows + area_h
    atlas = bpy.data.images.new("projection_atlas", atlas_w, total_h, alpha=False)
    atlas.colorspace_settings.name = "sRGB"
    pix = [0.0] * (atlas_w * total_h * 4)
    for r in range(pal_rows):
        for col in range(atlas_w):
            k = min(col // SWATCH_PX, max(0, len(palette) - 1))
            rr, gg, bb = palette[k] if palette else (128, 128, 128)
            o = (r * atlas_w + col) * 4
            pix[o:o + 4] = [rr / 255.0, gg / 255.0, bb / 255.0, 1.0]
    for (_f, _img, iw, ih, px), (ox, oy) in zip(pictures, offsets):
        for r in range(ih):
            src = r * iw * 4
            dst = ((pal_rows + oy + r) * atlas_w + ox) * 4
            pix[dst:dst + iw * 4] = px[src:src + iw * 4]
    atlas.pixels.foreach_set(pix)
    atlas.filepath_raw = out_png
    atlas.file_format = "PNG"
    atlas.save()

    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        centre_u = 0.0
        if poly.index in looks_at and pictures[looks_at[poly.index]][0] == "wrap":
            cc = poly.center
            centre_u = math.atan2(cc.y, cc.x) / (2 * math.pi) + 0.5
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if poly.index in swatch_of:
                uv.data[li].uv = ((swatch_of[poly.index] + 0.5) * SWATCH_PX / atlas_w, (pal_rows / 2) / total_h)
            else:
                k = looks_at[poly.index]
                face, _img, iw, ih, _px = pictures[k]
                _normal, local, (fw, fh) = faces[face]
                if face == "wrap":
                    u = math.atan2(co.y, co.x) / (2 * math.pi) + 0.5
                    if u - centre_u > 0.5:
                        u -= 1.0
                    elif u - centre_u < -0.5:
                        u += 1.0
                    v = min(max(co.z / fh, 0.5 / ih), 1.0 - 0.5 / ih)
                else:
                    u, v = local(co)
                    u = min(max(u / fw, 0.5 / iw), 1.0 - 0.5 / iw)
                    v = min(max(v / fh, 0.5 / ih), 1.0 - 0.5 / ih)
                uv.data[li].uv = ((offsets[k][0] + u * iw) / atlas_w, (pal_rows + offsets[k][1] + v * ih) / total_h)

    # one material, the atlas as its base colour; no vertex colours any more
    me.materials.clear()
    mat = bpy.data.materials.new(MATERIAL_NAME)
    mat.use_backface_culling = True
    if mat.node_tree is None:
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF") or nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = atlas
    tex.interpolation = "Linear"
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Metallic"].default_value = METALLIC
    bsdf.inputs["Roughness"].default_value = ROUGHNESS
    me.materials.append(mat)
    me.color_attributes.remove(colours)
    log(f"projection of the {', '.join(p[0] for p in pictures)} face(s): atlas {atlas_w} x {total_h} px, {len(palette)} palette colours, {len(swatch_of)} swatch faces")


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
    if plan.get("projections"):
        meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        if len(meshes) != 1:
            raise BuildError(f"a projection needs exactly one mesh object, the build made {len(meshes)}")
        apply_projection(meshes[0], plan, os.path.splitext(args["out"])[0] + ".atlas.png")
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
