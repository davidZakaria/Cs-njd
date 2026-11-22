/** PM2 — staging instance only (does not touch cs-njd-crm production). */
module.exports = {
  apps: [
    {
      name: "cs-njd-crm-staging",
      cwd: "/var/www/cs-njd-staging",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
        STAGING: "true",
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
          "/usr/bin/chromium-browser",
      },
    },
  ],
};