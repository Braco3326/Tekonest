"""review_render.py - perspective review renders of one GLB (front three-quarter and rear three-quarter) for the model-review tool.

  blender --background --python review_render.py -- <model.glb> <out-prefix> [size-px]

Writes <out-prefix>_front.png and <out-prefix>_rear.png. Working files for comparing a model with its photo; never shipped.
The model's I/O face is +Z in glTF space (the rear of a console), so the front view looks from -Z.
"""
import math
import sys

import bpy
import mathutils
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:]
glb, prefix = argv[0], argv[1]
px = int(argv[2]) if len(argv) > 2 else 800
# optional 4th argument: views as name:azimuth:elevation:zoom:fx:fy:fz;... (zoom < 1 is a close-up; f* = look-at point as a fraction of the bounding box, default 0.5)
VIEWS = [("front", 215.0, 28.0, 1.0, (0.5, 0.5, 0.5)), ("rear", 35.0, 28.0, 1.0, (0.5, 0.5, 0.5))]
if len(argv) > 3 and argv[3]:
    VIEWS = []
    for spec in argv[3].split(";"):
        p = spec.split(":")
        VIEWS.append((p[0], float(p[1]), float(p[2]), float(p[3]) if len(p) > 3 else 1.0, tuple(float(v) for v in p[4:7]) if len(p) >= 7 else (0.5, 0.5, 0.5)))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == "MESH"]
mn = mathutils.Vector((1e9,) * 3)
mx = mathutils.Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        mn = mathutils.Vector((min(mn[i], w[i]) for i in range(3)))
        mx = mathutils.Vector((max(mx[i], w[i]) for i in range(3)))
ctr = (mn + mx) / 2
size = (mx - mn).length

world = bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.62, 0.63, 0.65, 1)
bg.inputs[1].default_value = 0.35

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 60
cam.data.clip_start = 0.0005
cam.data.clip_end = 100.0


def sun(name, loc, energy):
    ld = bpy.data.lights.new(name, "SUN")
    ld.energy = energy
    o = bpy.data.objects.new(name, ld)
    o.location = ctr + mathutils.Vector(loc) * size
    sc.collection.objects.link(o)
    o.rotation_euler = (ctr - o.location).to_track_quat("-Z", "Y").to_euler()


sun("key", (-1, 1.2, 1.4), 2.2)
sun("fill", (1.4, 0.6, 0.6), 0.7)
sun("rim", (0.2, -1.4, 1.0), 0.9)
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
sc.render.resolution_x = px
sc.render.resolution_y = int(px * 0.78)
sc.render.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "Standard"

corners = [mathutils.Vector((x, y, z)) for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)]


def fits(margin=0.07):
    bpy.context.view_layer.update()
    for c in corners:
        v = world_to_camera_view(sc, cam, c)
        if v.z <= 0 or not (margin < v.x < 1 - margin and margin < v.y < 1 - margin):
            return False
    return True


for name, az, el, zoom, focus in VIEWS:
    a, e = math.radians(az), math.radians(el)
    look = mathutils.Vector((mn.x + (mx.x - mn.x) * focus[0], mn.y + (mx.y - mn.y) * focus[1], mn.z + (mx.z - mn.z) * focus[2]))
    d = size * 0.6
    while True:
        cam.location = look + mathutils.Vector((d * math.sin(a) * math.cos(e), -d * math.cos(a) * math.cos(e), d * math.sin(e)))
        cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
        if zoom < 1.0 or fits() or d > size * 12:
            break
        d *= 1.06
    if zoom < 1.0:
        d = size * 1.0 * zoom
        cam.location = look + mathutils.Vector((d * math.sin(a) * math.cos(e), -d * math.cos(a) * math.cos(e), d * math.sin(e)))
        cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{prefix}_{name}.png'
    bpy.ops.render.render(write_still=True)
print("REVIEW_DONE")
