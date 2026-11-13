from PIL import Image
import os

PICKS = [
    ('.shots/b1-light.png', 'docs/preview/home-light.jpg', 1400),
    ('.shots/b2-dark.png', 'docs/preview/home-dark.jpg', 1400),
    ('.shots/b3-mobile.png', 'docs/preview/mobile-light.jpg', 520),
    ('.shots/b4-mobile-dark.png', 'docs/preview/mobile-dark.jpg', 520),
]

os.makedirs('docs/preview', exist_ok=True)
for src, dst, width in PICKS:
    im = Image.open(src).convert('RGB')
    height = round(im.height * width / im.width)
    im.resize((width, height), Image.LANCZOS).save(dst, quality=82, optimize=True)
    print(dst, im.size, '->', width, height)
