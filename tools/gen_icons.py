#!/usr/bin/env python3
"""Generate flat flashcard icons (16/48/128) with stdlib only.

Run: python3 tools/gen_icons.py
Outputs PNGs into icons/.
"""
import os
import struct
import zlib

ACCENT = (91, 140, 255)      # background
CARD = (255, 255, 255)       # flashcard
LINE = (150, 170, 210)       # text lines on card
DOT = (62, 167, 106)         # accent dot


def rounded(x, y, w, h, r):
    """Return True if pixel (x, y) is inside a rounded rect at origin (0,0)."""
    if x < 0 or y < 0 or x >= w or y >= h:
        return False
    # corner checks
    for cx, cy in ((r, r), (w - r - 1, r), (r, h - r - 1), (w - r - 1, h - r - 1)):
        inside_corner_region = (
            (x < r and y < r) or (x >= w - r and y < r) or
            (x < r and y >= h - r) or (x >= w - r and y >= h - r)
        )
        if inside_corner_region:
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                return True
            # if in a corner region but not in any circle -> outside
            # need to ensure it's the matching corner; check nearest corner
            nx = r if x < r else w - r - 1
            ny = r if y < r else h - r - 1
            return (x - nx) ** 2 + (y - ny) ** 2 <= r * r
    return True


def make(size):
    bg_r = max(2, size // 6)
    px = bytearray([0, 0, 0, 0] * size * size)

    def put(x, y, rgb, a=255):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 4
            px[i:i + 4] = bytes((rgb[0], rgb[1], rgb[2], a))

    # background rounded square
    for y in range(size):
        for x in range(size):
            if rounded(x, y, size, size, bg_r):
                put(x, y, ACCENT)

    # flashcard in center
    m = max(2, size // 6)
    cx0, cy0 = m, int(size * 0.28)
    cw, ch = size - 2 * m, int(size * 0.48)
    cr = max(1, size // 14)
    for y in range(cy0, cy0 + ch):
        for x in range(cx0, cx0 + cw):
            if rounded(x - cx0, y - cy0, cw, ch, cr):
                put(x, y, CARD)

    # text lines on the card
    if size >= 32:
        line_h = max(1, size // 22)
        gap = max(2, size // 9)
        lx0 = cx0 + cw // 6
        lx1 = cx0 + cw - cw // 6
        for n in range(2):
            ly = cy0 + ch // 3 + n * gap
            width = (lx1 - lx0) if n == 0 else int((lx1 - lx0) * 0.6)
            for y in range(ly, ly + line_h):
                for x in range(lx0, lx0 + width):
                    put(x, y, LINE)

    # accent dot (status)
    dr = max(1, size // 9)
    dcx, dcy = size - m - dr, cy0 + ch + max(2, size // 12) + dr
    if dcy + dr < size:
        for y in range(dcy - dr, dcy + dr + 1):
            for x in range(dcx - dr, dcx + dr + 1):
                if (x - dcx) ** 2 + (y - dcy) ** 2 <= dr * dr:
                    put(x, y, DOT)

    return bytes(px)


def write_png(path, size, rgba):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)  # filter type 0
        raw.extend(rgba[y * stride:(y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for size in (16, 48, 128):
        write_png(os.path.join(out, f"icon{size}.png"), size, make(size))
        print("wrote", f"icons/icon{size}.png")


if __name__ == "__main__":
    main()
