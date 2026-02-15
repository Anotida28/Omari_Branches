"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
function validateRequest(schemas) {
    return (req, _res, next) => {
        const sources = [
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
            const parsed = schema.safeParse(req[source]);
            if (!parsed.success) {
                next(parsed.error);
                return;
            }
            if (source !== "headers") {
                req[source] = parsed.data;
            }
        }
        next();
    };
}
