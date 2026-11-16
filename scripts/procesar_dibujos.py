"""
Convierte las fotos/escaneos de los dibujos del equipo en sprites PNG con fondo
transparente para el juego.

Uso:
    pip install pillow numpy scipy
    python scripts/procesar_dibujos.py

Lee   client/assets/originales/{nave,ovni,asteroide}.(png|jpg|jpeg)
Crea  client/assets/{player,enemy,asteroid}.png y actualiza manifest.json

Pasos por dibujo:
  1. Recorte de la zona útil (quita la marca "Escaneado con CamScanner" y bordes).
  2. Máscara de "tinta": todo lo que no es papel claro y sin color.
  3. Cierre morfológico + relleno de huecos: el interior blanco del dibujo se conserva.
  4. Se queda solo el componente más grande (elimina estrellas, rayos y puntos sueltos).
  5. (ovni) Apertura morfológica para quitar las líneas finas del haz de luz.
  6. (nave) Rotación para que la punta quede hacia arriba.
  7. Borde suavizado, recorte ajustado y escalado a 512 px.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "client" / "assets" / "originales"
DST = ROOT / "client" / "assets"
SIZE = 512

# nombre del original -> (clave del juego, recorte relativo (x0,y0,x1,y1), opciones)
DIBUJOS = {
    "nave": ("player", (0.0, 0.03, 1.0, 0.94), {"rotate": "auto-up", "close": 9}),
    "ovni": ("enemy", (0.0, 0.01, 1.0, 0.60), {"open": 7, "close": 7}),
    "asteroide": ("asteroid", (0.12, 0.20, 0.88, 0.78), {"close": 7}),
}


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def largest_component(mask):
    lab, n = ndi.label(mask)
    if n == 0:
        return mask
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def find_source(name):
    for ext in (".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG", ".webp"):
        p = SRC / f"{name}{ext}"
        if p.exists():
            return p
    return None


def object_mask(rgb, close_r, open_r=0):
    f = rgb.astype(np.float32)
    bright = f.mean(axis=2)
    sat = f.max(axis=2) - f.min(axis=2)
    # Papel: claro y casi sin color (tolerante al sombreado leve del escaneo)
    paper = (bright > 200) & (sat < 28)
    ink = ~paper
    ink = ndi.binary_opening(ink, disk(1))                 # ruido de 1 px
    mask = ndi.binary_closing(ink, disk(close_r), border_value=0)
    mask = ndi.binary_fill_holes(mask)
    if open_r:
        solid = ndi.binary_opening(mask, disk(open_r))      # quita líneas finas
        solid = largest_component(solid)
        mask = mask & ndi.binary_dilation(solid, disk(2))
    mask = largest_component(mask)
    return ndi.binary_fill_holes(mask)


def principal_angle(mask):
    ys, xs = np.nonzero(mask)
    xs = xs - xs.mean()
    ys = ys - ys.mean()
    cov = np.cov(np.vstack([xs, ys]))
    vals, vecs = np.linalg.eigh(cov)
    vx, vy = vecs[:, np.argmax(vals)]
    return np.degrees(np.arctan2(vy, vx))


def process(name, key, crop, opts):
    src = find_source(name)
    if not src:
        print(f"[omitido] falta client/assets/originales/{name}.(png|jpg)")
        return None
    im = Image.open(src).convert("RGB")
    w, h = im.size
    x0, y0, x1, y1 = crop
    im = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
    rgb = np.array(im)
    mask = object_mask(rgb, opts.get("close", 7), opts.get("open", 0))

    alpha = ndi.binary_erosion(mask, disk(1)).astype(np.float32)
    alpha = ndi.gaussian_filter(alpha, 0.8)
    rgba = np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    out = Image.fromarray(rgba, "RGBA")

    if opts.get("rotate") == "auto-up":
        ang = principal_angle(mask)          # ángulo del eje largo respecto al eje x
        # Girar para que el eje largo quede vertical
        rot = ang - 90 if ang > 0 else ang + 90
        out = out.rotate(rot, resample=Image.BICUBIC, expand=True)
        # La punta debe quedar arriba: la mitad superior debe ser más estrecha (sin llama)
        a = np.array(out)[:, :, 3] > 128
        ys = np.nonzero(a.any(axis=1))[0]
        mid = (ys[0] + ys[-1]) // 2
        top = a[ys[0]:mid].sum()
        bottom = a[mid:ys[-1]].sum()
        if top > bottom:
            out = out.rotate(180, expand=True)
            rot += 180
        print(f"  {name}: girado {rot:.1f}°")

    bbox = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    out = out.crop(bbox)
    out.thumbnail((SIZE, SIZE), Image.LANCZOS)
    dst = DST / f"{key}.png"
    out.save(dst, optimize=True)
    print(f"[ok] {src.name} -> {dst.relative_to(ROOT)} {out.size}")
    return key


def main():
    only = set(sys.argv[1:])
    manifest_path = DST / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8") or "{}")
    for name, (key, crop, opts) in DIBUJOS.items():
        if only and name not in only:
            continue
        if process(name, key, crop, opts):
            manifest[key] = f"{key}.png"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("manifest.json:", manifest)


if __name__ == "__main__":
    main()
