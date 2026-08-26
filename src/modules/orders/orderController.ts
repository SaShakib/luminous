import type { NextFunction, Request, Response } from "express";
import type { OrderService } from "./orderService";
import type { ListUserOrdersInput } from "./orderTypes";

interface ListUserOrdersQuery {
  limit: number;
  cursor?: string;
  sortBy: ListUserOrdersInput["sortBy"];
  sortDirection: ListUserOrdersInput["sortDirection"];
  orderStatus?: ListUserOrdersInput["filters"]["orderStatus"];
  paymentStatus?: ListUserOrdersInput["filters"]["paymentStatus"];
  fulfillmentStatus?: ListUserOrdersInput["filters"]["fulfillmentStatus"];
  productSku?: string;
  search?: string;
  createdFrom?: Date | string;
  createdTo?: Date | string;
}

function toIso(value?: Date | string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function normalizeSku(value?: string): string | undefined {
  return value?.toUpperCase();
}

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  listUserOrders = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const params = (request.validated?.params ?? request.params) as { userId: string };
      const query = (request.validated?.query ?? request.query) as unknown as ListUserOrdersQuery;
      const result = await this.orderService.listUserOrders({
        userId: params.userId,
        limit: query.limit,
        cursor: query.cursor,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
        filters: {
          orderStatus: query.orderStatus,
          paymentStatus: query.paymentStatus,
          fulfillmentStatus: query.fulfillmentStatus,
          productSku: normalizeSku(query.productSku),
          search: query.search,
          createdFrom: toIso(query.createdFrom),
          createdTo: toIso(query.createdTo)
        }
      });

      response.json(result);
    } catch (error) {
      next(error);
    }
  };
}
