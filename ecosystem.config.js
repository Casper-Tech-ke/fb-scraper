module.exports = {
  apps: [
    {
      name: 'fb-scraper',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 5757
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5757
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true
    }
  ]
};
