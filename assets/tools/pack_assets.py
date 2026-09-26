"""Pack RGBA frames into TexturePacker-style JSON Hash atlases."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from png_rgba import alpha_bounds, read_png, write_png

ROOT = Path(__file__).resolve().parents[1]
MAX_SIZE = 2048
PADDING = 2
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
BY_ID = {unit["id"]: unit for unit in UNITS}
FRAME_PATTERN = re.compile(r"^(?P<id>[a-z0-9_]+)_(?P<state>[a-z]+)_(?P<index>\d{2})\.png$")


def power_of_two(value: int) -> int:
    return 1 << (max(256, value) - 1).bit_length()


def trim_frame(path: Path) -> dict:
    width, height, pixels = read_png(path)
    left, top, trimmed_width, trimmed_height = alpha_bounds(width, height, pixels)
    trimmed = bytearray(trimmed_width * trimmed_height * 4)
    for y in range(trimmed_height):
        source = ((top + y) * width + left) * 4
        target = y * trimmed_width * 4
        trimmed[target : target + trimmed_width * 4] = pixels[source : source + trimmed_width * 4]
    return {
        "name": path.name,
        "source": (width, height),
        "trim": (left, top, trimmed_width, trimmed_height),
        "pixels": trimmed,
    }


def collect_frames() -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    final_dir = ROOT / "frames" / "units"
    placeholder_dir = ROOT / "placeholders" / "units"
    for unit in UNITS:
        prefix = f"{unit['id']}_"
        sources = {path.name: path for path in (placeholder_dir / unit["faction"]).glob(f"{prefix}*.png")}
        sources.update({path.name: path for path in (final_dir / unit["faction"]).glob(f"{prefix}*.png")})
        for path in (sources[name] for name in sorted(sources)):
            match = FRAME_PATTERN.match(path.name)
            if not match or match.group("id") != unit["id"]:
                raise ValueError(f"Bad frame name: {path}")
            item = trim_frame(path)
            item.update(unit_id=unit["id"], state=match.group("state"), index=int(match.group("index")), source_path=path.relative_to(ROOT).as_posix())
            tier_group = "t1_t6" if unit["tier"] <= 6 else "t7_t9"
            groups[f"{unit['faction']}_{tier_group}"].append(item)
    for other in ("effects", "ui"):
        folder = ROOT / "frames" / other
        if folder.exists():
            for path in sorted(folder.glob("*.png")):
                item = trim_frame(path)
                item.update(unit_id=None, state=None, index=None, source_path=path.relative_to(ROOT).as_posix())
                groups[other].append(item)
    return dict(groups)


def arrange(items: list[dict]) -> list[list[dict]]:
    pages: list[list[dict]] = []
    page: list[dict] = []
    cursor_x = cursor_y = row_height = 0
    for item in sorted(items, key=lambda value: (-value["trim"][3], value["name"])):
        width, height = item["trim"][2:]
        occupied_width = width + PADDING * 2
        occupied_height = height + PADDING * 2
        if occupied_width > MAX_SIZE or occupied_height > MAX_SIZE:
            raise ValueError(f"{item['name']}: trimmed frame exceeds atlas size")
        if cursor_x + occupied_width > MAX_SIZE:
            cursor_x = 0
            cursor_y += row_height
            row_height = 0
        if cursor_y + occupied_height > MAX_SIZE:
            pages.append(page)
            page = []
            cursor_x = cursor_y = row_height = 0
        item["x"] = cursor_x + PADDING
        item["y"] = cursor_y + PADDING
        page.append(item)
        cursor_x += occupied_width
        row_height = max(row_height, occupied_height)
    if page:
        pages.append(page)
    return pages


def blit(atlas: bytearray, atlas_width: int, item: dict) -> None:
    x, y = item["x"], item["y"]
    width, height = item["trim"][2:]
    pixels = item["pixels"]
    for row in range(height):
        target = ((y + row) * atlas_width + x) * 4
        source = row * width * 4
        atlas[target : target + width * 4] = pixels[source : source + width * 4]
        # One pixel of edge color inside the two-pixel padding prevents bleeding.
        atlas[target - 4 : target] = pixels[source : source + 4]
        atlas[target + width * 4 : target + (width + 1) * 4] = pixels[source + (width - 1) * 4 : source + width * 4]
    for offset, source_row in ((-1, 0), (height, height - 1)):
        target = ((y + offset) * atlas_width + x - 1) * 4
        source = ((y + source_row) * atlas_width + x - 1) * 4
        atlas[target : target + (width + 2) * 4] = atlas[source : source + (width + 2) * 4]


def write_atlas(group: str, page_number: int, page: list[dict], multi_page: bool) -> tuple[str, dict]:
    stem = f"{group}_{page_number + 1}" if multi_page else group
    width = power_of_two(max(item["x"] + item["trim"][2] + PADDING for item in page))
    height = power_of_two(max(item["y"] + item["trim"][3] + PADDING for item in page))
    if width > MAX_SIZE or height > MAX_SIZE:
        raise ValueError(f"Atlas {stem} exceeds {MAX_SIZE}x{MAX_SIZE}")
    atlas = bytearray(width * height * 4)
    frames = {}
    for item in page:
        blit(atlas, width, item)
        left, top, trimmed_width, trimmed_height = item["trim"]
        source_width, source_height = item["source"]
        frames[item["name"]] = {
            "frame": {"x": item["x"], "y": item["y"], "w": trimmed_width, "h": trimmed_height},
            "rotated": False,
            "trimmed": trimmed_width != source_width or trimmed_height != source_height,
            "spriteSourceSize": {"x": left, "y": top, "w": trimmed_width, "h": trimmed_height},
            "sourceSize": {"w": source_width, "h": source_height},
            "anchor": {"x": 0.5, "y": 1.0} if item["unit_id"] else {"x": 0.5, "y": 0.5},
        }
    folder = ROOT / "atlases"
    image_name = f"{stem}.png"
    json_name = f"{stem}.json"
    write_png(folder / image_name, width, height, atlas)
    atlas_json = {
        "frames": dict(sorted(frames.items())),
        "meta": {
            "app": "TECH WAR asset pipeline",
            "version": "0.1",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": width, "h": height},
            "scale": "1",
        },
    }
    (folder / json_name).write_text(json.dumps(atlas_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Packed {len(page)} frames -> {json_name} ({width}x{height})")
    return json_name, atlas_json


def main() -> int:
    groups = collect_frames()
    if not groups:
        raise ValueError("No PNG frames found; run generate:placeholders first")
    path = ROOT / "manifest.json"
    previous_atlases = set()
    if path.exists():
        previous_atlases = set(json.loads(path.read_text(encoding="utf-8")).get("atlases", []))
    manifest = {"version": "0.1", "atlases": [], "units": {}, "otherFrames": {}}
    for unit in UNITS:
        manifest["units"][unit["id"]] = {
            "id": unit["id"],
            "faction": unit["faction"],
            "tier": unit["tier"],
            "name": unit["name"],
            "anchor": [0.5, 1.0],
            "clips": {},
        }
    for group, items in sorted(groups.items()):
        pages = arrange(items)
        for page_number, page in enumerate(pages):
            atlas_name, _ = write_atlas(group, page_number, page, len(pages) > 1)
            manifest["atlases"].append(atlas_name)
            for item in page:
                reference = {"atlas": atlas_name, "frame": item["name"], "source": item["source_path"]}
                if item["unit_id"]:
                    clips = manifest["units"][item["unit_id"]]["clips"]
                    clip = clips.setdefault(
                        item["state"],
                        {
                            "fps": 15 if item["state"] == "die" else 12,
                            "loop": item["state"] in ("idle", "move", "folded", "unfolded"),
                            "frames": [],
                        },
                    )
                    clip["frames"].append((item["index"], reference))
                    if item["state"] == "attack":
                        clip["hitFrame"] = 2
                else:
                    manifest["otherFrames"][item["name"]] = reference
    for unit in manifest["units"].values():
        for clip in unit["clips"].values():
            clip["frames"] = [reference for _, reference in sorted(clip["frames"])]
    audio_path = ROOT / "audio" / "manifest.json"
    if audio_path.exists():
        audio_manifest = json.loads(audio_path.read_text(encoding="utf-8"))
        manifest["audioManifest"] = audio_path.relative_to(ROOT).as_posix()
        for unit_id, entry in manifest["units"].items():
            unit_audio = audio_manifest.get("sfx", {}).get(unit_id, {})
            entry["sfx"] = {
                action: {"ogg": sound["ogg"], "mp3": sound["mp3"]}
                for action, sound in unit_audio.items()
            }
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # A classic script can load from file://, while fetch() of local JSON is blocked
    # by many browsers. Keep the preview data in sync with every atlas build.
    preview_data = {
        "manifest": {"units": manifest["units"]},
        "atlases": {
            name: json.loads((ROOT / "atlases" / name).read_text(encoding="utf-8"))
            for name in manifest["atlases"]
        },
    }
    (ROOT / "previews" / "preview-data.js").write_text(
        "window.TECH_WAR_PREVIEW_DATA = "
        + json.dumps(preview_data, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    for old_name in previous_atlases - set(manifest["atlases"]):
        if Path(old_name).name != old_name or not old_name.endswith(".json"):
            continue
        old_json = ROOT / "atlases" / old_name
        if old_json.exists():
            old_image = json.loads(old_json.read_text(encoding="utf-8")).get("meta", {}).get("image")
            old_json.unlink()
            if isinstance(old_image, str) and Path(old_image).name == old_image:
                (ROOT / "atlases" / old_image).unlink(missing_ok=True)
    print(f"Wrote {path.relative_to(ROOT)} for {len(manifest['units'])} units")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"pack:assets failed: {error}", file=sys.stderr)
        sys.exit(1)
