import { Router } from "express";
import { AppDataSource } from "../../db/dataSource";
import type { OrderRepository } from "../../modules/orders/orderRepository";
import { createOrderRoutes } from "../../modules/orders/orderRoutes";
import { TypeOrmOrderRepository } from "../../modules/orders/typeOrmOrderRepository";
import { createDocsRoutes } from "./docsRoutes";
import { createHealthRoutes } from "./healthRoutes";

export interface AppRouterOptions {
  orderRepository?: OrderRepository;
}

export function createAppRouter(options: AppRouterOptions = {}): Router {
  const router = Router();
  const orderRepository = options.orderRepository ?? new TypeOrmOrderRepository(AppDataSource);

  router.use(createHealthRoutes());
  router.use(createDocsRoutes());
  router.use(createOrderRoutes(orderRepository));

  return router;
}
