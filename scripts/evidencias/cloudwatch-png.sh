#!/usr/bin/env bash
# Descarga gráficas renderizadas por CloudWatch (API GetMetricWidgetImage).
# Son las mismas gráficas que muestra la consola, con datos reales de la cuenta.
# Uso: bash cloudwatch-png.sh <salida.png> <inicio ISO|-PT3H> <fin ISO|PT0H> '<json metrics>' "<título>" [stat] [periodo]
set -euo pipefail
OUT="$1"; START="$2"; END="$3"; METRICS="$4"; TITLE="$5"; STAT="${6:-Average}"; PERIOD="${7:-60}"
WIDGET=$(cat <<JSON
{"width":1000,"height":420,"start":"$START","end":"$END","timezone":"-0600","title":"$TITLE",
 "stat":"$STAT","period":$PERIOD,"view":"timeSeries","stacked":false,"legend":{"position":"bottom"},
 "metrics":$METRICS}
JSON
)
aws cloudwatch get-metric-widget-image --region "${AWS_REGION:-us-east-1}" --metric-widget "$WIDGET" \
  --output-format png --query MetricWidgetImage --output text | tr -d '\r\n' | base64 -d > "$OUT"
echo "CloudWatch -> $OUT"
