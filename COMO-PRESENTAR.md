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

## 4. Guion de los 10 minutos

Usa la presentación `entregables/Presentacion_Astro_Defender.pptx`. El guion completo, con tiempos, frases y reparto entre integrantes, está en [entregables/Guion_exposicion.md](entregables/Guion_exposicion.md) y también en las notas del orador de cada diapositiva.

---

## 5. Qué decir si el profesor pregunta por AWS

**Sí se desplegó.** El 16 de noviembre de 2026:

- Terraform creó la infraestructura: EKS, Agones, Lambda, DynamoDB y lo demás.
- GitHub Actions publicó el juego en ECR y EKS.
- Se hicieron las pruebas con 1,000 jugadores y 500 espectadores simulados.
- Al terminar se destruyó todo con `terraform destroy`, para no seguir pagando.

Pruebas de que fue real:

- `docs/evidencias/`: capturas de Grafana, CloudWatch, GitHub Actions y salidas de `kubectl` y `aws`.
- `loadtest/resultados/`: CSV y reportes HTML de Locust, y series de Prometheus.
- El historial de *Actions* del repositorio, con los pipelines en verde.

Si quieren ver el autoescalado en vivo, sigue la sección «Demo en vivo» del guion. Hay que desplegar unos 30 minutos antes, y cuesta alrededor de un dólar.

Las pruebas automáticas también corren en cualquier computadora:

```bash
npm test --prefix server      # 22 pruebas de la lógica del juego
node scripts/balance.mjs 100 1 novato   # simulador de balance
```

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
