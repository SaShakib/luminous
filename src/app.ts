import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { globalErrorResolver, globalNotFoundResolver } from "./http/errors";
import { createAppRouter, type AppRouterOptions } from "./http/routes";

export function createApp(options: AppRouterOptions = {}) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin || true
    })
  );
  app.use(express.json());

  app.use(createAppRouter(options));
  app.use(globalNotFoundResolver);
  app.use(globalErrorResolver);

  return app;
}
