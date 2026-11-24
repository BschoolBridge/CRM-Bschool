import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATE_HEADERS, leadFromImportRow } from "./import.service";

describe("lead import fields", () => {
  it("uses LeadForm-aligned header names in the template", () => {
    expect(IMPORT_TEMPLATE_HEADERS).toEqual([
      "name",
      "email",
      "phone",
      "alternate_phone",
      "school_name",
      "position",
      "graduation_status",
      "graduation_course",
      "graduation_year",
      "graduation_college",
      "course_interested",
      "industry",
      "notes",
      "address",
      "website",
      "linkedin",
    ]);
  });

  it("maps school_name and accepts legacy School Name", () => {
    const modern = leadFromImportRow(
      {
        name: "Riya Sharma",
        phone: "9876543210",
        school_name: "DPS",
        course_interested: "MBA",
        position: "Student",
        notes: "Called once",
      },
      3,
      null,
    );
    expect(modern.school_name).toBe("DPS");
    expect(modern.course_interested).toBe("MBA");
    expect(modern.position).toBe("Student");
    expect(modern.notes).toBe("Called once");
    expect(modern.source_id).toBe(3);

    const legacy = leadFromImportRow(
      { name: "Aman", phone: "9123456780", "School Name": "Legacy School" },
      1,
      9,
    );
    expect(legacy.school_name).toBe("Legacy School");
    expect(legacy.assigned_counsellor_id).toBe(9);
  });
});
