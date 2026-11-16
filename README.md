# 🚀 Astro Defender: Invasión Galáctica

Videojuego espacial 2D de acción y supervivencia para navegador, individual o cooperativo (2 a 4 pilotos), desplegado en **AWS** con **EKS + Agones**, **Terraform**, **GitHub Actions**, **Lambda + DynamoDB** y monitoreo con **Prometheus, Grafana y CloudWatch**.

> Proyecto final, Unidad 3: Cómputo en la Nube.

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
| [loadtest/](loadtest/) | Pruebas de carga con Locust: rampa, pico de 1,000 jugadores y 500 espectadores |
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

1. **Requisitos:** cuenta de AWS, AWS CLI configurado y un repositorio en GitHub.
2. **Bucket del estado de Terraform** (una sola vez):
   ```bash
   bash scripts/bootstrap-state.sh astro-defender-tfstate-<equipo> us-east-1
   ```
3. **Secretos en GitHub** (*Settings → Secrets and variables → Actions*):
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y, si usas credenciales temporales, `AWS_SESSION_TOKEN`
   - `TF_STATE_BUCKET`: el bucket del paso 2
   - `GRAFANA_ADMIN_PASSWORD`
   - Variables opcionales: `AWS_REGION` (por defecto `us-east-1`) y `NODE_MAX`.
   - Crea también un *environment* llamado `production`. Puedes exigir aprobación manual en él.
4. **Crear la infraestructura:** *Actions → Infraestructura (Terraform) → Run workflow → apply*. Tarda unos 20 minutos.
5. **Publicar el juego:** *Actions → Deploy → Run workflow*, o simplemente haz *push* a `main`. El resumen del job muestra la URL pública.
6. **Grafana:** `kubectl get svc kube-prometheus-stack-grafana -n monitoring` (usuario `admin`). El tablero se llama *Astro Defender*.
7. **Al terminar:** *Infraestructura → destroy*, para no seguir pagando.

Para hacerlo desde tu computadora: `cd terraform && cp backend.hcl.example backend.hcl && cp terraform.tfvars.example terraform.tfvars`, edita ambos archivos y ejecuta `terraform init -backend-config=backend.hcl && terraform apply`.

## Reparto del equipo

| Integrante | Responsabilidad | Archivos principales |
|---|---|---|
| 1 | Mecánicas del juego | `shared/sim.js`, `server/test/` |
| 2 | Diseño visual, interfaz y multijugador | `client/`, `server/src/room.js` |
| 3 | AWS, Docker, Kubernetes, Agones y Terraform | `terraform/`, `k8s/`, `*/Dockerfile` |
| 4 | CI/CD, monitoreo, pruebas de carga y documentación | `.github/`, `monitoring/`, `loadtest/`, `docs/` |
