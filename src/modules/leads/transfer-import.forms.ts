import { bootstrapFields } from "../../forms/bootstrap";
import { FileField, ModelChoiceField, TextField } from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { FileInput } from "../../forms/widgets";
import { prisma } from "../../lib/prisma";
import { validateSpreadsheet } from "../../lib/uploads";
import { counsellorOptions } from "../users/user-options";

export class LeadTransferForm extends Form<{ to_counsellor: number; reason: string }> {
  static async create(input: FormInput = {}) {
    const form = new LeadTransferForm(input);
    form.setFields(
      bootstrapFields({
        to_counsellor: new ModelChoiceField(await counsellorOptions(), { label: "To counsellor" }),
        reason: new TextField({ label: "Reason" }),
      }),
    );
    return form;
  }
}

export class LeadImportForm extends Form<{ file: { originalname: string; buffer: Buffer; mimetype: string; size: number }; source: number; assigned_counsellor: number | null }> {
  static async create(input: FormInput = {}) {
    const form = new LeadImportForm(input);
    const sources = await prisma.leadSource.findMany({ where: { is_active: true }, orderBy: { id: "asc" } });
    form.setFields(
      bootstrapFields({
        file: new FileField({
          label: "Select a file",
          helpText: "Upload Excel (.xlsx) or CSV (.csv) file",
          widget: new FileInput({ accept: ".xlsx,.csv" }),
        }),
        source: new ModelChoiceField(sources.map((s) => ({ id: s.id, label: s.name })), { label: "Lead Source" }),
        assigned_counsellor: new ModelChoiceField(await counsellorOptions({ is_active: true }), {
          required: false,
          label: "Assign to Counsellor (Optional)",
        }),
      }),
    );
    form.cleaners = { file: (file) => (file ? validateSpreadsheet(file, { checkMime: true }) : file) };
    return form;
  }
}
