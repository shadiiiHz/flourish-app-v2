module.exports = {
  apps: [
    {
      name: "flourish-api",
      cwd: "./server",
      script: "dist/src/index.js",
      env: { NODE_ENV: "production" },
    },
    {
      name: "flourish-web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
    },
  ],
};
