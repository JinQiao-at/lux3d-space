# Blender headless 拆分脚本（T-021）：GLB → 按连通体分离 → body + pointer 两个 GLB。
# 用法见同目录 README.md。仅依赖 bpy（Blender 内置），无网络。

import bpy
import sys
import os

SEPARATOR = "--"


def _argv_after_separator():
    argv = sys.argv
    return argv[argv.index(SEPARATOR) + 1:] if SEPARATOR in argv else []


def parse_args():
    args = _argv_after_separator()
    def opt(name, fallback=None):
        return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else fallback
    input_path = opt("--input")
    out_dir = opt("--out-dir")
    prefix = opt("--prefix")
    if not input_path or not out_dir or not prefix:
        print("[split] 缺参数：--input <glb> --out-dir <dir> --prefix <id>")
        sys.exit(2)
    return input_path, out_dir, prefix


def bbox_volume(obj):
    world = [obj.matrix_world @ v.co for v in obj.data.vertices]
    if not world:
        return 0.0
    xs = [v.x for v in world]
    ys = [v.y for v in world]
    zs = [v.z for v in world]
    return max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)


def main():
    input_path, out_dir, prefix = parse_args()
    if not os.path.isfile(input_path):
        print(f"[split] 输入不存在: {input_path}")
        sys.exit(2)
    os.makedirs(out_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=input_path)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    print(f"[split] 导入 mesh 数: {len(meshes)}")
    if not meshes:
        print("[split] 输入没有网格，退出")
        sys.exit(3)

    # 生成式 GLB 经 quantize 后顶点不共享 → 先 join + 焊点（merge by distance）再分离
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # 量化容差：1mm 对 0.3m 转盘安全；过大并碎、过小不焊
    bpy.ops.mesh.remove_doubles(threshold=0.001)
    bpy.ops.object.mode_set(mode="OBJECT")
    print("[split] 已 join + remove_doubles(0.001)")

    if bpy.ops.mesh.separate(type="LOOSE") == {"FINISHED"}:
        print("[split] 已按连通体分离")

    parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    print(f"[split] 分离后部件数: {len(parts)}")

    # 按包围盒体积降序：最大 = body（盘体/门体），其余合并为 pointer（活动件）
    sized = []
    for part in parts:
        dims = bbox_volume(part)
        volume = dims[0] * dims[1] * dims[2]
        sized.append((part, volume))
        print(f"[split]   {part.name}  dims={tuple(round(d, 4) for d in dims)}  vol={volume:.6f}")
    sized.sort(key=lambda item: item[1], reverse=True)

    if len(sized) < 2:
        print("[split] SINGLE_PART：连通体不可分（雕刻一体），整件输出为 body；调用方降级处理")

    body_parts = [sized[0][0]]
    pointer_parts = [p for p, _ in sized[1:]]

    def export_selected(selected, path):
        bpy.ops.object.select_all(action="DESELECT")
        for part in selected:
            part.select_set(True)
        bpy.context.view_layer.objects.active = selected[0]
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True)
        size = os.path.getsize(path)
        print(f"[split] 导出 {os.path.basename(path)}  {size} bytes")

    body_path = os.path.join(out_dir, f"{prefix}_body.glb")
    pointer_path = os.path.join(out_dir, f"{prefix}_pointer.glb")
    export_selected(body_parts, body_path)
    if pointer_parts:
        export_selected(pointer_parts, pointer_path)
    else:
        print("[split] 无独立活动件（SINGLE_PART），跳过 pointer 导出")

    print(f"[split] DONE prefix={prefix} parts={len(sized)}")


main()
