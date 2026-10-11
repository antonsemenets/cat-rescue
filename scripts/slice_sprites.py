"""Slice the illustrated sprite sheets in assets-src/ into individual WebP sprites.

    python3 scripts/slice_sprites.py         # everything
    python3 scripts/slice_sprites.py logo    # only the game logo and favicons
    python3 scripts/slice_sprites.py clouds  # only the pastel clouds

Each sprite is found as a connected region of the alpha channel; stray specks
from neighbouring sprites inside the bounding box are erased. Output goes to
src/assets/sprites/ (imported by src/art/sprites.ts).
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "src" / "assets" / "sprites"

# sheet -> list of (name, approximate top-left corner of the sprite's box)
SHEETS = {
    "props-sheet.png": [
        ("tree", (504, 94)), ("house", (27, 149)), ("bush-wide", (830, 369)),
        ("sun", (40, 597)), ("fence-short", (832, 616)), ("fence-long", (325, 617)),
        ("pine", (1211, 643)), ("flowers", (30, 824)), ("grass", (373, 826)), ("bush-round", (965, 828)),
        ("stones", (666, 840)),
    ],
    "sasha-sheet.png": [
        ("sasha-hold", (62, 8)), ("sasha-wave", (1058, 19)), ("sasha-hug", (475, 78)), ("sasha-pet", (36, 680)),
        ("fluffy-sit", (657, 690)), ("fluffy-sleep", (1004, 822)),
    ],
    "cats-sheet.png": [
        ("fluffy-stand", (474, 71)), ("grey-walk", (37, 611)), ("orange-happy", (597, 626)),
        ("orange-look", (852, 634)), ("grey-sit", (357, 642)),
    ],
}

MAX_SIDE = 760  # keep files small; sprites are shown at most ~70vh tall


def slice_sheet(sheet: str, wanted: list[tuple[str, tuple[int, int]]]) -> None:
    im = Image.open(SRC / sheet).convert("RGBA")
    rgba = np.array(im)
    alpha = rgba[:, :, 3]
    mask = ndimage.binary_closing(alpha > 60, iterations=4)
    labels, _ = ndimage.label(mask)
    boxes = ndimage.find_objects(labels)
    for name, (wx, wy) in wanted:
        best, best_d = None, 1e9
        for i, sl in enumerate(boxes):
            if sl is None or (labels[sl] == i + 1).sum() < 4000:
                continue
            d = abs(sl[1].start - wx) + abs(sl[0].start - wy)
            if d < best_d:
                best, best_d = i, d
        assert best is not None and best_d < 40, f"{name}: sprite not found"
        sl = boxes[best]
        keep = ndimage.binary_dilation(labels == best + 1, iterations=6)
        pad = 8
        y0, y1 = max(0, sl[0].start - pad), min(alpha.shape[0], sl[0].stop + pad)
        x0, x1 = max(0, sl[1].start - pad), min(alpha.shape[1], sl[1].stop + pad)
        crop = rgba[y0:y1, x0:x1].copy()
        crop[:, :, 3] = np.where(keep[y0:y1, x0:x1], crop[:, :, 3], 0)
        # drop the faint fringe left by background removal
        crop[:, :, 3] = np.where(crop[:, :, 3] < 24, 0, crop[:, :, 3])
        out = Image.fromarray(crop, "RGBA")
        scale = min(1.0, MAX_SIDE / max(out.size))
        if scale < 1:
            out = out.resize((round(out.width * scale), round(out.height * scale)), Image.LANCZOS)
        out.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
        print(f"{name:14s} {out.width}x{out.height}")


# logo parts: name -> longest side of the output
LOGO = {"logo-icon": 420, "logo-leaves": 700, "logo-word": 1000}
PUBLIC = ROOT / "public"


def clean_logo(name: str) -> Image.Image:
    """Keep the real shapes, drop specks left by background removal, trim."""
    im = Image.open(SRC / "logo" / f"{name}.png").convert("RGBA")
    rgba = np.array(im)
    alpha = rgba[:, :, 3]
    labels, n = ndimage.label(alpha > 40)
    sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, n + 1))
    big = [i + 1 for i, a in enumerate(sizes) if a >= 0.02 * sizes.max()]
    keep = ndimage.binary_dilation(np.isin(labels, big), iterations=3)
    rgba[:, :, 3] = np.where(keep & (alpha >= 24), alpha, 0)
    ys, xs = np.nonzero(rgba[:, :, 3])
    pad = 4
    crop = rgba[max(0, ys.min() - pad) : ys.max() + pad + 1, max(0, xs.min() - pad) : xs.max() + pad + 1]
    return Image.fromarray(crop, "RGBA")


def logo() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, side in LOGO.items():
        out = clean_logo(name)
        scale = min(1.0, side / max(out.size))
        out = out.resize((round(out.width * scale), round(out.height * scale)), Image.LANCZOS)
        out.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
        print(f"{name:14s} {out.width}x{out.height}")
    # the two sprigs separately, so each can sway on its own
    leaves = Image.open(OUT / "logo-leaves.webp").convert("RGBA")
    cols = (np.array(leaves)[:, :, 3] > 10).sum(axis=0)
    w = leaves.width
    gap = [x for x in range(w // 2 - w // 8, w // 2 + w // 8) if cols[x] == 0]
    cut = (gap[0] + gap[-1]) // 2 if gap else w // 2
    for name, box in (("logo-leaf-l", (0, 0, cut, leaves.height)), ("logo-leaf-r", (cut, 0, w, leaves.height))):
        part = leaves.crop(box)
        part = part.crop(part.getbbox())
        part.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
        print(f"{name:14s} {part.width}x{part.height}")
    (OUT / "logo-leaves.webp").unlink()
    # favicons from the paw icon; the touch icon gets a solid cream background
    icon = clean_logo("logo-icon")
    icon.resize((64, 64), Image.LANCZOS).save(PUBLIC / "favicon.png")
    touch = Image.new("RGBA", (180, 180), (253, 243, 228, 255))
    small = icon.resize((150, 150), Image.LANCZOS)
    touch.alpha_composite(small, (15, 15))
    touch.convert("RGB").save(PUBLIC / "apple-touch-icon.png")
    print("favicon.png 64x64, apple-touch-icon.png 180x180")


def clouds() -> None:
    """Pastel clouds: the sheet's background removal left a haze of nearly
    transparent specks, so only solid pixels count. Saved biggest first."""
    rgba = np.array(Image.open(SRC / "clouds-sheet.png").convert("RGBA"))
    solid = rgba[:, :, 3] > 100
    labels, n = ndimage.label(ndimage.binary_closing(solid, iterations=2))
    found = []
    for i, sl in enumerate(ndimage.find_objects(labels)):
        area = int((labels[sl] == i + 1).sum())
        if area < 6000:
            continue
        found.append((area, i + 1, sl))
    found.sort(reverse=True)
    for k, (area, lab, sl) in enumerate(found, 1):
        pad = 4
        y0, y1 = max(0, sl[0].start - pad), min(rgba.shape[0], sl[0].stop + pad)
        x0, x1 = max(0, sl[1].start - pad), min(rgba.shape[1], sl[1].stop + pad)
        keep = ndimage.binary_dilation(labels == lab, iterations=2)[y0:y1, x0:x1]
        crop = rgba[y0:y1, x0:x1].copy()
        crop[:, :, 3] = np.where(keep & (crop[:, :, 3] > 40), crop[:, :, 3], 0)
        out = Image.fromarray(crop, "RGBA")
        scale = min(1.0, 560 / out.width)
        out = out.resize((round(out.width * scale), round(out.height * scale)), Image.LANCZOS)
        out.save(OUT / f"cloud-{k}.webp", "WEBP", quality=88, method=6)
        print(f"cloud-{k:<8} {out.width}x{out.height}")


def single(src: str, name: str, width: int) -> None:
    """A lone illustration on a transparent background: keep the main shape, trim, scale."""
    rgba = np.array(Image.open(SRC / src).convert("RGBA"))
    labels, n = ndimage.label(rgba[:, :, 3] > 60)
    sizes = ndimage.sum(np.ones(labels.shape), labels, range(1, n + 1))
    keep = ndimage.binary_dilation(labels == int(np.argmax(sizes)) + 1, iterations=3)
    rgba[:, :, 3] = np.where(keep & (rgba[:, :, 3] >= 24), rgba[:, :, 3], 0)
    ys, xs = np.nonzero(rgba[:, :, 3])
    out = Image.fromarray(rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], "RGBA")
    out = out.resize((width, round(out.height * width / out.width)), Image.LANCZOS)
    out.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
    print(f"{name:14s} {out.width}x{out.height}")


def main() -> None:
    import sys

    if sys.argv[1:] == ["clouds"]:
        clouds()
        return
    if sys.argv[1:] == ["logo"]:
        logo()
        return
    logo()
    clouds()
    single("cat-nap.png", "cat-nap", 520)
    OUT.mkdir(parents=True, exist_ok=True)
    for sheet, wanted in SHEETS.items():
        slice_sheet(sheet, wanted)
    # round avatar for hints and dialogs: Sasha's face from the waving pose
    face = Image.open(OUT / "sasha-wave.webp").convert("RGBA").crop((88, 14, 240, 166))
    face.resize((160, 160), Image.LANCZOS).save(OUT / "sasha-face.webp", "WEBP", quality=90, method=6)
    print("sasha-face     160x160")
    bg = Image.open(SRC / "meadow.png").convert("RGB")
    bg.save(OUT / "meadow.webp", "WEBP", quality=84, method=6)
    print(f"meadow         {bg.width}x{bg.height}")


if __name__ == "__main__":
    main()
