import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type Part = 'body' | 'query' | 'params';

/** Validate+coerce a request part against a Zod schema, replacing it with the parsed value. */
function validate(part: Part, schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(
        ApiError.badRequest('Validation failed', result.error.flatten().fieldErrors),
      );
    }
    // query/params are read-only getters in some setups; assign defensively.
    if (part === 'body') req.body = result.data;
    else Object.assign(req[part], result.data);
    next();
  };
}

export const validateBody = (schema: ZodSchema) => validate('body', schema);
export const validateQuery = (schema: ZodSchema) => validate('query', schema);
export const validateParams = (schema: ZodSchema) => validate('params', schema);
