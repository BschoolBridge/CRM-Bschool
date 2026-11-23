export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly expose = true,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (message = "Not Found") => new HttpError(404, message);
export const forbidden = (message = "Access denied") => new HttpError(403, message);
export const badRequest = (message = "Bad Request") => new HttpError(400, message);

/** Equivalent of Django's get_object_or_404. */
export function orNotFound<T>(value: T | null | undefined, message?: string): T {
  if (value === null || value === undefined) throw notFound(message);
  return value;
}

/**
 * Turn an unexpected error into text that is safe to flash to the user:
 * the raw message only in development, never in production.
 */
export function publicErrorMessage(err: unknown, fallback: string, debug: boolean): string {
  if (!debug) return fallback;
  const detail = err instanceof Error ? err.message : String(err);
  return `${fallback} (${detail})`;
}
