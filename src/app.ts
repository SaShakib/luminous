import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { pool } from "./db/pool";
import { openApiDocument } from "./docs/openApi";
import { errorHandler, notFoundHandler } from "./http/errors";
import type { OrderRepository } from "./modules/orders/orderRepository";
import { createOrderRoutes } from "./modules/orders/orderRoutes";
import { PgOrderRepository } from "./modules/orders/pgOrderRepository";

interface CreateAppOptions {
  orderRepository?: OrderRepository;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const orderRepository = options.orderRepository ?? new PgOrderRepository(pool);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin || true
    })
  );
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get("/openapi.json", (_request, response) => {
    response.json(openApiDocument);
  });

  app.use(createOrderRoutes(orderRepository));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
