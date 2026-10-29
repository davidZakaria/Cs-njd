import { describe, expect, it } from "vitest";
import {
  buildDockerPgDumpExecArgs,
  parseDatabaseUrl,
  redactSensitiveText,
} from "@/lib/backup/run-database-backup";

describe("buildDockerPgDumpExecArgs", () => {
  const db = parseDatabaseUrl(
    "postgresql://backup_user:secr%3Det@localhost:5432/njd_crm"
  );

  it("does not pass docker exec -T (removed for Docker 29+)", () => {
    const args = buildDockerPgDumpExecArgs("njd-crm-postgres-prod", db);
    expect(args).not.toContain("-T");
    expect(args[0]).toBe("exec");
  });

  it("passes PGPASSWORD via docker exec -e when password is set", () => {
    const args = buildDockerPgDumpExecArgs("njd-crm-postgres-prod", db);
    expect(args).toEqual([
      "exec",
      "-e",
      "PGPASSWORD=secr=et",
      "njd-crm-postgres-prod",
      "pg_dump",
      "-U",
      "backup_user",
      "-d",
      "njd_crm",
      "--no-owner",
      "--no-acl",
    ]);
  });

  it("omits PGPASSWORD env when password is empty", () => {
    const noPassword = { ...db, password: "" };
    const args = buildDockerPgDumpExecArgs("postgres", noPassword);
    expect(args).not.toContain("-e");
    expect(args).not.toContain("PGPASSWORD=");
  });
});

describe("redactSensitiveText", () => {
  it("redacts literal secrets and postgres URLs", () => {
    const message =
      'Command failed: docker exec -e PGPASSWORD=topsecret container — postgresql://u:topsecret@db/njd';
    const redacted = redactSensitiveText(message, ["topsecret"]);
    expect(redacted).not.toContain("topsecret");
    expect(redacted).toContain("PGPASSWORD=[REDACTED]");
    expect(redacted).toContain("postgresql://u:[REDACTED]@");
  });
});
