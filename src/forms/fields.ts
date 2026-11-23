import { calendarDate, calendarDateToIso, parseIsoDate, parseLocalDateTime, toDatetimeLocalInput } from "../lib/time";
import type { Attrs } from "./html";
import {
  CheckboxInput,
  CheckboxSelectMultiple,
  DateInput,
  DateTimeInput,
  EmailInput,
  FileInput,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  URLInput,
  type Choice,
  type Widget,
} from "./widgets";

export class ValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join(" "));
  }
  static of(message: string) {
    return new ValidationError([message]);
  }
}

export interface FieldOptions {
  required?: boolean;
  label?: string;
  /** Plain text, or a SafeString when the help text contains markup. */
  helpText?: string | object;
  initial?: unknown;
  widget?: Widget;
}

const REQUIRED = "This field is required.";

export function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export abstract class Field<T = unknown> {
  required: boolean;
  label: string | undefined;
  helpText: string | object;
  initial: unknown;
  widget: Widget;

  constructor(opts: FieldOptions, defaultWidget: Widget) {
    this.required = opts.required ?? true;
    this.label = opts.label;
    this.helpText = opts.helpText ?? "";
    this.initial = opts.initial;
    this.widget = opts.widget ?? defaultWidget;
  }

  /** Convert raw submitted data to a Python-like value, raising ValidationError when invalid. */
  abstract clean(raw: unknown): T;

  /** Value shown in the widget for an existing (unbound) model value. */
  prepareValue(value: unknown): unknown {
    return value;
  }

  widgetAttrs(): Attrs {
    return this.required && !this.widget.isHidden ? { required: true } : {};
  }

  choices(): readonly Choice[] {
    return [];
  }

  protected checkRequired(raw: unknown): void {
    if (this.required && isEmpty(raw)) throw ValidationError.of(REQUIRED);
  }
}

export class CharField extends Field<string> {
  maxLength?: number;
  strip: boolean;
  constructor(opts: FieldOptions & { maxLength?: number; strip?: boolean } = {}) {
    super(opts, new TextInput());
    this.maxLength = opts.maxLength;
    this.strip = opts.strip ?? true;
  }
  clean(raw: unknown): string {
    let value = raw === undefined || raw === null ? "" : String(raw);
    if (this.strip) value = value.trim();
    this.checkRequired(value);
    if (this.maxLength !== undefined && value.length > this.maxLength) {
      throw ValidationError.of(
        `Ensure this value has at most ${this.maxLength} characters (it has ${value.length}).`,
      );
    }
    return value;
  }
  override widgetAttrs(): Attrs {
    const attrs = super.widgetAttrs();
    if (this.maxLength !== undefined && !(this.widget instanceof Textarea)) attrs.maxlength = this.maxLength;
    return attrs;
  }
}

export class TextField extends CharField {
  constructor(opts: FieldOptions & { maxLength?: number } = {}) {
    super({ widget: new Textarea(), ...opts });
  }
}

const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export class EmailField extends CharField {
  constructor(opts: FieldOptions & { maxLength?: number } = {}) {
    super({ maxLength: 254, widget: new EmailInput(), ...opts });
  }
  override clean(raw: unknown): string {
    const value = super.clean(raw);
    if (value && !EMAIL_RE.test(value)) throw ValidationError.of("Enter a valid email address.");
    return value;
  }
}

export class URLField extends CharField {
  constructor(opts: FieldOptions & { maxLength?: number } = {}) {
    super({ maxLength: 200, widget: new URLInput(), ...opts });
  }
  override clean(raw: unknown): string {
    let value = super.clean(raw);
    if (!value) return value;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
    try {
      const u = new URL(value);
      if (!["http:", "https:", "ftp:", "ftps:"].includes(u.protocol) || !u.hostname.includes(".")) throw new Error();
    } catch {
      throw ValidationError.of("Enter a valid URL.");
    }
    return value;
  }
}

export class IntegerField extends Field<number | null> {
  constructor(private readonly opts: FieldOptions & { minValue?: number; maxValue?: number } = {}) {
    super(opts, new NumberInput());
  }
  clean(raw: unknown): number | null {
    const s = String(raw ?? "").trim();
    this.checkRequired(s);
    if (!s) return null;
    if (!/^[+-]?\d+(\.0*)?$/.test(s)) throw ValidationError.of("Enter a whole number.");
    const n = Number.parseInt(s, 10);
    if (this.opts.minValue !== undefined && n < this.opts.minValue) {
      throw ValidationError.of(`Ensure this value is greater than or equal to ${this.opts.minValue}.`);
    }
    if (this.opts.maxValue !== undefined && n > this.opts.maxValue) {
      throw ValidationError.of(`Ensure this value is less than or equal to ${this.opts.maxValue}.`);
    }
    return n;
  }
  override widgetAttrs(): Attrs {
    const attrs = super.widgetAttrs();
    if (this.opts.minValue !== undefined) attrs.min = this.opts.minValue;
    if (this.opts.maxValue !== undefined) attrs.max = this.opts.maxValue;
    return attrs;
  }
}

export class DecimalField extends Field<string | null> {
  constructor(private readonly opts: FieldOptions & { maxDigits: number; decimalPlaces: number }) {
    super(opts, new NumberInput());
  }
  clean(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    this.checkRequired(s);
    if (!s) return null;
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) throw ValidationError.of("Enter a number.");
    const [intPart = "", fracPart = ""] = s.replace(/^[+-]/, "").split(".");
    const digits = intPart.replace(/^0+(?=\d)/, "").length + fracPart.length;
    if (fracPart.length > this.opts.decimalPlaces) {
      throw ValidationError.of(`Ensure that there are no more than ${this.opts.decimalPlaces} decimal places.`);
    }
    if (digits > this.opts.maxDigits) {
      throw ValidationError.of(`Ensure that there are no more than ${this.opts.maxDigits} digits in total.`);
    }
    return s;
  }
  override prepareValue(value: unknown): unknown {
    if (value === null || value === undefined || value === "") return value;
    const n = Number(String(value));
    return Number.isFinite(n) ? n.toFixed(this.opts.decimalPlaces) : value;
  }
  override widgetAttrs(): Attrs {
    return { ...super.widgetAttrs(), step: `0.${"0".repeat(Math.max(0, this.opts.decimalPlaces - 1))}1` };
  }
}

export class BooleanField extends Field<boolean> {
  constructor(opts: FieldOptions = {}) {
    super({ required: false, ...opts }, new CheckboxInput());
  }
  clean(raw: unknown): boolean {
    const value = raw === true || (typeof raw === "string" && !["", "false", "0"].includes(raw.toLowerCase()));
    if (this.required && !value) throw ValidationError.of(REQUIRED);
    return value;
  }
}

export class ChoiceField extends Field<string> {
  private choiceList: readonly Choice[];
  constructor(opts: FieldOptions & { choices: readonly Choice[] }) {
    super(opts, new Select());
    this.choiceList = opts.choices;
  }
  setChoices(choices: readonly Choice[]) {
    this.choiceList = choices;
  }
  override choices(): readonly Choice[] {
    return this.choiceList;
  }
  clean(raw: unknown): string {
    const value = raw === undefined || raw === null ? "" : String(raw);
    this.checkRequired(value);
    if (value && !this.choiceList.some(([v]) => v === value)) {
      throw ValidationError.of(`Select a valid choice. ${value} is not one of the available choices.`);
    }
    return value;
  }
}

export interface ModelOption {
  id: number;
  label: string;
}

/** Foreign-key select. Options are loaded by the caller (equivalent of a queryset). */
export class ModelChoiceField extends Field<number | null> {
  constructor(
    private readonly options: readonly ModelOption[],
    opts: FieldOptions & { emptyLabel?: string | null } = {},
  ) {
    super(opts, new Select());
    this.emptyLabel = opts.emptyLabel === undefined ? "---------" : opts.emptyLabel;
  }
  private readonly emptyLabel: string | null;

  override choices(): readonly Choice[] {
    const items = this.options.map((o) => [String(o.id), o.label] as const);
    return this.emptyLabel === null ? items : [["", this.emptyLabel], ...items];
  }
  clean(raw: unknown): number | null {
    const value = raw === undefined || raw === null ? "" : String(raw).trim();
    this.checkRequired(value);
    if (!value) return null;
    const id = Number(value);
    if (!Number.isInteger(id) || !this.options.some((o) => o.id === id)) {
      throw ValidationError.of("Select a valid choice. That choice is not one of the available choices.");
    }
    return id;
  }
  override prepareValue(value: unknown): unknown {
    return value === null || value === undefined ? "" : String(value);
  }
}

export class ModelMultipleChoiceField extends Field<number[]> {
  constructor(
    private readonly options: readonly ModelOption[],
    opts: FieldOptions = {},
  ) {
    super(opts, new CheckboxSelectMultiple());
  }
  override choices(): readonly Choice[] {
    return this.options.map((o) => [String(o.id), o.label] as const);
  }
  clean(raw: unknown): number[] {
    const values = (Array.isArray(raw) ? raw : raw === undefined || raw === "" ? [] : [raw]).map(String);
    if (this.required && values.length === 0) throw ValidationError.of("This field is required.");
    const ids: number[] = [];
    for (const v of values) {
      const id = Number(v);
      if (!Number.isInteger(id) || !this.options.some((o) => o.id === id)) {
        throw ValidationError.of(`Select a valid choice. ${v} is not one of the available choices.`);
      }
      ids.push(id);
    }
    return ids;
  }
}

/** Date-only field; cleaned value is a UTC-midnight Date (how Prisma represents @db.Date). */
export class DateField extends Field<Date | null> {
  constructor(opts: FieldOptions = {}) {
    super(opts, new DateInput({ type: "date" }));
  }
  clean(raw: unknown): Date | null {
    const s = String(raw ?? "").trim();
    this.checkRequired(s);
    if (!s) return null;
    const iso = parseIsoDate(s);
    if (!iso) throw ValidationError.of("Enter a valid date.");
    return calendarDate(iso);
  }
  override prepareValue(value: unknown): unknown {
    return value instanceof Date ? calendarDateToIso(value) : value;
  }
}

/** Wall-clock datetime in the configured zone (datetime-local inputs). */
export class DateTimeField extends Field<Date | null> {
  constructor(opts: FieldOptions = {}) {
    super(opts, new DateTimeInput({ type: "datetime-local" }));
  }
  clean(raw: unknown): Date | null {
    const s = String(raw ?? "").trim();
    this.checkRequired(s);
    if (!s) return null;
    const d = parseLocalDateTime(s);
    if (!d) throw ValidationError.of("Enter a valid date/time.");
    return d;
  }
  override prepareValue(value: unknown): unknown {
    return value instanceof Date ? toDatetimeLocalInput(value) : value;
  }
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class FileField extends Field<UploadedFile | null> {
  constructor(opts: FieldOptions = {}) {
    super(opts, new FileInput());
  }
  clean(raw: unknown): UploadedFile | null {
    const file = raw as UploadedFile | undefined;
    if (!file || !file.size) {
      if (this.required) throw ValidationError.of(file ? "The submitted file is empty." : REQUIRED);
      return null;
    }
    return file;
  }
}
