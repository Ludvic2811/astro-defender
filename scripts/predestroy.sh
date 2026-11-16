#!/usr/bin/env bash
# Elimina los recursos que Kubernetes creó por su cuenta en AWS (balanceadores de
# carga) antes de "terraform destroy"; si no, la VPC no se puede borrar.
# Uso: bash scripts/predestroy.sh [region] [cluster]
set -uo pipefail

REGION="${1:-us-east-1}"
CLUSTER="${2:-astro-defender}"

aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER" || exit 0

echo "Borrando FleetAutoscaler, Fleet y lobby..."
kubectl delete fleetautoscaler,fleet --all -n astro --ignore-not-found --wait=true --timeout=180s
kubectl delete -f "$(dirname "$0")/../k8s/lobby.yaml" --ignore-not-found --wait=true --timeout=180s

echo "Borrando servicios LoadBalancer restantes..."
kubectl get svc -A -o jsonpath='{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.namespace}{" "}{.metadata.name}{"\n"}{end}' |
  while read -r ns name; do
    [ -n "$name" ] && kubectl delete svc "$name" -n "$ns" --wait=true --timeout=180s
  done

echo "Esperando a que AWS elimine los balanceadores..."
sleep 60
echo "Listo para terraform destroy."
