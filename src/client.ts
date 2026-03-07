import chalk from "chalk";

import { getToken } from "./config.js";
import { API_URL } from "./constants.js";

type HttpMethod = "GET" | "POST" | "DELETE" | "PATCH";

interface RequestOptions {
  body?: unknown;
  method?: HttpMethod;
  requiresAuth?: boolean;
}

type FnResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: Error };

export interface ApiError {
  message: string;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<FnResult<T>> {
  try {
    const { method = "GET", body, requiresAuth = true } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (requiresAuth) {
      const token = await getToken();

      if (!token) {
        console.error(
          chalk.red("You are not logged in. Run `temp login` first."),
        );

        return {
          success: false,
          data: null,
          error: new Error("Not authenticated"),
        };
      }

      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      const error = (await response.json()) as ApiError;

      console.error(
        chalk.red(`Error: ${error.message}. Status: ${response.status}`),
      );

      return { success: false, data: null, error: new Error(error.message) };
    }

    const data = (await response.json()) as T;

    return { success: true, data, error: null };
  } catch (error) {
    return { success: false, data: null, error: error as Error };
  }
}
