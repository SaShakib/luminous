import Joi from "joi";

const orderStatuses = ["pending", "confirmed", "cancelled", "refunded", "fulfilled"];
const paymentStatuses = ["unpaid", "authorized", "paid", "failed", "refunded"];
const fulfillmentStatuses = ["not_started", "processing", "shipped", "delivered", "cancelled"];

export const listUserOrdersParamsSchema = Joi.object({
  userId: Joi.string().uuid({ version: "uuidv4" }).required()
});

export const listUserOrdersQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+={0,2}$/)
    .optional(),
  sortBy: Joi.string().valid("createdAt", "total").default("createdAt"),
  sortDirection: Joi.string().valid("asc", "desc").default("desc"),
  orderStatus: Joi.string()
    .valid(...orderStatuses)
    .optional(),
  paymentStatus: Joi.string()
    .valid(...paymentStatuses)
    .optional(),
  fulfillmentStatus: Joi.string()
    .valid(...fulfillmentStatuses)
    .optional(),
  productSku: Joi.string().trim().uppercase().max(64).optional(),
  search: Joi.string().trim().min(1).max(100).optional(),
  createdFrom: Joi.date().iso().optional(),
  createdTo: Joi.date().iso().optional()
});
