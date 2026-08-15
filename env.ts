import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    AUTH_URL: z.string().url().optional(),
    BACKUP_DIR: z.string().min(1).default("./backups"),
    BACKUP_DOCKER_CONTAINER: z.string().min(1).optional(),
    BACKUP_CRON: z.string().min(1).default("0 2 * * *"),
    BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    BACKUP_DIR: process.env.BACKUP_DIR,
    BACKUP_DOCKER_CONTAINER: process.env.BACKUP_DOCKER_CONTAINER,
    BACKUP_CRON: process.env.BACKUP_CRON,
    BACKUP_RETENTION_DAYS: process.env.BACKUP_RETENTION_DAYS,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
