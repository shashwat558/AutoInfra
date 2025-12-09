import chalk from "chalk";
import { Command } from "commander";
import { input, select, checkbox } from "@inquirer/prompts";
import {createPrompt} from "@inquirer/core";
import path from "path";
import ora from "ora";
export function registerInitCommand(program: Command){
    program
     .command("init")
     .description("Create a new autoinfra project in the current directory")
     .action(async () => {
        console.log(chalk.cyan("\n⚙️  AutoInfra Initialization Wizard\n"))

        const projectName = await input({
            message: "Project Name: ",
            default: path.basename(process.cwd())
        })

        const cloud = await select({
            message: "Choose your cloud provider",
            choices: [
                {name: "AWS", value: "aws"},
                {name: "GCP", value: "gcp"},
                {name: "Azure", value: "azure"},
            ],
            default: "aws"
        });

        const deployMode = await select({
            message: "Deployment mode",
            choices: [
                {name: "Kubernetes", value: "kubernetes"},
                {name: "Serverless", value: "serverless"},
                {name: "Hybrid", value: "hybrid"}
            ]
        });

        const modules = await checkbox({
            message: "Enables modules: ",
            choices: [
                {name: "autoscaling", value: "autoscaling", checked: true},
                {name: "cost-monitor", value: "cost-monitor"},
                {name: "health-monitor", value: "health-monitor", checked: true},
                {name: "drift-watcher", value: "drift-watcher", checked: true},
                {name: "cron job", value: "cron job"},
                {name: "logging", value: "logging"},
                
            ]
        })
        const language = await select({
            message: "Language preferred",
            choices: [
                {name: "Typescript", value: "typescript"},
                {name: "Python", value: "python"},
                {name: "Go", value: "go"},
            
            ],
            default: "typescript"
        });

        const spinner = ora("Creating project structure...").start();

        try {
            const folder = [
                'infra/terraform',
                'infra/kubernetes',
                
            ]
        } catch (error) {
            
        }
     });


}