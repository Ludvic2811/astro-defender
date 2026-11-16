variable "region" {
  description = "Región de AWS"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Prefijo para nombrar los recursos"
  type        = string
  default     = "astro-defender"
}

variable "cluster_version" {
  description = "Versión de Kubernetes en EKS (debe estar soportada por la versión de Agones)"
  type        = string
  default     = "1.35"
}

variable "agones_version" {
  description = "Versión del chart de Agones (1.60 soporta Kubernetes 1.34-1.36)"
  type        = string
  default     = "1.60.0"
}

variable "node_instance_type" {
  description = "Tipo de instancia EC2 de los nodos"
  type        = string
  # t3.large: 2 vCPU como t3.medium, pero admite 35 pods por nodo (t3.medium solo 17),
  # así caben ~28 GameServers por nodo y 250 partidas no rebasan la cuota de 32 vCPU.
  default = "t3.large"
}

variable "node_min" {
  type    = number
  default = 2
}

variable "node_desired" {
  type    = number
  default = 2
}

variable "node_max" {
  description = "Máximo de nodos para el Cluster Autoscaler (15 × 2 vCPU = 30, bajo la cuota de 32 vCPU)"
  type        = number
  default     = 15
}

variable "grafana_admin_password" {
  description = "Contraseña del usuario admin de Grafana"
  type        = string
  sensitive   = true
}

variable "grafana_public" {
  description = "Exponer Grafana con un LoadBalancer público (si es false, usar kubectl port-forward)"
  type        = bool
  default     = true
}

variable "enable_container_insights" {
  description = "Instalar el add-on de CloudWatch Observability (Container Insights)"
  type        = bool
  default     = true
}

variable "admin_principal_arns" {
  description = "ARNs IAM adicionales con acceso de administrador al clúster (p. ej. el usuario de GitHub Actions)"
  type        = list(string)
  default     = []
}

variable "kube_prometheus_stack_version" {
  description = "Versión del chart kube-prometheus-stack (null = la más reciente)"
  type        = string
  default     = null
}

variable "cluster_autoscaler_chart_version" {
  description = "Versión del chart cluster-autoscaler (null = la más reciente)"
  type        = string
  default     = null
}

variable "environment" {
  description = "Entorno (dev o prod); se usa en etiquetas y en los archivos env/*.tfvars"
  type        = string
  default     = "dev"
}

variable "budget_limit_usd" {
  description = "Límite mensual del presupuesto de AWS en dólares"
  type        = number
  default     = 20
}

variable "budget_email" {
  description = "Correo que recibe las alertas del presupuesto (vacío = sin presupuesto)"
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "Repositorio de GitHub (propietario/nombre) autorizado a desplegar por OIDC. Vacío = no crear el rol"
  type        = string
  default     = ""
}
