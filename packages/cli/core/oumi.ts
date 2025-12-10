import { Plan } from "../types/plan";
import path from "path";
import fs from "fs-extra";
interface AgentResult {
    terraformHints?: any;
    kubernetesHints?: any
}

export async function invokeInfraAgent(plan: Plan) : Promise<AgentResult>{
    const prompt = buildInfraPrompt(plan);
    const agentConfigPath = path.resolve("ai/oumi/agent_config.yaml");

    await fs.writeFile(agentConfigPath, prompt)
    return {
        terraformHints: {},
        kubernetesHints: {}
    }

}

function buildInfraPrompt(plan: Plan): string {
    return `
    You are Oumi, the AutoInfra infrastructure synthesis agent.

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
    `
}