// Captura páginas web públicas (GitHub, el juego desplegado, Grafana).
// Uso: node capturas-web.mjs <salida.png> <url> [alto] [esperaMs] [usuario:contraseña-de-grafana]
import { chromium } from 'playwright-core';

const [, , salida, url, alto = '1000', espera = '2500', cred] = process.argv;
const b = await chromium.launch({ channel: process.env.CHANNEL || 'msedge', headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: Number(alto) }, deviceScaleFactor: 1.5, locale: 'es-MX', colorScheme: 'light' });
const p = await ctx.newPage();
if (cred) {
  // Inicio de sesión en Grafana por formulario (la contraseña no aparece en la captura)
  const [u, pw] = cred.split(':');
  const base = new URL(url).origin;
  await p.goto(`${base}/login`);
  await p.fill('input[name="user"]', u);
  await p.fill('input[name="password"]', pw);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(2500);
}
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await p.waitForTimeout(Number(espera));
await p.screenshot({ path: salida });
await b.close();
