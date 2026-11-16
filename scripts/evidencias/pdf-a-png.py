"""Renderiza cada página de un PDF a PNG para revisarla visualmente.
Uso: python pdf-a-png.py <archivo.pdf> <carpeta> [dpi]"""
import os
import sys

import pymupdf

pdf, out = sys.argv[1], sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 70
os.makedirs(out, exist_ok=True)
d = pymupdf.open(pdf)
for i, p in enumerate(d):
    p.get_pixmap(dpi=dpi).save(os.path.join(out, f"pag{i + 1}.png"))
print(len(d), "páginas")
