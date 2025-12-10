import {Command} from "commander";
import { registerInitCommand } from "./commands/init";

const program = new Command();

program
 .name("autoInfra")
 .description("AI powered infra generation CLI")
 .version("1.0.0")

registerInitCommand(program)

program.parse();