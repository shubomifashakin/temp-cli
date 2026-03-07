import ora from "ora";
import chalk from "chalk";
import { Command } from "commander";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { lookup } from "mime-types";
import select from "@inquirer/select";
import confirm from "@inquirer/confirm";

import { request } from "../client.js";
import { formatDate, formatFileSize } from "../utils.js";

interface File {
  id: string;
  name: string;
  description: string;
  size: number;
  status: string;
  contentType: string;
  totalLinks: number;
  totalClicks: number;
  expiresAt: string;
  createdAt: string;
}

interface FilesResponse {
  data: File[];
  hasNextPage: boolean;
  cursor: string | null;
}

interface UploadUrlResponse {
  url: string;
  fields: Record<string, string>;
}

interface UploadUrlRequest {
  name: string;
  description: string;
  lifetime: "short" | "medium" | "long";
  fileSizeBytes: number;
  contentType: string;
}

const lifetimeMap: Record<string, "short" | "medium" | "long"> = {
  "7": "short",
  "14": "medium",
  "31": "long",
};

export function registerFileCommands(program: Command): void {
  const files = program.command("files").description("Manage your files");

  files
    .command("ls")
    .description("List all your files")
    .action(async () => {
      const spinner = ora("Fetching files...").start();

      try {
        const allFiles: File[] = [];
        let cursor: string | null = null;
        let hasNextPage = true;

        while (hasNextPage) {
          const url: string = cursor ? `/files?cursor=${cursor}` : "/files";

          const response = await request<FilesResponse>(url);

          if (!response.success) {
            spinner.fail("Failed to fetch files");
            process.exitCode = 1;
            return;
          }

          allFiles.push(...response.data.data);
          hasNextPage = response.data.hasNextPage;
          cursor = response.data.cursor;
        }

        spinner.stop();

        if (!allFiles.length) {
          console.log(
            chalk.yellow(
              "No files found. Upload one with `temp cp <filepath>`",
            ),
          );

          return;
        }

        console.log("");
        console.log(
          chalk.bold("ID".padEnd(40)) +
            chalk.bold("Name".padEnd(16)) +
            chalk.bold("Size".padEnd(10)) +
            chalk.bold("Links".padEnd(8)) +
            chalk.bold("Views".padEnd(8)) +
            chalk.bold("Status".padEnd(20)) +
            chalk.bold("Expires"),
        );

        console.log(chalk.dim("─".repeat(110)));

        for (const file of allFiles) {
          console.log(
            file.id.padEnd(40) +
              file.name.slice(0, 28).padEnd(16) +
              formatFileSize(file.size).padEnd(10) +
              String(file.totalLinks).padEnd(8) +
              String(file.totalClicks).padEnd(8) +
              (file.status === "safe"
                ? chalk.green(file.status).padEnd(20)
                : file.status === "unsafe"
                  ? chalk.red(file.status).padEnd(20)
                  : chalk.yellow(file.status).padEnd(20)) +
              formatDate(file.expiresAt),
          );
        }

        console.log("");
        console.log(chalk.dim(`  ${allFiles.length} file(s) total`));
        console.log("");

        return;
      } catch {
        spinner.fail(chalk.red("Failed to fetch files."));
        return;
      }
    });

  files
    .command("rm <fileId>")
    .description("Delete a file")
    .action(async (fileId: string) => {
      try {
        const confirmed = await confirm({
          message: `Are you sure you want to delete file ${fileId}?`,
        });

        if (!confirmed) {
          console.log(chalk.yellow("Deletion cancelled."));
          return;
        }

        const spinner = ora("Deleting file...").start();

        const response = await request(`/files/${fileId}`, {
          method: "DELETE",
        });

        if (!response.success) {
          spinner.fail("Failed to delete file");
          process.exitCode = 1;
          return;
        }

        spinner.succeed(chalk.green(`File ${fileId} deleted successfully.`));
        return;
      } catch {
        console.error(chalk.red("Failed to delete file."));
        return;
      }
    });

  files
    .command("cp <filepath>")
    .description("Upload a file")
    .option("-d, --description <description>", "File description")
    .option("-n, --name <name>", "File name")
    .action(
      async (
        filepath: string,
        options: {
          description?: string;
          name?: string;
        },
      ) => {
        const fileName = options.name;
        const description = options.description;
        const fileSize = statSync(filepath).size;
        const contentType = lookup(filepath);

        if (!contentType) {
          console.error(chalk.red("Could not determine file type."));
          return;
        }

        if (!fileName || fileName.length < 5 || fileName.length > 50) {
          console.error(
            chalk.red(
              "File name is required and must be between 5 and 50 characters. Use --name <name>",
            ),
          );
          return;
        }

        if (
          !description ||
          description.length < 10 ||
          description.length > 100
        ) {
          console.error(
            chalk.red(
              "Description is required and must be between 10 and 100 characters. Use --description <description>",
            ),
          );

          return;
        }

        const selectedLifetime = await select({
          message: "Select file lifetime:",
          choices: [
            {
              name: "7 days (short)",
              value: "7",
              description: "A week retention",
            },
            {
              name: "14 days (medium)",
              value: "14",
              description: "Two weeks retention",
            },
            {
              name: "31 days (long)",
              value: "31",
              description: "A month retention",
            },
          ],
        });

        const spinner = ora("Preparing upload...").start();

        if (!lifetimeMap[selectedLifetime]) {
          console.error(chalk.red("Invalid lifetime selected."));
          return;
        }

        const response = await request<UploadUrlResponse>("/files", {
          method: "POST",
          body: {
            name: fileName,
            description,
            contentType,
            fileSizeBytes: fileSize,
            lifetime: lifetimeMap[selectedLifetime],
          } satisfies UploadUrlRequest,
        });

        if (!response.success) {
          spinner.fail("Failed to get upload URL");
          process.exitCode = 1;
          return;
        }

        spinner.text = "Uploading file...";

        const formData = new FormData();

        for (const [key, value] of Object.entries(response.data.fields)) {
          formData.append(key, value);
        }

        const fileBuffer = await readFile(filepath);

        formData.append(
          "file",
          new Blob([fileBuffer], { type: contentType }),
          fileName,
        );

        const uploadResponse = await fetch(response.data.url, {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload to S3 failed");
        }

        spinner.succeed(chalk.green("File uploaded successfully!"));
        console.log("");
        console.log(`  ${chalk.bold("Name:")}        ${fileName}`);
        console.log(
          `  ${chalk.bold("Size:")}        ${formatFileSize(fileSize)}`,
        );
        console.log(`  ${chalk.bold("Lifetime:")}    ${selectedLifetime} days`);
        console.log(`  ${chalk.bold("Description:")} ${description}`);
        console.log("");
        console.log(chalk.dim(`  Run \`temp files ls\` to see your files`));
        console.log("");

        return;
      },
    );
}
