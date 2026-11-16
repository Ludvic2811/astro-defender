// Genera la presentación de 10 minutos con capturas reales y gráficas nativas.
// Uso (desde la raíz del repo): NODE_PATH=<carpeta con pptxgenjs> node scripts/evidencias/generar-presentacion.js
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const EV = 'docs/evidencias';
const R = JSON.parse(fs.readFileSync(`${EV}/resultados.json`, 'utf8'));
const C = JSON.parse(fs.readFileSync(`${EV}/costos.json`, 'utf8'));
const OUT = 'entregables/Presentacion_Astro_Defender.pptx';

// Paleta clara: fondo blanco, tinta azul noche, acentos naranja (propulsor) y verde agua
const T = {
  ink: '14213D', ink2: '4A5568', muted: '718096', bg: 'FFFFFF', tint: 'EEF3FA',
  orange: 'E8663D', teal: '1B9C85', blue: '2A78D6', line: 'D5DCE6',
};
const FONT = 'Century Gothic';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
pres.author = 'Equipo Astro Defender';
pres.title = 'Astro Defender: lanzamiento en AWS';
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

pres.defineSlideMaster({
  title: 'CONTENIDO',
  background: { color: T.bg },
  objects: [
    { text: { text: 'Astro Defender · Cómputo en la Nube · Unidad 3', options: { x: 0.5, y: 7.05, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: T.muted } } },
  ],
  slideNumber: { x: 12.4, y: 7.05, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: T.muted },
});

const img = (n) => path.resolve(EV, n);
function titulo(s, t, sub) {
  s.addText(t, { x: 0.5, y: 0.35, w: 12.3, h: 0.75, fontFace: FONT, fontSize: 32, bold: true, color: T.ink, margin: 0, isTextBox: true });
  if (sub) s.addText(sub, { x: 0.5, y: 1.08, w: 12.3, h: 0.45, fontFace: FONT, fontSize: 16, color: T.ink2, margin: 0, isTextBox: true });
}
function foto(s, n, x, y, w, h, pie) {
  s.addImage({ path: img(n), x, y, w, h, sizing: { type: 'contain', w, h } });
  if (pie) s.addText(pie, { x, y: y + h + 0.05, w, h: 0.32, fontFace: FONT, fontSize: 11, color: T.muted, margin: 0, isTextBox: true });
}
function dato(s, x, y, w, valor, etiqueta, color = T.orange) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 1.35, fill: { color: T.tint }, line: { color: T.tint }, rectRadius: 0.12 });
  s.addText(valor, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.72, fontFace: FONT, fontSize: 30, bold: true, color, margin: 0, isTextBox: true });
  s.addText(etiqueta, { x: x + 0.2, y: y + 0.8, w: w - 0.4, h: 0.48, fontFace: FONT, fontSize: 12, color: T.ink2, margin: 0, valign: 'top', isTextBox: true });
}
function vinetas(s, items, x, y, w, h, tam = 16) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
    { x, y, w, h, fontFace: FONT, fontSize: tam, color: T.ink, paraSpaceAfter: 8, valign: 'top', margin: 0, isTextBox: true });
}
const n0 = (v) => (v == null ? 'n/d' : Math.round(v).toLocaleString('es-MX'));
const pico = R.spike || {}, rampa = R.ramp || {}, esp = R.spectators || {}, lid = R.lideres || {};
const ccuMax = Math.max(pico.ccu_max || 0, rampa.ccu_max || 0);
const mejor = (pico.ccu_max || 0) >= (rampa.ccu_max || 0) ? pico : rampa;

// 1. Portada (fondo oscuro con captura del juego)
let s = pres.addSlide();
s.background = { color: '0B1430' };
s.addImage({ path: img('26b_aws_menu_principal.png'), x: 7.1, y: 0.9, w: 5.6, h: 4.2, sizing: { type: 'contain', w: 5.6, h: 4.2 } });
s.addText('Astro Defender', { x: 0.6, y: 1.5, w: 6.4, h: 1.0, fontFace: FONT, fontSize: 48, bold: true, color: 'FFFFFF', margin: 0, isTextBox: true });
s.addText('Invasión Galáctica: lanzamiento en AWS', { x: 0.6, y: 2.5, w: 6.4, h: 0.6, fontFace: FONT, fontSize: 22, color: 'F6B26B', margin: 0, isTextBox: true });
s.addText('EKS + Agones · Terraform · GitHub Actions · Lambda + DynamoDB · Prometheus, Grafana y CloudWatch',
  { x: 0.6, y: 3.3, w: 6.2, h: 0.9, fontFace: FONT, fontSize: 15, color: 'C9D6EA', margin: 0, isTextBox: true });
s.addText('Cómputo en la Nube · Unidad 3 · Instituto Tecnológico de Colima\n16 de noviembre de 2026',
  { x: 0.6, y: 5.6, w: 8, h: 0.8, fontFace: FONT, fontSize: 14, color: 'C9D6EA', margin: 0, isTextBox: true });
s.addNotes('Guion (0:00-0:45). Presentamos Astro Defender, nuestro juego de naves cooperativo, y cómo lo lanzamos en AWS siguiendo el proyecto integrador. Todo lo que vamos a mostrar se ejecutó de verdad hoy: el despliegue, las pruebas de carga y las métricas. Al terminar destruimos la infraestructura para no generar costos.');

// 2. El videojuego
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'El videojuego', 'Naves 2D para navegador, solo o cooperativo de 2 a 4 pilotos, con dibujos originales del equipo');
foto(s, '01_menu_principal.png', 0.5, 1.75, 4.0, 3.0, 'Menú principal');
foto(s, '03_partida_individual.png', 4.67, 1.75, 4.0, 3.0, 'Partida individual');
foto(s, '27_aws_partida_cooperativa.png', 8.83, 1.75, 4.0, 3.0, 'Cooperativo en AWS');
vinetas(s, ['Oleadas infinitas con 5 tipos de enemigo y un jefe cada 5 oleadas',
  'Poderes, combo hasta ×5 y cartas de mejora al liberar un sector',
  'Tabla de líderes en la nube y modo espectador en vivo'], 0.5, 5.3, 12.3, 1.5, 16);
s.addNotes('Guion (0:45-1:45). DEMO EN VIVO: abrir el juego y jugar 30 segundos. Mostrar que la nave, el ovni y el asteroide son dibujos del equipo. Explicar que es cooperativo de hasta 4 pilotos y que hay espectadores.');

// 3. Mecánicas y funcionamiento
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Mecánicas y servidor autoritativo', 'El servidor simula todo; el navegador solo envía controles y dibuja');
foto(s, '05_jefe_nave_nodriza.png', 0.5, 1.75, 4.6, 3.45, 'Jefe: nave nodriza con 3 patrones');
foto(s, '06_cartas_de_mejora.png', 5.3, 1.75, 4.6, 3.45, 'Cartas de mejora tras vencer al jefe');
dato(s, 10.15, 1.75, 2.7, '60 Hz', 'simulación en el servidor (Node.js)', T.blue);
dato(s, 10.15, 3.25, 2.7, '20 Hz', 'instantáneas a jugadores y espectadores', T.teal);
dato(s, 10.15, 4.75, 2.7, '100 ms', 'interpolación + predicción local', T.orange);
s.addText('Mismo código de simulación (shared/sim.js) en el navegador para el modo individual y en el servidor para el cooperativo.',
  { x: 0.5, y: 5.75, w: 9.4, h: 0.7, fontFace: FONT, fontSize: 14, color: T.ink2, margin: 0, isTextBox: true });
s.addNotes('Guion (1:45-2:45). El servidor es autoritativo: evita trampas y mantiene a todos sincronizados. Recibe input, bomba, elección de carta; simula a 60 Hz y manda 20 instantáneas por segundo. El cliente interpola 100 ms y predice su propia nave para que se sienta inmediata.');

// 4. Arquitectura AWS
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Arquitectura en AWS');
s.addImage({ path: path.resolve('docs/diagramas/arquitectura.png'), x: 0.9, y: 1.2, w: 11.5, h: 5.7, sizing: { type: 'contain', w: 11.5, h: 5.7 } });
s.addNotes('Guion (2:45-3:45). Recorrer el diagrama: el lobby detrás del balanceador sirve la web y pide servidores a Agones con GameServerAllocation; el jugador se conecta por WebSocket directo al puerto del nodo. La tabla de líderes es serverless. Terraform crea todo y GitHub Actions despliega a ECR y EKS.');

// 5. Kubernetes y Agones
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Kubernetes y Agones', 'Cada partida es un GameServer: Ready → Allocated → se apaga al vaciarse');
foto(s, '19_agones_gameservers_inicial.png', 0.5, 1.75, 7.4, 4.3, 'kubectl: Fleet, FleetAutoscaler, GameServers y HPA (salida real)');
foto(s, '26_aws_sala_cooperativa_agones.png', 8.2, 1.75, 4.6, 3.45, 'La sala LJ7RC es el GameServer …-lj7rc');
vinetas(s, ['Recursos definidos: 50m CPU y 96 Mi por partida', 'RollingUpdate no toca partidas en curso'], 8.2, 5.65, 4.6, 1.2, 14);
s.addNotes('Guion (3:45-4:45). El código de la sala que ve el jugador es el final del nombre del GameServer. Agones lleva el ciclo de vida; el servidor usa el SDK para marcarse Ready, publicar jugadores y apagarse al quedar vacío. Las actualizaciones no cortan partidas porque Agones solo reemplaza servidores Ready.');

// 6. Terraform y CI/CD
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Terraform y CI/CD', 'Infraestructura como código con estado remoto; despliegue con credenciales temporales (OIDC)');
foto(s, '15_terraform_apply.png', 0.5, 1.75, 6.2, 3.25, 'terraform apply: 88 + 7 recursos, estado en S3');
foto(s, '13b_github_actions_deploy.png', 6.9, 1.75, 5.9, 3.7, 'Deploy en verde: pruebas → ECR → EKS');
vinetas(s, ['Variables por entorno: env/dev.tfvars y env/prod.tfvars', 'Imágenes etiquetadas con el commit (gameserver:<sha>)',
  'Presupuesto de US$20 con alertas por correo'], 0.5, 5.55, 6.2, 1.4, 14);
s.addNotes('Guion (4:45-5:45). Terraform crea VPC, EKS, nodos, ECR, IAM, Agones, Prometheus, Lambda y DynamoDB, y también los destruye. El estado vive en S3 con bloqueo. Cada push a main corre pruebas, construye las imágenes, las sube a ECR con el hash del commit y actualiza la flota. GitHub no guarda llaves de AWS: usa OIDC.');

// 7. Serverless
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Tabla de líderes serverless', 'API Gateway → Lambda (Node.js 22) → DynamoDB bajo demanda');
foto(s, '30_cloudwatch_lambda_invocaciones.png', 0.5, 1.75, 7.6, 3.1, 'CloudWatch: invocaciones y throttles durante la prueba');
dato(s, 8.4, 1.75, 2.1, n0(lid.peticiones), 'peticiones en 3 min (100 usuarios)', T.blue);
dato(s, 10.7, 1.75, 2.1, `${n0(lid.p95_ms)} ms`, 'latencia p95 desde México', T.teal);
dato(s, 8.4, 3.3, 2.1, `$${C.serverless_millon.toFixed(2)}`, 'por millón de consultas', T.orange);
dato(s, 10.7, 3.3, 2.1, `$${C.ec2_mes.toFixed(2)}`, 'al mes un servidor t3.small', T.ink2);
vinetas(s, ['Hallazgo: la cuenta solo permite 10 Lambdas concurrentes → 0.4 % de respuestas 503 al inicio',
  'Solución: pedir más concurrencia antes del lanzamiento'], 0.5, 5.3, 12.3, 1.3, 15);
s.addNotes('Guion (5:45-6:30). La tabla de líderes no necesita un servidor encendido: se paga por uso. La probamos con 100 usuarios: más de 12 mil peticiones con p95 de 150 ms. Encontramos un límite de la cuenta: 10 ejecuciones concurrentes de Lambda; eso explicó los pocos errores 503.');

// 8. Autoescalado y pruebas de carga (gráfica nativa de la flota en el pico)
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Autoescalado en tres capas', 'Pico de 1,000 jugadores simulados con Locust dentro del clúster');
foto(s, '33_grafana_pico.png', 0.5, 1.75, 6.6, 5.0);
const serie = JSON.parse(fs.readFileSync(`${EV}/serie_pico.json`, 'utf8'));
s.addChart(pres.charts.LINE, [
  { name: 'Allocated', labels: serie.min, values: serie.allocated },
  { name: 'Ready', labels: serie.min, values: serie.ready },
], {
  x: 7.3, y: 1.7, w: 5.5, h: 2.6, chartColors: [T.blue, T.orange], lineSize: 2, lineDataSymbol: 'none',
  showTitle: true, title: 'GameServers por estado', titleFontFace: FONT, titleFontSize: 13, titleColor: T.ink,
  showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 10,
  catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9, catAxisLabelColor: T.muted, catAxisTitle: 'minuto', showCatAxisTitle: true, catAxisTitleFontSize: 9,
  valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9, valAxisLabelColor: T.muted, valGridLine: { color: T.line, size: 0.5 }, catGridLine: { style: 'none' },
});
s.addChart(pres.charts.LINE, [{ name: 'Nodos EC2', labels: serie.min, values: serie.nodos }], {
  x: 7.3, y: 4.4, w: 5.5, h: 2.4, chartColors: [T.teal], lineSize: 2, lineDataSymbol: 'none',
  showTitle: true, title: 'Nodos EC2 (Cluster Autoscaler)', titleFontFace: FONT, titleFontSize: 13, titleColor: T.ink, showLegend: false,
  catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9, catAxisLabelColor: T.muted,
  valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9, valAxisLabelColor: T.muted, valGridLine: { color: T.line, size: 0.5 }, catGridLine: { style: 'none' },
});
s.addNotes('Guion (6:30-8:00). DEMO DEL AUTOESCALADO: mostrar el tablero de Grafana (o esta captura si el clúster ya se destruyó). FleetAutoscaler mantiene un colchón de servidores Ready, el HPA multiplica los pods del lobby y el Cluster Autoscaler agrega nodos EC2. Señalar en la gráfica cómo sube Allocated y cómo los nodos llegan unos 70-90 s después.');

// 9. Resultados y costos
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Resultados y costos', 'Datos medidos en AWS el 16 de noviembre de 2026');
dato(s, 0.5, 1.75, 2.9, n0(ccuMax), 'jugadores concurrentes (máx. medido)', T.blue);
dato(s, 3.6, 1.75, 2.9, `${n0(mejor.rtt_p95_carga_max_ms)} ms`, 'RTT p95 con carga máxima (meta 80 ms)', T.teal);
dato(s, 0.5, 3.25, 2.9, `${(mejor.tick_p99_max_ms || 0).toFixed(1)} ms`, 'tick p99 máximo (presupuesto 16.7 ms)', T.ink);
dato(s, 3.6, 3.25, 2.9, `${n0(pico.t_primer_nodo_nuevo_s)} s`, 'hasta el primer nodo EC2 nuevo', T.orange);
const fila1k = C.tabla[2];
dato(s, 0.5, 4.75, 2.9, `$${fila1k[2]}`, 'por hora para 1,000 jugadores', T.orange);
dato(s, 3.6, 4.75, 2.9, `$${fila1k[3]}`, 'por jugador-hora', T.blue);
const curva = JSON.parse(fs.readFileSync(`${EV}/serie_ccu_p95.json`, 'utf8'));
s.addChart(pres.charts.SCATTER, [
  { name: 'CCU', values: curva.ccu },
  { name: 'RTT p95 (ms)', values: curva.p95 },
], {
  x: 6.8, y: 1.7, w: 6.0, h: 4.4, chartColors: [T.blue], lineSize: 0, lineDataSymbolSize: 6,
  showTitle: true, title: 'CCU vs. latencia p95', titleFontFace: FONT, titleFontSize: 13, titleColor: T.ink, showLegend: false,
  valAxisTitle: 'RTT p95 (ms)', showValAxisTitle: true, valAxisTitleFontSize: 10, catAxisTitle: 'jugadores concurrentes', showCatAxisTitle: true, catAxisTitleFontSize: 10,
  catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9, catAxisLabelColor: T.muted,
  valAxisLabelFontFace: FONT, valAxisLabelFontSize: 9, valAxisLabelColor: T.muted, valGridLine: { color: T.line, size: 0.5 },
});
s.addText(`20,000 espectadores ≈ ${(20000 * C.kbps_por_espectador / 1e6).toFixed(2)} Gbps · ${n0(C.egress_20k_usd_h)} US$/h de salida`,
  { x: 6.8, y: 6.2, w: 6.0, h: 0.4, fontFace: FONT, fontSize: 13, color: T.ink2, margin: 0, isTextBox: true });
s.addNotes('Guion (8:00-9:15). La latencia se mantiene plana conforme crecen los jugadores: el límite no es la red ni el servidor sino crear partidas a tiempo. Explicar el costo por hora y por jugador y la extrapolación a 20,000 espectadores (instantáneas por WebSocket, no video HLS).');

// 10. Conclusiones
s = pres.addSlide({ masterName: 'CONTENIDO' });
titulo(s, 'Conclusiones y siguientes pasos');
vinetas(s, [
  'Todo se crea y se destruye con Terraform; despliegue automático por GitHub Actions',
  'Flota de Agones sana con recursos definidos y SDK integrado',
  'Tres capas de autoescalado medidas: flota (5 s), lobby (15-30 s) y nodos (~70-90 s)',
  'La primera rampa falló 75 % de asignaciones; con colchón proporcional y reserva de nodos mejoró',
  'Siguientes pasos: Counters de Agones, más cuota de Lambda/EC2 y relé de espectadores',
], 0.5, 1.4, 7.4, 5.0, 17);
foto(s, '09_pantalla_de_resultados.png', 8.3, 1.5, 4.5, 3.4, '¡Gracias! Preguntas');
s.addNotes('Guion (9:15-10:00). Cerrar con lo aprendido: medir antes de lanzar, anticipar capacidad y vigilar límites de la cuenta. Agradecer y abrir preguntas.');

fs.mkdirSync('entregables', { recursive: true });
pres.writeFile({ fileName: OUT }).then((f) => console.log('Presentación:', f));
