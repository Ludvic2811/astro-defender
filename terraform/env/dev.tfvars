# Entorno de desarrollo / pruebas de carga de la materia.
# Uso: terraform apply -var-file=env/dev.tfvars
environment        = "dev"
node_instance_type = "t3.large"
node_min           = 2
node_desired       = 2
node_max           = 20 # cuota de la cuenta: 64 vCPU (aumento aprobado el 16-nov-2026)
grafana_public     = true
budget_limit_usd   = 20
