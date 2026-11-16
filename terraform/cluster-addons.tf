# Componentes que se instalan dentro del clúster con Helm.

resource "kubernetes_namespace" "astro" {
  metadata {
    name = "astro"
  }
  depends_on = [module.eks]
}

# Configuración que lee el lobby (URL pública de la API de líderes)
resource "kubernetes_config_map" "astro" {
  metadata {
    name      = "astro-config"
    namespace = kubernetes_namespace.astro.metadata[0].name
  }
  data = {
    LEADERBOARD_API_URL = "${aws_apigatewayv2_api.leaderboard.api_endpoint}/scores"
  }
}

# ------------------------------------------------------------------ Monitoreo
resource "helm_release" "kube_prometheus_stack" {
  # Ver la nota de depends_on en helm_release.agones
  name             = "kube-prometheus-stack"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = var.kube_prometheus_stack_version
  namespace        = "monitoring"
  create_namespace = true
  timeout          = 900

  values = [yamlencode({
    alertmanager = { enabled = false }
    prometheus = {
      prometheusSpec = {
        serviceMonitorSelectorNilUsesHelmValues = false
        podMonitorSelectorNilUsesHelmValues     = false
        retention                               = "3d"
        # Que el Cluster Autoscaler no retire el nodo de Prometheus al reducir:
        # sin volumen persistente, se perdería el historial de las pruebas.
        podMetadata = { annotations = { "cluster-autoscaler.kubernetes.io/safe-to-evict" = "false" } }
        resources = {
          requests = { cpu = "200m", memory = "512Mi" }
        }
      }
    }
    grafana = {
      adminPassword = var.grafana_admin_password
      service       = { type = var.grafana_public ? "LoadBalancer" : "ClusterIP" }
      sidecar = {
        dashboards = { enabled = true, searchNamespace = "ALL" }
      }
    }
  })]

  depends_on = [module.eks, module.vpc]
}

resource "kubernetes_config_map" "grafana_dashboard" {
  metadata {
    name      = "astro-dashboard"
    namespace = "monitoring"
    labels = {
      grafana_dashboard = "1"
    }
  }
  data = {
    "astro-defender.json" = file("${path.module}/../monitoring/grafana-dashboard.json")
  }
  depends_on = [helm_release.kube_prometheus_stack]
}

resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"
  depends_on = [module.eks]
}

# ------------------------------------------------------------------ Agones
resource "helm_release" "agones" {
  name             = "agones"
  repository       = "https://agones.dev/chart/stable"
  chart            = "agones"
  version          = var.agones_version
  namespace        = "agones-system"
  create_namespace = true
  timeout          = 900

  values = [yamlencode({
    gameservers = {
      namespaces = [kubernetes_namespace.astro.metadata[0].name]
      minPort    = 7000
      maxPort    = 8000
    }
    agones = {
      # El sidecar del SDK usa ~3m de CPU medidos; el valor por defecto reserva 30m
      # por GameServer. Bajarlo a 10m permite ~25 % más partidas por nodo.
      image = { sdk = { cpuRequest = "10m", cpuLimit = "100m" } }
      ping  = { install = false }
      allocator = {
        service = { serviceType = "ClusterIP" } # se asigna vía API de Kubernetes, no hace falta exponerlo
      }
      metrics = {
        prometheusEnabled          = true
        prometheusServiceDiscovery = true
        serviceMonitor             = { enabled = true }
      }
    }
  })]

  # module.vpc: al destruir, la VPC (y su Internet Gateway) se borra DESPUÉS de Agones.
  # Sin esto, Terraform quitaba el gateway en paralelo, los nodos perdían Internet y el
  # hook de limpieza de Agones no podía descargar su imagen (pasó el 16-nov-2026).
  depends_on = [helm_release.kube_prometheus_stack, kubernetes_namespace.astro, module.vpc]
}

# ------------------------------------------------------------------ Cluster Autoscaler
# Añade nodos EC2 cuando hay pods pendientes (p. ej. GameServers sin espacio) y
# los retira cuando sobran. Usa EKS Pod Identity para obtener permisos.
resource "aws_iam_role" "cluster_autoscaler" {
  name = "${local.name}-cluster-autoscaler"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "pods.eks.amazonaws.com" }
      Action    = ["sts:AssumeRole", "sts:TagSession"]
    }]
  })
}

resource "aws_iam_role_policy" "cluster_autoscaler" {
  name = "cluster-autoscaler"
  role = aws_iam_role.cluster_autoscaler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeScalingActivities",
          "autoscaling:DescribeTags",
          "ec2:DescribeImages",
          "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplateVersions",
          "ec2:GetInstanceTypesFromInstanceRequirements",
          "eks:DescribeNodegroup",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["autoscaling:SetDesiredCapacity", "autoscaling:TerminateInstanceInAutoScalingGroup"]
        Resource = "*"
        Condition = {
          StringEquals = { "aws:ResourceTag/k8s.io/cluster-autoscaler/${module.eks.cluster_name}" = "owned" }
        }
      },
    ]
  })
}

resource "aws_eks_pod_identity_association" "cluster_autoscaler" {
  cluster_name    = module.eks.cluster_name
  namespace       = "kube-system"
  service_account = "cluster-autoscaler"
  role_arn        = aws_iam_role.cluster_autoscaler.arn
}

resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  version    = var.cluster_autoscaler_chart_version
  namespace  = "kube-system"

  values = [yamlencode({
    awsRegion     = var.region
    autoDiscovery = { clusterName = module.eks.cluster_name }
    rbac = {
      serviceAccount = { create = true, name = "cluster-autoscaler" }
    }
    extraArgs = {
      expander                        = "least-waste"
      "balance-similar-node-groups"   = true
      "skip-nodes-with-system-pods"   = false
      "scale-down-unneeded-time"      = "3m"
      "scale-down-delay-after-add"    = "3m"
      "skip-nodes-with-local-storage" = false
    }
    serviceMonitor = { enabled = true, namespace = "kube-system" }
  })]

  depends_on = [aws_eks_pod_identity_association.cluster_autoscaler, helm_release.kube_prometheus_stack]
}
