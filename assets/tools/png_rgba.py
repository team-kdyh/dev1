"""Small dependency-free codec for non-interlaced, 8-bit RGBA PNG assets."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def write_png(path: Path, width: int, height: int, pixels: bytes | bytearray) -> None:
    if width < 1 or height < 1 or len(pixels) != width * height * 4:
        raise ValueError(f"Invalid RGBA dimensions for {path}")
    stride = width * 4
    scanlines = bytearray((stride + 1) * height)
    for y in range(height):
        target = y * (stride + 1)
        scanlines[target + 1 : target + 1 + stride] = pixels[y * stride : (y + 1) * stride]
    payload = (
        SIGNATURE
        + _chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + _chunk(b"IDAT", zlib.compress(scanlines, 6))
        + _chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_png(path: Path) -> tuple[int, int, bytearray]:
    raw = path.read_bytes()
    if not raw.startswith(SIGNATURE):
        raise ValueError(f"{path}: PNG signature is missing")
    position = len(SIGNATURE)
    width = height = 0
    idat = bytearray()
    seen_ihdr = seen_iend = False
    while position + 12 <= len(raw):
        length = struct.unpack_from(">I", raw, position)[0]
        position += 4
        kind = raw[position : position + 4]
        position += 4
        data = raw[position : position + length]
        position += length
        if len(data) != length or position + 4 > len(raw):
            raise ValueError(f"{path}: truncated PNG chunk")
        expected_crc = struct.unpack_from(">I", raw, position)[0]
        position += 4
        if zlib.crc32(kind + data) & 0xFFFFFFFF != expected_crc:
            raise ValueError(f"{path}: CRC mismatch in {kind!r}")
        if kind == b"IHDR":
            if seen_ihdr or length != 13:
                raise ValueError(f"{path}: invalid IHDR")
            width, height, depth, color, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", data
            )
            if not width or not height or (depth, color, compression, filtering, interlace) != (8, 6, 0, 0, 0):
                raise ValueError(f"{path}: expected 8-bit, non-interlaced RGBA PNG")
            seen_ihdr = True
        elif kind == b"IDAT":
            idat.extend(data)
        elif kind == b"IEND":
            seen_iend = True
            break
    if not seen_ihdr or not seen_iend or not idat:
        raise ValueError(f"{path}: incomplete PNG")
    scanlines = zlib.decompress(idat)
    stride = width * 4
    if len(scanlines) != height * (stride + 1):
        raise ValueError(f"{path}: decompressed size mismatch")
    pixels = bytearray(width * height * 4)
    prior = bytearray(stride)
    for y in range(height):
        begin = y * (stride + 1)
        filter_type = scanlines[begin]
        current = bytearray(scanlines[begin + 1 : begin + 1 + stride])
        if filter_type not in (0, 1, 2, 3, 4):
            raise ValueError(f"{path}: unsupported PNG filter {filter_type}")
        if filter_type:
            for x in range(stride):
                left = current[x - 4] if x >= 4 else 0
                above = prior[x]
                upper_left = prior[x - 4] if x >= 4 else 0
                if filter_type == 1:
                    predictor = left
                elif filter_type == 2:
                    predictor = above
                elif filter_type == 3:
                    predictor = (left + above) // 2
                else:
                    predictor = _paeth(left, above, upper_left)
                current[x] = (current[x] + predictor) & 0xFF
        pixels[y * stride : (y + 1) * stride] = current
        prior = current
    return width, height, pixels


def alpha_bounds(width: int, height: int, pixels: bytes | bytearray) -> tuple[int, int, int, int]:
    left, top, right, bottom = width, height, -1, -1
    for y in range(height):
        row = (y * width) * 4
        for x in range(width):
            if pixels[row + x * 4 + 3]:
                left = min(left, x)
                top = min(top, y)
                right = max(right, x)
                bottom = max(bottom, y)
    if right < left:
        raise ValueError("PNG frame is fully transparent")
    return left, top, right - left + 1, bottom - top + 1
