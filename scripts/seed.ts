import { randomUUID } from "node:crypto";
import { EntityManager } from "typeorm";
import { initializeDataSource } from "../src/db/dataSource";
import { OrderItemEntity } from "../src/db/entities/OrderItemEntity";
import { OrderEntity } from "../src/db/entities/OrderEntity";
import { UserEntity } from "../src/db/entities/UserEntity";

const USER_COUNT = 500;
const ORDER_COUNT = 50_000;
const USER_BATCH_SIZE = 500;
const ORDER_BATCH_SIZE = 500;

const firstNames = ["Ava", "Noah", "Mia", "Liam", "Sara", "Omar", "Nina", "Eli", "Tara", "Zane"];
const lastNames = ["Rahman", "Ahmed", "Khan", "Smith", "Patel", "Garcia", "Chen", "Brown", "Hossain", "Roy"];
const cities = ["Dhaka", "Chattogram", "Sylhet", "New York", "Austin", "Seattle", "London", "Toronto"];
const countries = ["BD", "US", "GB", "CA"];
const orderStatuses = ["pending", "confirmed", "cancelled", "refunded", "fulfilled"] as const;
const paymentStatuses = ["unpaid", "authorized", "paid", "failed", "refunded"] as const;
const fulfillmentStatuses = ["not_started", "processing", "shipped", "delivered", "cancelled"] as const;
const products = [
  { sku: "LUM-STARTER", name: "Luminous Starter Kit", price: 4_900 },
  { sku: "LUM-PRO", name: "Luminous Pro Kit", price: 12_900 },
  { sku: "LUM-SERVICE", name: "Luminous Setup Service", price: 19_900 },
  { sku: "LUM-SUB", name: "Luminous Monthly Subscription", price: 2_900 },
  { sku: "LUM-CARE", name: "Luminous Care Plan", price: 5_900 },
  { sku: "LUM-SENSOR", name: "Luminous Motion Sensor", price: 3_900 },
  { sku: "LUM-BRIDGE", name: "Luminous Bridge", price: 7_900 },
  { sku: "LUM-PANEL", name: "Luminous Wall Panel", price: 6_900 }
] as const;

interface SeedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function makeUserId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function makeAddress(index: number) {
  return {
    line1: `${100 + (index % 900)} Market Street`,
    line2: index % 4 === 0 ? `Apartment ${index % 50}` : null,
    city: pick(cities, index),
    region: index % 3 === 0 ? "State" : "Region",
    postalCode: String(10000 + (index % 89999)),
    country: pick(countries, index)
  };
}

async function seedUsers(manager: EntityManager): Promise<SeedUser[]> {
  const users: SeedUser[] = [];
  const repository = manager.getRepository(UserEntity);

  for (let start = 0; start < USER_COUNT; start += USER_BATCH_SIZE) {
    const batch = Array.from({ length: Math.min(USER_BATCH_SIZE, USER_COUNT - start) }, (_, offset) => {
      const index = start + offset + 1;
      const firstName = pick(firstNames, index);
      const lastName = pick(lastNames, index + 3);
      const email = `${firstName}.${lastName}.${index}@example.com`.toLowerCase();

      return repository.create({
        id: makeUserId(index),
        email,
        role: index <= 25 ? "admin" : "user",
        firstName,
        lastName,
        phone: `+1555${String(index).padStart(7, "0")}`,
        status: "active",
        lastLoginAt: new Date(Date.now() - (index % 365) * 86_400_000)
      });
    });

    const inserted = await repository.save(batch, { chunk: USER_BATCH_SIZE });
    users.push(
      ...inserted.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? ""
      }))
    );
  }

  return users;
}

async function seedOrders(manager: EntityManager, users: SeedUser[]): Promise<void> {
  const orderRepository = manager.getRepository(OrderEntity);
  const itemRepository = manager.getRepository(OrderItemEntity);

  for (let start = 0; start < ORDER_COUNT; start += ORDER_BATCH_SIZE) {
    const orderBatch: OrderEntity[] = [];
    const itemBatch: OrderItemEntity[] = [];

    for (let offset = 0; offset < Math.min(ORDER_BATCH_SIZE, ORDER_COUNT - start); offset += 1) {
      const index = start + offset + 1;
      const user = users[(index - 1) % users.length];
      const itemCount = 1 + (index % 4);
      const orderId = randomUUID();
      const items = Array.from({ length: itemCount }, (_value, itemOffset) => {
        const product = pick(products, index + itemOffset);
        const quantity = 1 + ((index + itemOffset) % 3);

        return {
          position: itemOffset + 1,
          productId: randomUUID(),
          productSku: product.sku,
          productName: product.name,
          quantity,
          unitPriceCents: product.price,
          totalPriceCents: product.price * quantity
        };
      });
      const subtotal = items.reduce((sum, item) => sum + item.totalPriceCents, 0);
      const discount = index % 9 === 0 ? Math.round(subtotal * 0.1) : 0;
      const taxable = subtotal - discount;
      const tax = Math.round(taxable * 0.0825);
      const shipping = taxable > 20_000 ? 0 : 799;
      const total = taxable + tax + shipping;
      const orderStatus = pick(orderStatuses, index);
      const createdAt = new Date(Date.now() - index * 60_000);
      const cancelledAt = orderStatus === "cancelled" ? new Date(Date.now() - (index - 30) * 60_000) : null;
      const primaryItem = items[0];

      orderBatch.push(
        orderRepository.create({
          id: orderId,
          userId: user.id,
          orderNumber: `ORD-${String(index).padStart(8, "0")}`,
          productSku: primaryItem.productSku,
          productName: primaryItem.productName,
          amountCents: total,
          currency: "USD",
          orderStatus,
          paymentStatus: orderStatus === "cancelled" ? "failed" : pick(paymentStatuses, index + 1),
          fulfillmentStatus: orderStatus === "cancelled" ? "cancelled" : pick(fulfillmentStatuses, index + 2),
          customerName: `${user.firstName} ${user.lastName}`,
          customerEmail: user.email,
          subtotalAmountCents: subtotal,
          discountAmountCents: discount,
          taxAmountCents: tax,
          shippingAmountCents: shipping,
          totalAmountCents: total,
          shippingAddress: makeAddress(index),
          billingAddress: makeAddress(index + 17),
          placedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
          cancelledAt
        })
      );

      for (const item of items) {
        itemBatch.push(
          itemRepository.create({
            id: randomUUID(),
            orderId,
            ...item
          })
        );
      }
    }

    await orderRepository.save(orderBatch, { chunk: ORDER_BATCH_SIZE });
    await itemRepository.save(itemBatch, { chunk: ORDER_BATCH_SIZE });
    console.log(`Seeded ${Math.min(start + ORDER_BATCH_SIZE, ORDER_COUNT)} / ${ORDER_COUNT} orders`);
  }
}

async function main(): Promise<void> {
  const dataSource = await initializeDataSource();

  try {
    await dataSource.transaction(async (manager) => {
      await manager.query("TRUNCATE order_items, orders, users RESTART IDENTITY");
      const users = await seedUsers(manager);
      await seedOrders(manager, users);
    });
    console.log(`Seed complete: ${USER_COUNT} users, ${ORDER_COUNT} orders`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
