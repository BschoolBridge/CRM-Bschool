"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { updateLeadNotes } from "../_lib/lead-actions";

const EDIT_NOTES_EVENT = "crm:edit-lead-notes";

export function openLeadNotesEditor() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EDIT_NOTES_EVENT));
  document.getElementById("lead-notes")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

export function LeadNotesEditButton({
  className = "btn btn-outline-primary",
  children = (
    <>
      <i className="fas fa-sticky-note" /> Update notes
    </>
  ),
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={() => openLeadNotesEditor()}>
      {children}
    </button>
  );
}

export function LeadNotesEditor({
  leadId,
  freeform,
  initiallyEditing = false,
}: {
  leadId: number;
  freeform: string;
  initiallyEditing?: boolean;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
  const rootRef = useRef<HTMLDivElement>(null);
  const saveAction = updateLeadNotes.bind(null, leadId);

  useEffect(() => {
    if (!initiallyEditing) return;
    rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [initiallyEditing]);

  useEffect(() => {
    const onEdit = () => {
      setEditing(true);
      window.requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    };
    window.addEventListener(EDIT_NOTES_EVENT, onEdit);
    return () => window.removeEventListener(EDIT_NOTES_EVENT, onEdit);
  }, []);

  return (
    <div className="crm-card" id="lead-notes" ref={rootRef}>
      <div className="crm-card-header">
        <h3 className="crm-card-title">
          <i className="fas fa-sticky-note crm-card-title-icon" /> Notes
        </h3>
        {editing ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            style={{ borderRadius: "8px", fontWeight: 600 }}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            style={{ borderRadius: "8px", fontWeight: 600 }}
            onClick={() => setEditing(true)}
          >
            <i className="fas fa-pen" /> Edit
          </button>
        )}
      </div>
      <div className="crm-card-body">
        {editing ? (
          <form action={saveAction}>
            <div className="form-group mb-3">
              <label htmlFor="lead_notes" className="crm-field-label">
                Counsellor notes
              </label>
              <textarea
                className="form-control"
                id="lead_notes"
                name="notes"
                rows={5}
                defaultValue={freeform}
                key={freeform}
                placeholder="Add call notes, preferences, or follow-up context…"
                autoFocus
              />
              <small className="form-text text-muted">
                Exam, score, and profile fields stay under Academic &amp; interest — only freeform notes are edited here.
              </small>
            </div>
            <button className="btn btn-primary" type="submit" style={{ borderRadius: "8px", fontWeight: 600 }}>
              Save notes
            </button>
          </form>
        ) : freeform ? (
          <p className="crm-note-box">{freeform}</p>
        ) : (
          <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
            No counsellor notes yet. Use Edit to add notes. Exam, score, and profile details are shown under Academic
            &amp; interest.
          </p>
        )}
      </div>
    </div>
  );
}
