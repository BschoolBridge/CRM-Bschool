import { describe, expect, it } from "vitest";
import {
  budgetFees,
  normalizeBschoolWebsiteLead,
  parsePercentileBand,
  parseTargetExam,
  workExperienceMonths,
} from "./bschool-website-payload";
import { leadWebhookConfig, normalizeLeadWebhookPayload } from "./lead-webhook.service";

describe("website webhook phone dedupe config", () => {
  it("keeps phone dedupe on by default", () => {
    const previous = process.env.CRM_WEBHOOK_DEDUPE_PHONE;
    delete process.env.CRM_WEBHOOK_DEDUPE_PHONE;
    expect(leadWebhookConfig().dedupe_by_phone).toBe(true);
    process.env.CRM_WEBHOOK_DEDUPE_PHONE = "0";
    expect(leadWebhookConfig().dedupe_by_phone).toBe(false);
    if (previous === undefined) delete process.env.CRM_WEBHOOK_DEDUPE_PHONE;
    else process.env.CRM_WEBHOOK_DEDUPE_PHONE = previous;
  });
});

describe("Bschool Bridge website webhook payload", () => {
  it("requires phone after normalizing +91 numbers", () => {
    const row = normalizeLeadWebhookPayload({
      id: "web_123",
      fullName: "Riya Sharma",
      phone: "+919876543210",
      targetExam: "CAT 2026",
      percentile: "90-95",
      source: "counseling_form",
      status: "new",
      notes: null,
      email: null,
      city: null,
      workExperience: null,
      academicBackground: null,
      budget: null,
      specialization: null,
      college: null,
    });
    expect(row.phone).toBe("9876543210");
    expect(row.full_name).toBe("Riya Sharma");
    expect(row.source).toBe("counseling_form");
    expect(row.status).toBe("new");
    expect(row.email).toBe("");
    expect(row.college).toBe("");
  });

  it("maps optional counselling fields when present", () => {
    const row = normalizeBschoolWebsiteLead({
      id: "apply_9",
      createdAt: "2026-11-20T18:00:00.000Z",
      fullName: "Aman Verma",
      phone: "+91 9988776655",
      targetExam: "GMAT",
      percentile: "650",
      source: "apply_click",
      status: "new",
      notes: "",
      email: "aman@example.com",
      city: "Mumbai",
      workExperience: "1–2 years",
      academicBackground: "Engineering",
      budget: "₹10–15 lakh",
      specialization: "Business analytics",
      college: "Sample Bschool",
    });
    expect(row.website_id).toBe("apply_9");
    expect(row.phone).toBe("9988776655");
    expect(row.email).toBe("aman@example.com");
    expect(row.city).toBe("Mumbai");
    expect(row.work_experience).toBe("1–2 years");
    expect(row.academic_background).toBe("Engineering");
    expect(row.budget).toBe("₹10–15 lakh");
    expect(row.specialization).toBe("Business analytics");
    expect(row.college).toBe("Sample Bschool");
    expect(parseTargetExam(row.target_exam)).toEqual({ code: "GMAT", year: null, label: "GMAT" });
    expect(parsePercentileBand(row.percentile_text).text).toBe("650");
    expect(workExperienceMonths(row.work_experience)).toBe(18);
    expect(budgetFees(row.budget)).toEqual({ fee_min: 1_000_000, fee_max: 1_500_000, notes: "₹10–15 lakh" });
  });

  it("parses CAT year and percentile bands without inventing cutoffs", () => {
    expect(parseTargetExam("CAT 2026")).toEqual({ code: "CAT", year: 2026, label: "CAT 2026" });
    expect(parsePercentileBand("90-95")).toEqual({ numeric: 95, text: "90-95" });
    expect(parsePercentileBand("98.5")).toEqual({ numeric: 98.5, text: "98.5" });
  });
});
