output "region" {
  value = var.region
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "configure_kubectl" {
  description = "Comando para configurar kubectl"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "ecr_gameserver" {
  value = aws_ecr_repository.repo["gameserver"].repository_url
}

output "ecr_lobby" {
  value = aws_ecr_repository.repo["lobby"].repository_url
}

output "leaderboard_api_url" {
  value = "${aws_apigatewayv2_api.leaderboard.api_endpoint}/scores"
}

output "cloudwatch_dashboard" {
  value = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "game_url_command" {
  description = "Muestra la URL pública del juego (cuando el pipeline haya desplegado el lobby)"
  value       = "kubectl get svc astro-lobby -n astro -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
}

output "grafana_url_command" {
  value = "kubectl get svc kube-prometheus-stack-grafana -n monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
}
