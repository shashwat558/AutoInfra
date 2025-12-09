import {Command} from "commander";

const program = new Command();

program
 .name("autoInfra")
 .description("AI powered infra generation CLI")
 .version("1.0.0")

program.command("init").description("Start Infra creation").action(init);
program.command("plan").description("Generate infra plan").action(plan);
program.command("generate").description("Generate infra files").action(generate)
program.command("doctor").description("Check infra health").action(doctor)
program.command("deploy").description("Deploy infra").action(deploy)

program.parse();