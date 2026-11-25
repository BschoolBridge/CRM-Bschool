import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATE_HEADERS, leadFromImportRow } from "./import.service";

describe("lead import fields", () => {
  it("uses website lead-form column names in the template", () => {
    expect(IMPORT_TEMPLATE_HEADERS).toEqual([
      "fullName",
      "phone",
      "email",
      "targetExam",
      "percentile",
      "city",
      "workExperience",
      "academicBackground",
      "budget",
      "specialization",
      "college",
      "notes",
      "source",
    ]);
  });

  it("maps website columns into lead fields", () => {
    const modern = leadFromImportRow(
      {
        fullName: "Riya Sharma",
        phone: "+919876543210",
        email: "riya@example.com",
        targetExam: "CAT 2026",
        percentile: "90-95",
        city: "Delhi",
        workExperience: "1–2 years",
        academicBackground: "B.Com",
        budget: "₹10–15 lakh",
        specialization: "Marketing",
        college: "FMS Delhi",
        notes: "Evening callback",
        source: "counseling_form",
      },
      3,
      null,
    );
    expect(modern.first_name).toBe("Riya");
    expect(modern.last_name).toBe("Sharma");
    expect(modern.phone).toBe("9876543210");
    expect(modern.school_name).toBe("FMS Delhi");
    expect(modern.course_interested).toBe("Marketing · CAT 2026");
    expect(modern.city).toBe("Delhi");
    expect(modern.source_campaign).toBe("counseling_form");
    expect(String(modern.notes)).toContain("Evening callback");
    expect(String(modern.notes)).toContain("Target exam: CAT 2026");
    expect(String(modern.notes)).toContain("Percentile/score: 90-95");
    expect(modern.source_id).toBe(3);
  });

  it("still accepts legacy name / School Name columns", () => {
    const legacy = leadFromImportRow(
      { name: "Aman", phone: "9123456780", "School Name": "Legacy School", course_interested: "MBA" },
      1,
      9,
    );
    expect(legacy.first_name).toBe("Aman");
    expect(legacy.school_name).toBe("Legacy School");
    expect(legacy.course_interested).toBe("MBA");
    expect(legacy.assigned_counsellor_id).toBe(9);
    expect(legacy.email).toContain("@example.com");
  });

  it("accepts human-readable similar column labels", () => {
    const lead = leadFromImportRow(
      {
        "Full Name": "Priya Nair",
        "Mobile Number": "9000012345",
        "Email Address": "priya@example.com",
        "Target Exam": "XAT 2026",
        City: "Pune",
      },
      5,
      null,
    );
    expect(lead.first_name).toBe("Priya");
    expect(lead.phone).toBe("9000012345");
    expect(lead.email).toBe("priya@example.com");
    expect(lead.city).toBe("Pune");
    expect(String(lead.notes)).toContain("Target exam: XAT 2026");
  });
});
