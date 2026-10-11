"""Slice the illustrated sprite sheets in assets-src/ into individual WebP sprites.

    python3 scripts/slice_sprites.py

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
        ("tree", (504, 94)), ("house", (27, 149)), ("cloud-big", (1148, 226)), ("bush-wide", (830, 369)),
        ("cloud-small", (1219, 397)), ("sun", (40, 597)), ("fence-short", (832, 616)), ("fence-long", (325, 617)),
        ("pine", (1211, 643)), ("flowers", (30, 824)), ("grass", (373, 826)), ("bush-round", (965, 828)),
        ("stones", (666, 840)),
    ],
    "sasha-sheet.png": [
        ("sasha-hold", (62, 8)), ("sasha-wave", (1058, 19)), ("sasha-hug", (475, 78)), ("sasha-pet", (36, 680)),
        ("fluffy-sit", (657, 690)), ("fluffy-sleep", (1004, 822)),
    ],
    "cats-sheet.png": [
        ("fluffy-stand", (474, 71)), ("grey-walk", (37, 611)), ("orange-happy", (597, 626)),
        ("orange-look", (852, 634)), ("grey-sit", (357, 642)), ("black-fence", (1118, 658)),
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


def main() -> None:
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
