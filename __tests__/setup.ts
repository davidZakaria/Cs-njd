process.env.SKIP_ENV_VALIDATION = "true";
if (process.env.CRON_DB_INTEGRATION !== "1") {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
}
process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long";
