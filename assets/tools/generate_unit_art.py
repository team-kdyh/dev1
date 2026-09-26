"""Build lightly illustrated product units and person-only T9 boss frames."""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps
except ImportError as error:
    raise SystemExit("Pillow required: python3 -m pip install Pillow") from error

from generate_placeholders import CLIPS

ROOT = Path(__file__).resolve().parents[1]
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
PHOTO = ROOT / "source" / "product-photos"
CUTOUT = PHOTO / "cutouts"
PORTRAITS = ROOT / "source" / "boss-portraits"
BLACK = (25, 27, 32, 255)
WHITE = (255, 255, 255, 255)
BOSS_HEADS = {
    "semicon_t9_trifold": "lee_jae_yong_head.png",
    "orchard_t9_imac": "steve_jobs_head.png",
}
FACE_PLACEMENTS = {
    "semicon_t1_buds": ((0.29, 0.33, 0.25), (0.71, 0.33, 0.25)),
    "semicon_t2_watch_medic": ((0.5, 0.46, 0.55),),
    "semicon_t3_aphone_soldier": ((0.53, 0.58, 0.55),),
    "semicon_t4_sphone_sniper": ((0.57, 0.59, 0.50),),
    "semicon_t5_fold": ((0.72, 0.49, 0.47),),
    "semicon_t6_tab_artillery": ((0.50, 0.50, 0.34),),
    "semicon_t7_workstation": ((0.57, 0.48, 0.36),),
    "semicon_t8_ai_assistant": ((0.64, 0.48, 0.38),),
    "orchard_t1_airpod_duo": ((0.31, 0.57, 0.28), (0.72, 0.25, 0.28)),
    "orchard_t2_watch_trainer": ((0.73, 0.43, 0.28),),
    "orchard_t3_phone": ((0.72, 0.56, 0.53),),
    "orchard_t4_phone_pro": ((0.68, 0.56, 0.44),),
    "orchard_t5_pad_guard": ((0.74, 0.25, 0.35),),
    "orchard_t6_vision": ((0.22, 0.54, 0.30),),
    "orchard_t7_air_laptop": ((0.50, 0.38, 0.50),),
    "orchard_t8_pro_laptop": ((0.72, 0.33, 0.34),),
}
# Keep the recognisable photo geometry; crop only unused promotional layout.
CROPS = {
    "semicon_t6_tab_artillery": (35, 175, 765, 480),  # remove headline
    "semicon_t8_ai_assistant": (1015, 17, 1150, 175),  # one Ballie from official sheet
    "orchard_t6_vision": (75, 40, 900, 400),  # keep headset, omit battery
}
THRESHOLDS = {
    "orchard_t1_airpod_duo": 5,
    "semicon_t8_ai_assistant": 10,
    "orchard_t6_vision": 9,
}


def near_background(raw: bytes, pos: int, bg: tuple[int, int, int], tolerance: int) -> bool:
    offset = pos * 3
    return max(abs(raw[offset + channel] - bg[channel]) for channel in range(3)) <= tolerance


def make_cutout(unit_id: str) -> Image.Image:
    photo = Image.open(PHOTO / f"{unit_id}.jpg").convert("RGB")
    if unit_id in CROPS:
        photo = photo.crop(CROPS[unit_id])
    if max(photo.size) > 720:
        ratio = 720 / max(photo.size)
        photo = photo.resize((round(photo.width * ratio), round(photo.height * ratio)), Image.Resampling.LANCZOS)
    width, height = photo.size
    pixels = photo.tobytes()
    bg = photo.getpixel((0, 0))
    tolerance = THRESHOLDS.get(unit_id, 15)
    candidate = bytearray(width * height)
    for pos in range(width * height):
        candidate[pos] = near_background(pixels, pos, bg, tolerance)
    outside = bytearray(width * height)
    queue = deque()
    for x in range(width):
        for pos in (x, (height - 1) * width + x):
            if candidate[pos] and not outside[pos]:
                outside[pos] = 1
                queue.append(pos)
    for y in range(height):
        for pos in (y * width, y * width + width - 1):
            if candidate[pos] and not outside[pos]:
                outside[pos] = 1
                queue.append(pos)
    while queue:
        pos = queue.popleft()
        x, y = pos % width, pos // width
        for neighbour in (pos - 1 if x else -1, pos + 1 if x + 1 < width else -1,
                          pos - width if y else -1, pos + width if y + 1 < height else -1):
            if neighbour >= 0 and candidate[neighbour] and not outside[neighbour]:
                outside[neighbour] = 1
                queue.append(neighbour)
    # The loop of the orange Watch band encloses white background. Remove that
    # large interior region while retaining small bright pixels in the display.
    if unit_id == "orchard_t2_watch_trainer":
        seen = bytearray(outside)
        for start in range(width * height):
            if not candidate[start] or seen[start]:
                continue
            component = [start]
            seen[start] = 1
            for pos in component:
                x, y = pos % width, pos // width
                for neighbour in (pos - 1 if x else -1, pos + 1 if x + 1 < width else -1,
                                  pos - width if y else -1, pos + width if y + 1 < height else -1):
                    if neighbour >= 0 and candidate[neighbour] and not seen[neighbour]:
                        seen[neighbour] = 1
                        component.append(neighbour)
            if len(component) > width * height * 0.015:
                for pos in component:
                    outside[pos] = 1
    alpha = Image.frombytes("L", (width, height), bytes(0 if pixel else 255 for pixel in outside))
    image = photo.convert("RGBA")
    image.putalpha(alpha)
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError(f"Empty product cutout: {unit_id}")
    return image.crop(bounds)


def draw_limbs(size: int, box: tuple[int, int, int, int], state: str, frame: int) -> Image.Image:
    factor = 4
    x0, y0, x1, y1 = [value * factor for value in box]
    layer = Image.new("RGBA", (size * factor, size * factor))
    draw = ImageDraw.Draw(layer)
    cx = (x0 + x1) // 2
    body_width = x1 - x0
    shoulder_y = y0 + (y1 - y0) * 0.55
    arm_length = max(13, size * 0.12) * factor
    active = state in ("attack", "cast")
    for side in (-1, 1):
        sx = x0 + body_width * (0.05 if side < 0 else 0.95)
        ex = sx + side * arm_length
        ey = shoulder_y - (13 * factor if active and (side > 0 or state == "cast") else 0)
        if state == "move":
            ey += (3 if (frame + (side > 0)) % 2 else -3) * factor
        draw.line((sx, shoulder_y, ex, ey), fill=BLACK, width=8 * factor)
        draw.line((sx, shoulder_y, ex, ey), fill=WHITE, width=4 * factor)
        radius = 5 * factor
        draw.ellipse((ex - radius - factor, ey - radius - factor,
                      ex + radius + factor, ey + radius + factor), fill=BLACK)
        draw.ellipse((ex - radius, ey - radius, ex + radius, ey + radius), fill=WHITE)
    for side in (-1, 1):
        hip = cx + side * min(body_width * 0.22, 15 * factor)
        foot = cx + side * min(body_width * 0.27, 18 * factor)
        if state == "move":
            foot += (6 if (frame + (side > 0)) % 2 else -6) * factor
        elif state == "deploy":
            foot += side * frame * 3 * factor
        foot_y = (size - 7) * factor
        draw.line((hip, y1 - 2 * factor, foot, foot_y - 4 * factor), fill=WHITE, width=9 * factor)
        draw.line((hip, y1 - 2 * factor, foot, foot_y - 4 * factor), fill=BLACK, width=5 * factor)
        draw.ellipse((foot - 8 * factor, foot_y - 5 * factor,
                      foot + 8 * factor, foot_y + 2 * factor), fill=BLACK)
    return layer.resize((size, size), Image.Resampling.LANCZOS)


def illustrate_product(photo: Image.Image) -> Image.Image:
    """Give a product photo restrained color planes and a clean 2px ink rim."""
    alpha = photo.getchannel("A")
    color = ImageEnhance.Color(photo.convert("RGB")).enhance(1.1)
    color = ImageEnhance.Contrast(color).enhance(1.08)
    color = ImageOps.posterize(color, 6)
    product = color.convert("RGBA")
    product.putalpha(alpha)
    padded = Image.new("RGBA", (product.width + 6, product.height + 6))
    padded.alpha_composite(product, (3, 3))
    mask = padded.getchannel("A")
    rim = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(5)), mask)
    ink = Image.new("RGBA", padded.size, (23, 28, 39, 0))
    ink.putalpha(rim)
    ink.alpha_composite(padded)
    return ink


def draw_expression(size: int, box: tuple[int, int, int, int], unit_id: str, state: str, frame: int) -> Image.Image:
    """Add small, high-contrast battle faces without covering product landmarks."""
    factor = 4
    x, y, width, height = box
    layer = Image.new("RGBA", (size * factor, size * factor))
    draw = ImageDraw.Draw(layer)
    angry = state in ("attack", "cast")
    defeated = state == "die"
    ink = (18, 22, 31, 255)
    paper = (255, 251, 239, 255)

    def point(px: float, py: float) -> tuple[int, int]:
        return round(px * factor), round(py * factor)

    for fx, fy, fraction in FACE_PLACEMENTS[unit_id]:
        cx = x + width * fx
        cy = y + height * fy
        face_width = min(width * fraction, height * 0.94)
        scale = face_width / 32
        eye_dx, eye_w, eye_h = 7.1 * scale, 7.0 * scale, (4.8 if angry else 5.8) * scale
        brow_top = (8.6 if angry else 7.6) * scale
        for side in (-1, 1):
            ex = cx + side * eye_dx
            if defeated:
                cross = 3.0 * scale
                for start, end in (((ex - cross, cy - cross), (ex + cross, cy + cross)),
                                   ((ex - cross, cy + cross), (ex + cross, cy - cross))):
                    draw.line([point(*start), point(*end)], fill=paper, width=max(3, round(5 * scale * factor)))
                    draw.line([point(*start), point(*end)], fill=ink, width=max(2, round(2.5 * scale * factor)))
                continue
            eye_box = (*point(ex - eye_w / 2, cy - eye_h / 2), *point(ex + eye_w / 2, cy + eye_h / 2))
            draw.ellipse(eye_box, fill=paper, outline=ink, width=max(2, round(1.7 * scale * factor)))
            pupil_x = ex + (0.9 if state == "move" else 0) * scale
            px, py = point(pupil_x, cy + 0.3 * scale)
            pupil_r = max(2, round(1.0 * scale * factor))
            draw.ellipse((px - pupil_r, py - pupil_r, px + pupil_r, py + pupil_r), fill=ink)
            outer = (ex + side * eye_w * 0.75, cy - brow_top)
            inner = (ex - side * eye_w * 0.75, cy - (3.2 if angry else 4.2) * scale)
            draw.line([point(*outer), point(*inner)], fill=paper, width=max(3, round(5 * scale * factor)))
            draw.line([point(*outer), point(*inner)], fill=ink, width=max(2, round(2.8 * scale * factor)))

        mouth_y = cy + 9.3 * scale
        if defeated:
            draw.arc((*point(cx - 5.5 * scale, mouth_y - 1 * scale),
                      *point(cx + 5.5 * scale, mouth_y + 5.5 * scale)),
                     start=200, end=340, fill=paper, width=max(3, round(4.3 * scale * factor)))
            draw.arc((*point(cx - 5.5 * scale, mouth_y - 1 * scale),
                      *point(cx + 5.5 * scale, mouth_y + 5.5 * scale)),
                     start=200, end=340, fill=ink, width=max(2, round(2.2 * scale * factor)))
        else:
            mouth_h = ((6.0, 7.0, 9.0, 6.5)[frame % 4] if angry else 4.8) * scale
            draw.ellipse((*point(cx - 7.0 * scale, mouth_y - 3.2 * scale),
                          *point(cx + 7.0 * scale, mouth_y + mouth_h + 1.7 * scale)),
                         fill=paper)
            draw.ellipse((*point(cx - 5.3 * scale, mouth_y - 1.5 * scale),
                          *point(cx + 5.3 * scale, mouth_y + mouth_h)),
                         fill=(122, 36, 42, 255), outline=ink,
                         width=max(2, round(2.0 * scale * factor)))
            draw.line([point(cx - 3.7 * scale, mouth_y + 0.7 * scale),
                       point(cx + 3.7 * scale, mouth_y + 0.7 * scale)],
                      fill=paper, width=max(2, round(1.7 * scale * factor)))
    return layer.resize((size, size), Image.Resampling.LANCZOS)


def finish_frame(output: Image.Image, state: str, frame: int) -> Image.Image:
    size = output.width
    if state == "die":
        output = output.rotate(-frame * 7, resample=Image.Resampling.BICUBIC)
        alpha = output.getchannel("A").point(lambda value: round(value * (1 - frame * 0.12)))
        output.putalpha(alpha)
    inset = max(8, round(size * 0.06))
    reduced = output.resize((size - inset * 2, size - inset * 2), Image.Resampling.LANCZOS)
    framed = Image.new("RGBA", (size, size))
    framed.alpha_composite(reduced, (inset, inset))
    return framed


def render_product(photo: Image.Image, unit: dict, state: str, frame: int) -> Image.Image:
    size = 128 if unit["tier"] <= 6 else 192
    width_limit = 94 if size == 128 else 147
    height_limit = 88 if size == 128 else 132
    ratio = min(width_limit / photo.width, height_limit / photo.height)
    body = photo.resize((max(1, round(photo.width * ratio)), max(1, round(photo.height * ratio))), Image.Resampling.LANCZOS)
    body = illustrate_product(body)
    bob = (0, 1, 2, 1)[frame % 4] if state in ("idle", "folded", "unfolded") else (frame % 2) * 2 if state == "move" else 0
    shift = (0, 2, 4, 1)[frame] if state in ("attack", "cast") else 0
    x = (size - body.width) // 2 + shift
    y = size - 23 - body.height - bob
    box = (x, y, x + body.width, y + body.height)
    output = draw_limbs(size, box, state, frame)
    output.alpha_composite(body, (x, y))
    output.alpha_composite(draw_expression(size, (x, y, body.width, body.height), unit["id"], state, frame))
    return finish_frame(output, state, frame)


def render_person(head: Image.Image, unit_id: str, state: str, frame: int) -> Image.Image:
    """Animate an illustrated human body without any product image layer."""
    size, factor = 192, 4
    is_lee = unit_id == "semicon_t9_trifold"
    canvas = Image.new("RGBA", (size * factor, size * factor))
    draw = ImageDraw.Draw(canvas)
    bob = (0, 1, 2, 1)[frame % 4] if state == "idle" else (frame % 2) * 2 if state == "move" else 0
    step = (0, 6, 10, 0, -6, -10)[frame] if state == "move" else 0
    skin = (229, 182, 146, 255) if is_lee else (230, 184, 151, 255)
    outfit = (40, 55, 85, 255) if is_lee else (34, 36, 42, 255)
    outline = (219, 226, 236, 255)
    trouser = (39, 50, 73, 255) if is_lee else (56, 80, 111, 255)

    def point(x: float, y: float) -> tuple[int, int]:
        return round(x * factor), round((y - bob) * factor)

    def limb(points: list[tuple[float, float]], color: tuple[int, int, int, int], width: int) -> None:
        path = [point(x, y) for x, y in points]
        draw.line(path, fill=outline, width=(width + 4) * factor, joint="curve")
        draw.line(path, fill=color, width=width * factor, joint="curve")

    # Legs and arms remain separate drawing layers so the same portrait can
    # read as idle, marching, attacking, casting, or falling.
    for side in (-1, 1):
        hip_x = 96 + side * 14
        foot_x = 96 + side * 22 + (step if side < 0 else -step)
        limb([(hip_x, 145), (hip_x + side * 2, 161), (foot_x, 176)], trouser, 13)
        fx, fy = point(foot_x, 177)
        draw.ellipse((fx - 12 * factor, fy - 5 * factor, fx + 12 * factor, fy + 5 * factor),
                     fill=(27, 30, 36, 255), outline=outline, width=3 * factor)

    active = state in ("attack", "cast")
    for side in (-1, 1):
        shoulder_x = 96 + side * 32
        if state == "cast":
            hand_y = (89, 75, 60, 82)[frame]
        elif state == "attack" and side > 0:
            hand_y = (118, 92, 65, 99)[frame]
        elif state == "move":
            hand_y = 119 + (step if side < 0 else -step) * 0.8
        else:
            hand_y = 121
        hand_x = 96 + side * (63 if active else 59)
        limb([(shoulder_x, 101), (96 + side * 45, 113 if hand_y > 100 else 92), (hand_x, hand_y)], outfit, 12)
        hx, hy = point(hand_x, hand_y)
        draw.ellipse((hx - 8 * factor, hy - 8 * factor, hx + 8 * factor, hy + 8 * factor),
                     fill=skin, outline=(29, 31, 36, 255), width=3 * factor)

    torso = tuple(value * factor for value in (59, 88 - bob, 133, 151 - bob))
    draw.rounded_rectangle(torso, radius=16 * factor, fill=outfit, outline=outline, width=4 * factor)
    if is_lee:
        draw.polygon([point(82, 93), point(110, 93), point(96, 134)], fill=(242, 240, 237, 255))
        draw.polygon([point(92, 100), point(100, 100), point(104, 134), point(96, 140), point(89, 134)],
                     fill=(70, 112, 178, 255), outline=(31, 43, 66, 255))
        draw.line([point(96, 141), point(96, 150)], fill=(25, 35, 57, 255), width=2 * factor)
    else:
        draw.rounded_rectangle(tuple(value * factor for value in (75, 89 - bob, 117, 106 - bob)),
                               radius=8 * factor, fill=(49, 52, 58, 255), outline=(120, 127, 139, 255), width=2 * factor)
        draw.line([point(65, 137), point(127, 137)], fill=(95, 101, 110, 255), width=2 * factor)

    # Both source portraits contain faint alpha specks beyond the visible head.
    # The cropped opaque heads are about 66 px wide in the existing sprites.
    head_width = 66
    head_height = round(head.height * head_width / head.width)
    portrait = head.resize((head_width * factor, head_height * factor), Image.Resampling.LANCZOS)
    head_y = (5 if is_lee else 8) - bob
    canvas.alpha_composite(portrait, point((size - head_width) / 2, head_y))
    output = canvas.resize((size, size), Image.Resampling.LANCZOS)
    return finish_frame(output, state, frame)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    CUTOUT.mkdir(parents=True, exist_ok=True)
    count = 0
    for unit in UNITS:
        unit_id = unit["id"]
        head = None
        photo = None
        if unit_id in BOSS_HEADS:
            portrait = Image.open(PORTRAITS / BOSS_HEADS[unit_id]).convert("RGBA")
            # Ignore nearly transparent edge pixels; otherwise an off-canvas
            # speck shifts the visible portrait and neck away from the torso.
            visible = portrait.getchannel("A").point(lambda alpha: 255 if alpha >= 16 else 0)
            head = portrait.crop(visible.getbbox())
        else:
            photo = make_cutout(unit_id)
            photo.save(CUTOUT / f"{unit_id}.png")
        closed = None
        if unit_id == "semicon_t5_fold":
            closed = make_cutout("semicon_t5_fold_closed")
            closed.save(CUTOUT / "semicon_t5_fold_closed.png")
        clips = dict(CLIPS)
        if unit_id == "semicon_t7_workstation":
            clips["deploy"] = 4
        if unit_id == "semicon_t5_fold":
            clips["folded"] = clips["unfolded"] = 4
        for state, length in clips.items():
            for frame in range(length):
                target = ROOT / "frames" / "units" / unit["faction"] / f"{unit_id}_{state}_{frame:02d}.png"
                if target.exists() and not args.overwrite:
                    continue
                if head is not None:
                    output = render_person(head, unit_id, state, frame)
                else:
                    source = closed if state == "folded" else photo
                    output = render_product(source, unit, state, frame)
                output.save(target)
                count += 1
    print(f"Illustrated product and person boss art: {count} frames written")


if __name__ == "__main__":
    main()
