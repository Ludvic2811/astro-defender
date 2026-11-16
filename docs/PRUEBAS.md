# Pruebas de carga y autoescalado

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
| Rampa 0→1,000 en 10 min (colchón 10 %) | 790 | 0 | 202 | 4 → 15 | 26 ms | 12 / 19 ms | 1.37 % |
| Pico 20→1,000 en 30 s (colchón 25 % + reserva) | 925 | 0 | 239 | 6 → 20 | 190 ms | 8 / 27 ms | 1.69 % |
| 200 jugadores + 500 espectadores | 200 | 500 | 50 | 20 → 21 | 28 ms | 11 / 41 ms | 0.15 % |

Gráficas: `docs/evidencias/20_prueba_rampa.png`, `21_prueba_pico.png`, `22_prueba_espectadores.png`, `23_curva_ccu_latencia.png` y `24_errores.png`. Hay capturas de Grafana en `33*_grafana_*.png` y de CloudWatch en `30*` a `35*.png`.

### Primer intento de rampa (colchón fijo de 5)

Se detuvo a los 7 minutos: **falló el 75 % de las solicitudes de partida** (1,158 de 1,546), porque los 5 servidores Ready se agotaban en segundos. Sus series de Prometheus se perdieron: el Cluster Autoscaler retiró el nodo donde vivía Prometheus, que no tenía volumen persistente. Se conservan las cifras finales del log de Locust (`loadtest/resultados/ramp_intento1/`).

### Capacidad máxima

La curva CCU contra RTT p95 se mantiene plana (10–40 ms) hasta unos 650 jugadores y **cruza la meta de 80 ms alrededor de 750 jugadores**, con 14 nodos activos. Eso da unos 54 jugadores por nodo, o unos 75 por nodo de juego si se descuentan los 4 nodos de Locust.

Por encima de ese punto:

- el nodo más cargado estaba al 88–95 % de CPU, porque la programación Packed llena cada nodo;
- el tick p99 llegó a 26.9 ms, por encima del presupuesto de 16.7 ms;
- los generadores de Locust llegaron a 0.73 núcleos, cerca de su límite, así que parte de la latencia puede venir de ellos.

### Tiempo de reacción (pico, desde que Locust supera 100 usuarios)

| Capa | Reacción medida |
|---|---|
| FleetAutoscaler (nuevos GameServers) | 18 s (las muestras son cada 15 s) |
| HPA del lobby (2 → 10 pods) | 48 s |
| Primeros pods pendientes | 48 s |
| Cluster Autoscaler, primer nodo nuevo | 138 s; luego varios nodos de golpe (10 → 20) |
| 90 % del CCU máximo | 243 s |

**Comparación de configuraciones:**

| Colchón del FleetAutoscaler | Resultado |
|---|---|
| 5 fijos | 75 % de solicitudes fallidas |
| 10 % | ~90 jugadores por minuto |
| 25 % + sobreaprovisionamiento (`k8s/overprovisioning.yaml`) | ~250 jugadores por minuto |

Solicitudes de partida fallidas (el bot reintenta, así que cuentan intentos y no jugadores perdidos):

- **Rampa:** 8,295 de 10,036. De ellas, 7,448 fueron esperas de 25 s sin servidor Ready (503) y 847 fueron errores 500 «timeout» del lobby, concentrados entre las 12:43:43 y las 12:44:43.
- **Pico:** 4,888 de 6,656, todas 503 sin servidor Ready.

Hubo 837 rechazos por «sala llena» en el pico: dos asignaciones simultáneas llegaban a la misma sala antes de que el servidor publicara que estaba completa.

### Espectadores (500 medidos, extrapolación a 20,000)

- Con 200 jugadores y 500 espectadores el tráfico estable fue de ~68.5 Mbps, es decir **~98 kbps por conexión**. No hubo fallos de conexión y el intervalo entre instantáneas fue p95 de 68 ms.
- **20,000 espectadores** ≈ 1.96 Gbps, 882 GB por hora, unos **US$79 por hora** de salida a Internet (US$0.09/GB).
- Con 4 pilotos por partida, 20,000 espectadores en 250 partidas son unos 80 por sala. Conviene un relé o una CDN de instantáneas.
- Los espectadores reciben instantáneas por **WebSocket**. **No se implementó streaming HLS.** Un stream de 4,500 kbps usaría unas 46 veces más ancho de banda.

## Tabla de líderes serverless

- 100 usuarios durante 3 minutos desde México (`loadtest/locust_leaderboard.py`): **12,864 peticiones a 71.8 por segundo**, p50 130 ms y p95 150 ms.
- Hubo 50 respuestas 503 (0.39 %) en el primer minuto. La cuenta tiene un **límite de 10 ejecuciones concurrentes de Lambda** (`aws lambda get-account-settings`).
- Pruebas funcionales en `docs/evidencias/salidas/serverless_pruebas.txt`.

## Costos

| Escenario | Nodos | US$/hora | US$ por jugador-hora | Notas |
|---|---|---|---|---|
| Reposo (sin jugadores) | 2 | 0.32 | - | Plano de control EKS, 2 nodos y balanceador del juego |
| Capacidad medida (p95 < 80 ms) | 10 | 1.04 | 0.0014 | ~750 CCU con 14 nodos activos, menos 4 dedicados a Locust |
| Pico medido (925 CCU) | 16 | 1.58 | 0.0017 | 20 nodos, menos 4 de Locust; p95 ya sobre 80 ms |
| 1,000 CCU (proyección) | 16 | 1.58 | 0.0016 | 75 CCU por nodo de juego + 2 de sistema |
| 10,000 CCU (proyección) | 136 | 12.43 | 0.0012 | Requiere ampliar la cuota de vCPU |

Comparación serverless contra servidor tradicional para la tabla de líderes: **US$1.45 por millón de consultas** contra **US$19.47 al mes** de una t3.small encendida 24/7.

## 5. Balance de la dificultad (simulador)

`scripts/balance.mjs` juega cientos de partidas sin gráficos con un bot y reporta hasta qué oleada llega. El bot evalúa 9 movimientos posibles prediciendo las trayectorias. Tiene dos perfiles:

| Perfil | Tiempo de reacción | Despistes | Representa |
|---|---|---|---|
| `novato` | 0.30 s | 20 % de las decisiones ignora las amenazas | jugador casual |
| `experto` | 0.15 s | 5 % | jugador hábil |

```bash
node scripts/balance.mjs 300 1 novato
node scripts/balance.mjs 80 1 experto
node scripts/balance.mjs 40 4 novato      # cooperativo de 4
```

**Proceso de calibración.** Para saber qué ajustar se midió qué dañaba al bot:
- La primera versión era demasiado dura al inicio: el novato llegaba en mediana a la oleada 5 y casi todos caían en las oleadas 3–5.
- La primera causa eran los **asteroides**. Se redujo su frecuencia y su velocidad al inicio.
- La segunda era el **primer jefe**. Se le bajó la vida y la velocidad, y se suavizó su ráfaga.
- La zona crítica (oleada 20+) se endureció un 15 % para que el final siga exigiendo a los expertos.

**Resultado final:**

| Perfil | Oleada promedio | Mediana | p90 | Duración media |
|---|---|---|---|---|
| Novato (individual) | 9.7 | 7 | 20 | 3.2 min |
| Experto (individual) | 32.3 | 34 | 44 | 11.4 min |
| 2 novatos (coop) | 13.8 | 15 | 24 | 5.6 min |
| 4 novatos (coop) | 20.2 | 25 | 33 | 9.6 min |

El cooperativo resulta algo más fácil a propósito: premia el trabajo en equipo gracias a la reaparición entre oleadas. Las cifras varían un poco entre ejecuciones porque las partidas son aleatorias.
