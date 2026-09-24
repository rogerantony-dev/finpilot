/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export function pageInfo(page: number, pageSize: number, totalItems: number) {
  return { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
}
