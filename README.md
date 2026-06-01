# Mini Integration Platform

A high-performance, resilient dual-service integration platform demonstrating a Sales & CRM domain context. This project implements a decoupled architecture across two runtime topologies: **Local Containerized (Docker + Kong Gateway)** and **Production Serverless (AWS Lambda + API Gateway + DynamoDB)**.

## 🏗️ Architectural Topology

### Local Architecture
Traffic passes through Kong API Gateway (DB-less mode) which applies global rate-limiting and logging before routing to independent Node.js/TypeScript Express containers.

### AWS Production Architecture
Fully provisioned via Terraform. A serverless API Gateway (HTTP) acts as the entry point, routing requests to AWS Lambda functions executing under strict IAM roles with least-privilege read access to Amazon DynamoDB.

---

## 🛠️ Tech Stack & Trade-offs

| Component | Technology | Selection Rational |
| :--- | :--- | :--- |
| **Backend** | Node.js / Strict TypeScript | Fast execution, native JSON handling, strong compile-time contracts. |
| **Local Gateway** | Kong Gateway (3.4) | Decouples cross-cutting concerns (rate-limiting, logging) from code. |
| **Cloud Compute** | AWS Lambda | Zero idle cost, infinite scale, removes OS management overhead. |
| **Cloud Database** | Amazon DynamoDB | Predictable single-digit millisecond latency for key-value domain lookups. |
| **IaC** | Terraform | Cloud-agnostic, explicit state-tracking, mature module ecosystem. |

---

## 🚀 Quick Start (Local Run)

1. **Boot the Container Mesh:**
   ```bash
   docker compose up --build -d
