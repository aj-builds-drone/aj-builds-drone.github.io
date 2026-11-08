"""Export the VTOL plane's renders as web media for /projects/vtol-plane/.

Images and video only: never copy meshes (STL, 3MF, GLB) or G-code into public/.

    python scripts/export_vtol_media.py <vtol-plane repo>/renders
"""
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageSequence

OUT = Path(__file__).resolve().parent.parent / "public" / "projects" / "vtol-plane"

ANIMATIONS = {
    "anim_turntable.gif": "turntable",
    "anim_transition.gif": "transition",
    "anim_burst.gif": "burst",
    "anim_nose_battery.gif": "battery",
    "anim_service.gif": "service",
}
STILLS = {
    "10_xray_structure.png": "xray_structure",
    "33_xray_equipment_and_cables.png": "xray_equipment",
    "34_cut_wing_root_webs_and_spars.png": "wing_webs",
    "49_sliced_plates_s1_petg.png": "sliced_petg",
    "52_sim_flight.png": "sim_poster",
    "53_sim_flight_log.png": "sim_log",
}


def crop_to(im, aspect):
    w, h = im.size
    if w / h > aspect:
        nw = round(h * aspect)
        return im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    nh = round(w / aspect)
    return im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))


def main(renders):
    OUT.mkdir(parents=True, exist_ok=True)
    for src, name in ANIMATIONS.items():
        gif = Image.open(renders / src)
        frames, durations = [], []
        for f in ImageSequence.Iterator(gif):
            frames.append(f.convert("RGB"))
            durations.append(f.info.get("duration", 100))
        frames[0].save(OUT / f"{name}.webp", save_all=True, append_images=frames[1:],
                       duration=durations, loop=0, quality=78, method=4)
        # Shown instead of the animation when the visitor asks for reduced motion.
        frames[len(frames) // 2].save(OUT / f"{name}_still.webp", quality=82, method=6)
    for src, name in STILLS.items():
        im = Image.open(renders / src).convert("RGB")
        im.thumbnail((1600, 1600), Image.LANCZOS)
        im.save(OUT / f"{name}.webp", quality=82, method=6)
    front = Image.open(renders / "01_iso_front.png").convert("RGB")
    crop_to(front, 16 / 9).resize((800, 450), Image.LANCZOS).save(OUT / "card.webp", quality=82, method=6)
    crop_to(front, 1200 / 630).resize((1200, 630), Image.LANCZOS).save(OUT / "og.jpg", quality=85, optimize=True)
    shutil.copyfile(renders / "sim_flight.mp4", OUT / "sim_flight.mp4")
    for p in sorted(OUT.iterdir()):
        print(f"{p.name:26s} {p.stat().st_size / 1024:8.0f} KB")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
