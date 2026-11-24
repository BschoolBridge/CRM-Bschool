import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sources: [{ id: 1, name: "Website enquiry form" }],
  statuses: [["NEW", "New"], ["CONTACTED", "Contacted"]] as Array<[string, string]>,
  counsellors: [{ id: 4, label: "Counsellor One" }],
  phoneHit: null as { id: number; lead_id: string } | null,
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    leadSource: {
      findMany: async () => state.sources,
    },
  },
}));

vi.mock("../reference/reference.service", () => ({
  LEAD_PRIORITIES: [
    ["LOW", "Low"],
    ["MEDIUM", "Medium"],
    ["HIGH", "High"],
  ],
  leadStatusChoices: async () => state.statuses,
}));

vi.mock("../users/user-options", () => ({
  counsellorOptions: async () => state.counsellors,
}));

vi.mock("./phone-lookup", () => ({
  findLeadByPhone: async () => state.phoneHit,
  duplicatePhoneMessage: () => "Duplicate phone",
}));

describe("LeadForm website fields", () => {
  beforeEach(() => {
    state.phoneHit = null;
  });

  it("maps website-style fields into lead columns on save", async () => {
    const { LeadForm } = await import("./lead.forms");
    const form = await LeadForm.create("admin", {
      data: {
        name: "Riya Sharma",
        phone: "+919876543210",
        email: "riya@example.com",
        target_exam: "CAT 2026",
        percentile: "90-95",
        city: "Delhi",
        work_experience: "1–2 years",
        academic_background: "B.Com",
        budget: "₹10–15 lakh",
        specialization: "Marketing",
        college: "FMS Delhi",
        notes: "Evening callback",
        source: "1",
        status: "NEW",
        priority: "MEDIUM",
        assigned_counsellor: "",
        next_follow_up: "",
        alternate_phone: "",
      },
    });
    expect(await form.isValid()).toBe(true);
    const data = form.leadData();
    expect(data.first_name).toBe("Riya");
    expect(data.last_name).toBe("Sharma");
    expect(data.phone).toBe("9876543210");
    expect(data.school_name).toBe("FMS Delhi");
    expect(data.course_interested).toBe("Marketing · CAT 2026");
    expect(data.city).toBe("Delhi");
    expect(data.source_id).toBe(1);
    expect(String(data.notes)).toContain("Evening callback");
    expect(String(data.notes)).toContain("Target exam: CAT 2026");
    expect(String(data.notes)).toContain("Percentile/score: 90-95");
  });
});
