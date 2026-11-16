# Despliegue desde GitHub Actions sin llaves de AWS guardadas en GitHub:
# el workflow obtiene credenciales temporales por OIDC y asume este rol.
# Solo se crea si se indica var.github_repository (propietario/nombre).

data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.github_repository == "" ? 0 : 1
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_deploy" {
  count = var.github_repository == "" ? 0 : 1
  name  = "${local.name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github[0].arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        # Solo la rama main o el environment "production" de este repositorio
        # Se aceptan el formato clásico (repo:propietario/nombre) y el de "sujeto
        # inmutable" que GitHub usa en repositorios nuevos (repo:propietario@id/nombre@id).
        StringLike = {
          "token.actions.githubusercontent.com:sub" = flatten([
            for prefijo in compact(["repo:${var.github_repository}", var.github_oidc_sub_prefix]) : [
              "${prefijo}:ref:refs/heads/main",
              "${prefijo}:environment:production",
            ]
          ])
        }
      }
    }]
  })
}

# Permisos mínimos: subir imágenes a los dos repositorios de ECR y leer el clúster.
resource "aws_iam_role_policy" "github_deploy" {
  count = var.github_repository == "" ? 0 : 1
  name  = "deploy"
  role  = aws_iam_role.github_deploy[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CompleteLayerUpload",
          "ecr:DescribeImages", "ecr:GetDownloadUrlForLayer", "ecr:InitiateLayerUpload",
          "ecr:PutImage", "ecr:UploadLayerPart",
        ]
        Resource = [for r in aws_ecr_repository.repo : r.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["eks:DescribeCluster"]
        Resource = module.eks.cluster_arn
      },
    ]
  })
}

output "github_deploy_role_arn" {
  description = "Guárdalo como variable AWS_ROLE_ARN del repositorio en GitHub"
  value       = var.github_repository == "" ? null : aws_iam_role.github_deploy[0].arn
}
