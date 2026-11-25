"use client";

import { useState } from "react";
import { logQuickOutcome } from "../_lib/lead-actions";

const QUICK_OUTCOMES = [
  "Interested",
  "Callback requested",
  "Requested more information",
  "No answer / unreachable",
  "Not connected",
  "Not interested",
  "Wrong number",
] as const;

const NEEDS_FOLLOWUP = new Set(["Callback requested", "Interested", "Requested more information"]);

export function QuickOutcomeForm({
  leadId,
  activityId = null,
  nextActionChoices,
  returnTo = "call_queue",
}: {
  leadId: number;
  activityId?: number | null;
  nextActionChoices: Array<[string, string]>;
  returnTo?: "call_queue" | "lead";
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const showFollowup = NEEDS_FOLLOWUP.has(outcome);
  const saveAction = logQuickOutcome.bind(null, leadId);

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-primary"
        style={{ borderRadius: "8px", fontWeight: 600 }}
        onClick={() => setOpen(true)}
      >
        Log outcome
      </button>
    );
  }

  return (
    <form action={saveAction} className="crm-quick-outcome">
      <input type="hidden" name="return_to" value={returnTo} />
      {activityId ? <input type="hidden" name="activity_id" value={activityId} /> : null}
      <div className="crm-quick-outcome-row">
        <div className="form-group mb-0">
          <label className="crm-field-label" htmlFor={`outcome-${leadId}`}>
            Outcome
          </label>
          <select
            id={`outcome-${leadId}`}
            className="form-control form-control-sm"
            name="outcome"
            required
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="">Select…</option>
            {QUICK_OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group mb-0">
          <label className="crm-field-label" htmlFor={`notes-${leadId}`}>
            Note
          </label>
          <input
            id={`notes-${leadId}`}
            className="form-control form-control-sm"
            name="notes"
            placeholder="Optional"
          />
        </div>
        {showFollowup ? (
          <>
            <div className="form-group mb-0">
              <label className="crm-field-label" htmlFor={`followup-${leadId}`}>
                Next follow-up
              </label>
              <input
                id={`followup-${leadId}`}
                className="form-control form-control-sm"
                type="datetime-local"
                name="followup_date"
                required
              />
            </div>
            <div className="form-group mb-0">
              <label className="crm-field-label" htmlFor={`next-action-${leadId}`}>
                Next action
              </label>
              <select
                id={`next-action-${leadId}`}
                className="form-control form-control-sm"
                name="next_action"
                defaultValue={nextActionChoices.some(([code]) => code === "CALLBACK") ? "CALLBACK" : nextActionChoices.find(([code]) => code)?.[0] ?? ""}
              >
                {nextActionChoices.map(([code, label]) => (
                  <option key={code || "empty"} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
        <div className="crm-quick-outcome-actions">
          <button className="btn btn-sm btn-success" type="submit" disabled={!outcome}>
            Save
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setOutcome("");
              setOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export function QueueContactButtons({ phone, leadHref }: { phone: string; leadHref: string }) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  const wa = digits ? `https://wa.me/${withCountry}` : null;
  return (
    <div className="crm-activity-actions">
      {phone ? (
        <a className="btn btn-sm btn-outline-success" href={`tel:${phone}`}>
          Call
        </a>
      ) : null}
      {wa ? (
        <a className="btn btn-sm btn-outline-success" href={wa} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      ) : null}
      <a className="btn btn-sm btn-outline-primary" href={leadHref}>
        Open
      </a>
    </div>
  );
}
