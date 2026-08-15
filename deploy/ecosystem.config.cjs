/** PM2 processes — isolated names; does not touch other PM2 apps. */
module.exports = {
  apps: [
    {
      name: "cs-njd-crm",
      cwd: "/var/www/cs-njd",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
    {
      name: "cs-njd-backup-cron",
      cwd: "/var/www/cs-njd",
      script: "npm",
      args: "run backup:cron",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
