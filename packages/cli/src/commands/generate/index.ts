import { Command } from "commander";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import { spawn } from "child_process";
import { invokeInfraAgent } from "../../../core/oumi";
import { generateTerraformFormPlan } from "../../../core/generateTerraform";
import { generateKubernetesFormPlan } from "../../../core/generateKubernetes";

async function runClineTask(prompt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cline",
      ["run", "--non-interactive", "--prompt", prompt],
      {
        stdio: "inherit",
        shell: true,
      }
    );

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Cline exited with code ${code}`));
    });
  });
}

export function registerGenerateCommand(program: Command) {
  program
    .command("generate")
    .description(
      "Generate Terraform and Kubernetes manifests from plan.json using AI (Gemini + Cline)"
    )
    .action(async () => {
      const spinner = ora("Reading plan.json...").start();
      const planPath = path.resolve("plan.json");

      if (!(await fs.pathExists(planPath))) {
        spinner.fail("Could not find plan.json. Run `autoinfra plan` first.");
        process.exit(1);
      }

      try {
        const plan = await fs.readJson(planPath);
        spinner.text = "Invoking AI Agent (Gemini)...";

        const result = await invokeInfraAgent(plan);

        const terraformHints =
          typeof result.terraformHints === "string"
            ? { raw: result.terraformHints }
            : result.terraformHints || {};

        const kubernetesHints =
          typeof result.kubernetesHints === "string"
            ? { raw: result.kubernetesHints }
            : result.kubernetesHints || {};

        await fs.ensureDir("ai/oumi");
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
        spinner.text = "Invoking Cline to create infrastructure files...";

        const prompt = `
You are Cline, an AI coding assistant integrated into AutoInfra.
Create or update the following files inside the current workspace:

1️⃣ Terraform file:
Path: infra/terraform/main.tf
Language: HCL
Content:
\`\`\`hcl
${terraformHints.raw || ""}
\`\`\`

2️⃣ Kubernetes manifest:
Path: infra/kubernetes/ai_generated.yaml
Language: YAML
Content:
\`\`\`yaml
${kubernetesHints.raw || ""}
\`\`\`

Ensure both files are valid, syntactically correct, and properly indented.
Do not overwrite unrelated files.
If the directories don't exist, create them.
`;

        await runClineTask(prompt);

        await generateTerraformFormPlan(plan, terraformHints);
        await generateKubernetesFormPlan(plan, kubernetesHints);

        spinner.succeed("✅ Infrastructure files generated successfully!");
        console.log(chalk.greenBright("Next → run `autoinfra deploy`"));
      } catch (error) {
        spinner.fail("❌ Generation failed");
        console.error(error);
        process.exit(1);
      }
    });
}
