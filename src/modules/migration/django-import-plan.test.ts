import { describe, expect, it } from "vitest";
import {
  USER_BOOTSTRAP_TABLE,
  classifySqliteCounts,
  describeImportPlan,
  DJANGO_ENTITIES,
  importOrder,
  parseBootstrapUser,
} from "./django-import-plan";

describe("django import plan", () => {
  it("bootstraps customuser and nothing else", () => {
    const copied = DJANGO_ENTITIES.filter((entity) => entity.importedNow).map((entity) => entity.djangoTable);
    expect(copied).toEqual([USER_BOOTSTRAP_TABLE]);
  });

  it("loads parents before children", () => {
    const order = importOrder();
    expect(order.indexOf("User")).toBeLessThan(order.indexOf("Admin"));
    expect(order.indexOf("User")).toBeLessThan(order.indexOf("Counsellor"));
    expect(order.indexOf("Counsellor")).toBeLessThan(order.indexOf("Lead"));
    expect(order.indexOf("LeadSource")).toBeLessThan(order.indexOf("Lead"));
    expect(order.indexOf("Lead")).toBeLessThan(order.indexOf("LeadActivity"));
    expect(order.indexOf("DailyTarget")).toBeLessThan(order.indexOf("DailyTargetAssignment"));
    expect(order.indexOf("SocialChatThread")).toBeLessThan(order.indexOf("SocialChatMessage"));
  });

  it("leaves AdmissionSession out of Prisma", () => {
    const session = DJANGO_ENTITIES.find((entity) => entity.djangoTable === "main_app_admissionsession");
    expect(session?.prismaModel).toBeNull();
    expect(session?.importedNow).toBe(false);
  });

  it("classifies a sqlite inventory without treating framework tables as missing CRM rows", () => {
    const report = classifySqliteCounts({
      main_app_customuser: 2,
      main_app_lead: 1,
      main_app_admissionsession: 3,
      django_session: 10,
      main_app_business: 0,
    });
    expect(report.copied).toEqual(["main_app_customuser"]);
    expect(report.crmNotCopied).toEqual(["main_app_admissionsession", "main_app_lead"]);
    expect(report.frameworkIgnored).toEqual(["django_session"]);
  });

  it("rejects a user row the users table cannot store", () => {
    expect(() =>
      parseBootstrapUser({
        id: 4,
        email: "person@example.com",
        password: "hash",
        user_type: "9",
      }),
    ).toThrow(/unsupported user_type/);
    expect(() =>
      parseBootstrapUser({
        id: 4,
        email: "",
        password: "hash",
        user_type: "1",
      }),
    ).toThrow(/needs an email/);
    const active = parseBootstrapUser({
      id: 4,
      email: "person@example.com",
      password: "hash",
      user_type: "2",
      is_active: null,
    });
    expect(active.is_active).toBe(true);
    expect(active.user_type).toBe("2");
  });

  it("states the recovery limits in the operator text", () => {
    const text = describeImportPlan();
    expect(text).toContain("users only");
    expect(text).toContain("disposable MariaDB");
    expect(text).toContain("0052");
    expect(text).toContain("not executed by this script");
  });
});
