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
    params = plan.get("params") or {}
    zs = float(params.get("zScale", 1.0))          # a miniature plug (3.5 mm, TT bantam) is the same shape drawn shorter: every length of the tip features is scaled by this
    poles = int(params.get("poles", 3))            # 3 = tip, ring, sleeve (TRS); 2 = tip and sleeve only (TS: one insulator band)
    if poles not in (2, 3):
        raise BuildError(f"params.poles must be 2 or 3, got {poles}")
    if barrel_r >= body_r:
        raise BuildError(f"matingOuterMm ({barrel_r * 2000:.2f}) must be smaller than the body diameter ({body_r * 2000:.2f})")
    nose_len = 7.5 * MM * zs
    boot_len = 23.5 * MM * zs
    if barrel_len < 18.6 * MM * zs or barrel_len + nose_len + boot_len + 8.0 * MM * zs > d:
        # 18.6 mm: the second insulator band ends at 17.6 mm and the sleeve needs a little length after it
        raise BuildError(f"params.barrelMm ({barrel_len / MM:.2f}) does not fit a plug of sizeMm.d {d / MM:.2f} (needs {18.6 * zs:.1f} mm to about {(d - nose_len - boot_len - 8.0 * MM * zs) / MM:.0f} mm)")

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
        (2.65 * mm * k, 4.0 * mm * zs),       # the arrowhead cone
        (2.65 * mm * k, 4.5 * mm * zs),
        (1.75 * mm * k, 4.9 * mm * zs),       # neck
        (1.75 * mm * k, 5.7 * mm * zs),
        (2.45 * mm * k, 6.5 * mm * zs),       # bead
        (2.50 * mm * k, 7.2 * mm * zs),
        (r, 8.1 * mm * zs),                   # barrel
        (r, 9.6 * mm * zs),
        (insulator_r, 9.6 * mm * zs),         # insulator 1
        (insulator_r, 11.2 * mm * zs),
        (r, 11.2 * mm * zs),                  # ring
        (r, 16.7 * mm * zs),
        (insulator_r, 16.7 * mm * zs),        # insulator 2
        (insulator_r, 17.6 * mm * zs),
        (r, 17.6 * mm * zs),                  # sleeve
        (r, barrel_len),
        (4.6 * mm * k, barrel_len),          # nose collar: a step, then a cone out to the shell
        (body_r, shell_start),
        (body_r, boot_start),            # shell
        (body_r * 0.925, boot_start),
        (body_r * 0.925, boot_start + 4.5 * mm * zs),
        (body_r * 0.55, d),              # boot tapering to the cable
    ]
    colours = [
        NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL,   # tip, neck, bead, barrel
        BLACK, BLACK, BLACK, NICKEL, BLACK, BLACK, BLACK,                  # insulator 1, ring, insulator 2
        NICKEL, NICKEL, NICKEL, NICKEL,                                    # sleeve, nose, shell
        BLACK, BLACK, BLACK,                                               # boot
    ]
    if poles == 2:                                      # TS: the ring and the second insulator are sleeve metal
        colours[12:15] = [NICKEL, NICKEL, NICKEL]
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
    if any(k in (plan.get("params") or {}) for k in RACK_V2_NAMES):
        return build_rack_device(plan)
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


# --- rack-box v2: plate, ears, chassis, handles, vents, feet, fillets ----------------------------------------------
# Used when the spec gives any of RACK_V2_NAMES (mirrors RACK_V2_PARAMS in tools/assets3d/shapes.ts); without them build_rack_box is the old plain box,
# byte for byte. Built in a frame with the FRONT PANEL at -z; frontOnIo = 1 turns the finished model 180 degrees about y (so the face-local
# coordinates a spec gives for its front face stay valid) and the control layouts' flat zones are checked in the final frame.

RACK_V2_NAMES = (
    "earWidthMm", "earThicknessMm", "earHoleMm", "earHoleEdgeMm", "earHoleRowMm", "earDiagonal",
    "handleCount", "handleProjectionMm", "handleDiaMm",
    "plateInsetMm", "filletMm", "filletSegments",
    "ventSlots", "ventColumns", "ventDepthMm", "ventSlotLenMm", "ventSlotWidthMm", "ventPitchMm", "ventColPitchMm", "ventFromRearMm", "ventSides",
    "feetMm", "feetDiaMm", "bodyWidthMm", "rearInsetMm", "frontOnIo", "plateFilletMm", "seamMm", "plateRgb", "bodyRgb",
)
RACK_PLATE = "#5a5c66"        # the front plate (lifted: a black panel vanishes against the night backdrop)
RACK_SLOT = "#17171b"         # inside a slot, vent or other recess
RACK_HANDLE = "#8c8e93"
RACK_PLATE_T_MM = 4.0         # default plate and ear thickness
RACK_EIA_U_MM = 44.45
RACK_EIA_SPACING_MM = 465.1   # EIA-310 horizontal distance between the mounting holes of the two ears
RACK_EIA_HOLE_ROW_MM = 6.35   # the outer holes of a rack unit sit 6.35 mm from its edge
RACK_SLOT_ASPECT = 2.5        # EIA slot 15.9 x 6.35 mm
RACK_SLOT_SEGMENTS = 24
RACK_FEET_SEGMENTS = 14
RACK_HANDLE_SEGMENTS = 16
RACK_FIT_MM = 0.3             # a feature may touch the edge of the flat region this closely


def rack_opt(plan: Plan, name: str) -> float | None:
    """The shape param `name` in metres, or None when the plan does not give it (validated when given)."""
    params = plan.get("params") or {}
    return positive(params[name], f"params.{name}") * MM if name in params else None


def rack_whole(plan: Plan, name: str, lo: int, hi: int) -> int | None:
    params = plan.get("params") or {}
    if name not in params:
        return None
    v = params[name]
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != int(v) or not lo <= int(v) <= hi:
        raise BuildError(f"params.{name} must be a whole number from {lo} to {hi}, got {v!r}")
    return int(v)


def rack_rgb(plan: Plan, name: str, default: str) -> str:
    """A colour param: the whole number 0xRRGGBB (e.g. 4890544 = #4a99b0), as '#rrggbb'; the default when the plan gives none."""
    params = plan.get("params") or {}
    if name not in params:
        return default
    v = params[name]
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != int(v) or not 1 <= int(v) <= 0xFFFFFF:
        raise BuildError(f"params.{name} must be a colour as a whole number from 1 to 16777215 (0xRRGGBB), got {v!r}")
    return "#%06x" % int(v)


def stadium_outline(cx: float, cy: float, length: float, height: float, n: int) -> list[tuple[float, float]]:
    """A slot (two half circles joined by straight sides), counter-clockwise, n + 2 points; `length` is the overall length."""
    r = height / 2.0
    half = max(length / 2.0 - r, 0.0)
    m = n // 2
    pts = []
    for i in range(m + 1):
        a = -math.pi / 2.0 + math.pi * i / m
        pts.append((cx + half + r * math.cos(a), cy + r * math.sin(a)))
    for i in range(m + 1):
        a = math.pi / 2.0 + math.pi * i / m
        pts.append((cx - half + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def cut_recess(bm: bmesh.types.BMesh, pts: list[tuple[float, float]], to_g: Callable[[float, float], tuple[float, float, float]], into: tuple[float, float, float], depth: float, through: bool) -> tuple[list[bmesh.types.BMEdge], list[bmesh.types.BMEdge]]:
    """The walls (and the floor, unless `through`) of a recess whose outline `pts` (2D) is placed on a face by `to_g` (to glTF space), going `depth` along the
    glTF direction `into`. Returns the mouth edges and the floor-ring edges (a through hole is closed by filling the back face against them)."""
    n = len(pts)
    off = Vector(into) * depth
    mouth = [bm.verts.new(g2b(*to_g(a, b))) for a, b in pts]
    floor = [bm.verts.new(g2b(*(Vector(to_g(a, b)) + off))) for a, b in pts]
    band(bm, mouth, floor)
    if not through:
        bm.faces.new(floor[::-1])
    mouth_edges = [bm.edges.get((mouth[i], mouth[(i + 1) % n])) for i in range(n)]
    floor_edges = [bm.edges.get((floor[i], floor[(i + 1) % n])) for i in range(n)]
    return mouth_edges, floor_edges


def take_plane_face(bm: bmesh.types.BMesh, axis: int, value: float, z_range: tuple[float, float] | None = None, y_range: tuple[float, float] | None = None) -> list[bmesh.types.BMEdge]:
    """Removes the one flat face lying in the glTF plane (axis 0 = x, 1 = y, 2 = z) = value, whose centre z lies in z_range (when given), and returns its
    edges. Raises when there is not exactly one."""
    def comp(co: Vector) -> float:
        return (co.x, co.z, -co.y)[axis]
    found = []
    for f in bm.faces:
        if not all(abs(comp(v.co) - value) < FLAT_FACE_TOL for v in f.verts):
            continue
        if z_range is not None:
            zc = sum(-v.co.y for v in f.verts) / len(f.verts)
            if not z_range[0] - FLAT_FACE_TOL <= zc <= z_range[1] + FLAT_FACE_TOL:
                continue
        if y_range is not None:
            yc = sum(v.co.z for v in f.verts) / len(f.verts)
            if not y_range[0] - FLAT_FACE_TOL <= yc <= y_range[1] + FLAT_FACE_TOL:
                continue
        found.append(f)
    if len(found) != 1:
        raise BuildError(f"expected one flat face in the plane {'xyz'[axis]} = {value / MM:.2f} mm, found {len(found)}")
    edges = list(found[0].edges)
    bmesh.ops.delete(bm, geom=found, context="FACES_ONLY")
    return edges


def rack_bevel(bm: bmesh.types.BMesh, faces: list[bmesh.types.BMFace], width: float, segments: int) -> None:
    edges = list(dict.fromkeys(e for f in faces for e in f.edges))
    bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type="OFFSET", segments=segments, affect="EDGES")


def rack_to_face(face: str, flipped: bool, w: float, d: float, gx: float, gy: float, gz: float) -> tuple[float, float]:
    """A point of the model in the frame it is built in (front panel at -z) -> face-local (u, v) in metres on `face` of the FINISHED model
    (rotated 180 degrees about y when the front is the io face): x from the left as seen from outside, y up (top: v from the io edge toward the front)."""
    if flipped:
        gx, gz = -gx, -gz
    if face == "io":
        return gx + w / 2.0, gy
    if face == "opposite":
        return w / 2.0 - gx, gy
    if face == "top":
        return gx + w / 2.0, d / 2.0 - gz
    if face == "bottom":
        return gx + w / 2.0, gz + d / 2.0
    if face == "left":
        return d / 2.0 + gz, gy
    return d / 2.0 - gz, gy   # right


def rack_zone_check(plan: Plan, flipped: bool, w: float, d: float, face: str, what: str, corners: list[tuple[float, float, float]]) -> None:
    """Raises when the rectangle spanned by `corners` (glTF points of one feature on `face`, built frame) overlaps a flat zone of that face."""
    zones = plan.get("flatZones") or []
    if not zones:
        return
    uv = [rack_to_face(face, flipped, w, d, *c) for c in corners]
    u0, u1 = min(p[0] for p in uv) / MM, max(p[0] for p in uv) / MM
    v0, v1 = min(p[1] for p in uv) / MM, max(p[1] for p in uv) / MM
    for z in zones:
        if z.get("face") != face:
            continue
        if u0 < z["x1"] and u1 > z["x0"] and v0 < z["y1"] and v1 > z["y0"]:
            raise BuildError(f"{what} (x {u0:.1f} to {u1:.1f}, y {v0:.1f} to {v1:.1f} mm on the {face} face) overlaps a flat zone of a control (x {z['x0']:.1f} to {z['x1']:.1f}, y {z['y0']:.1f} to {z['y1']:.1f} mm): the controls rig draws that area")


def build_rack_device(plan: Plan) -> bpy.types.Object:
    """The detailed rack unit (see RACK_V2_NAMES): plate with ears and slots, chassis, handles, vents, feet, fillets. Pivot bottom-centre, front panel
    face on the bounding box (z = -d/2, or +d/2 with frontOnIo = 1), rear panel face on the opposite side."""
    w, h, d = size_m(plan)
    params = plan.get("params") or {}
    unknown = [k for k in params if k != "chamferMm" and k not in RACK_V2_NAMES]
    if unknown:
        raise BuildError(f"rack-box has no param {unknown[0]!r}")
    plate_col = rack_rgb(plan, "plateRgb", RACK_PLATE)
    body_col = rack_rgb(plan, "bodyRgb", CHASSIS)
    flipped = rack_whole(plan, "frontOnIo", 1, 1) == 1
    front_face = "io" if flipped else "opposite"
    plate_t = rack_opt(plan, "earThicknessMm") or RACK_PLATE_T_MM * MM
    plate_inset = rack_opt(plan, "plateInsetMm") or 0.0
    feet = rack_opt(plan, "feetMm") or 0.0
    rear_inset = rack_opt(plan, "rearInsetMm") or 0.0
    handle_count = rack_whole(plan, "handleCount", 2, 2)
    handle_proj = rack_opt(plan, "handleProjectionMm") or 0.0
    handle_r = (rack_opt(plan, "handleDiaMm") or 10.0 * MM) / 2.0
    fillet = rack_opt(plan, "filletMm")
    seg_n = rack_whole(plan, "filletSegments", 1, 12) or 3
    if handle_count and handle_proj < 2.0 * handle_r + 2.0 * MM:
        raise BuildError(f"params.handleProjectionMm ({handle_proj / MM:.1f}) must be at least the handle diameter plus 2 mm ({(2 * handle_r + 2 * MM) / MM:.1f})")
    if handle_proj and not handle_count:
        raise BuildError("params.handleProjectionMm has no effect without params.handleCount")

    # widths: the ears are the plate beyond the chassis
    body_w = rack_opt(plan, "bodyWidthMm")
    ear_w = rack_opt(plan, "earWidthMm")
    if body_w is not None and body_w > w + 1e-9:
        raise BuildError(f"params.bodyWidthMm ({body_w / MM:.1f}) cannot be wider than the width ({w / MM:.1f})")
    if body_w is not None and ear_w is not None and abs((w - body_w) / 2.0 - ear_w) > 0.5 * MM:
        raise BuildError(f"params.earWidthMm ({ear_w / MM:.1f}) and params.bodyWidthMm ({body_w / MM:.1f}) disagree: each ear is (w - bodyWidthMm) / 2 = {(w - body_w) / 2.0 / MM:.1f} mm")
    if body_w is None:
        body_w = w - 2.0 * ear_w if ear_w is not None else w
    if body_w < w * 0.3:
        raise BuildError("the chassis is narrower than a third of the width")
    ear_w = (w - body_w) / 2.0

    seg = seg_n if fillet is not None else 1
    cham = fillet if fillet is not None else param_m(plan, "chamferMm", DEFAULT_CHAMFER_MM)
    plate_fillet = rack_opt(plan, "plateFilletMm")
    plate_cham = plate_fillet if plate_fillet is not None else min(cham, 0.45 * plate_t)
    if plate_cham >= 0.5 * plate_t:
        raise BuildError(f"the plate edge fillet ({plate_cham / MM:.2f} mm) must be less than half the plate thickness ({plate_t / MM:.2f} mm)")
    seam = rack_opt(plan, "seamMm")
    if cham >= min(body_w, h, d) / 2.0:
        raise BuildError(f"the fillet or chamfer ({cham / MM:.2f} mm) must be smaller than half the smallest side")

    z_front = -d / 2.0 + handle_proj          # the plate's front face
    y_plate0 = feet                            # plate bottom
    y_c0, y_c1 = feet + plate_inset, h - plate_inset
    z_c0, z_c1 = z_front + plate_t, d / 2.0 - rear_inset
    if y_c1 - y_c0 < 4.0 * cham or z_c1 - z_c0 < 4.0 * cham:
        raise BuildError("the chassis is too small for the plate inset, the feet, the rear inset or the fillet")

    body = Body("rack-box")
    bm = body.bm

    # --- the front plate, with the slotted ear holes -------------------------------------------------------------------
    plate_pts = [(-w / 2.0, y_plate0), (w / 2.0, y_plate0), (w / 2.0, h), (-w / 2.0, h)]
    pf = extrude_xy(bm, plate_pts, z_front, z_front + plate_t)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    rack_bevel(bm, pf, plate_cham, seg)
    body.done(plate_col)
    hole_h = rack_opt(plan, "earHoleMm")
    diagonal = rack_whole(plan, "earDiagonal", 1, 1) == 1
    holes = 0
    if hole_h is not None:
        edge = rack_opt(plan, "earHoleEdgeMm")
        if edge is None:
            edge = (w - RACK_EIA_SPACING_MM * MM) / 2.0 if w > (RACK_EIA_SPACING_MM + 10.0) * MM else max(ear_w / 2.0, hole_h * RACK_SLOT_ASPECT / 2.0 + MM)
        slot_len = hole_h * RACK_SLOT_ASPECT
        units = max(1, round(h / (RACK_EIA_U_MM * MM)))   # rack units, counted from the bottom of the bounding box (the feet, when there are any)
        row_mm = rack_opt(plan, "earHoleRowMm") or RACK_EIA_HOLE_ROW_MM * MM   # distance of the slot centres from the plate's bottom and top (EIA: 6.35 mm from the edge of a rack unit)
        rows = [row_mm, units * RACK_EIA_U_MM * MM - row_mm]
        if rows[1] > h - hole_h / 2.0 - plate_cham or rows[0] < y_plate0 + hole_h / 2.0 + plate_cham:
            rows = [y_plate0 + (h - y_plate0) / 2.0] * 2   # a plate too short for two rows: one slot per ear, at mid height
        through = ear_w > 1e-9
        # face-local u (from the left, seen from the front) of each slot centre; the built frame has gx = w / 2 - u
        spots = [(edge, rows[1]), (w - edge, rows[0])] if diagonal else [(edge, rows[1]), (edge, rows[0]), (w - edge, rows[1]), (w - edge, rows[0])]
        slots = list(dict.fromkeys((w / 2.0 - u, row) for u, row in spots))
        slot_t = plate_t if through else min(plate_t, 3.0 * MM)
        for gx, gy in slots:
            x0, x1 = gx - slot_len / 2.0, gx + slot_len / 2.0
            y0, y1 = gy - hole_h / 2.0, gy + hole_h / 2.0
            if through:
                if x0 * x1 < 0 or min(abs(x0), abs(x1)) < body_w / 2.0 + RACK_FIT_MM * MM or max(abs(x0), abs(x1)) > w / 2.0 - RACK_FIT_MM * MM:
                    raise BuildError(f"an ear slot (x {abs(x0) / MM:.1f} to {abs(x1) / MM:.1f} mm from the centre) does not lie in the ear (chassis half width {body_w / 2 / MM:.1f}, plate half width {w / 2 / MM:.1f}): change earHoleEdgeMm or earHoleMm")
            elif max(abs(x0), abs(x1)) > w / 2.0 - RACK_FIT_MM * MM:
                raise BuildError("an ear slot does not fit in the plate")
            rack_zone_check(plan, flipped, w, d, front_face, "an ear slot", [(x0, y0, z_front), (x1, y1, z_front)])
            holes += 1
        front_edges = take_plane_face(bm, 2, z_front, (z_front, z_front + plate_t))
        back_edges = take_plane_face(bm, 2, z_front + plate_t, (z_front, z_front + plate_t)) if through else []
        loops_front: list[list[bmesh.types.BMEdge]] = []
        loops_back: list[list[bmesh.types.BMEdge]] = []
        for gx, gy in slots:
            outline = stadium_outline(gx, gy, slot_len, hole_h, RACK_SLOT_SEGMENTS)
            m_edges, f_edges = cut_recess(bm, outline, lambda a, b: (a, b, z_front), (0.0, 0.0, 1.0), slot_t, through)
            loops_front.append(m_edges)
            loops_back.append(f_edges)
        body.done(RACK_SLOT)
        fill_with_holes(bm, front_edges, loops_front, (0.0, 0.0, -1.0))
        if through:
            fill_with_holes(bm, back_edges, loops_back, (0.0, 0.0, 1.0))
        body.done(plate_col)

    # --- the chassis (and, with rearInsetMm, the rear panel as a shell of its own: a seam) ----------------------------------
    min_fillet = plate_cham
    y_seam = y_c0 + seam if seam is not None else None
    if y_seam is not None and not y_c0 + 3.0 * cham < y_seam < y_c1 - 3.0 * cham:
        raise BuildError(f"params.seamMm ({seam / MM:.1f}) must leave room for the fillet above and below it in the chassis height")
    shells = [(z_c0, z_c1, y_c0, y_seam), (z_c0, z_c1, y_seam, y_c1)] if y_seam is not None else [(z_c0, z_c1, y_c0, y_c1)]
    if rear_inset > 0.0:
        shells.append((z_c1, d / 2.0, y_c0, y_c1))
    for za, zb, ya, yb in shells:
        pts = [(-body_w / 2.0, ya), (body_w / 2.0, ya), (body_w / 2.0, yb), (-body_w / 2.0, yb)]
        faces = extrude_xy(bm, pts, za, zb)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        # a shell thinner than twice the fillet (the rear panel) takes a smaller one: a bevel wider than half the wall folds the big faces inside out
        shell_cham = min(cham, 0.45 * (zb - za), 0.45 * (yb - ya))
        rack_bevel(bm, faces, shell_cham, seg)
        body.done(body_col)
        min_fillet = min(min_fillet, shell_cham)

    # --- vents: rectangular recesses in the top (or both sides) of the chassis ------------------------------------------
    vent_n = rack_whole(plan, "ventSlots", 1, 40)
    vents = 0
    if vent_n:
        cols = rack_whole(plan, "ventColumns", 1, 20) or 1
        v_len = rack_opt(plan, "ventSlotLenMm") or 40.0 * MM
        v_wid = rack_opt(plan, "ventSlotWidthMm") or 3.0 * MM
        v_pitch = rack_opt(plan, "ventPitchMm") or v_wid * 2.0
        v_cpitch = rack_opt(plan, "ventColPitchMm") or v_len * 1.25
        v_depth = rack_opt(plan, "ventDepthMm") or 2.0 * MM
        sides = rack_whole(plan, "ventSides", 1, 1) == 1
        block_len = (cols - 1) * v_cpitch + v_len
        block_w = (vent_n - 1) * v_pitch + v_wid
        zs0, zs1 = z_c0, z_c1   # the flat run of the chassis (the rear shell, when there is one, has no vents)
        from_rear = rack_opt(plan, "ventFromRearMm")
        z_end = zs1 - cham - from_rear if from_rear is not None else (zs0 + zs1) / 2.0 + block_len / 2.0
        z_start = z_end - block_len
        if z_start < zs0 + cham + RACK_FIT_MM * MM or z_end > zs1 - cham + 1e-9:
            raise BuildError(f"the vent block ({block_len / MM:.1f} mm long) does not fit in the flat part of the chassis ({(zs1 - zs0 - 2 * cham) / MM:.1f} mm)")
        vy0 = y_seam if y_seam is not None else y_c0   # with a seam the vents are in the upper shell (the lid)
        if sides:
            avail = y_c1 - vy0 - 2.0 * cham
            if block_w > avail:
                raise BuildError(f"the vent slots ({block_w / MM:.1f} mm tall) do not fit in the side wall ({avail / MM:.1f} mm)")
            a_start = (vy0 + y_c1) / 2.0 - block_w / 2.0
        else:
            avail = body_w - 2.0 * cham
            if block_w > avail:
                raise BuildError(f"the vent slots ({block_w / MM:.1f} mm wide) do not fit in the top ({avail / MM:.1f} mm)")
            a_start = -block_w / 2.0
        slot_list: list[tuple[float, float, float, float]] = []   # (a0, a1, z0, z1): a = x for the top, y for the sides
        for c in range(cols):
            for k in range(vent_n):
                a0 = a_start + k * v_pitch
                z0 = z_start + c * v_cpitch
                slot_list.append((a0, a0 + v_wid, z0, z0 + v_len))
        targets = [("x", -1.0), ("x", 1.0)] if sides else [("y", 1.0)]
        for kind, sign in targets:
            if kind == "y":
                plane, axis, face = y_c1, 1, "top"
                to_g = lambda a, b, p=plane: (a, p, b)
                into = (0.0, -1.0, 0.0)
            else:
                plane, axis, face = sign * body_w / 2.0, 0, "right" if sign > 0 else "left"
                to_g = lambda a, b, p=plane: (p, a, b)
                into = (-sign, 0.0, 0.0)
            for a0, a1, z0, z1 in slot_list:
                rack_zone_check(plan, flipped, w, d, face, "a vent slot", [to_g(a0, z0), to_g(a1, z1)])
            edges = take_plane_face(bm, axis, plane, (z_c0, z_c1), (vy0, y_c1))
            loops = []
            for a0, a1, z0, z1 in slot_list:
                rect = [(a0, z0), (a1, z0), (a1, z1), (a0, z1)]
                m_edges, _f = cut_recess(bm, rect, to_g, into, v_depth, False)
                loops.append(m_edges)
            body.done(RACK_SLOT)
            nrm = (0.0, 1.0, 0.0) if kind == "y" else (sign, 0.0, 0.0)
            fill_with_holes(bm, edges, loops, nrm)
            body.done(body_col)
            vents += len(slot_list)

    # --- feet ---------------------------------------------------------------------------------------------------------------------
    if feet > 0.0:
        fd = (rack_opt(plan, "feetDiaMm") or 14.0 * MM) / 2.0
        inset = max(fd + 8.0 * MM, 20.0 * MM)
        for sx in (-1.0, 1.0):
            for zc in (z_c0 + inset, z_c1 - inset):
                cylinder_between(bm, g2b(sx * (body_w / 2.0 - inset), 0.0, zc), g2b(sx * (body_w / 2.0 - inset), y_c0 + 0.0005, zc), fd, fd, RACK_FEET_SEGMENTS)
        body.done(FOOT)

    # --- handles ------------------------------------------------------------------------------------------------------------------
    if handle_count:
        margin = max(6.0 * MM, 0.15 * (h - y_plate0))
        zc = -d / 2.0 + handle_r
        for sx in (-1.0, 1.0):
            hx = sx * (w / 2.0 - handle_r - 4.0 * MM)
            ya, yb = y_plate0 + margin, h - margin
            if yb - ya < 4.0 * handle_r:
                raise BuildError("the plate is too short for a handle of this size")
            rack_zone_check(plan, flipped, w, d, front_face, "a handle", [(hx - handle_r, ya, -d / 2.0), (hx + handle_r, yb, -d / 2.0)])
            cylinder_between(bm, g2b(hx, ya, zc), g2b(hx, yb, zc), handle_r, handle_r, RACK_HANDLE_SEGMENTS)
            for yy in (ya + handle_r, yb - handle_r):
                cylinder_between(bm, g2b(hx, yy, zc), g2b(hx, yy, z_front + 0.2 * MM), handle_r * 0.8, handle_r * 0.8, RACK_HANDLE_SEGMENTS)
        body.done(RACK_HANDLE)

    if flipped:
        for v in bm.verts:
            v.co.x = -v.co.x
            v.co.y = -v.co.y
    if fillet is not None:
        MEASURE["filletMm"] = round(min_fillet / MM, 4)
    MEASURE["ioFaceOffsetMm"] = round(plate_t / MM, 4)
    MEASURE["earHoles"] = float(holes)
    MEASURE["ventSlots"] = float(vents)
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
FOOT = "#2b2b30"             # rubber foot of a curved cabinet
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


# --- curved-cabinet ---------------------------------------------------------------------------------------

CURVED_SEG90 = 10                 # arc samples per quarter turn of a plan corner
CURVED_DEFAULT_FRONT_R_MM = 24.0  # mirrored in shapes.ts CURVED_DEFAULTS
CURVED_DEFAULT_BACK_R_MM = 24.0
CURVED_DEFAULT_EDGE_MM = 16.0
CURVED_DEFAULT_SEGMENTS = 8
CURVED_DEFAULT_RING_MM = 2.0
CURVED_DEFAULT_GUIDE_MM = 8.0
CURVED_DEFAULT_MID_FRACTION = 0.4
CURVED_RING_SEGMENTS = 32
CURVED_FIT_MARGIN_MM = 0.5
MEASURE: dict[str, float] = {}    # what the builder measured on its mesh; run() writes it next to the GLB (<out>.measure.json)


def rounded_polygon(pts: list[tuple[float, float]], radii: list[float], seg90: int = CURVED_SEG90) -> list[tuple[float, float]]:
    """Rounds the corners of the convex counter-clockwise polygon `pts` of (x, z) points: corner i gets a tangent arc of radius radii[i]
    (0 = left sharp). Returns the outline, an arc sampled with at least two steps and about `seg90` per quarter turn. Raises BuildError when the
    two tangent lengths of an edge are longer than the edge."""
    n = len(pts)
    corners: list[tuple[tuple[float, float], tuple[float, float], tuple[float, float], float, float] | None] = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        r = radii[i]
        ax, az = p0[0] - p1[0], p0[1] - p1[1]
        bx, bz = p2[0] - p1[0], p2[1] - p1[1]
        la, lb = math.hypot(ax, az), math.hypot(bx, bz)
        if la < 1e-9 or lb < 1e-9:
            raise BuildError("the plan polygon has two corners at the same place")
        ax, az, bx, bz = ax / la, az / la, bx / lb, bz / lb
        ang = math.acos(max(-1.0, min(1.0, ax * bx + az * bz)))   # interior angle
        if r <= 0.0 or ang > math.pi - 1e-6:
            corners.append(None)
            continue
        t = r / math.tan(ang / 2.0)
        corners.append(((p1[0] + ax * t, p1[1] + az * t), (p1[0] + bx * t, p1[1] + bz * t), _arc_centre(p1, (ax, az), (bx, bz), r, ang), t, ang))
    for i in range(n):
        nxt = (i + 1) % n
        t_here = corners[i][3] if corners[i] else 0.0
        t_next = corners[nxt][3] if corners[nxt] else 0.0
        edge = math.hypot(pts[nxt][0] - pts[i][0], pts[nxt][1] - pts[i][1])
        if t_here + t_next > edge + 1e-9:
            raise BuildError(f"the plan corner radii are too large: corners {i} and {nxt} need {(t_here + t_next) / MM:.1f} mm of an edge that is {edge / MM:.1f} mm long")
    out: list[tuple[float, float]] = []
    for i in range(n):
        c = corners[i]
        if c is None:
            out.append(pts[i])
            continue
        a, b, centre, _t, ang = c
        a0 = math.atan2(a[1] - centre[1], a[0] - centre[0])
        a1 = math.atan2(b[1] - centre[1], b[0] - centre[0])
        delta = (a1 - a0 + math.pi) % (2.0 * math.pi) - math.pi
        r = math.hypot(a[0] - centre[0], a[1] - centre[1])
        steps = max(2, math.ceil(abs(delta) / (math.pi / 2.0) * seg90))
        for s in range(steps + 1):
            ph = a0 + delta * s / steps
            out.append((centre[0] + r * math.cos(ph), centre[1] + r * math.sin(ph)))
    clean: list[tuple[float, float]] = []
    for p in out:
        if not clean or math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 1e-7:
            clean.append(p)
    if len(clean) > 1 and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) <= 1e-7:
        clean.pop()
    return clean


def _arc_centre(p1: tuple[float, float], a: tuple[float, float], b: tuple[float, float], r: float, ang: float) -> tuple[float, float]:
    """Centre of the fillet circle of radius r tangent to both edges at the corner p1 (a, b = unit vectors along the edges away from it)."""
    bx, bz = a[0] + b[0], a[1] + b[1]
    lb = math.hypot(bx, bz)
    d = r / math.sin(ang / 2.0)
    return (p1[0] + bx / lb * d, p1[1] + bz / lb * d)


def offset_outline(pts: list[tuple[float, float]], s: float) -> list[tuple[float, float]]:
    """The counter-clockwise outline `pts` moved inward by s (mitre at every vertex). Raises BuildError when an edge flips: the inset is deeper than
    a corner of the outline is round."""
    n = len(pts)
    if s <= 0.0:
        return list(pts)
    normals = []
    for i in range(n):
        dx, dz = pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]
        ln = math.hypot(dx, dz)
        normals.append((-dz / ln, dx / ln))
    out = []
    for i in range(n):
        n0, n1 = normals[i - 1], normals[i]
        k = 1.0 + n0[0] * n1[0] + n0[1] * n1[1]
        if k < 1e-6:
            raise BuildError("the plan outline turns back on itself: cannot inset it")
        out.append((pts[i][0] + (n0[0] + n1[0]) / k * s, pts[i][1] + (n0[1] + n1[1]) / k * s))
    for i in range(n):
        j = (i + 1) % n
        ex, ez = pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]
        ox, oz = out[j][0] - out[i][0], out[j][1] - out[i][1]
        if ex * ox + ez * oz <= 0.0:
            raise BuildError(f"the fillet folds over at the plan corner near x = {pts[i][0] / MM:.1f} mm, z = {pts[i][1] / MM:.1f} mm: the plan corner radius there is tighter than the {s / MM:.1f} mm inset (raise frontRadiusMm / sideRadiusMm / backRadiusMm or lower edgeRadiusMm)")
    return out


def flat_face_polygon(bm: bmesh.types.BMesh, z: float) -> list[tuple[float, float]]:
    """Joins the wall faces lying in the plane z (a barrelled cabinet has one quad per wall step) into the one flat face, and returns its outline as (x, y) points
    in glTF metres. Raises when there is no such face."""
    found = [f for f in bm.faces if all(abs(-v.co.y - z) < FLAT_FACE_TOL for v in f.verts)]
    if not found:
        raise BuildError(f"expected a flat face in the plane z = {z / MM:.2f} mm, found none")
    if len(found) > 1:
        bmesh.ops.dissolve_faces(bm, faces=found, use_verts=False)
        found = [f for f in bm.faces if all(abs(-v.co.y - z) < FLAT_FACE_TOL for v in f.verts)]
        if len(found) != 1:
            raise BuildError(f"the wall faces in the plane z = {z / MM:.2f} mm did not join into one face")
    return [(v.co.x, v.co.z) for v in found[0].verts]


def circle_fits(poly: list[tuple[float, float]], cx: float, cy: float, radius: float, margin: float) -> bool:
    """True when the circle (centre cx, cy, radius) lies inside the polygon `poly` (x, y points) with `margin` to spare."""
    for k in range(48):
        ph = 2.0 * math.pi * k / 48
        x, y = cx + radius * math.cos(ph), cy + radius * math.sin(ph)
        inside = False
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            if (a[1] > y) != (b[1] > y) and x < a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]):
                inside = not inside
        if not inside or point_to_polygon_distance((x, y), poly) < margin:
            return False
    return True


def dish_hole(bm: bmesh.types.BMesh, cx: float, cy: float, z: float, r_mouth: float, r_floor: float, n: int, depth: float, sign: float) -> list[bmesh.types.BMEdge]:
    """A round recess whose mouth ring (radius r_mouth) is at z and whose floor ring (radius r_floor, a cone when it differs) is `depth` away along
    sign. Walls and floor are built; the mouth's edges are returned for fill_with_holes."""
    mouth = ring(bm, r_mouth, z, n, cx, cy)
    floor = ring(bm, r_floor, z + sign * depth, n, cx, cy)
    band(bm, mouth, floor)
    bm.faces.new(floor[::-1])
    return [bm.edges.get((mouth[i], mouth[(i + 1) % n])) for i in range(n)]


def build_curved_cabinet(plan: Plan) -> bpy.types.Object:
    """A loudspeaker cabinet w x h x d with a curved plan and filleted top and bottom edges, bottom at y = 0, centred on x and z, the io (rear)
    face at z = +d/2 and the baffle at z = -d/2.

    Plan (seen from above, x to the right, the baffle at the top): a convex polygon with the baffle corners planFrontMm apart (default w - 2 x sideBulgeMm),
    the widest points sideBulgeMm outside them at midDepthMm behind the baffle (default 0.4 d), and the rear corners rearWidthMm apart (default the widest
    width), each corner rounded by its own radius: frontRadiusMm (default 24), sideRadiusMm (default: the roundest the edges allow, which makes the
    sides arcs) and backRadiusMm (default 24). The outline is stretched in x to exactly w. The baffle may bow forward crownMm.
    Edges: the top and the bottom are rounded by an elliptic profile, edgeRadiusMm inward by edgeDropMm down (default the same), in edgeSegments
    steps (default 8). The measured fillet (the smaller of the two, as built) goes to MEASURE for the 'fillet' gate.
    Baffle: wooferRingMm / tweeterRingMm round recesses (ringDepthMm deep, default 2) centred on x = 0 at wooferYMm / tweeterYMm; with waveguideMm the
    tweeter recess is a cone from that diameter at the baffle down to the tweeter ring, waveguideDepthMm (default 8) deep.
    Rear: a round pocket behind every io port with an insetMm (floor insetMm behind the face, diameter openingMm or 24 mm), exactly as speaker-cabinet.
    One colour (CABINET) and a darker one for recesses and pockets; a projection puts the real baffle, rear panel and side on it."""
    w, h, d = size_m(plan)
    params = plan.get("params") or {}

    def opt(name: str, default_mm: float) -> float:
        return param_m(plan, name, default_mm) if name in params else default_mm * MM

    edge = opt("edgeRadiusMm", CURVED_DEFAULT_EDGE_MM)
    drop = opt("edgeDropMm", edge / MM)
    half_min = min(w, h, d) / 2.0
    if edge >= half_min:
        raise BuildError(f"params.edgeRadiusMm ({edge / MM:.1f}) must be less than half the smallest side ({half_min / MM:.1f} mm)")
    foot_h = param_m(plan, "footMm", 0.0) if "footMm" in params else 0.0
    if foot_h >= h / 3.0:
        raise BuildError(f"params.footMm ({foot_h / MM:.1f}) must be less than a third of the height")
    if drop * 2.0 >= h - foot_h:
        raise BuildError(f"params.edgeDropMm ({drop / MM:.1f}) must be less than half the height above the foot ({(h - foot_h) / 2.0 / MM:.1f} mm)")
    grey = params.get("bodyGrey")
    if grey is not None and (isinstance(grey, bool) or not isinstance(grey, (int, float)) or not 20 <= grey <= 200):
        raise BuildError(f"params.bodyGrey must be a number from 20 to 200, got {grey!r}")
    cabinet_colour = CABINET if grey is None else "#%02x%02x%02x" % (round(grey), round(grey) + 2, round(grey) + 9)
    segments = params.get("edgeSegments", CURVED_DEFAULT_SEGMENTS)
    if isinstance(segments, bool) or not isinstance(segments, int) or not 4 <= segments <= 16:
        raise BuildError(f"params.edgeSegments must be a whole number from 4 to 16, got {segments!r}")
    front_r = opt("frontRadiusMm", CURVED_DEFAULT_FRONT_R_MM)
    back_r = opt("backRadiusMm", CURVED_DEFAULT_BACK_R_MM)
    for name, r in (("frontRadiusMm", front_r), ("backRadiusMm", back_r)):
        if r < edge - 1e-9:
            raise BuildError(f"params.{name} ({r / MM:.1f}) must be at least edgeRadiusMm ({edge / MM:.1f}): the fillet would fold over")
    bulge = opt("sideBulgeMm", 0.0) if "sideBulgeMm" in params else 0.0
    front_w = param_m(plan, "planFrontMm", 0.0) if "planFrontMm" in params else w - 2.0 * bulge
    a = front_w / 2.0
    if "midWidthMm" in params:
        if "sideBulgeMm" in params:
            raise BuildError("params.midWidthMm and params.sideBulgeMm both set the widest points: give one")
        b = param_m(plan, "midWidthMm", 0.0) / 2.0   # the widest points may be narrower than the baffle corners: a cabinet that tapers from the front
    else:
        b = a + bulge
    c = param_m(plan, "rearWidthMm", 0.0) / 2.0 if "rearWidthMm" in params else b
    crown = param_m(plan, "crownMm", 0.0) if "crownMm" in params else 0.0
    ring_depth = opt("ringDepthMm", CURVED_DEFAULT_RING_MM)
    has_ring = "wooferRingMm" in params or "tweeterRingMm" in params
    if crown > 0.0 and has_ring:
        raise BuildError("params.crownMm bows the baffle, but a ring is cut into a flat baffle: use no crownMm with a woofer or tweeter ring")
    mid_z = -d / 2.0 + (param_m(plan, "midDepthMm", 0.0) if "midDepthMm" in params else CURVED_DEFAULT_MID_FRACTION * d)
    if not -d / 2.0 < mid_z < d / 2.0:
        raise BuildError("params.midDepthMm must lie inside the depth")
    z_front = -d / 2.0 + crown
    poly = [(-a, z_front), (a, z_front), (b, mid_z), (c, d / 2.0), (-c, d / 2.0), (-b, mid_z)]
    # the roundness of the side corners: the roundest the two edges allow when the plan gives none
    if "sideRadiusMm" in params:
        side_r = param_m(plan, "sideRadiusMm", 0.0)
        if side_r < edge - 1e-9:
            raise BuildError(f"params.sideRadiusMm ({side_r / MM:.1f}) must be at least edgeRadiusMm ({edge / MM:.1f})")
    else:
        v1 = (a - b, z_front - mid_z)
        v2 = (c - b, d / 2.0 - mid_z)
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        ang = math.acos(max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2))))
        # the tangent length of a corner is r x tan(pi / 2 - ang / 2): taking 0.4 of the shorter edge leaves room for the neighbouring corners' arcs
        side_r = 0.0 if ang > math.pi - 1e-6 else 0.4 * min(l1, l2) * math.tan(ang / 2.0)
    for i in range(6):
        e0 = (poly[(i + 1) % 6][0] - poly[i][0], poly[(i + 1) % 6][1] - poly[i][1])
        e1 = (poly[(i + 2) % 6][0] - poly[(i + 1) % 6][0], poly[(i + 2) % 6][1] - poly[(i + 1) % 6][1])
        if e0[0] * e1[1] - e0[1] * e1[0] < -1e-12:
            raise BuildError('the plan polygon is not convex: the widest points must lie outside the baffle corners and the rear must not be wider than them (planFrontMm, sideBulgeMm, rearWidthMm)')
    radii = [front_r, front_r, side_r, back_r, back_r, side_r]
    outline = rounded_polygon(poly, radii)
    if crown > 0.0:
        # sample the flat baffle edge as a parabola bowing forward by `crown` in the middle
        outline = bow_baffle(outline, z_front, crown)
    span = max(abs(p[0]) for p in outline)
    if span <= 1e-9:
        raise BuildError("the plan outline has no width")
    stretch = (w / 2.0) / span
    if not 0.85 < stretch < 1.15:
        raise BuildError(f"the plan outline is {span * 2.0 / MM:.1f} mm wide, the spec width is {w / MM:.1f} mm: planFrontMm and sideBulgeMm leave the shape too far from it")
    outline = [(p[0] * stretch, p[1]) for p in outline]
    if sum(outline[i][0] * outline[(i + 1) % len(outline)][1] - outline[(i + 1) % len(outline)][0] * outline[i][1] for i in range(len(outline))) <= 0.0:
        raise BuildError("the plan outline is not counter-clockwise: check the plan widths")

    body = Body("curved-cabinet")
    bm = body.bm
    n = len(outline)
    levels: list[tuple[float, float]] = []   # (inset, y) bottom to top: the elliptic fillet up the bottom edge, then down from the top
    for k in range(segments + 1):
        ph = (math.pi / 2.0) * k / segments
        levels.append((edge * (1.0 - math.sin(ph)), drop * (1.0 - math.cos(ph))))
    bottom = [(ins, foot_h + dy) for ins, dy in levels]
    top = [(ins, h - dy) for ins, dy in reversed(levels)]
    # a barrelled wall gets intermediate rings (the arc is sampled in them); a straight wall is one band
    barrel_on = "barrelMm" in params
    wall_steps = 8 if barrel_on else 1
    wall_lo = foot_h + drop
    wall_hi = h - drop
    wall_ys = [wall_lo + (wall_hi - wall_lo) * k / wall_steps for k in range(1, wall_steps)]
    barrel = param_m(plan, "barrelMm", 0.0) if "barrelMm" in params else 0.0
    barrel_y = param_m(plan, "barrelCentreMm", 0.0) if "barrelCentreMm" in params else h / 2.0
    if barrel_on and wall_lo + MM < barrel_y < wall_hi - MM and all(abs(barrel_y - y) > MM for y in wall_ys):
        wall_ys = sorted(wall_ys + [barrel_y])   # a ring exactly at the widest height, so the cabinet reaches its width
    wall_mid = [(0.0, y) for y in wall_ys]
    stations = bottom + wall_mid + top
    cache: dict[float, list[tuple[float, float]]] = {}
    rings: list[list[bmesh.types.BMVert]] = []
    if barrel >= w / 4.0:
        raise BuildError(f"params.barrelMm ({barrel / MM:.1f}) must be less than a quarter of the width")
    barrel_far = max(barrel_y, h - barrel_y)

    def barrel_factor(y: float) -> float:
        # the elevation of the real sides is a shallow arc: widest at barrel_y, barrelMm narrower (each side) at the farther end of the height
        return 1.0 - barrel * ((y - barrel_y) / barrel_far) ** 2 / (w / 2.0)

    for ins, y in stations:
        key = round(ins, 12)
        if key not in cache:
            cache[key] = offset_outline(outline, ins)
        f = barrel_factor(y)
        rings.append([bm.verts.new(g2b(x * f, y, z)) for x, z in cache[key]])
    bm.faces.new(rings[0][::-1])
    for i in range(len(rings) - 1):
        band(bm, rings[i], rings[i + 1])
    bm.faces.new(rings[-1])

    # measure what was built: the setback of the top face from the wall, and how far down the wall starts
    wall_top = rings[len(bottom) + len(wall_mid)]
    wall_poly = [(v.co.x, -v.co.y) for v in wall_top]
    cap = [(v.co.x, -v.co.y) for v in rings[-1]]
    horizontal = min(point_to_polygon_distance(p, wall_poly) for p in cap)
    vertical = h - wall_top[0].co.z
    MEASURE["filletMm"] = round(min(horizontal, vertical) / MM, 3)
    body.done(cabinet_colour)

    if foot_h > 0.0:
        # the rubber foot (an Iso-Pod): a rounded pad under the body, its top 1 mm inside it so the two solids overlap
        foot_w = param_m(plan, "footWidthMm", 0.0) if "footWidthMm" in params else 0.6 * w
        foot_d = param_m(plan, "footDepthMm", 0.0) if "footDepthMm" in params else 0.55 * d
        corner = min(foot_w, foot_d) * 0.25
        pad = rounded_polygon([(-foot_w / 2.0, -foot_d / 2.0), (foot_w / 2.0, -foot_d / 2.0), (foot_w / 2.0, foot_d / 2.0), (-foot_w / 2.0, foot_d / 2.0)], [corner] * 4, 6)
        extrude_xz(bm, pad, 0.0, foot_h + 1.0 * MM)
        body.done(FOOT)

    pockets = [p for p in (plan.get("ports") or []) if isinstance(p.get("insetMm"), (int, float)) and p["insetMm"] > 0]
    if pockets:
        flat = flat_face_polygon(bm, d / 2.0)
        outline_edges = take_flat_face(bm, d / 2.0)
        holes = []
        for p in pockets:
            radius = float(p.get("openingMm") or POCKET_DEFAULT_MM) * MM / 2.0
            cx = float(p["xMm"]) * MM - w / 2.0
            cy = float(p["yMm"]) * MM
            if not circle_fits(flat, cx, cy, radius, CURVED_FIT_MARGIN_MM * MM):
                raise BuildError(f"the pocket of port {p.get('portId')!r} (x {cx / MM:.1f}, y {cy / MM:.1f}, radius {radius / MM:.1f} mm) does not fit in the flat rear face (x {min(q[0] for q in flat) / MM:.1f} to {max(q[0] for q in flat) / MM:.1f}, y {min(q[1] for q in flat) / MM:.1f} to {max(q[1] for q in flat) / MM:.1f} mm)")
            holes.append(blind_hole(bm, cx, cy, d / 2.0, radius, POCKET_SEGMENTS, float(p["insetMm"]) * MM, -1.0))
        body.done(CABINET_POCKET)
        fill_with_holes(bm, outline_edges, holes, (0.0, 0.0, 1.0))
        body.done(cabinet_colour)

    recesses: list[tuple[str, float, float, float, float]] = []   # (name, centre y, mouth radius, floor radius, depth)
    if "wooferRingMm" in params:
        r = param_m(plan, "wooferRingMm", 0.0) / 2.0
        recesses.append(("wooferRingMm", param_m(plan, "wooferYMm", 0.0), r, r, ring_depth))
    if "tweeterRingMm" in params:
        r = param_m(plan, "tweeterRingMm", 0.0) / 2.0
        if "waveguideMm" in params:
            recesses.append(("tweeterRingMm", param_m(plan, "tweeterYMm", 0.0), param_m(plan, "waveguideMm", 0.0) / 2.0, r, opt("waveguideDepthMm", CURVED_DEFAULT_GUIDE_MM)))
        else:
            recesses.append(("tweeterRingMm", param_m(plan, "tweeterYMm", 0.0), r, r, ring_depth))
    if recesses:
        for i, ra in enumerate(recesses):
            for rb in recesses[i + 1:]:
                if abs(ra[1] - rb[1]) < ra[2] + rb[2] + CURVED_FIT_MARGIN_MM * MM:
                    raise BuildError(f"the {ra[0]} and {rb[0]} recesses overlap on the baffle")
        flat = flat_face_polygon(bm, -d / 2.0)
        outline_edges = take_flat_face(bm, -d / 2.0)
        holes = []
        for name, cy, r_mouth, r_floor, depth in recesses:
            if not circle_fits(flat, 0.0, cy, r_mouth, CURVED_FIT_MARGIN_MM * MM):
                raise BuildError(f"params.{name}: the recess (radius {r_mouth / MM:.1f} mm at y {cy / MM:.1f}) does not fit the flat baffle (x {min(q[0] for q in flat) / MM:.1f} to {max(q[0] for q in flat) / MM:.1f}, y {min(q[1] for q in flat) / MM:.1f} to {max(q[1] for q in flat) / MM:.1f} mm): widen planFrontMm or lower frontRadiusMm")
            holes.append(dish_hole(bm, 0.0, cy, -d / 2.0, r_mouth, r_floor, CURVED_RING_SEGMENTS, depth, 1.0))
        body.done(CABINET_POCKET)
        fill_with_holes(bm, outline_edges, holes, (0.0, 0.0, -1.0))
        body.done(cabinet_colour)
    return body.finish()


def bow_baffle(outline: list[tuple[float, float]], z_front: float, crown: float) -> list[tuple[float, float]]:
    """Replaces the straight baffle edge (the longest run of outline points at z = z_front) by a parabola that bows forward by `crown` in the middle."""
    n = len(outline)
    best = None
    for i in range(n):
        p, q = outline[i], outline[(i + 1) % n]
        if abs(p[1] - z_front) < 1e-9 and abs(q[1] - z_front) < 1e-9 and (best is None or abs(q[0] - p[0]) > abs(outline[best[1]][0] - outline[best[0]][0])):
            best = (i, (i + 1) % n)
    if best is None:
        raise BuildError("crownMm: the plan has no flat baffle edge to bow")
    i, j = best
    x_a, x_b = outline[i][0], outline[j][0]
    half = abs(x_b - x_a) / 2.0
    mid = (x_a + x_b) / 2.0
    pts = []
    steps = 12
    for s in range(1, steps):
        x = x_a + (x_b - x_a) * s / steps
        pts.append((x, z_front - crown * (1.0 - ((x - mid) / half) ** 2)))
    return outline[:i + 1] + pts + outline[j:] if j > i else outline[:i + 1] + pts


def point_to_polygon_distance(p: tuple[float, float], poly: list[tuple[float, float]]) -> float:
    """Shortest distance from the point p to the closed polygon `poly` (its edges), in the plane."""
    best = float("inf")
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        l2 = dx * dx + dz * dz
        t = 0.0 if l2 == 0.0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
        best = min(best, math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz)))
    return best


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


def chamfered_rect(w: float, h: float, c: float) -> list[tuple[float, float]]:
    """A rectangle w x h centred on the origin with the two LOWER corners cut by c (the outline of IEC 60320 C13 / C14 and many D-sub shells), counter-clockwise."""
    return [(-w / 2 + c, -h / 2), (w / 2 - c, -h / 2), (w / 2, -h / 2 + c), (w / 2, h / 2), (-w / 2, h / 2), (-w / 2, -h / 2 + c)]


def offset_pts(pts: list[tuple[float, float]], t: float) -> list[tuple[float, float]]:
    """The polygon scaled about its centre so that every side moves inward by about t (exact for the axis-aligned sides of a centred outline)."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    sx = (max(xs) - t) / max(xs)
    sy = (max(ys) - t) / max(ys)
    return [(x * sx, y * sy) for x, y in pts]


def ring_wall(bm: bmesh.types.BMesh, outer: list[tuple[float, float]], inner: list[tuple[float, float]], z0: float, z1: float) -> None:
    """A hollow prism: the band between the outer and the inner polygon (same vertex count), from z0 to z1, closed by an annulus at each end."""
    n = len(outer)
    if len(inner) != n:
        raise BuildError("ring_wall: the two polygons need the same number of points")
    o0 = [bm.verts.new(g2b(x, y, z0)) for x, y in outer]
    o1 = [bm.verts.new(g2b(x, y, z1)) for x, y in outer]
    i0 = [bm.verts.new(g2b(x, y, z0)) for x, y in inner]
    i1 = [bm.verts.new(g2b(x, y, z1)) for x, y in inner]
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((o0[k], o0[j], o1[j], o1[k]))     # outside
        bm.faces.new((i0[j], i0[k], i1[k], i1[j]))     # inside
        bm.faces.new((o0[j], o0[k], i0[k], i0[j]))     # front annulus (z0)
        bm.faces.new((o1[k], o1[j], i1[j], i1[k]))     # back annulus (z1)


def build_iec_inlet(plan: Plan) -> bpy.types.Object:
    """IEC 60320 C14 appliance inlet (the chassis socket with three blades), mating face at z = 0, body behind it toward +z.

    A flange (the box w x h, 1.5 mm thick) around a shroud of 27.5 x 19.5 mm (the panel cutout it snaps into) with its two lower corners cut, a hollow
    pocket 12 mm deep with the three 6.3 x 0.8 mm blades standing on its floor (line and neutral 14 mm apart, earth above), and the solid back shell
    to z = d. Sourced: cutout 27.5 x 19.5 mm and 6.3 x 0.8 mm blades (Schurter inlet datasheets), line-neutral spacing 14 mm (IEC 60320 article).
    Estimated: flange size and thickness, pocket depth, wall, blade length, back shell depth, chamfer."""
    w, h, d = size_m(plan)
    mm = MM
    shroud_w, shroud_h, wall, pocket, chamfer = 27.5 * mm, 19.5 * mm, 1.3 * mm, 12.0 * mm, 3.0 * mm
    if w <= shroud_w or h <= shroud_h or d <= pocket + 4.0 * mm:
        raise BuildError("iec-inlet: sizeMm must exceed the 27.5 x 19.5 mm shroud and be deeper than the pocket plus 4 mm")
    outer = chamfered_rect(shroud_w, shroud_h, chamfer)
    inner = offset_pts(outer, wall)
    body = Body("iec-inlet")
    bm = body.bm
    flange = chamfered_rect(w, h, chamfer + 1.0 * mm)
    ring_wall(bm, flange, inner_for_flange(flange, inner), 0.0, 1.5 * mm)                  # the flange: a ring around the pocket mouth
    body.done(BLACK)
    ring_wall(bm, outer, inner, 0.0, pocket)
    body.done(BLACK)
    extrude_xy(bm, outer, pocket, d)                                                       # solid back shell with the pocket floor at z = pocket
    body.done(BLACK)
    for x, y in ((-7.0, -2.0), (7.0, -2.0), (0.0, 2.0)):                                    # L, N and earth blades
        box(bm, (x - 3.15) * mm, (x + 3.15) * mm, (y - 0.4) * mm, (y + 0.4) * mm, 2.0 * mm, pocket + 0.5 * mm)
    body.done(NICKEL)
    return body.finish()


def inner_for_flange(flange: list[tuple[float, float]], inner: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """The flange ring needs an inner polygon with as many points as its outer one: the pocket outline mapped point by point (both are chamfered rectangles of 6 points)."""
    if len(flange) != len(inner):
        raise BuildError("flange and pocket outlines must have the same number of points")
    return inner


def build_iec_cable(plan: Plan) -> bpy.types.Object:
    """IEC 60320 C13 cable connector (the female end that goes into a C14 inlet), mating face at z = 0, cable at z = d.

    A head of 24.8 x 16.8 mm (it slides into the 25.4 x 17.4 mm pocket of the inlet) with its lower corners cut, 22 mm long, with three blade
    slots in its face; behind it a wider body (the box width and height) 12 mm long, then a round boot that tapers to the cable. The three slots mirror the
    inlet's blades. Sourced: the inlet pocket it fits (see the inlet). Estimated: every other size (the standard sheet was not available)."""
    w, h, d = size_m(plan)
    mm = MM
    head = chamfered_rect(24.8 * mm, 16.8 * mm, 3.0 * mm)
    head_len, body_len = 22.0 * mm, 12.0 * mm
    if w <= 25.0 * mm or h <= 17.0 * mm or d <= head_len + body_len + 10.0 * mm:
        raise BuildError("iec-cable: sizeMm must exceed the 24.8 x 16.8 mm head and be deeper than the head, the body and a 10 mm boot")
    body = Body("iec-cable")
    bm = body.bm
    extrude_xy(bm, head, 0.0, head_len)
    face_edges = take_face(bm, 0.0)
    slots = []
    for x, y in ((-7.0, -2.0), (7.0, -2.0), (0.0, 2.0)):
        mouth, floor = rect_hole(bm, (x - 3.3) * mm, (x + 3.3) * mm, (y - 0.5) * mm, (y + 0.5) * mm, 0.0, 8.0 * mm, 1.0)
        bm.faces.new(floor[::-1])
        slots.append(mouth)
    body.done(DARK)
    fill_with_holes(bm, face_edges, slots, (0.0, 0.0, -1.0))
    body.done(BLACK)
    extrude_xy(bm, chamfered_rect(w, h, 4.0 * mm), head_len, head_len + body_len)
    body.done(BLACK)
    cylinder_between(bm, g2b(0.0, 0.0, head_len + body_len - 0.5 * mm), g2b(0.0, 0.0, d), min(w, h) * 0.34, 4.5 * mm, segments=16)
    body.done(BLACK)
    return body.finish()


def build_schuko_plug(plan: Plan) -> bpy.types.Object:
    """Schuko (CEE 7/4, 7/7 style) mains plug, mating face at z = 0 (the pins' tips), cable at z = d.

    Two round pins of 4.8 mm diameter, 19 mm long, 19 mm apart (Wikipedia, Schuko), standing out of a round plastic body whose diameter is the box
    width; two flat nickel earth strips on the top and bottom of the body's rim; a moulded back with a cable boot. Estimated: body diameter and
    length, strip size, boot."""
    w, h, d = size_m(plan)
    mm = MM
    pin_len = 19.0 * mm
    if d <= pin_len + 20.0 * mm or min(w, h) < 34.0 * mm:
        raise BuildError("schuko-plug: sizeMm must be at least 34 mm across and deeper than the 19 mm pins plus 20 mm")
    body_r = min(w, h) / 2.0
    body = Body("schuko-plug")
    bm = body.bm
    for sx in (-1.0, 1.0):
        cylinder_between(bm, g2b(sx * 9.5 * mm, 0.0, 0.0), g2b(sx * 9.5 * mm, 0.0, pin_len + 1.0 * mm), 2.4 * mm, segments=12)
    body.done(NICKEL)
    profile = [(body_r - 1.5 * mm, pin_len), (body_r, pin_len + 1.5 * mm), (body_r, d - 12.0 * mm), (body_r * 0.45, d - 1.0 * mm), (body_r * 0.38, d)]
    revolve(body, profile, [BLACK, BLACK, BLACK, BLACK], 24, cap_first=True, cap_last=True)
    box(bm, -5.0 * mm, 5.0 * mm, body_r - 0.3 * mm, body_r + 0.6 * mm, pin_len + 2.0 * mm, pin_len + 14.0 * mm)      # earth strip, top of the rim
    box(bm, -5.0 * mm, 5.0 * mm, -(body_r + 0.6 * mm), -(body_r - 0.3 * mm), pin_len + 2.0 * mm, pin_len + 14.0 * mm)  # and bottom
    body.done(NICKEL)
    return body.finish()


def build_schuko_socket(plan: Plan) -> bpy.types.Object:
    """Schuko (CEE 7/3) wall socket, mating face at z = 0, body behind it toward +z.

    A square plate (the box w x h, 3 mm) around a round recess 17.5 mm deep (Wikipedia, Schuko) of 36 mm diameter, two 4.8 mm pin holes 19 mm apart
    drawn as dark discs on the floor, and two earth clips on the sides; behind it a solid back of the recess diameter to z = d. Estimated: recess
    diameter, plate size, clips, back."""
    w, h, d = size_m(plan)
    mm = MM
    recess_r, recess_depth = 18.0 * mm, 17.5 * mm
    if min(w, h) < 2 * recess_r + 8.0 * mm or d <= recess_depth + 6.0 * mm:
        raise BuildError("schuko-socket: sizeMm must be wider than the 36 mm recess plus 8 mm and deeper than the 17.5 mm recess plus 6 mm")
    body = Body("schuko-socket")
    bm = body.bm
    n = 24
    mouth = [(math.cos(2 * math.pi * k / n) * recess_r, math.sin(2 * math.pi * k / n) * recess_r) for k in range(n)]
    shell = [(x * 1.12, y * 1.12) for x, y in mouth]
    half = min(w, h) / 2.0
    square = [(math.cos(2 * math.pi * k / n) * half / max(abs(math.cos(2 * math.pi * k / n)), abs(math.sin(2 * math.pi * k / n))), math.sin(2 * math.pi * k / n) * half / max(abs(math.cos(2 * math.pi * k / n)), abs(math.sin(2 * math.pi * k / n)))) for k in range(n)]
    ring_wall(bm, square, shell, 0.0, 3.0 * mm)                                              # the plate: a square ring around the recess shell
    body.done(BLACK)
    ring_wall(bm, shell, mouth, 0.0, recess_depth)                                           # recess wall
    body.done(BLACK)
    extrude_xy(bm, shell, recess_depth, d)                                                   # back and recess floor
    body.done(BLACK)
    for sx in (-1.0, 1.0):
        cylinder_between(bm, g2b(sx * 9.5 * mm, 0.0, recess_depth - 0.2 * mm), g2b(sx * 9.5 * mm, 0.0, recess_depth + 0.4 * mm), 2.7 * mm, segments=12)
    body.done(DARK)
    for sx in (-1.0, 1.0):                                                                   # earth clips on the sides of the recess
        box(bm, sx * (recess_r - 2.0 * mm) - 3.0 * mm, sx * (recess_r - 2.0 * mm) + 3.0 * mm, -4.0 * mm, 4.0 * mm, 6.0 * mm, recess_depth - 0.3 * mm)
    body.done(NICKEL)
    return body.finish()


LOCK_BLUE = "#4a78c0"
LOCK_GREY = "#a9adb3"


def build_locking_plug(plan: Plan) -> bpy.types.Object:
    """A Neutrik twist-lock round cable connector (speakON NL4FXX, powerCON NAC3FCA / TRUE1 class), mating face at z = 0, cable at z = d.

    A 24.8 mm nose (steel) with its flat face carrying `contacts` contact holes on a 6.7 mm radius (4 at 45 degrees for speakON; 3 for powerCON at
    90, 210 and 330 degrees), a 26.8 mm body in the housing colour (params.colour: 1 black, 2 blue, 3 grey), a boot tapering to the cable, and a
    latch lever on the top that makes the box taller than wide (the axis sits below the box centre, like the XLR plug). Verified: the box of the
    Neutrik NL4FXX STEP model (26.83 x 30.34 x 79.25 mm; dimensions only). Estimated: nose and body split, hole size and depth, boot, lever."""
    w, h, d = size_m(plan)
    mm = MM
    params = plan.get("params") or {}
    contacts, colour = int(params.get("contacts", 4)), int(params.get("colour", 1))
    if contacts not in (3, 4) or colour not in (1, 2, 3):
        raise BuildError(f"params.contacts must be 3 or 4 and params.colour 1, 2 or 3, got {contacts} and {colour}")
    body_r = w / 2.0
    if h <= w + 0.5 * mm or d < 60.0 * mm:
        raise BuildError("locking-plug: sizeMm.h must exceed the width (the latch lever) and sizeMm.d be at least 60 mm")
    axis_y = body_r - h / 2.0
    housing = (BLACK, LOCK_BLUE, LOCK_GREY)[colour - 1]
    nose_r = 12.4 * mm
    profile = [(nose_r, 0.0), (nose_r, 28.0 * mm), (body_r, 31.0 * mm), (body_r, d - 18.0 * mm), (body_r * 0.7, d - 6.0 * mm), (body_r * 0.45, d)]
    body = Body("locking-plug")
    bm = body.bm
    rings = revolve(body, profile, [NICKEL, NICKEL, housing, housing, BLACK], 24, cap_last=True, cy=axis_y)
    outline = [bm.edges.get((rings[0][i], rings[0][(i + 1) % 24])) for i in range(24)]
    holes = []
    angles = (45.0, 135.0, 225.0, 315.0) if contacts == 4 else (90.0, 210.0, 330.0)
    for a in angles:
        holes.append(blind_hole(bm, 6.7 * mm * math.cos(math.radians(a)), axis_y + 6.7 * mm * math.sin(math.radians(a)), 0.0, 1.7 * mm, 8, 4.0 * mm, 1.0))
    body.done(DARK)
    fill_with_holes(bm, outline, holes, (0.0, 0.0, -1.0))
    body.done(NICKEL)
    box(bm, -4.0 * mm, 4.0 * mm, axis_y + body_r - 1.0 * mm, axis_y + body_r + (h - w), 33.0 * mm, 60.0 * mm)   # the latch lever: its top is the top of the box
    body.done(housing)
    return body.finish()


USB_DIMS_MM = {
    # type: (shell width, shell height, insertion length, contact count, chamfer of the two top corners)
    1: (12.0, 4.5, 11.75, 4, 0.0),    # Standard-A plug
    2: (8.0, 7.25, 11.75, 4, 1.4),    # USB 2 Standard-B plug
    3: (8.25, 2.4, 6.51, 12, 0.0),    # Type-C plug (drawn with 12 contacts per side reduced to 6 strips)
    4: (7.5, 4.6, 9.0, 4, 1.0),       # mini-DisplayPort style plug (Avid DigiLink Mini)
}


def usb_shell_outline(kind: int, w: float, h: float, c: float) -> list[tuple[float, float]]:
    """The outline of a USB plug shell, counter-clockwise: a rectangle (A), a rectangle with the two TOP corners cut (B), a stadium (C, 4 points per end)."""
    if kind == 3:
        r = h / 2.0
        pts = []
        for k in range(5):                                   # right end, bottom to top
            a = -math.pi / 2 + math.pi * k / 4
            pts.append((w / 2 - r + r * math.cos(a), r * math.sin(a)))
        for k in range(5):                                   # left end, top to bottom
            a = math.pi / 2 + math.pi * k / 4
            pts.append((-w / 2 + r + r * math.cos(a), r * math.sin(a)))
        return pts
    if c > 0:
        return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2 - c), (w / 2 - c, h / 2), (-w / 2 + c, h / 2), (-w / 2, h / 2 - c)]
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]


def build_usb_plug(plan: Plan) -> bpy.types.Object:
    """A USB cable plug (params.type: 1 Standard-A, 2 USB 2 Standard-B, 3 Type-C, 4 mini-DisplayPort style), mating face at z = 0, cable at z = d.

    A hollow nickel shell of the published size and insertion length (Wikipedia, USB hardware: A 12.0 x 4.5 mm, B 8.0 x 7.25 mm, C 8.25 x 2.4 mm), an
    insulator tongue with gold contact strips inside it, a black overmould (the box width and height) and a tapering boot to the cable.
    Estimated: wall 0.3 mm, tongue size, contact strips, overmould length, boot."""
    w, h, d = size_m(plan)
    mm = MM
    kind = int((plan.get("params") or {}).get("type", 1))
    if kind not in USB_DIMS_MM:
        raise BuildError(f"params.type must be 1 (A), 2 (B), 3 (C) or 4 (mini-DP), got {kind}")
    sw, sh, sl, nc, cham = (v * mm if i < 3 or i == 4 else v for i, v in enumerate(USB_DIMS_MM[kind]))
    if w <= sw + 1.0 * mm or h <= sh + 1.0 * mm or d <= sl + 14.0 * mm:
        raise BuildError("usb-plug: sizeMm must exceed the shell by 1 mm each way and be deeper than the shell plus 14 mm")
    outer = usb_shell_outline(kind, sw, sh, cham)
    wall = 0.3 * mm
    inner = [(x * (sw / 2 - wall) / (sw / 2), y * (sh / 2 - wall) / (sh / 2)) for x, y in outer]
    body = Body("usb-plug")
    bm = body.bm
    ring_wall(bm, outer, inner, 0.0, sl)
    body.done(NICKEL)
    # insulator tongue inside the shell (contacts on its face): for A and B it hangs under the roof of the shell, for C it is the centre paddle
    tw = sw - 2.2 * mm if kind != 2 else sw - 2.4 * mm
    th = 0.8 * mm if kind != 3 else 0.6 * mm
    ty = (sh / 2 - wall - th / 2) if kind != 3 else 0.0
    box(bm, -tw / 2, tw / 2, ty - th / 2, ty + th / 2, 1.0 * mm, sl - 0.2 * mm)
    body.done(DARK)
    strips = 4 if kind != 3 else 6
    pitch = (tw - 1.0 * mm) / strips
    for i in range(strips):
        cx = -tw / 2 + 0.5 * mm + pitch * (i + 0.5)
        box(bm, cx - pitch * 0.3, cx + pitch * 0.3, ty - th / 2 - 0.1 * mm, ty - th / 2 + 0.05 * mm, 2.0 * mm, sl - 0.8 * mm)
    body.done(GOLD)
    # overmould and boot
    om_len = d - sl - 8.0 * mm
    extrude_xy(bm, [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], sl, sl + om_len)
    body.done(BLACK)
    cylinder_between(bm, g2b(0.0, 0.0, sl + om_len - 0.5 * mm), g2b(0.0, 0.0, d), min(w, h) * 0.32, 2.4 * mm, segments=12)
    body.done(BLACK)
    return body.finish()


TERMINAL_GREEN = "#4f7a4a"


def build_dsub_plug(plan: Plan) -> bpy.types.Object:
    """A 25-pin D-sub male cable plug (shell size B), mating face at z = 0, cable at z = d.

    The trapezoid D shell (hollow, 8 mm long) with the 13 + 12 pins of the normal-density layout (2.76 mm pitch in a row, rows 2.84 mm apart, rows offset
    by half a pitch: Wikipedia, D-subminiature) standing on an insulator, the mounting flange, a metal hood and a boot. Estimated (the shell
    drawing was not available): shell 38.96 x 8.36 mm, flange 53.04 mm wide, hood and boot sizes, pin diameter 1 mm and length 5 mm."""
    w, h, d = size_m(plan)
    mm = MM
    if w < 54.0 * mm or h < 13.0 * mm or d < 40.0 * mm:
        raise BuildError("dsub-plug: sizeMm must be at least 54 x 13 x 40 mm")
    shell = [(-19.48 * mm, 4.18 * mm), (19.48 * mm, 4.18 * mm), (17.4 * mm, -4.18 * mm), (-17.4 * mm, -4.18 * mm)]
    inner = [(x * 0.97, y * 0.9) for x, y in shell]
    body = Body("dsub-plug")
    bm = body.bm
    ring_wall(bm, shell, inner, 0.0, 8.0 * mm)
    body.done(NICKEL)
    extrude_xy(bm, inner, 4.0 * mm, 9.0 * mm)                                   # insulator block the pins stand on
    body.done(DARK)
    pitch, row = 2.76 * mm, 2.84 * mm
    for r, count in ((0, 13), (1, 12)):
        y = (row / 2.0) if r == 0 else (-row / 2.0)
        for i in range(count):
            x = (i - (count - 1) / 2.0) * pitch
            cylinder_between(bm, g2b(x, y, 6.0 * mm), g2b(x, y, 1.0 * mm), 0.5 * mm, segments=4)
    body.done(GOLD)
    box(bm, -26.52 * mm, 26.52 * mm, -6.25 * mm, 6.25 * mm, 8.0 * mm, 9.5 * mm)   # mounting flange
    body.done(NICKEL)
    hood = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    extrude_xy(bm, hood, 9.5 * mm, d - 14.0 * mm)
    body.done(NICKEL)
    cylinder_between(bm, g2b(0.0, 0.0, d - 14.5 * mm), g2b(0.0, 0.0, d), h * 0.4, 4.5 * mm, segments=16)
    body.done(BLACK)
    return body.finish()


def build_terminal_block(plan: Plan) -> bpy.types.Object:
    """A pluggable screw-terminal block (GPIO / logic port), params.poles poles at params.pitchMm (x100 for a whole number; 508 = 5.08 mm), mating face
    (the contact side) at z = 0, wire entries on the back face at z = d, one screw head per pole on top.

    Every size is an estimate of a typical 5.08 mm pitch pluggable block (no published dimension was verified for this connector): width = poles x pitch + 2 mm."""
    w, h, d = size_m(plan)
    mm = MM
    params = plan.get("params") or {}
    poles = int(params.get("poles", 8))
    pitch = float(params.get("pitchHundredthsMm", 508)) / 100.0 * mm
    if poles < 2 or poles > 16 or abs(w - (poles * pitch + 2.0 * mm)) > 0.5 * mm:
        raise BuildError(f"terminal-block: sizeMm.w ({w / mm:.2f}) must be poles x pitch + 2 mm ({(poles * pitch + 2.0 * mm) / mm:.2f})")
    body = Body("terminal-block")
    bm = body.bm
    extrude_xy(bm, [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], 0.0, d)
    face_edges = take_face(bm, d)
    holes = []
    for i in range(poles):
        x = (i - (poles - 1) / 2.0) * pitch
        mouth, floor = rect_hole(bm, x - 1.8 * mm, x + 1.8 * mm, -h / 2 + 2.0 * mm, -h / 2 + 5.6 * mm, d, 7.0 * mm, -1.0)
        bm.faces.new(floor)
        holes.append(mouth)
    body.done(DARK)
    fill_with_holes(bm, face_edges, holes, (0.0, 0.0, 1.0))
    body.done(TERMINAL_GREEN)
    for i in range(poles):
        x = (i - (poles - 1) / 2.0) * pitch
        cylinder_between(bm, g2b(x, h / 2 - 3.0 * mm, d * 0.55), g2b(x, h / 2 - 0.2 * mm, d * 0.55), 2.1 * mm, segments=10)
    body.done(NICKEL)
    return body.finish()


def build_coax_plug(plan: Plan) -> bpy.types.Object:
    """A coaxial cable plug (params.type: 1 BNC, 2 RCA), mating face at z = 0, cable at z = d, built as one revolved profile.

    BNC: a 12.2 mm coupling nut hollow for 16 mm around a 1.6 mm centre pin standing on the dielectric; body 11 mm to a boot. RCA: a 3.2 mm centre pin
    from the tip, a 8.8 mm ring (hollow) behind it, a 12.5 mm handle and a boot. Estimated: all sizes (typical crimp plugs; the BNC bayonet slots are
    not modelled)."""
    w, h, d = size_m(plan)
    mm = MM
    kind = int((plan.get("params") or {}).get("type", 1))
    if kind not in (1, 2):
        raise BuildError(f"params.type must be 1 (BNC) or 2 (RCA), got {kind}")
    body_r = min(w, h) / 2.0
    body = Body("coax-plug")
    bm = body.bm
    if kind == 1:
        if d < 30.0 * mm or body_r < 5.8 * mm:
            raise BuildError("coax-plug BNC: sizeMm must be at least 11.6 mm across and 30 mm long")
        profile = [(2.0 * mm, 12.0 * mm), (4.7 * mm, 12.0 * mm), (4.7 * mm, 0.0), (body_r, 0.0), (body_r, 16.0 * mm), (body_r - 0.8 * mm, 16.0 * mm),
                   (body_r - 0.8 * mm, d - 12.0 * mm), (body_r * 0.45, d)]
        revolve(body, profile, [DARK, BLACK, NICKEL, NICKEL, NICKEL, NICKEL, BLACK], 24, cap_first=True, cap_last=True)
        cylinder_between(bm, g2b(0.0, 0.0, 12.5 * mm), g2b(0.0, 0.0, 3.0 * mm), 0.8 * mm, segments=8)
        body.done(GOLD)
    else:
        if d < 30.0 * mm or body_r < 6.0 * mm:
            raise BuildError("coax-plug RCA: sizeMm must be at least 12 mm across and 30 mm long")
        ring_front = 3.5 * mm
        profile = [(1.7 * mm, 15.0 * mm), (3.9 * mm, 15.0 * mm), (3.9 * mm, ring_front), (4.4 * mm, ring_front), (4.4 * mm, 15.0 * mm), (body_r * 0.8, 17.0 * mm),
                   (body_r, 20.0 * mm), (body_r, d - 10.0 * mm), (body_r * 0.4, d)]
        revolve(body, profile, [DARK, NICKEL, NICKEL, NICKEL, NICKEL, BLACK, BLACK, BLACK], 24, cap_first=True, cap_last=True)
        cylinder_between(bm, g2b(0.0, 0.0, 15.5 * mm), g2b(0.0, 0.0, 0.0), 1.6 * mm, segments=10)       # the centre pin: its tip is the mating face
        body.done(GOLD)
    return body.finish()


def build_toslink_plug(plan: Plan) -> bpy.types.Object:
    """A TOSLINK (EIAJ / JIS F05) optical plug, mating face at z = 0, cable at z = d.

    A 5 x 5 mm square head 12 mm long with its tip edges chamfered, a 2.2 mm light-guide disc in the tip face, a stepped body (the box width and
    height) and a boot. Estimated: all sizes (no drawing was available)."""
    w, h, d = size_m(plan)
    mm = MM
    if w < 7.0 * mm or h < 7.0 * mm or d < 25.0 * mm:
        raise BuildError("toslink-plug: sizeMm must be at least 7 x 7 x 25 mm")
    body = Body("toslink-plug")
    bm = body.bm
    box(bm, -2.5 * mm, 2.5 * mm, -2.5 * mm, 2.5 * mm, 0.02 * mm, 12.0 * mm)
    body.done(BLACK)
    cylinder_between(bm, g2b(0.0, 0.0, 0.0), g2b(0.0, 0.0, 1.0 * mm), 1.1 * mm, segments=12)      # the light guide stands 0.02 mm proud of the head: the mating face
    body.done(LOCK_GREY)
    box(bm, -w / 2, w / 2, -h / 2, h / 2, 12.0 * mm, d - 9.0 * mm)
    body.done(BLACK)
    cylinder_between(bm, g2b(0.0, 0.0, d - 9.5 * mm), g2b(0.0, 0.0, d), min(w, h) * 0.38, 2.2 * mm, segments=12)
    body.done(BLACK)
    return body.finish()


def build_ethercon_plug(plan: Plan) -> bpy.types.Object:
    """A Neutrik etherCON cable connector (NE8MC class): an RJ45 plug standing out of a round metal shell with a latch, mating face (the RJ45 tip) at z = 0.

    The RJ45 head 11.68 x 8 mm (the rj45 model's size), 14 mm long, in front of a 22 mm shell 26 mm long, a 24.5 mm body, a boot to the cable and a
    latch lever on top (the box is taller than wide). Estimated: every size except the RJ45 head (the NE8MC drawing was not available; the DXF is
    on Neutrik's page but was not retrieved)."""
    w, h, d = size_m(plan)
    mm = MM
    body_r = w / 2.0
    if h <= w + 0.5 * mm or d < 60.0 * mm or w < 24.0 * mm:
        raise BuildError("ethercon-plug: sizeMm.w must be at least 24 mm, h larger than w (the latch lever) and d at least 60 mm")
    axis_y = body_r - h / 2.0
    body = Body("ethercon-plug")
    bm = body.bm
    box(bm, -5.84 * mm, 5.84 * mm, axis_y - 4.0 * mm, axis_y + 4.0 * mm, 0.0, 15.0 * mm)
    body.done(PALE)                                                                     # the clear RJ45 housing, drawn as pale blue-grey like the rj45 model
    profile = [(11.0 * mm, 14.0 * mm), (11.0 * mm, 40.0 * mm), (body_r, 43.0 * mm), (body_r, d - 20.0 * mm), (body_r * 0.5, d)]
    revolve(body, profile, [NICKEL, NICKEL, BLACK, BLACK], 24, cap_first=True, cap_last=True, cy=axis_y)
    box(bm, -4.0 * mm, 4.0 * mm, axis_y + body_r - 1.0 * mm, axis_y + body_r + (h - w), 44.0 * mm, 62.0 * mm)
    body.done(BLACK)
    return body.finish()


# --- power-strip ------------------------------------------------------------------------------------------

STRIP_BODY = "#a3a8b1"      # light grey moulded plastic (lifted a little for the creation scene)
STRIP_WALL = "#34363d"      # the inside walls of a socket or of the switch window
STRIP_FLOOR = "#4b4e57"     # a socket floor (the port sits on it)
STRIP_SLOT = "#101114"      # the three blade slots of a C13 outlet
STRIP_ROCKER = "#e8832a"    # the lit rocker switch (orange: a lamp inside)
STRIP_RUBBER = "#2c2d32"    # feet
STRIP_CORD = "#202125"      # the cord stub and its boot
STRIP_DEFAULTS_MM = {"socketDepthMm": 9.0, "switchMm": 24.0, "feetMm": 2.0, "filletMm": 7.0, "endTaperMm": 2.5, "cableDiaMm": 9.0, "lenMm": 30.0}
STRIP_OUTLINE_MM = (25.4, 17.4, 3.0)   # the IEC 60320 C13 outlet opening, lower corners cut (same outline as the iec-cable head's pocket)
STRIP_SLOTS_MM = ((-7.0, -2.0), (7.0, -2.0), (0.0, 2.0))   # line, neutral and earth slot centres (6.6 x 1.0 mm), as on the iec-inlet blades
STRIP_SWITCH_W_MM = 14.0
STRIP_ARC_STEPS = 5          # steps per rounded corner of the bar's section
STRIP_GAP_MM = 3.0           # least distance between two openings and from an opening to the flat zone's edge


def strip_section(d: float, y0: float, y1: float, r: float, steps: int) -> list[tuple[float, float]]:
    """The bar's section as (z, y) points: a rectangle d deep from y0 to y1 with its four corners rounded by r, front edge last (counter-clockwise)."""
    pts: list[tuple[float, float]] = []
    for cz, cy, a0 in ((d / 2.0 - r, y1 - r, 0.0), (-d / 2.0 + r, y1 - r, 90.0), (-d / 2.0 + r, y0 + r, 180.0), (d / 2.0 - r, y0 + r, 270.0)):
        for k in range(steps + 1):
            a = math.radians(a0 + 90.0 * k / steps)
            pts.append((cz + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def build_power_strip(plan: Plan) -> bpy.types.Object:
    """A power strip w x h x d lying with its sockets facing the io face (z = +d/2): a rounded bar along x with tapered ends, one C13 outlet recess per io
    port (the port sits on the recess floor, socketDepthMm behind the face), a lit rocker switch in a window at the left end, four rubber feet and a cord
    stub with a boot leaving the right end (lenMm of the width is the stub). Bottom at y = 0, centred on x and z.

    Sizes come from the spec; the socket centres come from the io ports (face-local x, y as everywhere). Params in mm, defaults in STRIP_DEFAULTS_MM:
    sockets (checked against the number of io ports), socketDepthMm, switchMm (window height, 14 mm wide), switchXMm (its centre), feetMm, filletMm (the
    section's corner radius, also written as the measured fillet), endTaperMm, cableDiaMm, lenMm."""
    w, h, d = size_m(plan)
    params = plan.get("params") or {}

    def mm_param(name: str) -> float:
        return param_m(plan, name, STRIP_DEFAULTS_MM[name])

    depth, win_h, feet, fillet, taper = (mm_param(n) for n in ("socketDepthMm", "switchMm", "feetMm", "filletMm", "endTaperMm"))
    cable_r, stub = mm_param("cableDiaMm") / 2.0, mm_param("lenMm")
    ports = [p for p in (plan.get("ports") or []) if isinstance(p, dict)]
    if not ports:
        raise BuildError("power-strip needs its io ports: they are the socket centres")
    if "sockets" in params and int(params["sockets"]) != len(ports):
        raise BuildError(f"params.sockets ({params['sockets']}) must equal the number of io ports ({len(ports)})")
    for p in ports:
        if abs(float(p.get("insetMm") or 0.0) * MM - depth) > 0.05 * MM:
            raise BuildError(f"port {p.get('portId')!r} sits {p.get('insetMm')!r} mm inside the face, the sockets are {depth / MM:.2f} mm deep: the port is on the floor, give both the same")
    body_len = w - stub
    if stub <= 0.0 or body_len <= 6.0 * fillet:
        raise BuildError(f"params.lenMm ({stub / MM:.1f}) leaves no bar in a width of {w / MM:.1f} mm")
    if feet < 0.0 or 2.0 * fillet >= min(h - feet, d) or taper * 4.0 >= min(h - feet, d):
        raise BuildError("params.filletMm, endTaperMm or feetMm are too large for the bar's section")
    if cable_r * 2.4 >= h - feet:
        raise BuildError(f"params.cableDiaMm ({cable_r * 2 / MM:.1f}) is too thick for the bar's height")
    y0, y1 = feet, h
    yc = (y0 + y1) / 2.0
    x0, x1 = -w / 2.0, -w / 2.0 + body_len
    flat_y = (y0 + fillet, y1 - fillet)
    ow, oh, oc = (v * MM for v in STRIP_OUTLINE_MM)
    gap = STRIP_GAP_MM * MM
    # every opening is a rectangle (x0, x1, y0, y1) on the flat front: the sockets, then the switch window
    openings: list[tuple[str, float, float, float, float]] = []
    for p in ports:
        cx, cy = float(p["xMm"]) * MM - w / 2.0, float(p["yMm"]) * MM
        openings.append((str(p.get("portId")), cx - ow / 2.0, cx + ow / 2.0, cy - oh / 2.0, cy + oh / 2.0))
    first_left = min(o[1] for o in openings)
    switch_x = (x0 + taper + first_left) / 2.0 if "switchXMm" not in params else float(params["switchXMm"]) * MM - w / 2.0
    openings.append(("switch", switch_x - STRIP_SWITCH_W_MM * MM / 2.0, switch_x + STRIP_SWITCH_W_MM * MM / 2.0, yc - win_h / 2.0, yc + win_h / 2.0))
    for name, a, b, c, e in openings:
        if a < x0 + taper + gap or b > x1 - taper - gap or c < flat_y[0] + 1e-9 or e > flat_y[1] - 1e-9:
            raise BuildError(f"the opening of {name!r} does not fit on the flat front of the bar")
    for i, o in enumerate(openings):
        for q in openings[i + 1:]:
            if o[1] < q[2] + gap and q[1] < o[2] + gap and o[3] < q[4] + gap and q[3] < o[4] + gap:
                raise BuildError(f"the openings of {o[0]!r} and {q[0]!r} are less than {STRIP_GAP_MM:.0f} mm apart")

    body = Body("power-strip")
    bm = body.bm
    # the bar: four sections (a shrunk end, the full section twice, a shrunk end) lofted along x; the middle front quad is the one flat face the openings are cut in
    section = strip_section(d, y0, y1, fillet, STRIP_ARC_STEPS)
    sz, sy = (d / 2.0 - taper) / (d / 2.0), ((y1 - y0) / 2.0 - taper) / ((y1 - y0) / 2.0)
    rings = []
    for x, k in ((x0, 1), (x0 + taper, 0), (x1 - taper, 0), (x1, 1)):
        rings.append([bm.verts.new(g2b(x, yc + (y - yc) * (sy if k else 1.0), z * (sz if k else 1.0))) for z, y in section])
    for a, b in zip(rings, rings[1:]):
        band(bm, a, b)
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    body.done(STRIP_BODY)

    outline = take_flat_face(bm, d / 2.0)
    mouth_edges: list[list[bmesh.types.BMEdge]] = []
    floors: list[list[bmesh.types.BMVert]] = []
    z_front = d / 2.0
    outline_pts = chamfered_rect(ow, oh, oc)
    for p in ports:
        cx, cy = float(p["xMm"]) * MM - w / 2.0, float(p["yMm"]) * MM
        mouth = [bm.verts.new(g2b(cx + x, cy + y, z_front)) for x, y in outline_pts]
        floor = [bm.verts.new(g2b(cx + x, cy + y, z_front - depth)) for x, y in outline_pts]
        band(bm, mouth, floor)
        mouth_edges.append([bm.edges.get((mouth[i], mouth[(i + 1) % len(mouth)])) for i in range(len(mouth))])
        floors.append(floor)
    switch = openings[-1]
    sw_edges, sw_floor = rect_hole(bm, switch[1], switch[2], switch[3], switch[4], z_front, 6.0 * MM, -1.0)
    mouth_edges.append(sw_edges)
    body.done(STRIP_WALL)
    for floor in floors:
        bm.faces.new(floor[::-1])
    bm.faces.new(sw_floor[::-1])
    body.done(STRIP_FLOOR)
    for p in ports:
        cx, cy = float(p["xMm"]) * MM - w / 2.0, float(p["yMm"]) * MM
        for sx, sy_ in STRIP_SLOTS_MM:   # blade slots: dark flat boxes 0.3 mm proud of the floor (the floor stays solid under the port)
            box(bm, cx + (sx - 3.3) * MM, cx + (sx + 3.3) * MM, cy + (sy_ - 0.5) * MM, cy + (sy_ + 0.5) * MM, z_front - depth, z_front - depth + 0.3 * MM)
    body.done(STRIP_SLOT)
    # the rocker: a tilted block in the window, its high edge 0.6 mm behind the face, so nothing stands out of the bounding box
    zf = z_front
    box_pts = [(zf - 6.0 * MM + 0.5 * MM, switch[3] + 1.0 * MM), (zf - 1.8 * MM, switch[3] + 1.0 * MM), (zf - 0.6 * MM, yc + 1.5 * MM), (zf - 2.2 * MM, switch[4] - 1.0 * MM), (zf - 6.0 * MM + 0.5 * MM, switch[4] - 1.0 * MM)]
    extrude_zy(bm, box_pts, switch[1] + 0.6 * MM, switch[2] - 0.6 * MM)
    body.done(STRIP_ROCKER)
    fill_with_holes(bm, outline, mouth_edges, (0.0, 0.0, 1.0))
    body.done(STRIP_BODY)

    # rubber feet under the bar and the cord stub (a boot tapering to the cord) out of the right end
    for fx in (x0 + 22.0 * MM, x1 - 22.0 * MM):
        for fz in (-d / 2.0 + 11.0 * MM, d / 2.0 - 11.0 * MM):
            if feet > 0.0:
                cylinder_between(bm, g2b(fx, 0.0, fz), g2b(fx, feet + 0.5 * MM, fz), 5.5 * MM, 5.0 * MM, segments=12)
    body.done(STRIP_RUBBER)
    boot = min(12.0 * MM, stub * 0.5)
    cylinder_between(bm, g2b(x1 - 0.5 * MM, yc, 0.0), g2b(x1 + boot, yc, 0.0), min(cable_r * 1.35, (y1 - y0) * 0.4), cable_r, segments=16)
    cylinder_between(bm, g2b(x1 + boot - 1.0 * MM, yc, 0.0), g2b(x1 + stub, yc, 0.0), cable_r, segments=16)
    body.done(STRIP_CORD)
    MEASURE["filletMm"] = fillet / MM
    return body.finish()


# One entry per shape of tools/assets3d/shapes.ts (a test compares the two lists).
SHAPES: dict[str, Callable[[Plan], bpy.types.Object]] = {
    "power-strip": build_power_strip,
    "cylinder-plug": build_cylinder_plug,
    "trs-plug": build_trs_plug,
    "rj45-plug": build_rj45_plug,
    "rack-box": build_rack_box,
    "stagebox-rio3224": build_stagebox_rio3224,
    "revolve": build_revolve,
    "console-wedge": build_console_wedge,
    "speaker-cabinet": build_speaker_cabinet,
    "curved-cabinet": build_curved_cabinet,
    "boom-arm": build_boom_arm,
    "xlr-male-plug": build_xlr_male_plug,
    "iec-inlet": build_iec_inlet,
    "iec-cable": build_iec_cable,
    "schuko-plug": build_schuko_plug,
    "schuko-socket": build_schuko_socket,
    "locking-plug": build_locking_plug,
    "usb-plug": build_usb_plug,
    "dsub-plug": build_dsub_plug,
    "terminal-block": build_terminal_block,
    "coax-plug": build_coax_plug,
    "toslink-plug": build_toslink_plug,
    "ethercon-plug": build_ethercon_plug,
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
    measure_path = os.path.splitext(args['out'])[0] + '.measure.json'
    if os.path.exists(measure_path):
        os.remove(measure_path)   # never leave the measurements of an earlier run next to this output
    MEASURE.clear()
    builder(plan)
    if plan.get("projections"):
        meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        if len(meshes) != 1:
            raise BuildError(f"a projection needs exactly one mesh object, the build made {len(meshes)}")
        apply_projection(meshes[0], plan, os.path.splitext(args["out"])[0] + ".atlas.png")
    export_glb(args["out"])
    if MEASURE:
        with open(measure_path, 'w', encoding='utf-8') as f:
            json.dump(MEASURE, f)
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
