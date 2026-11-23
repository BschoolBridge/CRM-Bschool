import { bootstrapFields } from "../../forms/bootstrap";
import {
  BooleanField,
  CharField,
  ChoiceField,
  EmailField,
  FileField,
  TextField,
  ValidationError,
  type Field,
} from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { CheckboxInput, ClearableFileInput, PasswordInput } from "../../forms/widgets";
import type { Counsellor, User } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { validateProfilePicture } from "../../lib/uploads";
import { GENDER_CHOICES } from "../presenters";

type Variant = "admin" | "counsellor-create" | "counsellor-edit";

export interface UserCleaned {
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  phone: string;
  password: string;
  profile_pic: { originalname: string; buffer: Buffer; mimetype: string; size: number } | null;
  address: string;
  employee_id?: string;
  department?: string;
  is_active?: boolean;
  can_handle_admission_followup?: boolean;
}

/** CustomUserForm and its counsellor/admin variants. */
export class UserForm extends Form<UserCleaned> {
  constructor(
    readonly variant: Variant,
    input: FormInput & { user?: User | null; counsellor?: Counsellor | null } = {},
  ) {
    super(input);
    const user = input.user ?? null;

    const fields: Record<string, Field> = {
      first_name: new CharField({ maxLength: 150, label: "First name" }),
      last_name: new CharField({ maxLength: 150, label: "Last name" }),
      email: new EmailField({ label: "Email" }),
      gender: new ChoiceField({ choices: GENDER_CHOICES, label: "Gender" }),
      phone: new CharField({ maxLength: 15, required: false, label: "Phone" }),
      password: new CharField({ strip: false, label: "Password", widget: new PasswordInput() }),
      profile_pic: new FileField({ required: false, label: "Profile pic", widget: new ClearableFileInput() }),
      address: new TextField({ label: "Address" }),
    };
    if (variant !== "admin") {
      fields.employee_id = new CharField({ maxLength: 20, label: "Employee id" });
      fields.department = new CharField({ maxLength: 100, required: false, label: "Department" });
    }
    if (variant === "counsellor-edit") {
      fields.is_active = new BooleanField({ label: "Active", widget: new CheckboxInput({ class: "custom-control-input" }) });
      fields.can_handle_admission_followup = new BooleanField({
        label: "Allow After Admission follow-up calls",
        helpText: "Counsellor can see and call admitted students assigned to them.",
        widget: new CheckboxInput({ class: "custom-control-input" }),
      });
    }
    this.setFields(bootstrapFields(fields));

    if (user) {
      this.field("password").required = false;
      this.field("password").widget.attrs.placeholder = "Fill this only if you wish to update password";
      for (const name of ["first_name", "last_name", "email", "gender", "phone", "profile_pic", "address"] as const) {
        this.setInitial(name, user[name]);
      }
    }
    const counsellor = input.counsellor;
    if (counsellor) {
      this.setInitial("employee_id", counsellor.employee_id);
      this.setInitial("department", counsellor.department);
      this.setInitial("is_active", counsellor.is_active);
      this.setInitial("can_handle_admission_followup", counsellor.can_handle_admission_followup);
    }

    this.cleaners = {
      email: async (value: string) => {
        const email = value.toLowerCase();
        if (user && user.email.toLowerCase() === email) return email;
        const taken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
        if (taken) throw ValidationError.of("The given email is already registered");
        return email;
      },
      profile_pic: (file: UserCleaned["profile_pic"]) => (file ? validateProfilePicture(file) : null),
    };
  }

  /** "Clear" ticked on the ClearableFileInput. */
  clearProfilePic(): boolean {
    return "profile_pic-clear" in this.data && !this.cleaned_data.profile_pic;
  }
}
