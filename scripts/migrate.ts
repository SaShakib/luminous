import { initializeDataSource } from "../src/db/dataSource";

async function createPostgresIndexes(): Promise<void> {
  const dataSource = await initializeDataSource();

  await dataSource.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_created_id
    ON orders (user_id, created_at DESC, id DESC)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_status_created_id
    ON orders (user_id, order_status, created_at DESC, id DESC)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_payment_created_id
    ON orders (user_id, payment_status, created_at DESC, id DESC)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_fulfillment_created_id
    ON orders (user_id, fulfillment_status, created_at DESC, id DESC)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_total_id
    ON orders (user_id, total_amount_cents DESC, id DESC)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_search_document
    ON orders USING GIN (search_document)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_order_items_order_position
    ON order_items (order_id, position)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_order_items_product_sku
    ON order_items (product_sku)
  `);

  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_order_items_search_document
    ON order_items USING GIN (search_document)
  `);
}

async function main(): Promise<void> {
  const dataSource = await initializeDataSource();

  await dataSource.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await dataSource.synchronize(false);
  await createPostgresIndexes();

  console.log("Schema synchronized with TypeORM entities");
  console.log("Postgres-specific indexes applied");
}

main()
  .then(async () => {
    const dataSource = await initializeDataSource();
    await dataSource.destroy();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    const dataSource = await initializeDataSource();
    await dataSource.destroy();
    process.exit(1);
  });
