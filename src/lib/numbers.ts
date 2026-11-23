/** Python's round(): halves go to the nearest even integer. */
export function roundHalfEven(value: number, digits = 0): number {
  const factor = 10 ** digits;
  const x = value * factor;
  const floor = Math.floor(x);
  const diff = x - floor;
  const EPS = 1e-9;
  let rounded: number;
  if (Math.abs(diff - 0.5) < EPS) rounded = floor % 2 === 0 ? floor : floor + 1;
  else rounded = Math.round(x);
  return rounded / factor;
}

export function percent(part: number, total: number, digits = 1): number {
  return total ? roundHalfEven((part / total) * 100, digits) : 0;
}

/** Collapse Prisma groupBy rows into `{ key: count }`. */
export function countsBy<K extends string>(rows: Array<Record<K, unknown> & { _count: { _all: number } }>, key: K) {
  const out: Record<string, number> = {};
  for (const row of rows) out[String(row[key])] = row._count._all;
  return out;
}
