export type OrderStatus = "pending" | "confirmed" | "cancelled" | "refunded" | "fulfilled";
export type PaymentStatus = "unpaid" | "authorized" | "paid" | "failed" | "refunded";
export type FulfillmentStatus = "not_started" | "processing" | "shipped" | "delivered" | "cancelled";
export type OrderSortBy = "createdAt" | "total";
export type SortDirection = "asc" | "desc";

export interface ListUserOrdersFilters {
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  productSku?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface ListUserOrdersInput {
  userId: string;
  limit: number;
  cursor?: string;
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  filters: ListUserOrdersFilters;
}

export interface OrderItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface OrderHistoryEntry {
  id: string;
  userId: string;
  orderNumber: string;
  currency: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  customerName: string | null;
  customerEmail: string | null;
  subtotalAmountCents: number;
  discountAmountCents: number;
  taxAmountCents: number;
  shippingAmountCents: number;
  totalAmountCents: number;
  shippingAddress: unknown;
  billingAddress: unknown;
  placedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  items: OrderItem[];
}

export interface CursorPayload {
  sortBy: OrderSortBy;
  sortDirection: SortDirection;
  sortValue: string | number;
  id: string;
}

export interface ListUserOrdersResult {
  data: OrderHistoryEntry[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    sortBy: OrderSortBy;
    sortDirection: SortDirection;
  };
}
