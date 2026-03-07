#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerFileCommands } from "./commands/files.js";
import { registerLinkCommands } from "./commands/links.js";

const program = new Command();

program
  .name("temp")
  .description("CLI tool for interacting with the Temp API")
  .version("1.0.0");

registerAuthCommands(program);
registerFileCommands(program);
registerLinkCommands(program);

program.parse(process.argv);
