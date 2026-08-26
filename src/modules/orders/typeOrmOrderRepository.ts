import { In, type DataSource } from "typeorm";
import { OrderItemEntity } from "../../db/entities/OrderItemEntity";
import { OrderEntity } from "../../db/entities/OrderEntity";
import { UserEntity } from "../../db/entities/UserEntity";
import type { FindUserOrdersOptions, OrderRepository } from "./orderRepository";
import type { OrderHistoryEntry, OrderItem, OrderSortBy, SortDirection } from "./orderTypes";

const sortColumns: Record<OrderSortBy, { property: string; column: string }> = {
  createdAt: { property: "orders.createdAt", column: `"orders"."created_at"` },
  total: { property: "orders.totalAmountCents", column: `"orders"."total_amount_cents"` }
};

function cursorOperator(sortDirection: SortDirection): ">" | "<" {
  return sortDirection === "asc" ? ">" : "<";
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toOrderItem(item: OrderItemEntity): OrderItem {
  return {
    id: item.id,
    productId: item.productId,
    productSku: item.productSku,
    productName: item.productName,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalPriceCents: item.totalPriceCents
  };
}

function toOrderHistoryEntry(order: OrderEntity, items: OrderItem[]): OrderHistoryEntry {
  return {
    id: order.id,
    userId: order.userId,
    orderNumber: order.orderNumber,
    currency: order.currency,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    subtotalAmountCents: order.subtotalAmountCents,
    discountAmountCents: order.discountAmountCents,
    taxAmountCents: order.taxAmountCents,
    shippingAmountCents: order.shippingAmountCents,
    totalAmountCents: order.totalAmountCents,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    placedAt: toIso(order.placedAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    cancelledAt: toIso(order.cancelledAt),
    items
  };
}

export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  async userExists(userId: string): Promise<boolean> {
    const count = await this.dataSource.getRepository(UserEntity).countBy({ id: userId });

    return count > 0;
  }

  async findUserOrders(options: FindUserOrdersOptions): Promise<OrderHistoryEntry[]> {
    const query = this.dataSource.getRepository(OrderEntity).createQueryBuilder("orders").where("orders.userId = :userId", {
      userId: options.userId
    });

    if (options.filters.orderStatus) {
      query.andWhere("orders.orderStatus = :orderStatus", { orderStatus: options.filters.orderStatus });
    }

    if (options.filters.paymentStatus) {
      query.andWhere("orders.paymentStatus = :paymentStatus", { paymentStatus: options.filters.paymentStatus });
    }

    if (options.filters.fulfillmentStatus) {
      query.andWhere("orders.fulfillmentStatus = :fulfillmentStatus", {
        fulfillmentStatus: options.filters.fulfillmentStatus
      });
    }

    if (options.filters.createdFrom) {
      query.andWhere("orders.createdAt >= :createdFrom", { createdFrom: options.filters.createdFrom });
    }

    if (options.filters.createdTo) {
      query.andWhere("orders.createdAt <= :createdTo", { createdTo: options.filters.createdTo });
    }

    if (options.filters.productSku) {
      query.andWhere(
        `EXISTS (
          SELECT 1
          FROM order_items product_filter
          WHERE product_filter.order_id = "orders"."id"
          AND product_filter.product_sku = :productSku
        )`,
        { productSku: options.filters.productSku }
      );
    }

    if (options.filters.search) {
      query.andWhere(
        `("orders"."search_document" @@ websearch_to_tsquery('simple', :search)
          OR EXISTS (
            SELECT 1
            FROM order_items item_search
            WHERE item_search.order_id = "orders"."id"
            AND item_search.search_document @@ websearch_to_tsquery('simple', :search)
          ))`,
        { search: options.filters.search }
      );
    }

    if (options.cursor) {
      const sortColumn = sortColumns[options.sortBy].column;
      query.andWhere(`(${sortColumn}, "orders"."id") ${cursorOperator(options.sortDirection)} (:sortValue, :id)`, {
        sortValue: options.cursor.sortValue,
        id: options.cursor.id
      });
    }

    const sort = sortColumns[options.sortBy];
    const direction = options.sortDirection.toUpperCase() as "ASC" | "DESC";
    const orders = await query.orderBy(sort.property, direction).addOrderBy("orders.id", direction).limit(options.limit).getMany();

    if (orders.length === 0) {
      return [];
    }

    const itemRows = await this.dataSource.getRepository(OrderItemEntity).find({
      where: { orderId: In(orders.map((order) => order.id)) },
      order: { position: "ASC" }
    });
    const itemsByOrderId = new Map<string, OrderItem[]>();

    for (const item of itemRows) {
      const items = itemsByOrderId.get(item.orderId) ?? [];
      items.push(toOrderItem(item));
      itemsByOrderId.set(item.orderId, items);
    }

    return orders.map((order) => toOrderHistoryEntry(order, itemsByOrderId.get(order.id) ?? []));
  }
}
