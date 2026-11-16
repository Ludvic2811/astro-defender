# Arquitectura

```mermaid
flowchart LR
  subgraph Navegador
    P[Jugador / Espectador<br/>Phaser 3]
  end

  subgraph AWS["AWS (us-east-1)"]
    subgraph EKS["Amazon EKS – nodos EC2 en subredes públicas"]
      LB[Service LoadBalancer] --> L[Lobby x2..10<br/>web + matchmaker<br/>HPA por CPU]
      L -- GameServerAllocation --> AG[Agones controller]
      AG --> F[Fleet astro-fleet<br/>GameServers Node.js + WS]
      FA[FleetAutoscaler<br/>Buffer 5] --> F
      CA[Cluster Autoscaler] -. agrega/quita nodos EC2 .-> EKS
      PR[Prometheus] --> G[Grafana]
    end
    ECR[(Amazon ECR)]
    APIGW[API Gateway HTTP] --> LAM[Lambda leaderboard] --> DDB[(DynamoDB)]
    CW[CloudWatch<br/>Container Insights, logs, tablero]
  end

  GH[GitHub Actions] -- docker push --> ECR
  GH -- terraform apply --> AWS
  GH -- kubectl apply --> EKS
  P -- HTTP --> LB
  P -- WebSocket ws://IP-nodo:puerto --> F
  P -- HTTPS --> APIGW
```

## Flujo de una partida

1. El navegador descarga el juego del **lobby** a través del balanceador de carga.
2. **Individual:** la simulación (`shared/sim.js`) corre en el navegador a 60 pasos por segundo. No consume servidores.
3. **Cooperativo:** el lobby crea un `GameServerAllocation`:
   - *Partida rápida:* primero busca un GameServer `Allocated` con la etiqueta `agones.dev/sdk-joinable=true` y sin la etiqueta `private`. Si no hay ninguno, toma uno `Ready`.
   - *Sala privada:* toma uno `Ready` y le pone la etiqueta `private=true`.
   - *Unirse con código:* el código son los últimos 5 caracteres del nombre del GameServer.
4. Agones responde con la IP pública del nodo y el puerto dinámico (rango 7000–8000). El navegador se conecta directo por **WebSocket**.
5. El servidor es **autoritativo**: recibe solo los controles y las acciones puntuales (`bomb` y `pick` para elegir carta), simula a 60 Hz y envía *snapshots* a 20 Hz. El cliente interpola los snapshots (100 ms de búfer) y predice el movimiento de su propia nave, incluida la mejora de velocidad.
   - Tras cada jefe la simulación entra en la fase `upgrade`: cada piloto recibe 3 cartas, y la partida sigue cuando todos eligen o, en cooperativo, tras 20 s, con elección automática para los que falten.
   - Para acotar el tamaño de los snapshots y el ancho de banda hay topes por oleada: 45 enemigos (+5 por piloto extra), 300 balas, 16 asteroides y 10 poderes.
6. El servidor informa a Agones con `Ready`, `Health` cada 2 s y las etiquetas `joinable`, `players`, `state` y `wave`. Cuando la sala se vacía llama a `Shutdown`, y Agones lo reemplaza por uno nuevo.
7. Al terminar, el cliente envía la puntuación a **API Gateway → Lambda → DynamoDB**. En cooperativo la envía solo el anfitrión. La tabla usa el índice `ByMode` (partición `mode`, orden `score`) para consultar el top 10.

## Autoescalado en tres niveles

| Nivel | Mecanismo | Qué escala | Señal |
|---|---|---|---|
| Partidas | **FleetAutoscaler** (Agones, Buffer = 5) | GameServers (pods) | Mantener siempre 5 servidores `Ready` libres |
| Web/matchmaking | **HorizontalPodAutoscaler** | Pods del lobby (2 a 10) | CPU > 60 % |
| Infraestructura | **Cluster Autoscaler** | Nodos EC2 del node group | Pods en `Pending` por falta de espacio, o nodos infrautilizados |

Agones marca los pods de las partidas asignadas como no desalojables. Así, el Cluster Autoscaler nunca elimina un nodo con una partida en curso. `scheduling: Packed` agrupa las partidas en pocos nodos para que los demás puedan retirarse.

## Monitoreo

- **Prometheus + Grafana** (kube-prometheus-stack): métricas propias (`astro_*`) del servidor y del lobby, métricas de Agones (`agones_gameservers_count`, `agones_fleet_autoscalers_*`), de nodos y de pods. Tablero: `monitoring/grafana-dashboard.json`.
- **CloudWatch:** Container Insights (CPU y memoria de nodos, número de nodos), logs del plano de control de EKS, métricas de Lambda, API Gateway y DynamoDB, un tablero `astro-defender` y una alarma de errores de Lambda.

## Decisiones de diseño

- **Una simulación compartida** para el navegador y el servidor: menos código y el mismo comportamiento en los dos modos.
- **Nodos en subredes públicas, sin NAT Gateway:** Agones expone los puertos en la IP del nodo, y quitar el NAT ahorra unos USD 32/mes.
- **El lobby usa la API de Kubernetes directamente** (ServiceAccount + RBAC mínimo). No hace falta exponer el servicio *allocator* de Agones.
- **HTTP en el juego:** las conexiones van a `ws://IP:puerto` de cada nodo, y una página HTTPS no puede abrir WebSockets sin TLS. Para usar HTTPS haría falta un proxy TLS delante de los GameServers o certificados por nodo. Queda como trabajo futuro.
- **Trabajo futuro:** usar *Counters* de Agones para reservar lugares de forma atómica en partida rápida; publicar los datos para espectadores mediante un relay o CDN (ver [PRUEBAS.md](PRUEBAS.md)).
