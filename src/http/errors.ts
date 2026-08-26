import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function globalNotFoundResolver(_request: Request, _response: Response, next: NextFunction): void {
  next(new HttpError(404, "Route not found"));
}

export function globalErrorResolver(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: { message: error.message } });
    return;
  }

  console.error(error);
  response.status(500).json({ error: { message: "Internal server error" } });
}
