#!/usr/bin/env bash
# Crea (una sola vez) el bucket S3 donde Terraform guarda su estado.
# Uso: bash scripts/bootstrap-state.sh <nombre-unico-del-bucket> [region]
set -euo pipefail

BUCKET="${1:?Indica el nombre del bucket, p. ej. astro-defender-tfstate-equipo7}"
REGION="${2:-us-east-1}"

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "El bucket $BUCKET ya existe."
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

cat <<EOF

Listo. Crea terraform/backend.hcl con:

bucket       = "$BUCKET"
key          = "astro-defender/terraform.tfstate"
region       = "$REGION"
use_lockfile = true
encrypt      = true

y en GitHub agrega el secreto TF_STATE_BUCKET=$BUCKET
EOF
