export function listPageCount(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function listPageSlice<T>(
  items: T[],
  pageIndex: number,
  pageSize: number
): T[] {
  const start = pageIndex * pageSize;
  return items.slice(start, start + pageSize);
}

export function clampPageIndex(
  pageIndex: number,
  totalItems: number,
  pageSize: number
): number {
  const maxIndex = Math.max(0, listPageCount(totalItems, pageSize) - 1);
  return Math.min(Math.max(0, pageIndex), maxIndex);
}
