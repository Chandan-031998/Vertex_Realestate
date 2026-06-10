module.exports = {
  apps: [
    {
      name: "vertex-realestate-backend",
      cwd: "./backend",
      script: "server.js",
      env: { NODE_ENV: "production" },
    },
  ],
};
