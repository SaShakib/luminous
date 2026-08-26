import type { NextFunction, Request, Response } from "express";
import type Joi from "joi";
import type { ValidationErrorItem } from "joi";
import { HttpError } from "../errors";

interface ValidationSchemas {
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
}

declare global {
  namespace Express {
    interface Request {
      validated?: {
        params?: Record<string, unknown>;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
      };
    }
  }
}

export function validate(schemas: ValidationSchemas) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    request.validated = request.validated ?? {};

    for (const [location, schema] of Object.entries(schemas)) {
      if (!schema) {
        continue;
      }

      const { value, error } = schema.validate(request[location as keyof ValidationSchemas], {
        abortEarly: false,
        convert: true,
        stripUnknown: true
      });

      if (error) {
        next(new HttpError(400, error.details.map((detail: ValidationErrorItem) => detail.message).join("; ")));
        return;
      }

      request.validated[location as "params" | "query" | "body"] = value as Record<string, unknown>;
    }

    next();
  };
}
