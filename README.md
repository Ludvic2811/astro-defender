# 🚀 Astro Defender: Invasión Galáctica

Videojuego espacial 2D de acción y supervivencia para navegador, individual o cooperativo (2 a 4 pilotos), desplegado en **AWS** con **EKS + Agones**, **Terraform**, **GitHub Actions**, **Lambda + DynamoDB** y monitoreo con **Prometheus, Grafana y CloudWatch**.

> Proyecto final, Unidad 3: Cómputo en la Nube.

**Estado (16 de noviembre de 2026):** se desplegó en AWS con Terraform y GitHub Actions, se probó con 1,000 jugadores y 500 espectadores simulados, y se destruyó al terminar. Las evidencias reales están en [docs/evidencias/](docs/evidencias/) y los resultados en [docs/PRUEBAS.md](docs/PRUEBAS.md).

**Entregables** (carpeta [entregables/](entregables/)):

- Reporte técnico (Word y PDF, 6 páginas)
- Presentación (PowerPoint y PDF)
- Anexo de evidencias y pruebas (Word y PDF): todas las capturas, los reportes de Locust y el detalle de cada prueba
- [Guion de exposición](entregables/Guion_exposicion.md)
- [Validación contra la rúbrica](entregables/Validacion_rubrica.md)

## Contenido del repositorio

| Carpeta | Qué contiene |
|---|---|
| [client/](client/) | Juego en Phaser 3 (HTML, CSS, JS): menú, modos, juego, tabla de líderes y espectadores |
| [shared/sim.js](shared/sim.js) | Lógica del juego: oleadas infinitas, curva de dificultad, enemigos, jefes, poderes, combo y cartas. La usan el navegador y el servidor |
| [server/](server/) | Servidor multijugador autoritativo (Node.js + WebSockets + SDK de Agones + métricas) |
| [lobby/](lobby/) | Sirve la web y asigna partidas pidiendo `GameServerAllocation` a Agones |
| [lambda/leaderboard/](lambda/leaderboard/) | API serverless de la tabla de líderes (Lambda + DynamoDB) |
| [k8s/](k8s/) | Fleet y FleetAutoscaler de Agones, despliegue del lobby, HPA y monitores de Prometheus |
| [terraform/](terraform/) | VPC, EKS, nodos EC2, ECR, DynamoDB, Lambda, API Gateway, Agones, Prometheus/Grafana, Cluster Autoscaler y CloudWatch |
| [.github/workflows/](.github/workflows/) | CI (pruebas), Deploy (ECR + EKS) e Infraestructura (Terraform plan/apply/destroy) |
| [loadtest/](loadtest/) | Pruebas de carga con Locust (rampa, pico de 1,000, 500 espectadores y tabla de líderes) y sus resultados reales |
| [k8s/loadtest/](k8s/loadtest/) | Locust dentro del clúster (maestro + workers) |
| [scripts/evidencias/](scripts/evidencias/) | Captura automática de evidencias, extracción de métricas, gráficas, reporte y presentación |
| [entregables/](entregables/) | Reporte, presentación, guion y validación de la rúbrica |
| [monitoring/](monitoring/) | Tablero de Grafana |
| [docs/](docs/) | [Arquitectura](docs/ARQUITECTURA.md), [pruebas y autoescalado](docs/PRUEBAS.md) y [costos](docs/COSTOS.md) |
| [COMO-PRESENTAR.md](COMO-PRESENTAR.md) | Cómo llevar el proyecto a otra computadora y guion para la demostración |

## Cómo se juega

- **Oleadas infinitas:** la partida termina solo cuando caen todos los pilotos. El objetivo es superar tu récord.
- **Controles:** mover con flechas o WASD, disparar con ESPACIO, **bomba** con B o SHIFT, pausa con P (individual) y sonido con M. En celular hay joystick táctil, disparo automático y botón de bomba.
- **Vidas:** tienes 3. Al recibir un golpe tu arma baja un nivel. Un escudo absorbe un golpe.
- **Enemigos:**
  - Ovni: baja zigzagueando y dispara.
  - Kamikaze: desde la oleada 4.
  - Tirador en abanico: desde la 6.
  - Tanque: desde la 8.
  - Escuadrón en formación V: desde la 9.
- **Jefe cada 5 oleadas:** una nave nodriza con 3 patrones (abanico, láser que barre la pantalla e invocador de kamikazes), más resistente en cada sector. Al vencerla aparece **«¡SECTOR LIBERADO!»** y eliges **1 de 3 cartas de mejora**: velocidad, cadencia, daño, balas perforantes, blindaje, bombas, escudo regenerativo, imán o combo más largo.
- **Poderes:** arma +1 (hasta nivel 4), disparo triple, disparo rápido, escudo, vida extra y bomba.
- **Puntos:**
  - Base: alien 100, kamikaze 150, tirador 200, tanque 400, jefe 5,000; asteroides 25/50/100.
  - Multiplicadores: ×(1 + 0.1 por oleada), **combo** de hasta ×5 al encadenar derribos y **zona crítica** ×2 desde la oleada 20.
- **Pantalla final:** **«¡NUEVO RÉCORD!»** si superas tu mejor marca; si no, **«DERROTA»**. Muestra derribos, precisión y combo máximo, y el MVP en cooperativo.
- **Cooperativo:**
  - Partida rápida o sala privada con código de 5 letras. El anfitrión inicia con ENTER.
  - Si caes, reapareces al empezar la siguiente oleada mientras alguien de tu equipo siga vivo.
  - La dificultad escala con el número de pilotos.
- **Espectadores:** «Ver partidas en vivo» lista las partidas públicas en curso.
- La pantalla **Cómo jugar** del menú explica todo lo anterior dentro del juego.

## Ejecutar en local (sin AWS)

**La forma fácil (Windows):** doble clic en **`INICIAR-JUEGO.bat`**. Instala lo necesario la primera vez, arranca los servidores y abre el navegador. Para llevar el proyecto a otra computadora, mira [COMO-PRESENTAR.md](COMO-PRESENTAR.md).

**A mano.** Requisito: Node.js 20 o superior.

```bash
cd server && npm install && npm start      # servidor de juego en :7777
cd lobby  && npm install && npm start      # web + matchmaker en :8080
```

Abre <http://localhost:8080>. Para probar el cooperativo, abre dos pestañas y elige **Partida rápida** en ambas. En modo local el código de sala es `LOCAL`.

Con Docker: `docker compose up --build`.

Pruebas automáticas:

```bash
npm test --prefix server                    # simulación y sala multijugador
npm test --prefix lobby
(cd lambda/leaderboard && node --test)      # API de líderes
node scripts/smoke-test.mjs                 # end-to-end con los servidores corriendo
node scripts/balance.mjs 200 1 novato       # simulador de balance (ver docs/PRUEBAS.md)
```

## Usar los dibujos originales del equipo

Guarda las fotos o escaneos en `client/assets/originales/` con los nombres `nave`, `ovni` y `asteroide` (.jpg o .png) y ejecuta:

```bash
pip install pillow numpy scipy
python scripts/procesar_dibujos.py
```

El script recorta cada dibujo, quita el papel y los adornos, endereza la nave y actualiza `manifest.json`. Las variantes de enemigos (kamikaze, tirador, tanque) y los jefes reutilizan el dibujo del ovni con otros colores y tamaños. Lo que falte se reemplaza por sprites generados por código.

## Despliegue en AWS

Así se desplegó el 16 de noviembre de 2026. Requisitos: Terraform ≥ 1.10, AWS CLI v2, kubectl y una cuenta de AWS.

1. **Credenciales.** Si usas `aws login`, agrega un perfil que Terraform entienda en `~/.aws/config`:
   ```ini
   [profile astro-tf]
   region = us-east-1
   credential_process = aws configure export-credentials --profile default --format process
   ```
   Luego `export AWS_PROFILE=astro-tf`.
2. **Bucket del estado** (una sola vez): `bash scripts/bootstrap-state.sh astro-defender-tfstate-<sufijo> us-east-1`, y copia lo que imprime en `terraform/backend.hcl`.
3. **Variables** (`terraform/terraform.tfvars`, no se sube a Git):
   ```hcl
   grafana_admin_password = "..."
   budget_email           = "equipo@ejemplo.com"   # alerta de presupuesto de US$20
   github_repository      = "usuario/astro-defender" # crea el rol OIDC para GitHub Actions
   github_oidc_sub_prefix = ""  # si el repo usa sujetos inmutables: gh api repos/USUARIO/REPO/actions/oidc/customization/sub
   ```
4. **Crear:**
   ```bash
   cd terraform
   terraform init -backend-config=backend.hcl
   terraform plan -var-file=env/dev.tfvars
   terraform apply -var-file=env/dev.tfvars
   ```
   Tarda ~20 min. Revisa antes la cuota de vCPU: con 20 nodos t3.large se necesitan 40 vCPU.
5. **GitHub** (*Settings → Secrets and variables → Actions → Variables*):
   - `AWS_ROLE_ARN` = salida `github_deploy_role_arn`
   - `DEPLOY_ENABLED` = `true`
   - Crea también el *environment* `production`.
6. **Publicar el juego:** haz push a `main` o ejecuta *Actions → Deploy*. El resumen muestra la URL pública. Las imágenes se etiquetan con el commit.
7. **Grafana:** `kubectl get svc kube-prometheus-stack-grafana -n monitoring` (usuario `admin`), tablero *Astro Defender*.
8. **Pruebas de carga:**
   - Jugadores: `bash scripts/evidencias/prueba-carga.sh spike 10 "SPIKE_USERS=1000 HOLD_SECONDS=240"` (ver [docs/PRUEBAS.md](docs/PRUEBAS.md)).
   - Tabla de líderes: `locust -f loadtest/locust_leaderboard.py --host <API>`.
9. **Destruir al terminar:**
   ```bash
   bash scripts/predestroy.sh
   terraform destroy -var-file=env/dev.tfvars
   ```
   El script borra antes los balanceadores que creó Kubernetes. Si `destroy` se queda varios minutos en la subred o en la VPC, ejecuta en otra terminal `bash scripts/limpiar-huerfanos.sh`: borra las interfaces de red y los security groups que EKS deja huérfanos.

## Equipo

| Integrante | Responsabilidad | Archivos principales |
|---|---|---|
| Luis Sambrano Mendoza | Mecánicas del juego, diseño visual, interfaz y multijugador | `shared/sim.js`, `client/`, `server/` |
| Manuel Sambrano Mendoza | AWS, Docker, Kubernetes, Agones, Terraform, CI/CD, monitoreo y pruebas de carga | `terraform/`, `k8s/`, `.github/`, `monitoring/`, `loadtest/`, `docs/` |
