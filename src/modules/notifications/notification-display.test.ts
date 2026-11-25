import { describe, expect, it } from "vitest";
import { presentNotificationMessage } from "./notification-display";

describe("presentNotificationMessage", () => {
  it("parses a single lead assignment into a clean title and lead link", () => {
    const display = presentNotificationMessage(
      "New lead assigned: Riya Sharma — Source: Website enquiry form [lead:42:3]",
    );
    expect(display.kind).toBe("assignment");
    expect(display.title).toBe("New lead assigned");
    expect(display.body).toContain("Riya Sharma");
    expect(display.href).toBe("/counsellor/leads/42/");
  });

  it("parses bulk assignment summaries", () => {
    const display = presentNotificationMessage(
      "New leads assigned: 5 — Sources: Website enquiry form (5) [bulk:20261125051624667000]",
    );
    expect(display.kind).toBe("bulk_assignment");
    expect(display.title).toBe("5 new leads assigned");
    expect(display.body).toContain("Website enquiry form (5)");
    expect(display.href).toBe("/counsellor/leads/");
  });

  it("keeps plain system messages intact", () => {
    const display = presentNotificationMessage("Please call back the Delhi applicant today.");
    expect(display.kind).toBe("system");
    expect(display.title).toBe("Notification");
    expect(display.body).toBe("Please call back the Delhi applicant today.");
    expect(display.href).toBeNull();
  });
});
