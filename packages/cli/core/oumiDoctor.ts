// /cli/core/oumiDoctor.ts
import { DriftIssue } from "./drift";
import { Plan } from "../types/plan";
import fs from "fs-extra";

interface DriftHealResult {
  appliedFixes: number;
  remainingIssues: DriftIssue[];
}

export async function invokeOumiDriftAgent(
  plan: Plan,
  issues: DriftIssue[]
): Promise<DriftHealResult> {
  const prompt = buildDriftPrompt(plan, issues);
  await fs.writeFile("ai/oumi/last_drift_prompt.md", prompt);

  // Here Oumi would:
  // - read infra/terraform and infra/kubernetes
  // - apply codemods (ai/codemods/heal_patch.ts, drift_fix.ts)
  // - possibly update plan.json
  // For now, we just pretend nothing was fixed.
  return {
    appliedFixes: 0,
    remainingIssues: issues
  };
}

function buildDriftPrompt(plan: Plan, issues: DriftIssue[]): string {
  return `
You are Oumi, the AutoInfra self-healing agent.

GOAL
- Read the DRIFT REPORT and patch the Terraform + Kubernetes files to match plan.json.
- Only change what is necessary.
- Use codemods from ai/codemods/ when possible.

INPUT: PLAN.JSON
\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

INPUT: DRIFT REPORT
\`\`\`json
${JSON.stringify(issues, null, 2)}
\`\`\`

INSTRUCTIONS
- For each issue:
  - If fixStrategy is "apply" or "recreate": update Terraform/K8s to match plan.json.
  - If "update_plan": update plan.json and ensure changes are safe.
- Output:
  - File diffs ready for Cline.
  - Notes for CodeRabbit about risky changes.

Remember: Do not introduce breaking changes or delete data without clear justification.
`;
}
