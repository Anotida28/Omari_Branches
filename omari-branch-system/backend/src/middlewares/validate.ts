import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";

type RequestSchemaMap = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  headers?: ZodTypeAny;
};

export function validateRequest(schemas: RequestSchemaMap): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const sources: Array<keyof RequestSchemaMap> = [
      "body",
      "params",
      "query",
      "headers",
    ];

    for (const source of sources) {
      const schema = schemas[source];
      if (!schema) {
        continue;
      }

      const parsed = schema.safeParse(req[source] as unknown);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      if (source !== "headers") {
        (req as unknown as Record<string, unknown>)[source] = parsed.data;
      }
    }

    next();
  };
}
