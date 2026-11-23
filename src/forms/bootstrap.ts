import type { Field } from "./fields";
import { CheckboxInput, CheckboxSelectMultiple, FileInput, RadioSelect } from "./widgets";

/** AdminLTE styling: form-control inputs, custom-switch checkboxes (apply_bootstrap_widget_classes). */
export function bootstrapFields<T extends Record<string, Field>>(fields: T): T {
  for (const field of Object.values(fields)) {
    const w = field.widget;
    if (w instanceof CheckboxInput) w.attrs.class = "custom-control-input";
    else if (w instanceof FileInput) w.attrs.class = "form-control-file";
    else if (w instanceof RadioSelect || w instanceof CheckboxSelectMultiple) continue;
    else {
      const existing = String(w.attrs.class ?? "");
      if (!existing.split(/\s+/).includes("form-control")) w.attrs.class = `${existing} form-control`.trim();
    }
  }
  return fields;
}
