import type { Pool } from "pg";
import type { FindUserOrdersOptions, OrderRepository } from "./orderRepository";
import type { OrderHistoryEntry, OrderItem, OrderSortBy, SortDirection } from "./orderTypes";

interface OrderRow {
  id: string;
  userId: string;
  orderNumber: string;
  currency: string;
  orderStatus: OrderHistoryEntry["orderStatus"];
  paymentStatus: OrderHistoryEntry["paymentStatus"];
  fulfillmentStatus: OrderHistoryEntry["fulfillmentStatus"];
  customerName: string | null;
  customerEmail: string | null;
  subtotalAmountCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  shippingAmountCents: number;
  totalAmountCents: number;
  shippingAddress: unknown;
  billingAddress: unknown;
  placedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  items: OrderItem[];
}

const sortColumns: Record<OrderSortBy, string> = {
  createdAt: "o.created_at",
  total: "o.total_amount_cents"
};

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function cursorOperator(sortDirection: SortDirection): ">" | "<" {
  return sortDirection === "asc" ? ">" : "<";
}

export class PgOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async userExists(userId: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)", [
      userId
    ]);

    return result.rows[0].exists;
  }

  async findUserOrders(options: FindUserOrdersOptions): Promise<OrderHistoryEntry[]> {
    const values: unknown[] = [options.userId];
    const where = ["o.user_id = $1"];

    function addValue(value: unknown): string {
      values.push(value);
      return `$${values.length}`;
    }

    if (options.filters.orderStatus) {
      where.push(`o.order_status = ${addValue(options.filters.orderStatus)}`);
    }

    if (options.filters.paymentStatus) {
      where.push(`o.payment_status = ${addValue(options.filters.paymentStatus)}`);
    }

    if (options.filters.fulfillmentStatus) {
      where.push(`o.fulfillment_status = ${addValue(options.filters.fulfillmentStatus)}`);
    }

    if (options.filters.createdFrom) {
      where.push(`o.created_at >= ${addValue(options.filters.createdFrom)}`);
    }

    if (options.filters.createdTo) {
      where.push(`o.created_at <= ${addValue(options.filters.createdTo)}`);
    }

    if (options.filters.productSku) {
      where.push(
        `EXISTS (
          SELECT 1
          FROM order_items product_filter
          WHERE product_filter.order_id = o.id
          AND product_filter.product_sku = ${addValue(options.filters.productSku)}
        )`
      );
    }

    if (options.filters.search) {
      const searchParam = addValue(options.filters.search);
      where.push(
        `(o.search_document @@ websearch_to_tsquery('simple', ${searchParam})
          OR EXISTS (
            SELECT 1
            FROM order_items item_search
            WHERE item_search.order_id = o.id
            AND item_search.search_document @@ websearch_to_tsquery('simple', ${searchParam})
          ))`
      );
    }

    if (options.cursor) {
      const column = sortColumns[options.sortBy];
      const sortValue = addValue(options.cursor.sortValue);
      const idValue = addValue(options.cursor.id);
      where.push(`(${column}, o.id) ${cursorOperator(options.sortDirection)} (${sortValue}, ${idValue})`);
    }

    const sortColumn = sortColumns[options.sortBy];
    const direction = options.sortDirection.toUpperCase();
    const limit = addValue(options.limit);

    const result = await this.pool.query<OrderRow>(
      `WITH page_orders AS (
        SELECT o.*
        FROM orders o
        WHERE ${where.join(" AND ")}
        ORDER BY ${sortColumn} ${direction}, o.id ${direction}
        LIMIT ${limit}
      )
      SELECT
        o.id,
        o.user_id AS "userId",
        o.order_number AS "orderNumber",
        o.currency,
        o.order_status AS "orderStatus",
        o.payment_status AS "paymentStatus",
        o.fulfillment_status AS "fulfillmentStatus",
        o.customer_name AS "customerName",
        o.customer_email AS "customerEmail",
        o.subtotal_amount_cents AS "subtotalAmountCents",
        o.discount_amount_cents AS "discountAmountCents",
        o.tax_amount_cents AS "taxAmountCents",
        o.shipping_amount_cents AS "shippingAmountCents",
        o.total_amount_cents AS "totalAmountCents",
        o.shipping_address AS "shippingAddress",
        o.billing_address AS "billingAddress",
        o.placed_at AS "placedAt",
        o.created_at AS "createdAt",
        o.updated_at AS "updatedAt",
        o.cancelled_at AS "cancelledAt",
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'productId', oi.product_id,
                'productSku', oi.product_sku,
                'productName', oi.product_name,
                'quantity', oi.quantity,
                'unitPriceCents', oi.unit_price_cents,
                'totalPriceCents', oi.total_price_cents
              )
              ORDER BY oi.position
            ),
            '[]'::json
          )
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) AS items
      FROM page_orders o
      ORDER BY ${sortColumn} ${direction}, o.id ${direction}`,
      values
    );

    return result.rows.map((row) => ({
      ...row,
      placedAt: toIso(row.placedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      cancelledAt: toIso(row.cancelledAt)
    }));
  }
}
