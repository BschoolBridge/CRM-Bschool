import { beforeEach, describe, expect, it, vi } from "vitest";
import { activityFormMarkup } from "./activity-form-markup";
import { LeadActivityForm, OTHER_OUTCOME } from "./activity.form";
import { OUTCOME_VISIT_SCHEDULED } from "./activity.service";

vi.mock("../reference/reference.service", () => ({
  activityTypeChoices: async () => [
    ["CALL", "Call"],
    ["FOLLOW_UP", "Follow-up"],
  ],
  nextActionChoices: async () => [
    ["", "— None —"],
    ["CALLBACK", "Callback"],
    ["SCHEDULE_VISIT", "Schedule visit"],
    ["FOLLOW_UP", "Follow-up"],
  ],
}));

describe("LeadActivityForm next action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders next-action wrappers expected by lead_activity_form.js", async () => {
    const form = await LeadActivityForm.create();
    const markup = activityFormMarkup(form);
    expect(markup).toContain('id="next-action-fields"');
    expect(markup).toContain('name="has_next_action"');
    expect(markup).toContain('name="next_action_title"');
    expect(markup).toContain("Next action title");
    expect(markup).toContain('value="yes"');
    expect(markup).toContain('value="no"');
    expect(markup).toMatch(/name="has_next_action"[^>]*value="no"/);
    expect(markup).not.toMatch(/name="has_next_action"[^>]*custom-control-input/);
    expect(markup).toContain('id="outcome-other-wrap"');
    expect(markup).toContain('id="scheduleVisitActivityModal"');
    // nextActionChoices already has empty option — do not add a second blank.
    const nextSelect = markup.match(/id="id_next_action">([\s\S]*?)<\/select>/)?.[1] ?? "";
    expect(nextSelect.match(/option value=""/g)?.length).toBe(1);
  });

  const base = {
    activity_type: "CALL",
    description: "Spoke with lead",
    duration: "0",
    is_completed: "on",
    subject: "",
    scheduled_date: "",
    outcome_other: "",
    next_action_title: "",
    followup_notes: "",
  };

  it("requires follow-up fields when has_next_action is yes", async () => {
    const form = await LeadActivityForm.create({
      data: {
        ...base,
        outcome_preset: "Interested",
        has_next_action: "yes",
        next_action: "",
        followup_date: "",
      },
    });
    expect(await form.isValid()).toBe(false);
    expect(form.errors.next_action?.length || form.errors.followup_date?.length).toBeTruthy();
  });

  it("clears next_action when has_next_action is no", async () => {
    const form = await LeadActivityForm.create({
      data: {
        ...base,
        outcome_preset: "Interested",
        has_next_action: "no",
        next_action: "CALLBACK",
        followup_date: "2026-11-26T10:00",
        followup_notes: "Call again",
      },
    });
    expect(await form.isValid()).toBe(true);
    expect(form.hasNextAction()).toBe(false);
    expect(form.activityData().next_action).toBe("");
  });

  it("forces next action for visit scheduled outcome", async () => {
    const form = await LeadActivityForm.create({
      data: {
        ...base,
        outcome_preset: OUTCOME_VISIT_SCHEDULED,
        has_next_action: "no",
        next_action: "",
        followup_date: "2026-11-26T10:00",
      },
    });
    expect(await form.isValid()).toBe(true);
    expect(form.hasNextAction()).toBe(true);
    expect(form.activityData().next_action).toBe("SCHEDULE_VISIT");
  });

  it("accepts other outcome text", async () => {
    const form = await LeadActivityForm.create({
      data: {
        ...base,
        outcome_preset: OTHER_OUTCOME,
        outcome_other: "Left voicemail",
        has_next_action: "no",
        next_action: "",
        followup_date: "",
      },
    });
    expect(await form.isValid()).toBe(true);
    expect(form.activityData().outcome).toBe("Left voicemail");
  });
});
