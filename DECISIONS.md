# Order History Endpoint Decisions

## 1. What the requirements did not tell me

The ticket only says to return a user's orders, newest first, keep it responsive, handle no orders, and make sure only the user or an admin can view the data. I had to make these assumptions:

- I used `GET /api/users/:userId/orders` as the route.
- I assumed user ids are UUIDs.
- I assumed a known user with no orders should receive `200` with an empty `data` array.
- I assumed an unknown user should receive `404`. This is the assumption I am least confident about, because some teams prefer returning an empty list to avoid leaking whether a user id exists.
- I assumed "newest first" means `created_at DESC`, with `id DESC` as a tie breaker. The tie breaker matters because two orders can have the same timestamp.
- I assumed the endpoint should never return a user's full order history in one response. If a user has 10,000 orders, returning all 10,000 rows would make the database query, Node memory usage, and HTTP response size unpredictable. I used a bounded `limit` plus cursor pagination instead.
- I assumed filters are useful for real order history, so the endpoint supports order status, payment status, fulfillment status, product SKU, created date range, and text search.
- I assumed search should not be regex-based. Regex and `ILIKE '%term%'` are easy to write but become expensive as data grows. I used Postgres full-text search through `tsvector` and GIN indexes as a better default.
- I assumed sorting should be deliberately limited. The endpoint supports newest/oldest and total amount sorting. I did not add arbitrary sort fields because each extra sort can require a new index or a different query plan.
- I assumed the caller identity is already known before this handler runs. In this take-home I modeled that with `x-user-id` and `x-user-role` headers, but production code should derive those from a verified token/session or a trusted gateway.
- I assumed normal order reads do not need to block order creation or payment updates. Postgres can serve a committed snapshot while writes are happening.
- I assumed the order response should include line items, status fields, money fields, and address snapshots. Real order history is not just one product name on an order row.
- I assumed TypeORM is a good fit for this project because it makes the schema, seed data, and repository structure easier to follow. I still used QueryBuilder for the order-history read because cursor pagination, filters, and full-text search need control over the query shape.
- I assumed every index needs to support a known access pattern. Extra indexes are not free: they consume storage and slow down writes, so I added only the ones tied to the filters/sorts this endpoint exposes.
- I assumed a small amount of structure is worth it here: controller, service, repository, and interfaces. This endpoint has auth, validation, pagination rules, database filtering, search, and response shaping. Keeping those responsibilities separate makes the code easier to review and easier to change.

The indexes I added are:

- `idx_orders_user_created_id`: main path for one user's orders, newest first, with cursor pagination.
- `idx_orders_user_status_created_id`: order status filtering while keeping newest-first ordering.
- `idx_orders_user_payment_created_id`: payment status filtering.
- `idx_orders_user_fulfillment_created_id`: fulfillment/delivery status filtering.
- `idx_orders_user_total_id`: sorting one user's orders by total amount.
- `idx_orders_search_document`: full-text search on order number and order-level product snapshot fields.
- `idx_order_items_order_position`: loading line items for the orders on the current page in a stable order.
- `idx_order_items_product_sku`: filtering orders that contain a product SKU.
- `idx_order_items_search_document`: full-text search on item SKU/name.

The class/interface split is intentional:

- The controller handles HTTP details: params, query values, response codes, and passing errors to Express.
- The service handles use-case rules: unknown user behavior, cursor decoding, fetching one extra row to know whether there is a next page, and building pagination metadata.
- The repository handles persistence details: TypeORM QueryBuilder, joins/filters, full-text search, and loading items.
- The `OrderRepository` interface means the service does not care whether data comes from TypeORM/Postgres today, a read replica tomorrow, or a sharded order service later.
- Dependency injection keeps tests simple. Tests can inject a fake repository and verify authorization, validation, empty results, and pagination behavior without needing a live database.
- It also keeps `createApp` from becoming tightly coupled to one database implementation. The app can receive dependencies from the outside, which is useful for testing and for future infrastructure changes.

## 2. What I used AI for, and what I changed

I used AI as a coding assistant for the first scaffold: Express setup, TypeScript config, Joi validation, Jest setup, and a first draft of the decisions file. I then changed several parts after reviewing the requirements more carefully.

- The first scaffold had a placeholder controller. I replaced it with a controller/service/repository split so HTTP concerns, business rules, and database access are not mixed together.
- I changed the structure to class-based controller/service/repository objects with constructor injection. That made dependencies explicit and made the route tests independent from Postgres.
- The first schema represented an order as one product on one row. I changed that to keep order-level snapshots on `orders` and product rows in `order_items`.
- The first seed was too simple. I changed it to create more realistic users, customer snapshots, addresses, totals, discounts, taxes, shipping, and multiple items per order. Orders are spread across all 5,000 users.
- The first version only documented filters/search. I implemented filters for status, payment, fulfillment, product SKU, date range, and search.
- The first version used only the obvious `(user_id, created_at, id)` index. I kept that index, then added indexes for common filters, total sorting, item lookup, and full-text search.
- I did not let AI add offset pagination. Cursor pagination is a better fit because this endpoint needs to stay stable and responsive as a user's history grows.
- I also made the AI-generated assumptions less absolute. For example, `404` for an unknown user is documented as a real assumption, not a universal truth.
- I changed the first raw `pg` implementation to TypeORM. The migration script now syncs TypeORM entities, the seed uses TypeORM repositories inside a transaction, and the endpoint uses a TypeORM repository with QueryBuilder.
- I did not hide all Postgres-specific details behind TypeORM. Full-text search still uses `tsvector`, GIN indexes, and `websearch_to_tsquery`, because those are database features and should be visible in a performance-sensitive endpoint.
- I also moved route composition out of `createApp`. The first version registered health, docs, and order routes directly in the app factory, which would get noisy as the service grows. `createApp` now handles app-wide middleware and global not-found/error resolvers, while `src/http/routes` owns route registration.

## 3. What breaks first at 100x this data

At 100x, this is about 500,000 users and 5,000,000 orders. That is still a reasonable size for Postgres if the access pattern is indexed, but it is large enough for bad query choices to hurt.

The first failure I expect is slow reads for users with large order histories, especially when filters, search, or sorting stop the query from using the right index. The main path needs this index:

```sql
CREATE INDEX idx_orders_user_created_id
ON orders (user_id, created_at DESC, id DESC);
```

Without that shape, "give me this user's newest orders" can become a scan and sort over far more rows than needed. The visible symptom would be rising endpoint latency, then connection pool pressure as requests wait for slow database work to finish.

The other indexes support the optional query shapes. Status/payment/fulfillment filters each get a user-first composite index so Postgres can still start from one user's orders. The total sort gets its own user-first index because `ORDER BY total_amount_cents` cannot reuse the created-at ordering. Search uses GIN indexes because full-text search needs a different index type than equality/range filters.

The tradeoff is write cost. Every order insert/update now has more index maintenance to do. At 100x, if this system becomes write-heavy, the first index-related failure could be slower order creation or payment updates because Postgres has to update several indexes per row. I would watch write latency, index size, cache hit rate, and autovacuum activity. If a filter is rarely used, I would rather remove its index than keep an expensive index "just in case."

I would detect that with latency percentiles and query timing. `p50` is the median request. `p95` means 95% of requests are faster than that number, so it shows what slower users are experiencing. `p99` is the slowest 1% and is often where production pain appears first. For this endpoint I care more about rising `p95` and `p99` than the average.

I would also log query duration, result count, requested limit, cursor presence, filter usage, and search usage. On the database side I would watch slow queries, CPU, active connections, pool wait time, and table/index growth.

If indexes are correct but the database eventually becomes too large for one Postgres instance, the failure changes from "bad query" to operational limits: indexes stop fitting in memory, writes slow down reads, autovacuum can fall behind, storage grows too quickly, and backup/restore time becomes unacceptable.

If the database gets massive, I would shard by `user_id` because this endpoint's read pattern is user-scoped. The goal is to keep the order-history query single-shard. If it becomes cross-shard, pagination and tail latency become the first real failures.

The application would route the `userId` to the correct shard, then run the same indexed cursor query on that shard. The important design rule is that all orders for a user should live on the same shard.

I thought about sharding from the query access pattern, not from the table size alone. The endpoint always starts with one `userId`, so `user_id` is the natural shard key. A simple version would be hash-based routing: `hash(userId) % shardCount`. A more flexible production version would use a shard map table/service, so users can be moved during rebalancing without changing ids.

The sharding failure to avoid is a cross-shard order-history query. If one user's orders are spread across shards, the API has to ask multiple databases for rows, merge them, sort them, and build a cursor across multiple result sets. That makes pagination harder, increases tail latency, and creates partial-failure cases where one shard is slow or unavailable.

## 4. What I deliberately did not build

- I did not build production authentication. Header-based identity keeps the take-home runnable, but real auth should verify a token/session.
- I did not build admin audit logging. In production, admin reads of another user's order history should probably be recorded.
- I did not add every possible filter. For example, I left out min/max total, currency, country, and item quantity filters because they were not required and each one adds API and indexing choices.
- I did not add arbitrary sorting. The endpoint supports created time and total amount only.
- I did not add a dedicated search service. Postgres full-text search is enough for this scope; OpenSearch/Elasticsearch would be a later decision if search becomes central.
- I did not add caching. Order history is user-specific and changes with payments, refunds, and fulfillment updates. I would first make the database query fast and observable.
- I did not add sharding. The schema and repository boundary keep that path open, but sharding would be unnecessary complexity for 50,000 orders.
- I did not add TypeORM's full migration-file workflow. The take-home uses one idempotent migration script that syncs entities and applies indexes. A production service should track applied migration versions.
