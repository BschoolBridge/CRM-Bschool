import { bootstrapFields } from "../../forms/bootstrap";
import { BooleanField, CharField, URLField } from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { PasswordInput, URLInput } from "../../forms/widgets";
import type { AiSensyIntegrationSettings, MetaIntegrationSettings } from "../../generated/prisma/client";

export class MetaIntegrationSettingsForm extends Form<{
  public_base_url: string;
  verify_token: string;
  app_secret: string;
  access_token: string;
  whatsapp_phone_number_id: string;
  facebook_page_id: string;
  whatsapp_enabled: boolean;
  instagram_enabled: boolean;
  facebook_messenger_enabled: boolean;
  notify_admins_on_message: boolean;
}> {
  static create(input: FormInput & { instance?: MetaIntegrationSettings | null } = {}) {
    const form = new MetaIntegrationSettingsForm(input);
    form.setFields(
      bootstrapFields({
        public_base_url: new URLField({
          required: false,
          label: "Public base url",
          widget: new URLInput({ class: "form-control", placeholder: "https://your-domain.com" }),
        }),
        verify_token: new CharField({ required: false, maxLength: 255, label: "Verify token" }),
        app_secret: new CharField({
          required: false,
          maxLength: 255,
          label: "App secret",
          widget: new PasswordInput({ class: "form-control", placeholder: "Leave blank to keep current" }),
        }),
        access_token: new CharField({
          required: false,
          label: "Access token",
          widget: new PasswordInput({ class: "form-control", placeholder: "Leave blank to keep current" }),
        }),
        whatsapp_phone_number_id: new CharField({ required: false, maxLength: 64, label: "Whatsapp phone number id" }),
        facebook_page_id: new CharField({
          required: false,
          maxLength: 64,
          label: "Facebook page id",
        }),
        whatsapp_enabled: new BooleanField({ label: "Whatsapp enabled" }),
        instagram_enabled: new BooleanField({ label: "Instagram enabled" }),
        facebook_messenger_enabled: new BooleanField({ label: "Facebook messenger enabled" }),
        notify_admins_on_message: new BooleanField({ label: "Notify admins on message", initial: true }),
      }),
    );
    const s = input.instance;
    if (s) {
      form.setInitial("public_base_url", s.public_base_url);
      form.setInitial("verify_token", s.verify_token);
      form.setInitial("whatsapp_phone_number_id", s.whatsapp_phone_number_id);
      form.setInitial("facebook_page_id", s.facebook_page_id);
      form.setInitial("whatsapp_enabled", s.whatsapp_enabled);
      form.setInitial("instagram_enabled", s.instagram_enabled);
      form.setInitial("facebook_messenger_enabled", s.facebook_messenger_enabled);
      form.setInitial("notify_admins_on_message", s.notify_admins_on_message);
    }
    return form;
  }
}

export class AiSensyIntegrationSettingsForm extends Form<{
  public_base_url: string;
  webhook_secret: string;
  webhook_token: string;
  enabled: boolean;
}> {
  static create(input: FormInput & { instance?: AiSensyIntegrationSettings | null } = {}) {
    const form = new AiSensyIntegrationSettingsForm(input);
    form.setFields(
      bootstrapFields({
        public_base_url: new URLField({
          required: false,
          label: "Public base url",
          widget: new URLInput({ class: "form-control", placeholder: "https://your-domain.com" }),
        }),
        webhook_secret: new CharField({
          required: false,
          maxLength: 255,
          label: "Webhook secret",
          widget: new PasswordInput({ class: "form-control", placeholder: "Leave blank to keep current" }),
        }),
        webhook_token: new CharField({
          required: false,
          maxLength: 255,
          label: "Webhook token",
          widget: new PasswordInput({ class: "form-control", placeholder: "Leave blank to keep current" }),
        }),
        enabled: new BooleanField({ label: "Enabled", initial: true }),
      }),
    );
    const s = input.instance;
    if (s) {
      form.setInitial("public_base_url", s.public_base_url);
      form.setInitial("enabled", s.enabled);
    }
    return form;
  }
}
