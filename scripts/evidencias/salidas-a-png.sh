#!/usr/bin/env bash
# Convierte las salidas de texto en imágenes numeradas para el reporte.
# Uso: bash scripts/evidencias/salidas-a-png.sh <sufijo>   (requiere playwright-core en PW_DIR)
set -euo pipefail
cd "$(dirname "$0")/../.."
S="${1:-inicial}"; D="$(pwd)/docs/evidencias"; PW_DIR="${PW_DIR:?ruta con node_modules/playwright-core}"
cp scripts/evidencias/terminal-png.mjs "$PW_DIR/"
png() { [ -f "$D/salidas/$1" ] && (cd "$PW_DIR" && node terminal-png.mjs "$D/salidas/$1" "$D/$2" "$3" "${4:-48}" "${5:-1150}") && echo "ok $2" || echo "falta $1"; }
png terraform_plan_resumen.txt 14_terraform_plan.png "terraform plan -var-file=env/dev.tfvars (estado remoto en S3)" 40
png terraform_apply_resumen.txt 15_terraform_apply.png "terraform apply: infraestructura creada" 40
png "eks_$S.txt" "16_aws_eks_nodos_$S.png" "Amazon EKS: clúster y nodos EC2 ($S)" 48
png "ec2_$S.txt" "17_aws_ec2_instancias_$S.png" "Amazon EC2: instancias del clúster ($S)" 48
png "ecr_$S.txt" "18_aws_ecr_imagenes_$S.png" "Amazon ECR: imágenes etiquetadas por commit" 40
png "agones_$S.txt" "19_agones_gameservers_$S.png" "Kubernetes + Agones: Fleet, FleetAutoscaler, GameServers y HPA ($S)" 60
png "pods_$S.txt" "19b_kubernetes_pods_$S.png" "Kubernetes: pods de todo el clúster ($S)" 60 1400
png "serverless_$S.txt" "25_serverless_lambda_apigw_dynamodb.png" "AWS Lambda + API Gateway + DynamoDB" 40
