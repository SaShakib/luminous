import { env } from "./config/env";
import { createApp } from "./app";
import { AppDataSource, initializeDataSource } from "./db/dataSource";

async function main(): Promise<void> {
  await initializeDataSource();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });

  async function shutdown(): Promise<void> {
    server.close(async () => {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(0);
    });
  }

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
