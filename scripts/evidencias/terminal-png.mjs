// Convierte la salida REAL de un comando (archivo de texto) en una imagen con
// aspecto de terminal, para insertarla en el reporte. No modifica el contenido,
// solo recorta líneas si se piden (--desde/--hasta) y conserva el texto tal cual.
// Uso: node terminal-png.mjs <entrada.txt> <salida.png> "<título>" [maxLineas] [anchoPx]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const [, , entrada, salida, titulo = '', maxL = '60', ancho = '1100'] = process.argv;
let lineas = readFileSync(entrada, 'utf8').replace(/\r/g, '').replace(/\x1b\[[0-9;]*m/g, '').split('\n');
while (lineas.length && !lineas.at(-1).trim()) lineas.pop();
const max = Number(maxL);
if (lineas.length > max) lineas = [...lineas.slice(0, max - 1), `… (${lineas.length - max + 1} líneas más en ${entrada.split(/[\/]/).pop()})`];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cuerpo = lineas.map((l) => {
  let h = esc(l);
  if (/^\$ /.test(l)) h = `<span class="cmd">${h}</span>`;
  else if (/(✓|✔|\bOK\b|Running|Ready|Allocated|Success|success|ACTIVE|Apply complete|pass \d)/.test(l)) h = `<span class="ok">${h}</span>`;
  else if (/(Error|error|FAIL|fail [1-9]|Failed)/.test(l)) h = `<span class="err">${h}</span>`;
  return h;
}).join('\n');
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;font-family:Consolas,'Cascadia Mono',monospace}
.win{width:${ancho}px;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px #0003;border:1px solid #c9ced6}
.bar{background:#e8ebef;padding:8px 12px;font:600 13px 'Segoe UI',sans-serif;color:#333;display:flex;gap:8px;align-items:center}
.dot{width:11px;height:11px;border-radius:50%;display:inline-block}
pre{margin:0;padding:14px 16px;background:#0f1720;color:#d7dde4;font-size:13px;line-height:1.38;white-space:pre-wrap;word-break:break-all}
.cmd{color:#7cc4ff;font-weight:700}.ok{color:#7ee2a8}.err{color:#ff8f8f}
</style><div class="win"><div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span>&nbsp;${esc(titulo)}</div><pre>${cuerpo}</pre></div>`;
const b = await chromium.launch({ channel: process.env.CHANNEL || 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: Number(ancho) + 20, height: 400 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.locator('.win').screenshot({ path: salida });
await b.close();
