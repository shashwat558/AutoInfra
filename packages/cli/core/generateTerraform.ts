import { Plan, ServiceConfig } from "../types/plan";
import path from "path";
import fs from "fs-extra";

interface TerraformHints {
  moduleSnippets?: Record<string, string>;
  raw?: string;
}

export async function generateTerraformFormPlan(
  plan: Plan,
  hints: TerraformHints | string = {}
) {
  const baseDir = path.resolve("infra/terraform");
  await fs.ensureDir(baseDir);

  const mainTfParts: string[] = [];

  mainTfParts.push(`
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = "${plan.region || "us-east-1"}"
}
`);

  if (typeof hints === "string") {
    mainTfParts.push(`# --- AI Generated Terraform Snippet ---\n${hints}`);
  } else if (hints.raw) {
    mainTfParts.push(`# --- AI Generated Terraform Snippet ---\n${hints.raw}`);
  }

  if (typeof hints === "object" && hints.moduleSnippets) {
    for (const [modName, snippet] of Object.entries(hints.moduleSnippets)) {
      mainTfParts.push(`# Module: ${modName}\n${snippet}`);
    }
  }

  if (plan.services && plan.services.length > 0) {
    for (const service of plan.services) {
      mainTfParts.push(renderServiceTerraform(plan, service, hints as TerraformHints));
    }
  } else {
    mainTfParts.push("# No services defined in plan.json");
  }

  const filePath = path.join(baseDir, "main.tf");
  await fs.writeFile(filePath, mainTfParts.join("\n\n"), "utf-8");

  console.log(`✅ Wrote ${filePath}`);
}
function renderServiceTerraform(plan: Plan, service: ServiceConfig, hints: TerraformHints): string {
  const name = service.name.replace(/[^a-zA-Z0-9]/g, "_");

  const aiSnippet = hints.moduleSnippets?.[service.name];
  if (aiSnippet) {
    return `# AI-generated Terraform for service: ${service.name}\n${aiSnippet}`;
  }

  // Fallback generation
  if (plan.deploymentMode === "serverless") {
    return `
# Service: ${service.name}
resource "aws_lambda_function" "${name}" {
  function_name    = "${service.name}"
  role             = aws_iam_role.${name}_role.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"

  filename         = "../../${service.path}/dist/bundle.zip"
  source_code_hash = filebase64sha256("../../${service.path}/dist/bundle.zip")
}

# TODO: add API Gateway, IAM role, CloudWatch logs
`;
  }

  return `
# Service: ${service.name}
module "${name}" {
  source = "./modules/service"
  name   = "${service.name}"
  cloud  = "${plan.cloud}"
  mode   = "${plan.deploymentMode}"
}
`;
}
