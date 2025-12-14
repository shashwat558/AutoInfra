import { Plan } from "../types/plan";
import path from "path";
import fs from "fs-extra";
import z from "zod";
import dotenv from "dotenv";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";

dotenv.config();

export const AgentResultSchema = z.object({
  terraformHints: z
    .object({
      raw: z.string().optional(),
      moduleSnippets: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  kubernetesHints: z
    .object({
      raw: z.string().optional(),
      serviceOverlays: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

const google = createGoogleGenerativeAI({
  apiKey: "AIzaSyBIAZsy4ihB6zExr4xTpEDN5jwU8l3FO3c"
});

const model = google("gemini-2.5-flash");

async function handleInfraOutput(result: AgentResult, aiDir: string) {
  const tfDir = path.resolve("infra/terraform");
  const k8sDir = path.resolve("infra/kubernetes");
  await fs.ensureDir(tfDir);
  await fs.ensureDir(k8sDir);

  const tfRaw = result?.terraformHints?.raw || "# AutoInfra: No Terraform 'raw' output";
  const k8sRaw = result?.kubernetesHints?.raw || "# AutoInfra: No Kubernetes 'raw' output";

  await fs.writeFile(path.join(tfDir, "main.tf"), tfRaw, "utf-8");
  await fs.writeFile(path.join(k8sDir, "main.yaml"), k8sRaw, "utf-8");

  console.log(" Wrote /infra/terraform/main.tf");
  console.log(" Wrote /infra/kubernetes/main.yaml");
  
  const tfSnippets = result?.terraformHints?.moduleSnippets;
  if (tfSnippets && typeof tfSnippets === "object") {
    for (const [filename, content] of Object.entries(tfSnippets)) {
      if (typeof content === "string") {
        const filePath = path.join(tfDir, filename);
        await fs.writeFile(filePath, content, "utf-8");
        console.log(` Wrote /infra/terraform/${filename}`);
      }
    }
  }

  const k8sOverlays = result?.kubernetesHints?.serviceOverlays;
  if (k8sOverlays && typeof k8sOverlays === "object") {
    for (const [filename, content] of Object.entries(k8sOverlays)) {
      if (typeof content === "string") {
        const filePath = path.join(k8sDir, filename);
        await fs.writeFile(filePath, content, "utf-8");
        console.log(` Wrote /infra/kubernetes/${filename}`);
      }
    }
  }
  
  // 3. Log recovered object if available (moved from invokeInfraAgent)
  if (result !== null && result.terraformHints?.raw && result.kubernetesHints?.raw) {
    await fs.writeJson(path.join(aiDir, "recovered_response.json"), result, { spaces: 2 });
  }
}

// --- Util: Clean model response into valid JSON ---
function cleanJSON(text: string): string | null {
  // 1. Strip all Markdown fences (```, ```json, ```yaml, etc.)
  let cleaned = text.replace(/```(json|yaml|yml|hcl)?\s*/g, "").replace(/\s*```/g, "").trim();

  // 2. Aggressively try to extract the main JSON object:
  // Finds the first '{' and the last '}'
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  else return null; // Couldn't find a JSON object structure

  // 3. Remove trailing commas within arrays/objects (a common LLM error)
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
  
  // 4. Handle newlines in string values more carefully
  // Replace literal newlines with escaped newlines for proper JSON parsing
  cleaned = cleaned.replace(/(?<!\\)\n/g, "\\n");

  return cleaned.startsWith("{") ? cleaned : null;
}

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

    console.log("✅ Structured JSON generated successfully.");
    await handleInfraOutput(object, aiDir); // Pass aiDir for logging
    return object;
  } catch (err: any) {
    console.error("Oumi (Gemini) agent failed:", err.message);
    console.log("Falling back to raw text generation and recovery...");

    const { text: rawText } = await generateText({
      model,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 8000,
    });

    console.log("Raw Gemini response saved to ai/oumi/raw_response.txt");
    await fs.writeFile(path.join(aiDir, "raw_response.txt"), rawText, "utf-8");

    const cleaned = cleanJSON(rawText);
    let parsed: AgentResult | null = null;
    let fallbackResult: AgentResult;

    if (cleaned) {
      try {
        // 3. Try to parse the cleaned JSON
        const rawParsed = JSON.parse(cleaned);
        
        // 4. Validate the parsed object against the Zod schema
        const safeParse = AgentResultSchema.safeParse(rawParsed);

        if (safeParse.success) {
          parsed = safeParse.data;
          console.log(" Cleaned and parsed malformed JSON successfully.");
          // Writing to recovered_response.json is now handled in handleInfraOutput
        } else {
          console.warn(` JSON was valid but did not match schema: ${safeParse.error.message.substring(0, 100)}...`);
        }
      } catch {
        console.warn(" Cleaned string was not valid JSON after all.");
      }
    }

    // 5. Determine final result for writing
    if (parsed) {
      fallbackResult = parsed;
    } else {
      // 6. TRIPLE FALLBACK: If everything fails, write the raw text into 'raw' fields
      console.error(" Recovery failed. Writing raw text as placeholder infra.");
      fallbackResult = {
        terraformHints: { raw: rawText },
        kubernetesHints: { raw: rawText },
      };
    }
    
    // 7. ALWAYS write the infra files based on the best recovered/fallback result
    await handleInfraOutput(fallbackResult, aiDir);
    return fallbackResult;
  }
}
function buildInfraPrompt(plan: Plan): string {
  return `
    You are AutoInfra — an AI infrastructure synthesis agent.

    GOAL:
    Convert the following plan.json into production-ready Terraform HCL and Kubernetes YAML code.

    CONSTRAINTS:
    - Must be declarative, idempotent, and deployable.
    - Do not hardcode secrets.
    - Generate minimal, correct, cost-efficient infra.
    - **CRITICAL:** The output MUST be a single, valid JSON object that strictly adheres to the schema provided.

    INPUT PLAN.JSON:
    \`\`\`json
    ${JSON.stringify(plan, null, 2)}
    \`\`\`

    OUTPUT FORMAT INSTRUCTIONS:
    1. **You must ONLY return a single JSON object.**
    2. **Do not wrap the JSON object in markdown fences** (e.g., \`\`\`json).
    3. **Do not include any commentary, greetings, or text** before or after the JSON object.
    4. **The 'raw' field** must contain the complete, standalone Terraform HCL or Kubernetes YAML code for the main file.
    5. **The 'moduleSnippets'/'serviceOverlays' fields** must contain code snippets for auxiliary files, mapped by filename (e.g., "api.tf" or "worker.yaml").

    OUTPUT JSON (STRICTLY adhere to this schema):
    {
      "terraformHints": {
        "raw": "resource \"aws_vpc\" ...\\nmodule \"ecr\" ...",
        "moduleSnippets": {
          "api.tf": "resource \"aws_lambda_function\" ...",
          "db.tf": "resource \"aws_rds_instance\" ..."
        }
      },
      "kubernetesHints": {
        "raw": "apiVersion: v1\\nkind: Service\\n...",
        "serviceOverlays": {
          "api-deployment.yaml": "apiVersion: apps/v1\\nkind: Deployment\\n...",
          "worker-hpa.yaml": "apiVersion: autoscaling/v2\\nkind: HorizontalPodAutoscaler\\n..."
        }
      }
    }
    `;
}