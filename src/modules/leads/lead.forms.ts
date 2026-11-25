import { bootstrapFields } from "../../forms/bootstrap";
import {
  CharField,
  ChoiceField,
  DateTimeField,
  DecimalField,
  EmailField,
  IntegerField,
  ModelChoiceField,
  TextField,
  ValidationError,
  type Field,
} from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import type { Lead } from "../../generated/prisma/client";
import { normalizeLeadPhone, placeholderLeadEmail } from "../../lib/phone";
import { prisma } from "../../lib/prisma";
import { GRADUATION_CHOICES } from "../presenters";
import { LEAD_PRIORITIES, leadStatusChoices } from "../reference/reference.service";
import { counsellorOptions } from "../users/user-options";
import { duplicatePhoneMessage, findLeadByPhone } from "./phone-lookup";

const PROFILE_EXTRA_FIELDS = [
  "graduation_status",
  "graduation_course",
  "graduation_year",
  "graduation_college",
  "position",
  "industry",
  "website",
  "linkedin",
  "expected_value",
] as const;

type Variant = "admin" | "counsellor-edit" | "counsellor-create";

/** Form fields aligned with the website lead webhook, plus CRM assignment fields. */
const FIELD_ORDER: Record<Variant, string[]> = {
  admin: [
    "name",
    "phone",
    "email",
    "alternate_phone",
    "whatsapp_phone",
    "preferred_language",
    "target_exam",
    "percentile",
    "city",
    "address",
    "state",
    "country",
    "postal_code",
    "work_experience",
    "academic_background",
    "budget",
    "specialization",
    "college",
    ...PROFILE_EXTRA_FIELDS,
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
    "whatsapp_phone",
    "preferred_language",
    "target_exam",
    "percentile",
    "city",
    "address",
    "state",
    "country",
    "postal_code",
    "work_experience",
    "academic_background",
    "budget",
    "specialization",
    "college",
    ...PROFILE_EXTRA_FIELDS,
    "notes",
    "source",
    "status",
    "priority",
    "next_follow_up",
  ],
  "counsellor-create": [
    "name",
    "phone",
    "email",
    "alternate_phone",
    "whatsapp_phone",
    "preferred_language",
    "target_exam",
    "percentile",
    "city",
    "address",
    "state",
    "country",
    "postal_code",
    "work_experience",
    "academic_background",
    "budget",
    "specialization",
    "college",
    ...PROFILE_EXTRA_FIELDS,
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

const NOTE_META_LABELS: Array<{ label: string; field: string }> = [
  { label: "Target exam", field: "target_exam" },
  { label: "Percentile/score", field: "percentile" },
  { label: "Work experience", field: "work_experience" },
  { label: "Academic background", field: "academic_background" },
  { label: "Budget", field: "budget" },
];

const MODEL_REQUIRED = new Set(["phone", "status", "priority", "name"]);
const ALWAYS_REQUIRED = new Set(["name", "phone", "source"]);

export interface LeadCleaned {
  name: string;
  email: string;
  phone: string;
  alternate_phone: string;
  whatsapp_phone: string;
  preferred_language: string;
  target_exam: string;
  percentile: string;
  city: string;
  address: string;
  state: string;
  country: string;
  postal_code: string;
  work_experience: string;
  academic_background: string;
  budget: string;
  specialization: string;
  college: string;
  graduation_status: string;
  graduation_course: string;
  graduation_year: number | null;
  graduation_college: string;
  position: string;
  industry: string;
  website: string;
  linkedin: string;
  expected_value: string | null;
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

/** Split freeform notes from labeled website meta lines written by leadData(). */
export function parseLeadNoteMeta(notes: string): { freeform: string; meta: Record<string, string> } {
  const meta: Record<string, string> = {};
  const freeform: string[] = [];
  for (const raw of (notes ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let matched = false;
    for (const item of NOTE_META_LABELS) {
      const prefix = `${item.label}:`;
      if (line.toLowerCase().startsWith(prefix.toLowerCase())) {
        meta[item.field] = line.slice(prefix.length).trim();
        matched = true;
        break;
      }
    }
    if (!matched) freeform.push(raw);
  }
  return { freeform: freeform.join("\n").trim(), meta };
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
      whatsapp_phone: new CharField({ maxLength: 20, label: "WhatsApp" }),
      preferred_language: new CharField({ maxLength: 50, label: "Preferred Language" }),
      target_exam: new CharField({ maxLength: 100, label: "Target Exam" }),
      percentile: new CharField({ maxLength: 50, label: "Percentile / Score" }),
      city: new CharField({ maxLength: 100, label: "City" }),
      address: new TextField({ label: "Address" }),
      state: new CharField({ maxLength: 100, label: "State" }),
      country: new CharField({ maxLength: 100, label: "Country" }),
      postal_code: new CharField({ maxLength: 30, label: "Postal Code" }),
      work_experience: new CharField({ maxLength: 100, label: "Work Experience" }),
      academic_background: new CharField({ maxLength: 200, label: "Academic Background" }),
      budget: new CharField({ maxLength: 100, label: "Budget" }),
      specialization: new CharField({ maxLength: 100, label: "Specialization" }),
      college: new CharField({ maxLength: 200, label: "College" }),
      graduation_status: new ChoiceField({ choices: GRADUATION_CHOICES, initial: "NO", label: "Graduated?" }),
      graduation_course: new CharField({ maxLength: 200, label: "Graduation Course" }),
      graduation_year: new IntegerField({ label: "Graduation Year" }),
      graduation_college: new CharField({ maxLength: 200, label: "Graduation College" }),
      position: new CharField({ maxLength: 100, label: "Current Role / Position" }),
      industry: new CharField({ maxLength: 100, label: "Industry" }),
      website: new CharField({ maxLength: 200, label: "Website" }),
      linkedin: new CharField({ maxLength: 200, label: "LinkedIn" }),
      expected_value: new DecimalField({ label: "Expected Fee / Value", maxDigits: 12, decimalPlaces: 2 }),
      notes: new TextField({ label: "Notes" }),
      source: new ModelChoiceField(
        sources.map((s) => ({ id: s.id, label: s.name })),
        { label: "Source", emptyLabel: this.variant === "counsellor-create" ? "Select lead source" : "---------" },
      ),
      status: new ChoiceField({ choices: statuses, initial: "NEW", label: "Lead Status" }),
      priority: new ChoiceField({ choices: LEAD_PRIORITIES, initial: "MEDIUM", label: "Priority" }),
      assigned_counsellor: new ModelChoiceField(counsellors, { label: "Assigned counsellor" }),
      next_follow_up: new DateTimeField({ label: "Next follow up" }),
    };

    const fields: Record<string, Field> = {};
    for (const name of FIELD_ORDER[this.variant]) {
      const field = all[name]!;
      field.required =
        this.variant === "counsellor-edit"
          ? (MODEL_REQUIRED.has(name) && name !== "email") || name === "source"
          : ALWAYS_REQUIRED.has(name);
      fields[name] = field;
    }
    this.setFields(bootstrapFields(fields));

    this.cleaners = {
      name: (v: string) => v.trim(),
      email: (v: string) => v.trim().toLowerCase(),
      alternate_phone: (v: string) => (v.trim() ? normalizeLeadPhone(v) : ""),
      whatsapp_phone: (v: string) => v.trim(),
      preferred_language: (v: string) => v.trim(),
      address: (v: string) => v.trim(),
      state: (v: string) => v.trim(),
      country: (v: string) => v.trim(),
      postal_code: (v: string) => v.trim(),
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
      const parsed = parseLeadNoteMeta(lead.notes ?? "");
      const courseParts = String(lead.course_interested ?? "")
        .split("·")
        .map((part) => part.trim())
        .filter(Boolean);
      for (const name of FIELD_ORDER[this.variant]) {
        if (name === "name") this.setInitial("name", `${lead.first_name} ${lead.last_name}`.trim() || lead.first_name);
        else if (name === "source") this.setInitial(name, lead.source_id);
        else if (name === "assigned_counsellor") this.setInitial(name, lead.assigned_counsellor_id);
        else if (name === "college") this.setInitial(name, lead.school_name);
        else if (name === "specialization") this.setInitial(name, courseParts[0] ?? lead.course_interested ?? "");
        else if (name === "notes") this.setInitial(name, parsed.freeform);
        else if (name === "target_exam") {
          this.setInitial(name, parsed.meta.target_exam || courseParts[1] || "");
        } else if (name === "graduation_course" || name === "graduation_college") {
          const raw = String((lead as Record<string, unknown>)[name] ?? "");
          this.setInitial(name, ["Not Specified", "Not Applicable", ""].includes(raw) ? "" : raw);
        } else if (name === "expected_value") {
          const raw = lead.expected_value;
          this.setInitial(name, raw == null || String(raw) === "0" ? "" : String(raw));
        } else if (VIRTUAL_FIELDS.has(name)) {
          this.setInitial(name, parsed.meta[name] ?? "");
        } else this.setInitial(name, (lead as Record<string, unknown>)[name]);
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
      whatsapp_phone: String(c.whatsapp_phone ?? "").trim() || null,
      preferred_language: String(c.preferred_language ?? "").trim() || null,
      school_name: college.slice(0, 200),
      city: String(c.city ?? "").slice(0, 100),
      address: String(c.address ?? ""),
      state: String(c.state ?? "").slice(0, 100),
      country: String(c.country ?? "").slice(0, 100),
      postal_code: String(c.postal_code ?? "").slice(0, 30),
      course_interested: courseInterested,
      notes: noteLines.join("\n"),
      status: c.status,
      priority: c.priority,
      next_follow_up: c.next_follow_up ?? null,
      graduation_status: String(c.graduation_status ?? this.instance?.graduation_status ?? "NO"),
      graduation_course: String(c.graduation_course ?? "").trim() || this.instance?.graduation_course || "Not Applicable",
      graduation_college: String(c.graduation_college ?? "").trim() || this.instance?.graduation_college || "Not Applicable",
      graduation_year: c.graduation_year ?? this.instance?.graduation_year ?? null,
      is_graduated: String(c.graduation_status ?? this.instance?.is_graduated ?? "NO") === "YES" ? "YES" : "NO",
      position: String(c.position ?? "").trim().slice(0, 100),
      industry: String(c.industry ?? "").trim().slice(0, 100),
      website: String(c.website ?? "").trim().slice(0, 200),
      linkedin: String(c.linkedin ?? "").trim().slice(0, 200),
      expected_value: c.expected_value ?? this.instance?.expected_value ?? 0,
    };

    if (FIELD_ORDER[this.variant].includes("source")) {
      out.source_id = c.source;
    }
    if (this.variant === "admin") {
      out.assigned_counsellor_id = c.assigned_counsellor;
    }
    return out;
  }
}
