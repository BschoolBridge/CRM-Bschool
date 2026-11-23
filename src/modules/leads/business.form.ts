import { bootstrapFields } from "../../forms/bootstrap";
import { CharField, ChoiceField, DateField, DecimalField, TextField } from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { DateInput } from "../../forms/widgets";
import type { Business } from "../../generated/prisma/client";
import { BUSINESS_STATUS } from "../presenters";

export class BusinessForm extends Form<{
  title: string;
  description: string;
  value: string;
  status: string;
  start_date: Date;
  end_date: Date | null;
  payment_terms: string;
  notes: string;
}> {
  static create(input: FormInput & { instance?: Business | null } = {}) {
    const form = new BusinessForm(input);
    form.setFields(
      bootstrapFields({
        title: new CharField({ maxLength: 200, label: "Title" }),
        description: new TextField({ label: "Description" }),
        value: new DecimalField({ maxDigits: 12, decimalPlaces: 2, label: "Value" }),
        status: new ChoiceField({ choices: BUSINESS_STATUS, initial: "PENDING", label: "Status" }),
        start_date: new DateField({ label: "Start date", widget: new DateInput({ type: "date" }) }),
        end_date: new DateField({ required: false, label: "End date", widget: new DateInput({ type: "date" }) }),
        payment_terms: new TextField({ required: false, label: "Payment terms" }),
        notes: new TextField({ required: false, label: "Notes" }),
      }),
    );
    const b = input.instance;
    if (b) {
      form.setInitial("title", b.title);
      form.setInitial("description", b.description);
      form.setInitial("value", b.value);
      form.setInitial("status", b.status);
      form.setInitial("start_date", b.start_date);
      form.setInitial("end_date", b.end_date);
      form.setInitial("payment_terms", b.payment_terms);
      form.setInitial("notes", b.notes);
    }
    return form;
  }
}
