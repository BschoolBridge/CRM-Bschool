"use client";

import { useState } from "react";
import { CrmCalendar } from "./crm-calendar";

export function ActivityViews({ eventsUrl, children }: { eventsUrl: string; children: React.ReactNode }) {
  const [calendar, setCalendar] = useState(false);
  return (
    <>
      <div className="mb-3 d-flex justify-content-end">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          style={{ borderRadius: "8px", fontWeight: 600 }}
          onClick={() => setCalendar((value) => !value)}
        >
          <i className="fas fa-calendar-alt" /> {calendar ? "Timeline view" : "Calendar view"}
        </button>
      </div>
      {calendar ? <CrmCalendar eventsUrl={eventsUrl} variant="lead" /> : children}
    </>
  );
}
