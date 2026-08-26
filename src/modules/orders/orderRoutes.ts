import { Router } from "express";
import { authenticate, requireSelfOrAdmin } from "../../http/middleware/auth";
import { validate } from "../../http/middleware/validate";
import { OrderController } from "./orderController";
import type { OrderRepository } from "./orderRepository";
import { listUserOrdersParamsSchema, listUserOrdersQuerySchema } from "./orderSchemas";
import { OrderService } from "./orderService";

export function createOrderRoutes(orderRepository: OrderRepository): Router {
  const orderRoutes = Router();
  const orderController = new OrderController(new OrderService(orderRepository));

  orderRoutes.get(
    "/api/users/:userId/orders",
    authenticate,
    validate({ params: listUserOrdersParamsSchema, query: listUserOrdersQuerySchema }),
    requireSelfOrAdmin,
    orderController.listUserOrders
  );

  return orderRoutes;
}
