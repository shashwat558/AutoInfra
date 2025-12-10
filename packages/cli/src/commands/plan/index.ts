import {Command} from "commander"
import ora from "ora"
import path from "path"
import fs from "fs-extra";
import { Plan } from "../../../types/plan";
import { input, select } from "@inquirer/prompts";
import Ajv from "ajv";
import planSchema from "../../../schemas/plan.schema.json";

const ajv = new Ajv({allErrors: true});

export function registerPlanCommand(program:Command){
        program
         .command("plan")
         .description("generate plan.json and infra code from autoinfra.config.json")
         .option("-y, --yes", "Skip interactive questions and use default")
         .action(async (opt) => {
            const spinner = ora("Generating Plan....").start()

            try {
                const configPath = path.resolve("autoinfra.config.json");
                if(!(fs.existsSync(configPath))){
                    spinner.fail("autoinfra.config.json not found. Run `autoinfra init` first.");
                    process.exit(1);
                }

                const config =await fs.readJson(configPath);
                let plan: Plan;

                const hasPlan = fs.existsSync("plan.json");
                if(hasPlan){
                    plan = await fs.readJson("plan.json");
                    spinner.info("Existing plan.json found. Updating based on config...");

                } else {
                    plan = {
                        version: "1.0.0",
                        cloud: config.cloud,
                        region: config.region ?? "us-east-1",
                        deploymentMode: config.deployMode,

                        cost: {
                            monthlyBudgetUsd: 300,
                            hardLimit: false,
                            alertThresholds: [50, 80, 100]
                            
                        },
                        retention: {
                            logsDays: 30,
                            backupsDays: 7,
                            metricsDays: 60

                        },
                        services: [],
                        monitoring: {thresholds: []},
                        selfHealing: {
                            enabled: true,
                            driftDetectionIntervalMinutes: 10,
                            maxAutoFixesPerRun: 3
                        }
                        
                    };
                }

                if(!opt.yes) {
                    spinner.stop();
                    const region = await input({
                        message: "Cloud region",
                        default: "us-east-1"
                    });

                    const budget = await input({
                        message: "Budget",
                        
                    })
                    const selfHealing = await select({
                        message: "Self healing",
                        choices: [
                            {name: "True", value: "true"},
                            {name: "False", value: "false"}
                        ]
                    });
                    
                    plan.region = region;
                    plan.cost.monthlyBudgetUsd = Number(budget)
                    plan.selfHealing.enabled = Boolean(selfHealing)

                    spinner.start("Validating plan...");

                }

                const validate = ajv.compile(planSchema);
                const valid = validate(plan);

                if(!valid){
                    spinner.fail("plan.json validation failed");
                    console.error(validate.errors);
                    process.exit(1);
                }

                await fs.writeJson("plan.json", plan, {spaces: 2});
                spinner.succeed("plan.json created");

            } catch (error) {
                
            }
         })
}