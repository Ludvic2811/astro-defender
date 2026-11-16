# Entorno de producción (lanzamiento). Más nodos base y presupuesto mayor.
# Uso: terraform workspace select -or-create prod && terraform apply -var-file=env/prod.tfvars
environment        = "prod"
node_instance_type = "c6i.xlarge"
node_min           = 3
node_desired       = 3
node_max           = 30
grafana_public     = false
budget_limit_usd   = 300
