#!/usr/bin/env bash
# Borra recursos que Kubernetes/EKS deja en la VPC y que bloquean "terraform destroy":
#  - interfaces de red "available" del CNI de VPC (descripción aws-K8S-...)
#  - security groups k8s-elb-... de los balanceadores clásicos
# Ejecútalo en otra terminal si "terraform destroy" se queda varios minutos en la
# subred, el security group de los nodos o la VPC (pasó el 16-nov-2026).
# Uso: bash scripts/limpiar-huerfanos.sh [region] [nombre-de-la-vpc]
set -uo pipefail
export MSYS_NO_PATHCONV=1
REGION="${1:-us-east-1}"; NOMBRE="${2:-astro-defender}"
VPC=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=tag:Name,Values=$NOMBRE" --query 'Vpcs[0].VpcId' --output text)
[ "$VPC" = "None" ] && { echo "No existe la VPC $NOMBRE"; exit 0; }
for eni in $(aws ec2 describe-network-interfaces --region "$REGION" --filters "Name=vpc-id,Values=$VPC" "Name=status,Values=available" \
    --query 'NetworkInterfaces[?starts_with(Description, `aws-K8S`)].NetworkInterfaceId' --output text); do
  echo "Borrando ENI huérfana $eni"; aws ec2 delete-network-interface --region "$REGION" --network-interface-id "$eni"
done
for sg in $(aws ec2 describe-security-groups --region "$REGION" --filters "Name=vpc-id,Values=$VPC" \
    --query 'SecurityGroups[?starts_with(GroupName, `k8s-elb-`)].GroupId' --output text); do
  echo "Borrando security group huérfano $sg"; aws ec2 delete-security-group --region "$REGION" --group-id "$sg"
done
echo "Listo."
