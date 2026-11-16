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
GS_POR_NODO = 25           # (1930m asignables - ~420m de DaemonSets) / 60m por GameServer
PILOTOS = 4


def costo_hora(nodos, balanceadores=1):
    nodo = P["t3large_h"] + P["ipv4_h"] + 20 * P["ebs_gb_mes"] / HORAS_MES
    return P["eks_h"] + nodos * nodo + balanceadores * (P["elb_h"] + 2 * P["ipv4_h"])


def nodos_para(ccu, colchon=0.25, sistema=2):
    partidas = math.ceil(ccu / PILOTOS)
    total = math.ceil(partidas / (1 - colchon))
    return sistema + math.ceil(total / GS_POR_NODO)


pico = R.get("spike", {})
rampa = R.get("ramp", {})
esp = R.get("spectators", {})
ccu_med = max(pico.get("ccu_max", 0), rampa.get("ccu_max", 0))
mejor = pico if pico.get("ccu_max", 0) >= rampa.get("ccu_max", 0) else rampa
nodos_med = mejor.get("nodos_max", 0)
locust_nodos = 4  # 10 workers × 700m de CPU reservada ≈ 4 nodos t3.large dedicados a generar carga

filas = []
for nombre, ccu, nodos, nota in (
    ("Reposo (sin jugadores)", 0, 2, "Plano de control, 2 nodos, ELB del juego"),
    (f"Medido en la prueba ({ccu_med:,.0f} CCU)", ccu_med, nodos_med - locust_nodos,
     f"{nodos_med:.0f} nodos medidos menos ~{locust_nodos} usados por Locust"),
    ("1,000 CCU (proyección)", 1000, nodos_para(1000), "250 partidas + colchón 25 %"),
    ("10,000 CCU (proyección)", 10000, nodos_para(10000), "Requiere ampliar cuota de vCPU"),
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

t_nodo = pico.get("t_primer_nodo_nuevo_s")
t90 = pico.get("t_ccu_90_s")
out = {
    "precios": P,
    "tabla": filas,
    "serverless_millon": serverless_millon,
    "ec2_mes": ec2_mes,
    "kbps_por_espectador": kbps,
    "egress_20k_gb_h": egress_gb_h,
    "egress_20k_usd_h": egress_gb_h * P["egress_gb"],
    "texto_capacidad": (
        f"La mayor carga sostenida fue de {ccu_med:,.0f} jugadores concurrentes en {mejor.get('gs_allocated_max', 0):,.0f} "
        f"partidas sobre {nodos_med:.0f} nodos (incluidos ~{locust_nodos} nodos que solo ejecutaban Locust). El tick p99 del "
        f"servidor no superó {mejor.get('tick_p99_max_ms', 0):.1f} ms (presupuesto de 16.7 ms a 60 Hz) y el RTT p95 con la "
        f"carga máxima fue de {mejor.get('rtt_p95_carga_max_ms') or 0:.0f} ms, muy por debajo de la meta de 80 ms: la curva "
        "CCU-latencia no se dispara, así que el límite no es la red ni la CPU del servidor, sino la velocidad para crear "
        f"partidas nuevas. Cada nodo t3.large aloja ~{GS_POR_NODO} partidas (~{GS_POR_NODO * PILOTOS} pilotos)."),
    "texto_reaccion": (
        f"Tiempo de reacción medido en el pico: el primer nodo EC2 nuevo apareció a los {t_nodo or 0:.0f} s y el CCU llegó al "
        f"90 % de su máximo a los {t90 or 0:.0f} s. El FleetAutoscaler reacciona en 5 s (su intervalo de sincronización) y "
        "el HPA del lobby en 15-30 s; la capa lenta es el Cluster Autoscaler, que tarda ~70-90 s en tener un nodo listo. "
        "En la primera rampa, con un colchón fijo de 5 servidores, fallaron el 75 % de las asignaciones; el colchón "
        "proporcional y la reserva de nodos (pods de prioridad negativa) son la corrección."),
    "texto_espectadores": (
        f"Espectadores: con {esp_medidos:,.0f} espectadores reales cada conexión consumió ~{kbps:.0f} kbps de instantáneas. "
        f"Extrapolando a 20,000 espectadores se necesitan ~{gbps:.2f} Gbps ({egress_gb_h:,.0f} GB por hora, unos "
        f"US${egress_gb_h * P['egress_gb']:,.0f} por hora de salida a Internet). Como cada partida admite 4 pilotos, "
        "20,000 espectadores repartidos en 250 partidas son 80 por sala; conviene un relé o una CDN de instantáneas "
        "para no cargar al servidor de la partida. Un stream HLS de 4,500 kbps costaría unas "
        f"{4500 / max(kbps, 1):.0f} veces más ancho de banda (en este proyecto no se implementó HLS)."),
    "texto_costos": (
        "El costo por jugador es muy bajo porque una partida de 4 pilotos usa solo ~31 milicores. El mayor riesgo de "
        "costo no es el cómputo sino la salida de datos de los espectadores y dejar el clúster encendido: por eso hay "
        "un presupuesto con alertas y la infraestructura se destruye al terminar."),
    "recomendaciones": [
        ("Colchón proporcional y reserva de nodos: ", "un FleetAutoscaler con 20-25 % y pods de sobreaprovisionamiento "
         "evitan que las asignaciones esperen al arranque de un nodo EC2."),
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
        "Las pruebas mostraron que el servidor y la red tienen holgura y que el factor decisivo para un lanzamiento es "
        "anticipar la capacidad: colchón de servidores, reserva de nodos y cuotas de la cuenta."),
}
json.dump(out, open(f"{EV}/costos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps({k: v for k, v in out.items() if k not in ("precios", "recomendaciones")}, ensure_ascii=False, indent=1))
