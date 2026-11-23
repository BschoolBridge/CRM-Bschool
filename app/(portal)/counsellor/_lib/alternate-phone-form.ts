import { bootstrapFields } from "@/forms/bootstrap";
import { CharField } from "@/forms/fields";
import { Form, type FormInput } from "@/forms/form";
import { TextInput } from "@/forms/widgets";

export class AlternatePhoneForm extends Form<{ phone: string; label: string }> {
  static create(input: FormInput = {}) {
    const form = new AlternatePhoneForm(input);
    form.setFields(
      bootstrapFields({
        phone: new CharField({ maxLength: 20, label: "Phone", widget: new TextInput({ placeholder: "Alternate phone number" }) }),
        label: new CharField({ required: false, maxLength: 50, label: "Label", widget: new TextInput({ placeholder: "Relation (Father, Mother, etc.)" }) }),
      }),
    );
    return form;
  }
}
