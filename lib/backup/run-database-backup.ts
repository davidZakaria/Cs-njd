import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type ParsedDatabaseUrl = {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
};

export function parseDatabaseUrl(databaseUrl: string): ParsedDatabaseUrl {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "").split("?")[0] ?? "";
  if (!url.username || !database) {
    throw new Error("Invalid DATABASE_URL");
  }
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port || "5432",
    database,
  };
}

export function getBackupDirectory(): string {
  return process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), "backups");
}

export function getBackupFilePath(filename: string): string {
  return path.join(getBackupDirectory(), filename);
}

function formatExecError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "pg_dump failed";
  }

  const withOutput = error as Error & { stderr?: string; stdout?: string };
  const detail = [withOutput.stderr, withOutput.stdout, error.message]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" — ");

  return detail || "pg_dump failed";
}

/** Run pg_dump into `filepath`. Uses Docker when BACKUP_DOCKER_CONTAINER is set. */
export async function runDatabaseBackup(filepath: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not configured");
  }

  const container = process.env.BACKUP_DOCKER_CONTAINER?.trim();
  const db = parseDatabaseUrl(databaseUrl);

  if (container) {
    const dockerArgs = [
      "exec",
      "-T",
      ...(db.password ? ["-e", `PGPASSWORD=${db.password}`] : []),
      container,
      "pg_dump",
      "-U",
      db.user,
      "-d",
      db.database,
      "--no-owner",
      "--no-acl",
    ];

    try {
      const { stdout } = await execFileAsync("docker", dockerArgs, {
        maxBuffer: 1024 * 1024 * 512,
      });

      if (!stdout?.trim()) {
        throw new Error(
          "pg_dump returned empty output. Check BACKUP_DOCKER_CONTAINER, DATABASE_URL user/password, and that docker is available to the backup worker."
        );
      }

      await fs.writeFile(filepath, stdout);
      return;
    } catch (error) {
      throw new Error(
        `Docker pg_dump failed (${container}): ${formatExecError(error)}`
      );
    }
  }

  try {
    await execFileAsync("pg_dump", [databaseUrl, "-f", filepath], {
      env: process.env,
    });
  } catch (error) {
    throw new Error(
      `${formatExecError(error)}. On Docker Postgres set BACKUP_DOCKER_CONTAINER in .env (e.g. njd-crm-postgres-prod).`
    );
  }
}
