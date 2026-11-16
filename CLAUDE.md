# Astro Defender: Invasión Galáctica

Videojuego espacial 2D para navegador (Phaser 3), individual o cooperativo de 2 a 4 jugadores, pensado para desplegarse en AWS con EKS + Agones. Proyecto escolar de la materia **Cómputo en la Nube**.

**Todo el texto visible y los comentarios van en español, con acentos correctos.**

## Arrancar el proyecto

```bash
npm install --prefix server     # solo la primera vez
npm install --prefix lobby      # solo la primera vez
node server/src/index.js        # servidor de juego, puerto 7777
node lobby/src/index.js         # web + matchmaker, puerto 8080
```

Luego abrir <http://localhost:8080>. Requiere Node.js 20 o superior.

En Windows también sirve el atajo `INICIAR-JUEGO.bat`, que hace todo lo anterior.

## Pruebas

```bash
npm test --prefix server                 # 22 pruebas de la lógica del juego
npm test --prefix lobby
(cd lambda/leaderboard && node --test)   # 3 pruebas de la API de líderes
node scripts/smoke-test.mjs              # end-to-end, con los servidores corriendo
node scripts/balance.mjs 200 1 novato    # simulador de balance de dificultad
```

Terraform: `cd terraform && terraform init -backend=false && terraform validate`

## Estructura

| Ruta | Qué es |
|---|---|
| `shared/sim.js` | **Corazón del juego.** Simulación completa: oleadas infinitas, curva de dificultad, 5 tipos de enemigo, jefes, poderes, combo y cartas de mejora |
| `client/js/` | Cliente Phaser: escenas, texturas generadas por código, interfaz |
| `client/assets/` | Dibujos originales del equipo (`player.png`, `enemy.png`, `asteroid.png`) y `originales/` con los escaneos |
| `server/src/` | Servidor autoritativo: WebSockets, SDK de Agones, métricas Prometheus |
| `lobby/src/` | Sirve el cliente y asigna partidas vía GameServerAllocation |
| `lambda/leaderboard/` | API serverless de la tabla de líderes (Lambda + DynamoDB) |
| `terraform/`, `k8s/` | Infraestructura AWS y manifiestos de Kubernetes/Agones |
| `docs/` | Arquitectura, pruebas de carga y análisis de costos |

## Reglas importantes

1. **`shared/sim.js` corre en los dos lados** (navegador y servidor Node). El mundo lógico mide 800×600 y las coordenadas de los snapshots están en ese espacio. Cambiarlo afecta al multijugador.
2. **Nitidez HiDPI:** el lienzo se crea a 800×600 multiplicado por `S` (2 o 3, en `client/js/ui.js`) y cada escena hace `setupView(this)` para que su cámara aplique ese zoom. Las coordenadas de la interfaz siguen siendo 0-800 × 0-600. Las texturas de `textures.js` se dibujan a `TS`× y se colocan con `fitSprite()`.
3. **Los dibujos del equipo son requisito de la materia.** No sustituirlos por arte generado. Para reprocesarlos: `python scripts/procesar_dibujos.py` (necesita `pillow numpy scipy`).
4. **Las texturas se generan por código**, no se descargan. El único recurso externo es Phaser por CDN y las fuentes de Google.
5. **AWS se desplegó y se destruyó el 16-nov-2026.** Hoy no hay nada encendido; crear el clúster cuesta dinero por hora. Ver el README (sección *Despliegue en AWS*) antes de `terraform apply`. Las evidencias reales de ese día están en `docs/evidencias/` y no deben sustituirse por datos inventados.
6. **Evidencias y entregables se generan con scripts** de `scripts/evidencias/` (capturas, métricas, gráficas, `generar-reporte.py`, `generar-presentacion.js`). El reporte debe quedar en máximo 6 páginas.

## Protocolo multijugador

El servidor es autoritativo: recibe `input`, `bomb`, `pick`, `start` y `restart`; simula a 60 Hz y difunde snapshots a 20 Hz. El cliente interpola con 100 ms de búfer y predice su propia nave. El formato exacto de los snapshots está documentado en `snapshot()` al final de `shared/sim.js`.
