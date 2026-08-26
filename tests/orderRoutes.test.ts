process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/testdb";

import request from "supertest";
import { createApp } from "../src/app";
import type { FindUserOrdersOptions, OrderRepository } from "../src/modules/orders/orderRepository";
import type { OrderHistoryEntry } from "../src/modules/orders/orderTypes";

const userId = "3f4b5f66-17f0-45f3-9f41-8b2399ccbbd8";
const otherUserId = "35dc17a1-1d51-4be7-a9d6-d2c98c0adcc3";

function makeOrder(overrides: Partial<OrderHistoryEntry> = {}): OrderHistoryEntry {
  return {
    id: "8c84e436-1bdd-4307-9804-4fb5ec169ab2",
    userId,
    orderNumber: "ORD-00000001",
    currency: "USD",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    fulfillmentStatus: "shipped",
    customerName: "Noah Smith",
    customerEmail: "noah.smith@example.com",
    subtotalAmountCents: 12_900,
    discountAmountCents: 0,
    taxAmountCents: 1_064,
    shippingAmountCents: 799,
    totalAmountCents: 14_763,
    shippingAddress: {},
    billingAddress: {},
    placedAt: "2026-08-26T10:00:00.000Z",
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
    cancelledAt: null,
    items: [
      {
        id: "66ed4dc0-9718-4552-8488-4b9d9fc226f7",
        productId: "5338ce69-d2c9-4ebc-bdcb-bb9758296a65",
        productSku: "LUM-PRO",
        productName: "Luminous Pro Kit",
        quantity: 1,
        unitPriceCents: 12_900,
        totalPriceCents: 12_900
      }
    ],
    ...overrides
  };
}

function makeRepository(rows: OrderHistoryEntry[] = [makeOrder()]): OrderRepository & { lastOptions?: FindUserOrdersOptions } {
  return {
    async userExists() {
      return true;
    },
    async findUserOrders(options: FindUserOrdersOptions) {
      this.lastOptions = options;
      return rows;
    }
  };
}

describe("GET /api/users/:userId/orders", () => {
  it("requires authentication", async () => {
    const app = createApp({ orderRepository: makeRepository() });
    const response = await request(app).get(`/api/users/${userId}/orders`);

    expect(response.status).toBe(401);
  });

  it("rejects malformed user ids", async () => {
    const app = createApp({ orderRepository: makeRepository() });
    const response = await request(app)
      .get("/api/users/not-a-uuid/orders")
      .set("x-user-id", userId)
      .set("x-user-role", "user");

    expect(response.status).toBe(400);
  });

  it("blocks users from reading another user's orders", async () => {
    const app = createApp({ orderRepository: makeRepository() });
    const response = await request(app)
      .get(`/api/users/${otherUserId}/orders`)
      .set("x-user-id", userId)
      .set("x-user-role", "user");

    expect(response.status).toBe(403);
  });

  it("allows admins to read another user's orders", async () => {
    const app = createApp({ orderRepository: makeRepository([makeOrder({ userId: otherUserId })]) });
    const response = await request(app)
      .get(`/api/users/${otherUserId}/orders`)
      .set("x-user-id", userId)
      .set("x-user-role", "admin");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it("returns cursor pagination metadata", async () => {
    const rows = [
      makeOrder({ id: "8c84e436-1bdd-4307-9804-4fb5ec169ab2", totalAmountCents: 2000 }),
      makeOrder({ id: "b2038412-648a-42d5-aebe-4656cf5fd30c", totalAmountCents: 1000 })
    ];
    const app = createApp({ orderRepository: makeRepository(rows) });
    const response = await request(app)
      .get(`/api/users/${userId}/orders?limit=1&sortBy=total&sortDirection=desc`)
      .set("x-user-id", userId)
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.page.hasMore).toBe(true);
    expect(response.body.page.nextCursor).toEqual(expect.any(String));
  });

  it("passes filters and search to the repository", async () => {
    const repository = makeRepository();
    const app = createApp({ orderRepository: repository });
    const response = await request(app)
      .get(
        `/api/users/${userId}/orders?orderStatus=confirmed&paymentStatus=paid&fulfillmentStatus=shipped&productSku=lum-pro&search=Luminous&createdFrom=2026-01-01T00:00:00.000Z`
      )
      .set("x-user-id", userId)
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(repository.lastOptions?.filters).toMatchObject({
      orderStatus: "confirmed",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      productSku: "LUM-PRO",
      search: "Luminous",
      createdFrom: "2026-01-01T00:00:00.000Z"
    });
  });

  it("returns 404 for an unknown user", async () => {
    const repository: OrderRepository = {
      async userExists() {
        return false;
      },
      async findUserOrders() {
        return [];
      }
    };
    const app = createApp({ orderRepository: repository });
    const response = await request(app)
      .get(`/api/users/${userId}/orders`)
      .set("x-user-id", userId)
      .set("x-user-role", "user");

    expect(response.status).toBe(404);
  });

  it("returns an empty list for a known user with no orders", async () => {
    const app = createApp({ orderRepository: makeRepository([]) });
    const response = await request(app)
      .get(`/api/users/${userId}/orders`)
      .set("x-user-id", userId)
      .set("x-user-role", "user");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.page.hasMore).toBe(false);
    expect(response.body.page.nextCursor).toBeNull();
  });
});
