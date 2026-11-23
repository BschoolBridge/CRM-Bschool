import { bootstrapFields } from "../../forms/bootstrap";
import {
  BooleanField,
  ChoiceField,
  CharField,
  DateTimeField,
  IntegerField,
  TextField,
} from "../../forms/fields";
import { Form, type FormInput } from "../../forms/form";
import { RadioSelect, Textarea, TextInput, type Choice } from "../../forms/widgets";
import type { LeadActivity } from "../../generated/prisma/client";
import { activityTypeChoices, nextActionChoices } from "../reference/reference.service";
import { OUTCOME_VISIT_SCHEDULED, VISIT_NEXT_ACTION_CODE } from "./activity.service";

export const OTHER_OUTCOME = "__OTHER__";

/** Preset values are stored verbatim on LeadActivity.outcome unless "Other" is chosen. */
export const ACTIVITY_OUTCOME_CHOICES: Choice[] = [
  ["", "Not answered / awaiting reply"],
  ["Interested", "Interested"],
  ["Not interested", "Not interested"],
  ["Requested more information", "Requested more information"],
  ["Callback requested", "Callback requested"],
  [OUTCOME_VISIT_SCHEDULED, "Visit scheduled"],
  ["No answer / unreachable", "No answer / unreachable"],
  ["Not connected", "Not connected"],
  ["Wrong number", "Wrong number"],
  [OTHER_OUTCOME, "Other (enter below)"],
];

export const PRESET_OUTCOMES = ACTIVITY_OUTCOME_CHOICES.map(([v]) => v).filter((v) => v && v !== OTHER_OUTCOME);

const VISIT_NEXT_ACTION_PREFERENCE = [VISIT_NEXT_ACTION_CODE, "FOLLOW_UP"];

export interface LeadActivityCleaned {
  activity_type: string;
  subject: string;
  description: string;
  next_action: string;
  scheduled_date: Date | null;
  duration: number;
  is_completed: boolean;
  outcome_preset: string;
  outcome_other: string;
  has_next_action: string;
  followup_date: Date | null;
  followup_notes: string;
  resolved_outcome: string;
}

export class LeadActivityForm extends Form<LeadActivityCleaned> {
  private activityTypes: Choice[] = [];

  static async create(input: FormInput & { instance?: LeadActivity | null } = {}) {
    const form = new LeadActivityForm(input, input.instance ?? null);
    await form.build();
    return form;
  }

  private constructor(
    input: FormInput,
    readonly instance: LeadActivity | null,
  ) {
    super(input);
  }

  private async build() {
    this.activityTypes = await activityTypeChoices();
    const nextActions = await nextActionChoices();

    this.setFields(
      bootstrapFields({
        activity_type: new ChoiceField({ choices: this.activityTypes, label: "Activity type" }),
        subject: new CharField({
          maxLength: 200,
          required: false,
          widget: new TextInput({ placeholder: "Optional — defaults to activity type" }),
        }),
        description: new TextField({}),
        next_action: new ChoiceField({
          choices: [["", "— Select Next Action —"], ...nextActions],
          required: false,
          label: "Next action",
        }),
        scheduled_date: new DateTimeField({ required: false, label: "Scheduled date" }),
        duration: new IntegerField({ initial: 0 }),
        is_completed: new BooleanField({ initial: true, label: "Is completed" }),
        outcome_preset: new ChoiceField({
          choices: ACTIVITY_OUTCOME_CHOICES,
          required: false,
          initial: "",
          label: "Outcome",
          helpText: "If you leave this as “Not answered”, the lead is set to Awaiting Response.",
        }),
        outcome_other: new CharField({
          required: false,
          maxLength: 200,
          label: "Custom outcome",
          widget: new TextInput({ class: "form-control", placeholder: "Type the outcome…" }),
        }),
        has_next_action: new ChoiceField({
          choices: [
            ["no", "No"],
            ["yes", "Yes"],
          ],
          initial: "no",
          required: false,
          widget: new RadioSelect({ class: "custom-control-input" }),
          label: "Is there a next action?",
        }),
        followup_date: new DateTimeField({ required: false, label: "Next Follow-up Date" }),
        followup_notes: new CharField({
          required: false,
          label: "Next Action Details",
          widget: new Textarea({ class: "form-control", rows: 2, placeholder: "What needs to be done next..." }),
        }),
      }),
    );

    if (this.isBound) {
      const outcome = String(this.data.outcome_preset ?? "").trim();
      if (outcome === OUTCOME_VISIT_SCHEDULED && !String(this.data.next_action ?? "").trim()) {
        this.data.next_action = VISIT_NEXT_ACTION_CODE;
      }
    }

    const activity = this.instance;
    if (activity) {
      for (const name of ["activity_type", "subject", "description", "next_action", "scheduled_date", "duration", "is_completed"] as const) {
        this.setInitial(name, activity[name]);
      }
      const o = (activity.outcome ?? "").trim();
      if (PRESET_OUTCOMES.includes(o)) this.setInitial("outcome_preset", o);
      else if (o) {
        this.setInitial("outcome_preset", OTHER_OUTCOME);
        this.setInitial("outcome_other", o);
      } else this.setInitial("outcome_preset", "");
    }
  }

  protected override async clean() {
    const c = this.cleaned_data;
    if (this.hasError("outcome_preset") || this.hasError("outcome_other")) return;
    const preset = c.outcome_preset ?? "";
    const other = (c.outcome_other ?? "").trim();
    if (preset === OTHER_OUTCOME) {
      if (!other) return this.addError("outcome_other", "Enter a custom outcome, or choose a different option above.");
      c.resolved_outcome = other.slice(0, 200);
    } else {
      c.resolved_outcome = preset.slice(0, 200);
    }

    if (c.resolved_outcome === OUTCOME_VISIT_SCHEDULED) {
      c.has_next_action = "yes";
      if (!c.followup_date) return this.addError("followup_date", "Please choose the visit date and time.");
      const codes = new Set(this.field<ChoiceField>("next_action").choices().map(([v]) => v).filter(Boolean));
      const preferred = VISIT_NEXT_ACTION_PREFERENCE.find((code) => codes.has(code));
      if (preferred) c.next_action = preferred;
    } else if (c.has_next_action === "yes") {
      if (!c.followup_date) return this.addError("followup_date", "Please choose the next follow-up date and time.");
      if (!(c.next_action ?? "").trim()) return this.addError("next_action", "Please select the next action.");
    }
  }

  /** Subject defaults to the activity type's display name when left blank. */
  resolvedSubject(): string {
    const subject = (this.cleaned_data.subject ?? "").trim();
    if (subject) return subject;
    const code = this.cleaned_data.activity_type;
    return (this.activityTypes.find(([c]) => c === code)?.[1] ?? code ?? "Activity").slice(0, 200);
  }

  hasNextAction(): boolean {
    return this.cleaned_data.has_next_action === "yes";
  }

  /** Column values for create/update. Columns the template didn't submit keep their stored value. */
  activityData() {
    const c = this.cleaned_data;
    const data: Record<string, unknown> = {
      activity_type: c.activity_type,
      subject: this.resolvedSubject(),
      description: c.description,
      next_action: c.next_action ?? "",
      duration: c.duration ?? 0,
      is_completed: this.hasNextAction() ? true : c.is_completed,
      outcome: c.resolved_outcome ?? "",
    };
    if (!this.instance || !this.omitted("scheduled_date")) data.scheduled_date = c.scheduled_date;
    return data as {
      activity_type: string;
      subject: string;
      description: string;
      next_action: string;
      duration: number;
      is_completed: boolean;
      outcome: string;
      scheduled_date?: Date | null;
    };
  }
}
