"""render_views.py - four orthographic views of one GLB for the TekPractice contact sheet (Task 8).

Called by tools/assets3d/contactSheet.ts, headless:

  blender --background --factory-startup --python-exit-code 1 --python render_views.py -- \
      --in <model.glb> --plan <plan.json> --out-dir <dir>

It renders and nothing else: Node measured the model and computed every number. plan.json (all lengths in metres,
all locations and angles already in Blender space, nothing to convert or measure here):

  {sizePx, orthoScaleM, clipStartM, clipEndM, backgroundLinear: [r, g, b],
   views: [{name, location: [x, y, z], rotationDeg: [x, y, z]}, ...]}

For each view it writes <dir>/<name>.png, sizePx x sizePx, flat background, Workbench engine, base colour
texture shown (vertex colours instead when the model has them), orthographic camera with the clip start from the plan (1 mm: a larger one cut small connectors in the
old pipeline). Workbench is the lightest engine but it still renders through a GPU (OpenGL) context even with
--background: fine on a desktop, not guaranteed on a machine without a GPU or driver. On any failure it prints one
line 'RENDER_FAIL <reason>' to stderr and exits 1.
"""
from __future__ import annotations

import json
import math
import os
import sys
import traceback

import bpy


class RenderError(Exception):
    """A failure with a message meant for the user (one line)."""


def parse_args() -> dict[str, str]:
    if "--" not in sys.argv:
        raise RenderError("no '--' in the command line: pass --in, --plan, --out-dir after it")
    argv = sys.argv[sys.argv.index("--") + 1:]
    if len(argv) % 2 != 0:
        raise RenderError(f"arguments after '--' must be --flag value pairs, got {argv}")
    args = {argv[i].lstrip("-"): argv[i + 1] for i in range(0, len(argv), 2)}
    for key in ("in", "plan", "out-dir"):
        if key not in args:
            raise RenderError(f"missing --{key}")
    return args


def wipe_scene() -> None:
    """Removes the factory Cube, Camera and Light so only the model is rendered."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


def import_model(src: str) -> None:
    result = bpy.ops.import_scene.gltf(filepath=src)
    if "FINISHED" not in result:
        raise RenderError(f"the glTF importer did not finish ({result}) for {src}")
    if not any(ob.type == "MESH" for ob in bpy.data.objects):
        raise RenderError("the imported model has no mesh")


def find_image_node(socket: bpy.types.NodeSocket, depth: int = 4) -> bpy.types.Node | None:
    """The image texture node feeding `socket`, looking through up to `depth` nodes (e.g. a colour mix), or None."""
    if depth < 0 or not socket.is_linked:
        return None
    node = socket.links[0].from_node
    if node.type == "TEX_IMAGE":
        return node
    for inp in node.inputs:
        found = find_image_node(inp, depth - 1)
        if found is not None:
            return found
    return None


def activate_base_colour_images() -> None:
    """Workbench TEXTURE mode shows the ACTIVE image node: make it the one feeding Base Color. Skips quietly."""
    for mat in bpy.data.materials:
        try:
            tree = mat.node_tree
            if tree is None:
                continue
            for node in tree.nodes:
                if node.type != "BSDF_PRINCIPLED":
                    continue
                socket = node.inputs.get("Base Color")
                image = find_image_node(socket) if socket is not None else None
                if image is not None:
                    tree.nodes.active = image
                    break
        except Exception:  # noqa: BLE001 - a material that cannot be inspected keeps Blender's default
            continue


def setup_scene(plan: dict) -> None:
    scene = bpy.context.scene
    size = int(plan["sizePx"])
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    # 'Standard' = no tone mapping, so the world colour comes out as the sRGB grey Node composes the sheet on.
    scene.view_settings.view_transform = "Standard"
    scene.display.render_aa = "8"
    # No dithering noise: the background must be exactly the grey Node composes the letterbox bars on.
    scene.render.dither_intensity = 0.0
    # the plan may ask for FLAT (the projection step: the flat albedo of a face, no shading); the contact sheet keeps STUDIO
    scene.display.shading.light = str(plan.get("light", "STUDIO"))
    # A model with vertex colours (scripted builds) shows them; one flat colour per material would paint it all one grey.
    # Meshy models carry a base colour texture: TEXTURE mode shows it.
    has_vertex_colours = any(ob.type == "MESH" and len(ob.data.color_attributes) > 0 for ob in bpy.data.objects)
    has_textures = any(n.type == "TEX_IMAGE" for m in bpy.data.materials if m.node_tree is not None for n in m.node_tree.nodes)
    scene.display.shading.color_type = "VERTEX" if has_vertex_colours and not has_textures else "TEXTURE"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.color = tuple(float(v) for v in plan["backgroundLinear"])


def make_camera(plan: dict) -> bpy.types.Object:
    cam = bpy.data.cameras.new("contact_cam")
    cam.type = "ORTHO"
    cam.ortho_scale = float(plan["orthoScaleM"])
    cam.clip_start = float(plan["clipStartM"])
    cam.clip_end = float(plan["clipEndM"])
    ob = bpy.data.objects.new("contact_cam", cam)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob


def render_view(cam: bpy.types.Object, view: dict, out_dir: str) -> str:
    cam.location = tuple(float(v) for v in view["location"])
    cam.rotation_mode = "XYZ"
    cam.rotation_euler = tuple(math.radians(float(v)) for v in view["rotationDeg"])
    path = os.path.join(out_dir, f"{view['name']}.png")
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if not os.path.isfile(path):
        raise RenderError(f"the {view['name']} view was not written ({path})")
    return path


def run() -> None:
    args = parse_args()
    with open(args["plan"], encoding="utf-8") as f:
        plan = json.load(f)
    os.makedirs(args["out-dir"], exist_ok=True)

    wipe_scene()
    import_model(args["in"])
    activate_base_colour_images()
    setup_scene(plan)
    cam = make_camera(plan)
    for view in plan["views"]:
        print(f"RENDER {render_view(cam, view, args['out-dir'])}", flush=True)


def main() -> None:
    try:
        run()
    except RenderError as exc:
        sys.stderr.write(f"RENDER_FAIL {exc}\n")
        sys.stderr.flush()
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 - every failure must exit non-zero with one clear line
        traceback.print_exc()
        sys.stderr.write(f"RENDER_FAIL unexpected {type(exc).__name__}: {exc}\n")
        sys.stderr.flush()
        sys.exit(1)


main()
