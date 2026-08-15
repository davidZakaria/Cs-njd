/** PM2 process — isolated name/port; does not touch other PM2 apps. */
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
  ],
};
