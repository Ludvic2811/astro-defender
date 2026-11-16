"""Quita datos sensibles (número de cuenta de AWS, correos, contraseñas) de las
evidencias de texto antes de publicarlas. Uso: python scripts/redactar.py <archivos...>"""
import os
import re
import subprocess
import sys

cuenta = subprocess.run(["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"],
                        capture_output=True, text=True).stdout.strip()
patrones = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[correo]"),
    (re.compile(r"(?i)(password|token|secret)(\"?\s*[:=]\s*\"?)[^\s\",]+"), r"\1\2[oculto]"),
]
if re.fullmatch(r"\d{12}", cuenta):
    patrones.insert(0, (re.compile(cuenta), "************"))

for ruta in sys.argv[1:]:
    if not os.path.isfile(ruta):
        continue
    texto = open(ruta, encoding="utf-8", errors="replace").read()
    nuevo = texto
    for p, r in patrones:
        nuevo = p.sub(r, nuevo)
    if nuevo != texto:
        open(ruta, "w", encoding="utf-8").write(nuevo)
        print("redactado:", ruta)
