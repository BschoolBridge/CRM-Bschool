import { describe, expect, it } from "vitest";
import { detectHeaderRowIndex } from "./spreadsheet";

describe("spreadsheet header detection", () => {
  it("skips a title banner and picks the real header row", () => {
    const rows = [
      [
        "College Data Collected for CAT, Session: UG Passing Year 2027",
        "College Data Collected for CAT, Session: UG Passing Year 2027",
        "College Data Collected for CAT, Session: UG Passing Year 2027",
      ],
      ["Sno", "Canidate Name", "Father Name", "Mobile", "Email"],
      ["1", "AADAYA RAJ", "RAVI SHANKAR", "9102753867", "a@example.com"],
    ];
    expect(detectHeaderRowIndex(rows)).toBe(1);
  });

  it("keeps row 0 when it already looks like the template", () => {
    const rows = [
      ["fullName", "phone", "email", "city"],
      ["Riya Sharma", "9876543210", "riya@example.com", "Delhi"],
    ];
    expect(detectHeaderRowIndex(rows)).toBe(0);
  });
});
