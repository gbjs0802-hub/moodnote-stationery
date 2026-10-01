from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "dist" / "assets"
SOURCE = ASSETS / "moodnote-logo-v3.png"


def mark_image():
    source = Image.open(SOURCE).convert("RGBA")
    left = source.crop((0, 0, min(760, source.width), source.height))
    pixels = left.load()
    for y in range(left.height):
        for x in range(left.width):
            r, g, b, a = pixels[x, y]
            if x > 535 and r < 160 and g < 100 and b < 100:
                pixels[x, y] = (r, g, b, 0)
    bbox = left.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError("Logo mark has no visible pixels")
    return left.crop(bbox)


def build_icon(size: int, filename: str, mark_ratio: float):
    canvas = Image.new("RGBA", (size, size), "#FFF8EE")
    mark = mark_image()
    target = int(size * mark_ratio)
    mark.thumbnail((target, target), Image.Resampling.LANCZOS)
    x = (size - mark.width) // 2
    y = (size - mark.height) // 2 + int(size * 0.015)
    canvas.alpha_composite(mark, (x, y))
    canvas.convert("RGB").save(ASSETS / filename, "PNG", optimize=True)


build_icon(32, "favicon-32.png", .78)
build_icon(180, "apple-touch-icon.png", .76)
build_icon(192, "pwa-192.png", .76)
build_icon(512, "pwa-512.png", .76)
build_icon(512, "pwa-maskable-512.png", .62)
print("Created Moodnote PWA icon set")
