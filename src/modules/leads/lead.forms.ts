import { bootstrapFields } from "../../forms/bootstrap";
import {
  CharField,
  ChoiceField,
  DateTimeField,
  EmailField,
  IntegerField,
  ModelChoiceField,
  TextField,
  URLField,
  ValidationError,
  type Field,
} from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { HiddenInput, NumberInput } from "../../forms/widgets";
import type { Lead } from "../../generated/prisma/client";
import { normalizeLeadPhone, placeholderLeadEmail } from "../../lib/phone";
import { prisma } from "../../lib/prisma";
import { GRADUATION_CHOICES } from "../presenters";
import { LEAD_PRIORITIES, leadStatusChoices } from "../reference/reference.service";
import { counsellorOptions } from "../users/user-options";
import { duplicatePhoneMessage, findLeadByPhone } from "./phone-lookup";

type Variant = "admin" | "counsellor-edit" | "counsellor-create";

const FIELD_ORDER: Record<Variant, string[]> = {
  admin: [
    "name", "email", "phone", "alternate_phone", "school_name", "position",
    "graduation_status", "graduation_course", "graduation_year", "graduation_college",
    "course_interested", "is_graduated", "industry", "source", "status", "priority", "assigned_counsellor",
    "notes", "address", "website", "linkedin", "next_follow_up",
  ],
  "counsellor-edit": [
    "name", "email", "phone", "alternate_phone", "school_name",
    "graduation_status", "graduation_course", "graduation_year", "graduation_college",
    "course_interested", "status", "priority", "notes", "address", "next_follow_up",
  ],
  "counsellor-create": [
    "name", "email", "phone", "alternate_phone", "school_name",
    "graduation_status", "graduation_course", "graduation_year", "graduation_college",
    "course_interested", "source", "status", "priority", "notes", "address", "next_follow_up",
  ],
};

/** Fields required by the model defaults when the form doesn't override them (counsellor edit). */
const MODEL_REQUIRED = new Set(["phone", "graduation_status", "status", "priority", "name", "email"]);
const ALWAYS_REQUIRED = new Set(["name", "phone", "source"]);

export interface LeadCleaned {
  name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  school_name: string;
  position: string;
  graduation_status: string;
  graduation_course: string;
  graduation_year: number | null;
  graduation_college: string;
  course_interested: string;
  is_graduated: string;
  industry: string;
  source: number | null;
  status: string;
  priority: string;
  assigned_counsellor: number | null;
  notes: string;
  address: string;
  website: string;
  linkedin: string;
  next_follow_up: Date | null;
}

export class LeadForm extends Form<LeadCleaned> {
  static async create(variant: Variant, input: FormInput & { instance?: Lead | null } = {}) {
    const form = new LeadForm(variant, input, input.instance ?? null);
    await form.build();
    return form;
  }

  private constructor(
    readonly variant: Variant,
    input: FormInput,
    readonly instance: Lead | null,
  ) {
    super(input);
  }

  private async build() {
    const [statuses, sources, counsellors] = await Promise.all([
      leadStatusChoices(),
      prisma.leadSource.findMany({
        where: this.variant === "counsellor-create" ? { is_active: true } : {},
        orderBy: this.variant === "counsellor-create" ? { name: "asc" } : { id: "asc" },
        select: { id: true, name: true },
      }),
      this.variant === "admin" ? counsellorOptions() : Promise.resolve([]),
    ]);

    const all: Record<string, Field> = {
      name: new CharField({ maxLength: 200, label: "Name" }),
      email: new EmailField({ label: "Email" }),
      phone: new CharField({ maxLength: 15, label: "Phone" }),
      alternate_phone: new CharField({ maxLength: 15, label: "Alternate Phone" }),
      school_name: new CharField({ maxLength: 200, label: "School Name" }),
      position: new CharField({ maxLength: 100, label: "Position" }),
      graduation_status: new ChoiceField({ choices: GRADUATION_CHOICES, initial: "NO", label: "Graduation Status" }),
      graduation_course: new CharField({ maxLength: 200, initial: "Not Specified", label: "Graduation Course" }),
      graduation_year: new IntegerField({ label: "Graduation Year", widget: new NumberInput({ min: "1950", max: "2030" }) }),
      graduation_college: new CharField({ maxLength: 200, initial: "Not Specified", label: "Graduation College" }),
      course_interested: new CharField({ maxLength: 200, label: "Course Interested In" }),
      is_graduated: new CharField({ maxLength: 3, initial: "NO", widget: new HiddenInput(), label: "Is Graduated" }),
      industry: new CharField({ maxLength: 100, widget: new HiddenInput(), label: "Industry (Legacy)" }),
      source: new ModelChoiceField(
        sources.map((s) => ({ id: s.id, label: s.name })),
        { label: "Source", emptyLabel: this.variant === "counsellor-create" ? "Select lead source" : "---------" },
      ),
      status: new ChoiceField({ choices: statuses, initial: "NEW", label: "Status" }),
      priority: new ChoiceField({ choices: LEAD_PRIORITIES, initial: "MEDIUM", label: "Priority" }),
      assigned_counsellor: new ModelChoiceField(counsellors, { label: "Assigned counsellor" }),
      notes: new TextField({ label: "Notes" }),
      address: new TextField({ label: "Address" }),
      website: new URLField({ widget: new HiddenInput(), label: "Website" }),
      linkedin: new URLField({ widget: new HiddenInput(), label: "Linkedin" }),
      next_follow_up: new DateTimeField({ label: "Next follow up" }),
    };

    const fields: Record<string, Field> = {};
    for (const name of FIELD_ORDER[this.variant]) {
      const field = all[name]!;
      field.required = this.variant === "counsellor-edit"
        ? MODEL_REQUIRED.has(name) && name !== "email"
        : ALWAYS_REQUIRED.has(name);
      fields[name] = field;
    }
    this.setFields(bootstrapFields(fields));

    this.cleaners = {
      name: (v: string) => v.trim(),
      email: (v: string) => v.trim().toLowerCase(),
      alternate_phone: (v: string) => (v.trim() ? normalizeLeadPhone(v) : ""),
      phone: async (v: string) => {
        const phone = normalizeLeadPhone(v);
        if (!phone) throw ValidationError.of("Phone number is required.");
        const existing = await findLeadByPhone(phone, this.instance?.id ?? null);
        if (existing) throw ValidationError.of(duplicatePhoneMessage(existing));
        return phone;
      },
      status: (v: string) => {
        if (v && !statuses.some(([code]) => code === v)) throw ValidationError.of("Please select a valid lead status.");
        return v;
      },
    };

    if (this.instance) {
      const lead = this.instance;
      for (const name of FIELD_ORDER[this.variant]) {
        if (name === "name") this.setInitial("name", `${lead.first_name} ${lead.last_name}`.trim() || lead.first_name);
        else if (name === "source") this.setInitial(name, lead.source_id);
        else if (name === "assigned_counsellor") this.setInitial(name, lead.assigned_counsellor_id);
        else this.setInitial(name, (lead as Record<string, unknown>)[name]);
      }
    }
  }

  /** Column values to persist (only the fields this variant exposes). */
  leadData(): Record<string, unknown> {
    const c = this.cleaned_data as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const name of FIELD_ORDER[this.variant]) {
      if (name === "name") continue;
      if (name === "source") out.source_id = c.source;
      else if (name === "assigned_counsellor") out.assigned_counsellor_id = c.assigned_counsellor;
      else out[name] = c[name] ?? (name === "graduation_year" || name === "next_follow_up" ? null : "");
    }
    const [first = "", ...rest] = String(c.name ?? "").split(/\s+/).filter(Boolean);
    out.first_name = first;
    out.last_name = rest.length ? String(c.name).trim().slice(first.length).trim() : "";
    const email = String(c.email ?? "").trim().toLowerCase();
    out.email = email || placeholderLeadEmail(out.phone ?? this.instance?.phone);
    return out;
  }
}
