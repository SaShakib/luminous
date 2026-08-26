import type { NextFunction, Request, Response } from "express";
import type Joi from "joi";
import type { ValidationErrorItem } from "joi";
import { HttpError } from "../errors";

interface ValidationSchemas {
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
}

type RequestLocation = "params" | "query" | "body";

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

function runValidation(schema: Joi.ObjectSchema, value: unknown): Record<string, unknown> {
  const result = schema.validate(value, {
    abortEarly: false,
    convert: true,
    stripUnknown: true
  });

  if (result.error) {
    const message = result.error.details.map((detail: ValidationErrorItem) => detail.message).join("; ");
    throw new HttpError(400, message);
  }

  return result.value as Record<string, unknown>;
}

function validateLocation(request: Request, location: RequestLocation, schema?: Joi.ObjectSchema): void {
  if (!schema) {
    return;
  }

  request.validated = request.validated ?? {};
  request.validated[location] = runValidation(schema, request[location]);
}

export function validate(schemas: ValidationSchemas) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      validateLocation(request, "params", schemas.params);
      validateLocation(request, "query", schemas.query);
      validateLocation(request, "body", schemas.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}
