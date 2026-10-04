"""Validate source frames, JSON Hash atlases, and the generated asset manifest."""

from __future__ import annotations

import json
import hashlib
import sys
from pathlib import Path

from png_rgba import alpha_bounds, read_png

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
MAX_SIZE = 2048
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
BY_ID = {unit["id"]: unit for unit in UNITS}
REQUIRED = {"idle": (4, 4), "move": (6, 6), "attack": (4, 6), "die": (6, 6)}
OPTIONAL = {"cast": (4, 4), "deploy": (4, 4), "folded": (4, 4), "unfolded": (4, 4)}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def source_path(unit: dict, name: str) -> Path:
    final = ROOT / "frames" / "units" / unit["faction"] / name
    placeholder = ROOT / "placeholders" / "units" / unit["faction"] / name
    return final if final.exists() else placeholder


def check_units(manifest: dict) -> dict[str, tuple[int, int, bytearray]]:
    require(len(UNITS) == 18, f"Expected 18 unit definitions, found {len(UNITS)}")
    require(len(BY_ID) == 18, "Duplicate unit ID in units.json")
    require(set(manifest.get("units", {})) == set(BY_ID), "Manifest unit IDs differ from units.json")
    source_images = {}
    all_references = set()
    for unit in UNITS:
        unit_id = unit["id"]
        entry = manifest["units"][unit_id]
        require(entry["faction"] == unit["faction"] and entry["tier"] == unit["tier"], f"{unit_id}: metadata mismatch")
        require(entry.get("anchor") == [0.5, 1.0], f"{unit_id}: anchor must be (0.5, 1.0)")
        clips = entry.get("clips", {})
        for state, limits in REQUIRED.items():
            require(state in clips, f"{unit_id}: missing {state} clip")
            require(limits[0] <= len(clips[state]["frames"]) <= limits[1], f"{unit_id}: {state} frame count invalid")
        if unit_id == "semicon_t7_workstation":
            require("deploy" in clips, f"{unit_id}: missing deploy clip")
        if unit_id == "semicon_t5_fold":
            require("folded" in clips and "unfolded" in clips, f"{unit_id}: missing folded/unfolded silhouette")
        for state, clip in clips.items():
            art_hashes = set()
            all_final = True
            require(state in REQUIRED or state in OPTIONAL, f"{unit_id}: unknown state {state}")
            limits = REQUIRED.get(state, OPTIONAL.get(state))
            require(limits[0] <= len(clip["frames"]) <= limits[1], f"{unit_id}: {state} frame count invalid")
            require(clip["fps"] == (15 if state == "die" else 12), f"{unit_id}: {state} FPS invalid")
            require(clip["loop"] == (state in ("idle", "move", "folded", "unfolded")), f"{unit_id}: {state} loop setting invalid")
            if state == "attack":
                require(0 <= clip.get("hitFrame", -1) < len(clip["frames"]), f"{unit_id}: hitFrame invalid")
            for index, reference in enumerate(clip["frames"]):
                name = f"{unit_id}_{state}_{index:02d}.png"
                require(reference["frame"] == name, f"{unit_id}: frame order/name mismatch: {name}")
                require((reference["atlas"], name) not in all_references, f"Duplicate manifest frame: {name}")
                all_references.add((reference["atlas"], name))
                path = source_path(unit, name)
                final_path = ROOT / "frames" / "units" / unit["faction"] / name
                all_final &= path == final_path
                require(reference.get("source") == path.relative_to(ROOT).as_posix(), f"{name}: source override mismatch")
                require(path.exists(), f"Missing source frame: {path}")
                width, height, pixels = read_png(path)
                expected = 128 if unit["tier"] <= 6 else 192
                require((width, height) == (expected, expected), f"{name}: expected {expected}x{expected}")
                alpha_bounds(width, height, pixels)
                if path == final_path:
                    art_hashes.add(hashlib.blake2b(pixels, digest_size=16).digest())
                    top_or_bottom = any(
                        pixels[x * 4 + 3] or pixels[((height - 1) * width + x) * 4 + 3]
                        for x in range(width)
                    )
                    left_or_right = any(
                        pixels[(y * width) * 4 + 3] or pixels[(y * width + width - 1) * 4 + 3]
                        for y in range(height)
                    )
                    require(not (top_or_bottom or left_or_right), f"{name}: final art touches frame edge")
                source_images[name] = (width, height, pixels)
            if all_final:
                require(len(art_hashes) > 1, f"{unit_id}/{state}: all final animation frames are identical")
    actual_source = {path.name for folder in (ROOT / "frames" / "units", ROOT / "placeholders" / "units") for path in folder.glob("*/*.png")}
    require(actual_source == set(source_images), f"Unexpected or unreferenced source frames: {sorted(actual_source - set(source_images))[:5]}")
    return source_images


def check_atlases(manifest: dict, source_images: dict) -> int:
    atlases = manifest.get("atlases", [])
    require(atlases and len(atlases) == len(set(atlases)), "Atlas list is missing or duplicated")
    actual_atlases = {path.name for path in (ROOT / "atlases").glob("*.json")}
    require(actual_atlases == set(atlases), f"Atlas JSON files differ from manifest: {sorted(actual_atlases ^ set(atlases))}")
    seen = set()
    for atlas_name in atlases:
        path = ROOT / "atlases" / atlas_name
        require(path.exists(), f"Missing atlas JSON: {path}")
        atlas = json.loads(path.read_text(encoding="utf-8"))
        meta = atlas["meta"]
        width, height, pixels = read_png(ROOT / "atlases" / meta["image"])
        require(width <= MAX_SIZE and height <= MAX_SIZE, f"{atlas_name}: exceeds {MAX_SIZE}x{MAX_SIZE}")
        require(meta["size"] == {"w": width, "h": height}, f"{atlas_name}: meta size mismatch")
        occupied = []
        for name, frame in atlas["frames"].items():
            require(name not in seen, f"Duplicate atlas frame key: {name}")
            seen.add(name)
            rectangle = frame["frame"]
            x, y, w, h = (rectangle[key] for key in ("x", "y", "w", "h"))
            require(x >= 2 and y >= 2 and x + w + 2 <= width and y + h + 2 <= height, f"{atlas_name}/{name}: frame/padding out of bounds")
            source_size = frame["sourceSize"]
            sprite_size = frame["spriteSourceSize"]
            require(sprite_size["w"] == w and sprite_size["h"] == h, f"{name}: trim size mismatch")
            require(sprite_size["x"] >= 0 and sprite_size["y"] >= 0, f"{name}: negative trim offset")
            require(sprite_size["x"] + w <= source_size["w"] and sprite_size["y"] + h <= source_size["h"], f"{name}: trim outside original frame")
            require(frame["rotated"] is False, f"{name}: rotated frame is unsupported")
            for prior in occupied:
                px, py, pw, ph = prior
                require(x + w + 2 <= px - 2 or px + pw + 2 <= x - 2 or y + h + 2 <= py - 2 or py + ph + 2 <= y - 2, f"{atlas_name}: overlapping frames")
            occupied.append((x, y, w, h))
            if name in source_images:
                source_width, source_height, source = source_images[name]
                require(source_size == {"w": source_width, "h": source_height}, f"{name}: source dimensions mismatch")
                require(frame["anchor"] == {"x": 0.5, "y": 1.0}, f"{name}: anchor mismatch")
                left, top, trim_width, trim_height = alpha_bounds(source_width, source_height, source)
                require(sprite_size == {"x": left, "y": top, "w": trim_width, "h": trim_height}, f"{name}: trim bounds mismatch")
                for row in range(h):
                    atlas_start = ((y + row) * width + x) * 4
                    source_start = ((top + row) * source_width + left) * 4
                    require(
                        pixels[atlas_start : atlas_start + w * 4] == source[source_start : source_start + w * 4],
                        f"{atlas_name}/{name}: packed pixels differ from source",
                    )
    references = {
        (reference["atlas"], reference["frame"])
        for unit in manifest["units"].values()
        for clip in unit["clips"].values()
        for reference in clip["frames"]
    }
    references.update((reference["atlas"], reference["frame"]) for reference in manifest.get("otherFrames", {}).values())
    require({name for _, name in references} == seen, "Manifest and atlas frame keys differ")
    require(all(atlas in atlases for atlas, _ in references), "Manifest references unknown atlas")
    return len(seen)


def check_balance_data(manifest: dict) -> int:
    folder = PROJECT / "src" / "data" / "balance" / "units"
    require(folder.exists(), "Track C unit balance folder is missing")
    logical_path = PROJECT / "src" / "data" / "assets.manifest.json"
    require(logical_path.exists(), "Logical asset manifest is missing")
    logical_keys = set(json.loads(logical_path.read_text(encoding="utf-8"))["keys"])
    art_by_tier = {(entry["faction"], entry["tier"]): entry for entry in manifest["units"].values()}
    found = 0
    files = sorted(folder.glob("*.json"))
    for file in files:
        units = json.loads(file.read_text(encoding="utf-8"))["units"]
        for unit in units:
            assets = unit["assets"]
            art = art_by_tier.get((unit["faction"], unit["tier"]))
            require(art is not None, f"{unit['id']}: no character art at faction/tier")
            for name in ("sprite", "sfxAttack", "sfxDeath"):
                key = assets.get(name)
                require(isinstance(key, str) and key in logical_keys,
                        f"{unit['id']}: {name} does not resolve in logical manifest: {key}")
            found += 1
    require(found == len(manifest["units"]) == 18, f"Balance/art unit count mismatch: {found}")
    print(f"Checked {found} Track C units against art and logical sprite/sound keys")
    return found


def main() -> int:
    manifest_path = ROOT / "manifest.json"
    require(manifest_path.exists(), "Missing assets/manifest.json; run pack:assets")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_images = check_units(manifest)
    frame_count = check_atlases(manifest, source_images)
    check_balance_data(manifest)
    audio_path = ROOT / "audio" / "manifest.json"
    if audio_path.exists():
        require(manifest.get("audioManifest") == audio_path.relative_to(ROOT).as_posix(), "Main manifest is missing audioManifest reference")
        audio_manifest = json.loads(audio_path.read_text(encoding="utf-8"))
        for unit_id, unit in manifest["units"].items():
            expected = {
                action: {"ogg": sound["ogg"], "mp3": sound["mp3"]}
                for action, sound in audio_manifest["sfx"][unit_id].items()
            }
            require(unit.get("sfx") == expected, f"{unit_id}: SFX references differ from audio manifest")
        from validate_audio import main as validate_audio
        validate_audio()
    print(f"Asset validation passed: {len(UNITS)} units, {len(source_images)} source frames, {frame_count} packed frames, {len(manifest['atlases'])} atlases")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f"validate:assets failed: {error}", file=sys.stderr)
        sys.exit(1)
