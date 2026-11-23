import { CharField, EmailField, ValidationError } from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { PasswordInput } from "../../forms/widgets";
import { PASSWORD_HELP_TEXT, validatePassword } from "./password-policy";

export class PasswordResetRequestForm extends Form<{ email: string }> {
  constructor(input: FormInput) {
    super(input);
    this.setFields({ email: new EmailField({ label: "Email" }) });
  }
}

export class SetPasswordForm extends Form<{ new_password1: string; new_password2: string }> {
  constructor(
    input: FormInput,
    private readonly owner: { email: string; first_name: string; last_name: string },
  ) {
    super(input);
    this.setFields({
      new_password1: new CharField({ label: "New password", strip: false, helpText: PASSWORD_HELP_TEXT, widget: new PasswordInput() }),
      new_password2: new CharField({ label: "New password confirmation", strip: false, widget: new PasswordInput() }),
    });
    this.cleaners = {
      new_password2: (value: string) => {
        const first = this.cleaned_data.new_password1;
        if (first && value && first !== value) throw ValidationError.of("The two password fields didn’t match.");
        const problems = validatePassword(value, this.owner);
        if (problems.length) throw new ValidationError(problems);
        return value;
      },
    };
  }
}
