import { bootstrapFields } from "../../forms/bootstrap";
import {
  CharField,
  ChoiceField,
  DateField,
  DateTimeField,
  FileField,
  ModelChoiceField,
  TextField,
  ValidationError,
} from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { DateInput, FileInput, Textarea } from "../../forms/widgets";
import type { AdmittedStudent } from "../../generated/prisma/client";
import { normalizeLeadPhone } from "../../lib/phone";
import { validateSpreadsheet } from "../../lib/uploads";
import { ADMISSION_CALL_STATUS } from "../presenters";
import { admissionCounsellorOptions } from "./admission.service";

export class AdmittedStudentForm extends Form<{
  name: string;
  phone: string;
  course: string;
  assigned_counsellor: number | null;
  call_status: string;
  next_follow_up: Date | null;
  fee_due_date: Date | null;
  documents_due_date: Date | null;
  notes: string;
}> {
  static async create(input: FormInput & { instance?: AdmittedStudent | null } = {}) {
    const form = new AdmittedStudentForm(input);
    form.setFields(
      bootstrapFields({
        name: new CharField({ maxLength: 200, label: "Name" }),
        phone: new CharField({ maxLength: 20, label: "Phone", helpText: "Student phone number for follow-up calls" }),
        course: new CharField({ maxLength: 200, label: "Course" }),
        assigned_counsellor: new ModelChoiceField(await admissionCounsellorOptions(), {
          required: false,
          emptyLabel: "— Unassigned —",
          label: "Assigned counsellor",
        }),
        call_status: new ChoiceField({ choices: ADMISSION_CALL_STATUS, initial: "NEW", label: "Admission status" }),
        next_follow_up: new DateTimeField({ required: false, label: "Next call date & time" }),
        fee_due_date: new DateField({ required: false, label: "Fee follow-up date", widget: new DateInput({ type: "date" }) }),
        documents_due_date: new DateField({
          required: false,
          label: "Documents follow-up date",
          widget: new DateInput({ type: "date" }),
        }),
        notes: new TextField({
          required: false,
          label: "Quick notes (optional)",
          widget: new Textarea({ class: "form-control", rows: 2 }),
        }),
      }),
    );
    form.cleaners = {
      phone: (v: string) => {
        const phone = normalizeLeadPhone(v);
        if (!phone) throw ValidationError.of("Phone number is required.");
        return phone;
      },
    };
    const s = input.instance;
    if (s) {
      for (const name of ["name", "phone", "course", "call_status", "next_follow_up", "fee_due_date", "documents_due_date", "notes"] as const) {
        form.setInitial(name, s[name]);
      }
      form.setInitial("assigned_counsellor", s.assigned_counsellor_id);
    }
    return form;
  }

  studentData() {
    const c = this.cleaned_data;
    return {
      name: c.name,
      phone: c.phone,
      course: c.course,
      assigned_counsellor_id: c.assigned_counsellor,
      call_status: c.call_status,
      next_follow_up: c.next_follow_up,
      fee_due_date: c.fee_due_date,
      documents_due_date: c.documents_due_date,
      notes: c.notes ?? "",
    };
  }
}

export class AdmittedStudentCallLogForm extends Form<{
  call_notes: string;
  call_status: string;
  schedule_next: string;
  schedule_datetime: Date | null;
  schedule_date: Date | null;
  resolved_next_follow_up?: Date | null;
  resolved_fee_due_date?: Date | null;
  resolved_documents_due_date?: Date | null;
}> {
  static create(input: FormInput & { student?: AdmittedStudent | null } = {}) {
    const form = new AdmittedStudentCallLogForm(input);
    form.setFields(
      bootstrapFields({
        call_notes: new TextField({
          required: false,
          label: "Call notes",
          widget: new Textarea({
            class: "form-control",
            rows: 4,
            placeholder: "Fee discussion, documents pending, student questions…",
          }),
        }),
        call_status: new ChoiceField({
          choices: ADMISSION_CALL_STATUS,
          required: false,
          label: "Update admission status after call",
          initial: input.student?.call_status ?? "NEW",
        }),
        schedule_next: new ChoiceField({
          choices: [
            ["", "— Nothing to schedule —"],
            ["CALL", "Next phone call"],
            ["FEE", "Fee follow-up"],
            ["DOCUMENTS", "Documents follow-up"],
          ],
          required: false,
          label: "What to schedule next?",
        }),
        schedule_datetime: new DateTimeField({ required: false, label: "Date & time" }),
        schedule_date: new DateField({ required: false, label: "Date", widget: new DateInput({ type: "date" }) }),
      }),
    );
    return form;
  }

  protected override async clean() {
    const c = this.cleaned_data;
    if (c.schedule_next === "CALL") {
      if (!c.schedule_datetime) return this.addError("schedule_datetime", "Please pick date and time for the next call.");
      c.resolved_next_follow_up = c.schedule_datetime;
    } else if (c.schedule_next === "FEE") {
      if (!c.schedule_date) return this.addError("schedule_date", "Please pick the fee follow-up date.");
      c.resolved_fee_due_date = c.schedule_date;
    } else if (c.schedule_next === "DOCUMENTS") {
      if (!c.schedule_date) return this.addError("schedule_date", "Please pick the documents follow-up date.");
      c.resolved_documents_due_date = c.schedule_date;
    }
  }
}

export class AdmittedStudentRemarkForm extends Form<{ remark: string }> {
  static create(input: FormInput = {}) {
    const form = new AdmittedStudentRemarkForm(input);
    form.setFields(
      bootstrapFields({
        remark: new TextField({
          label: "Add remark",
          widget: new Textarea({
            class: "form-control",
            rows: 3,
            placeholder: "Call outcome, documents pending, next steps…",
          }),
        }),
      }),
    );
    form.cleaners = {
      remark: (v: string) => {
        const text = (v ?? "").trim();
        if (!text) throw ValidationError.of("Remark cannot be empty.");
        return text;
      },
    };
    return form;
  }
}

export class AdmittedStudentImportForm extends Form<{
  file: { originalname: string; buffer: Buffer; mimetype: string; size: number };
  assigned_counsellor: number | null;
}> {
  static async create(input: FormInput = {}) {
    const form = new AdmittedStudentImportForm(input);
    form.setFields(
      bootstrapFields({
        file: new FileField({
          label: "Select a file",
          helpText: "Upload Excel (.xlsx) or CSV (.csv) file",
          widget: new FileInput({ accept: ".xlsx,.csv" }),
        }),
        assigned_counsellor: new ModelChoiceField(await admissionCounsellorOptions(), {
          required: false,
          emptyLabel: "— Unassigned —",
          label: "Assign imported rows to counsellor (optional)",
        }),
      }),
    );
    form.cleaners = { file: (file) => (file ? validateSpreadsheet(file, { checkMime: true }) : file) };
    return form;
  }
}
