import { Plan, ServiceConfig } from "../types/plan";
import path from "path";
import fs from "fs-extra";
interface TerraformHints {
    moduleSnippets?: Record<string, string>;   
}

export async function generateTerraformPlan(
    plan: Plan,
    hints: TerraformHints = {}
) {
    const baseDir = path.resolve("infra/terraform");
    if(!(await fs.exists(baseDir))){
        await fs.mkdirp(baseDir);
    }

    const mainTfPart: string[] = [];

    mainTfPart.push(`
        terraform {
          required_version = ">= 1.6.0"
          required_providers {
           aws = {
            source = "hashicorp/aws"
            version = ">= 5.0"
           }
          }

        }

        provider "aws" {
         region= "${plan.region}"
        }
        `);
    
    for(const service of plan.services){
        mainTfPart.push(renderServiceTerraform(plan, service, hints))


    }

    await fs.writeFile(path.join(baseDir, "main.tf"), mainTfPart.join("\n\n"));



}


function renderServiceTerraform(plan: Plan, service: ServiceConfig, hints: TerraformHints): string {
    const name = service.name.replace(/[^a-zA-Z0-9]/g, "_");

    if(plan.deploymentMode === "serverless") {
        return `
        # Service: ${service.name}
        resource "aws_lambda_function" "${name}" {
          function_name    = "${service.name}"
          role             = aws_iam_role.${name}_role.arn
          handler          = "index.handler"
          runtime          = "nodejs20.x"
   
          filename         = "../..${service.path}/dist/bundle.zip"
          source_code_hash = filebase64sha256("../..${service.path}/dist/bundle.zip")
        
        }
        
        # TODO: add API gateway etc.      
        `;
    }

    return `
    # Service: ${service.name}
    module "${name}" {
      source = "./module/service"

      name  = "${service.name}"
      cloud = "${plan.cloud}"
      mode  = "${plan.deploymentMode}"
    }
    `;
    

}