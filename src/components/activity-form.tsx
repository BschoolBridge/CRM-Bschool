"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "../server/form";

const OUTCOME_VISIT_SCHEDULED = "Visit scheduled";
const OTHER_OUTCOME = "__OTHER__";

declare global {
  interface Window {
    initLeadActivityForm?: () => void;
    // Bootstrap 4 modal helper from the portal layout jQuery bundle.
    jQuery?: (selector: string) => { modal: (action: "show" | "hide") => void };
  }
}

function syncActivityFormUi(root: HTMLElement) {
  const checked = root.querySelector<HTMLInputElement>('input[name="has_next_action"]:checked');
  const outcome = root.querySelector<HTMLSelectElement>("#id_outcome_preset");
  const nextFields = root.querySelector<HTMLElement>("#next-action-fields");
  const otherWrap = root.querySelector<HTMLElement>("#outcome-other-wrap");
  const completed = root.querySelector<HTMLInputElement>("#id_is_completed");
  const followupDate = root.querySelector<HTMLInputElement>("#id_followup_date");
  const nextAction = root.querySelector<HTMLSelectElement>("#id_next_action");
  const yesRadio = root.querySelector<HTMLInputElement>('input[name="has_next_action"][value="yes"]');

  const visitScheduled = outcome?.value === OUTCOME_VISIT_SCHEDULED;
  if (visitScheduled && yesRadio && !yesRadio.checked) {
    yesRadio.checked = true;
  }

  const showNext = visitScheduled || checked?.value === "yes";
  if (nextFields) {
    nextFields.hidden = !showNext;
    nextFields.style.display = showNext ? "block" : "none";
  }
  if (otherWrap) {
    const showOther = outcome?.value === OTHER_OUTCOME;
    otherWrap.hidden = !showOther;
    otherWrap.style.display = showOther ? "block" : "none";
  }
  if (completed) {
    if (showNext) {
      completed.checked = true;
      completed.disabled = true;
    } else {
      completed.disabled = false;
    }
  }
  if (followupDate) followupDate.required = Boolean(showNext);
  if (nextAction) nextAction.required = Boolean(showNext);

  if (visitScheduled && nextAction) {
    if ([...nextAction.options].some((opt) => opt.value === "SCHEDULE_VISIT")) {
      nextAction.value = "SCHEDULE_VISIT";
    } else {
      const visitOpt = [...nextAction.options].find((opt) => /visit scheduled/i.test(opt.textContent ?? ""));
      if (visitOpt) nextAction.value = visitOpt.value;
    }
  }
}

function openVisitModal(root: HTMLElement) {
  const modal = root.querySelector<HTMLElement>("#scheduleVisitActivityModal")
    ?? document.getElementById("scheduleVisitActivityModal");
  const followupDate = root.querySelector<HTMLInputElement>("#id_followup_date");
  const visitInput = document.getElementById("schedule_visit_datetime") as HTMLInputElement | null;
  if (followupDate?.value && visitInput) visitInput.value = followupDate.value;

  const $ = window.jQuery;
  if ($ && modal) {
    try {
      $("#scheduleVisitActivityModal").modal("show");
      return;
    } catch {
      // Fall through to native dialog if Bootstrap modal is unavailable.
    }
  }
  if (visitInput) {
    const picked = window.prompt("Visit date and time (YYYY-MM-DDTHH:mm)", visitInput.value || followupDate?.value || "");
    if (picked && followupDate) followupDate.value = picked.trim();
  }
}

export function ActivityClientForm({
  action,
  markup,
  submitLabel,
  extra,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  markup: string;
  submitLabel: string;
  extra?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const rootRef = useRef<HTMLDivElement>(null);
  const html = state?.markup ?? markup;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      syncActivityFormUi(root);

      if (
        target instanceof HTMLSelectElement
        && target.id === "id_outcome_preset"
        && target.value === OUTCOME_VISIT_SCHEDULED
      ) {
        openVisitModal(root);
      }
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('input[name="has_next_action"]') || target.closest('label[for^="id_has_next_action"]')) {
        // Let the browser update the radio first, then sync.
        window.requestAnimationFrame(() => syncActivityFormUi(root));
      }
      if (target.id === "schedule_visit_save_btn" || target.closest("#schedule_visit_save_btn")) {
        event.preventDefault();
        const visitInput = document.getElementById("schedule_visit_datetime") as HTMLInputElement | null;
        const followupDate = root.querySelector<HTMLInputElement>("#id_followup_date");
        const visitDt = (visitInput?.value || "").trim();
        if (!visitDt) {
          window.alert("Please choose the visit date and time.");
          visitInput?.focus();
          return;
        }
        if (followupDate) followupDate.value = visitDt;
        try {
          window.jQuery?.("#scheduleVisitActivityModal").modal("hide");
        } catch {
          // ignore
        }
      }
    };

    const onSubmit = (event: Event) => {
      const completed = root.querySelector<HTMLInputElement>("#id_is_completed");
      if (completed) completed.disabled = false;
      const outcome = root.querySelector<HTMLSelectElement>("#id_outcome_preset");
      const followupDate = root.querySelector<HTMLInputElement>("#id_followup_date");
      if (outcome?.value === OUTCOME_VISIT_SCHEDULED && !(followupDate?.value || "").trim()) {
        event.preventDefault();
        syncActivityFormUi(root);
        openVisitModal(root);
        window.alert("Please set the visit date and time.");
      }
    };

    root.addEventListener("change", onChange);
    root.addEventListener("click", onClick);
    const form = root.closest("form");
    form?.addEventListener("submit", onSubmit);
    syncActivityFormUi(root);
    // Keep legacy script in sync when present (visit modal helpers).
    window.initLeadActivityForm?.();

    return () => {
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
      form?.removeEventListener("submit", onSubmit);
    };
  }, [html]);

  return (
    <form action={formAction} encType="multipart/form-data" id="lead-activity-form">
      <fieldset disabled={pending} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />
        {extra}
        <button className="btn btn-primary" type="submit">
          {pending ? "Saving…" : submitLabel}
        </button>
      </fieldset>
    </form>
  );
}
