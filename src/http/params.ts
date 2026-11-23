export type FieldBag = Record<string, unknown>;

/** First value of a (possibly repeated) field, trimmed. Mirrors QueryDict.get(). */
export function field(source: FieldBag | undefined, name: string): string {
  const v = source?.[name];
  if (Array.isArray(v)) return String(v[v.length - 1] ?? "").trim();
  return v === undefined || v === null ? "" : String(v).trim();
}

/** Raw (untrimmed) field value; for free text where whitespace is meaningful. */
export function rawField(source: FieldBag | undefined, name: string): string {
  const v = source?.[name];
  if (Array.isArray(v)) return String(v[v.length - 1] ?? "");
  return v === undefined || v === null ? "" : String(v);
}

/** All values of a repeated field (`name` or `name[]`). Mirrors QueryDict.getlist(). */
export function fieldList(source: FieldBag | undefined, name: string): string[] {
  const values = [source?.[name], source?.[`${name}[]`]].flatMap((v) =>
    v === undefined || v === null ? [] : Array.isArray(v) ? v : [v],
  );
  return values.map((v) => String(v));
}

export function query(source: FieldBag | undefined, name: string): string {
  return field(source, name);
}

export function intId(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function idList(values: string[]): number[] {
  return [...new Set(values.map(intId).filter((n): n is number => n !== null))];
}

/** URL-encode a filter dict, skipping empty values (Django's urlencode on a cleaned dict). */
export function encodeQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.append(k, v);
  return qs.toString();
}

/** Current query string minus some keys — e.g. dropping `page` before building pagination links. */
export function queryStringWithout(source: FieldBag, ...exclude: string[]): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(source)) {
    if (exclude.includes(k)) continue;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(k, String(item ?? ""));
  }
  return qs.toString();
}
