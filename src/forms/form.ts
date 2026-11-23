import { escapeHtml, TemplateHtml } from "./html";
import { Field, ValidationError, type UploadedFile } from "./fields";
import { CheckboxSelectMultiple, RadioSelect, type SubWidget } from "./widgets";

/** Renders like Django's ErrorList (`<ul class="errorlist">`) and iterates its messages. */
export class ErrorList extends TemplateHtml {
  constructor(
    private readonly messages: readonly string[],
    private readonly cssClass = "errorlist",
  ) {
    super();
    this.length = messages.length;
  }
  html(): string {
    if (!this.messages.length) return "";
    return `<ul class="${this.cssClass}">${this.messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`;
  }
  [Symbol.iterator]() {
    return this.messages[Symbol.iterator]();
  }
}

function prettyName(name: string): string {
  const words = name.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export class BoundField extends TemplateHtml {
  constructor(
    private readonly form: Form,
    readonly name: string,
    readonly field: Field,
  ) {
    super();
  }

  get html_name() {
    return this.name;
  }
  get auto_id() {
    return `id_${this.name}`;
  }
  get id_for_label() {
    return this.auto_id;
  }
  get label() {
    return this.field.label ?? prettyName(this.name);
  }
  get help_text() {
    return this.field.helpText;
  }
  get errors() {
    return new ErrorList(this.form.errors[this.name] ?? []);
  }
  get is_hidden() {
    return this.field.widget.isHidden;
  }
  get label_tag() {
    return new LabelTag(this.auto_id, this.label);
  }

  /** Value the widget should display: submitted data when bound, else initial. */
  get value(): unknown {
    if (this.form.isBound) return this.field.widget.valueFromData(this.form.data, this.name);
    return this.field.prepareValue(this.form.initialFor(this.name));
  }

  private renderContext() {
    return {
      name: this.name,
      id: this.auto_id,
      value: this.value,
      attrs: { ...this.field.widget.attrs, ...this.field.widgetAttrs() },
      choices: this.field.choices(),
    };
  }

  html(): string {
    return this.field.widget.render(this.renderContext());
  }

  get subwidgets(): SubWidget[] {
    const widget = this.field.widget;
    if (widget instanceof RadioSelect || widget instanceof CheckboxSelectMultiple) {
      const ctx = this.renderContext();
      const { required: _required, ...attrs } = ctx.attrs;
      return widget.subwidgets({ ...ctx, attrs: widget instanceof RadioSelect ? ctx.attrs : attrs });
    }
    return [];
  }

  [Symbol.iterator]() {
    return this.subwidgets[Symbol.iterator]();
  }
}

class LabelTag extends TemplateHtml {
  constructor(
    private readonly forId: string,
    private readonly text: string,
  ) {
    super();
  }
  html() {
    return `<label for="${this.forId}">${escapeHtml(this.text)}:</label>`;
  }
}

export interface FormInput {
  data?: Record<string, unknown> | null;
  files?: Record<string, UploadedFile | undefined>;
  initial?: Record<string, unknown>;
}

type Cleaner = (value: any) => unknown | Promise<unknown>;

/**
 * Minimal port of django.forms.Form: field-level cleaning, per-field hooks,
 * a form-wide clean(), and template-friendly bound fields (`form.<name>`).
 */
export abstract class Form<TClean extends Record<string, any> = Record<string, any>> {
  readonly isBound: boolean;
  readonly data: Record<string, unknown>;
  readonly files: Record<string, UploadedFile | undefined>;
  protected initial: Record<string, unknown>;
  errors: Record<string, string[]> = {};
  cleaned_data = {} as TClean;
  private validated = false;
  private readonly fieldMap = new Map<string, Field>();
  protected cleaners: Record<string, Cleaner> = {};

  constructor(input: FormInput = {}) {
    this.isBound = input.data !== undefined && input.data !== null;
    this.data = input.data ?? {};
    this.files = input.files ?? {};
    this.initial = input.initial ?? {};
  }

  /** Register fields in display order. Called by subclasses once choices are known. */
  protected setFields(fields: Record<string, Field>): void {
    this.fieldMap.clear();
    for (const [name, field] of Object.entries(fields)) {
      this.fieldMap.set(name, field);
      if (!Object.prototype.hasOwnProperty.call(this, name)) {
        Object.defineProperty(this, name, { get: () => this.bound(name), enumerable: false, configurable: true });
      }
    }
  }

  field<F extends Field = Field>(name: string): F {
    const f = this.fieldMap.get(name);
    if (!f) throw new Error(`Form has no field "${name}"`);
    return f as F;
  }

  removeField(name: string): void {
    this.fieldMap.delete(name);
  }

  bound(name: string): BoundField {
    return new BoundField(this, name, this.field(name));
  }

  initialFor(name: string): unknown {
    return name in this.initial ? this.initial[name] : this.fieldMap.get(name)?.initial;
  }

  setInitial(name: string, value: unknown): void {
    this.initial[name] = value;
  }

  get visible_fields(): BoundField[] {
    return [...this.fieldMap.keys()].map((n) => this.bound(n)).filter((b) => !b.is_hidden);
  }

  [Symbol.iterator]() {
    return this.visible_fields[Symbol.iterator]();
  }

  get hidden_fields(): BoundField[] {
    return [...this.fieldMap.keys()].map((n) => this.bound(n)).filter((b) => b.is_hidden);
  }

  get non_field_errors(): ErrorList {
    return new ErrorList(this.errors.__all__ ?? [], "errorlist nonfield");
  }

  addError(fieldName: string | null, message: string): void {
    const key = fieldName ?? "__all__";
    (this.errors[key] ??= []).push(message);
    if (fieldName) delete (this.cleaned_data as Record<string, unknown>)[fieldName];
  }

  hasError(fieldName: string): boolean {
    return Boolean(this.errors[fieldName]?.length);
  }

  /** Form-wide validation hook; may call addError(). */
  protected async clean(): Promise<void> {}

  async isValid(): Promise<boolean> {
    if (!this.isBound) return false;
    if (this.validated) return Object.keys(this.errors).length === 0;
    this.validated = true;

    const cleaned: Record<string, unknown> = {};
    for (const [name, field] of this.fieldMap) {
      const raw = name in this.files ? this.files[name] : field.widget.valueFromData(this.data, name);
      try {
        let value = field.clean(raw);
        const hook = this.cleaners[name];
        if (hook) value = await hook(value);
        cleaned[name] = value;
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        this.errors[name] = err.messages;
      }
    }
    this.cleaned_data = cleaned as TClean;

    try {
      await this.clean();
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      this.addError(null, err.messages.join(" "));
    }
    return Object.keys(this.errors).length === 0;
  }

  /** True when the field was absent from the submitted data (ModelForm leaves such columns untouched). */
  omitted(name: string): boolean {
    return this.field(name).widget.omittedFromData(this.data, name) && !(name in this.files);
  }
}
