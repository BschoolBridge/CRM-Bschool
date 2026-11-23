import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENTRANCE_EXAM_SEEDS, LEAD_STATUS_SEEDS } from "../reference/seeds";
import { ADDED_LEAD_STATUSES, PRESERVED_LEAD_STATUSES } from "./lifecycle";

const migration = readFileSync(
  path.join(process.cwd(), "prisma/migrations/20261029110000_bschool_admissions_profile/migration.sql"),
  "utf8",
);

describe("admissions schema migration", () => {
  it("adds tables and nullable lead columns without rewriting existing rows", () => {
    expect(migration).toContain("ADD COLUMN `whatsapp_phone`");
    expect(migration).toContain("ADD COLUMN `preferred_language`");
    expect(migration).toContain("ADD COLUMN `source_campaign`");
    expect(migration).toContain("CREATE TABLE `lead_academic_profiles`");
    expect(migration).toContain("CREATE TABLE `lead_exam_attempts`");
    expect(migration).toContain("CREATE TABLE `college_shortlist_entries`");
    expect(migration).toContain("CREATE TABLE `mba_applications`");
    const statements = migration.replace(/--.*$/gm, "");
    expect(statements).not.toMatch(/\bDROP\b/i);
    expect(statements).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(statements).not.toMatch(/\bTRUNCATE\b/i);
    expect(statements).not.toMatch(/\bUPDATE\s+`/i);
  });

  it("keeps the sales statuses and adds the counselling statuses beside them", () => {
    const codes = LEAD_STATUS_SEEDS.map((row) => row.code);
    for (const code of PRESERVED_LEAD_STATUSES) expect(codes).toContain(code);
    for (const code of ADDED_LEAD_STATUSES) expect(codes).toContain(code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("inserts the exam catalog without invented scores", () => {
    for (const exam of ENTRANCE_EXAM_SEEDS) expect(migration).toContain(`'${exam.code}'`);
    expect(migration).not.toMatch(/\b(cutoff|placement)\b/i);
  });
});
