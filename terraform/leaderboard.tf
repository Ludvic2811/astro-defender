# Tabla de líderes serverless: API Gateway (HTTP) -> Lambda -> DynamoDB

resource "aws_dynamodb_table" "scores" {
  name         = "${local.name}-scores"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "mode"
    type = "S"
  }
  attribute {
    name = "score"
    type = "N"
  }

  global_secondary_index {
    name            = "ByMode"
    hash_key        = "mode"
    range_key       = "score"
    projection_type = "ALL"
  }
}

data "archive_file" "leaderboard" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/leaderboard"
  output_path = "${path.module}/.build/leaderboard.zip"
  excludes    = ["core.test.mjs"]
}

resource "aws_iam_role" "leaderboard" {
  name = "${local.name}-leaderboard-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "leaderboard_logs" {
  role       = aws_iam_role.leaderboard.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "leaderboard_dynamo" {
  name = "dynamodb"
  role = aws_iam_role.leaderboard.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem", "dynamodb:Query"]
      Resource = [aws_dynamodb_table.scores.arn, "${aws_dynamodb_table.scores.arn}/index/*"]
    }]
  })
}

resource "aws_cloudwatch_log_group" "leaderboard" {
  name              = "/aws/lambda/${local.name}-leaderboard"
  retention_in_days = 7
}

resource "aws_lambda_function" "leaderboard" {
  function_name    = "${local.name}-leaderboard"
  role             = aws_iam_role.leaderboard.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.leaderboard.output_path
  source_code_hash = data.archive_file.leaderboard.output_base64sha256
  memory_size      = 256
  timeout          = 5

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.scores.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.leaderboard]
}

resource "aws_apigatewayv2_api" "leaderboard" {
  name          = "${local.name}-leaderboard"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "leaderboard" {
  api_id                 = aws_apigatewayv2_api.leaderboard.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.leaderboard.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "scores" {
  for_each  = toset(["GET /scores", "POST /scores"])
  api_id    = aws_apigatewayv2_api.leaderboard.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.leaderboard.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.leaderboard.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 200
    throttling_rate_limit  = 100
  }
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.leaderboard.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.leaderboard.execution_arn}/*/*"
}
