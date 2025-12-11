import {Command} from "commander";
import { registerInitCommand } from "./commands/init";
import { registerPlanCommand } from "./commands/plan";
import { registerGenerateCommand } from "./commands/generate";

const program = new Command();

program
 .name("autoInfra")
 .description("AI powered infra generation CLI")
 .version("1.0.0")

registerInitCommand(program)
registerPlanCommand(program)
registerGenerateCommand(program)

program.parse();