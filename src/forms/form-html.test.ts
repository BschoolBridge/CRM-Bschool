import { describe, expect, it } from "vitest";
import { CharField, ChoiceField, TextField } from "./fields";
import { Form } from "./form";
import { formMarkup } from "../server/form";

const PAYLOAD = `<script>alert(1)</script>`;

class ProbeForm extends Form {
  constructor(initial: Record<string, unknown>) {
    super({ initial });
    this.setFields({
      first_name: new CharField({ required: false, label: "First name" }),
      notes: new TextField({ required: false, label: "Notes" }),
      status: new ChoiceField({
        required: false,
        label: "Status",
        choices: [
          ["", "---------"],
          ["ok", PAYLOAD],
        ],
      }),
    });
  }
}

describe("form html escaping", () => {
  it("renders a name containing a script tag as text", () => {
    const markup = formMarkup(new ProbeForm({ first_name: PAYLOAD, notes: PAYLOAD, status: "" }));
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).toContain('value="&lt;script&gt;alert(1)&lt;/script&gt;"');
  });

  it("escapes a validation error before it is inserted into the form", () => {
    const form = new ProbeForm({ first_name: "Ada" });
    form.addError("first_name", PAYLOAD);
    const markup = formMarkup(form);
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
  });
});
