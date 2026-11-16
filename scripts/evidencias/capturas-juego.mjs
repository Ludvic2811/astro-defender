// Toma automáticamente las capturas del videojuego para el reporte y la presentación.
// Uso: node scripts/evidencias/capturas-juego.mjs <URL> <carpeta-salida>
// Requiere playwright-core y Microsoft Edge (o Chrome con CHANNEL=chrome).
// Algunas escenas (oleada avanzada, jefe, pantalla final) se preparan desde la
// simulación local del navegador para no tener que jugar 10 minutos; el pie de
// figura del reporte lo indica.
import { chromium } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || '.';
const browser = await chromium.launch({ channel: process.env.CHANNEL || 'msedge', headless: true });
const errores = [];
const espera = (p, ms) => p.waitForTimeout(ms);

async function nuevaPagina(tag, nombre) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', (e) => errores.push(`[${tag}] ${e.message}`));
  await page.goto(URL);
  await page.waitForFunction(() => window.ASTRO?.game?.scene?.isActive('Menu'), null, { timeout: 20000 });
  await espera(page, 900);
  if (nombre) await page.fill('input.astro-input', nombre);
  return page;
}
async function clic(page, x, y) {
  const box = await page.locator('canvas').boundingBox();
  const s = box.width / 800;
  await page.mouse.click(box.x + x * s, box.y + y * s);
}
const foto = (page, nombre) => page.locator('canvas').screenshot({ path: `${OUT}/${nombre}.png` });
const sim = (page, fn, arg) => page.evaluate(fn, arg);
// Mantener disparo y moverse un poco
async function jugar(page, ms) {
  await page.keyboard.down('Space');
  const fin = Date.now() + ms;
  let izq = true;
  while (Date.now() < fin) {
    const k = izq ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k); await espera(page, 450); await page.keyboard.up(k);
    izq = !izq;
  }
  await page.keyboard.up('Space');
}
const juego = () => window.ASTRO.game.scene.getScene('Game');

// 1. Menú y 2. selección de misión
const a = await nuevaPagina('A', 'Piloto');
await foto(a, '01_menu_principal');
await clic(a, 400, 306);
await espera(a, 900);
await foto(a, '02_seleccion_mision');

// 3. Partida individual (oleadas 1-2 jugadas de verdad, con invulnerabilidad para no morir)
await clic(a, 400, 188);
await espera(a, 2500);
await sim(a, () => { const g = window.ASTRO.game.scene.getScene('Game'); g.source.sim.players.get(1).inv = 999; });
await jugar(a, 9000);
await foto(a, '03_partida_individual');

// 4. Oleada avanzada con los cinco tipos de enemigo
await sim(a, () => { const s = window.ASTRO.game.scene.getScene('Game').source.sim; s.enemies = []; s.startWave(12); });
await jugar(a, 7000);
await foto(a, '04_enemigos_oleada_12');

// 5. Jefe (nave nodriza)
await sim(a, () => { const s = window.ASTRO.game.scene.getScene('Game').source.sim; s.enemies = []; s.startWave(10); });
await jugar(a, 6500);
await foto(a, '05_jefe_nave_nodriza');

// 6. Cartas de mejora tras vencer al jefe
await sim(a, () => { const s = window.ASTRO.game.scene.getScene('Game').source.sim; s.enemies = []; s.startUpgrade(); });
await espera(a, 1500);
await foto(a, '06_cartas_de_mejora');
await sim(a, () => window.ASTRO.game.scene.getScene('Game').source.pick(0));
await espera(a, 1200);

// 9. Pantalla final: el piloto pierde su última vida contra un enemigo
await sim(a, () => {
  const s = window.ASTRO.game.scene.getScene('Game').source.sim;
  const p = s.players.get(1); p.lives = 1; p.inv = 0; p.shield = false;
  s.spawnBoss && s.enemies.length === 0 && s.startWave(s.wave + 1);
  for (const e of s.enemies) { e.x = p.x; e.y = p.y; }
});
await espera(a, 200);
await sim(a, () => {
  const s = window.ASTRO.game.scene.getScene('Game').source.sim; const p = s.players.get(1);
  if (s.state !== 'gameover') { p.lives = 1; p.inv = 0; p.shield = false; for (const e of s.enemies) { e.x = p.x; e.y = p.y; } }
});
await a.waitForFunction(() => window.ASTRO.game.scene.getScene('Game').overlayType === 'result', null, { timeout: 15000 }).catch(() => {});
await espera(a, 2200);
await foto(a, '09_pantalla_de_resultados');

// 7. Partida cooperativa: dos pilotos en la misma sala (partida rápida)
const h = await nuevaPagina('H', 'Ana');
await clic(h, 400, 306); await espera(h, 600);
await clic(h, 400, 290); await espera(h, 2500);
const b = await nuevaPagina('B', 'Beto');
await clic(b, 400, 306); await espera(b, 600);
await clic(b, 400, 290); await espera(b, 2500);
await foto(h, '07a_sala_cooperativa');
await h.keyboard.press('Enter');
await espera(h, 2500);
await Promise.all([jugar(h, 12000), jugar(b, 12000)]);
await foto(h, '07_partida_cooperativa');

// 10. Espectador de la partida en curso
const e = await nuevaPagina('E');
await clic(e, 400, 466); await espera(e, 2000);
await foto(e, '10a_partidas_en_vivo');
await clic(e, 650, 150);
await espera(e, 2500);
await foto(e, '10_vista_espectador');

// 8. Tabla de líderes
const l = await nuevaPagina('L');
await clic(l, 400, 414); await espera(l, 1800);
await foto(l, '08_tabla_de_lideres');

console.log('Errores de página:', errores.length ? errores.join('\n') : 'ninguno');
await browser.close();
