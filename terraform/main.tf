terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}

# 1. DynamoDB Table
resource "aws_dynamodb_table" "customers" {
  name           = "Customers"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# 2. IAM Role for Lambdas
resource "aws_iam_role" "lambda_role" {
  name = "mini-platform-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "dynamodb_read" {
  name        = "LambdaDynamoDBRead"
  description = "Allows customer lambda to read from DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:Query"]
      Resource = aws_dynamodb_table.customers.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamo" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.dynamodb_read.arn
}

# 3. Dummy deployment packages for compilation safety
data "archive_file" "dummy" {
  type        = "zip"
  output_path = "${path.module}/dummy.zip"
  source {
    content  = "exports.handler = async () => {};"
    filename = "lambda.js"
  }
}

# 4. Lambda Functions
resource "aws_lambda_function" "customer_service" {
  filename         = "${path.module}/customer-service.zip"
  function_name    = "customer-service"
  role             = aws_iam_role.lambda_role.arn
  handler          = "dist/lambda.handler"
  runtime          = "nodejs20.x"
  
  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.customers.name
      MOCK_MODE      = "false"
    }
  }
}

resource "aws_lambda_function" "order_service" {
  filename         = "${path.module}/order-service.zip"
  function_name    = "order-service"
  role             = aws_iam_role.lambda_role.arn
  handler          = "dist/lambda.handler"
  runtime          = "nodejs20.x"

  environment {
    variables = {
      # Dynamically inject the live API Gateway endpoint
      CUSTOMER_SERVICE_URL = aws_apigatewayv2_api.http_api.api_endpoint
    }
  }
}

# 5. HTTP API Gateway (v2)
resource "aws_apigatewayv2_api" "http_api" {
  name          = "mini-integration-gateway"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# Integrations
resource "aws_apigatewayv2_integration" "customer_api_int" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.customer_service.arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "customer_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "ANY /customers/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.customer_api_int.id}"
}

# Permissions for API Gateway to invoke Lambdas
resource "aws_lambda_permission" "api_gw_customer" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.customer_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

output "api_gateway_url" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}