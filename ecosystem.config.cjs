module.exports = {
  apps: [
    {
      name: 'streamloop-24x7',
      script: './dist/server.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        JWT_SECRET: 'production_jwt_secret_change_me',
        AUTO_RECOVER_STREAM: 'true',
      },
    },
  ],
};
