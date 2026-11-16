module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.37"

  cluster_name    = local.name
  cluster_version = var.cluster_version

  cluster_endpoint_public_access           = true
  enable_cluster_creator_admin_permissions = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnets

  # Logs del plano de control en CloudWatch
  cluster_enabled_log_types = ["api", "authenticator"]

  cluster_addons = merge(
    {
      coredns                = {}
      kube-proxy             = {}
      vpc-cni                = { before_compute = true }
      eks-pod-identity-agent = { before_compute = true }
    },
    # Container Insights solo con métricas (sin recolectar logs de contenedores,
    # que es lo que más cuesta en CloudWatch)
    var.enable_container_insights ? {
      amazon-cloudwatch-observability = {
        configuration_values = jsonencode({ containerLogs = { enabled = false } })
      }
    } : {}
  )

  eks_managed_node_groups = {
    general = {
      ami_type       = "AL2023_x86_64_STANDARD" # EKS 1.33+ ya no publica AMIs de AL2
      instance_types = [var.node_instance_type]
      capacity_type  = "ON_DEMAND" # nada de Spot: cortaría partidas en curso
      min_size       = var.node_min
      desired_size   = var.node_desired
      max_size       = var.node_max

      iam_role_additional_policies = {
        cloudwatch = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
      }
      labels = {
        role = "general"
      }
    }
  }

  # Los jugadores se conectan directamente a los puertos de Agones en los nodos
  node_security_group_additional_rules = {
    agones_gameservers = {
      description = "Puertos de partidas Agones (WebSocket/TCP)"
      protocol    = "tcp"
      from_port   = 7000
      to_port     = 8000
      type        = "ingress"
      cidr_blocks = ["0.0.0.0/0"]
    }
    agones_webhooks = {
      description                   = "Webhooks de Agones desde el plano de control"
      protocol                      = "tcp"
      from_port                     = 8081
      to_port                       = 8081
      type                          = "ingress"
      source_cluster_security_group = true
    }
  }

  access_entries = merge({
    for i, arn in var.admin_principal_arns : "admin-${i}" => {
      principal_arn = arn
      policy_associations = {
        admin = {
          policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = { type = "cluster" }
        }
      }
    }
    },
    # Rol de GitHub Actions (solo para este repositorio, vía OIDC). Necesita aplicar
    # recursos de Agones (Fleet) y de Prometheus (PodMonitor), por eso es admin del clúster;
    # sus permisos en AWS se limitan a ECR y a describir el clúster.
    var.github_repository == "" ? {} : {
      github-actions = {
        principal_arn = aws_iam_role.github_deploy[0].arn
        policy_associations = {
          astro = {
            policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
            access_scope = { type = "cluster" }
          }
        }
      }
  })
}

# ------------------------------------------------------------------ ECR
resource "aws_ecr_repository" "repo" {
  for_each             = toset(["gameserver", "lobby"])
  name                 = "${local.name}/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "repo" {
  for_each   = aws_ecr_repository.repo
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar solo las últimas 15 imágenes"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 15 }
      action       = { type = "expire" }
    }]
  })
}
