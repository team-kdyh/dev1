"""Render color and silhouette contact sheets for placeholders and active art."""

from __future__ import annotations

import json
from pathlib import Path

from png_rgba import read_png, write_png

ROOT = Path(__file__).resolve().parents[1]
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
CELL_W, CELL_H = 148, 160
SHEET_W, SHEET_H = CELL_W * 9, CELL_H * 2


def sheet(silhouette: bool, placeholders_only: bool) -> bytearray:
    bg = (255, 255, 255, 255) if silhouette else (63, 68, 80, 255)
    border = (210, 210, 210, 255) if silhouette else (91, 97, 111, 255)
    output = bytearray(bytes(bg) * (SHEET_W * SHEET_H))
    for index, unit in enumerate(UNITS):
        row, column = divmod(index, 9)
        x0, y0 = column * CELL_W, row * CELL_H
        for y in range(y0, y0 + CELL_H):
            for x in (x0, x0 + CELL_W - 1):
                start = (y * SHEET_W + x) * 4
                output[start : start + 4] = bytes(border)
        for x in range(x0, x0 + CELL_W):
            for y in (y0, y0 + CELL_H - 1):
                start = (y * SHEET_W + x) * 4
                output[start : start + 4] = bytes(border)
        name = f"{unit['id']}_idle_00.png"
        final = ROOT / "frames" / "units" / unit["faction"] / name
        path = ROOT / "placeholders" / "units" / unit["faction"] / name
        if not placeholders_only and final.exists():
            path = final
        width, height, source = read_png(path)
        scale = min(1, 128 / width)
        draw_w, draw_h = round(width * scale), round(height * scale)
        dest_x = x0 + (CELL_W - draw_w) // 2
        dest_y = y0 + CELL_H - draw_h - 8
        for dy in range(draw_h):
            sy = min(height - 1, int(dy / scale))
            for dx in range(draw_w):
                sx = min(width - 1, int(dx / scale))
                source_index = (sy * width + sx) * 4
                red, green, blue, alpha = source[source_index : source_index + 4]
                if silhouette:
                    if alpha < 100:
                        continue
                    color = (0, 0, 0, 255)
                else:
                    if alpha == 0:
                        continue
                    color = (
                        (red * alpha + bg[0] * (255 - alpha)) // 255,
                        (green * alpha + bg[1] * (255 - alpha)) // 255,
                        (blue * alpha + bg[2] * (255 - alpha)) // 255,
                        255,
                    )
                target = ((dest_y + dy) * SHEET_W + dest_x + dx) * 4
                output[target : target + 4] = bytes(color)
    return output


def main() -> None:
    folder = ROOT / "previews"
    write_png(folder / "placeholder-contact-sheet.png", SHEET_W, SHEET_H, sheet(False, True))
    write_png(folder / "silhouette-contact-sheet.png", SHEET_W, SHEET_H, sheet(True, True))
    active = sheet(False, False)
    write_png(folder / "unit-art-contact-sheet.png", SHEET_W, SHEET_H, active)
    write_png(folder / "unit-art-silhouette-sheet.png", SHEET_W, SHEET_H, sheet(True, False))
    for row, faction in enumerate(("semicon", "orchard")):
        start = row * CELL_H * SHEET_W * 4
        end = start + CELL_H * SHEET_W * 4
        write_png(ROOT / "concepts" / f"{faction}-lineup.png", SHEET_W, CELL_H, active[start:end])
    print("Wrote placeholder and active-art contact sheets for 18 units")


if __name__ == "__main__":
    main()
