"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPagination = getPagination;
function getPagination(page, pageSize) {
    const safePage = page && page > 0 ? page : 1;
    const safePageSize = pageSize && pageSize > 0 ? pageSize : 10;
    const skip = (safePage - 1) * safePageSize;
    return {
        page: safePage,
        pageSize: safePageSize,
        skip,
        take: safePageSize,
    };
}
