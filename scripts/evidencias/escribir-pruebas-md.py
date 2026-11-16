"""Reescribe docs/PRUEBAS.md con los resultados reales (resultados.json y costos.json),
conservando la sección de balance de dificultad."""
import json

R = json.load(open("docs/evidencias/resultados.json", encoding="utf-8"))
C = json.load(open("docs/evidencias/costos.json", encoding="utf-8"))
r, p, e, l = R["ramp"], R["spike"], R["spectators"], R["lideres"]
viejo = open("docs/PRUEBAS.md", encoding="utf-8").read()
balance = viejo[viejo.index("## 5. Balance de la dificultad"):]


def n(v, f="{:,.0f}"):
    return f.format(v) if v is not None else "n/d"


def fila(nombre, x):
    return (f"| {nombre} | {n(x['ccu_max'])} | {n(x['espectadores_max'])} | {n(x['gs_allocated_max'])} | "
            f"{n(x['nodos_inicio'])} → {n(x['nodos_max'])} | {n(x['rtt_p95_ccu_max_ms'])} ms | "
            f"{n(x['tick_p99_mediana_ms'])} / {n(x['tick_p99_max_ms'])} ms | {x['error_pct']} % |")


tabla_costos = "\n".join(f"| {a} | {b} | {c} | {d} | {e_} |" for a, b, c, d, e_ in C["tabla"])
kbps = C["kbps_por_espectador"]

md = f"""# Pruebas de carga y autoescalado

Todas las cifras de este documento salen de ejecuciones reales en AWS (us-east-1) el **16 de noviembre de 2026**. Los datos crudos están en `loadtest/resultados/` (CSV y HTML de Locust, series de Prometheus) y el resumen en `docs/evidencias/resultados.json`. Las gráficas se regeneran con `scripts/evidencias/graficas.py`.

## Cómo se ejecutaron

- **Locust dentro del clúster** (`k8s/loadtest/locust.yaml`): 1 maestro y 10 workers. Así la red de una casa no limita la prueba. Los bots usan la **URL pública del lobby** y se conectan al **puerto público del GameServer**, igual que un jugador real.
- Cada bot envía controles cada 200 ms y un ping por segundo. El **RTT** medido es el ciclo completo jugador↔servidor.
- Orquestador: `bash scripts/evidencias/prueba-carga.sh <ramp|spike|spectators> <workers> "<variables>"`. Descarga los CSV del maestro y guarda la ventana de tiempo de la prueba.
- Métricas: `python scripts/evidencias/metricas-prometheus.py loadtest/resultados/<prueba>` consulta Prometheus (por `kubectl port-forward`) y guarda `prometheus.csv`. Incluye CCU, espectadores, GameServers por estado, nodos, réplicas del lobby, tick p50/p99, latencia de asignación, tráfico y CPU.
- Resumen: `python scripts/evidencias/analizar.py`; costos: `python scripts/evidencias/costos.py`.
- Clúster: nodos t3.large (máx. 20; la cuota de la cuenta se subió de 32 a 64 vCPU). Cada GameServer pide 50m de CPU más 10m del sidecar de Agones.

## Resultados

| Prueba | CCU máx. | Espectadores | Partidas | Nodos | RTT p95 en CCU máx. | Tick p99 mediana / máx. | Errores |
|---|---|---|---|---|---|---|---|
{fila("Rampa 0→1,000 en 10 min (colchón 10 %)", r)}
{fila("Pico 20→1,000 en 30 s (colchón 25 % + reserva)", p)}
{fila("200 jugadores + 500 espectadores", e)}

Gráficas: `docs/evidencias/20_prueba_rampa.png`, `21_prueba_pico.png`, `22_prueba_espectadores.png`, `23_curva_ccu_latencia.png` y `24_errores.png`. Hay capturas de Grafana en `33*_grafana_*.png` y de CloudWatch en `30*` a `35*.png`.

### Primer intento de rampa (colchón fijo de 5)

Se detuvo a los 7 minutos: **falló el 75 % de las solicitudes de partida** (1,158 de 1,546), porque los 5 servidores Ready se agotaban en segundos. Sus series de Prometheus se perdieron: el Cluster Autoscaler retiró el nodo donde vivía Prometheus, que no tenía volumen persistente. Se conservan las cifras finales del log de Locust (`loadtest/resultados/ramp_intento1/`).

### Capacidad máxima

La curva CCU contra RTT p95 se mantiene plana (10–40 ms) hasta unos 650 jugadores y **cruza la meta de 80 ms alrededor de 750 jugadores**, con 14 nodos activos. Eso da unos 54 jugadores por nodo, o unos 75 por nodo de juego si se descuentan los 4 nodos de Locust.

Por encima de ese punto:

- el nodo más cargado estaba al 88–95 % de CPU, porque la programación Packed llena cada nodo;
- el tick p99 llegó a {n(p['tick_p99_max_ms'], '{:.1f}')} ms, por encima del presupuesto de 16.7 ms;
- los generadores de Locust llegaron a 0.73 núcleos, cerca de su límite, así que parte de la latencia puede venir de ellos.

### Tiempo de reacción (pico, desde que Locust supera 100 usuarios)

| Capa | Reacción medida |
|---|---|
| FleetAutoscaler (nuevos GameServers) | {n(p['reac_fleet_s'])} s (las muestras son cada 15 s) |
| HPA del lobby (2 → 10 pods) | {n(p['reac_hpa_s'])} s |
| Primeros pods pendientes | {n(p['reac_pendientes_s'])} s |
| Cluster Autoscaler, primer nodo nuevo | {n(p['reac_nodo_s'])} s; luego varios nodos de golpe ({n(p['nodos_al_iniciar_carga'])} → {n(p['nodos_max'])}) |
| 90 % del CCU máximo | {n(p['reac_ccu90_s'])} s |

**Comparación de configuraciones:**

| Colchón del FleetAutoscaler | Resultado |
|---|---|
| 5 fijos | 75 % de solicitudes fallidas |
| 10 % | ~90 jugadores por minuto |
| 25 % + sobreaprovisionamiento (`k8s/overprovisioning.yaml`) | ~250 jugadores por minuto |

Las solicitudes de partida fallidas (rampa {n(r['match_fallos'])} de {n(r['match_n'])}; pico {n(p['match_fallos'])} de {n(p['match_n'])}) son esperas de 25 s sin servidor Ready, tras las cuales el bot reintenta. Cuentan intentos, no jugadores perdidos.

Hubo {n(p['sala_llena_n'])} rechazos por «sala llena» en el pico: dos asignaciones simultáneas llegaban a la misma sala antes de que el servidor publicara que estaba completa.

### Espectadores (500 medidos, extrapolación a 20,000)

- Con 200 jugadores y 500 espectadores el tráfico estable fue de ~68.5 Mbps, es decir **~{n(kbps)} kbps por conexión**. No hubo fallos de conexión y el intervalo entre instantáneas fue p95 de 68 ms.
- **20,000 espectadores** ≈ {20000 * kbps / 1e6:.2f} Gbps, {n(C['egress_20k_gb_h'])} GB por hora, unos **US${n(C['egress_20k_usd_h'])} por hora** de salida a Internet (US$0.09/GB).
- Con 4 pilotos por partida, 20,000 espectadores en 250 partidas son unos 80 por sala. Conviene un relé o una CDN de instantáneas.
- Los espectadores reciben instantáneas por **WebSocket**. **No se implementó streaming HLS.** Un stream de 4,500 kbps usaría unas {4500 / kbps:.0f} veces más ancho de banda.

## Tabla de líderes serverless

- 100 usuarios durante 3 minutos desde México (`loadtest/locust_leaderboard.py`): **{n(l['peticiones'])} peticiones a {l['rps']} por segundo**, p50 {n(l['p50_ms'])} ms y p95 {n(l['p95_ms'])} ms.
- Hubo {l['fallos']} respuestas 503 ({100 * l['fallos'] / l['peticiones']:.2f} %) en el primer minuto. La cuenta tiene un **límite de 10 ejecuciones concurrentes de Lambda** (`aws lambda get-account-settings`).
- Pruebas funcionales en `docs/evidencias/salidas/serverless_pruebas.txt`.

## Costos

| Escenario | Nodos | US$/hora | US$ por jugador-hora | Notas |
|---|---|---|---|---|
{tabla_costos}

Comparación serverless contra servidor tradicional para la tabla de líderes: **US${C['serverless_millon']:.2f} por millón de consultas** contra **US${C['ec2_mes']:.2f} al mes** de una t3.small encendida 24/7.

"""
open("docs/PRUEBAS.md", "w", encoding="utf-8").write(md + balance)
print("PRUEBAS.md actualizado")
