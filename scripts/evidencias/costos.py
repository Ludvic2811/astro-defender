"""Calcula costos por hora y por jugador, capacidad y extrapolación de espectadores
a partir de docs/evidencias/resultados.json (datos medidos). Escribe docs/evidencias/costos.json.
Precios bajo demanda de us-east-1 (noviembre de 2026)."""
import json
import math

EV = "docs/evidencias"
R = json.load(open(f"{EV}/resultados.json", encoding="utf-8"))

P = {
    "eks_h": 0.10,            # plano de control EKS
    "t3large_h": 0.0832,      # nodo t3.large
    "t3small_h": 0.0208,      # servidor tradicional de comparación
    "ipv4_h": 0.005,          # IPv4 pública por nodo / balanceador
    "ebs_gb_mes": 0.08,       # gp3
    "elb_h": 0.025,           # balanceador clásico
    "egress_gb": 0.09,        # salida a Internet (primeros 10 TB)
    "lambda_req_m": 0.20, "lambda_gb_s": 0.0000166667,
    "apigw_req_m": 1.00, "ddb_rru_m": 0.125, "ddb_wru_m": 0.625,
}
HORAS_MES = 730
CCU_POR_NODO_JUEGO = 75   # medido: ~750 CCU con p95 < 80 ms usando ~10 nodos de juego (14 menos 4 de Locust)
PILOTOS = 4


def costo_hora(nodos, balanceadores=1):
    nodo = P["t3large_h"] + P["ipv4_h"] + 20 * P["ebs_gb_mes"] / HORAS_MES
    return P["eks_h"] + nodos * nodo + balanceadores * (P["elb_h"] + 2 * P["ipv4_h"])


def nodos_para(ccu, sistema=2):
    return sistema + math.ceil(ccu / CCU_POR_NODO_JUEGO)


pico = R.get("spike", {})
rampa = R.get("ramp", {})
esp = R.get("spectators", {})
CAP = 750          # CCU donde la curva CCU-p95 cruza 80 ms (percentil 75 de las ventanas)
CAP_NODOS = 14     # nodos activos en ese momento (rampa, Prometheus)
LOCUST_NODOS = 4   # 10 workers × 700m de CPU reservada ≈ 4 nodos t3.large

filas = []
for nombre, ccu, nodos, nota in (
    ("Reposo (sin jugadores)", 0, 2, "Plano de control EKS, 2 nodos y balanceador del juego"),
    ("Capacidad medida (p95 < 80 ms)", CAP, CAP_NODOS - LOCUST_NODOS,
     f"~{CAP} CCU con {CAP_NODOS} nodos activos, menos {LOCUST_NODOS} dedicados a Locust"),
    (f"Pico medido ({pico.get('ccu_max', 0):,.0f} CCU)", pico.get("ccu_max", 0), pico.get("nodos_max", 0) - LOCUST_NODOS,
     f"{pico.get('nodos_max', 0):.0f} nodos, menos {LOCUST_NODOS} de Locust; p95 ya sobre 80 ms"),
    ("1,000 CCU (proyección)", 1000, nodos_para(1000), f"{CCU_POR_NODO_JUEGO} CCU por nodo de juego + 2 de sistema"),
    ("10,000 CCU (proyección)", 10000, nodos_para(10000), "Requiere ampliar la cuota de vCPU"),
):
    ch = costo_hora(nodos)
    filas.append([nombre, f"{nodos:.0f}", f"{ch:.2f}", f"{ch / ccu:.4f}" if ccu else "-", nota])

# Espectadores: kbps por conexión medido en la prueba de espectadores
kbps = esp.get("kbps_por_conexion") or rampa.get("kbps_por_conexion") or 0
egress_gb_h = 20000 * kbps * 3600 / 8 / 1e6
gbps = 20000 * kbps / 1e6
esp_medidos = esp.get("espectadores_max", 0)

# Serverless vs tradicional (1 millón de consultas al mes, 128 MB, ~10 ms facturados)
serverless_millon = (P["lambda_req_m"] + 1e6 * 0.128 * 0.010 * P["lambda_gb_s"] + P["apigw_req_m"]
                     + 0.8 * P["ddb_rru_m"] + 0.2 * P["ddb_wru_m"])
ec2_mes = (P["t3small_h"] + P["ipv4_h"]) * HORAS_MES + 8 * P["ebs_gb_mes"]

out = {
    "precios": P,
    "tabla": filas,
    "serverless_millon": serverless_millon,
    "ec2_mes": ec2_mes,
    "kbps_por_espectador": kbps,
    "egress_20k_gb_h": egress_gb_h,
    "egress_20k_usd_h": egress_gb_h * P["egress_gb"],
    "texto_capacidad": (
        f"Capacidad máxima medida: la curva CCU contra RTT p95 se mantiene plana (10-40 ms) hasta ~650 jugadores y cruza la "
        f"meta de 80 ms alrededor de {CAP} jugadores concurrentes, con {CAP_NODOS} nodos activos: ~{CAP / CAP_NODOS:.0f} "
        f"jugadores por nodo, o ~{CCU_POR_NODO_JUEGO} por nodo de juego si se descuentan los {LOCUST_NODOS} nodos de Locust. "
        f"El pico llegó a {pico.get('ccu_max', 0):,.0f} jugadores en {pico.get('gs_allocated_max', 0):,.0f} partidas, pero ya "
        f"con p95 de ~{pico.get('rtt_p95_ccu_max_ms') or 0:.0f} ms. En ese tramo el nodo más cargado estaba entre 88 y 95 % "
        f"de CPU (la programación Packed llena cada nodo) y el tick p99 llegó a {pico.get('tick_p99_max_ms', 0):.1f} ms, "
        "por encima del presupuesto de 16.7 ms a 60 Hz; los generadores de Locust llegaron a 0.73 núcleos, cerca de su "
        "límite, así que una parte de la latencia puede venir de ellos."),
    "texto_reaccion": (
        f"Tiempo de reacción medido desde el inicio del pico: FleetAutoscaler {pico.get('reac_fleet_s') or 0:.0f} s (muestras "
        f"cada 15 s), HPA del lobby {pico.get('reac_hpa_s') or 0:.0f} s (de 2 a 10 pods), primeros pods pendientes "
        f"{pico.get('reac_pendientes_s') or 0:.0f} s y primer nodo EC2 nuevo {pico.get('reac_nodo_s') or 0:.0f} s; luego el "
        f"Cluster Autoscaler agregó varios nodos de golpe (de {pico.get('nodos_al_iniciar_carga') or 0:.0f} a "
        f"{pico.get('nodos_max') or 0:.0f}). El CCU llegó al 90 % de su máximo a los {pico.get('reac_ccu90_s') or 0:.0f} s. "
        "En la primera rampa, con un colchón fijo de 5 servidores, falló el 75 % de las solicitudes de partida; con "
        "colchón de 10 % entraban ~90 jugadores por minuto y con 25 % más reserva de nodos, ~250 por minuto."),
    "texto_espectadores": (
        f"Espectadores: con {esp_medidos:,.0f} espectadores reales cada conexión consumió ~{kbps:.0f} kbps de instantáneas. "
        f"Extrapolando a 20,000 espectadores se necesitan ~{gbps:.2f} Gbps ({egress_gb_h:,.0f} GB por hora, unos "
        f"US${egress_gb_h * P['egress_gb']:,.0f} por hora de salida a Internet). Como cada partida admite 4 pilotos, "
        "20,000 espectadores repartidos en 250 partidas son 80 por sala; conviene un relé o una CDN de instantáneas "
        "para no cargar al servidor de la partida. Un stream HLS de 4,500 kbps costaría unas "
        f"{4500 / max(kbps, 1):.0f} veces más ancho de banda (en este proyecto no se implementó HLS)."),
    "texto_costos": (
        f"El costo por jugador es bajo porque una partida de 4 pilotos usa ~{rampa.get('cpu_por_gameserver_m') or 0:.0f}-"
        f"{esp.get('cpu_por_gameserver_m') or 0:.0f} milicores de CPU. El mayor riesgo de "
        "costo no es el cómputo sino la salida de datos de los espectadores y dejar el clúster encendido: por eso hay "
        "un presupuesto con alertas y la infraestructura se destruye al terminar."),
    "recomendaciones": [
        ("Colchón proporcional y reserva de nodos: ", "un FleetAutoscaler con 20-25 % y pods de sobreaprovisionamiento "
         "evitan que las asignaciones esperen al arranque de un nodo EC2."),
        ("Holgura de CPU por nodo: ", "subir la solicitud de CPU por GameServer a ~70m (o limitar partidas por nodo) para "
         "que la programación Packed no lleve nodos al 95 % y el tick p99 se quede bajo 16.7 ms."),
        ("Capacidad atómica por partida: ", "usar Counters de Agones en la asignación para que dos jugadores no tomen el "
         "último lugar de la misma sala (se midieron rechazos por «sala llena»)."),
        ("Límites de cuenta: ", "pedir con anticipación más vCPU para EC2 (se subió de 32 a 64) y más concurrencia de "
         "Lambda (la cuenta tiene 10)."),
        ("Persistencia del monitoreo: ", "dar volumen persistente a Prometheus; al retirar un nodo se perdió parte del "
         "historial del primer intento."),
        ("Espectadores a escala: ", "servir las instantáneas desde un relé o CDN en lugar del servidor de la partida."),
    ],
    "conclusion": (
        "Astro Defender quedó desplegado de punta a punta con infraestructura como código, CI/CD con credenciales "
        "temporales, una flota de Agones que escala en tres capas y una tabla de líderes serverless probada bajo carga. "
        f"Con la configuración probada la plataforma sostiene ~{CAP} jugadores con latencia p95 bajo 80 ms y absorbe un "
        "pico de 1,000 en unos 4 minutos. El factor decisivo para un lanzamiento es anticipar la capacidad: colchón de "
        "servidores, reserva de nodos, holgura de CPU por nodo y cuotas de la cuenta."),
}
json.dump(out, open(f"{EV}/costos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps({k: v for k, v in out.items() if k not in ("precios", "recomendaciones")}, ensure_ascii=False, indent=1))
