import { HttpError } from "../../http/errors";
import type { CursorPayload, OrderHistoryEntry, OrderSortBy, SortDirection } from "./orderTypes";

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string, sortBy: OrderSortBy, sortDirection: SortDirection): CursorPayload {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;

    if (payload.sortBy !== sortBy || payload.sortDirection !== sortDirection || !payload.id) {
      throw new Error("Cursor does not match current sort");
    }

    return payload;
  } catch {
    throw new HttpError(400, "Invalid cursor");
  }
}

export function cursorFromOrder(order: OrderHistoryEntry, sortBy: OrderSortBy, sortDirection: SortDirection): string {
  const sortValue = sortBy === "total" ? order.totalAmountCents : order.createdAt;

  return encodeCursor({
    sortBy,
    sortDirection,
    sortValue,
    id: order.id
  });
}
