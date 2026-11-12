"""Crop regions out of the captured screenshots for close inspection."""

from __future__ import annotations

import sys

from PIL import Image

OUT = ".shots/crops"

REGIONS = {
    "01-home-light.png": [
        ("hero", 0, 0, 2160, 1180),
        ("work", 0, 1160, 2160, 1880),
        ("writing", 0, 2450, 2160, 3300),
        ("about", 0, 3600, 2160, 4380),
        ("footer", 0, 4560, 2160, 5112),
    ],
    "05-post-light.png": [
        ("post-head", 0, 0, 2160, 1500),
        ("post-body", 0, 1400, 2160, 3000),
    ],
    "09-home-mobile.png": [
        ("mobile-top", 0, 0, 585, 2400),
    ],
    "07-about-light.png": [
        ("about-top", 0, 0, 2160, 1700),
        ("about-cards", 0, 1500, 2160, 3200),
    ],
}

for name, regions in REGIONS.items():
    image = Image.open(f".shots/{name}")
    for label, x1, y1, x2, y2 in regions:
        x2 = min(x2, image.width)
        y2 = min(y2, image.height)
        image.crop((x1, y1, x2, y2)).save(f"{OUT}/{name.replace('.png', '')}-{label}.png")
        print(f"{OUT}/{name.replace('.png', '')}-{label}.png")
