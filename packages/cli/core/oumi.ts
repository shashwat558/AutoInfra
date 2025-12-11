import { Plan } from "../types/plan";
import path from "path";
import fs from "fs-extra";
import { google} from "@ai-sdk/google";
import { generateText } from "ai";
interface AgentResult {
    terraformHints?: any;
    kubernetesHints?: any
}

const model = google('gemini-2.5-flash');

export async function invokeInfraAgent(plan: Plan) : Promise<AgentResult>{
    const prompt = buildInfraPrompt(plan);
    const agentConfigPath = path.resolve("ai/oumi/agent_config.yaml");

    const {text} = await generateText({
        model: model,
        prompt: prompt
    });

    console.log(text)
    
    const parsedResult = JSON.parse(text) as AgentResult;

    await fs.writeFile(agentConfigPath, text);
    console.log("Agent finished sythesis");
    return {
        terraformHints: parsedResult.terraformHints,
        kubernetesHints: parsedResult.kubernetesHints
    

}

function buildInfraPrompt(plan: Plan): string {
    return `
    You are AutoInfra infrastructure synthesis agent.

    GOAL
    - Convert the following plan.json into production-ready Terraform and Kubernetes manifests.
    - Optimize for correctness, cost limits, autoscaling, and observability.
    - Respect selfHealing configuration and monitoring thresholds.

    CONSTRAINTS
    - All cloud resources MUST be declarative and idempotent.
    - Do not hardcode secrets.
    - Generate safe defaults: small instance sizes, reasonable autoscaling bounds.
    - Assume this repository layout:

    infra/terraform/
    infra/kubernetes/
    kestra/flows/
    ai/codemods/

    INPUT PLAN.JSON
    \`\`\`json
    ${JSON.stringify(plan, null, 2)}
    \`\`\`

    REMEMBER    
    - Drift detection will compare this plan.json to live state.
    - Self-healing will rely on codemods in ai/codemods/.
    OUTPUT FORMAT
    Return only valid JSON with this schema:

        {
        "terraformHints": "<terraform HCL code>",
        "kubernetesHints": "<kubernetes yaml>"
        }
    `
}}