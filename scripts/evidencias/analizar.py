"""Resume los resultados REALES de las pruebas de carga en docs/evidencias/resultados.json.
Lee loadtest/resultados/<prueba>/{<prueba>_stats.csv, <prueba>_stats_history.csv, prometheus.csv}.
Uso: python scripts/evidencias/analizar.py
"""
import csv
import json
import os
import statistics as st

BASE = "loadtest/resultados"
SALIDA = "docs/evidencias/resultados.json"


def leer(ruta):
    if not os.path.exists(ruta):
        return []
    with open(ruta, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def f(v):
    try:
        x = float(v)
        return None if x != x else x
    except (TypeError, ValueError):
        return None


def col(filas, k):
    return [f(r[k]) for r in filas if f(r.get(k)) is not None]


def curva_ccu_p95(nombre):
    """Une cada ventana de RTT p95 de Locust con el CCU real (Prometheus) más cercano en el tiempo."""
    d = os.path.join(BASE, nombre)
    prom = [(int(x["timestamp"]), f(x["jugadores"])) for x in leer(os.path.join(d, "prometheus.csv")) if f(x["jugadores"]) is not None]
    hist = [x for x in leer(os.path.join(d, f"{nombre}_stats_history.csv")) if x["Name"] == "rtt (ping/pong)" and f(x["95%"])]
    if not prom or not hist:
        return []
    out = []
    for x in hist[::3]:
        t = int(x["Timestamp"])
        c = min(prom, key=lambda p: abs(p[0] - t))
        if abs(c[0] - t) <= 20 and c[1] > 0:
            out.append((c[1], f(x["95%"])))
    return out


def prueba(nombre):
    d = os.path.join(BASE, nombre)
    prom = leer(os.path.join(d, "prometheus.csv"))
    stats = leer(os.path.join(d, f"{nombre}_stats.csv"))
    hist = leer(os.path.join(d, f"{nombre}_stats_history.csv"))
    if not prom:
        return None
    r = {"prueba": nombre}
    t = col(prom, "t_rel_s")
    jug = col(prom, "jugadores")
    r["ccu_max"] = max(jug) if jug else 0
    r["espectadores_max"] = max(col(prom, "espectadores") or [0])
    r["gs_allocated_max"] = max(col(prom, "gs_allocated") or [0])
    r["gs_total_max"] = max(col(prom, "gs_total") or [0])
    nod = [(f(x["t_rel_s"]), f(x["nodos"])) for x in prom if f(x["nodos"]) is not None]
    r["nodos_inicio"] = nod[0][1] if nod else None
    r["nodos_max"] = max(n for _, n in nod) if nod else None
    lob = col(prom, "lobby_replicas")
    r["lobby_min"], r["lobby_max"] = (min(lob), max(lob)) if lob else (None, None)
    tick = col(prom, "tick_p99_ms")
    r["tick_p99_max_ms"] = round(max(tick), 2) if tick else None
    r["tick_p99_mediana_ms"] = round(st.median(tick), 2) if tick else None
    asig = col(prom, "asignacion_p95_s")
    r["asignacion_p95_max_s"] = round(max(asig), 1) if asig else None
    trafico = col(prom, "trafico_ws_mbps")
    r["trafico_max_mbps"] = round(max(trafico), 1) if trafico else None
    # kbps por conexión en el minuto de mayor tráfico
    mejor = None
    for x in prom:
        tr, j, e = f(x["trafico_ws_mbps"]), f(x["jugadores"]) or 0, f(x["espectadores"]) or 0
        if tr and (j + e) > 0 and (mejor is None or tr > mejor[0]):
            mejor = (tr, j, e)
    if mejor:
        r["kbps_por_conexion"] = round(mejor[0] * 1000 / (mejor[1] + mejor[2]), 1)
    cpu = [(f(x["cpu_gameservers_cores"]), f(x["gs_allocated"])) for x in prom]
    cpu = [c * 1000 / a for c, a in cpu if c and a]
    r["cpu_por_gameserver_m"] = round(st.median(cpu), 1) if cpu else None
    r["cpu_nodos_max_pct"] = round(max(col(prom, "cpu_nodos_pct") or [0]), 1)
    # Reacción del autoescalado: primer aumento de nodos y tiempo para llegar al 90 % del CCU máximo
    if nod:
        base_n = nod[0][1]
        sub = [tt for tt, n in nod if n > base_n and tt >= 0]
        r["t_primer_nodo_nuevo_s"] = sub[0] if sub else None
        r["t_nodos_max_s"] = next((tt for tt, n in nod if n == r["nodos_max"] and tt >= 0), None)
    if jug:
        meta = 0.9 * r["ccu_max"]
        r["t_ccu_90_s"] = next((f(x["t_rel_s"]) for x in prom if (f(x["jugadores"]) or 0) >= meta), None)
    # Locust: errores y latencias
    agg = next((x for x in stats if x["Name"] == "Aggregated"), None)
    if agg:
        r["peticiones"] = int(f(agg["Request Count"]))
        r["fallos"] = int(f(agg["Failure Count"]))
        r["error_pct"] = round(100 * r["fallos"] / max(r["peticiones"], 1), 2)
    for nombre_l, clave in (("rtt (ping/pong)", "rtt"), ("/api/match (rápida)", "match"), ("/api/matches", "matches"),
                            ("connect (player)", "connect"), ("connect (spectator)", "connect_esp"),
                            ("rechazo (sala llena)", "sala_llena")):
        x = next((s for s in stats if s["Name"] == nombre_l), None)
        if x:
            r[f"{clave}_n"] = int(f(x["Request Count"]))
            r[f"{clave}_fallos"] = int(f(x["Failure Count"]))
            r[f"{clave}_p50_ms"] = f(x["50%"])
            r[f"{clave}_p95_ms"] = f(x["95%"])
            r[f"{clave}_p99_ms"] = f(x["99%"])
    # p95 de RTT con la carga máxima (ventanas de Locust con >= 90 % de los usuarios)
    rtt = [x for x in hist if x["Name"] == "rtt (ping/pong)"]
    if rtt:
        umax = max(f(x["User Count"]) or 0 for x in rtt)
        alto = [f(x["95%"]) for x in rtt if (f(x["User Count"]) or 0) >= 0.9 * umax and f(x["95%"])]
        r["usuarios_max_locust"] = umax
        r["rtt_p95_carga_max_ms"] = round(st.median(alto), 1) if alto else None
    curva = curva_ccu_p95(nombre)
    if curva:
        cmax = max(c for c, _ in curva)
        cerca = [l for c, l in curva if c >= 0.9 * cmax]
        r["rtt_p95_ccu_max_ms"] = round(st.median(cerca), 1) if cerca else None
    return r


if __name__ == "__main__":
    res = {}
    for n in ("ramp_intento1", "ramp", "spike", "spectators"):
        x = prueba(n)
        if x:
            res[n] = x
    lid = leer(os.path.join(BASE, "lideres", "lideres_stats.csv"))
    agg = next((x for x in lid if x["Name"] == "Aggregated"), None)
    if agg:
        res["lideres"] = {
            "peticiones": int(f(agg["Request Count"])), "fallos": int(f(agg["Failure Count"])),
            "rps": round(f(agg["Requests/s"]), 1), "p50_ms": f(agg["50%"]), "p95_ms": f(agg["95%"]),
            "p99_ms": f(agg["99%"]),
        }
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    json.dump(res, open(SALIDA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Series para las gráficas nativas de la presentación
    origen = "spike" if os.path.exists(os.path.join(BASE, "spike", "prometheus.csv")) else "ramp"
    prom = leer(os.path.join(BASE, origen, "prometheus.csv"))
    pts = [x for x in prom if f(x["gs_allocated"]) is not None and f(x["nodos"]) is not None][::2]
    json.dump({
        "origen": origen,
        "min": [f"{f(x['t_rel_s']) / 60:.1f}" for x in pts],
        "allocated": [f(x["gs_allocated"]) for x in pts],
        "ready": [f(x["gs_ready"]) or 0 for x in pts],
        "nodos": [f(x["nodos"]) for x in pts],
    }, open("docs/evidencias/serie_pico.json", "w", encoding="utf-8"))
    ccu, p95 = [], []
    for n in ("ramp", "spike"):
        for c, l in curva_ccu_p95(n):
            ccu.append(c)
            p95.append(l)
    json.dump({"ccu": ccu, "p95": p95}, open("docs/evidencias/serie_ccu_p95.json", "w", encoding="utf-8"))
    print(json.dumps(res, ensure_ascii=False, indent=1))
