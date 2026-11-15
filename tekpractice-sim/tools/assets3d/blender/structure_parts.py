"""structure_parts.py - the part kit of the TekPractice builder: the real parts of a device modelled as geometry on the finished body.

Imported by build_from_spec.py (apply_structure) after the shape builder made the body. plan['parts'] is the expanded structure sheet (tools/assets3d/structure.ts):
each instance has an origin OUTSIDE the face plane, the inward ray direction, the face axes (x right, y up seen from outside) and its size parameters in
millimetres. For each instance the body is ray-cast (so a part follows a slope or a curve), a local frame is built at the hit (z = surface normal outwards, x = the
face's x projected on the surface, y = z cross x), and the part is built in that frame out of closed solids, one smooth-shaded mesh with the body.

Parts are built from stacks of outlines (circles, rounded rectangles) joined by bands and closed by caps: deterministic, bmesh only, no boolean. A recess is drawn as
a raised collar with a dark well floor (the looks of a socket), never as a printed picture. Every part face is tagged in the integer face attribute `tkpart` so that
the picture projection (apply_projection) leaves it its own colour. Colours are real-part sRGB hex; they are lifted here like the revolve shapes (the scene is lit dimly).
"""
from __future__ import annotations

import math
from typing import Any, Callable

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

MM = 0.001
EMBED = 0.45 * MM          # every part starts this far inside the surface so that it never floats
TAG = "tkpart"
LIFT_GAIN = 3.0
LIFT_CAP = 0.85


class PartError(Exception):
    pass


def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(v: float) -> float:
    return 12.92 * v if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055


def lifted_linear(hexcolour: str) -> tuple[float, float, float, float]:
    """A real-part sRGB hex -> the linear RGBA the builder writes (lifted for the dim scene, like lift_hex of the revolve shapes)."""
    text = hexcolour.lstrip("#")
    if len(text) != 6:
        raise PartError(f"colour {hexcolour!r} must be #rrggbb")
    lin = [_srgb_to_linear(int(text[2 * i:2 * i + 2], 16) / 255.0) for i in range(3)]
    out = []
    for c in lin:
        # a smooth lift (not the hard clamp of the revolve palette): mid and light tones keep their differences, black stays dark, white stays white
        v = c * LIFT_GAIN / (1.0 + (LIFT_GAIN - 1.0) * c)
        v = max(c, min(0.95, v))
        s = _linear_to_srgb(v)
        out.append(_srgb_to_linear(max(0.0, min(1.0, s))))
    return (out[0], out[1], out[2], 1.0)


# ---------------------------------------------------------------------------------------------------------------- outlines

def circle(r: float, n: int, mods: list[float] | None = None) -> list[tuple[float, float]]:
    """n points on a circle of radius r (mods: per-point radius factor, e.g. knurl flutes)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = mods[i % len(mods)] if mods else 1.0
        pts.append((r * k * math.cos(a), r * k * math.sin(a)))
    return pts


def rrect(w: float, h: float, r: float, seg: int = 3) -> list[tuple[float, float]]:
    """A rounded rectangle, counter-clockwise, always 4 * (seg + 1) points so that two of them (a shrunk copy) can be bridged."""
    r = max(0.02 * MM, min(r, w / 2 - 1e-6, h / 2 - 1e-6))
    hw, hh = w / 2, h / 2
    pts: list[tuple[float, float]] = []
    for cx, cy, a0 in ((hw - r, hh - r, 0.0), (-hw + r, hh - r, 90.0), (-hw + r, -hh + r, 180.0), (hw - r, -hh + r, 270.0)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90.0 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def shifted(pts: list[tuple[float, float]], dx: float, dy: float) -> list[tuple[float, float]]:
    return [(x + dx, y + dy) for x, y in pts]


# ---------------------------------------------------------------------------------------------------------------- builder

class Kit:
    """Adds closed solids to a bmesh in a local frame (origin o, axes x, y, n in Blender space)."""

    def __init__(self, bm: bmesh.types.BMesh, col_layer: Any, tag_layer: Any) -> None:
        self.bm = bm
        self.col = col_layer
        self.tag = tag_layer
        self.frame: tuple[Vector, Vector, Vector, Vector] | None = None
        self.new_faces: list[bmesh.types.BMFace] = []
        self.cut_colour = (0.01, 0.01, 0.012, 1.0)   # the colour of a pocket cutter (its walls and floor become body faces of this colour)
        self.textured = False   # True: the faces of this part take the face picture like the body (a raised deck plate)

    def set_frame(self, o: Vector, x: Vector, y: Vector, n: Vector) -> None:
        self.frame = (o, x, y, n)

    def vert(self, x: float, y: float, z: float) -> bmesh.types.BMVert:
        o, ax, ay, an = self.frame  # type: ignore[misc]
        return self.bm.verts.new(o + ax * x + ay * y + an * z)

    def face(self, verts: list[bmesh.types.BMVert], colour: tuple[float, float, float, float]) -> bmesh.types.BMFace | None:
        try:
            f = self.bm.faces.new(verts)
        except ValueError:
            return None   # a duplicate face (never happens in a well-formed stack)
        f[self.tag] = 0 if self.textured else 1
        for loop in f.loops:
            loop[self.col] = colour
        self.new_faces.append(f)
        return f

    def stack(self, rings: list[tuple[float, list[tuple[float, float]]]], colour: tuple[float, float, float, float], top: tuple[float, float, float, float] | None = None, cap_bottom: bool = True, cap_top: bool = True) -> list[list[bmesh.types.BMVert]]:
        """A solid made of outlines (z, points) with the same point count, joined by bands; closed by a bottom and a top cap. `top` colours the top cap."""
        vr = [[self.vert(x, y, z) for (x, y) in pts] for (z, pts) in rings]
        for a, b in zip(vr[:-1], vr[1:]):
            n = len(a)
            for i in range(n):
                j = (i + 1) % n
                self.face([a[i], a[j], b[j], b[i]], colour)
        if cap_bottom:
            self.face(list(reversed(vr[0])), colour)
        if cap_top:
            self.face(list(vr[-1]), top or colour)
        return vr

    def tube(self, outer: list[tuple[float, float]], inner: list[tuple[float, float]], z0: float, z1: float, floor: float, colour: tuple[float, float, float, float], well: tuple[float, float, float, float]) -> list[bmesh.types.BMVert]:
        """A collar: outer wall z0..z1, top annulus, inner wall down to `floor`, the dark floor, the bottom cap. Closed. Returns the floor ring vertices."""
        n = len(outer)
        ob = [self.vert(x, y, z0) for x, y in outer]
        ot = [self.vert(x, y, z1) for x, y in outer]
        it = [self.vert(x, y, z1) for x, y in inner]
        ib = [self.vert(x, y, floor) for x, y in inner]
        for i in range(n):
            j = (i + 1) % n
            self.face([ob[i], ob[j], ot[j], ot[i]], colour)     # outer wall
            self.face([ot[i], ot[j], it[j], it[i]], colour)     # top annulus
            self.face([it[i], it[j], ib[j], ib[i]], well)       # inner wall, facing the axis
        self.face(list(ib), well)                                # the floor, facing out
        self.face(list(reversed(ob)), colour)                    # the bottom
        return ib

    def finish_part(self) -> None:
        if self.new_faces:
            bmesh.ops.recalc_face_normals(self.bm, faces=self.new_faces)
        self.new_faces = []


# ---------------------------------------------------------------------------------------------------------------- the parts

def _p(params: dict[str, float], name: str, default: float) -> float:
    v = params.get(name)
    return default if v is None else float(v)


def make_knob(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    dia = _p(params, "diaMm", 18.0) * MM
    h = _p(params, "heightMm", 14.0) * MM
    collar_d = _p(params, "collarDiaMm", 0.0) * MM
    collar_h = _p(params, "collarHeightMm", 0.0) * MM
    knurl = int(_p(params, "knurl", 0))
    bev = min(_p(params, "bevelMm", 1.2) * MM, h * 0.3, dia * 0.2)
    taper = _p(params, "taper", 0.06)
    pointer = _p(params, "pointer", 1.0)
    ang = math.radians(_p(params, "angleDeg", 0.0))
    n = max(24, knurl * 2) if knurl else 20
    col = lifted_linear(c1)
    r = dia / 2
    rings: list[tuple[float, list[tuple[float, float]]]] = []
    mods = None
    if knurl:
        mods = [1.0, 0.955] * (n // 2)
        mods = mods[:n]
    if collar_d > dia and collar_h > 0:
        rc = collar_d / 2
        rings += [(-EMBED, circle(rc, n)), (collar_h * 0.85, circle(rc, n)), (collar_h, circle(rc * 0.97, n))]
        z_body = collar_h
    else:
        rings.append((-EMBED, circle(r, n, mods)))
        z_body = 0.0
    rt = r * (1.0 - taper)
    rings.append((z_body + 0.0004, circle(r * 0.97, n, mods)))
    rings.append((h - bev, circle(rt, n, mods)))
    rings.append((h - bev * 0.35, circle(rt - bev * 0.55, n)))
    rings.append((h, circle(rt - bev, n)))
    k.stack(rings, col)
    k.finish_part()
    if pointer:
        # a raised line on the top, from near the centre to the rim, along the knob's own angle
        L = rt - bev
        w = max(0.5 * MM, dia * 0.05)
        rect = [(0.18 * L, -w / 2), (L * 0.98, -w / 2), (L * 0.98, w / 2), (0.18 * L, w / 2)]
        c, s = math.cos(ang + math.pi / 2), math.sin(ang + math.pi / 2)
        rot = [(x * c - y * s, x * s + y * c) for x, y in rect]
        k.stack([(h - 0.05 * MM, rot), (h + 0.35 * MM, rot)], lifted_linear(c2))
        k.finish_part()


def make_button(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    dia = _p(params, "diaMm", 0.0) * MM
    w = (dia if dia else _p(params, "widthMm", 9.0) * MM)
    hgt = (dia if dia else _p(params, "heightMm", 6.0) * MM)
    rise = _p(params, "riseMm", 1.6) * MM
    corner = (min(w, hgt) / 2 if dia else _p(params, "cornerMm", 1.2) * MM)
    bev = min(_p(params, "bevelMm", 0.5) * MM, rise * 0.45, min(w, hgt) * 0.25)
    frame = _p(params, "frameMm", 0.0) * MM
    seg = 5 if dia else 3
    col = lifted_linear(c1)
    if frame > 0:
        fo = rrect(w + 2 * frame, hgt + 2 * frame, corner + frame, seg)
        k.stack([(-EMBED, fo), (0.35 * MM, fo)], lifted_linear(c2))
        k.finish_part()
    base = rrect(w, hgt, corner, seg)
    k.stack(
        [
            (-EMBED, base),
            (rise - bev, base),
            (rise - bev * 0.3, rrect(w - 1.2 * bev, hgt - 1.2 * bev, max(corner - 0.6 * bev, 0.02 * MM), seg)),
            (rise, rrect(w - 2 * bev, hgt - 2 * bev, max(corner - bev, 0.02 * MM), seg)),
        ],
        col,
    )
    k.finish_part()


def make_fader(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    slot_l = _p(params, "slotLenMm", 100.0) * MM
    slot_w = _p(params, "slotWidthMm", 3.0) * MM
    cap_w = _p(params, "capWidthMm", 10.0) * MM
    cap_l = _p(params, "capLenMm", 20.0) * MM
    cap_h = _p(params, "capHeightMm", 10.0) * MM
    pos = max(0.0, min(1.0, _p(params, "posFrac", 0.25)))
    horizontal = _p(params, "horizontal", 0.0) > 0
    bev = min(_p(params, "bevelMm", 1.2) * MM, cap_h * 0.3, cap_w * 0.2)
    sw, sl = (slot_l, slot_w) if horizontal else (slot_w, slot_l)
    rail = 0.9 * MM
    slot = rrect(sw, sl, min(sw, sl) / 2, 4)
    outer = rrect(sw + 2 * rail, sl + 2 * rail, min(sw, sl) / 2 + rail, 4)
    k.tube(outer, slot, -EMBED, 0.5 * MM, 0.1 * MM, lifted_linear("#7a7e84"), lifted_linear(c2))
    k.finish_part()
    # the cap rides in the slot at posFrac of its length (0 = the rear / left end)
    span = (slot_l - cap_l) if slot_l > cap_l else 0.0
    off = -slot_l / 2 + cap_l / 2 + pos * span
    cx, cy = (off, 0.0) if horizontal else (0.0, off)
    cw, cl = (cap_l, cap_w) if horizontal else (cap_w, cap_l)
    base = shifted(rrect(cw, cl, min(cw, cl) * 0.18, 3), cx, cy)
    top1 = shifted(rrect(cw - 1.0 * bev, cl - 1.0 * bev, min(cw, cl) * 0.14, 3), cx, cy)
    top2 = shifted(rrect(cw - 2.2 * bev, cl - 2.2 * bev, min(cw, cl) * 0.1, 3), cx, cy)
    k.stack([(0.2 * MM, base), (cap_h - bev, base), (cap_h - bev * 0.35, top1), (cap_h, top2)], lifted_linear(c1))
    k.finish_part()
    # the white index line across the cap top
    lw, ll = (0.5 * MM, cw * 0.78) if not horizontal else (cl * 0.78, 0.5 * MM)
    line = shifted(rrect(ll if not horizontal else lw, lw if not horizontal else ll, 0.1 * MM, 1), cx, cy)
    k.stack([(cap_h - 0.1 * MM, line), (cap_h + 0.3 * MM, line)], lifted_linear("#e8e8e8"))
    k.finish_part()


def _pins_xlr(dia: float) -> list[tuple[float, float, float]]:
    r = dia * 0.5
    return [(0.0, r * 0.52, r * 0.1), (-r * 0.46, -r * 0.3, r * 0.1), (r * 0.46, -r * 0.3, r * 0.1)]


def make_socket(k: Kit, params: dict[str, float], c1: str, c2: str, stype: str) -> None:
    rise = _p(params, "riseMm", 1.3) * MM
    collar = _p(params, "collarMm", 1.4) * MM
    well_d = _p(params, "wellMm", _p(params, "riseMm", 1.3)) * MM   # by default the well floor is flush with the panel plane: the port node (on that plane) sits on it
    col, wel = lifted_linear(c1), lifted_linear(c2)
    round_defaults = {"xlr": 19.5, "jack": 9.5, "trs": 7.0, "rca": 8.0, "bnc": 10.0, "powercon": 24.0, "speakon": 24.0, "din": 15.0, "ethercon": 24.0}
    rect_defaults = {"usbb": (12.0, 11.0), "usb": (12.0, 4.6), "rj45": (14.0, 13.0), "iec": (27.0, 19.0), "sfp": (14.0, 9.0), "generic": (10.0, 6.0)}
    if stype in round_defaults or _p(params, "diaMm", 0) > 0:
        dia = _p(params, "diaMm", round_defaults.get(stype, 10.0)) * MM
        n = 24 if dia > 12 * MM else 16
        inner = circle(dia / 2, n)
        outer = circle(dia / 2 + collar, n)
        k.tube(outer, inner, -EMBED, rise, rise - well_d, col, wel)
        k.finish_part()
        z = rise - well_d
        pins: list[tuple[float, float, float]] = []
        if stype == "xlr":
            pins = _pins_xlr(dia)
        elif stype in ("rca", "bnc"):
            pins = [(0.0, 0.0, dia * 0.13)]
        elif stype in ("jack", "trs"):
            pins = [(0.0, 0.0, dia * 0.28)]
        for (px, py, pr) in pins:
            ring = shifted(circle(pr, 8), px, py)
            k.stack([(z - 0.02 * MM, ring), (z + 0.55 * MM, ring)], lifted_linear("#b8bcc2"))
            k.finish_part()
        if stype == "xlr":
            # the locking latch notch window above the opening, a dark slot in the collar top is too small: a small light latch plate below
            lw = dia * 0.34
            latch = shifted(rrect(lw, dia * 0.12, 0.3 * MM, 1), 0.0, -(dia / 2 + collar * 0.5))
            k.stack([(rise - 0.02 * MM, latch), (rise + 0.25 * MM, latch)], lifted_linear("#b8bcc2"))
            k.finish_part()
    else:
        w0, h0 = rect_defaults.get(stype, rect_defaults["generic"])
        w = _p(params, "widthMm", w0) * MM
        h = _p(params, "heightMm", h0) * MM
        r = min(w, h) * 0.12
        inner = rrect(w, h, r, 2)
        outer = rrect(w + 2 * collar, h + 2 * collar, r + collar, 2)
        k.tube(outer, inner, -EMBED, rise, rise - well_d, col, wel)
        k.finish_part()
        z = rise - well_d
        if stype == "usbb":
            for px in (-w * 0.28, w * 0.28):
                pin = shifted(rrect(w * 0.14, h * 0.2, 0.15 * MM, 1), px, h * 0.12)
                k.stack([(z - 0.02 * MM, pin), (z + 0.5 * MM, pin)], lifted_linear("#b8bcc2"))
                k.finish_part()
        if stype in ("usb", "rj45", "sfp"):
            tw, th = (w * 0.86, h * 0.28) if stype == "usb" else (w * 0.7, h * 0.14)
            tongue = shifted(rrect(tw, th, 0.1 * MM, 1), 0.0, -h * 0.1 if stype == "usb" else -h * 0.28)
            k.stack([(z - 0.02 * MM, tongue), (z + 0.5 * MM, tongue)], lifted_linear("#b8bcc2"))
            k.finish_part()
        if stype == "iec":
            for px, py in ((0.0, h * 0.2), (-w * 0.22, -h * 0.12), (w * 0.22, -h * 0.12)):
                blade = shifted(rrect(w * 0.1, h * 0.2, 0.2 * MM, 1), px, py)
                k.stack([(z - 0.02 * MM, blade), (z + 0.6 * MM, blade)], lifted_linear("#b8bcc2"))
                k.finish_part()


def make_screw(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    d = _p(params, "diaMm", 3.0) * MM
    rise = _p(params, "riseMm", 0.7) * MM
    col = lifted_linear(c1)
    k.stack([(-EMBED, circle(d / 2, 12)), (rise * 0.7, circle(d / 2, 12)), (rise, circle(d / 2 * 0.78, 12))], col)
    k.finish_part()
    slot = [(-d * 0.3, -0.18 * MM), (d * 0.3, -0.18 * MM), (d * 0.3, 0.18 * MM), (-d * 0.3, 0.18 * MM)]
    k.stack([(rise - 0.04 * MM, slot), (rise + 0.12 * MM, slot)], lifted_linear(c2))
    k.finish_part()


def make_led(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    rise = _p(params, "riseMm", 0.8) * MM
    d = _p(params, "diaMm", 2.5) * MM
    w = _p(params, "widthMm", 0.0) * MM
    h = _p(params, "heightMm", 0.0) * MM
    col = lifted_linear(c1)
    if w > 0 and h > 0:
        base = rrect(w, h, min(w, h) * 0.3, 2)
        k.stack([(-EMBED, base), (rise * 0.7, base), (rise, rrect(w * 0.85, h * 0.8, min(w, h) * 0.25, 2))], col)
    else:
        k.stack([(-EMBED, circle(d / 2, 12)), (rise * 0.6, circle(d / 2, 12)), (rise, circle(d / 2 * 0.6, 12))], col)
    k.finish_part()


def make_slot(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    ln = _p(params, "lengthMm", 40.0) * MM
    wd = _p(params, "widthMm", 3.0) * MM
    rise = _p(params, "riseMm", 0.25) * MM
    horizontal = _p(params, "horizontal", 0.0) > 0
    sw, sl = (ln, wd) if horizontal else (wd, ln)
    shape = rrect(sw, sl, min(sw, sl) / 2, 4)
    k.stack([(-EMBED, shape), (rise, shape)], lifted_linear(c1))
    k.finish_part()


def make_foot(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    d = _p(params, "diaMm", 14.0) * MM
    h = _p(params, "heightMm", 4.0) * MM
    r = d / 2
    k.stack([(-EMBED, circle(r, 20)), (h * 0.8, circle(r, 20)), (h, circle(r * 0.88, 20))], lifted_linear(c1))
    k.finish_part()


def make_rod(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    """A round bar between two points of the part's local frame (mm from the hit point: x right, y up on the face, z out of it): a handle, a rail, a yoke arm, a stand leg."""
    p0 = Vector((_p(params, 'x1Mm', 0.0), _p(params, 'y1Mm', 0.0), _p(params, 'z1Mm', 0.0))) * MM
    p1 = Vector((_p(params, 'x2Mm', 0.0), _p(params, 'y2Mm', 0.0), _p(params, 'z2Mm', 30.0))) * MM
    r = _p(params, 'diaMm', 6.0) * MM / 2
    n = int(_p(params, 'segments', 12))
    axis = p1 - p0
    if axis.length < 1e-9:
        raise PartError('a rod needs two different end points')
    a = axis.normalized()
    ref = Vector((0.0, 0.0, 1.0)) if abs(a.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    u = a.cross(ref).normalized()
    v = a.cross(u).normalized()
    col = lifted_linear(c1)
    ends = []
    for p in (p0, p1):
        ring = []
        for i in range(n):
            ang = 2 * math.pi * i / n
            q = p + u * (r * math.cos(ang)) + v * (r * math.sin(ang))
            ring.append(k.vert(q.x, q.y, q.z))
        ends.append(ring)
    for i in range(n):
        j = (i + 1) % n
        k.face([ends[0][i], ends[0][j], ends[1][j], ends[1][i]], col)
    k.face(list(reversed(ends[0])), col)
    k.face(list(ends[1]), col)
    k.finish_part()


def make_ball(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    """A sphere (a joint, a ball end): diaMm, centre zMm above the surface."""
    r = _p(params, 'diaMm', 10.0) * MM / 2
    cz = _p(params, 'zMm', 0.0) * MM
    rings = []
    stations = [(-1.0, 0.0), (-0.8, 0.6), (-0.4, 0.917), (0.0, 1.0), (0.4, 0.917), (0.8, 0.6), (1.0, 0.0)]
    n = 14
    col = lifted_linear(c1)
    vr = []
    for (zf, rf) in stations:
        if rf == 0.0:
            vr.append([k.vert(0.0, 0.0, cz + zf * r)])
        else:
            vr.append([k.vert(rf * r * math.cos(2 * math.pi * i / n), rf * r * math.sin(2 * math.pi * i / n), cz + zf * r) for i in range(n)])
    for a, b in zip(vr[:-1], vr[1:]):
        if len(a) == 1:
            for i in range(n):
                k.face([a[0], b[(i + 1) % n], b[i]], col)
        elif len(b) == 1:
            for i in range(n):
                k.face([a[i], a[(i + 1) % n], b[0]], col)
        else:
            for i in range(n):
                j = (i + 1) % n
                k.face([a[i], a[j], b[j], b[i]], col)
    k.finish_part()


def make_prism(k: Kit, params: dict[str, float], c1: str, c2: str, points: list[list[float]]) -> None:
    """A solid with any outline: the polygon (mm, local x right and y up on the face) extruded outwards by riseMm, the top edge softened by shrinking the polygon."""
    rise = _p(params, "riseMm", 5.0) * MM
    bev = min(_p(params, "bevelMm", 0.8) * MM, rise * 0.4)
    pts = [(p[0] * MM, p[1] * MM) for p in points]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    def shrink(amount: float) -> list[tuple[float, float]]:
        out = []
        for (x, y) in pts:
            dx, dy = x - cx, y - cy
            ln = math.hypot(dx, dy) or 1.0
            out.append((x - dx / ln * amount, y - dy / ln * amount))
        return out
    col = lifted_linear(c1)
    k.stack([(-EMBED, pts), (rise - bev, pts), (rise, shrink(bev))], col)
    k.finish_part()


def make_ring(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    """An annulus standing proud: a bezel round a knob or a jack, a driver surround. outer/inner diameters, rise, optional floor colour2 inside."""
    do = _p(params, 'diaMm', 30.0) * MM
    di = _p(params, 'innerDiaMm', do * 0.7 / MM) * MM
    rise = _p(params, 'riseMm', 1.5) * MM
    floor = _p(params, 'floorMm', 0.3) * MM
    n = 28 if do > 20 * MM else 18
    k.tube(circle(do / 2, n), circle(di / 2, n), -EMBED, rise, floor, lifted_linear(c1), lifted_linear(c2))
    k.finish_part()


def make_driver(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    """A loudspeaker driver: a raised surround ring, a shallow cone dish and a dust cap (colour = cone, colour2 = surround and cap)."""
    d = _p(params, 'diaMm', 100.0) * MM
    rise = _p(params, 'riseMm', 3.0) * MM
    cap_d = _p(params, 'capDiaMm', d * 0.28 / MM) * MM
    n = 36 if d > 60 * MM else 24
    r = d / 2
    sur = lifted_linear(c2)
    cone = lifted_linear(c1)
    k.stack([(-EMBED, circle(r, n)), (rise * 0.8, circle(r, n)), (rise, circle(r * 0.93, n)), (rise * 0.6, circle(r * 0.84, n))], sur)
    k.finish_part()
    k.stack([(rise * 0.2, circle(r * 0.84, n)), (rise * 0.35, circle(r * 0.6, n)), (rise * 0.55, circle(r * 0.34, n)), (rise * 0.75, circle(cap_d / 2, n))], cone)
    k.finish_part()
    k.stack([(rise * 0.72, circle(cap_d / 2, n)), (rise * 1.05, circle(cap_d / 2 * 0.8, n)), (rise * 1.3, circle(cap_d / 2 * 0.35, n))], sur)
    k.finish_part()


WHITE_SEMITONES = (0, 2, 4, 5, 7, 9, 11)
BLACK_AFTER = {0, 2, 5, 7, 9}   # a black key follows the white keys C, D, F, G, A of an octave


def make_keys(k: Kit, params: dict[str, float], c1: str, c2: str) -> None:
    n_white = int(_p(params, "whiteCount", 15))
    pitch = _p(params, "whitePitchMm", 23.5) * MM
    length = _p(params, "whiteLenMm", 90.0) * MM
    black_len = _p(params, "blackLenMm", 55.0) * MM
    black_w = _p(params, "blackWidthMm", 13.5) * MM
    rise = _p(params, "riseMm", 8.0) * MM
    gap = _p(params, "gapMm", 0.5) * MM
    start = int(_p(params, "startNote", 0))
    sgn = -1.0 if _p(params, "dir", 1) < 0 else 1.0   # -1: the keys step towards -x (a keyboard measured from the left of a top-view photo on the top face)
    white, black = lifted_linear(c1), lifted_linear(c2)
    bev = min(1.2 * MM, rise * 0.3)
    for i in range(n_white):
        xa, xb = i * pitch, (i + 1) * pitch
        x0, x1 = (xa + gap / 2, xb - gap / 2) if sgn > 0 else (-xb + gap / 2, -xa - gap / 2)
        y0, y1 = 0.0, length
        # a key: a box whose front top edge is chamfered
        rings = [
            (-EMBED, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]),
            (rise - bev, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]),
            (rise, [(x0 + bev * 0.3, y0 + bev * 0.3), (x1 - bev * 0.3, y0 + bev * 0.3), (x1 - bev * 0.3, y1 - bev), (x0 + bev * 0.3, y1 - bev)]),
        ]
        k.stack(rings, white)
        k.finish_part()
    for i in range(n_white - 1):
        degree = (i + start) % 7
        if WHITE_SEMITONES[degree] not in BLACK_AFTER:
            continue
        cx = sgn * (i + 1) * pitch
        x0, x1 = cx - black_w / 2, cx + black_w / 2
        y0, y1 = 0.0, black_len   # the black keys sit at the far (rear) end of the keys
        zt = rise + 6.5 * MM
        rings = [
            (rise - 0.5 * MM, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]),
            (zt - bev, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]),
            (zt, [(x0 + bev * 0.5, y0 + bev * 0.5), (x1 - bev * 0.5, y0 + bev * 0.5), (x1 - bev * 0.5, y1 - bev), (x0 + bev * 0.5, y1 - bev)]),
        ]
        k.stack(rings, black)
        k.finish_part()


MAKERS: dict[str, Callable[..., None]] = {
    "knob": make_knob, "button": make_button, "fader": make_fader, "screw": make_screw, "led": make_led,
    "slot": make_slot, "foot": make_foot, "keys": make_keys, "rod": make_rod, "ball": make_ball, "ring": make_ring, "driver": make_driver,
}   # prism and socket are called with extra arguments in apply_structure
DEFAULT_COLOURS = {
    "knob": ("#2a2a2e", "#e8e8e8"), "button": ("#8a8a90", "#1a1a1c"), "fader": ("#1c1c1f", "#0a0a0b"), "socket": ("#9ea3aa", "#0b0b0d"),
    "screw": ("#9a9ea6", "#2a2a2e"), "led": ("#30e060", "#202020"), "keys": ("#efefef", "#18181a"), "slot": ("#0a0a0b", "#0a0a0b"), "foot": ("#1c1c1f", "#1c1c1f"), "rod": ("#9a9ea6", "#9a9ea6"), "ball": ("#9a9ea6", "#9a9ea6"), "ring": ("#9a9ea6", "#0b0b0d"), "driver": ("#1c1c1f", "#2a2a2e"), "prism": ("#2a2a2e", "#2a2a2e"),
}


def g2b(v: list[float] | tuple[float, float, float]) -> Vector:
    return Vector((v[0], -v[2], v[1]))


def frame_of(inst: dict[str, Any], tree: BVHTree) -> tuple[Vector, Vector, Vector, Vector]:
    """The surface frame of an instance: (origin, x, y, normal) in Blender space, from a ray cast onto the body."""
    origin = g2b(inst["origin"])
    direction = g2b(inst["dir"]).normalized()
    hit = tree.ray_cast(origin, direction)
    if hit[0] is None:
        raise PartError(f"part {inst['part']} ({inst['kind']}) missed the body: its face position is outside the casing (check xMm, yMm and the face)")
    loc, nrm = hit[0], hit[1].normalized()
    if nrm.dot(direction) > 0:
        nrm = -nrm
    xa = g2b(inst["xAxis"])
    xa = (xa - nrm * xa.dot(nrm))
    if xa.length < 1e-6:
        xa = Vector((1.0, 0.0, 0.0)) - nrm * nrm.x
    xa.normalize()
    ya = nrm.cross(xa)
    lift = (inst.get("params") or {}).get("zMm")   # a part stacked on another (a cap on a stem): lifted along the surface normal
    if lift:
        loc = loc + nrm * (lift * MM)
    sh = inst.get("shiftMm")
    if sh:   # the ray was cast at the middle of a wide part: the frame origin goes back to its anchor
        loc = loc - xa * (sh[0] * MM) - ya * (sh[1] * MM)
    return loc, xa, ya, nrm


def make_pocket_cutter(k: Kit, params: dict[str, float]) -> None:
    """The closed solid cut out of the body: a round or rounded-rectangle prism from 2 mm above the surface down to depthMm below it."""
    depth = _p(params, "depthMm", 3.0) * MM
    dia = _p(params, "diaMm", 0.0) * MM
    if dia > 0:
        pts = circle(dia / 2, 28 if dia > 12 * MM else 18)
    else:
        w = _p(params, "widthMm", 10.0) * MM
        h = _p(params, "heightMm", 6.0) * MM
        pts = rrect(w, h, _p(params, "cornerMm", 1.0) * MM, 3)
    k.stack([(-depth, pts), (2.0 * MM, pts)], k.cut_colour)
    k.finish_part()


def apply_structure(ob: bpy.types.Object, plan: dict[str, Any], colour_attribute: str) -> dict[str, int]:
    """Cuts every pocket of plan['parts'] into the body (one boolean) and adds every other part to its mesh. Returns {'parts': instances built}. Raises PartError when a part misses the body."""
    parts = plan.get("parts") or []
    if not parts:
        return {"parts": 0}
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    tree = BVHTree.FromBMesh(bm)      # every frame is taken on the body as it was before the pockets were cut
    bm.free()
    pockets = [p for p in parts if p["kind"] == "pocket"]
    if pockets:
        cbm = bmesh.new()
        c_col = cbm.loops.layers.float_color.new(colour_attribute)
        c_tag = cbm.faces.layers.int.new(TAG)
        ck = Kit(cbm, c_col, c_tag)
        for inst in pockets:
            ck.set_frame(*frame_of(inst, tree))
            c1 = inst.get("colour") or "#0b0b0d"
            ck.cut_colour = lifted_linear(c1)
            make_pocket_cutter(ck, inst.get("params") or {})
        cme = bpy.data.meshes.new("tk-cutter")
        cbm.to_mesh(cme)
        cbm.free()
        cutter = bpy.data.objects.new("tk-cutter", cme)
        bpy.context.scene.collection.objects.link(cutter)
        mod = ob.modifiers.new("tkcut", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.use_self = True            # a body made of overlapping shells (a rack unit: chassis, plate, ears) needs the self-intersection handling
        mod.use_hole_tolerant = True
        mod.object = cutter
        bpy.context.view_layer.objects.active = ob
        for o in bpy.context.view_layer.objects:
            o.select_set(o == ob)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
        bpy.data.meshes.remove(cme)
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    col_layer = bm.loops.layers.float_color.get(colour_attribute)
    if col_layer is None:
        raise PartError(f"the body has no colour attribute {colour_attribute!r}")
    tag_layer = bm.faces.layers.int.get(TAG) or bm.faces.layers.int.new(TAG)
    kit = Kit(bm, col_layer, tag_layer)
    built = len(pockets)
    for inst in parts:
        kind = inst["kind"]
        if kind == "pocket":
            continue
        kit.set_frame(*frame_of(inst, tree))
        d1, d2 = DEFAULT_COLOURS[kind]
        c1 = inst.get("colour") or d1
        c2 = inst.get("colour2") or d2
        params = inst.get("params") or {}
        kit.textured = params.get("textured", 0) > 0   # the faces of this part take the face picture (printed legends on a button top, a brushed knob top)
        if kind == "socket":
            make_socket(kit, params, c1, c2, inst.get("type") or "generic")
        elif kind == "prism":
            make_prism(kit, params, c1, c2, inst["points"])
        else:
            MAKERS[kind](kit, params, c1, c2)
        built += 1
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    import math as _m
    me.set_sharp_from_angle(angle=_m.radians(40.0))
    attr = me.color_attributes[colour_attribute]
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = list(me.color_attributes).index(attr)
    return {"parts": built}
