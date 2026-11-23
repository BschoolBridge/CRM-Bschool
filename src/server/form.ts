import type { UploadedFile } from "../forms/fields";
import { SafeHtml, TemplateHtml, escapeHtml } from "../forms/html";
import type { Form } from "../forms/form";

export type FormState = { markup: string } | null;

export function recordFromFormData(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (value instanceof File) continue;
    const prev = out[key];
    if (prev === undefined) out[key] = value;
    else if (Array.isArray(prev)) prev.push(value);
    else out[key] = [prev, value];
  }
  return out;
}

export async function filesFromFormData(fd: FormData): Promise<Record<string, UploadedFile | undefined>> {
  const files: Record<string, UploadedFile | undefined> = {};
  for (const [key, value] of fd.entries()) {
    if (!(value instanceof File) || value.size === 0 || !value.name) continue;
    files[key] = {
      originalname: value.name,
      mimetype: value.type || "application/octet-stream",
      size: value.size,
      buffer: Buffer.from(await value.arrayBuffer()),
    };
  }
  return files;
}

export async function formInput(fd: FormData) {
  return { data: recordFromFormData(fd), files: await filesFromFormData(fd) };
}

function helpHtml(help: unknown): string {
  if (help === undefined || help === null || help === "") return "";
  if (help instanceof SafeHtml || help instanceof TemplateHtml) return String(help);
  return `<small class="form-text text-muted">${escapeHtml(help)}</small>`;
}

/** Bootstrap markup for an existing Form instance, including validation errors. */
export function formMarkup(form: Form): string {
  const parts: string[] = [];
  const nonField = form.non_field_errors.html();
  if (nonField) parts.push(nonField);
  for (const hidden of form.hidden_fields) parts.push(hidden.html());
  for (const bound of form.visible_fields) {
    parts.push(
      `<div class="form-group">${bound.label_tag.html()}${bound.html()}${bound.errors.html()}${helpHtml(bound.help_text)}</div>`,
    );
  }
  return parts.join("");
}
