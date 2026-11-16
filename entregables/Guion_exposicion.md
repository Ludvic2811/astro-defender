# Guion de exposición: Astro Defender en AWS (10 minutos)

Presentación: `Presentacion_Astro_Defender.pptx` (10 diapositivas). Cada diapositiva repite este guion en sus notas del orador.

**Equipo:** Luis Sambrano Mendoza y Manuel Sambrano Mendoza.

**Reparto sugerido** (unos 5 minutos cada uno):

| Integrante | Diapositivas | Temas |
|---|---|---|
| Luis Sambrano Mendoza | 1 a 5 | Juego, mecánicas, arquitectura, Kubernetes y Agones |
| Manuel Sambrano Mendoza | 6 a 10 | Terraform y CI/CD, serverless, autoescalado, resultados y conclusiones |

---

## 0:00 – 0:45 · Portada (diapositiva 1)

> «Presentamos **Astro Defender**, nuestro juego de naves cooperativo, y cómo lo lanzamos en Amazon Web Services siguiendo el proyecto integrador de la unidad. Todo lo que van a ver se ejecutó de verdad el 16 de noviembre: el despliegue, las pruebas con 1,000 jugadores simulados y las métricas. Al terminar destruimos la infraestructura para no generar costos.»

## 0:45 – 1:45 · El videojuego (diapositiva 2) · DEMO DEL JUEGO

1. Doble clic en `INICIAR-JUEGO.bat` (o abrir <http://localhost:8080>) y jugar unos 30 segundos.
2. Señalar que la nave, el ovni y el asteroide son **dibujos del equipo**.
3. Mencionar el cooperativo de 2 a 4 pilotos, la tabla de líderes y el modo espectador.

> «Son oleadas infinitas: la partida termina cuando caen todos los pilotos y el objetivo es superar tu récord.»

## 1:45 – 2:45 · Mecánicas y servidor autoritativo (diapositiva 3)

> «El servidor simula todo a 60 Hz y manda 20 instantáneas por segundo; el navegador solo envía controles. Así nadie puede hacer trampa y todos ven lo mismo. Para que se sienta inmediato, el cliente interpola 100 ms y predice su propia nave.»

Mostrar el jefe y las cartas de mejora.

## 2:45 – 3:45 · Arquitectura (diapositiva 4)

Recorrer el diagrama de izquierda a derecha:

1. El jugador abre la web del **lobby**, que está detrás de un balanceador en EKS.
2. Al pedir partida, el lobby crea un **GameServerAllocation** y **Agones** le da un servidor dedicado.
3. El navegador se conecta por **WebSocket directo al puerto del nodo**.
4. La **tabla de líderes** es aparte: API Gateway → Lambda → DynamoDB.
5. **Terraform** crea todo y **GitHub Actions** despliega.

## 3:45 – 4:45 · Kubernetes y Agones (diapositiva 5)

> «Cada partida es un GameServer de Agones: nace Ready, pasa a Allocated cuando llega un jugador y se apaga solo cuando la sala queda vacía. El código de la sala, LJ7RC, es literalmente el final del nombre del GameServer. Cada partida tiene recursos definidos: 50 milicores de CPU y 96 MB, y las actualizaciones no cortan partidas porque Agones solo reemplaza servidores Ready.»

## 4:45 – 5:45 · Terraform y CI/CD (diapositiva 6)

> «Terraform creó 88 recursos en 19 minutos con el estado guardado en S3 y bloqueo. Tenemos variables por entorno, dev y prod, y un presupuesto de 20 dólares con alertas. Cada push a main corre las pruebas, construye las imágenes, las sube a ECR con el hash del commit y actualiza la flota. GitHub no guarda llaves de AWS: pide credenciales temporales por OIDC.»

Si preguntan por fallos: el pipeline falló dos veces (confianza OIDC y un valor del FleetAutoscaler). Se corrigieron en el código y el siguiente commit desplegó solo.

## 5:45 – 6:30 · Serverless (diapositiva 7)

> «La tabla de líderes no necesita un servidor encendido. Con 100 usuarios durante 3 minutos respondió 12,864 peticiones con p95 de 150 ms. Encontramos un límite de la cuenta: solo 10 Lambdas concurrentes, que explica el 0.4 % de errores al inicio. Un millón de consultas cuesta 1.45 dólares; un servidor t3.small, 19.47 al mes aunque nadie juegue.»

## 6:30 – 8:00 · Autoescalado y pruebas de carga (diapositiva 8) · DEMO DEL AUTOESCALADO

**Opción A (infraestructura destruida):** usar la diapositiva y las capturas de Grafana de `docs/evidencias/` (`33_grafana_pico.png`, `33b_grafana_rampa_meseta.png`).

**Opción B (demo en vivo):** volver a desplegar unos 30 minutos antes; ver la sección «Demo en vivo» al final.

> «Lanzamos 1,000 jugadores simulados en 30 segundos. El FleetAutoscaler creó servidores en 18 segundos, el HPA llevó el lobby de 2 a 10 pods en 48 segundos y el Cluster Autoscaler agregó el primer nodo a los 138 segundos y luego varios de golpe, de 10 a 20 nodos.»

## 8:00 – 9:15 · Resultados y costos (diapositiva 9)

> «La curva de latencia se mantiene plana hasta unos 650 jugadores y cruza la meta de 80 milisegundos alrededor de 750: esa es nuestra capacidad con esta configuración, unos 75 jugadores por nodo de juego. En el pico llegamos a 925, pero ya con nodos al 90 % de CPU. Para 1,000 jugadores cuesta unos 1.58 dólares por hora, 0.0016 por jugador-hora. Con 20,000 espectadores el costo fuerte sería la salida de datos, unos 79 dólares por hora, y eso que mandamos instantáneas y no video.»

## 9:15 – 10:00 · Conclusiones (diapositiva 10)

> «Aprendimos que para un lanzamiento lo decisivo es anticipar la capacidad. Con un colchón fijo de 5 servidores falló el 75 % de las solicitudes; con un colchón del 25 % y reserva de nodos entraron 250 jugadores por minuto. Los siguientes pasos son los Counters de Agones, más cuota de Lambda y EC2, y un relé para espectadores. ¡Gracias! ¿Preguntas?»

---

## Preguntas probables

| Pregunta | Respuesta corta |
|---|---|
| ¿Está desplegado ahora? | Se desplegó y se probó el 16 de noviembre, y se destruyó al terminar. Las evidencias están en `docs/evidencias/` y el repositorio tiene los pipelines en verde. |
| ¿Por qué no Spot? | Una instancia Spot se puede reclamar con segundos de aviso y cortaría partidas en curso. |
| HPA vs. FleetAutoscaler vs. Cluster Autoscaler | El HPA cambia pods sin estado (lobby); el FleetAutoscaler cambia servidores de partida listos; el Cluster Autoscaler agrega o quita nodos cuando los pods no caben. |
| ¿Cómo detectan el drift? | `terraform plan`. Lo corrimos antes de destruir y solo marcó una anotación que aplicamos a mano a propósito. |
| ¿Hay streaming HLS? | No. Los espectadores reciben instantáneas por WebSocket (~98 kbps); un video HLS de 4,500 kbps usaría unas 46 veces más. |

## Demo en vivo del autoescalado (opcional, ~US$1)

```bash
aws login
cd terraform
terraform init -backend-config=backend.hcl
terraform apply -var-file=env/dev.tfvars        # ~20 min
# GitHub: Actions → Deploy → Run workflow       (~2 min)
aws eks update-kubeconfig --region us-east-1 --name astro-defender
kubectl get svc kube-prometheus-stack-grafana -n monitoring   # abrir Grafana (usuario admin)
bash scripts/evidencias/prueba-carga.sh spike 4 "SPIKE_USERS=300 HOLD_SECONDS=180"
# Al terminar la exposición:
bash scripts/predestroy.sh && terraform destroy -var-file=env/dev.tfvars
```
