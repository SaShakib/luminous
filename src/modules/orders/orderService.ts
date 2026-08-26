import { HttpError } from "../../http/errors";
import { cursorFromOrder, decodeCursor } from "./orderCursor";
import type { OrderRepository } from "./orderRepository";
import type { ListUserOrdersInput, ListUserOrdersResult } from "./orderTypes";

export class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async listUserOrders(input: ListUserOrdersInput): Promise<ListUserOrdersResult> {
    const userExists = await this.orderRepository.userExists(input.userId);

    if (!userExists) {
      throw new HttpError(404, "User not found");
    }

    const decodedCursor = input.cursor
      ? decodeCursor(input.cursor, input.sortBy, input.sortDirection, input.filters)
      : undefined;
    const rows = await this.orderRepository.findUserOrders({
      userId: input.userId,
      limit: input.limit + 1,
      cursor: decodedCursor,
      sortBy: input.sortBy,
      sortDirection: input.sortDirection,
      filters: input.filters
    });
    const data = rows.slice(0, input.limit);
    const hasMore = rows.length > input.limit;
    const lastOrder = data[data.length - 1];

    return {
      data,
      page: {
        limit: input.limit,
        hasMore,
        nextCursor: hasMore && lastOrder ? cursorFromOrder(lastOrder, input.sortBy, input.sortDirection, input.filters) : null,
        sortBy: input.sortBy,
        sortDirection: input.sortDirection
      }
    };
  }
}
