# -*- coding: utf-8 -*-
"""Generate original tray / app icons (black template + warm mark)."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int, color_at) -> None:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            r, g, b, a = color_at(x, y, size)
            raw.extend((r, g, b, a))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def template_color(x: int, y: int, size: int):
    # Simple original mark: a rounded capsule (mic body) + a small arc (yoke).
    cx = cy = (size - 1) / 2
    nx = (x - cx) / (size / 2)
    ny = (y - cy) / (size / 2)
    body = abs(nx) < 0.22 and -0.42 < ny < 0.18
    cap = (nx * nx) / (0.22 * 0.22) + ((ny + 0.42) ** 2) / (0.22 * 0.22) <= 1
    yoke = 0.22 < ny < 0.48 and abs(nx) < 0.38 and (nx * nx) / (0.38 * 0.38) + ((ny - 0.22) ** 2) / (0.28 * 0.28) <= 1 and ny > 0.26
    stem = abs(nx) < 0.07 and 0.42 < ny < 0.62
    base = abs(nx) < 0.22 and 0.62 < ny < 0.70
    on = body or cap or yoke or stem or base
    return (0, 0, 0, 230 if on else 0)


def mark_color(x: int, y: int, size: int):
    r, g, b, a = template_color(x, y, size)
    if a == 0:
        cx = cy = (size - 1) / 2
        d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
        if d < size * 0.48:
            return (246, 239, 228, 255)
        if d < size * 0.5:
            return (246, 239, 228, 180)
        return (0, 0, 0, 0)
    return (36, 28, 20, 255)


def main() -> None:
    icons = Path("src-tauri/icons")
    write_png(icons / "trayTemplate.png", 32, template_color)
    write_png(icons / "32x32.png", 32, mark_color)
    write_png(icons / "128x128.png", 128, mark_color)
    write_png(icons / "128x128@2x.png", 256, mark_color)
    write_png(icons / "icon.png", 512, mark_color)
    write_png(
        Path("src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/AppIcon.png"),
        1024,
        mark_color,
    )
    print("wrote tauri and iOS icons")


if __name__ == "__main__":
    main()
