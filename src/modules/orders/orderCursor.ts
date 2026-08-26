import { createHash } from "node:crypto";
import { HttpError } from "../../http/errors";
import type { CursorPayload, ListUserOrdersFilters, OrderHistoryEntry, OrderSortBy, SortDirection } from "./orderTypes";

export function filtersSignature(filters: ListUserOrdersFilters): string {
  const normalized = Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  );

  return createHash("sha256").update(JSON.stringify(normalized)).digest("base64url");
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(
  cursor: string,
  sortBy: OrderSortBy,
  sortDirection: SortDirection,
  filters: ListUserOrdersFilters
): CursorPayload {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    const expectedFiltersSignature = filtersSignature(filters);

    if (
      payload.sortBy !== sortBy ||
      payload.sortDirection !== sortDirection ||
      payload.filtersSignature !== expectedFiltersSignature ||
      !payload.id
    ) {
      throw new Error("Cursor does not match current request");
    }

    return payload;
  } catch {
    throw new HttpError(400, "Invalid cursor");
  }
}

export function cursorFromOrder(
  order: OrderHistoryEntry,
  sortBy: OrderSortBy,
  sortDirection: SortDirection,
  filters: ListUserOrdersFilters
): string {
  const sortValue = sortBy === "total" ? order.totalAmountCents : order.createdAt;

  return encodeCursor({
    sortBy,
    sortDirection,
    filtersSignature: filtersSignature(filters),
    sortValue,
    id: order.id
  });
}
