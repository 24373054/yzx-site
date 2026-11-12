"""Render public/og.png — 1200x630 social card built from the site palette."""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
INK = (21, 21, 23)
FONT_DIR = "C:/Windows/Fonts"


def load_font(names: tuple[str, ...], size: int) -> ImageFont.FreeTypeFont:
    for name in names:
        path = os.path.join(FONT_DIR, name)
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default(size)


bold = load_font(("segoeuib.ttf", "arialbd.ttf"), 172)
semi = load_font(("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"), 38)
mono = load_font(("consola.ttf", "cour.ttf"), 25)
cjk = load_font(("msyh.ttc", "msyhbd.ttc", "simhei.ttf"), 30)

canvas = np.zeros((H, W, 3), dtype=np.float32)
canvas[:, :] = INK
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def glow(cx: float, cy: float, radius: float, color: tuple[int, int, int], strength: float) -> None:
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / radius
    alpha = np.clip(1.0 - dist, 0.0, 1.0) ** 2 * strength
    for channel in range(3):
        canvas[:, :, channel] += (color[channel] - canvas[:, :, channel]) * alpha


glow(W * 0.88, -H * 0.18, W * 0.62, (77, 107, 254), 0.62)
glow(W * -0.02, H * 0.34, W * 0.52, (139, 92, 246), 0.40)
glow(W * 0.58, H * 1.25, W * 0.72, (56, 189, 248), 0.20)

image = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGB")
draw = ImageDraw.Draw(image)

img = image.convert("RGBA")
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for x in range(80, W, 80):
    od.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
for y in range(80, H, 80):
    od.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)
image = Image.alpha_composite(img, overlay).convert("RGB")
draw = ImageDraw.Draw(image)

draw.text((88, 82), "P E R S O N A L   S I T E", font=mono, fill=(150, 156, 175))

draw.text((80, 196), "YZX", font=bold, fill=(255, 255, 255))

bar_x, bar_y, bar_w, bar_h = 88, 412, 268, 6
for i in range(bar_w):
    t = i / (bar_w - 1)
    color = (
        int(77 + (139 - 77) * t),
        int(107 + (92 - 107) * t),
        int(254 + (246 - 254) * t),
    )
    draw.rectangle([bar_x + i, bar_y, bar_x + i, bar_y + bar_h], fill=color)

draw.text((88, 452), "Independent developer / interface engineer", font=semi, fill=(214, 218, 230))
draw.text((88, 556), "yzx.example.com", font=mono, fill=(130, 137, 158))
draw.text((W - 88, 560), "把复杂的事，做简单。", font=cjk, fill=(214, 218, 230), anchor="ra")

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "og.png")
image.save(out, optimize=True)
print(f"wrote {out} {image.size} {os.path.getsize(out)} bytes")
