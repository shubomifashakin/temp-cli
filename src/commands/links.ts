import ora from "ora";
import chalk from "chalk";
import { Command } from "commander";
import confirm from "@inquirer/confirm";
import { password } from "@inquirer/prompts";

import { request } from "../client.js";
import { formatDate } from "../utils.js";
import { FRONTEND_URL } from "../constants.js";

interface Link {
  id: string;
  shareId: string;
  passwordProtected: boolean;
  clickCount: number;
  description: string;
  revokedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
}

interface LinksResponse {
  data: Link[];
  hasNextPage: boolean;
  cursor: string | null;
}

interface CreateLinkResponse {
  id: string;
  shareId: string;
}

export function registerLinkCommands(program: Command): void {
  const links = program.command("links").description("Manage your file links");

  links
    .command("ls <fileId>")
    .description("List all links for a file")
    .action(async (fileId: string) => {
      const spinner = ora("Fetching links...").start();

      const allLinks: Link[] = [];
      let cursor: string | null = null;
      let hasNextPage = true;

      while (hasNextPage) {
        const url: string = cursor
          ? `/files/${fileId}/links?cursor=${cursor}`
          : `/files/${fileId}/links`;

        const response = await request<LinksResponse>(url);

        if (!response.success) {
          spinner.fail("Failed to fetch links");
          process.exitCode = 1;
          return;
        }

        allLinks.push(...response.data.data);
        hasNextPage = response.data.hasNextPage;
        cursor = response.data.cursor;
      }

      spinner.stop();

      if (!allLinks.length) {
        console.log(
          chalk.yellow(
            `No links found for file ${fileId}. Create one with \`temp links create ${fileId}\``,
          ),
        );

        return;
      }

      console.log("");
      console.log(
        chalk.bold("ID".padEnd(38)) +
          chalk.bold("shareId".padEnd(26)) +
          chalk.bold("passworded".padEnd(18)) +
          chalk.bold("clickCount".padEnd(12)) +
          chalk.bold("description".padEnd(30)) +
          chalk.bold("revokedAt".padEnd(20)) +
          chalk.bold("createdAt".padEnd(20)) +
          chalk.bold("expiresAt".padEnd(20)) +
          chalk.bold("lastAccessedAt"),
      );

      console.log(chalk.dim("─".repeat(110)));

      for (const link of allLinks) {
        console.log(
          link.id.padEnd(38) +
            link.shareId.padEnd(26) +
            String(link.passwordProtected).padEnd(18) +
            String(link.clickCount).padEnd(12) +
            link.description.slice(0, 30).padEnd(30) +
            (link.revokedAt ? formatDate(link.revokedAt) : "-").padEnd(20) +
            formatDate(link.createdAt).padEnd(20) +
            (link.expiresAt ? formatDate(link.expiresAt) : "-").padEnd(20) +
            (link.lastAccessedAt ? formatDate(link.lastAccessedAt) : "-"),
        );
      }

      console.log("");
      console.log(chalk.dim(`  ${allLinks.length} link(s) total`));
      console.log("");
    });

  links
    .command("create <fileId>")
    .description("Create a link for a file")
    .option("-d, --description <description>", "Link description")
    .option("-e, --expires-at <expiresAt>", "Link expiry date (YYYY-MM-DD)")
    .action(
      async (
        fileId: string,
        options: {
          description: string;
          expiresAt?: string;
        },
      ) => {
        const description = options.description;
        const expiresAt = options.expiresAt;

        if (
          !description ||
          description.length < 10 ||
          description.length > 100
        ) {
          console.error(
            chalk.red(
              "Description is required and must be between 10 and 100 characters. Use -d <description>",
            ),
          );

          return;
        }

        if (expiresAt) {
          const expiresAtDate = new Date(expiresAt);

          if (isNaN(expiresAtDate.getTime())) {
            console.error(chalk.red("Invalid date format. Use YYYY-MM-DD."));
            return;
          }

          if (expiresAtDate < new Date()) {
            console.error(chalk.red("Expiry date must be in the future."));
            return;
          }
        }

        const typedPassword = await password({
          message: "Enter password (optional):",
          mask: true,
          validate: (value: string) => {
            const isPasswordWeak = value
              ? !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(value)
              : false;

            if (isPasswordWeak) {
              return "Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter and one number";
            }

            return true;
          },
        });

        const spinner = ora("Creating link...").start();

        const response = await request<CreateLinkResponse>(
          `/files/${fileId}/links`,
          {
            method: "POST",
            body: {
              description,
              password: typedPassword || undefined,
              expiresAt: options.expiresAt,
            },
          },
        );

        if (!response.success) {
          spinner.fail("Failed to create link");
          process.exitCode = 1;
          return;
        }

        spinner.succeed(chalk.green("Link created successfully!"));
        console.log("");
        console.log(`  ${chalk.bold("ID:")}      ${response.data.id}`);
        console.log(
          `  ${chalk.bold("URL:")}      ${FRONTEND_URL}/share/${response.data.shareId}`,
        );
        console.log("");
      },
    );

  links
    .command("rm <fileId> <linkId>")
    .description("Revoke a link")
    .action(async (fileId: string, linkId: string) => {
      const confirmed = await confirm({
        message: `Are you sure you want to revoke link ${linkId}?`,
      });

      if (!confirmed) {
        console.log(chalk.yellow("Revoke cancelled."));
        return;
      }

      const spinner = ora("Revoking link...").start();

      const response = await request(`/files/${fileId}/links/${linkId}`, {
        method: "DELETE",
      });

      if (!response.success) {
        spinner.fail(chalk.red("Failed to revoke link."));
        process.exitCode = 1;
        return;
      }

      spinner.succeed(chalk.green(`Link ${linkId} revoked successfully.`));
    });
}
