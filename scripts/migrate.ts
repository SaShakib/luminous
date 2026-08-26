import { pool } from "../src/db/pool";

const migrations = [
  {
    name: "001_init",
    sql: `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        role text NOT NULL CHECK (role IN ('user', 'admin')),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_number text NOT NULL UNIQUE,
        product_sku text NOT NULL,
        product_name text NOT NULL,
        amount_cents integer NOT NULL CHECK (amount_cents >= 0),
        currency char(3) NOT NULL DEFAULT 'USD',
        order_status text NOT NULL CHECK (order_status IN ('pending', 'confirmed', 'cancelled', 'refunded', 'fulfilled')),
        payment_status text NOT NULL CHECK (payment_status IN ('unpaid', 'authorized', 'paid', 'failed', 'refunded')),
        fulfillment_status text NOT NULL CHECK (fulfillment_status IN ('not_started', 'processing', 'shipped', 'delivered', 'cancelled')),
        search_document tsvector GENERATED ALWAYS AS (
          to_tsvector('simple', order_number || ' ' || product_sku || ' ' || product_name)
        ) STORED,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user_created_id
      ON orders (user_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_user_status_created_id
      ON orders (user_id, order_status, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_search_document
      ON orders USING GIN (search_document);
    `
  },
  {
    name: "002_realistic_orders",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS first_name text,
        ADD COLUMN IF NOT EXISTS last_name text,
        ADD COLUMN IF NOT EXISTS phone text,
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'pending')),
        ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS customer_email text,
        ADD COLUMN IF NOT EXISTS customer_name text,
        ADD COLUMN IF NOT EXISTS subtotal_amount_cents integer NOT NULL DEFAULT 0 CHECK (subtotal_amount_cents >= 0),
        ADD COLUMN IF NOT EXISTS discount_amount_cents integer NOT NULL DEFAULT 0 CHECK (discount_amount_cents >= 0),
        ADD COLUMN IF NOT EXISTS tax_amount_cents integer NOT NULL DEFAULT 0 CHECK (tax_amount_cents >= 0),
        ADD COLUMN IF NOT EXISTS shipping_amount_cents integer NOT NULL DEFAULT 0 CHECK (shipping_amount_cents >= 0),
        ADD COLUMN IF NOT EXISTS total_amount_cents integer NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
        ADD COLUMN IF NOT EXISTS shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS placed_at timestamptz,
        ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

      CREATE TABLE IF NOT EXISTS order_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        position integer NOT NULL CHECK (position > 0),
        product_id uuid NOT NULL DEFAULT gen_random_uuid(),
        product_sku text NOT NULL,
        product_name text NOT NULL,
        quantity integer NOT NULL CHECK (quantity > 0),
        unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
        total_price_cents integer NOT NULL CHECK (total_price_cents >= 0),
        search_document tsvector GENERATED ALWAYS AS (
          to_tsvector('simple', product_sku || ' ' || product_name)
        ) STORED,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (order_id, position)
      );

      CREATE INDEX IF NOT EXISTS idx_order_items_order_position
      ON order_items (order_id, position);

      CREATE INDEX IF NOT EXISTS idx_order_items_product_sku
      ON order_items (product_sku);

      CREATE INDEX IF NOT EXISTS idx_order_items_search_document
      ON order_items USING GIN (search_document);

      CREATE INDEX IF NOT EXISTS idx_orders_user_payment_created_id
      ON orders (user_id, payment_status, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_user_fulfillment_created_id
      ON orders (user_id, fulfillment_status, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_user_total_id
      ON orders (user_id, total_amount_cents DESC, id DESC);
    `
  }
];

async function main(): Promise<void> {
  for (const migration of migrations) {
    await pool.query(migration.sql);
    console.log(`Applied ${migration.name}`);
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
