export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Luminous Order History API",
    version: "1.0.0",
    description: "Take-home API for reading a user's order history."
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development"
    }
  ],
  components: {
    securitySchemes: {
      userIdHeader: {
        type: "apiKey",
        in: "header",
        name: "x-user-id"
      },
      userRoleHeader: {
        type: "apiKey",
        in: "header",
        name: "x-user-role"
      }
    },
    schemas: {
      OrderItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          productId: { type: "string", format: "uuid" },
          productSku: { type: "string", example: "LUM-PRO" },
          productName: { type: "string", example: "Luminous Pro Kit" },
          quantity: { type: "integer", example: 1 },
          unitPriceCents: { type: "integer", example: 12900 },
          totalPriceCents: { type: "integer", example: 12900 }
        }
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          orderNumber: { type: "string", example: "ORD-00000026" },
          currency: { type: "string", example: "USD" },
          orderStatus: { type: "string", enum: ["pending", "confirmed", "cancelled", "refunded", "fulfilled"] },
          paymentStatus: { type: "string", enum: ["unpaid", "authorized", "paid", "failed", "refunded"] },
          fulfillmentStatus: {
            type: "string",
            enum: ["not_started", "processing", "shipped", "delivered", "cancelled"]
          },
          customerName: { type: "string", nullable: true },
          customerEmail: { type: "string", nullable: true },
          subtotalAmountCents: { type: "integer" },
          discountAmountCents: { type: "integer" },
          taxAmountCents: { type: "integer" },
          shippingAmountCents: { type: "integer" },
          totalAmountCents: { type: "integer" },
          shippingAddress: { type: "object" },
          billingAddress: { type: "object" },
          placedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          cancelledAt: { type: "string", format: "date-time", nullable: true },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderItem" }
          }
        }
      },
      OrderHistoryResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Order" }
          },
          page: {
            type: "object",
            properties: {
              limit: { type: "integer", example: 25 },
              hasMore: { type: "boolean" },
              nextCursor: { type: "string", nullable: true },
              sortBy: { type: "string", enum: ["createdAt", "total"] },
              sortDirection: { type: "string", enum: ["asc", "desc"] }
            }
          }
        }
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              message: { type: "string" }
            }
          }
        }
      }
    }
  },
  security: [{ userIdHeader: [], userRoleHeader: [] }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "Service is healthy"
          }
        }
      }
    },
    "/api/users/{userId}/orders": {
      get: {
        summary: "List a user's order history",
        description: "Returns orders newest first by default. The caller must be the same user or an admin.",
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" }
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 25 }
          },
          {
            name: "cursor",
            in: "query",
            schema: { type: "string" }
          },
          {
            name: "sortBy",
            in: "query",
            schema: { type: "string", enum: ["createdAt", "total"], default: "createdAt" }
          },
          {
            name: "sortDirection",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" }
          },
          {
            name: "orderStatus",
            in: "query",
            schema: { type: "string", enum: ["pending", "confirmed", "cancelled", "refunded", "fulfilled"] }
          },
          {
            name: "paymentStatus",
            in: "query",
            schema: { type: "string", enum: ["unpaid", "authorized", "paid", "failed", "refunded"] }
          },
          {
            name: "fulfillmentStatus",
            in: "query",
            schema: { type: "string", enum: ["not_started", "processing", "shipped", "delivered", "cancelled"] }
          },
          {
            name: "productSku",
            in: "query",
            schema: { type: "string", example: "LUM-PRO" }
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string", example: "Luminous" }
          },
          {
            name: "createdFrom",
            in: "query",
            schema: { type: "string", format: "date-time" }
          },
          {
            name: "createdTo",
            in: "query",
            schema: { type: "string", format: "date-time" }
          }
        ],
        responses: {
          "200": {
            description: "Orders returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderHistoryResponse" }
              }
            }
          },
          "400": {
            description: "Invalid request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          "401": {
            description: "Missing or invalid auth headers"
          },
          "403": {
            description: "Caller is not the user or an admin"
          },
          "404": {
            description: "User not found"
          }
        }
      }
    }
  }
} as const;
