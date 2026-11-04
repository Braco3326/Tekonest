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
import sys
import traceback
from typing import Any, Callable

import bmesh
import bpy
from mathutils import Vector

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
SLATE = "#a0b8d6"
PLATE_IN = "#7a8aa6"
PLATE_OUT = "#616b82"
CHASSIS = "#545661"
EAR = "#383840"
BEZEL = "#34343b"
LCD = "#2e4352"
STEEL = "#b4b8c0"
PALE = "#b4cfe0"  # the clear RJ45 housing, drawn as an opaque pale blue-grey

DEFAULT_FRONT_LEN_MM = 12.0
XLR_SEGMENTS = 20             # a multiple of 4 so the box is exact; 20 keeps the profile near 700 triangles
XLR_SHELL_RADIUS_MM = 9.6     # the 19.2 mm nickel shell

DEFAULT_CHAMFER_MM = 1.0
BEZEL_SEGMENTS = 10           # 52 connector bezels: 10 sides keep the stage box inside the 4000-triangle hero budget

# trs-plug: 16 segments keep the 22-point profile inside the 800-triangle connector budget (about 700).
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
    edges = list({e for f in faces for e in f.edges})
    bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type="OFFSET", segments=1, affect="EDGES")


# --- shapes -----------------------------------------------------------------------------------------------

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
    for px, py in ((-4.05, 0.0), (4.05, 0.0), (0.0, -3.95)):
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
    z_front, z_back = 14.5 * mm, 24.0 * mm
    sections = []
    for z, top_y in ((z_front, axis_y + 10.0 * mm), (z_back, axis_y + lug_top)):
        sections.append([bm.verts.new(g2b(x, y, z)) for x, y in ((-3.15 * mm, base_y), (3.15 * mm, base_y), (1.15 * mm, top_y), (-1.15 * mm, top_y))])
    band(bm, sections[0], sections[1])
    bm.faces.new(sections[0])
    bm.faces.new(sections[1][::-1])
    body.done(NICKEL)
    return body.finish()


def build_trs_plug(plan: Plan) -> bpy.types.Object:
    """6.35 mm TRS cable plug, from the tip (z = 0) to the cable: a domed, grooved tip, two thin black insulator bands
    between nickel tip, ring and sleeve (mating length `barrelMm`, default 30.5 as on real plugs), a conical nose into the
    handle shell, then a black boot that tapers toward the cable (z = d).

    Only the diameters and the 30-31 mm mating length are sourced; the lengths inside the barrel and the handle split are
    estimates from photos (research report, estimated rows)."""
    w, h, d = size_m(plan)
    body_r = min(w, h) / 2.0
    barrel_r = positive(plan.get("matingOuterMm"), "matingOuterMm") * MM / 2.0
    barrel_len = param_m(plan, "barrelMm", DEFAULT_BARREL_MM)
    if barrel_r >= body_r:
        raise BuildError(f"matingOuterMm ({barrel_r * 2000:.2f}) must be smaller than the body diameter ({body_r * 2000:.2f})")
    nose_len = 7.5 * MM
    boot_len = 23.5 * MM
    if barrel_len < 14.0 * MM or barrel_len + nose_len + boot_len + 8.0 * MM > d:
        raise BuildError(f"params.barrelMm ({barrel_len / MM:.2f}) does not fit a plug of sizeMm.d {d / MM:.2f} (needs 14 mm to about {(d - nose_len - boot_len - 8.0 * MM) / MM:.0f} mm)")

    r = barrel_r
    groove_r = r - 0.4 * MM
    insulator_r = r - 0.2 * MM
    mm = MM
    shell_start = barrel_len + nose_len
    boot_start = d - boot_len
    profile: list[tuple[float, float]] = [
        (r * 0.445, 0.0),            # flat tip face
        (r * 0.70, 0.4 * mm),        # dome
        (r * 0.89, 1.0 * mm),
        (r, 2.0 * mm),
        (r, 2.4 * mm),
        (groove_r, 2.4 * mm),        # groove behind the tip
        (groove_r, 2.9 * mm),
        (r, 4.5 * mm),               # taper back up
        (insulator_r, 4.5 * mm),     # insulator 1
        (insulator_r, 6.2 * mm),
        (r, 6.2 * mm),               # ring
        (r, 11.0 * mm),
        (insulator_r, 11.0 * mm),    # insulator 2
        (insulator_r, 12.7 * mm),
        (r, 12.7 * mm),              # sleeve
        (r, barrel_len),
        (4.6 * mm, barrel_len),      # nose collar: a step, then a cone out to the shell
        (body_r, shell_start),
        (body_r, boot_start),        # shell
        (body_r * 0.925, boot_start),
        (body_r * 0.925, boot_start + 4.5 * mm),
        (body_r * 0.55, d),          # boot tapering to the cable
    ]
    colours = [
        NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL, NICKEL,
        BLACK, BLACK, NICKEL, NICKEL, BLACK, BLACK, NICKEL, NICKEL,
        NICKEL, NICKEL, NICKEL, BLACK, BLACK, BLACK,
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
    body.done(DARK)
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
        box(bm, x0, x1, 0.0, h, panel - 2.5 * mm, panel)                       # the ear plate, flush with the panel
        x_in, x_out = sorted((sign * half_c, sign * (half_c + 2.5 * mm)))
        z_flange = panel - flange_depth
        extrude_zy(bm, [(panel - 2.5 * mm, 0.0), (z_flange + 17.0 * mm, 0.0), (z_flange, 17.0 * mm), (z_flange, h - 17.0 * mm), (z_flange + 17.0 * mm, h), (panel - 2.5 * mm, h)], x_in, x_out)
        body.done(EAR)
        for y in (182.1, 169.5, 109.3, 49.1, 36.4):                            # five rack-hole slots (dark pads)
            box(bm, sign * 231.0 * mm - 5.25 * mm, sign * 231.0 * mm + 5.25 * mm, y * mm - 3.5 * mm, y * mm + 3.5 * mm, panel, panel + 0.3 * mm)
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
    for i in range(4):                                                         # 4 AES/EBU outputs
        bezel((12.0 + 25.1 * i) * mm, 120.2 * mm, 12.0 * mm, 8.8 * mm, z_front)
    for row_y in (73.8, 27.3):                                                 # 16 analog outputs
        for i in range(8):
            bezel((12.0 + 25.13 * i) * mm, row_y * mm, 12.0 * mm, 8.8 * mm, z_front)
    body.done(BEZEL)
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
    fans: list[list[bmesh.types.BMVert]] = []
    for fy in (152.0, 69.0):
        base = ring(bm, 40.0 * mm, back_plate, 12, -160.0 * mm, fy * mm)
        tip = ring(bm, 40.0 * mm, back_plate - 3.0 * mm, 12, -160.0 * mm, fy * mm)
        inner = ring(bm, 31.0 * mm, back_plate - 3.0 * mm, 12, -160.0 * mm, fy * mm)
        band(bm, base, tip)
        band(bm, tip, inner)
        bm.faces.new(base)
        fans.append(inner)
    body.done(CHASSIS)
    for inner in fans:
        bm.faces.new(inner[::-1])
    body.done(DARK)
    for cx, cy, bw, bh, core_w, core_h in ((159.9, 54.3, 39.0, 23.0, 31.0, 15.0), (106.9, 54.3, 39.0, 23.0, 31.0, 15.0),
                                           (182.5, 183.7, 21.0, 21.0, 14.0, 14.0), (154.5, 183.7, 21.0, 21.0, 14.0, 14.0)):
        # The housing stops 0.5 mm short of the tip; the dark core is the part that reaches the box face.
        box(bm, (cx - bw / 2.0) * mm, (cx + bw / 2.0) * mm, (cy - bh / 2.0) * mm, (cy + bh / 2.0) * mm, z_back + 0.5 * mm, back_plate)
        body.done(STEEL)
        box(bm, (cx - core_w / 2.0) * mm, (cx + core_w / 2.0) * mm, (cy - core_h / 2.0) * mm, (cy + core_h / 2.0) * mm, z_back, z_back + 0.5 * mm)
        body.done(DARK)
    log(f"stage box: {sum(len(f.verts) - 2 for f in bm.faces)} triangles before export")
    return body.finish()


# One entry per shape of tools/assets3d/shapes.ts (a test compares the two lists).
SHAPES: dict[str, Callable[[Plan], bpy.types.Object]] = {
    "cylinder-plug": build_cylinder_plug,
    "trs-plug": build_trs_plug,
    "rj45-plug": build_rj45_plug,
    "rack-box": build_rack_box,
    "stagebox-rio3224": build_stagebox_rio3224,
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
