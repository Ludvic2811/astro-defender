"""Genera el reporte técnico (máx. 6 páginas) en Word a partir de los resultados reales.
Uso: python scripts/evidencias/generar-reporte.py  -> entregables/Reporte_tecnico_Astro_Defender.docx
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from docx_base import Reporte  # noqa: E402

EV = "docs/evidencias"
R = json.load(open(f"{EV}/resultados.json", encoding="utf-8"))
C = json.load(open(f"{EV}/costos.json", encoding="utf-8"))
OUT = "entregables/Reporte_tecnico_Astro_Defender.docx"


def g(prueba, clave, fmt="{:,.0f}", nd="n/d"):
    v = R.get(prueba, {}).get(clave)
    if v is None:
        return nd
    return fmt.format(v)


def img(nombre):
    return f"{EV}/{nombre}"


rep = Reporte(tam_texto=9.5)
d = rep.doc

# ------------------------------------------------------------------ portada compacta
rep.titulo("Astro Defender: Invasión Galáctica", 0)
rep.p("Reporte técnico del proyecto integrador · Unidad 3: Infraestructura y despliegue de videojuegos en la nube",
      negrita_inicial="", alin=0, tam=10.5)
rep.p("Cómputo en la Nube · Instituto Tecnológico de Colima · 16 de noviembre de 2026 · "
      "Repositorio: github.com/Ludvic2811/astro-defender", alin=0, tam=9)

rep.titulo("1. Introducción")
rep.p("Este reporte documenta el «día de lanzamiento» de Astro Defender, el videojuego del equipo, siguiendo el proyecto "
      "integrador de la unidad (originalmente planteado con Nebula Arena en Google Cloud). Se usó Amazon Web Services: "
      "la infraestructura se creó con Terraform, el servidor se desplegó con un pipeline de GitHub Actions en una flota "
      "de Agones sobre Amazon EKS, la tabla de líderes es serverless (API Gateway, Lambda y DynamoDB) y se midió con "
      "Locust cuántos jugadores y espectadores soporta la plataforma. Todas las cifras de este documento provienen de "
      "ejecuciones reales del 16 de noviembre de 2026; la infraestructura se destruyó al terminar para no generar costos.")

rep.titulo("2. Descripción del videojuego")
rep.p("Astro Defender es un juego de naves 2D para navegador (Phaser 3) con oleadas infinitas, cinco tipos de enemigo, "
      "un jefe cada cinco oleadas, poderes, combo y cartas de mejora. Se juega solo o en cooperativo de 2 a 4 pilotos, y "
      "cualquier persona puede entrar como espectador. Los sprites de la nave, el ovni y el asteroide son dibujos "
      "originales del equipo. El servidor es autoritativo: simula a 60 Hz, recibe solo los controles y difunde 20 "
      "instantáneas por segundo; el cliente interpola con 100 ms de búfer y predice su propia nave.")
rep.figuras_lado([
    (img("26b_aws_menu_principal.png"), "Menú principal servido desde AWS."),
    (img("04_enemigos_oleada_12.png"), "Oleada 12 con varios tipos de enemigo."),
    (img("26_aws_sala_cooperativa_agones.png"), "Sala cooperativa en AWS: el código LJ7RC es el GameServer de Agones asignado."),
])

rep.titulo("3. Arquitectura de infraestructura en AWS")
rep.p("El jugador descarga el juego desde el lobby (Deployment de Kubernetes detrás de un Elastic Load Balancer). Al pedir "
      "partida, el lobby crea un GameServerAllocation y Agones le entrega un servidor dedicado; desde ahí el navegador se "
      "conecta por WebSocket directamente al puerto del nodo (rango 7000-8000). Los nodos son instancias EC2 t3.large de "
      "un grupo administrado en dos zonas de disponibilidad, en subredes públicas sin NAT para abaratar el tráfico. Las "
      "imágenes viven en Amazon ECR y la tabla de líderes es independiente del clúster.")
rep.figura(img("../diagramas/arquitectura.png"),
           "Arquitectura desplegada: EKS 1.35 con Agones 1.60, autoescalado en tres niveles, monitoreo y servicios serverless.",
           ancho_cm=16.5)

rep.titulo("4. Docker, Kubernetes y Agones")
rep.p("El servidor y el lobby se empaquetan en imágenes Docker de Node.js 22 (~250 MB). El servidor integra el SDK de "
      "Agones por el sidecar REST: marca Ready al arrancar, Allocated al asignarse, publica etiquetas (jugadores, oleada, "
      "estado) y se apaga solo cuando la sala queda vacía, lo que devuelve la capacidad a la flota. La Fleet usa "
      "programación Packed para concentrar partidas en pocos nodos, y su RollingUpdate solo reemplaza servidores Ready: "
      "las partidas Allocated terminan con la versión anterior, así que un despliegue no corta partidas.")
rep.tabla(["Componente", "Réplicas", "CPU solicitada / límite", "Memoria", "Escalado"], [
    ["GameServer (Fleet de Agones)", "5 a 300", "50m / 500m (+10m sidecar)", "96 Mi / 256 Mi", "FleetAutoscaler, colchón 25 %"],
    ["Lobby (Deployment)", "2 a 10", "100m / 500m", "96 Mi / 256 Mi", "HPA al 60 % de CPU"],
    ["Nodos EC2 t3.large", "2 a 20", "2 vCPU, 35 pods por nodo", "8 GiB", "Cluster Autoscaler"],
], pie="Recursos definidos (medido: una partida de 4 pilotos usa ~"
       f"{g('ramp', 'cpu_por_gameserver_m', '{:.0f}')}m de CPU y ~56 MB).", anchos_cm=[4.6, 2, 4.3, 2.8, 4.1])
rep.figuras_lado([
    (img("19_agones_gameservers_inicial.png"), "Fleet, FleetAutoscaler, GameServers (Ready/Allocated) y HPA en EKS."),
    (img("27_aws_partida_cooperativa.png"), "Partida cooperativa de dos pilotos sobre un GameServer de AWS."),
])

rep.titulo("5. Terraform y CI/CD")
rep.p("Terraform crea y destruye todo: VPC, EKS, grupo de nodos, ECR, roles IAM (incluido el rol OIDC de GitHub), "
      "Agones, Prometheus/Grafana, metrics-server y Cluster Autoscaler vía Helm, Lambda, API Gateway, DynamoDB, el "
      "tablero y la alarma de CloudWatch, y un presupuesto de AWS Budgets de US$20 con alertas por correo. El estado es "
      "remoto en S3 con bloqueo nativo (use_lockfile) y hay variables por entorno (env/dev.tfvars y env/prod.tfvars). "
      "El primer apply creó 88 recursos en ~25 min; un corte de DNS de la red local interrumpió el final, el estado "
      "quedó a salvo en S3 y un segundo apply completó los 7 recursos faltantes.")
rep.p("GitHub Actions tiene tres flujos: CI (pruebas, construcción Docker, terraform validate y locustfile), Deploy "
      "(pruebas → imágenes etiquetadas con el commit → push a ECR → kubectl apply de la Fleet, el lobby y los monitores) "
      "e Infraestructura (plan/apply/destroy manual). Deploy no guarda llaves de AWS: obtiene credenciales temporales por "
      "OIDC con un rol limitado a ECR y a describir el clúster. Durante el día se hicieron cinco despliegues reales.")
rep.figuras_lado([
    (img("13b_github_actions_deploy.png"), "Pipeline Deploy en verde: pruebas y publicación en ECR/EKS."),
    (img("15_terraform_apply.png"), "terraform apply con estado remoto y salidas."),
])

rep.titulo("6. Autoescalado y monitoreo")
rep.p("El autoescalado trabaja en tres capas: el FleetAutoscaler de Agones mantiene un colchón de servidores Ready, el "
      "HPA ajusta los pods del lobby por CPU y el Cluster Autoscaler agrega o retira nodos EC2 cuando hay pods sin lugar. "
      "Prometheus (kube-prometheus-stack) recoge las métricas propias del juego (jugadores, espectadores, duración del "
      "tick, bytes enviados, asignaciones y su latencia) junto con las de Agones, kube-state-metrics y node-exporter; "
      "Grafana las muestra en un tablero de 16 paneles. CloudWatch guarda las métricas de Lambda, API Gateway, DynamoDB "
      "y Container Insights.")
rep.figura(img("33_grafana_pico.png"),
           "Tablero de Grafana durante la prueba de pico: jugadores, GameServers por estado, nodos, réplicas del lobby, "
           "latencia de asignación y tick p99.", ancho_cm=15.5)

rep.titulo("7. Tabla de líderes serverless")
L = R.get("lideres", {})
rep.p(f"La API HTTP de API Gateway invoca una Lambda (Node.js 22) que valida y guarda puntuaciones en DynamoDB bajo "
      f"demanda, con un índice global por modo. Se probó funcionalmente (alta, consulta y rechazo de datos inválidos con "
      f"HTTP 400) y bajo carga con 100 usuarios durante 3 minutos: {L.get('peticiones', 0):,} peticiones a "
      f"{L.get('rps', 0)} por segundo, p50 de {L.get('p50_ms', 0):.0f} ms y p95 de {L.get('p95_ms', 0):.0f} ms "
      f"desde México. Hubo {L.get('fallos', 0)} respuestas 503 ({100 * L.get('fallos', 0) / max(L.get('peticiones', 1), 1):.2f} %) "
      "en el primer minuto: la cuenta tiene un límite de 10 ejecuciones concurrentes de Lambda, que se debe ampliar antes "
      "de un lanzamiento real.")
rep.figuras_lado([
    (img("30_cloudwatch_lambda_invocaciones.png"), "CloudWatch: invocaciones y throttles de Lambda durante la prueba."),
    (img("31_cloudwatch_latencia_api.png"), "CloudWatch: latencia p95 de API Gateway y duración de Lambda."),
])
rep.tabla(["Concepto", "Serverless (medido)", "Servidor tradicional"], [
    ["Costo con 1 millón de consultas al mes", f"US${C['serverless_millon']:.2f}", f"US${C['ec2_mes']:.2f} (t3.small 24/7 + disco)"],
    ["Costo en reposo", "US$0 (paga por uso)", f"US${C['ec2_mes']:.2f} al mes"],
    ["Escalado y parches", "Automático, administrado por AWS", "Manual o con autoescalado propio"],
], pie="Comparación de costos de la tabla de líderes (precios de us-east-1).", anchos_cm=[5.5, 5.5, 6.6])

rep.titulo("8. Resultados de las pruebas de carga")
rep.p("Locust corrió dentro del clúster (un maestro y 10 workers) para no depender del ancho de banda de una "
      "computadora personal; los bots siguen el camino de un jugador real: piden partida al lobby por su URL pública y "
      "se conectan por WebSocket al puerto público del GameServer. Cada bot envía controles cada 200 ms y un ping por "
      "segundo; el RTT medido es la latencia del ciclo completo jugador-servidor. Los espectadores reciben las mismas "
      "instantáneas por WebSocket; no hay streaming de video HLS.")
filas = []
for clave, nombre in (("ramp_intento1", "Rampa, intento 1 (colchón fijo de 5)"), ("ramp", "Rampa hasta 1,000 (colchón 10 %)"),
                      ("spike", "Pico de 1,000 en 30 s (colchón 25 % + reserva)"), ("spectators", "200 jugadores + 500 espectadores")):
    if clave in R:
        x = R[clave]
        filas.append([nombre, g(clave, "ccu_max"), g(clave, "espectadores_max"), g(clave, "gs_allocated_max"),
                      f"{g(clave, 'nodos_inicio')} → {g(clave, 'nodos_max')}",
                      g(clave, "rtt_p95_carga_max_ms", "{:.0f} ms"), g(clave, "tick_p99_max_ms", "{:.1f} ms"),
                      g(clave, "match_fallos", "{:,.0f}") + " / " + g(clave, "match_n", "{:,.0f}")])
rep.tabla(["Prueba", "CCU máx.", "Espect.", "GS asignados", "Nodos", "RTT p95", "Tick p99 máx.", "Asignaciones fallidas"],
          filas, pie="Resultados medidos (Prometheus + Locust). Una asignación fallida se reintenta; el jugador entra después.",
          anchos_cm=[4.6, 1.5, 1.4, 1.8, 1.6, 1.6, 1.9, 3.2], tam=7.5)
rep.figuras_lado([
    (img("20_prueba_rampa.png"), "Rampa: usuarios, GameServers por estado, nodos/pods del lobby y latencias."),
    (img("21_prueba_pico.png"), "Pico: reacción de las tres capas de autoescalado."),
])
rep.figuras_lado([
    (img("23_curva_ccu_latencia.png"), "Curva CCU contra latencia p95 (meta de 80 ms)."),
    (img("24_errores.png"), "Errores por segundo en cada prueba."),
])

rep.titulo("9. Capacidad máxima y tiempo de reacción")
rep.p(C["texto_capacidad"])
rep.p(C["texto_reaccion"])
rep.p(C["texto_espectadores"])

rep.titulo("10. Costos por hora y por jugador")
rep.tabla(["Escenario", "Nodos", "US$/hora", "US$ por jugador-hora", "Notas"], C["tabla"],
          pie="Costo estimado con precios bajo demanda de us-east-1 (EKS US$0.10/h, t3.large US$0.0832/h, ELB, IPv4 y EBS).",
          anchos_cm=[4.2, 1.5, 1.8, 3.2, 6.9], tam=7.5)
rep.p(C["texto_costos"])

rep.titulo("11. Recomendaciones y conclusiones")
rep.vinetas(C["recomendaciones"])
rep.p(C["conclusion"])

os.makedirs("entregables", exist_ok=True)
rep.guardar(OUT)
print("Reporte:", OUT, "figuras:", rep.fig, "tablas:", rep.tab)
