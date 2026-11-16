// Cliente mínimo de la API de Kubernetes usando la ServiceAccount del pod.
import https from 'node:https';
import fs from 'node:fs';

const SA = '/var/run/secrets/kubernetes.io/serviceaccount';
export const inCluster = fs.existsSync(`${SA}/token`);
export const namespace = inCluster
  ? fs.readFileSync(`${SA}/namespace`, 'utf8').trim()
  : process.env.NAMESPACE || 'astro';

const agent = inCluster ? new https.Agent({ ca: fs.readFileSync(`${SA}/ca.crt`), keepAlive: true }) : null;
const host = process.env.KUBERNETES_SERVICE_HOST || 'kubernetes.default.svc';
const port = process.env.KUBERNETES_SERVICE_PORT || 443;

export function k8s(method, path, body) {
  if (!inCluster) return Promise.reject(new Error('No se está ejecutando dentro de Kubernetes'));
  // El token proyectado rota: se lee en cada petición
  const token = fs.readFileSync(`${SA}/token`, 'utf8').trim();
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      host, port, path, method, agent,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { /* texto plano */ }
        if (res.statusCode >= 400) {
          const err = new Error(`K8s ${method} ${path} -> ${res.statusCode}: ${json?.message || data}`);
          err.status = res.statusCode;
          return reject(err);
        }
        resolve(json);
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
