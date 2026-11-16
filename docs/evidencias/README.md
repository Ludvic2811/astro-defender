# Evidencias del 16 de noviembre de 2026

Todas las evidencias son **reales**: capturas automáticas con Playwright (Edge sin interfaz), salidas de comandos `aws`, `kubectl` y `terraform`, gráficas renderizadas por CloudWatch (API `GetMetricWidgetImage`) y gráficas hechas con los CSV de Locust y Prometheus. No se usó ninguna imagen generada para demostrar el despliegue.

- **Salidas de terminal** (`14` a `19c` y `25`): son el texto real de `salidas/*.txt` convertido a imagen con `scripts/evidencias/terminal-png.mjs`. El número de cuenta de AWS y los correos se ocultan con `scripts/redactar.py`.
- **Consola web de AWS:** no hay capturas, porque la sesión de AWS era por CLI y no se automatizó el inicio de sesión en la consola. En su lugar están las salidas de la CLI y las gráficas que genera el propio CloudWatch.

## El juego

| Archivo | Qué muestra |
|---|---|
| `01_menu_principal.png` | Menú principal (local) |
| `02_seleccion_mision.png` | Selección de modo |
| `03_partida_individual.png` | Partida individual, oleadas 1-2 jugadas por el script |
| `04_enemigos_oleada_12.png` | Oleada 12 con varios tipos de enemigo (la oleada se fijó desde la simulación local para la captura) |
| `05_jefe_nave_nodriza.png` | Jefe de la oleada 10 (oleada fijada desde la simulación local) |
| `06_cartas_de_mejora.png` | Elección de cartas tras un jefe |
| `07a_sala_cooperativa.png`, `07_partida_cooperativa.png` | Cooperativo de 2 pilotos (local) |
| `08_tabla_de_lideres.png` | Tabla de líderes (local) |
| `09_pantalla_de_resultados.png` | Pantalla final «¡NUEVO RÉCORD!» |
| `10a_partidas_en_vivo.png`, `10_vista_espectador.png` | Lista de partidas y vista de espectador |
| `26b_aws_menu_principal.png` | Menú servido desde el balanceador de AWS |
| `26_aws_sala_cooperativa_agones.png` | Sala en AWS: el código LJ7RC es el GameServer `astro-fleet-874lg-lj7rc` |
| `27_aws_partida_cooperativa.png` | Partida cooperativa sobre un GameServer de AWS |
| `28_aws_tabla_lideres_dynamodb.png` | Tabla de líderes leyendo de Lambda + DynamoDB |
| `29_aws_vista_espectador.png` | Espectador conectado a una partida en AWS |

## Infraestructura y CI/CD

| Archivo | Qué muestra |
|---|---|
| `11_docker_contenedores.png` | `docker compose` con las dos imágenes y la prueba de humo |
| `12_github_repositorio.png` | Repositorio público en GitHub |
| `13_github_actions_ci.png` | CI en verde: pruebas, Docker, Terraform y locustfile |
| `13b_github_actions_deploy*.png` | Deploy en verde: pruebas → ECR → EKS |
| `13c_github_actions_historial.png` | Historial de ejecuciones |
| `14_terraform_plan.png` | `terraform plan` (88 recursos, estado en S3) |
| `15_terraform_apply.png` | `terraform apply` y salidas |
| `16_aws_eks_nodos_*.png` | Clúster EKS 1.35 y nodos (al inicio y al final de las pruebas) |
| `17_aws_ec2_instancias_*.png` | Instancias EC2 del clúster |
| `18_aws_ecr_imagenes_*.png` | Imágenes en ECR etiquetadas con el commit |
| `19_agones_gameservers_*.png`, `19c_agones_allocated_aws.png` | Fleet, FleetAutoscaler, GameServers (Ready, Allocated y Scheduled) y HPA |
| `19b_kubernetes_pods_*.png` | Pods de todo el clúster |
| `25_serverless_lambda_apigw_dynamodb.png` | Lambda, API Gateway y DynamoDB |
| `36_terraform_destroy.png` | `terraform destroy` al terminar |

## Rendimiento y autoescalado

| Archivo | Qué muestra |
|---|---|
| `20_prueba_rampa.png` | Rampa 0→1,000: usuarios, GameServers, nodos, réplicas del lobby y latencias |
| `21_prueba_pico.png` | Pico 20→1,000 en 30 s |
| `22_prueba_espectadores.png` | 200 jugadores y 500 espectadores |
| `23_curva_ccu_latencia.png` | Curva CCU contra RTT p95 (meta de 80 ms) |
| `24_errores.png` | Errores por segundo en cada prueba |
| `30`, `31`, `32_cloudwatch_*.png` | CloudWatch: Lambda, latencia de API Gateway y DynamoDB durante la prueba de la tabla de líderes |
| `33a`, `33b`, `33`, `33c_grafana_*.png` | Grafana durante la rampa, en el pico y con espectadores |
| `34_cloudwatch_nodos_eks.png`, `34b_cloudwatch_nodos_pico.png` | Container Insights: número de nodos |
| `35_cloudwatch_cpu_nodos.png` | Container Insights: CPU de los nodos |

## Datos

- `resultados.json`: resumen calculado por `scripts/evidencias/analizar.py`.
- `costos.json`: costos calculados por `scripts/evidencias/costos.py`.
- `serie_*.json`: series para las gráficas de la presentación.
- `salidas/`: texto real de cada comando.
- `../../loadtest/resultados/`: CSV, HTML y logs de Locust, y `prometheus.csv` de cada prueba.
