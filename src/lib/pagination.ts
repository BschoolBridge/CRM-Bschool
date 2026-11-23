/**
 * Django-style page object. It extends Array so templates can iterate it
 * directly, while exposing the same attributes Django's Page has.
 */
export class Page<T> extends Array<T> {
  declare number: number;
  declare paginator: { count: number; num_pages: number; per_page: number; page_range: number[] };

  static build<T>(items: T[], number: number, perPage: number, count: number): Page<T> {
    const page = new Page<T>();
    page.push(...items);
    const numPages = Math.max(1, Math.ceil(count / perPage));
    page.number = number;
    page.paginator = {
      count,
      num_pages: numPages,
      per_page: perPage,
      page_range: Array.from({ length: numPages }, (_, i) => i + 1),
    };
    return page;
  }

  static override get [Symbol.species]() {
    return Array;
  }

  get has_next(): boolean {
    return this.number < this.paginator.num_pages;
  }
  get has_previous(): boolean {
    return this.number > 1;
  }
  get has_other_pages(): boolean {
    return this.has_next || this.has_previous;
  }
  get next_page_number(): number {
    return this.number + 1;
  }
  get previous_page_number(): number {
    return this.number - 1;
  }
  get start_index(): number {
    return this.paginator.count === 0 ? 0 : (this.number - 1) * this.paginator.per_page + 1;
  }
  get end_index(): number {
    return this.number === this.paginator.num_pages
      ? this.paginator.count
      : this.number * this.paginator.per_page;
  }
  get object_list(): T[] {
    return Array.from(this);
  }
}

/** Page size used by the admin directory and notification inboxes. */
export const LIST_PAGE_SIZE = 50;

/** Same fallbacks as the Django helper: non-numeric → page 1, out of range → last page. */
export function resolvePageNumber(raw: unknown, count: number, perPage: number): number {
  const numPages = Math.max(1, Math.ceil(count / perPage));
  const n = Math.trunc(Number(String(raw ?? "").trim() || Number.NaN));
  if (!Number.isFinite(n)) return 1;
  if (n < 1 || n > numPages) return numPages;
  return n;
}

export async function paginate<T>(
  rawPage: unknown,
  perPage: number,
  count: () => Promise<number>,
  fetch: (skip: number, take: number) => Promise<T[]>,
): Promise<Page<T>> {
  const total = await count();
  const number = resolvePageNumber(rawPage, total, perPage);
  const items = total ? await fetch((number - 1) * perPage, perPage) : [];
  return Page.build(items, number, perPage, total);
}
