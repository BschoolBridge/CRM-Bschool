const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

export type Attrs = Record<string, string | number | boolean | null | undefined>;

/** Render attributes the way Django's `flatatt` does: booleans as bare names, falsy omitted. */
export function flatAttrs(attrs: Attrs): string {
  let out = "";
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    out += value === true ? ` ${key}` : ` ${key}="${escapeHtml(value)}"`;
  }
  return out;
}

/** HTML that form help text and badges may embed without being escaped again. */
export class SafeHtml {
  constructor(readonly html: string) {}
  toString() {
    return this.html;
  }
}

export function markSafe(html: string): SafeHtml {
  return new SafeHtml(html);
}

/**
 * Objects that render themselves as HTML (`{{ form.phone }}` in the old templates).
 * React prints them through `dangerouslySetInnerHTML` of `html()`.
 */
export abstract class TemplateHtml {
  length = 0;
  abstract html(): string;
  toString(): string {
    return this.html();
  }
  valueOf(): string {
    return this.html();
  }
}
