# Validación contra la rúbrica del proyecto integrador

Proyecto: **Astro Defender** (en lugar de Nebula Arena), en **AWS** (en lugar de Google Cloud). Fecha de las pruebas: 16 de noviembre de 2026.

Estados:
- **Aprobado:** se implementó, se ejecutó y hay evidencia real.
- **Aprobado con observación:** cumple, pero con una limitación documentada.
- **Pendiente:** depende de algo que todavía no ocurre.

Las rutas de evidencia son relativas a la raíz del repositorio.

---

## 1. Infraestructura como código (20 %) · Aprobado

- **Qué se implementó:** Terraform crea y destruye:
  - red: VPC en 2 zonas;
  - cómputo y contenedores: EKS 1.35, grupo de nodos t3.large (2–20) y ECR;
  - permisos: IAM, con un rol OIDC para GitHub;
  - complementos por Helm: Agones 1.60, kube-prometheus-stack, metrics-server y Cluster Autoscaler;
  - serverless: Lambda, API Gateway y DynamoDB;
  - control: tablero y alarma de CloudWatch, y un presupuesto de AWS Budgets.

  El estado es remoto en S3 con bloqueo (`use_lockfile`), y hay variables por entorno (`terraform/env/dev.tfvars` y `prod.tfvars`).
- **Pruebas ejecutadas:**
  - `terraform validate` y `fmt` en CI;
  - `terraform plan`: 88 recursos;
  - `apply`: 88 recursos en 19.5 min, más 7 recursos en un segundo apply tras un corte de DNS local;
  - `plan` de drift antes de destruir;
  - `terraform destroy`.
- **Resultado:** la infraestructura se creó, se usó y se destruyó por completo con Terraform: «Destroy complete! Resources: 88 destroyed» en 39 min. Después se verificó que no quedara ningún recurso cobrable: 0 clústeres, 0 instancias, 0 balanceadores, 0 volúmenes y 0 VPCs propias.
- **Evidencia:**
  - `docs/evidencias/14_terraform_plan.png` y `15_terraform_apply.png`;
  - `docs/evidencias/salidas/terraform_*.txt` (plan, apply, drift y destroy);
  - `docs/evidencias/36_terraform_destroy.png`.
- **Observación:** hubo tres pasos fuera de Terraform, todos documentados:
  - el bucket del estado, con `scripts/bootstrap-state.sh` (práctica estándar);
  - el aumento de cuota de vCPU, pedido por CLI;
  - una anotación de Prometheus aplicada con kubectl para no reiniciarlo durante las pruebas (ya está en el código);
  - durante el destroy se borraron a mano una interfaz de red y un security group que EKS dejó huérfanos. Ahora lo automatiza `scripts/limpiar-huerfanos.sh`, y el código ya ordena la destrucción de la VPC después de Agones.

## 2. Contenedores y orquestación (20 %) · Aprobado

- **Qué se implementó:**
  - imágenes Docker del servidor y del lobby;
  - una Fleet de Agones con requests y limits (50m/500m de CPU, 96/256 Mi) y health checks;
  - el SDK de Agones integrado: Ready, Allocated, etiquetas de jugadores, oleada y estado, y apagado al vaciarse la sala;
  - programación Packed y RollingUpdate, que no corta partidas;
  - el lobby con RBAC para crear GameServerAllocations.
- **Pruebas ejecutadas:**
  - `docker compose` con prueba de humo local;
  - prueba de humo contra la URL pública de AWS (2 pilotos y 1 espectador);
  - partida cooperativa capturada en AWS;
  - hasta 239 partidas simultáneas en el pico.
- **Resultado:** la flota se mantuvo sana y los GameServers pasaron por Ready → Allocated → Shutdown. Ninguna sala superó 4 pilotos (`max(astro_players_connected) = 4`).
- **Evidencia:**
  - `docs/evidencias/11_docker_contenedores.png`;
  - `19c_agones_allocated_aws.png`, `19_agones_gameservers_*.png` y `19b_kubernetes_pods_*.png`;
  - `26_aws_sala_cooperativa_agones.png` y `27_aws_partida_cooperativa.png`;
  - `k8s/gameserver-fleet.yaml`.

## 3. Autoescalado (20 %) · Aprobado

- **Qué se implementó:**
  - FleetAutoscaler con colchón del 25 % y 5 a 300 servidores;
  - HPA del lobby al 60 % de CPU, de 2 a 10 pods;
  - Cluster Autoscaler de 2 a 20 nodos, con EKS Pod Identity;
  - sobreaprovisionamiento con pods de prioridad negativa.
- **Pruebas ejecutadas:** rampa, pico y reducción posterior.
- **Resultado:** escalaron las tres capas, con tiempos de reacción medidos en el pico:
  - FleetAutoscaler: 18 s;
  - HPA: 48 s (de 2 a 10 pods);
  - primer nodo EC2: 138 s, y luego de 10 a 20 nodos.

  La reducción también se midió: de 18 a 6 nodos en unos 2 minutos.
- **Evidencia:**
  - `docs/evidencias/21_prueba_pico.png` y `20_prueba_rampa.png`;
  - `33_grafana_pico.png` y `33b_grafana_rampa_meseta.png`;
  - `34_cloudwatch_nodos_eks.png` y `34b_cloudwatch_nodos_pico.png`;
  - `docs/PRUEBAS.md`.

## 4. Métricas y pruebas de carga (20 %) · Aprobado con observación

- **Qué se implementó:**
  - Locust dentro del clúster: 1 maestro y 10 workers;
  - un tablero de Grafana con CCU, tick p99, servidores por estado, nodos, asignaciones y tráfico;
  - extracción automática de series de Prometheus y gráficas.
- **Pruebas ejecutadas:**
  - rampa de 0 a 1,000 jugadores simulados;
  - pico de 20 a 1,000 en 30 s;
  - 200 jugadores más 500 espectadores, con extrapolación a 20,000.
- **Resultado:**
  - **Curva CCU vs. p95:** capacidad de unos 750 jugadores con p95 menor a 80 ms (unos 75 por nodo de juego).
  - **CCU máximo:** 790 en la rampa y 925 en el pico.
  - **Espectadores:** unos 98 kbps cada uno; 20,000 equivalen a 1.96 Gbps y unos US$79/h.
- **Evidencia:**
  - `docs/evidencias/20` a `24_*.png`;
  - `loadtest/resultados/*` (CSV, HTML y `prometheus.csv`);
  - `docs/evidencias/resultados.json`;
  - `docs/PRUEBAS.md`.
- **Observación:**
  - Se simularon 1,000 jugadores, pero los conectados a la vez llegaron a 790 y 925. El límite fue la velocidad para crear partidas; está medido y explicado.
  - Las series de Prometheus del primer intento de rampa se perdieron (ver PRUEBAS.md).
  - No hay streaming HLS: los espectadores usan WebSocket.

## 5. CI/CD y serverless (10 %) · Aprobado

- **Qué se implementó:**
  - **CI:** pruebas, construcción Docker, Terraform validate y locustfile.
  - **Deploy:** pruebas, imágenes `:<sha>` en ECR y `kubectl apply` en EKS, con OIDC y sin llaves.
  - **Infraestructura:** plan, apply y destroy manuales.
  - **Tabla de líderes:** API Gateway + Lambda + DynamoDB.
- **Pruebas ejecutadas:**
  - 6 ejecuciones de CI, todas en verde;
  - 3 despliegues exitosos (y 2 fallidos, corregidos);
  - pruebas funcionales de la API: alta, consulta y rechazo con HTTP 400;
  - carga de 100 usuarios durante 3 min.
- **Resultado:** la API respondió 12,864 peticiones a 71.8/s con p95 de 150 ms. Hubo un 0.39 % de errores 503, causados por el límite de 10 Lambdas concurrentes de la cuenta.
- **Evidencia:**
  - `docs/evidencias/12_github_repositorio.png`;
  - `13_github_actions_ci.png`, `13b_github_actions_deploy.png` y `13c_github_actions_historial.png`;
  - `18_aws_ecr_imagenes_*.png`;
  - `25_serverless_lambda_apigw_dynamodb.png`;
  - `30` a `32_cloudwatch_*.png`;
  - `28_aws_tabla_lideres_dynamodb.png`;
  - `salidas/serverless_pruebas.txt`.

## 6. Comunicación (10 %) · Aprobado (la demo depende del día de la exposición)

- **Qué se implementó:**
  - reporte técnico de 6 páginas con arquitectura, resultados, capacidad, reacción, costo por hora y por jugador, y recomendaciones;
  - presentación de 10 diapositivas con capturas reales, gráficas nativas y guion en las notas;
  - guion de exposición aparte.
- **Pruebas ejecutadas:** se exportaron el reporte y la presentación a PDF y se revisaron visualmente página por página.
- **Resultado:** el reporte tiene 6 páginas, 17 figuras y 4 tablas; la presentación tiene 10 diapositivas.
- **Evidencia:** en `entregables/`, `Anexo_evidencias_y_pruebas.docx` y `.pdf` (todas las capturas y el detalle de las pruebas), `Reporte_tecnico_Astro_Defender.docx` y `.pdf`, `Presentacion_Astro_Defender.pptx` y `.pdf`, y `Guion_exposicion.md`.
- **Pendiente:** la infraestructura se destruyó para no generar costos. La demo del autoescalado se hace con las capturas o, si se quiere en vivo, volviendo a desplegar unos 30 min antes (pasos en el guion, unos US$1).

---

## Resumen

| Criterio | Peso | Estado |
|---|---|---|
| Infraestructura como código | 20 % | Aprobado |
| Contenedores y orquestación | 20 % | Aprobado |
| Autoescalado | 20 % | Aprobado |
| Métricas y pruebas de carga | 20 % | Aprobado con observación (CCU real 790/925 de 1,000 simulados) |
| CI/CD y serverless | 10 % | Aprobado |
| Comunicación | 10 % | Aprobado; la demo en vivo depende del día |

No se asigna una calificación: la decide el profesor. Esta tabla solo resume qué está comprobado y con qué evidencia.
