import { PoolClient } from "pg";
import { pool } from "../src/db/pool";

const USER_COUNT = 5_000;
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

interface ItemSeed {
  orderNumber: string;
  position: number;
  productSku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
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

async function seedUsers(client: PoolClient): Promise<SeedUser[]> {
  const users: SeedUser[] = [];

  for (let start = 0; start < USER_COUNT; start += USER_BATCH_SIZE) {
    const rows = Array.from({ length: Math.min(USER_BATCH_SIZE, USER_COUNT - start) }, (_, offset) => {
      const index = start + offset + 1;
      const firstName = pick(firstNames, index);
      const lastName = pick(lastNames, index + 3);
      const email = `${firstName}.${lastName}.${index}@example.com`.toLowerCase();
      const role = index <= 25 ? "admin" : "user";
      const phone = `+1555${String(index).padStart(7, "0")}`;
      const lastLoginAt = new Date(Date.now() - (index % 365) * 86_400_000).toISOString();

      return [email, role, firstName, lastName, phone, "active", lastLoginAt];
    });

    const valuesSql = rows
      .map((_, rowIndex) => {
        const offset = rowIndex * 7;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
      })
      .join(", ");

    const result = await client.query<SeedUser>(
      `INSERT INTO users (email, role, first_name, last_name, phone, status, last_login_at)
       VALUES ${valuesSql}
       RETURNING id, email, first_name AS "firstName", last_name AS "lastName"`,
      rows.flat()
    );

    users.push(...result.rows);
  }

  return users;
}

async function seedOrders(client: PoolClient, users: SeedUser[]): Promise<void> {
  for (let start = 0; start < ORDER_COUNT; start += ORDER_BATCH_SIZE) {
    const orderRows = [];
    const itemRows: ItemSeed[] = [];

    for (let offset = 0; offset < Math.min(ORDER_BATCH_SIZE, ORDER_COUNT - start); offset += 1) {
      const index = start + offset + 1;
      const user = users[(index - 1) % users.length];
      const itemCount = 1 + (index % 4);
      const items = Array.from({ length: itemCount }, (_value, itemOffset) => {
        const product = pick(products, index + itemOffset);
        const quantity = 1 + ((index + itemOffset) % 3);
        return {
          position: itemOffset + 1,
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
      const paymentStatus = orderStatus === "cancelled" ? "failed" : pick(paymentStatuses, index + 1);
      const fulfillmentStatus = orderStatus === "cancelled" ? "cancelled" : pick(fulfillmentStatuses, index + 2);
      const createdAt = new Date(Date.now() - index * 60_000).toISOString();
      const cancelledAt = orderStatus === "cancelled" ? new Date(Date.now() - (index - 30) * 60_000).toISOString() : null;
      const primaryItem = items[0];
      const orderNumber = `ORD-${String(index).padStart(8, "0")}`;

      orderRows.push([
        user.id,
        orderNumber,
        primaryItem.productSku,
        primaryItem.productName,
        total,
        "USD",
        orderStatus,
        paymentStatus,
        fulfillmentStatus,
        `${user.firstName} ${user.lastName}`,
        user.email,
        subtotal,
        discount,
        tax,
        shipping,
        total,
        JSON.stringify(makeAddress(index)),
        JSON.stringify(makeAddress(index + 17)),
        createdAt,
        createdAt,
        cancelledAt
      ]);

      for (const item of items) {
        itemRows.push({
          orderNumber,
          ...item
        });
      }
    }

    const orderColumnCount = 21;
    const orderValuesSql = orderRows
      .map((_, rowIndex) => {
        const valueOffset = rowIndex * orderColumnCount;
        return `(${Array.from({ length: orderColumnCount }, (_value, colIndex) => `$${valueOffset + colIndex + 1}`).join(", ")})`;
      })
      .join(", ");

    const insertedOrders = await client.query<{ id: string; orderNumber: string }>(
      `INSERT INTO orders (
        user_id,
        order_number,
        product_sku,
        product_name,
        amount_cents,
        currency,
        order_status,
        payment_status,
        fulfillment_status,
        customer_name,
        customer_email,
        subtotal_amount_cents,
        discount_amount_cents,
        tax_amount_cents,
        shipping_amount_cents,
        total_amount_cents,
        shipping_address,
        billing_address,
        placed_at,
        created_at,
        cancelled_at
      ) VALUES ${orderValuesSql}
      RETURNING id, order_number AS "orderNumber"`,
      orderRows.flat()
    );

    const orderIdByNumber = new Map(insertedOrders.rows.map((order) => [order.orderNumber, order.id]));
    const resolvedItems = itemRows.map((item) => [
      orderIdByNumber.get(item.orderNumber),
      item.position,
      item.productSku,
      item.productName,
      item.quantity,
      item.unitPriceCents,
      item.totalPriceCents
    ]);
    const itemColumnCount = 7;
    const itemValuesSql = resolvedItems
      .map((_, rowIndex) => {
        const valueOffset = rowIndex * itemColumnCount;
        return `(${Array.from({ length: itemColumnCount }, (_value, colIndex) => `$${valueOffset + colIndex + 1}`).join(", ")})`;
      })
      .join(", ");

    await client.query(
      `INSERT INTO order_items (
        order_id,
        position,
        product_sku,
        product_name,
        quantity,
        unit_price_cents,
        total_price_cents
      ) VALUES ${itemValuesSql}`,
      resolvedItems.flat()
    );

    console.log(`Seeded ${Math.min(start + ORDER_BATCH_SIZE, ORDER_COUNT)} / ${ORDER_COUNT} orders`);
  }
}

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE order_items, orders, users RESTART IDENTITY");
    const users = await seedUsers(client);
    await seedOrders(client, users);
    await client.query("COMMIT");
    console.log(`Seed complete: ${USER_COUNT} users, ${ORDER_COUNT} orders`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
