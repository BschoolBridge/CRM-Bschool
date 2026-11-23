import { bootstrapFields } from "@/forms/bootstrap";
import { ChoiceField, DateField, IntegerField, ModelMultipleChoiceField } from "@/forms/fields";
import { Form, type FormInput } from "@/forms/form";
import { CheckboxSelectMultiple, DateInput, NumberInput, RadioSelect } from "@/forms/widgets";
import { prisma } from "@/lib/prisma";
import { counsellorLabel } from "@/modules/users/user-options";

interface DailyTargetCleaned {
  target_count: number;
  target_date: Date;
  assign_mode: string;
  counsellors: number[];
}

export class DailyTargetForm extends Form<DailyTargetCleaned> {
  static async create(input: FormInput) {
    const form = new DailyTargetForm(input);
    const counsellors = await prisma.counsellor.findMany({
      where: { is_active: true },
      include: { admin: true },
      orderBy: { id: "asc" },
    });
    form.setFields({
      ...bootstrapFields({
        target_count: new IntegerField({
          minValue: 1,
          initial: 100,
          label: "Number of tasks",
          widget: new NumberInput({ class: "form-control", placeholder: "e.g. 100" }),
        }),
        target_date: new DateField({ label: "Date", widget: new DateInput({ type: "date", class: "form-control" }) }),
      }),
      assign_mode: new ChoiceField({
        choices: [
          ["all", "All Counsellors"],
          ["selected", "Selected Counsellors"],
        ],
        initial: "all",
        widget: new RadioSelect({ class: "custom-control-input" }),
        label: "Assign mode",
      }),
      counsellors: new ModelMultipleChoiceField(
        counsellors.map((counsellor) => ({ id: counsellor.id, label: counsellorLabel(counsellor) })),
        { required: false, widget: new CheckboxSelectMultiple({ class: "custom-control-input" }), label: "Counsellors" },
      ),
    });
    return form;
  }
}
