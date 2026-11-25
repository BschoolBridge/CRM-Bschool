import { describe, expect, it } from "vitest";
import { parseLeadNoteMeta } from "./lead.forms";

describe("parseLeadNoteMeta", () => {
  it("splits freeform notes from labeled website meta lines", () => {
    const parsed = parseLeadNoteMeta(
      ["Evening callback", "Target exam: CAT 2026", "Percentile/score: 90-95", "Budget: ₹10–15 lakh"].join("\n"),
    );
    expect(parsed.freeform).toBe("Evening callback");
    expect(parsed.meta.target_exam).toBe("CAT 2026");
    expect(parsed.meta.percentile).toBe("90-95");
    expect(parsed.meta.budget).toBe("₹10–15 lakh");
  });

  it("returns empty meta when notes have no labeled lines", () => {
    const parsed = parseLeadNoteMeta("Just a note");
    expect(parsed.freeform).toBe("Just a note");
    expect(parsed.meta).toEqual({});
  });
});
