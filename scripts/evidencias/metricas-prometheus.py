"""Descarga de Prometheus las series de una prueba de carga (ventana inicio-fin)
y las guarda en CSV. Requiere un port-forward activo:
  kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090
Uso: python metricas-prometheus.py <carpeta-resultados> [paso_segundos]
"""
import csv
import json
import sys
import urllib.parse
import urllib.request

PROM = "http://localhost:9090"
CONSULTAS = {
    "jugadores": 'sum(astro_players_connected)',
    "espectadores": 'sum(astro_spectators_connected)',
    "gs_ready": 'sum(agones_gameservers_count{fleet_name="astro-fleet",type="Ready"})',
    "gs_allocated": 'sum(agones_gameservers_count{fleet_name="astro-fleet",type="Allocated"})',
    "gs_total": 'sum(agones_fleets_replicas_count{name="astro-fleet",type="total"})',
    "gs_deseados": 'sum(agones_fleet_autoscalers_desired_replicas_count{fleet_name="astro-fleet"})',
    "pods_pendientes": 'sum(kube_pod_status_phase{phase="Pending"})',
    "nodos": 'count(kube_node_info)',
    "nodos_listos": 'sum(kube_node_status_condition{condition="Ready",status="true"})',
    "lobby_replicas": 'sum(kube_deployment_status_replicas{deployment="astro-lobby"})',
    "lobby_hpa_deseadas": 'sum(kube_horizontalpodautoscaler_status_desired_replicas{horizontalpodautoscaler="astro-lobby"})',
    "tick_p99_ms": '1000 * histogram_quantile(0.99, sum by (le) (rate(astro_tick_duration_seconds_bucket[1m])))',
    "tick_p50_ms": '1000 * histogram_quantile(0.50, sum by (le) (rate(astro_tick_duration_seconds_bucket[1m])))',
    "asignacion_p95_s": 'histogram_quantile(0.95, sum by (le) (rate(astro_lobby_allocation_seconds_bucket[1m])))',
    "asignaciones_ok_s": 'sum(rate(astro_lobby_allocations_total{result="allocated"}[1m]))',
    "asignaciones_fallidas_s": 'sum(rate(astro_lobby_allocations_total{result!="allocated"}[1m]))',
    "trafico_ws_mbps": '8 * sum(rate(astro_ws_bytes_sent_total[1m])) / 1e6',
    "cpu_nodos_pct": '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m])))',
    "cpu_gameservers_cores": 'sum(rate(container_cpu_usage_seconds_total{namespace="astro",container="astro-gameserver"}[1m]))',
    "cpu_lobby_cores": 'sum(rate(container_cpu_usage_seconds_total{namespace="astro",container="lobby"}[1m]))',
    "mem_gameservers_mb": 'sum(container_memory_working_set_bytes{namespace="astro",container="astro-gameserver"}) / 1e6',
    "mem_nodos_pct": '100 * (1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))',
}


def rango(q, inicio, fin, paso):
    url = f"{PROM}/api/v1/query_range?" + urllib.parse.urlencode(
        {"query": q, "start": inicio, "end": fin, "step": paso})
    with urllib.request.urlopen(url, timeout=60) as r:
        datos = json.load(r)["data"]["result"]
    return {int(float(t)): float(v) for t, v in datos[0]["values"]} if datos else {}


def main():
    carpeta = sys.argv[1]
    paso = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    ventana = dict(l.strip().split("=") for l in open(f"{carpeta}/ventana.txt") if "=" in l)
    inicio, fin = int(ventana["inicio"]) - 120, int(ventana["fin"]) + 300
    series = {k: rango(q, inicio, fin, paso) for k, q in CONSULTAS.items()}
    tiempos = sorted({t for s in series.values() for t in s})
    with open(f"{carpeta}/prometheus.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "t_rel_s", *CONSULTAS])
        for t in tiempos:
            fila = [series[k].get(t, "") for k in CONSULTAS]
            w.writerow([t, t - int(ventana["inicio"]), *[("" if v == "" else round(v, 4)) for v in fila]])
    print(f"{len(tiempos)} muestras -> {carpeta}/prometheus.csv")


if __name__ == "__main__":
    main()
