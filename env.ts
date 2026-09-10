import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    AUTH_URL: z.string().url().optional(),
    BACKUP_DIR: z.string().min(1).default("./backups"),
    UPLOADS_DIR: z.string().min(1).default("./uploads"),
    BACKUP_DOCKER_CONTAINER: z.string().min(1).optional(),
    BACKUP_CRON: z.string().min(1).default("0 2 * * *"),
    BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
    OBJECT_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    BACKUP_REMOTE_ENABLED: z.preprocess(
      (value) => value === "true" || value === true,
      z.boolean().default(false)
    ),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_UPLOAD_PREFIX: z.string().default("uploads/"),
    S3_BACKUP_PREFIX: z.string().default("backups/"),
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
    UPLOADS_DIR: process.env.UPLOADS_DIR,
    BACKUP_DOCKER_CONTAINER: process.env.BACKUP_DOCKER_CONTAINER,
    BACKUP_CRON: process.env.BACKUP_CRON,
    BACKUP_RETENTION_DAYS: process.env.BACKUP_RETENTION_DAYS,
    OBJECT_STORAGE_DRIVER: process.env.OBJECT_STORAGE_DRIVER,
    BACKUP_REMOTE_ENABLED: process.env.BACKUP_REMOTE_ENABLED,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_UPLOAD_PREFIX: process.env.S3_UPLOAD_PREFIX,
    S3_BACKUP_PREFIX: process.env.S3_BACKUP_PREFIX,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
