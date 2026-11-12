"""Convert the final captures into lightweight preview images for docs/."""

from __future__ import annotations

import os

from PIL import Image

os.makedirs("docs/preview", exist_ok=True)

PICKS = [
    ("01-home-light.png", "home-light", 1400),
    ("02-home-dark.png", "home-dark", 1400),
    ("05-post-light.png", "article-light", 1400),
    ("21-fold-dark.png", "fold-dark", 1400),
    ("22-fold-mobile-light.png", "mobile-light", 520),
    ("10-post-mobile.png", "article-mobile", 520),
]

for source, target, max_width in PICKS:
    image = Image.open(f".shots/{source}").convert("RGB")
    if image.width > max_width:
        height = round(image.height * max_width / image.width)
        image = image.resize((max_width, height), Image.LANCZOS)
    if image.height > 4200:
        image = image.crop((0, 0, image.width, 4200))
    path = f"docs/preview/{target}.jpg"
    image.save(path, quality=82, optimize=True, progressive=True)
    print(path, image.size, os.path.getsize(path))
