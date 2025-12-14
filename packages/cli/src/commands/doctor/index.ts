// /cli/commands/doctor.ts
import { Command } from "commander";
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { detectDrift, DriftIssue } from "../../../core/drift";
import { Plan } from "../../../types/plan";
import { invokeOumiDriftAgent } from "../../../core/oumiDoctor";


export function registerDoctorCommand(program: Command) {
  program
    .command("doctor")
    .description("Detect and attempt to heal infrastructure drift")
    .option("--no-auto-heal", "Detect only, do not apply fixes")
    .action(async (opts) => {
      const spinner = ora("Inspecting infrastructure...").start();

      try {
        const planPath = path.resolve("plan.json");
        if (!(await fs.pathExists(planPath))) {
          spinner.fail("plan.json not found. Run `autoinfra plan` first.")
          process.exit(1);
        }

        const plan = (await fs.readJson(planPath)) as Plan;
        const report = await detectDrift(plan);

        spinner.stop();

        if (!report.hasDrift || report.issues.length === 0) {
          console.log(chalk.green("✅ No drift detected. Infrastructure matches plan.json."));
          return;
        }

        console.log(chalk.yellow(`⚠ Detected ${report.issues.length} drift issue(s):\n`));
        renderIssues(report.issues);

        if (opts.autoHeal === false || !plan.selfHealing.enabled) {
          console.log("\nSelf-healing is disabled. Re-run with self-healing enabled in plan.json.");
          return;
        }

        const healSpinner = ora("Invoking Oumi to auto-heal drift...").start();
        const healResult = await invokeOumiDriftAgent(plan, report.issues);

        healSpinner.succeed(`Auto-fixed ${healResult.appliedFixes} issue(s).`);
        if (healResult.remainingIssues.length > 0) {
          console.log(chalk.yellow(`Remaining issues (${healResult.remainingIssues.length}) require manual review.`));
        }
      } catch (err) {
        spinner.fail("doctor failed.");
        console.error(err);
        process.exit(1);
      }
    });
}

function renderIssues(issues: DriftIssue[]) {
  for (const issue of issues) {
    console.log(
      `${chalk.cyan(issue.resourceType)} :: ${chalk.magenta(issue.resourceId)} :: ${chalk.gray(
        issue.fieldPath
      )}`
    );
    console.log(`  expected: ${JSON.stringify(issue.expected)}`);
    console.log(`  actual:   ${JSON.stringify(issue.actual)}`);
    console.log(`  severity: ${issue.severity} | strategy: ${issue.fixStrategy}\n`);
  }
}
