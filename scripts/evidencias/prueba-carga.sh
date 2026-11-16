#!/usr/bin/env bash
# Ejecuta una prueba de carga de Locust dentro del clúster EKS y descarga los resultados.
# Uso: bash scripts/evidencias/prueba-carga.sh <ramp|spike|spectators> <workers> "<VAR=valor ...>"
# Ejemplo: bash scripts/evidencias/prueba-carga.sh ramp 6 "RAMP_USERS=1000 HOLD_SECONDS=180"
set -euo pipefail
cd "$(dirname "$0")/../.."
export LOAD_SHAPE="$1" WORKERS="${2:-6}" SHAPE_ENV="LOAD_SHAPE=$1 ${3:-}" MATCH_SECONDS="${MATCH_SECONDS:-300}" EXTRA_ARGS="${EXTRA_ARGS:-}"
HOST=$(kubectl get svc astro-lobby -n astro -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
export LOBBY_URL="http://$HOST"
OUT="loadtest/resultados/$LOAD_SHAPE"; mkdir -p "$OUT"

kubectl create namespace loadtest --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl delete pod locust-master -n loadtest --ignore-not-found --wait=true >/dev/null
kubectl delete deployment locust-worker -n loadtest --ignore-not-found --wait=true >/dev/null
kubectl create configmap locustfile -n loadtest --from-file=loadtest/locustfile.py --dry-run=client -o yaml | kubectl apply -f - >/dev/null
envsubst '${LOBBY_URL} ${LOAD_SHAPE} ${WORKERS} ${SHAPE_ENV} ${MATCH_SECONDS} ${EXTRA_ARGS}' < k8s/loadtest/locust.yaml | kubectl apply -f -

kubectl wait --for=condition=Ready pod/locust-master -n loadtest --timeout=600s
INICIO=$(date -u +%s); echo "inicio=$INICIO" > "$OUT/ventana.txt"
echo "Prueba '$LOAD_SHAPE' en marcha contra $LOBBY_URL ($(date))"
until kubectl logs locust-master -n loadtest 2>/dev/null | grep -q LOCUST_TERMINADO; do sleep 20; done
FIN=$(date -u +%s); echo "fin=$FIN" >> "$OUT/ventana.txt"

kubectl logs locust-master -n loadtest > "$OUT/locust-master.log" 2>&1 || true
for f in $(kubectl exec locust-master -n loadtest -- sh -c 'ls /tmp/r'); do
  kubectl exec locust-master -n loadtest -- cat "/tmp/r/$f" > "$OUT/$f"
done
kubectl delete deployment locust-worker -n loadtest --wait=false
kubectl delete pod locust-master -n loadtest --wait=false
echo "Resultados en $OUT (ventana $INICIO-$FIN)"
