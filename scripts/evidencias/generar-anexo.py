"""Genera el anexo de evidencias y pruebas (Word) a partir de los resultados y capturas reales.
Uso: python scripts/evidencias/generar-anexo.py  -> entregables/Anexo_evidencias_y_pruebas.docx
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from docx_base import Reporte  # noqa: E402

EV = "docs/evidencias"
R = json.load(open(f"{EV}/resultados.json", encoding="utf-8"))
C = json.load(open(f"{EV}/costos.json", encoding="utf-8"))
OUT = "entregables/Anexo_evidencias_y_pruebas.docx"
r, p, e, lid = R["ramp"], R["spike"], R["spectators"], R["lideres"]


def n(v, f="{:,.0f}"):
    return f.format(v) if v is not None else "n/d"


def img(nombre):
    return f"{EV}/{nombre}"


a = Reporte(tam_texto=9.5)
F = a.figura
L = a.figuras_lado

# ------------------------------------------------------------------ portada
a.titulo("Anexo: evidencias y pruebas", 0)
a.p("Astro Defender: Invasión Galáctica · Proyecto integrador de la Unidad 3", alin=0, tam=11)
a.p("Equipo: Luis Sambrano Mendoza y Manuel Sambrano Mendoza", alin=0, tam=10)
a.p("Cómputo en la Nube · Instituto Tecnológico de Colima · 16 de noviembre de 2026 · "
    "Repositorio: github.com/Ludvic2811/astro-defender", alin=0, tam=9)
a.p("Este anexo acompaña al reporte técnico (máximo 6 páginas) y reúne el detalle que no cabe ahí: la metodología y "
    "los resultados completos de las pruebas, y todas las capturas organizadas por tema. Todo proviene de ejecuciones "
    "reales del 16 de noviembre de 2026: capturas automáticas con Playwright, salidas de comandos (aws, kubectl, "
    "terraform), gráficas renderizadas por CloudWatch y gráficas hechas con los CSV de Locust y Prometheus. El número "
    "de cuenta de AWS y los correos están ocultos. Los archivos originales están en docs/evidencias/ y "
    "loadtest/resultados/ del repositorio.")
a.tabla(["Sección", "Contenido", "Criterio de la rúbrica"], [
    ["A1", "Pruebas automáticas y de humo", "Contenedores; CI/CD"],
    ["A2-A3", "Metodología y resumen de las pruebas de carga", "Métricas y pruebas de carga"],
    ["A4", "Prueba de rampa", "Autoescalado; métricas"],
    ["A5", "Prueba de pico y tiempos de reacción", "Autoescalado"],
    ["A6", "Espectadores y extrapolación a 20,000", "Métricas y pruebas de carga"],
    ["A7", "Curva CCU-latencia, errores y capacidad máxima", "Métricas y pruebas de carga"],
    ["A8", "Tabla de líderes serverless bajo carga", "CI/CD y serverless"],
    ["A9-A10", "Costos y balance del juego", "Comunicación"],
    ["B1-B2", "Capturas del videojuego (local y en AWS)", "Comunicación; contenedores"],
    ["B3", "GitHub y GitHub Actions", "CI/CD"],
    ["B4", "Terraform: plan, apply y destroy", "Infraestructura como código"],
    ["B5-B6", "EKS, EC2, ECR, Kubernetes y Agones", "Contenedores y orquestación"],
    ["B7-B8", "Serverless, Grafana y CloudWatch", "CI/CD y serverless; métricas"],
], pie="Contenido del anexo.", anchos_cm=[1.8, 8.6, 7.2])
a.salto()

# ================================================================== PARTE A
a.titulo("Parte A. Pruebas")
a.titulo("A1. Pruebas automáticas y de humo", 2)
a.p("Las mismas pruebas corren en GitHub Actions en cada push: 22 de la lógica del juego y la sala multijugador, 1 "
    "del matchmaker del lobby y 3 de la API de líderes, las 26 en verde. La prueba de humo levanta una partida real "
    "con dos pilotos y un espectador; se ejecutó en local con Docker y contra la URL pública de AWS.")
F(img("37_pruebas_automaticas.png"), "Salida de las 26 pruebas automáticas.", 15)
L([(img("11_docker_contenedores.png"), "Prueba de humo local con docker compose."),
   (img("19c_agones_allocated_aws.png"), "Prueba de humo en AWS: Agones asigna un GameServer.")])

a.titulo("A2. Metodología de las pruebas de carga", 2)
a.vinetas([
    ("Generador: ", "Locust 2.47 dentro del clúster EKS (1 maestro y 10 workers, k8s/loadtest/locust.yaml), para no "
     "depender del ancho de banda de una computadora personal."),
    ("Camino real del jugador: ", "cada bot pide partida al lobby por su URL pública (balanceador) y se conecta por "
     "WebSocket al puerto público del GameServer que asigna Agones."),
    ("Comportamiento: ", "controles cada 200 ms, un ping por segundo (RTT jugador↔servidor), bombas y cartas al azar; "
     "el anfitrión inicia la partida y la reinicia al perder."),
    ("Métricas: ", "Prometheus del clúster (jugadores, espectadores, GameServers por estado, nodos, réplicas del lobby, "
     "tick p50/p99, latencia de asignación, tráfico y CPU), descargadas con scripts/evidencias/metricas-prometheus.py."),
    ("Clúster: ", "nodos t3.large (2 a 20; la cuota de la cuenta se subió de 32 a 64 vCPU), GameServer con 50m de CPU "
     "más 10m del sidecar de Agones."),
])

a.titulo("A3. Resumen de resultados", 2)
a.tabla(["Prueba", "CCU máx.", "Espect.", "Partidas", "Nodos", "RTT p95 en CCU máx.", "Tick p99 mediana / máx.", "Errores"], [
    ["Rampa 0→1,000 en 10 min (colchón 10 %)", n(r["ccu_max"]), "0", n(r["gs_allocated_max"]),
     f"{n(r['nodos_inicio'])} → {n(r['nodos_max'])}", f"{n(r['rtt_p95_ccu_max_ms'])} ms",
     f"{n(r['tick_p99_mediana_ms'])} / {n(r['tick_p99_max_ms'])} ms", f"{r['error_pct']} %"],
    ["Pico 20→1,000 en 30 s (colchón 25 % + reserva)", n(p["ccu_max"]), "0", n(p["gs_allocated_max"]),
     f"{n(p['nodos_inicio'])} → {n(p['nodos_max'])}", f"{n(p['rtt_p95_ccu_max_ms'])} ms",
     f"{n(p['tick_p99_mediana_ms'])} / {n(p['tick_p99_max_ms'])} ms", f"{p['error_pct']} %"],
    ["200 jugadores + 500 espectadores", n(e["ccu_max"]), n(e["espectadores_max"]), n(e["gs_allocated_max"]),
     f"{n(e['nodos_inicio'])} → {n(e['nodos_max'])}", f"{n(e['rtt_p95_ccu_max_ms'])} ms",
     f"{n(e['tick_p99_mediana_ms'])} / {n(e['tick_p99_max_ms'])} ms", f"{e['error_pct']} %"],
], pie="Resultados medidos. Errores: fallos sobre todas las peticiones y mensajes registrados por Locust.",
    anchos_cm=[5.0, 1.4, 1.3, 1.5, 1.5, 2.2, 2.6, 1.6], tam=7.5)
a.p("Un primer intento de rampa con colchón fijo de 5 servidores se detuvo a los 7 minutos: falló el 75 % de las "
    "solicitudes de partida (1,158 de 1,546). Sus series de Prometheus se perdieron porque el Cluster Autoscaler retiró "
    "el nodo de Prometheus (sin volumen persistente); se conservan las cifras del log de Locust.")

a.titulo("A4. Prueba de rampa (0 → 1,000 jugadores simulados)", 2)
a.p(f"Se agregaron 100 bots por minuto durante 10 minutos y se sostuvieron 1,000 durante 3 minutos. Los jugadores "
    f"conectados llegaron a {n(r['ccu_max'])} en {n(r['gs_allocated_max'])} partidas; los nodos pasaron de "
    f"{n(r['nodos_inicio'])} a {n(r['nodos_max'])} y el lobby de {n(r['lobby_min'])} a {n(r['lobby_max'])} pods. Con un "
    "colchón de 10 % entraban unos 90 jugadores por minuto: el ritmo lo marcaba la creación de partidas nuevas.")
F(img("20_prueba_rampa.png"), "Rampa: usuarios, GameServers por estado, nodos y pods del lobby, y latencias.", 15)
F(img("39a_locust_ramp_tablas.png"), "Reporte de Locust de la rampa: peticiones, percentiles y fallos.", 16.5)
a.p(f"Desglose de fallos de la rampa (Locust): 7,448 respuestas 503 «no hay servidores» (espera de 25 s sin servidor "
    f"Ready; el bot reintenta), 847 respuestas 500 «timeout» del lobby concentradas en un minuto (12:43:43-12:44:43) y "
    f"{n(r['sala_llena_n'])} rechazos por «sala llena».", tam=8.5)
F(img("39b_locust_ramp_graficas.png"), "Gráficas de Locust de la rampa: peticiones por segundo, tiempos de respuesta y usuarios.", 15)
F(img("33b_grafana_rampa_recorte.png"), "Grafana al final de la rampa: 784 jugadores, 176 partidas, 14 nodos y 9 pods del lobby.", 15)
F(img("34_cloudwatch_nodos_eks.png"), "CloudWatch Container Insights: nodos de EKS durante la rampa (7 a 18).", 15)

a.titulo("A5. Prueba de pico (20 → 1,000 en 30 s)", 2)
a.p("Antes del pico se subió el colchón del FleetAutoscaler a 25 % y se agregaron pods de sobreaprovisionamiento "
    "(prioridad negativa) que reservan dos nodos. La reacción se mide desde que Locust supera 100 usuarios.")
a.tabla(["Capa", "Reacción medida"], [
    ["FleetAutoscaler (nuevos GameServers)", f"{n(p['reac_fleet_s'])} s (las muestras son cada 15 s)"],
    ["HPA del lobby (2 → 10 pods)", f"{n(p['reac_hpa_s'])} s"],
    ["Primeros pods pendientes", f"{n(p['reac_pendientes_s'])} s"],
    ["Cluster Autoscaler: primer nodo nuevo", f"{n(p['reac_nodo_s'])} s; luego varios de golpe "
                                              f"({n(p['nodos_al_iniciar_carga'])} → {n(p['nodos_max'])})"],
    ["90 % del CCU máximo", f"{n(p['reac_ccu90_s'])} s"],
], pie="Tiempo de reacción del autoescalado en el pico.", anchos_cm=[7.5, 10.1])
F(img("21_prueba_pico.png"), "Pico: reacción de las tres capas de autoescalado.", 15)
F(img("40a_locust_spike_tablas.png"), "Reporte de Locust del pico.", 16.5)
a.p(f"Fallos del pico: {n(p['match_fallos'])} respuestas 503 «no hay servidores» y {n(p['sala_llena_n'])} rechazos "
    "por «sala llena» (dos asignaciones simultáneas llegaban a la misma sala antes de que el servidor publicara que "
    "estaba completa).", tam=8.5)
F(img("40b_locust_spike_graficas.png"), "Gráficas de Locust del pico.", 15)
F(img("33_grafana_pico.png"), "Grafana completo durante el pico: 925 jugadores, 222 partidas, 19 nodos y 10 pods del lobby.", 15)
F(img("34b_cloudwatch_nodos_pico.png"), "CloudWatch: reducción de nodos tras la rampa (18 a 6) y nuevo aumento en el pico (hasta 20).", 15)

a.titulo("A6. Espectadores (500 medidos, extrapolación a 20,000)", 2)
a.p(f"Primero se crearon partidas con 200 jugadores y luego llegaron 500 espectadores, que eligen una partida pública "
    f"y reciben las mismas instantáneas por WebSocket. No hubo fallos de conexión de espectadores; el intervalo entre "
    f"instantáneas fue p95 de 68 ms. El tráfico estable fue de ~68.5 Mbps, es decir ~{n(C['kbps_por_espectador'])} kbps "
    f"por conexión. Extrapolado a 20,000 espectadores: ~{20000 * C['kbps_por_espectador'] / 1e6:.2f} Gbps, "
    f"{n(C['egress_20k_gb_h'])} GB por hora y unos US${n(C['egress_20k_usd_h'])} por hora de salida a Internet. "
    "No se implementó streaming HLS; un video de 4,500 kbps usaría unas "
    f"{4500 / C['kbps_por_espectador']:.0f} veces más ancho de banda. Fallos de esta prueba: 179 respuestas 503, "
    "191 rechazos por «sala llena», 26 conexiones sin respuesta y 2 respuestas 500 de la API de Agones.")
F(img("22_prueba_espectadores.png"), "200 jugadores y 500 espectadores.", 15)
F(img("41a_locust_spectators_tablas.png"), "Reporte de Locust de la prueba de espectadores.", 16.5)
F(img("41b_locust_spectators_graficas.png"), "Gráficas de Locust de la prueba de espectadores.", 15)
F(img("33c_grafana_espectadores.png"), "Grafana con 500 espectadores conectados.", 15)

a.titulo("A7. Curva CCU-latencia, errores y capacidad máxima", 2)
F(img("23_curva_ccu_latencia.png"), "Curva CCU contra RTT p95 (rampa, pico y espectadores; meta de 80 ms).", 15.5)
a.p(C["texto_capacidad"])
F(img("24_errores.png"), "Errores por segundo en cada prueba (Locust).", 15.5)
F(img("35_cloudwatch_cpu_nodos.png"), "CloudWatch Container Insights: CPU promedio y del nodo más cargado.", 15)

a.titulo("A8. Tabla de líderes serverless", 2)
a.p(f"Pruebas funcionales contra la API en AWS (alta, consulta y rechazo de datos inválidos con HTTP 400) y prueba "
    f"de carga desde México con 100 usuarios durante 3 minutos: {n(lid['peticiones'])} peticiones a {lid['rps']} por "
    f"segundo, p50 de {n(lid['p50_ms'])} ms y p95 de {n(lid['p95_ms'])} ms. Las {lid['fallos']} respuestas 503 "
    "(0.39 %) se deben al límite de 10 ejecuciones concurrentes de Lambda de la cuenta.")
F(img("42_serverless_pruebas_funcionales.png"), "Pruebas funcionales de la API de líderes.", 16)
F(img("38_locust_tabla_lideres.png"), "Resumen de Locust de la prueba de carga de la tabla de líderes.", 16.5)
F(img("30_cloudwatch_lambda_invocaciones.png"), "CloudWatch: invocaciones, throttles y errores de Lambda.", 14)
L([(img("31_cloudwatch_latencia_api.png"), "CloudWatch: latencia p95 de API Gateway y duración de Lambda."),
   (img("32_cloudwatch_dynamodb.png"), "CloudWatch: capacidad consumida de DynamoDB.")])

a.titulo("A9. Costos", 2)
a.tabla(["Escenario", "Nodos", "US$/hora", "US$ por jugador-hora", "Notas"], C["tabla"],
        pie="Costo estimado con precios bajo demanda de us-east-1 (EKS US$0.10/h, t3.large US$0.0832/h, ELB, IPv4 y EBS).",
        anchos_cm=[4.2, 1.5, 1.8, 3.2, 6.9], tam=7.5)
a.p(f"Tabla de líderes: serverless cuesta ~US${C['serverless_millon']:.2f} por millón de consultas; un servidor "
    f"t3.small encendido todo el mes, ~US${C['ec2_mes']:.2f} aunque nadie juegue.")

a.titulo("A10. Balance de la dificultad (simulador)", 2)
a.p("scripts/balance.mjs juega cientos de partidas sin gráficos con un bot (perfiles novato y experto) y reporta hasta "
    "qué oleada llega. Cifras medidas durante el desarrollo del juego; varían un poco entre ejecuciones porque las "
    "partidas son aleatorias.")
a.tabla(["Perfil", "Oleada promedio", "Mediana", "p90", "Duración media"], [
    ["Novato (individual)", "9.7", "7", "20", "3.2 min"],
    ["Experto (individual)", "32.3", "34", "44", "11.4 min"],
    ["2 novatos (cooperativo)", "13.8", "15", "24", "5.6 min"],
    ["4 novatos (cooperativo)", "20.2", "25", "33", "9.6 min"],
], pie="Balance de la dificultad.", anchos_cm=[5, 3.2, 2.6, 2.4, 4.4])
a.salto()

# ================================================================== PARTE B
a.titulo("Parte B. Evidencias")
a.titulo("B1. El videojuego (local)", 2)
a.p("Capturas automáticas con Playwright. Las de la oleada 12 y del jefe se prepararon fijando la oleada desde la "
    "simulación local del navegador, para no jugar 10 minutos antes de cada captura.")
L([(img("01_menu_principal.png"), "Menú principal."), (img("02_seleccion_mision.png"), "Selección de modo.")])
L([(img("03_partida_individual.png"), "Partida individual."), (img("04_enemigos_oleada_12.png"), "Oleada 12 con varios tipos de enemigo.")])
L([(img("05_jefe_nave_nodriza.png"), "Jefe: nave nodriza."), (img("06_cartas_de_mejora.png"), "Cartas de mejora tras vencer al jefe.")])
L([(img("07a_sala_cooperativa.png"), "Sala cooperativa (local)."), (img("07_partida_cooperativa.png"), "Partida cooperativa de dos pilotos.")])
L([(img("09_pantalla_de_resultados.png"), "Pantalla final «¡NUEVO RÉCORD!»."), (img("08_tabla_de_lideres.png"), "Tabla de líderes (local).")])
L([(img("10a_partidas_en_vivo.png"), "Partidas en vivo."), (img("10_vista_espectador.png"), "Vista de espectador.")])

a.titulo("B2. El videojuego en AWS", 2)
L([(img("26b_aws_menu_principal.png"), "Menú servido desde el balanceador de AWS."),
   (img("26_aws_sala_cooperativa_agones.png"), "Sala LJ7RC = GameServer astro-fleet-874lg-lj7rc.")])
L([(img("27_aws_partida_cooperativa.png"), "Partida cooperativa sobre un GameServer de AWS."),
   (img("28_aws_tabla_lideres_dynamodb.png"), "Tabla de líderes leyendo de Lambda + DynamoDB.")])
F(img("29_aws_vista_espectador.png"), "Espectador conectado a una partida en AWS.", 9)

a.titulo("B3. GitHub y GitHub Actions", 2)
F(img("12_github_repositorio.png"), "Repositorio público en GitHub.", 15)
F(img("13_github_actions_ci.png"), "CI en verde: pruebas, imágenes Docker, Terraform y locustfile.", 15)
F(img("13b_github_actions_deploy.png"), "Deploy en verde: pruebas, publicación en ECR y actualización de EKS (OIDC).", 15)
F(img("13c_github_actions_historial.png"), "Historial de ejecuciones del día (incluye el despliegue fallido que se corrigió).", 15)

a.titulo("B4. Terraform", 2)
F(img("14_terraform_plan.png"), "terraform plan: 88 recursos con estado remoto en S3.", 16)
F(img("15_terraform_apply.png"), "terraform apply y salidas.", 16)
F(img("36_terraform_destroy.png"), "terraform destroy y verificación: no queda ningún recurso cobrable.", 16)

a.titulo("B5. Amazon EKS, EC2 y ECR", 2)
F(img("16_aws_eks_nodos_inicial.png"), "Clúster EKS 1.35 y nodos al inicio.", 16)
F(img("16_aws_eks_nodos_final.png"), "Clúster EKS y nodos al terminar las pruebas.", 16)
F(img("17_aws_ec2_instancias_final.png"), "Instancias EC2 t3.large del clúster.", 16)
F(img("18_aws_ecr_imagenes_final.png"), "Imágenes en ECR etiquetadas con el commit.", 16)

a.titulo("B6. Kubernetes y Agones", 2)
F(img("19_agones_gameservers_inicial.png"), "Fleet, FleetAutoscaler, GameServers y HPA al inicio.", 16)
F(img("19_agones_gameservers_final.png"), "Fleet, FleetAutoscaler, GameServers y HPA al terminar.", 16)
F(img("19b_kubernetes_pods_inicial.png"), "Pods de todo el clúster (inicio).", 16.5)

a.titulo("B7. Serverless", 2)
F(img("25_serverless_lambda_apigw_dynamodb.png"), "Configuración de Lambda, API Gateway y DynamoDB.", 16)
a.titulo("B8. Monitoreo", 2)
F(img("33a_grafana_rampa_en_curso.png"), "Grafana a mitad de la rampa: el HPA ya escaló el lobby y la flota crece.", 15)

os.makedirs("entregables", exist_ok=True)
a.guardar(OUT)
print("Anexo:", OUT, "figuras:", a.fig, "tablas:", a.tab)
