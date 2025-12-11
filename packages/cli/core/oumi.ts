import { Plan } from "../types/plan";
import path from "path";
import fs from "fs-extra";
import z from "zod";
import dotenv from "dotenv";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";

dotenv.config();

export const AgentResultSchema = z.object({
  terraformHints: z
    .object({
      raw: z.string().optional(),
      moduleSnippets: z
        .object({
          example: z.string().optional(), // 👈 ensures object is non-empty
        })
        .catchall(z.string())
        .optional(),
    })
    .optional(),
  kubernetesHints: z
    .object({
      raw: z.string().optional(),
      serviceOverlays: z
        .object({
          example: z.string().optional(), // 👈 ensures object is non-empty
        })
        .catchall(z.string())
        .optional(),
    })
    .optional(),
});


export type AgentResult = z.infer<typeof AgentResultSchema>;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!
});

const model = google("gemini-2.5-flash");

export async function invokeInfraAgent(plan: Plan): Promise<AgentResult> {
  const prompt = buildInfraPrompt(plan);
  const aiDir = path.resolve("ai/oumi");

  await fs.ensureDir(aiDir);
  await fs.writeFile(path.join(aiDir, "agent_config.yaml"), prompt, "utf-8");

  console.log("🤖 Invoking AutoInfra synthesis agent (Gemini)...");

  try {
    const { object } = await generateObject({
      model,
      prompt,
      schema: AgentResultSchema,
      temperature: 0.2,
      maxOutputTokens: 8000,
    });

    await fs.writeJson(path.join(aiDir, "last_response.json"), object, {
      spaces: 2,
    });

    console.log("✅ Oumi (Gemini) finished synthesis");
    return object;
  } catch (err: any) {
    console.error("💥 Oumi (Gemini) agent failed:", err.message);
    return {
      terraformHints: { raw: "# Error generating Terraform" },
      kubernetesHints: { raw: "# Error generating Kubernetes" },
    };
  }
}

function buildInfraPrompt(plan: Plan): string {
  return `
You are AutoInfra — an AI infrastructure synthesis agent.

GOAL:
Convert the following plan.json into production-ready Terraform and Kubernetes code.

CONSTRAINTS:
- Must be declarative, idempotent, and deployable.
- Do not hardcode secrets.
- Generate minimal, correct, cost-efficient infra.
- Follow this folder structure:
  infra/terraform/
  infra/kubernetes/
  kestra/flows/
  ai/codemods/

INPUT PLAN.JSON:
\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

OUTPUT FORMAT (valid JSON only):
{
  "terraformHints": {
    "raw": "Terraform main.tf content",
    "moduleSnippets": {
      "api": "Terraform for api",
      "worker": "Terraform for worker"
    }
  },
  "kubernetesHints": {
    "raw": "Full YAML for common infra",
    "serviceOverlays": {
      "api": "api-specific YAML",
      "worker": "worker-specific YAML"
    }
  }
}
`;
}
