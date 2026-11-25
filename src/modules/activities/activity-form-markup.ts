import type { BoundField, Form } from "../../forms/form";
import { SafeHtml, TemplateHtml, escapeHtml } from "../../forms/html";

function helpHtml(help: unknown): string {
  if (help === undefined || help === null || help === "") return "";
  if (help instanceof SafeHtml || help instanceof TemplateHtml) return String(help);
  return `<small class="form-text text-muted">${escapeHtml(help)}</small>`;
}

function fieldGroup(bound: BoundField): string {
  return `<div class="form-group">${bound.label_tag.html()}${bound.html()}${bound.errors.html()}${helpHtml(bound.help_text)}</div>`;
}

/**
 * Lead activity form markup with wrappers expected by lead_activity_form.js:
 * #outcome-other-wrap, #next-action-fields, and the visit schedule modal hooks.
 */
export function activityFormMarkup(form: Form): string {
  const byName = new Map(form.visible_fields.map((bound) => [bound.name, bound]));
  const parts: string[] = [];
  const nonField = form.non_field_errors.html();
  if (nonField) parts.push(nonField);
  for (const hidden of form.hidden_fields) parts.push(hidden.html());

  const order = [
    "activity_type",
    "subject",
    "description",
    "scheduled_date",
    "duration",
    "is_completed",
    "outcome_preset",
  ];
  for (const name of order) {
    const bound = byName.get(name);
    if (bound) parts.push(fieldGroup(bound));
  }

  const outcomeOther = byName.get("outcome_other");
  if (outcomeOther) {
    parts.push(`<div id="outcome-other-wrap" style="display:none;">${fieldGroup(outcomeOther)}</div>`);
  }

  const hasNext = byName.get("has_next_action");
  if (hasNext) {
    parts.push(
      `<div class="form-group"><label class="d-block mb-2">${escapeHtml(hasNext.label)}</label>${hasNext.html()}${hasNext.errors.html()}${helpHtml(hasNext.help_text)}</div>`,
    );
  }

  const nextFields = ["next_action", "next_action_title", "followup_date", "followup_notes"]
    .map((name) => byName.get(name))
    .filter((bound): bound is BoundField => Boolean(bound));
  if (nextFields.length) {
    parts.push(
      `<div id="next-action-fields" class="activity-next-action-fields" hidden style="display:none;">${nextFields.map((bound) => fieldGroup(bound)).join("")}</div>`,
    );
  }

  // Any remaining visible fields (forward-compatible).
  const rendered = new Set([
    ...order,
    "outcome_other",
    "has_next_action",
    "next_action",
    "next_action_title",
    "followup_date",
    "followup_notes",
  ]);
  for (const bound of form.visible_fields) {
    if (!rendered.has(bound.name)) parts.push(fieldGroup(bound));
  }

  parts.push(`
<div class="modal fade" id="scheduleVisitActivityModal" tabindex="-1" role="dialog" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Schedule visit</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
      </div>
      <div class="modal-body">
        <label for="schedule_visit_datetime">Visit date and time</label>
        <input type="datetime-local" id="schedule_visit_datetime" class="form-control" />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" id="schedule_visit_save_btn">Save visit time</button>
      </div>
    </div>
  </div>
</div>`);

  return parts.join("");
}
