import type { NextFunction, Request, Response } from "express";
import Joi from "joi";
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

const authHeadersSchema = Joi.object({
  "x-user-id": Joi.string().uuid({ version: "uuidv4" }).required(),
  "x-user-role": Joi.string().valid("user", "admin").required()
}).unknown(true);

export function authenticate(request: Request, _response: Response, next: NextFunction): void {
  const { value, error } = authHeadersSchema.validate(request.headers, {
    abortEarly: false,
    convert: true
  });

  if (error) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  request.user = {
    id: value["x-user-id"],
    role: value["x-user-role"] as UserRole
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
