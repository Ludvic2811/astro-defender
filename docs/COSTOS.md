# Análisis de costos (estimado)

Precios de referencia On-Demand en **us-east-1**. Son aproximados: confírmalos en la [AWS Pricing Calculator](https://calculator.aws/) antes de la entrega.

## Entorno base (sin carga)

| Recurso | Cantidad | Precio aprox. | USD/hora | USD/mes (24/7) |
|---|---|---|---|---|
| Plano de control EKS (soporte estándar) | 1 | 0.10 /h | 0.100 | 73.0 |
| Nodos EC2 t3.medium | 2 | 0.0416 /h c/u | 0.083 | 60.7 |
| Discos EBS gp3 de los nodos (20 GB) | 2 | 0.08 /GB-mes | 0.004 | 3.2 |
| IPv4 públicas (nodos y balanceadores) | ~6 | 0.005 /h c/u | 0.030 | 21.9 |
| Classic Load Balancer (lobby y Grafana) | 2 | 0.025 /h c/u | 0.050 | 36.5 |
| CloudWatch (Container Insights, logs, tablero) | — | variable | ~0.03 | ~20 |
| Lambda + API Gateway + DynamoDB (bajo demanda) | — | por uso | ~0 | < 1 |
| ECR (imágenes) | ~1 GB | 0.10 /GB-mes | ~0 | 0.1 |
| **Total** | | | **≈ 0.30** | **≈ 215** |

**Recomendación:** no dejes el clúster encendido. Créalo con *apply* para trabajar o hacer la demostración y bórralo con *destroy* al terminar. Una sesión de 4 horas cuesta unos **USD 1.20**, y las 5 o 6 sesiones del proyecto, menos de **USD 10**.

> Si el clúster usa una versión de Kubernetes que pasó a **soporte extendido**, el plano de control cuesta USD 0.60/h (6 veces más). Mantén `cluster_version` en una versión con soporte estándar.

## Costo de las pruebas de carga (1 hora)

| Concepto | Supuesto | USD |
|---|---|---|
| Nodos extra para 1,000 jugadores | ~18 t3.medium × 1 h | ~0.75 |
| Generador de carga EC2 | c6i.xlarge × 1 h | ~0.17 |
| Transferencia de datos | 1,000 jugadores × ~25 KB/s ≈ 90 GB/h; dentro de la región vía IP pública ≈ USD 0.01/GB por sentido | ~1.8 |
| Lambda/DynamoDB | miles de peticiones | < 0.05 |
| **Total por hora de prueba** | | **≈ 3** |

Si Locust corre desde fuera de AWS, la transferencia de salida se cobra como Internet (unos USD 0.09/GB): cerca de USD 8 por hora.

## Escenario de producción hipotético

Con 1,000 jugadores concurrentes de forma sostenida (~250 partidas):

- Cómputo: unos 18 nodos t3.medium, o 5 c6i.2xlarge con más pods por nodo. Entre USD 550 y 600 al mes.
- Transferencia hacia Internet: 1,000 × 25 KB/s ≈ 65 TB/mes, unos USD 5,000 al mes. **Es el costo dominante.**
- Formas de reducirlo: snapshots delta y comprimidos, menos frecuencia para espectadores, instancias Spot para los GameServers con `scheduling: Packed`, Savings Plans y Graviton (t4g/c7g).
