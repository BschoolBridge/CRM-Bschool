import { describe, expect, it } from "vitest";
import {
  normalizeImportHeader,
  remapImportRow,
  resolveImportColumnMapping,
} from "./import-columns";
import { leadFromImportRow } from "./import.service";

describe("import column matching", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeImportHeader("Full Name")).toBe("fullname");
    expect(normalizeImportHeader("full_name")).toBe("fullname");
    expect(normalizeImportHeader("Mobile No.")).toBe("mobileno");
    expect(normalizeImportHeader("E-Mail")).toBe("email");
    expect(normalizeImportHeader("Work Exp")).toBe("workexp");
  });

  it("maps human-readable spreadsheet headers to canonical fields", () => {
    const mapping = resolveImportColumnMapping([
      "Full Name",
      "Mobile Number",
      "E-mail Address",
      "Target Exam",
      "Work Experience",
      "College Name",
      "Lead Source",
      "Remarks",
    ]);
    expect(mapping.fullName).toBe("Full Name");
    expect(mapping.phone).toBe("Mobile Number");
    expect(mapping.email).toBe("E-mail Address");
    expect(mapping.targetExam).toBe("Target Exam");
    expect(mapping.workExperience).toBe("Work Experience");
    expect(mapping.college).toBe("College Name");
    expect(mapping.source).toBe("Lead Source");
    expect(mapping.notes).toBe("Remarks");
  });

  it("accepts close spellings without stealing another field's column", () => {
    const mapping = resolveImportColumnMapping(["Ful Name", "Phon", "City"]);
    expect(mapping.fullName).toBe("Ful Name");
    expect(mapping.phone).toBe("Phon");
    expect(mapping.city).toBe("City");
  });

  it("imports a row whose headers only look similar to the template", () => {
    const lead = leadFromImportRow(
      remapImportRow({
        "Student Name": "Neha Kapoor",
        "Mobile No": "9876501234",
        "Email Id": "neha@example.com",
        "Entrance Exam": "CAT 2026",
        "Work Exp": "2 years",
        "College Name": "SRCC",
        Remarks: "Call after 6pm",
      }),
      2,
      null,
    );
    // leadFromImportRow also remaps; calling remap twice must stay stable.
    const again = leadFromImportRow(
      {
        "Student Name": "Neha Kapoor",
        "Mobile No": "9876501234",
        "Email Id": "neha@example.com",
        "Entrance Exam": "CAT 2026",
        "Work Exp": "2 years",
        "College Name": "SRCC",
        Remarks: "Call after 6pm",
      },
      2,
      null,
    );
    expect(lead.first_name).toBe("Neha");
    expect(lead.last_name).toBe("Kapoor");
    expect(lead.phone).toBe("9876501234");
    expect(lead.email).toBe("neha@example.com");
    expect(lead.school_name).toBe("SRCC");
    expect(String(lead.notes)).toContain("Call after 6pm");
    expect(String(lead.notes)).toContain("Target exam: CAT 2026");
    expect(String(lead.notes)).toContain("Work experience: 2 years");
    expect(again.phone).toBe(lead.phone);
  });

  it("does not invent a mapping for unrelated headers", () => {
    const mapping = resolveImportColumnMapping(["Priority", "Status Color", "Internal Code"]);
    expect(mapping.fullName).toBeUndefined();
    expect(mapping.phone).toBeUndefined();
    expect(mapping.email).toBeUndefined();
  });
});
