import { bootstrapFields } from "../../forms/bootstrap";
import { BooleanField, CharField, ChoiceField, IntegerField, TextField, ValidationError, type Field } from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import type { Choice } from "../../forms/widgets";
import { LEAD_STATUS_CODE_MAX_LENGTH, normaliseCode } from "./reference.service";

const STATUS_COLORS: Choice[] = [
  ["info", "Info (Blue)"],
  ["primary", "Primary (Dark Blue)"],
  ["warning", "Warning (Yellow)"],
  ["success", "Success (Green)"],
  ["danger", "Danger (Red)"],
  ["secondary", "Secondary (Grey)"],
  ["dark", "Dark"],
  ["light", "Light"],
];

const ACTIVITY_COLORS = STATUS_COLORS.filter(([v]) => v !== "light");

const ACTIVITY_ICONS: Choice[] = [
  ["fas fa-phone", "Phone"],
  ["fas fa-envelope", "Envelope"],
  ["fas fa-handshake", "Handshake / Meeting"],
  ["fas fa-file-alt", "Document / Proposal"],
  ["fas fa-calendar-check", "Calendar / Visit"],
  ["fas fa-exchange-alt", "Transfer"],
  ["fas fa-sticky-note", "Note"],
  ["fas fa-tasks", "Tasks (default)"],
  ["fas fa-comments", "Chat / Discussion"],
  ["fas fa-video", "Video Call"],
];

type Record_ = Record<string, unknown> | null;

/** Model-form helper: fields + initial values from the instance being edited. */
abstract class ModelForm<T extends Record<string, any>> extends Form<T> {
  constructor(input: FormInput, instance: Record_, fields: Record<string, Field>) {
    super(input);
    this.setFields(bootstrapFields(fields));
    if (instance) for (const name of Object.keys(fields)) this.setInitial(name, instance[name]);
  }
}

export interface LeadSourceCleaned {
  name: string;
  description: string;
  is_active: boolean;
}

export class LeadSourceForm extends ModelForm<LeadSourceCleaned> {
  constructor(input: FormInput, instance: Record_ = null) {
    super(input, instance, {
      name: new CharField({ maxLength: 100, label: "Name" }),
      description: new TextField({ required: false, label: "Description" }),
      is_active: new BooleanField({ initial: true, label: "Is active" }),
    });
  }
}

interface CodedCleaned {
  code: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

type CodeExists = (code: string) => Promise<boolean>;

abstract class CodedForm<T extends CodedCleaned> extends ModelForm<T> {
  constructor(input: FormInput, instance: Record_, fields: Record<string, Field>, codeExists: CodeExists, entity: string, maxLength: number) {
    super(input, instance, fields);
    this.cleaners.code = async (raw: string) => {
      const code = normaliseCode(raw);
      if (!code) throw ValidationError.of("Status code is required.");
      if (code.length > maxLength) {
        throw ValidationError.of(`Status code must be ${maxLength} characters or fewer (this code is ${code.length} characters).`);
      }
      if (await codeExists(code)) throw ValidationError.of(`${entity} with this Code already exists.`);
      return code;
    };
  }
}

export interface LeadStatusCleaned extends CodedCleaned {
  color: string;
}

export class LeadStatusForm extends CodedForm<LeadStatusCleaned> {
  constructor(input: FormInput, instance: Record_, codeExists: CodeExists) {
    super(
      input,
      instance,
      {
        code: new CharField({
          maxLength: LEAD_STATUS_CODE_MAX_LENGTH,
          label: "Code",
          helpText: "Internal code (uppercase, no spaces, max 50 characters, e.g. FOLLOW_UP)",
        }),
        name: new CharField({ maxLength: 100, label: "Name", helpText: "Display name e.g. 'New', 'Contacted'" }),
        description: new TextField({ required: false, label: "Description" }),
        color: new ChoiceField({ choices: STATUS_COLORS, initial: "secondary", label: "Color" }),
        sort_order: new IntegerField({ initial: 0, label: "Sort order" }),
        is_active: new BooleanField({ initial: true, label: "Is active" }),
      },
      codeExists,
      "Lead status",
      LEAD_STATUS_CODE_MAX_LENGTH,
    );
  }
}

export interface ActivityTypeCleaned extends CodedCleaned {
  icon: string;
  color: string;
}

export class ActivityTypeForm extends CodedForm<ActivityTypeCleaned> {
  constructor(input: FormInput, instance: Record_, codeExists: CodeExists) {
    super(
      input,
      instance,
      {
        code: new CharField({ maxLength: 30, label: "Code", helpText: "Uppercase, no spaces (e.g. SITE_VISIT)" }),
        name: new CharField({ maxLength: 100, label: "Name", helpText: "Display name e.g. 'Phone Call', 'Email'" }),
        description: new TextField({ required: false, label: "Description" }),
        icon: new ChoiceField({ choices: ACTIVITY_ICONS, initial: "fas fa-tasks", label: "Icon" }),
        color: new ChoiceField({ choices: ACTIVITY_COLORS, initial: "info", label: "Color" }),
        sort_order: new IntegerField({ initial: 0, label: "Sort order" }),
        is_active: new BooleanField({ initial: true, label: "Is active" }),
      },
      codeExists,
      "Activity type",
      30,
    );
  }
}

export class NextActionForm extends CodedForm<CodedCleaned> {
  constructor(input: FormInput, instance: Record_, codeExists: CodeExists) {
    super(
      input,
      instance,
      {
        code: new CharField({ maxLength: 30, label: "Code", helpText: "Uppercase, no spaces (e.g. SEND_BROCHURE)" }),
        name: new CharField({ maxLength: 100, label: "Name", helpText: "Display name e.g. 'Callback', 'Send Brochure'" }),
        description: new TextField({ required: false, label: "Description" }),
        sort_order: new IntegerField({ initial: 0, label: "Sort order" }),
        is_active: new BooleanField({ initial: true, label: "Is active" }),
      },
      codeExists,
      "Next action",
      30,
    );
  }
}
