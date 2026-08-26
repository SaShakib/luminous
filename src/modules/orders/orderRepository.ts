import type { CursorPayload, ListUserOrdersFilters, OrderHistoryEntry, OrderSortBy, SortDirection } from "./orderTypes";

export interface FindUserOrdersOptions {
  userId: string;
  limit: number;
  cursor?: CursorPayload;
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  filters: ListUserOrdersFilters;
}

export interface OrderRepository {
  userExists(userId: string): Promise<boolean>;
  findUserOrders(options: FindUserOrdersOptions): Promise<OrderHistoryEntry[]>;
}
