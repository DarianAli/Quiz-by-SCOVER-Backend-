// ─── Pagination Utility ───────────────────────────────────────────────────────

export interface PaginationParams {
    page?: string | number;
    limit?: string | number;
}

export interface PaginationResult {
    skip: number;
    take: number;
    page: number;
    limit: number;
}

export function getPagination(params: PaginationParams): PaginationResult {
    const page  = Math.max(1, Number(params.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip  = (page - 1) * limit;

    return { skip, take: limit, page, limit };
}

export function buildMeta(
    total: number,
    page: number,
    limit: number,
): { page: number; limit: number; total: number; totalPages: number } {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}
