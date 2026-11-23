"use client";

import { useState } from "react";
import { CrmCalendar } from "./crm-calendar";

export function ActivityViews({ eventsUrl, children }: { eventsUrl: string; children: React.ReactNode }) {
  const [calendar, setCalendar] = useState(false);
  return (
    <>
      <div className="mb-2 text-right">
        <button type="button" className="btn btn-sm btn-info" onClick={() => setCalendar((value) => !value)}>
          <i className="fas fa-calendar-alt" /> {calendar ? "Timeline View" : "Calendar View"}
        </button>
      </div>
      {calendar ? <CrmCalendar eventsUrl={eventsUrl} variant="lead" /> : children}
    </>
  );
}
