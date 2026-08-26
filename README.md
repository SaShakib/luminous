# Luminous Order History API

Express + TypeScript + TypeORM take-home project for:

```http
GET /api/users/:userId/orders
```

The endpoint returns a user's order history, supports cursor pagination, filtering, sorting, and full-text search, and only allows the user themself or an admin to access the data.

## Requirements

- Node.js 20+
- npm
- Postgres database

This project is configured for the provided demo Aiven Postgres database through `.env` and `ca.pem`.

## Install

```bash
npm install
```

## Environment

Create `.env` from the example if it does not already exist:

```bash
cp .env.example .env
```

The demo `.env.example` intentionally includes the database credentials so reviewers can run the project without extra setup.

The Aiven CA certificate is included as `ca.pem` for this demo.

## Database Setup

Run the migration script:

```bash
npm run db:migrate
```

Seed data:

```bash
npm run db:seed
```

The seed creates:

- 5,000 users
- 50,000 orders
- about 125,000 order items
- orders spread across all 5,000 users

## Run The API

Development server:

```bash
npm run dev
```

The API will run at:

```text
http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/health
```

## Swagger UI

Open Swagger UI in the browser:

```text
http://localhost:3000/api-docs
```

Raw OpenAPI JSON:

```text
http://localhost:3000/openapi.json
```

In Swagger UI, click **Authorize** and provide:

- `x-user-id`: the caller's user id
- `x-user-role`: `user` or `admin`

For this take-home, these headers simulate an authenticated caller. In a production service they should come from a verified token/session.

## Demo User IDs

The seed script uses stable user ids, so these work after reseeding:

- Admin user:
  - `x-user-id`: `00000000-0000-4000-8000-000000000001`
  - `x-user-role`: `admin`
- Normal user:
  - `x-user-id`: `00000000-0000-4000-8000-000000000026`
  - `x-user-role`: `user`
- Different normal user for forbidden checks:
  - `x-user-id`: `00000000-0000-4000-8000-000000000027`
  - `x-user-role`: `user`

You can also query the database manually:

```sql
SELECT id, email, role
FROM users
WHERE id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000026',
  '00000000-0000-4000-8000-000000000027'
);
```

## Send Requests

User reading their own orders:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?limit=5" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000026" \
  -H "x-user-role: user"
```

Admin reading another user's orders:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?limit=5" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "x-user-role: admin"
```

Forbidden request example:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000027" \
  -H "x-user-role: user"
```

Expected result: `403 Forbidden`.

## Query Parameters

| Parameter | Description |
| --- | --- |
| `limit` | Page size from 1 to 100. Defaults to 25. |
| `cursor` | Cursor returned from the previous response. |
| `sortBy` | `createdAt` or `total`. Defaults to `createdAt`. |
| `sortDirection` | `asc` or `desc`. Defaults to `desc`. |
| `orderStatus` | `pending`, `confirmed`, `cancelled`, `refunded`, `fulfilled`. |
| `paymentStatus` | `unpaid`, `authorized`, `paid`, `failed`, `refunded`. |
| `fulfillmentStatus` | `not_started`, `processing`, `shipped`, `delivered`, `cancelled`. |
| `productSku` | Filters orders containing a specific SKU, for example `LUM-PRO`. |
| `search` | Full-text search across order number, product SKU, and product name. |
| `createdFrom` | ISO timestamp lower bound for order creation time. |
| `createdTo` | ISO timestamp upper bound for order creation time. |

## Examples

Newest orders:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?limit=10" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000026" \
  -H "x-user-role: user"
```

Next page:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?limit=10&cursor=<NEXT_CURSOR>" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000026" \
  -H "x-user-role: user"
```

Filter by payment status:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?paymentStatus=paid&limit=10" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000026" \
  -H "x-user-role: user"
```

Search by product/order text:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?search=Luminous&limit=10" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000026" \
  -H "x-user-role: user"
```

Sort by highest total:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?sortBy=total&sortDirection=desc&limit=10" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000026" \
  -H "x-user-role: user"
```

Combine filters, search, and sorting:

```bash
curl "http://localhost:3000/api/users/00000000-0000-4000-8000-000000000026/orders?paymentStatus=paid&fulfillmentStatus=shipped&productSku=LUM-PRO&search=Luminous&sortBy=total&sortDirection=desc&limit=10" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000001" \
  -H "x-user-role: admin"
```

## Response Shape

```json
{
  "data": [
    {
      "id": "order-uuid",
      "userId": "user-uuid",
      "orderNumber": "ORD-00000026",
      "currency": "USD",
      "orderStatus": "confirmed",
      "paymentStatus": "paid",
      "fulfillmentStatus": "shipped",
      "totalAmountCents": 14763,
      "createdAt": "2026-08-26T10:00:00.000Z",
      "items": [
        {
          "id": "item-uuid",
          "productSku": "LUM-PRO",
          "productName": "Luminous Pro Kit",
          "quantity": 1,
          "unitPriceCents": 12900,
          "totalPriceCents": 12900
        }
      ]
    }
  ],
  "page": {
    "limit": 10,
    "hasMore": true,
    "nextCursor": "cursor-value",
    "sortBy": "createdAt",
    "sortDirection": "desc"
  }
}
```

## Tests

Run the test suite:

```bash
npm test
```

Other checks:

```bash
npm run typecheck
npm run build
```

## Notes

- `DECISIONS.md` explains assumptions, AI usage, scaling risks, and deliberate omissions.
- `.env.example` includes demo credentials intentionally for this take-home. Do not copy this pattern for production systems.
- TypeORM entities model the database tables, the seed uses TypeORM repositories, and the order-history read path uses TypeORM QueryBuilder.
- The repository layer keeps database access isolated so a different database or backing service can be introduced later with less churn.
