"""Genera las gráficas del reporte a partir de los resultados REALES de las pruebas:
  loadtest/resultados/<prueba>/<prueba>_stats_history.csv  (Locust)
  loadtest/resultados/<prueba>/prometheus.csv              (Prometheus del clúster)
Uso: python graficas.py <carpeta-resultados> <carpeta-salida-png>
"""
import csv
import math
import os
import sys

import matplotlib
from analizar import curva_ccu_p95  # noqa: E402
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

# Paleta categórica validada (slots 1-3) y tinta de texto
C1, C2, C3 = "#2a78d6", "#eb6834", "#1baf7a"
TXT, TXT2, GRID, SURF = "#0b0b0b", "#52514e", "#e4e3df", "#ffffff"
plt.rcParams.update({
    "font.family": ["Century Gothic", "DejaVu Sans"], "font.size": 10,
    "axes.edgecolor": GRID, "axes.labelcolor": TXT2, "xtick.color": TXT2, "ytick.color": TXT2,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8, "axes.spines.top": False,
    "axes.spines.right": False, "figure.facecolor": SURF, "axes.facecolor": SURF,
    "legend.frameon": False, "axes.titleweight": "bold", "axes.titlesize": 11, "axes.titlecolor": TXT,
    "lines.linewidth": 2,
})


def leer(ruta):
    with open(ruta, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(v):
    try:
        x = float(v)
        return None if math.isnan(x) else x
    except (TypeError, ValueError):
        return None


def serie(filas, x, y):
    pts = [(num(f[x]), num(f[y])) for f in filas]
    pts = [(a, b) for a, b in pts if a is not None and b is not None]
    return [a for a, _ in pts], [b for _, b in pts]


def locust_hist(carpeta, prueba):
    ruta = os.path.join(carpeta, f"{prueba}_stats_history.csv")
    if not os.path.exists(ruta):
        return [], []
    filas = leer(ruta)
    t0 = min(int(f["Timestamp"]) for f in filas)
    for f in filas:
        f["t_rel_s"] = int(f["Timestamp"]) - t0
    rtt = [f for f in filas if f["Name"] == "rtt (ping/pong)"]
    agg = [f for f in filas if f["Name"] == "Aggregated"]
    return rtt, agg


def panel_tiempo(prueba, carpeta, salida, titulo):
    prom = leer(os.path.join(carpeta, "prometheus.csv"))
    rtt, agg = locust_hist(carpeta, prueba)
    fig, ax = plt.subplots(4, 1, figsize=(8.6, 9.2), sharex=True)
    m = lambda xs: [x / 60 for x in xs]  # noqa: E731

    x, y = serie(prom, "t_rel_s", "jugadores"); ax[0].plot(m(x), y, color=C1, label="Jugadores (servidores)")
    x, y = serie(prom, "t_rel_s", "espectadores")
    if any(y):
        ax[0].plot(m(x), y, color=C2, label="Espectadores")
    if agg:
        x, y = serie(agg, "t_rel_s", "User Count"); ax[0].plot(m(x), y, color=C3, linestyle="--", linewidth=1.5, label="Usuarios simulados (Locust)")
    ax[0].set_title("Usuarios concurrentes"); ax[0].legend(loc="upper left", fontsize=8)

    x, y = serie(prom, "t_rel_s", "gs_allocated"); ax[1].plot(m(x), y, color=C1, label="Allocated (en partida)")
    x, y = serie(prom, "t_rel_s", "gs_ready"); ax[1].plot(m(x), y, color=C2, label="Ready (colchón)")
    ax[1].set_title("GameServers de Agones por estado"); ax[1].legend(loc="upper left", fontsize=8)

    x, y = serie(prom, "t_rel_s", "nodos"); ax[2].step(m(x), y, where="post", color=C1, label="Nodos EC2")
    x, y = serie(prom, "t_rel_s", "lobby_replicas"); ax[2].step(m(x), y, where="post", color=C2, label="Pods del lobby (HPA)")
    ax[2].set_title("Nodos EC2 y réplicas del lobby"); ax[2].legend(loc="upper left", fontsize=8)

    if rtt:
        x, y = serie(rtt, "t_rel_s", "95%"); ax[3].plot(m(x), y, color=C1, label="RTT p95 jugador↔servidor (ms)")
    x, y = serie(prom, "t_rel_s", "tick_p99_ms"); ax[3].plot(m(x), y, color=C2, label="Tick del servidor p99 (ms)")
    ax[3].set_title("Latencia (ms)"); ax[3].legend(loc="upper left", fontsize=8)
    ax[3].set_xlabel("Minutos desde el inicio de la prueba")
    fig.suptitle(titulo, fontweight="bold", color=TXT, fontsize=12)
    fig.tight_layout()
    fig.savefig(salida, dpi=170)
    plt.close(fig)


def curva_ccu(carpetas, salida):
    """CCU frente a latencia p95: cada punto es una ventana de Locust."""
    fig, ax = plt.subplots(figsize=(8.6, 4.2))
    for (prueba, carpeta), color in zip(carpetas, [C1, C2, C3]):
        pts = curva_ccu_p95(prueba)
        if not pts:
            continue
        x, y = [c for c, _ in pts], [l for _, l in pts]
        ax.scatter(x, y, s=22, color=color, alpha=0.75, label={"ramp": "Rampa", "spike": "Pico", "spectators": "Espectadores"}.get(prueba, prueba), edgecolors=SURF, linewidths=0.6)
    ax.axhline(80, color=TXT2, linewidth=1, linestyle=":")
    ax.text(ax.get_xlim()[0], 82, " meta 80 ms", color=TXT2, fontsize=8, va="bottom")
    ax.set_xlabel("Jugadores conectados (CCU, Prometheus)"); ax.set_ylabel("RTT p95 jugador↔servidor (ms)")
    ax.set_title("Curva CCU vs. latencia p95"); ax.legend(loc="upper left", fontsize=8)
    fig.tight_layout(); fig.savefig(salida, dpi=170); plt.close(fig)


def errores(carpetas, salida):
    fig, ax = plt.subplots(figsize=(8.6, 3.6))
    for (prueba, carpeta), color in zip(carpetas, [C1, C2, C3]):
        _, agg = locust_hist(carpeta, prueba)
        if agg:
            x, y = serie(agg, "t_rel_s", "Failures/s")
            ax.plot([v / 60 for v in x], y, color=color, label={"ramp": "Rampa", "spike": "Pico", "spectators": "Espectadores"}.get(prueba, prueba))
    ax.set_title("Errores por segundo (Locust)"); ax.set_xlabel("Minutos desde el inicio de cada prueba")
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout(); fig.savefig(salida, dpi=170); plt.close(fig)


if __name__ == "__main__":
    base, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    pruebas = [(p, os.path.join(base, p)) for p in ("ramp", "spike", "spectators")
               if os.path.exists(os.path.join(base, p, "prometheus.csv"))]
    nombres = {"ramp": ("20_prueba_rampa", "Prueba de rampa"), "spike": ("21_prueba_pico", "Prueba de pico"),
               "spectators": ("22_prueba_espectadores", "Prueba de espectadores")}
    for p, c in pruebas:
        arch, tit = nombres[p]
        panel_tiempo(p, c, os.path.join(out, f"{arch}.png"), tit)
        print("ok", arch)
    curva_ccu(pruebas, os.path.join(out, "23_curva_ccu_latencia.png"))
    errores(pruebas, os.path.join(out, "24_errores.png"))
    print("ok curvas")
