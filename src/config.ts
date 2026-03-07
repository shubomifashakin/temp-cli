import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";

const CONFIG_DIR = join(homedir(), ".config", "temp-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface Config {
  token: string;
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export async function getToken(): Promise<string | null> {
  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content) as Config;
    return config.token ?? null;
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await ensureConfigDir();
  const config: Config = { token };
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export async function clearToken(): Promise<void> {
  try {
    await unlink(CONFIG_FILE);
  } catch {}
}
