# 🎮 Cómo llevar y presentar el proyecto

Guía rápida para mostrar **Astro Defender** en otra computadora.

---

## 1. Antes de salir (en esta computadora)

Haz doble clic en **`scripts\PREPARAR-COPIA.bat`** y escribe a dónde copiarlo, por ejemplo `E:\AstroDefender` si es una memoria USB.

El proyecto pesa solo **~6 MB** porque la copia omite los archivos temporales pesados (`node_modules`, caché de Terraform) y los archivos con contraseñas (`terraform.tfvars`, `backend.hcl`).

> También puedes copiar la carpeta a mano: solo **no copies** `terraform\.terraform` (pesa 895 MB y se regenera sola).

---

## 2. En la laptop del salón

### Una sola vez: instalar Node.js

1. Entra a <https://nodejs.org>
2. Descarga la versión que dice **LTS**
3. Instálala aceptando todas las opciones por defecto

> Si la laptop ya tiene Node.js, sáltate este paso.

### Cada vez: arrancar el juego

Doble clic en **`INICIAR-JUEGO.bat`**

Eso es todo. El script:
- revisa que Node.js esté instalado,
- instala las dependencias la primera vez (necesita internet **solo esa vez**, tarda ~1 minuto),
- arranca los dos servidores,
- abre el navegador en el juego,
- y muestra la dirección para que otros se conecten.

Para cerrar todo: presiona una tecla en la ventana negra.

---

## 3. Jugar en equipo durante la presentación

La ventana negra muestra una dirección como `http://192.168.1.50:8080`.

Si los compañeros están en la **misma red Wi-Fi**, pueden abrir esa dirección en su celular o laptop y entrar a la misma partida:

1. Uno elige **Crear sala privada** → aparece un código de 5 letras.
2. Los demás escriben ese código en **Unirse**.
3. El anfitrión presiona **ENTER** para empezar.

Funciona hasta con 4 jugadores, más espectadores ilimitados.

> Si la red de la escuela bloquea la conexión entre dispositivos, usa el modo individual o crea una zona Wi-Fi desde un celular.

---

## 4. Guion sugerido para los 10 minutos

| Tiempo | Qué mostrar |
|---|---|
| 0:00–1:00 | **El juego funcionando.** Menú, los dibujos originales del equipo (nave, ovni, asteroide), y juegas 30 segundos. |
| 1:00–2:30 | **Mecánicas.** Pantalla *Cómo jugar*: los 5 tipos de enemigo, poderes, combo, oleadas infinitas. Muestra un jefe y la elección de cartas. |
| 2:30–4:00 | **Multijugador.** Dos ventanas (o un compañero) en la misma sala, y una tercera como espectador. Explica que el servidor es autoritativo: solo recibe los controles y envía 20 snapshots por segundo. |
| 4:00–5:30 | **Arquitectura en la nube.** Abre `docs/ARQUITECTURA.md` y explica el diagrama: EKS, Agones, el lobby que pide servidores, Lambda + DynamoDB para la tabla de líderes. |
| 5:30–7:00 | **Infraestructura como código.** Muestra la carpeta `terraform/` y los workflows en `.github/workflows/`: uno crea la infraestructura, otro despliega el juego. |
| 7:00–8:30 | **Autoescalado y pruebas.** Explica los tres niveles de autoescalado y abre `docs/PRUEBAS.md`: rampa, pico de 1,000 jugadores y la extrapolación a 20,000 espectadores. |
| 8:30–9:30 | **Monitoreo y costos.** El tablero de Grafana (`monitoring/`) y `docs/COSTOS.md`. |
| 9:30–10:00 | **Cierre.** Qué aprendieron y qué sigue. |

---

## 5. Qué decir si el profesor pregunta por AWS

Sé honesto: **la infraestructura está escrita y validada, pero no desplegada**, porque el clúster cuesta unos USD 0.30 por hora y se destruye al terminar.

Puedes demostrar que el código es real así:

```bash
cd terraform
terraform init -backend=false
terraform validate     # dice "Success! The configuration is valid."
terraform fmt -check -recursive
```

Y mostrar las pruebas automáticas, que **sí** se ejecutan en cualquier computadora:

```bash
npm test --prefix server      # 22 pruebas de la lógica del juego
node scripts/balance.mjs 100 1 novato   # simulador de balance
```

Si quieren desplegarlo de verdad antes de la presentación, los pasos están en el [README](README.md) (sección *Despliegue en AWS*). Toma unos 20 minutos crear todo y conviene destruirlo el mismo día.

---

## 6. Plan B si algo falla

| Problema | Solución |
|---|---|
| No abre el navegador | Escribe a mano `http://localhost:8080` |
| "No se encontró Node.js" | Instálalo desde <https://nodejs.org> y vuelve a ejecutar el `.bat` |
| Se ve el juego pero no carga | Presiona Ctrl + Shift + R para recargar sin caché |
| Falla la instalación | Necesita internet solo la primera vez. Si no hay, copia también las carpetas `server\node_modules` y `lobby\node_modules` desde la computadora original |
| Los compañeros no se conectan | Usen la dirección `http://IP:8080` que muestra la ventana negra, no `localhost` |
| El puerto está ocupado | El script libera los puertos solo; si insiste, reinicia la laptop |

**Recomendación:** lleva también capturas de pantalla y un video corto del juego en el celular, por si la laptop del salón da problemas.
