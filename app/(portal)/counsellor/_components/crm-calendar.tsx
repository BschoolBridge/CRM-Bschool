"use client";

import { useEffect, useRef, useState } from "react";
import { reverse } from "@/http/urls";

type Extended = Record<string, unknown>;

type Selected = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  extended: Extended;
};

declare global {
  interface Window {
    FullCalendar?: {
      Calendar: new (el: HTMLElement, options: object) => { render: () => void; destroy: () => void };
    };
  }
}

function loadFullCalendar() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.FullCalendar) return Promise.resolve();
  if (!document.querySelector("link[data-fc]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/main.min.css";
    link.dataset.fc = "1";
    document.head.appendChild(link);
  }
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-fc]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("calendar")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/main.min.js";
    script.dataset.fc = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("calendar"));
    document.body.appendChild(script);
  });
}

function text(value: unknown, fallback = "N/A") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

export function CrmCalendar({
  eventsUrl,
  variant,
}: {
  eventsUrl: string;
  variant: "dashboard" | "month" | "lead";
}) {
  const host = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    let calendar: { render: () => void; destroy: () => void } | null = null;
    let cancelled = false;
    loadFullCalendar()
      .then(() => {
        if (cancelled || !host.current || !window.FullCalendar) return;
        const Calendar = window.FullCalendar.Calendar;
        calendar = new Calendar(host.current, {
          initialView: "dayGridMonth",
          headerToolbar:
            variant === "dashboard"
              ? { left: "prev,next", center: "title", right: "" }
              : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" },
          height: variant === "dashboard" ? 400 : "auto",
          navLinks: variant !== "dashboard",
          dayMaxEvents: variant === "dashboard" ? 2 : true,
          moreLinkClick: "popover",
          eventDisplay: "block",
          events: (fetchInfo: { startStr: string; endStr: string }, success: (rows: unknown) => void, failure: (err: unknown) => void) => {
            const url = `${eventsUrl}?start=${encodeURIComponent(fetchInfo.startStr)}&end=${encodeURIComponent(fetchInfo.endStr)}`;
            fetch(url)
              .then((response) => response.json())
              .then(success)
              .catch(failure);
          },
          eventClick: (info: { event: { title: string; start: Date | null; end: Date | null; allDay: boolean; extendedProps: Extended }; jsEvent: { preventDefault: () => void } }) => {
            info.jsEvent.preventDefault();
            const leadId = info.event.extendedProps.lead_id;
            if (variant === "dashboard" && leadId) {
              window.location.href = reverse("lead_detail", leadId);
              return;
            }
            setSelected({
              title: info.event.title,
              start: info.event.start ? info.event.start.toLocaleString() : "",
              end: info.event.end ? info.event.end.toLocaleString() : "",
              allDay: info.event.allDay,
              extended: info.event.extendedProps,
            });
          },
        });
        calendar.render();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      calendar?.destroy();
    };
  }, [eventsUrl, variant]);

  const extended = selected?.extended ?? {};
  const leadId = extended.lead_id;
  const activityId = extended.activity_id;

  return (
    <>
      <div ref={host} id={variant === "lead" ? "lead-calendar" : "calendar"} />
      {selected ? (
        <div className="modal fade show d-block" role="dialog" style={{ background: "rgba(0,0,0,.4)" }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selected.title}</h5>
                <button type="button" className="close" aria-label="Close" onClick={() => setSelected(null)}>
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Type:</strong> {extended.type === "activity" ? "Activity" : "Visit"}
                </p>
                {extended.lead_name ? (
                  <p>
                    <strong>Lead:</strong> {text(extended.lead_name, "")}
                  </p>
                ) : null}
                {extended.type === "activity" ? (
                  <>
                    <p>
                      <strong>Description:</strong> {text(extended.description, "No description")}
                    </p>
                    {variant === "lead" ? (
                      <>
                        <p>
                          <strong>Outcome:</strong> {text(extended.outcome)}
                        </p>
                        <p>
                          <strong>Status:</strong> {text(extended.status)}
                        </p>
                        <p>
                          <strong>Duration:</strong> {text(extended.duration, "0")} minutes
                        </p>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p>
                      <strong>Course Interested:</strong> {text(extended.course_interested)}
                    </p>
                    {variant === "month" || extended.school_name ? (
                      <p>
                        <strong>School Name:</strong> {text(extended.school_name)}
                      </p>
                    ) : null}
                  </>
                )}
                <p>
                  <strong>Date:</strong> {selected.start}
                </p>
                {selected.end && !selected.allDay ? (
                  <p>
                    <strong>End:</strong> {selected.end}
                  </p>
                ) : null}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
                  Close
                </button>
                {extended.type === "activity" && activityId && leadId ? (
                  <a className="btn btn-warning" href={reverse("edit_lead_activity", leadId, activityId)}>
                    Edit Activity
                  </a>
                ) : null}
                {variant === "month" && leadId ? (
                  <a className="btn btn-primary" href={reverse("lead_detail", leadId)}>
                    View Lead
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
