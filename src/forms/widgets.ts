import { escapeHtml, flatAttrs, type Attrs } from "./html";

export type Choice = readonly [value: string, label: string];

export interface RenderContext {
  name: string;
  id: string;
  value: unknown;
  attrs: Attrs;
  choices: readonly Choice[];
}

export abstract class Widget {
  attrs: Attrs;
  readonly isHidden: boolean = false;
  constructor(attrs: Attrs = {}) {
    this.attrs = { ...attrs };
  }
  abstract render(ctx: RenderContext): string;

  /** Value as submitted for this widget (checkbox widgets override). */
  valueFromData(data: Record<string, unknown>, name: string): unknown {
    const v = data[name];
    return Array.isArray(v) ? v[v.length - 1] : v;
  }

  omittedFromData(data: Record<string, unknown>, name: string): boolean {
    return !(name in data);
  }
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export class Input extends Widget {
  constructor(
    protected readonly inputType: string,
    attrs: Attrs = {},
    private readonly renderValue = true,
  ) {
    super(attrs);
  }
  render({ name, id, value, attrs }: RenderContext): string {
    const v = this.renderValue ? stringValue(value) : "";
    return `<input${flatAttrs({ type: this.inputType, name, value: v === "" ? undefined : v, ...attrs, id })}>`;
  }
}

export class TextInput extends Input {
  constructor(attrs: Attrs = {}) {
    super("text", attrs);
  }
}
export class EmailInput extends Input {
  constructor(attrs: Attrs = {}) {
    super("email", attrs);
  }
}
export class URLInput extends Input {
  constructor(attrs: Attrs = {}) {
    super("url", attrs);
  }
}
export class NumberInput extends Input {
  constructor(attrs: Attrs = {}) {
    super("number", attrs);
  }
}
export class PasswordInput extends Input {
  constructor(attrs: Attrs = {}) {
    super("password", attrs, false);
  }
}
export class DateInput extends Input {
  constructor(attrs: Attrs = {}) {
    super("text", attrs);
  }
  override render(ctx: RenderContext): string {
    const type = (ctx.attrs.type as string) ?? this.inputType;
    const { type: _ignored, ...rest } = ctx.attrs;
    return `<input${flatAttrs({ type, name: ctx.name, value: stringValue(ctx.value) || undefined, ...rest, id: ctx.id })}>`;
  }
}
export class DateTimeInput extends DateInput {}

export class HiddenInput extends Input {
  override readonly isHidden = true;
  constructor(attrs: Attrs = {}) {
    super("hidden", attrs);
  }
}

export class FileInput extends Widget {
  render({ name, id, attrs }: RenderContext): string {
    return `<input${flatAttrs({ type: "file", name, ...attrs, id })}>`;
  }
}

/** Django's ClearableFileInput: shows the current file with an optional "Clear" checkbox. */
export class ClearableFileInput extends FileInput {
  constructor(
    attrs: Attrs = {},
    private readonly urlFor: (path: string) => string = (p) => `/media/${p}`,
  ) {
    super(attrs);
  }
  override render(ctx: RenderContext): string {
    const input = super.render(ctx);
    const current = typeof ctx.value === "string" ? ctx.value : "";
    if (!current) return input;
    const clearName = `${ctx.name}-clear`;
    const clearId = `${clearName}_id`;
    const clear = ctx.attrs.required
      ? ""
      : `\n<input type="checkbox" name="${escapeHtml(clearName)}" id="${escapeHtml(clearId)}">\n<label for="${escapeHtml(clearId)}">Clear</label>`;
    return `Currently: <a href="${escapeHtml(this.urlFor(current))}">${escapeHtml(current)}</a>${clear}<br>\nChange:\n${input}`;
  }
}

export class Textarea extends Widget {
  constructor(attrs: Attrs = {}) {
    super({ cols: 40, rows: 10, ...attrs });
  }
  render({ name, id, value, attrs }: RenderContext): string {
    return `<textarea${flatAttrs({ name, ...attrs, id })}>\n${escapeHtml(stringValue(value))}</textarea>`;
  }
}

export class CheckboxInput extends Widget {
  render({ name, id, value, attrs }: RenderContext): string {
    return `<input${flatAttrs({ type: "checkbox", name, ...attrs, id, checked: isChecked(value) })}>`;
  }
  override valueFromData(data: Record<string, unknown>, name: string): unknown {
    if (!(name in data)) return false;
    const v = super.valueFromData(data, name);
    const s = String(v ?? "").toLowerCase();
    return !(s === "false" || s === "0" || s === "");
  }
  override omittedFromData(): boolean {
    return false;
  }
}

function isChecked(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return false;
  return !["false", "0"].includes(String(value).toLowerCase());
}

export class Select extends Widget {
  render({ name, id, value, attrs, choices }: RenderContext): string {
    const selected = stringValue(value);
    let matched = false;
    const options = choices
      .map(([v, label]) => {
        const isSel = !matched && v === selected;
        if (isSel) matched = true;
        return `  <option value="${escapeHtml(v)}"${isSel ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("\n");
    return `<select${flatAttrs({ name, ...attrs, id })}>\n${options}\n\n</select>`;
  }
}

/** One radio/checkbox option, as yielded when iterating a choice field in a template. */
export interface SubWidget {
  tag: string;
  choice_label: string;
  id_for_label: string;
  data: { value: string; label: string; selected: boolean };
}

abstract class ChoiceInputGroup extends Widget {
  protected abstract readonly inputType: "radio" | "checkbox";

  subwidgets({ name, id, value, attrs, choices }: RenderContext): SubWidget[] {
    const selected = new Set((Array.isArray(value) ? value : [value]).map(stringValue));
    return choices.map(([v, label], i) => {
      const optionId = `${id}_${i}`;
      const isSel = selected.has(v);
      const inputAttrs = { type: this.inputType, name, value: v, ...attrs, id: optionId, checked: isSel };
      return {
        tag: `<input${flatAttrs(inputAttrs)}>`,
        choice_label: label,
        id_for_label: optionId,
        data: { value: v, label, selected: isSel },
      };
    });
  }

  render(ctx: RenderContext): string {
    const items = this.subwidgets(ctx)
      .map((w) => `<div>\n    <label for="${escapeHtml(w.id_for_label)}">${w.tag}\n ${escapeHtml(w.choice_label)}</label>\n\n</div>`)
      .join("\n");
    return `<div id="${escapeHtml(ctx.id)}">\n${items}\n</div>`;
  }
}

export class RadioSelect extends ChoiceInputGroup {
  protected readonly inputType = "radio" as const;
}

export class CheckboxSelectMultiple extends ChoiceInputGroup {
  protected readonly inputType = "checkbox" as const;
  override valueFromData(data: Record<string, unknown>, name: string): unknown {
    const v = data[name] ?? data[`${name}[]`];
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  }
  override omittedFromData(): boolean {
    return false;
  }
}
