import { bootstrapFields } from "../../forms/bootstrap";
import { ModelChoiceField, TextField } from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { counsellorOptions } from "../users/user-options";

export class CounsellorNotificationForm extends Form<{ counsellor: number; message: string }> {
  static async create(input: FormInput = {}) {
    const form = new CounsellorNotificationForm(input);
    form.setFields(
      bootstrapFields({
        counsellor: new ModelChoiceField(await counsellorOptions(), { label: "Counsellor" }),
        message: new TextField({ label: "Message" }),
      }),
    );
    return form;
  }
}
