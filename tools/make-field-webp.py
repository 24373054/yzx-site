"""Turns the captured field stills into the two web formats the site serves.

`image-set()` in site.css prefers AVIF (about 40 KB) and falls back to WebP.
Both are sized just above the field's widest layout width (1016 px), which is
all this grain needs.
"""
from PIL import Image
import os

TARGET_WIDTH = 1200

for theme in ("light", "dark"):
    source = Image.open(f"docs/field-{theme}.png").convert("RGBA")
    height = round(source.height * TARGET_WIDTH / source.width)
    image = source.resize((TARGET_WIDTH, height), Image.LANCZOS)
    for suffix, options in (
        (".avif", {"quality": 45}),
        (".webp", {"quality": 74, "method": 6}),
    ):
        out = f"public/hero-field-{theme}{suffix}"
        image.save(out, suffix.lstrip(".").upper(), **options)
        print(out, image.size, f"{os.path.getsize(out) / 1024:.0f} KB")
