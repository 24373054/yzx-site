"""Turns the captured field stills into the formats the site serves.

Three outputs per theme:
- `public/hero-field-<theme>.avif` / `.webp` — the sharp fallback frame, sized
  above the stage's widest layout width.
- a 28 px wide WebP, inlined as a data URI in site.css — the blurred echo that
  paints instantly while the canvas measures. 28 px is enough: the browser
  upscales it under a 28 px blur.
"""
from PIL import Image
import base64
import os
import re

TARGET_WIDTH = 1600
ECHO_WIDTH = 28
SITE_CSS = "src/styles/site.css"

for theme in ("light", "dark"):
    source = Image.open(f"docs/field-{theme}.png").convert("RGBA")
    height = round(source.height * TARGET_WIDTH / source.width)
    image = source.resize((TARGET_WIDTH, height), Image.LANCZOS)
    for suffix, options in (
        (".avif", {"quality": 46}),
        (".webp", {"quality": 74, "method": 6}),
    ):
        out = f"public/hero-field-{theme}{suffix}"
        image.save(out, suffix.lstrip(".").upper(), **options)
        print(out, image.size, f"{os.path.getsize(out) / 1024:.0f} KB")

    echo_height = max(1, round(source.height * ECHO_WIDTH / source.width))
    echo = source.resize((ECHO_WIDTH, echo_height), Image.LANCZOS)
    echo_path = f"docs/echo-{theme}.webp"
    echo.save(echo_path, "WEBP", quality=34, method=6)
    data = base64.b64encode(open(echo_path, "rb").read()).decode()
    print(echo_path, echo.size, f"{len(data) / 1024:.1f} KB base64")

    with open(SITE_CSS, encoding="utf-8") as handle:
        css = handle.read()
    marker = f"/* @echo {theme} */\n  --field-echo: "
    # The value is a data URI that contains semicolons, so match to end of line.
    pattern = re.escape(marker) + r"[^\n]*"
    replacement = marker + f'url("data:image/webp;base64,{data}");'
    css, count = re.subn(pattern, replacement, css, count=1)
    if count != 1:
        raise SystemExit(f"marker for {theme} not found in {SITE_CSS}")
    with open(SITE_CSS, "w", encoding="utf-8") as handle:
        handle.write(css)
