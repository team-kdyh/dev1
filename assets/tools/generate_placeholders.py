"""Generate deterministic M0 unit placeholders with distinct silhouettes and motion."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from png_rgba import write_png

ROOT = Path(__file__).resolve().parents[1]
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
FRAMES = ROOT / "placeholders" / "units"
CLIPS = {"idle": 4, "move": 6, "attack": 4, "die": 6, "cast": 4}
DIGITS = {
    "1": ("010", "110", "010", "010", "111"),
    "2": ("111", "001", "111", "100", "111"),
    "3": ("111", "001", "111", "001", "111"),
    "4": ("101", "101", "111", "001", "001"),
    "5": ("111", "100", "111", "001", "111"),
    "6": ("111", "100", "111", "101", "111"),
    "7": ("111", "001", "010", "010", "010"),
    "8": ("111", "101", "111", "101", "111"),
    "9": ("111", "101", "111", "001", "111"),
}


class Canvas:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.pixels = bytearray(width * height * 4)

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int, int]) -> None:
        x0, x1 = max(0, x0), min(self.width, x1)
        y0, y1 = max(0, y0), min(self.height, y1)
        if x0 >= x1 or y0 >= y1:
            return
        segment = bytes(color) * (x1 - x0)
        for y in range(y0, y1):
            start = (y * self.width + x0) * 4
            self.pixels[start : start + len(segment)] = segment

    def ellipse(self, cx: int, cy: int, rx: int, ry: int, color: tuple[int, int, int, int]) -> None:
        if rx < 1 or ry < 1:
            return
        for y in range(max(0, cy - ry), min(self.height, cy + ry + 1)):
            ratio = 1 - ((y - cy) / ry) ** 2
            half_width = int(rx * max(0, ratio) ** 0.5)
            self.rect(cx - half_width, y, cx + half_width + 1, y + 1, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int, int], thick: int = 2) -> None:
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            x = round(x0 + (x1 - x0) * step / steps)
            y = round(y0 + (y1 - y0) * step / steps)
            self.rect(x - thick // 2, y - thick // 2, x + (thick + 1) // 2, y + (thick + 1) // 2, color)


def dim(color: tuple[int, int, int], opacity: int) -> tuple[int, int, int, int]:
    return (*color, opacity)


def draw_digit(canvas: Canvas, digit: int, x: int, y: int, color: tuple[int, int, int, int], scale: int = 2) -> None:
    for row, pattern in enumerate(DIGITS[str(digit)]):
        for column, cell in enumerate(pattern):
            if cell == "1":
                canvas.rect(x + column * scale, y + row * scale, x + (column + 1) * scale, y + (row + 1) * scale, color)


def draw_unit(unit: dict, state: str, frame: int, *, badge: bool = True, generic_effects: bool = True) -> Canvas:
    tier = unit["tier"]
    size = 128 if tier <= 6 else 192
    canvas = Canvas(size, size)
    semicon = unit["faction"] == "semicon"
    opacity = max(75, 255 - frame * 32) if state == "die" else 255
    primary = dim((20, 40, 160) if semicon else (245, 245, 247), opacity)
    secondary = dim((200, 200, 200) if semicon else (100, 105, 114), opacity)
    dark = dim((22, 27, 44) if semicon else (40, 42, 47), opacity)
    glow = dim((92, 203, 255) if semicon else (189, 247, 222), opacity)
    alert = dim((247, 187, 67) if semicon else (255, 126, 89), opacity)
    width = round(size * (0.30 + tier * 0.027) * (1.1 if semicon else 0.92))
    height = round(size * (0.34 + tier * 0.033))
    if state == "die":
        height = round(height * (1 - frame * 0.10))
    sway = (0, 2, 1, -1, -2, -1)[frame % 6] if state == "move" else (0, 1, 0, -1)[frame % 4]
    x = size // 2 + sway
    bottom = size - 10 - (2 if state == "move" and frame % 2 else 0)
    top = bottom - height
    left, right = x - width // 2, x + width // 2
    shape = unit["shape"]

    canvas.ellipse(x, size - 7, max(10, width // 2), 3, (5, 6, 12, 35))
    if state == "cast":
        radius = width // 2 + 6 + frame * 2
        canvas.ellipse(x, top + height // 2, radius, max(10, height // 2), (*glow[:3], 65))
    if tier == 9:
        aura = (247, 187, 67, 70) if semicon else (245, 245, 247, 65)
        canvas.ellipse(x, top + height // 2, width // 2 + 8, height // 2 + 5, aura)

    if shape == "duo":
        offset = width // 4
        for side in (-1, 1):
            cx = x + side * offset
            if semicon:
                canvas.rect(cx - width // 6, top + 5, cx + width // 6, top + height * 2 // 3, dark)
                canvas.rect(cx - width // 6 + 3, top + 8, cx + width // 6 - 3, top + height * 2 // 3 - 3, primary)
                canvas.line(cx, top + height * 2 // 3, cx + side * (frame % 3 - 1) * 3, bottom - 4, secondary, 3)
                canvas.rect(cx - width // 6 - 4, top + height // 3, cx - width // 6 + 1, top + height // 3 + 6, dark)
            else:
                canvas.ellipse(cx, top + height // 3, max(3, width // 8), height // 4, dark)
                canvas.ellipse(cx, top + height // 3, max(2, width // 8 - 2), height // 4 - 2, primary)
                canvas.line(cx, top + height // 2, cx + side * (frame % 3 - 1) * 3, bottom - 3, secondary, 3)
            canvas.ellipse(cx + side * 2, top + height // 3, 2, 3, glow)
    elif shape == "watch":
        canvas.rect(x - width // 5, top, x + width // 5, bottom, dark)
        canvas.rect(x - width // 6, top + 4, x + width // 6, bottom - 4, secondary)
        if semicon:
            canvas.rect(left - 4, top + height // 4, right + 4, top + height * 3 // 4, dark)
            canvas.rect(left, top + height // 4 + 4, right, top + height * 3 // 4 - 4, primary)
            canvas.rect(x - width // 5, top + height // 2 - 6, x + width // 5, top + height // 2 + 6, glow)
        else:
            canvas.ellipse(x, top + height // 2, width // 2, width // 2, dark)
            canvas.ellipse(x, top + height // 2, width // 2 - 4, width // 2 - 4, primary)
            canvas.ellipse(x, top + height // 2, width // 4, width // 4, glow)
    elif shape in ("phone", "sniper"):
        body_width = width * 3 // 4 if semicon else width // 2
        if not semicon:
            canvas.ellipse(x, top + 5, body_width // 2 + 3, 5, dark)
            canvas.ellipse(x, bottom - 5, body_width // 2 + 3, 5, dark)
        canvas.rect(x - body_width // 2 - 3, top, x + body_width // 2 + 3, bottom, dark)
        canvas.rect(x - body_width // 2, top + 3, x + body_width // 2, bottom - 4, primary)
        canvas.rect(x - body_width // 2 + 4, top + 8, x + body_width // 2 - 4, bottom - 12, glow)
        if semicon:
            canvas.rect(x - body_width // 2 - 8, top + height // 2, x - body_width // 2 - 2, bottom - 8, dark)
            canvas.rect(x + body_width // 2 + 2, top + height // 2, x + body_width // 2 + 8, bottom - 8, dark)
        if shape == "sniper":
            if semicon:
                canvas.line(x + body_width // 2, top + height // 3, right + width // 4, top + height // 3, dark, 6)
                canvas.ellipse(right + width // 4, top + height // 3, 5, 5, alert)
            else:
                for yy in (top + 8, top + 16, top + 24):
                    canvas.ellipse(x + body_width // 2 + 6, yy, 5, 5, dark)
    elif shape == "fold":
        if semicon:
            folded = state == "folded" or (state not in ("unfolded",) and frame % 4 < 2)
            half = width // (5 if folded else 3)
            canvas.rect(x - half * 2 - 4, top + 4, x - 3, bottom, dark)
            canvas.rect(x + 3, top + 4, x + half * 2 + 4, bottom, dark)
            canvas.rect(x - half * 2, top + 8, x - 4, bottom - 4, primary)
            canvas.rect(x + 4, top + 8, x + half * 2, bottom - 4, primary)
            canvas.line(x, top + height // 3, x, top + height * 2 // 3, secondary, 2)
        else:
            canvas.rect(left, top + height // 8, right, bottom, dark)
            canvas.rect(left + 4, top + height // 8 + 4, right - 4, bottom - 4, primary)
            canvas.line(left + 7, bottom - 11, right - 7, top + height // 4, secondary, 3)
    elif shape == "artillery":
        canvas.rect(left, top + height // 4, right, bottom - 4, dark)
        canvas.rect(left + 4, top + height // 4 + 4, right - 4, bottom - 8, primary)
        canvas.line(x - width // 5, top + height // 2, right + width // 6, top - 6, secondary, 6)
        canvas.ellipse(right + width // 6, top - 6, 4, 4, glow)
    elif shape == "workstation":
        canvas.rect(left, top, right, top + height * 2 // 3, dark)
        canvas.rect(left + 4, top + 4, right - 4, top + height * 2 // 3 - 4, primary)
        canvas.rect(left + 10, top + 10, right - 10, top + height // 2, glow)
        spread = width // 2 + (frame * 3 if state == "deploy" else 0)
        canvas.line(x - width // 4, top + height * 2 // 3, x - spread, bottom, secondary, 5)
        canvas.line(x + width // 4, top + height * 2 // 3, x + spread, bottom, secondary, 5)
    elif shape in ("assistant", "vision"):
        canvas.ellipse(x, top + height // 2, width // 2, height // 3, dark)
        canvas.ellipse(x, top + height // 2, width // 2 - 4, height // 3 - 4, primary)
        canvas.ellipse(x, top + height // 2, width // 3, height // 7, glow)
        if shape == "assistant":
            canvas.ellipse(x, top + height // 2, width // 6, height // 6, secondary)
            canvas.line(left - 6, top + height // 2, left + 2, top + height // 2, glow, 2)
            canvas.line(right - 2, top + height // 2, right + 6, top + height // 2, glow, 2)
        else:
            canvas.line(x - width // 4, top + height * 4 // 5, x - width // 6, bottom, secondary, 4)
            canvas.line(x + width // 4, top + height * 4 // 5, x + width // 6, bottom, secondary, 4)
    elif shape in ("laptop", "heavy_laptop"):
        thick = 10 if shape == "heavy_laptop" else 5
        if shape == "heavy_laptop":
            canvas.rect(left + 3, top - 7, left + 15, top + 10, dark)
            canvas.rect(right - 15, top - 7, right - 3, top + 10, dark)
            canvas.rect(left - 8, top + height // 3, left + 3, bottom - height // 5, dark)
            canvas.rect(right - 3, top + height // 3, right + 8, bottom - height // 5, dark)
        canvas.rect(left + width // 5, top, right - width // 10, bottom - height // 5, dark)
        canvas.rect(left + width // 5 + 4, top + 4, right - width // 10 - 4, bottom - height // 5 - 4, primary)
        canvas.rect(left, bottom - height // 5, right, bottom - height // 5 + thick, secondary)
        canvas.line(left, bottom - height // 5 + thick, right + width // 8, bottom - 3, dark, thick)
        if shape == "heavy_laptop":
            for column in range(5):
                canvas.rect(left + 8 + column * 8, bottom - height // 5 + 2, left + 12 + column * 8, bottom - height // 5 + 5, alert)
    if generic_effects and state == "attack":
        reach = 8 + frame * 5
        canvas.line(right - 2, top + height // 2, right + reach, top + height // 2 - frame * 2, alert, 3)
        canvas.ellipse(right + reach, top + height // 2 - frame * 2, max(2, frame + 1), max(2, frame + 1), glow)
    elif generic_effects and state == "cast":
        for side in (-1, 1):
            canvas.line(x + side * (width // 2 + 3), top + height // 3, x + side * (width // 2 + 9), top + height // 3 - 8, alert, 2)

    if badge:
        badge_x, badge_y = left + 2, max(2, top - 11)
        canvas.rect(badge_x - 2, badge_y - 2, badge_x + 9, badge_y + 13, dark)
        draw_digit(canvas, tier, badge_x, badge_y, (255, 255, 255, opacity))
    return canvas


def main() -> int:
    count = 0
    for unit in UNITS:
        clips = dict(CLIPS)
        if unit["id"] == "semicon_t7_workstation":
            clips["deploy"] = 4
        if unit["id"] == "semicon_t5_fold":
            clips["folded"] = 4
            clips["unfolded"] = 4
        folder = FRAMES / unit["faction"]
        for state, length in clips.items():
            for frame in range(length):
                path = folder / f"{unit['id']}_{state}_{frame:02d}.png"
                canvas = draw_unit(unit, state, frame)
                write_png(path, canvas.width, canvas.height, canvas.pixels)
                count += 1
    print(f"Generated {count} unit placeholder frames for {len(UNITS)} units")
    return 0


if __name__ == "__main__":
    sys.exit(main())
