import type { ActionResult } from "@/lib/actions/result";

export class PostAuthRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PostAuthRequestError";
    this.status = status;
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new PostAuthRequestError(
      `Empty response (${response.status})`,
      response.status
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PostAuthRequestError(
      `Invalid JSON response (${response.status})`,
      response.status
    );
  }
}

function errorMessageFromBody(body: unknown, status: number): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return `Request failed (${status})`;
}

export async function postAuthJson<T extends ActionResult>(
  url: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await readJsonResponse<T>(response);

  if (!response.ok) {
    if (
      data &&
      typeof data === "object" &&
      "success" in data &&
      data.success === false
    ) {
      return data;
    }
    throw new PostAuthRequestError(errorMessageFromBody(data, response.status), response.status);
  }

  return data;
}

export type TwoFactorResetStatusPayload = {
  success?: boolean;
  status?: string;
  needsEnrollment?: boolean;
  error?: string;
};

export async function fetchTwoFactorResetStatus(): Promise<{
  status: string;
  needsEnrollment: boolean;
}> {
  const response = await fetch("/api/auth/2fa-reset-status", {
    credentials: "include",
    cache: "no-store",
  });

  const data = await readJsonResponse<TwoFactorResetStatusPayload>(response);

  if (!response.ok) {
    throw new PostAuthRequestError(
      errorMessageFromBody(data, response.status),
      response.status
    );
  }

  return {
    status: data.status ?? "none",
    needsEnrollment: data.needsEnrollment ?? false,
  };
}
