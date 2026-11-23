import { describe, expect, it } from "vitest";
import { LIST_PAGE_SIZE, Page, resolvePageNumber } from "./pagination";

describe("list pagination", () => {
  it("uses the manage-leads page size and clamps an out-of-range page", () => {
    expect(LIST_PAGE_SIZE).toBe(50);
    expect(resolvePageNumber("abc", 120, LIST_PAGE_SIZE)).toBe(1);
    expect(resolvePageNumber("2", 120, LIST_PAGE_SIZE)).toBe(2);
    expect(resolvePageNumber("9", 120, LIST_PAGE_SIZE)).toBe(3);
    expect(resolvePageNumber("0", 120, LIST_PAGE_SIZE)).toBe(3);
  });

  it("reports the slice shown on the current page", () => {
    const page = Page.build(["a"], 2, LIST_PAGE_SIZE, 120);
    expect(page.start_index).toBe(51);
    expect(page.end_index).toBe(100);
    expect(page.has_next).toBe(true);
    expect(page.has_previous).toBe(true);
  });
});
