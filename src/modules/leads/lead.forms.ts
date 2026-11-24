import { bootstrapFields } from "../../forms/bootstrap";
import {
  CharField,
  ChoiceField,
  DateTimeField,
  EmailField,
  ModelChoiceField,
  TextField,
  ValidationError,
  type Field,
} from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import type { Lead } from "../../generated/prisma/client";
import { normalizeLeadPhone, placeholderLeadEmail } from "../../lib/phone";
import { prisma } from "../../lib/prisma";
import { LEAD_PRIORITIES, leadStatusChoices } from "../reference/reference.service";
import { counsellorOptions } from "../users/user-options";
import { duplicatePhoneMessage, findLeadByPhone } from "./phone-lookup";

type Variant = "admin" | "counsellor-edit" | "counsellor-create";

/** Form fields aligned with the website lead webhook, plus CRM assignment fields. */
const FIELD_ORDER: Record<Variant, string[]> = {
  admin: [
    "name",
    "phone",
    "email",
    "alternate_phone",
    "target_exam",
    "percentile",
    "city",
    "work_experience",
    "academic_background",
    "budget",
    "specialization",
    "college",
    "notes",
    "source",
    "status",
    "priority",
    "assigned_counsellor",
    "next_follow_up",
  ],
  "counsellor-edit": [
    "name",
    "phone",
    "email",
    "alternate_phone",
    "target_exam",
    "percentile",
    "city",
    "work_experience",
    "academic_background",
    "budget",
    "specialization",
    "college",
    "notes",
    "status",
    "priority",
    "next_follow_up",
  ],
  "counsellor-create": [
    "name",
    "phone",
    "email",
    "alternate_phone",
    "target_exam",
    "percentile",
    "city",
    "work_experience",
    "academic_background",
    "budget",
    "specialization",
    "college",
    "notes",
    "source",
    "status",
    "priority",
    "next_follow_up",
  ],
};

/** Virtual website fields — not Lead columns; folded into notes / mapped columns on save. */
const VIRTUAL_FIELDS = new Set([
  "target_exam",
  "percentile",
  "work_experience",
  "academic_background",
  "budget",
  "specialization",
  "college",
]);

const MODEL_REQUIRED = new Set(["phone", "status", "priority", "name"]);
const ALWAYS_REQUIRED = new Set(["name", "phone", "source"]);

export interface LeadCleaned {
  name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  target_exam: string;
  percentile: string;
  city: string;
  work_experience: string;
  academic_background: string;
  budget: string;
  specialization: string;
  college: string;
  notes: string;
  source: number | null;
  status: string;
  priority: string;
  assigned_counsellor: number | null;
  next_follow_up: Date | null;
}

function noteLine(label: string, value: string): string {
  const t = value.trim();
  return t ? `${label}: ${t}` : "";
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
      name: new CharField({ maxLength: 200, label: "Full Name" }),
      phone: new CharField({ maxLength: 15, label: "Phone" }),
      email: new EmailField({ label: "Email" }),
      alternate_phone: new CharField({ maxLength: 15, label: "Alternate Phone" }),
      target_exam: new CharField({ maxLength: 100, label: "Target Exam" }),
      percentile: new CharField({ maxLength: 50, label: "Percentile / Score" }),
      city: new CharField({ maxLength: 100, label: "City" }),
      work_experience: new CharField({ maxLength: 100, label: "Work Experience" }),
      academic_background: new CharField({ maxLength: 200, label: "Academic Background" }),
      budget: new CharField({ maxLength: 100, label: "Budget" }),
      specialization: new CharField({ maxLength: 100, label: "Specialization" }),
      college: new CharField({ maxLength: 200, label: "College" }),
      notes: new TextField({ label: "Notes" }),
      source: new ModelChoiceField(
        sources.map((s) => ({ id: s.id, label: s.name })),
        { label: "Source", emptyLabel: this.variant === "counsellor-create" ? "Select lead source" : "---------" },
      ),
      status: new ChoiceField({ choices: statuses, initial: "NEW", label: "Status" }),
      priority: new ChoiceField({ choices: LEAD_PRIORITIES, initial: "MEDIUM", label: "Priority" }),
      assigned_counsellor: new ModelChoiceField(counsellors, { label: "Assigned counsellor" }),
      next_follow_up: new DateTimeField({ label: "Next follow up" }),
    };

    const fields: Record<string, Field> = {};
    for (const name of FIELD_ORDER[this.variant]) {
      const field = all[name]!;
      field.required =
        this.variant === "counsellor-edit" ? MODEL_REQUIRED.has(name) && name !== "email" : ALWAYS_REQUIRED.has(name);
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
        else if (name === "college") this.setInitial(name, lead.school_name);
        else if (name === "specialization") this.setInitial(name, lead.course_interested);
        else if (VIRTUAL_FIELDS.has(name)) this.setInitial(name, "");
        else this.setInitial(name, (lead as Record<string, unknown>)[name]);
      }
    }
  }

  /** Column values to persist (website fields mapped onto Lead columns). */
  leadData(): Record<string, unknown> {
    const c = this.cleaned_data;
    const [first = "", ...rest] = String(c.name ?? "").split(/\s+/).filter(Boolean);
    const phone = String(c.phone ?? "");
    const email = String(c.email ?? "").trim().toLowerCase() || placeholderLeadEmail(phone);
    const specialization = String(c.specialization ?? "").trim();
    const targetExam = String(c.target_exam ?? "").trim();
    const courseInterested =
      [specialization, targetExam].filter(Boolean).join(" · ").slice(0, 200) ||
      (this.instance?.course_interested ?? "");
    const college = String(c.college ?? "").trim();
    const noteLines = [
      String(c.notes ?? "").trim(),
      noteLine("Target exam", targetExam),
      noteLine("Percentile/score", String(c.percentile ?? "")),
      noteLine("Work experience", String(c.work_experience ?? "")),
      noteLine("Academic background", String(c.academic_background ?? "")),
      noteLine("Budget", String(c.budget ?? "")),
    ].filter(Boolean);

    const out: Record<string, unknown> = {
      first_name: first.slice(0, 100),
      last_name: (rest.length ? String(c.name).trim().slice(first.length).trim() : "").slice(0, 100),
      email,
      phone,
      alternate_phone: c.alternate_phone ?? "",
      school_name: college.slice(0, 200),
      city: String(c.city ?? "").slice(0, 100),
      course_interested: courseInterested,
      notes: noteLines.join("\n"),
      status: c.status,
      priority: c.priority,
      next_follow_up: c.next_follow_up ?? null,
      graduation_status: this.instance?.graduation_status ?? "NO",
      graduation_course: this.instance?.graduation_course ?? "Not Applicable",
      graduation_college: this.instance?.graduation_college ?? "Not Applicable",
      graduation_year: this.instance?.graduation_year ?? null,
      is_graduated: this.instance?.is_graduated ?? "NO",
    };

    if (this.variant !== "counsellor-edit") {
      out.source_id = c.source;
    }
    if (this.variant === "admin") {
      out.assigned_counsellor_id = c.assigned_counsellor;
    }
    return out;
  }
}
