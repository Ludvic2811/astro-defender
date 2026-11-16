#!/usr/bin/env bash
# Guarda la salida REAL de comandos de AWS y kubectl como evidencia de texto.
# Uso: bash scripts/evidencias/estado-aws.sh <sufijo>   (p. ej. "inicial" o "pico")
set -uo pipefail
cd "$(dirname "$0")/../.."
S="${1:-inicial}"; D=docs/evidencias/salidas; mkdir -p "$D"
R="${AWS_REGION:-us-east-1}"; C=astro-defender
run() { echo "\$ $*"; eval "$@" 2>&1; echo; }

{ run "aws eks describe-cluster --name $C --query 'cluster.{Nombre:name,Version:version,Estado:status,Plataforma:platformVersion,Creado:createdAt}' --output table"
  run "aws eks list-nodegroups --cluster-name $C --output text"
  run "kubectl get nodes -L node.kubernetes.io/instance-type,topology.kubernetes.io/zone"
} > "$D/eks_$S.txt"

run "aws ec2 describe-instances --filters Name=tag:eks:cluster-name,Values=$C Name=instance-state-name,Values=running --query 'Reservations[].Instances[].[InstanceId,InstanceType,Placement.AvailabilityZone,State.Name,LaunchTime]' --output table" > "$D/ec2_$S.txt"

{ for r in gameserver lobby; do
    run "aws ecr describe-images --repository-name $C/$r --query 'reverse(sort_by(imageDetails,&imagePushedAt))[:3].{Etiqueta:imageTags[0],Subida:imagePushedAt,MB:imageSizeInBytes}' --output table"
  done; } > "$D/ecr_$S.txt"

{ run "kubectl get fleet,fleetautoscaler -n astro"
  run "kubectl get gameservers -n astro"
  run "kubectl get hpa,deploy,svc -n astro"
} > "$D/agones_$S.txt"

run "kubectl get pods -A -o wide --sort-by=.metadata.namespace" > "$D/pods_$S.txt"

{ run "aws lambda get-function-configuration --function-name $C-leaderboard --query '{Funcion:FunctionName,Runtime:Runtime,MemoriaMB:MemorySize,TimeoutS:Timeout,Estado:State,Modificada:LastModified}' --output table"
  run "aws apigatewayv2 get-apis --query 'Items[?Name==\`$C-leaderboard\`].{Nombre:Name,Protocolo:ProtocolType,Endpoint:ApiEndpoint}' --output table"
  run "aws dynamodb describe-table --table-name $C-scores --query 'Table.{Tabla:TableName,Estado:TableStatus,Facturacion:BillingModeSummary.BillingMode,Elementos:ItemCount,Indices:length(GlobalSecondaryIndexes)}' --output table"
} > "$D/serverless_$S.txt"

python scripts/redactar.py "$D"/*_"$S".txt
echo "Evidencias '$S' guardadas en $D"
