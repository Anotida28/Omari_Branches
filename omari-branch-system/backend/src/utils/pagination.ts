export type PaginationResult = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function getPagination(
  page: number | undefined,
  pageSize: number | undefined,
): PaginationResult {
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
