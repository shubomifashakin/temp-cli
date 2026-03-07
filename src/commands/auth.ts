import ora from "ora";
import chalk from "chalk";
import { Command } from "commander";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { exec } from "node:child_process";

import { request } from "../client.js";
import { FRONTEND_URL } from "../constants.js";
import { saveToken, clearToken, getToken } from "../config.js";

const execAsync = promisify(exec);

interface InitiateResponse {
  code: string;
}

interface TokenResponse {
  token: string | null;
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;

  const command =
    platform === "win32"
      ? `start "" "${url}"`
      : platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  await execAsync(command);
}

async function pollForToken(code: string): Promise<string | null> {
  const MAX_ATTEMPTS = 150;
  const INTERVAL_MS = 2000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));

    const response = await request<TokenResponse>(
      `/auth/cli/token?code=${code}`,
      { requiresAuth: false, method: "POST" },
    );

    if (response.success && response.data?.token) {
      return response.data.token;
    }
  }

  return null;
}

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Login to your Temp account")
    .action(async () => {
      const spinner = ora("Initiating login...").start();

      const state = randomBytes(16).toString("hex");
      const response = await request<InitiateResponse>(
        `/auth/cli/initiate?state=${state}`,
        {
          method: "POST",
          requiresAuth: false,
        },
      );

      if (!response.success) {
        spinner.fail("Failed to initiate login");
        process.exitCode = 1;
        return;
      }

      spinner.text = "Opening browser...";
      await openBrowser(
        `${FRONTEND_URL}/auth/cli?code=${response.data.code}&state=${state}`,
      );

      spinner.text = "Waiting for authentication...";
      const token = await pollForToken(response.data.code);

      if (!token) {
        spinner.fail(chalk.red("Login timed out. Please try again."));
        return;
      }

      await saveToken(token);
      spinner.succeed(chalk.green("Logged in successfully!"));
    });

  program
    .command("logout")
    .description("Logout of your Temp account")
    .action(async () => {
      const spinner = ora("Logging out...").start();

      const token = await getToken();

      if (!token) {
        spinner.fail(chalk.red("You are not logged in."));
        return;
      }

      const response = await request("/auth/cli/logout", { method: "POST" });

      if (!response.success) {
        spinner.fail("Failed to logout");
        process.exitCode = 1;
        return;
      }

      await clearToken();
      spinner.succeed(chalk.green("Logged out successfully!"));
    });
}
