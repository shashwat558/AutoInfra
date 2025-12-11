import { Command } from "commander";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import { invokeInfraAgent } from "../../../core/oumi";
import { generateTerraformFormPlan } from "../../../core/generateTerraform";
import chalk from "chalk";
import { generateKubernetesFormPlan } from "../../../core/generateKubernetes";


export function registerGenerateCommand(program:Command){
    program
     .command("generate")
     .description("Generate terraform and kubernetes manifest from plan.json using AI agent")
     .action(async () => {
        const spinner = ora("Reading plan.json...").start();

        const planPath = path.resolve("plan.json");
        if(!(await fs.pathExists(planPath))){
            spinner.fail("Could not find plan.json. Run `autoinfra plan` first");
            process.exit(1);
        }

        try {
            const plan = await fs.readJson(planPath);
            spinner.text = "Invoking Agent...";

            const result = await invokeInfraAgent(plan);

            spinner.text = "Generating infra files..."
            const terraformHints =
          typeof result.terraformHints === "string"
            ? { raw: result.terraformHints }
            : result.terraformHints || {};

            const kubernetesHints =
          typeof result.kubernetesHints === "string"
            ? { raw: result.kubernetesHints }
            : result.kubernetesHints || {};

            await generateTerraformFormPlan(plan, terraformHints);
            await generateKubernetesFormPlan(plan, kubernetesHints);

            await fs.writeFile(
            "ai/oumi/terraform_raw.txt",
            terraformHints.raw || "",
            "utf-8"
            );
            await fs.writeFile(
            "ai/oumi/kubernetes_raw.txt",
            kubernetesHints.raw || "",
            "utf-8"
            );

            spinner.succeed("Infrastructure code generated successfully!");
            console.log(chalk.greenBright("Next \n autoinfra deploy"))
            

        } catch (error) {
            spinner.fail("Generation failed");
            console.error(error);
            process.exit(1);
                    
        }

     })
}