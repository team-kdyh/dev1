"""Generate simple product-shaped chibi sprites with bold outlines."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from generate_placeholders import CLIPS, Canvas
from png_rgba import write_png

ROOT = Path(__file__).resolve().parents[1]
UNITS = json.loads((ROOT / "units.json").read_text(encoding="utf-8"))
K = (25, 27, 32, 255)
W = (250, 250, 247, 255)
B = (44, 91, 216, 255)
S = (203, 212, 225, 255)
G = (65, 75, 91, 255)
C = (85, 225, 244, 255)
O = (255, 150, 75, 255)
Y = (255, 214, 70, 255)


def rect(c, x0, y0, x1, y1, fill, edge=K, t=3):
    c.rect(x0-t, y0-t, x1+t, y1+t, edge)
    c.rect(x0, y0, x1, y1, fill)


def oval(c, x, y, rx, ry, fill, edge=K, t=3):
    c.ellipse(x, y, rx+t, ry+t, edge)
    c.ellipse(x, y, rx, ry, fill)


def rounded(c, x0, y0, x1, y1, r, fill, edge=K, t=3):
    for pad, color in ((t, edge), (0, fill)):
        a, b, d, e = x0-pad, y0-pad, x1+pad, y1+pad
        rad = r+pad
        c.rect(a+rad, b, d-rad, e, color)
        c.rect(a, b+rad, d, e-rad, color)
        for xx in (a+rad, d-rad-1):
            for yy in (b+rad, e-rad-1):
                c.ellipse(xx, yy, rad, rad, color)


def line(c, x0, y0, x1, y1, fill, t=3):
    c.line(x0, y0, x1, y1, K, t+3)
    c.line(x0, y0, x1, y1, fill, t)


def eyes(c, x, y, gap=11, dead=False, state="idle", frame=0, light=False):
    """Oversized eyes and a readable mouth for small, expressive product faces."""
    ink = K if light else W
    if dead:
        for side in (-1, 1):
            xx = x+side*gap
            c.line(xx-4, y-4, xx+4, y+4, ink, 3)
            c.line(xx-4, y+4, xx+4, y-4, ink, 3)
        c.line(x-5, y+11, x+5, y+11, ink, 3)
        return
    angry = state in ("attack", "cast")
    blink = state == "idle" and frame == 3
    for side in (-1, 1):
        xx = x+side*gap
        if angry:
            c.line(xx-5, y-10 if side < 0 else y-6, xx+5, y-6 if side < 0 else y-10, ink, 3)
        if blink:
            c.line(xx-4, y, xx+4, y, ink, 2)
        else:
            if light:
                c.ellipse(xx, y, 6, 7, K)
                c.ellipse(xx, y, 4, 5, W)
            else:
                c.ellipse(xx, y, 5, 6, W)
            c.ellipse(xx+(1 if state == "move" else 0), y+1, 2, 4, K)
    if angry:
        c.ellipse(x, y+13, 6, 7, ink)
        c.ellipse(x, y+15, 3, 3, O if light else K)
    elif state == "move":
        c.line(x-7, y+10, x, y+14, ink, 3)
        c.line(x, y+14, x+7, y+10, ink, 3)
    else:
        c.line(x-6, y+11, x, y+14, ink, 3)
        c.line(x, y+14, x+6, y+11, ink, 3)


def lens(c, x, y, radius=5):
    oval(c, x, y, radius, radius, G, K, 2)
    c.ellipse(x-1, y-1, 2, 2, C)


def feet(c, x, y, wide=20, move=0):
    for side in (-1, 1):
        line(c, x+side*wide//2, y-5, x+side*(wide+move*side), y+9, K, 5)
        oval(c, x+side*(wide+move*side), y+10, 7, 3, K, K, 1)


def hands(c, x, y, wide=26, attack=False):
    for side in (-1, 1):
        ex = x+side*(wide+13+(5 if attack and side > 0 else 0))
        ey = y-34-(12 if attack and side > 0 else 0)
        line(c, x+side*wide, y-55, ex, ey, K, 5)
        oval(c, ex, ey, 5, 5, W, K, 2)


def boss(c, x, y, sem, state, frame):
    """Final bosses are recognizable products, with no human portrait."""
    feet(c, x, y, 27, frame % 3 - 1 if state == "move" else 0)
    hands(c, x, y, 35, state in ("attack", "cast"))
    if sem:
        # Galaxy Z TriFold: three screens and two bright vertical hinges.
        flare = (0, 2, 4, 5)[frame] if state in ("attack", "cast") else 0
        for side in (-1, 0, 1):
            xx = x + side * (32 + (flare if side else 0))
            rounded(c, xx-17, y-94, xx+17, y-19, 3, S if side else B, K, 3)
            rect(c, xx-12, y-86, xx+12, y-29, G if side else B, K, 1)
        for offset in (-17, 17):
            c.line(x+offset, y-91, x+offset, y-21, C, 2)
        # Rear camera rings remain visible on the right panel.
        for yy in (y-80, y-68, y-56):
            lens(c, x+37+flare, yy, 4)
        eyes(c, x, y-60, 10, state == "die", state, frame)
        if state in ("attack", "cast"):
            line(c, x+18, y-38, x+45+frame*3, y-42, C, 4)
    else:
        # 24-inch M4 iMac: thin colored bezel, pale chin, camera, stand.
        rounded(c, x-49, y-94, x+49, y-27, 5, (163, 194, 238, 255), K, 3)
        rounded(c, x-43, y-88, x+43, y-39, 3, G, K, 1)
        c.ellipse(x, y-91, 2, 2, K)
        rect(c, x-45, y-37, x+45, y-27, (186, 214, 246, 255), K, 1)
        rect(c, x-5, y-25, x+5, y-10, S, K, 2)
        rounded(c, x-31, y-12, x+31, y-7, 2, S, K, 2)
        eyes(c, x, y-64, 14, state == "die", state, frame)
        if state in ("attack", "cast"):
            for dy in (-68, -55, -42):
                line(c, x+36, y+dy, x+47+frame*2, y+dy, O, 2)


def body(c, unit, state, frame, x, y):
    sem = unit["faction"] == "semicon"
    tier = unit["tier"]
    attack = state in ("attack", "cast") and frame > 0
    if tier == 9:
        boss(c, x, y, sem, state, frame)
        return
    feet(c, x, y, 18 if tier <= 4 else 24, frame%3-1 if state == "move" else 0)
    hands(c, x, y, 26 if tier <= 4 else 35, attack)

    if tier == 1:
        for side in (-1, 1):
            xx = x+side*23
            if sem:
                # Galaxy Buds3 Pro: angular body and Blade Light stem.
                rect(c, xx-8, y-75, xx+8, y-31, S)
                oval(c, xx-5, y-70, 10, 7, B, K, 2)
                c.line(xx+3, y-56, xx+3, y-37, C, 3)
            else:
                # AirPods Pro: white bulb, tip and narrow stem.
                rounded(c, xx-7, y-67, xx+7, y-30, 5, W)
                oval(c, xx-5, y-68, 11, 9, W)
                oval(c, xx-15, y-69, 4, 4, G, K, 1)
            if state == "die":
                c.line(xx-2, y-64, xx+3, y-59, K, 2)
                c.line(xx-2, y-59, xx+3, y-64, K, 2)
            elif state == "idle" and frame == 3:
                c.line(xx-2, y-61, xx+4, y-61, K, 2)
            else:
                c.ellipse(xx+1, y-61, 3, 4, W)
                c.ellipse(xx+2, y-60, 1, 2, K)
            c.line(xx-2, y-49, xx+3, y-48 if state == "attack" else y-51, K, 2)
    elif tier == 2:
        rounded(c, x-14, y-94, x+14, y-11, 5, S if sem else O)
        if sem:
            # Galaxy Watch Ultra: cushion case + circular dial.
            rounded(c, x-31, y-76, x+31, y-25, 11, S)
            oval(c, x, y-50, 23, 21, B)
        else:
            # Apple Watch Ultra: rectangular display + orange Action button.
            rounded(c, x-29, y-76, x+29, y-25, 11, G)
            rounded(c, x-23, y-70, x+23, y-31, 7, B, K, 1)
            rect(c, x-37, y-55, x-32, y-43, O, K, 1)
            oval(c, x+35, y-47, 4, 6, S, K, 2)
        eyes(c, x, y-51, 10, state == "die", state, frame)
    elif tier in (3, 4):
        if sem:
            if tier == 3:
                # A56 rear: a single tall island holds three aligned cameras.
                rounded(c, x-25, y-90, x+25, y-11, 6, (159, 192, 224, 255))
                rounded(c, x-22, y-86, x-5, y-43, 6, G, K, 2)
                for yy in (y-78, y-65, y-52):
                    lens(c, x-14, yy, 5)
                c.ellipse(x-1, y-78, 2, 2, W)
                eyes(c, x+10, y-47, 8, state == "die", state, frame, light=True)
            else:
                # S25 Ultra rear: squared body and separate large camera rings.
                rounded(c, x-29, y-93, x+29, y-10, 3, (176, 187, 202, 255))
                for yy in (y-79, y-64, y-49):
                    lens(c, x-19, yy, 6)
                for yy in (y-74, y-58):
                    lens(c, x-4, yy, 3)
                barrel_end = x+42+frame*(2 if attack else 0)
                line(c, x+29, y-37, barrel_end, y-65, S, 4)
                lens(c, barrel_end, y-65, 5)
                eyes(c, x+13, y-43, 8, state == "die", state, frame, light=True)
        else:
            if tier == 3:
                # iPhone 16 rear: pastel slab and a vertical two-camera pill.
                rounded(c, x-25, y-90, x+25, y-11, 10, (203, 216, 241, 255))
                rounded(c, x-22, y-85, x-4, y-46, 8, (173, 188, 216, 255), K, 2)
                for yy in (y-76, y-57):
                    lens(c, x-13, yy, 6)
                c.ellipse(x-1, y-74, 2, 2, W)
                eyes(c, x+9, y-43, 8, state == "die", state, frame, light=True)
            else:
                # iPhone 16 Pro rear: one raised square holds three lenses.
                rounded(c, x-29, y-93, x+29, y-10, 10, (190, 187, 185, 255))
                rounded(c, x-25, y-89, x+3, y-51, 8, (156, 155, 155, 255), K, 2)
                for xx, yy in ((x-17, y-79), (x-2, y-69), (x-17, y-58)):
                    lens(c, xx, yy, 6)
                c.ellipse(x-3, y-56, 2, 2, W)
                eyes(c, x+10, y-37, 8, state == "die", state, frame, light=True)
            rect(c, x+29, y-65, x+32, y-51, O, K, 1)
    elif tier == 5:
        if sem:
            # Galaxy Z Fold6: two slabs and central hinge.
            spread = ((11, 13, 15, 13)[frame] if state == "folded"
                      else (19, 22, 25, 22)[frame] if state == "unfolded" else 23)
            for side in (-1, 1):
                xx = x+side*spread
                rounded(c, xx-21, y-83, xx+21, y-17, 4, B if side<0 else S)
                rect(c, xx-15, y-75, xx+15, y-30, G, K, 1)
            rect(c, x-3, y-84, x+3, y-16, S, K, 2)
        else:
            # iPad Pro: broad thin display and Pencil Pro.
            rounded(c, x-42, y-79, x+42, y-23, 4, S)
            rounded(c, x-36, y-73, x+36, y-29, 2, G, K, 1)
            line(c, x+29, y-17, x+48+frame*(3 if attack else 0), y-94, W, 4)
        eyes(c, x, y-49, 12, state == "die", state, frame)
    elif tier == 6:
        if sem:
            # Tab S10 Ultra: tablet and slanted S Pen cannon.
            rounded(c, x-42, y-80, x+42, y-23, 4, S)
            rect(c, x-36, y-74, x+36, y-30, B, K, 1)
            line(c, x+14, y-19, x+46+frame*(3 if attack else 0), y-97, C, 5)
        else:
            # Vision Pro: dark curved visor, white fabric side band.
            oval(c, x, y-51, 44, 27, S)
            oval(c, x, y-53, 37, 21, G, K, 2)
            line(c, x-31, y-45, x-43, y-63, W, 4)
            line(c, x+31, y-45, x+43, y-63, W, 4)
            if state == "cast":
                for side in (-1,1): oval(c, x+side*52, y-49, 8, 13, C, C, 1)
        eyes(c, x, y-51, 12, state == "die", state, frame)
    elif tier == 8 and sem:
        # Ballie: a bright yellow sphere, dark front sensor and tiny wheels.
        oval(c, x, y-56, 37, 36, Y, K, 4)
        c.ellipse(x-16, y-73, 7, 4, (255, 239, 157, 255))
        rounded(c, x-24, y-66, x+24, y-42, 8, G, K, 2)
        eyes(c, x, y-54, 10, state == "die", state, frame)
        for side in (-1, 1):
            oval(c, x+side*28, y-27, 9, 9, K, K, 1)
            c.ellipse(x+side*28, y-27, 3, 3, G)
    else:
        # Large laptop traits are exaggerated so similar product families read
        # differently at battle size: square Book, thin Air, thick dark Pro.
        if sem:
            rounded(c, x-33, y-93, x+33, y-31, 3, S)
            rect(c, x-28, y-86, x+28, y-39, B, K, 1)
            c.ellipse(x, y-90, 2, 2, K)
            rect(c, x-45, y-29, x+45, y-18, S)
            for yy in (y-26, y-22):
                c.line(x-27, yy, x+27, yy, G, 2)
            rect(c, x-11, y-19, x+11, y-17, G, K, 1)
            if state == "deploy":
                reach = 31+frame*6
                line(c, x-24, y-24, x-reach, y+7, S, 3)
                line(c, x+24, y-24, x+reach, y+7, S, 3)
        elif tier == 7:
            rounded(c, x-34, y-91, x+34, y-32, 6, (195, 211, 228, 255))
            rounded(c, x-29, y-84, x+29, y-38, 3, G, K, 1)
            rect(c, x-5, y-91, x+5, y-86, K, K, 1)
            rect(c, x-42, y-29, x+42, y-25, S, K, 2)
            line(c, x-48, y-23, x+48, y-23, W, 2)
        else:
            rounded(c, x-37, y-94, x+37, y-31, 4, G)
            rounded(c, x-32, y-88, x+32, y-38, 2, (40, 47, 59, 255), K, 1)
            rect(c, x-6, y-94, x+6, y-89, K, K, 1)
            rect(c, x-49, y-29, x+49, y-14, G)
            for yy in (y-26, y-22):
                c.line(x-27, yy, x+27, yy, S, 2)
            for xx in (-35, -18, 18, 35):
                c.line(x+xx, y-17, x+xx, y-13, O, 2)
        eyes(c, x, y-63, 12, state == "die", state, frame)

    if attack:
        flash = C if sem else O
        xx = min(116, x+42+frame*5)
        c.line(xx-7, y-57, xx+7, y-57, flash, 3)
        c.line(xx, y-64, xx, y-50, flash, 3)


def render(unit, state, frame):
    c = Canvas(128, 128)
    x = 64 + ((0, 2, 3, 1, -2, -3)[frame%6] if state == "move" else 0)
    y = 109 - (2 if state == "move" and frame%2 else 0)
    if state == "idle": y -= (0, 1, 2, 1)[frame%4]
    c.ellipse(64, 122, 36, 3, (25, 27, 32, 50))
    if state == "cast":
        color = C if unit["faction"] == "semicon" else O
        c.ellipse(x, y-49, 38+frame*4, 41+frame*3, (*color[:3], 65))
    if unit["tier"] == 9:
        color = O if unit["faction"] == "semicon" else W
        c.line(17, 25, 25, 71, (*color[:3], 130), 3)
        c.line(111, 25, 103, 71, (*color[:3], 130), 3)
    body(c, unit, state, frame, x, y)
    if state == "die":
        src = c.pixels[:]
        scale = 1-frame*0.095
        for yy in range(128):
            sy = round(115-(115-yy)/scale)
            for xx in range(128):
                dest = (yy*128+xx)*4
                if 0 <= sy < 128:
                    origin = (sy*128+xx)*4
                    c.pixels[dest:dest+4] = src[origin:origin+4]
                    c.pixels[dest+3] = round(c.pixels[dest+3]*(1-frame*0.12))
                else:
                    c.pixels[dest:dest+4] = bytes(4)
    if unit["tier"] <= 6: return c
    large = Canvas(192, 192)
    for yy in range(192):
        sy = yy*128//192
        for xx in range(192):
            sx = xx*128//192
            large.pixels[(yy*192+xx)*4:(yy*192+xx)*4+4] = c.pixels[(sy*128+sx)*4:(sy*128+sx)*4+4]
    return large


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    made = skipped = 0
    for unit in UNITS:
        clips = dict(CLIPS)
        if unit["id"] == "semicon_t7_workstation": clips["deploy"] = 4
        if unit["id"] == "semicon_t5_fold": clips["folded"] = clips["unfolded"] = 4
        for state, length in clips.items():
            for frame in range(length):
                path = ROOT/"frames"/"units"/unit["faction"]/f"{unit['id']}_{state}_{frame:02d}.png"
                if path.exists() and not args.overwrite:
                    skipped += 1
                    continue
                art = render(unit, state, frame)
                write_png(path, art.width, art.height, art.pixels)
                made += 1
    print(f"Chibi product art: {made} frames written, {skipped} skipped")


if __name__ == "__main__":
    main()
