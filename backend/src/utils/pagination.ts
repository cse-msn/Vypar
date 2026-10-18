import { z } from 'zod';

/** Reusable query schema for list endpoints. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().optional(),
  sort: z.string().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, limit };
}

export function buildMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    hasMore: page * limit < total,
  };
}
