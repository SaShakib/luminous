import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors";

export type UserRole = "user" | "admin";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const roles = new Set<UserRole>(["user", "admin"]);

export function authenticate(request: Request, _response: Response, next: NextFunction): void {
  const userId = request.header("x-user-id");
  const role = request.header("x-user-role");

  if (!userId || !role || !roles.has(role as UserRole)) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  request.user = {
    id: userId,
    role: role as UserRole
  };

  next();
}

export function requireSelfOrAdmin(request: Request, _response: Response, next: NextFunction): void {
  if (!request.user) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  if (request.user.role === "admin" || request.user.id === request.params.userId) {
    next();
    return;
  }

  next(new HttpError(403, "Forbidden"));
}
