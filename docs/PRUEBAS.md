# Pruebas de carga y autoescalado

## Preparación

1. Ejecuta Locust **desde una instancia EC2 en la misma región** (por ejemplo c6i.xlarge). Así la red de tu casa no se vuelve el cuello de botella y la transferencia de datos sale más barata.
   ```bash
   pip install -r loadtest/requirements.txt
   export LOBBY=http://$(kubectl get svc astro-lobby -n astro -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
   mkdir -p loadtest/resultados
   ```
2. Usa `--processes -1` para aprovechar todos los núcleos del generador de carga.
3. **Capacidad del clúster:** cada GameServer pide 100m de CPU, y una t3.medium admite como máximo 17 pods. 1,000 jugadores en salas de 4 son unas 250 partidas, es decir, entre 17 y 20 nodos t3.medium. Antes de la prueba de pico:
   - Sube `node_max` (variable `NODE_MAX` en GitHub) a 20 o 25 y vuelve a ejecutar *apply*.
   - Revisa la **cuota de vCPU On-Demand** de tu cuenta (*Service Quotas → EC2 → Running On-Demand Standard instances*). Las cuentas nuevas y las de AWS Academy suelen tener límites bajos.
4. Abre Grafana (tablero *Astro Defender*) y el tablero `astro-defender` de CloudWatch, y toma capturas durante cada prueba.

## 1. Prueba de rampa

Sube 100 jugadores por minuto hasta llegar a 1,000, mantiene la carga 5 minutos y luego baja.

```bash
LOAD_SHAPE=ramp locust -f loadtest/locustfile.py --host $LOBBY --headless --processes -1 \
  --csv loadtest/resultados/rampa --html loadtest/resultados/rampa.html
```

**Qué observar:** cómo crecen en paralelo las réplicas del Fleet, los nodos y los jugadores; la latencia de asignación p95 y el RTT.

## 2. Prueba de pico (1,000 jugadores)

20 jugadores de base y luego 1,000 en unos 30 segundos.

```bash
LOAD_SHAPE=spike SPIKE_USERS=1000 locust -f loadtest/locustfile.py --host $LOBBY --headless \
  --processes -1 --csv loadtest/resultados/pico --html loadtest/resultados/pico.html
```

**Tiempo de reacción del autoescalado.** Mídelo con los paneles de Grafana:

| Métrica | Cómo se mide |
|---|---|
| Reacción del FleetAutoscaler | Momento del pico → momento en que *réplicas deseadas* empieza a subir. Esperado: ≤ 5 s (`sync.fixedInterval`) |
| Pods pendientes | Duración del intervalo con `pods pendientes > 0` |
| Reacción del Cluster Autoscaler | Primer pod `Pending` → nodo nuevo `Ready` (`kubectl get nodes -w`). Suele tardar de 1.5 a 3 min por el arranque de EC2 |
| Impacto en el jugador | Latencia de asignación p95 (`astro_lobby_allocation_seconds`) y fallos de `/api/match` (503 cuando se agotan los 25 s de reintentos) |
| Reducción | Al terminar: tiempo hasta que bajan las réplicas y luego los nodos (`scale-down-unneeded-time = 3m`) |

Comando útil para registrar eventos con hora: `kubectl get events -A -w --field-selector reason=TriggeredScaleUp`.

## 3. Espectadores (500 medidos, extrapolados a 20,000)

```bash
LOAD_SHAPE=spectators PLAYERS=200 SPECTATORS=500 locust -f loadtest/locustfile.py --host $LOBBY \
  --headless --processes -1 --csv loadtest/resultados/espectadores --html loadtest/resultados/espectadores.html
```

Toma estos valores de Grafana (en promedio, durante la meseta):

- `B` = bytes enviados por segundo por espectador: `sum(rate(astro_ws_bytes_sent_total[1m])) / (jugadores + espectadores)`
- `C` = CPU adicional por espectador en el GameServer (compara la CPU por pod antes y después de que lleguen los espectadores)
- `I` = intervalo entre snapshots p95 (en Locust) y tick p99. Sirven para comprobar que la calidad no se degrada.

**Extrapolación a 20,000 espectadores**, con valores de ejemplo (sustitúyelos por los medidos):

| Concepto | Fórmula | Ejemplo con B = 25 KB/s y C = 2 m de CPU |
|---|---|---|
| Ancho de banda total | 20,000 × B | 500 MB/s ≈ 4 Gbps |
| Transferencia por hora | 20,000 × B × 3,600 | ≈ 1.8 TB/h, unos USD 160/h a USD 0.09/GB |
| CPU adicional | 20,000 × C | 40 vCPU, unos 20 nodos t3.medium solo para difundir |

**Conclusión esperada:** con espectadores conectados directamente al GameServer, el ancho de banda y el *fan-out* crecen linealmente con cada partida. Para 20,000 espectadores conviene:

1. Separar los espectadores en un **nivel de relay**: un Deployment con HPA que recibe un solo flujo por partida y lo replica.
2. Bajar la frecuencia a 10 Hz para espectadores y añadir un **retraso de 2 a 5 s**, lo que permite agrupar y comprimir los datos.
3. Usar compresión (`permessage-deflate`) o snapshots delta: un 60–80 % menos de bytes.

## 4. Latencia y concurrencia

El reporte HTML de Locust de cada prueba incluye:

- `WS rtt (ping/pong)`: latencia de ida y vuelta jugador ↔ GameServer (p50, p95, p99).
- `WS intervalo entre snapshots`: debe mantenerse cerca de 50 ms. Si sube, el servidor está saturado.
- `/api/match`: latencia de asignación vista por el cliente.
- Concurrencia: usuarios activos de Locust frente a `astro_players_connected` en Grafana.

## Plantilla de resultados (para el reporte)

| Prueba | Usuarios máx. | Partidas máx. | Nodos (min → máx) | RTT p95 | Asignación p95 | Fallos | Reacción FleetAutoscaler | Reacción Cluster Autoscaler |
|---|---|---|---|---|---|---|---|---|
| Rampa | 1,000 | | | | | | | |
| Pico | 1,000 | | | | | | | |
| Espectadores | 200 + 500 | | | | | | | |

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
