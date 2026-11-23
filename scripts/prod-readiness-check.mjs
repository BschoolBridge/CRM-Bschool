#!/usr/bin/env node
/**
 * Local production-readiness smoke for website webhook + protected routes.
 * Run: node --import tsx scripts/prod-readiness-check.mjs
 */
import "dotenv/config";
import { createConnection } from "mariadb";

const BASE = process.env.SITE_URL || "http://127.0.0.1:8000";
const TOKEN = process.env.CRM_WEBHOOK_TOKEN || "";
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function http(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* plain */
  }
  return { status: res.status, text, json, headers: res.headers };
}

async function dbQuery(sql, params = []) {
  const url = new URL(process.env.DATABASE_URL);
  const conn = await createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  });
  try {
    return await conn.query(sql, params);
  } finally {
    await conn.end();
  }
}

async function main() {
  if (!TOKEN) throw new Error("CRM_WEBHOOK_TOKEN missing");

  for (const path of ["/", "/login/", "/password_reset/"]) {
    const r = await http(path);
    record(`HTTP ${path}`, r.status === 200, `status=${r.status}`);
  }

  let r = await http("/integrations/leads/webhook/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+919876501111", fullName: "X" }),
  });
  record("Webhook rejects missing auth", r.status === 403, `status=${r.status}`);

  r = await http(`/integrations/leads/webhook/?token=${encodeURIComponent(TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+919876501111", fullName: "X" }),
  });
  record("Webhook ignores query token", r.status === 403, `status=${r.status}`);

  r = await http("/integrations/leads/webhook/", {
    method: "POST",
    headers: {
      Authorization: "Bearer wrongtoken",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: "+919876501111", fullName: "X" }),
  });
  record("Webhook rejects bad bearer", r.status === 403, `status=${r.status}`);

  r = await http("/integrations/leads/webhook/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fullName: "No Phone", source: "counseling_form" }),
  });
  record("Webhook requires phone", r.status === 400 && r.json?.ok === false, `status=${r.status} body=${JSON.stringify(r.json)}`);

  const fullPayload = {
    id: "prodcheck_web_001",
    createdAt: "2026-11-23T04:30:00.000Z",
    fullName: "Prod Check Riya",
    phone: "+919876501111",
    targetExam: "CAT 2026",
    percentile: "90-95",
    source: "counseling_form",
    status: "new",
    notes: "prod readiness full payload",
    email: "prodcheck.riya@example.com",
    city: "Pune",
    workExperience: "1–2 years",
    academicBackground: "Engineering",
    budget: "₹10–15 lakh",
    specialization: "Marketing",
    college: "Sample Bschool",
  };
  r = await http("/integrations/leads/webhook/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fullPayload),
  });
  const createdOk = r.status === 200 && r.json?.ok === true;
  record("Webhook accepts full Bschool payload", createdOk, `status=${r.status} body=${JSON.stringify(r.json)}`);

  const updatePayload = {
    id: "prodcheck_web_002",
    createdAt: "2026-11-23T05:00:00.000Z",
    fullName: "Prod Check Riya Updated",
    phone: "9876501111",
    targetExam: "GMAT",
    percentile: "650",
    source: "apply_click",
    status: "new",
    notes: "second submit same phone",
    email: "prodcheck.riya@example.com",
    city: "Mumbai",
    workExperience: "2–3 years",
    academicBackground: "Engineering",
    budget: "₹15–25 lakh",
    specialization: "Business analytics",
    college: "IIM Sample",
  };
  r = await http("/integrations/leads/webhook/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });
  const updateRow = r.json?.results?.[0] ?? r.json;
  record(
    "Webhook dedupes same phone (update, not create)",
    r.status === 200 && updateRow?.created === false,
    `status=${r.status} body=${JSON.stringify(r.json)}`,
  );

  for (const source of ["visit_popup", "counseling_button"]) {
    const phone = `+9198765${String(Math.floor(Math.random() * 9000) + 1000)}`;
    r = await http("/integrations/leads/webhook/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: `Src ${source}`,
        phone,
        source,
        targetExam: "CAT 2026",
        email: `src.${source}@example.com`,
      }),
    });
    record(`Webhook source=${source}`, r.status === 200 && r.json?.ok === true, `status=${r.status}`);
  }

  r = await http("/integrations/leads/webhook/", {
    method: "POST",
    headers: {
      "X-CRM-Webhook-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fullName: "Header Token",
      phone: "+919811122233",
      source: "counseling_form",
    }),
  });
  record("Webhook accepts X-CRM-Webhook-Token", r.status === 200 && r.json?.ok === true, `status=${r.status}`);

  r = await http("/admin/", { redirect: "manual" });
  record("Admin redirects when unauthenticated", r.status === 302 || r.status === 303 || r.status === 307, `status=${r.status}`);

  r = await http("/integrations/leads/settings/", { redirect: "manual" });
  record("Webhook settings protected", r.status === 302 || r.status === 303 || r.status === 307, `status=${r.status}`);

  const phoneRows = await dbQuery("SELECT id, first_name, last_name, phone, email, city, school_name, course_interested FROM leads WHERE phone = ?", [
    "9876501111",
  ]);
  record("DB keeps single lead for test phone", phoneRows.length === 1, `count=${phoneRows.length}`);
  if (phoneRows.length === 1) {
    const lead = phoneRows[0];
    record(
      "DB lead has latest website fields",
      lead.first_name === "Prod" &&
        String(lead.last_name).includes("Updated") &&
        lead.city === "Mumbai" &&
        lead.school_name === "IIM Sample" &&
        String(lead.course_interested).includes("GMAT"),
      JSON.stringify(lead),
    );
    const extras = await dbQuery(
      `SELECT 'academic' t, COUNT(*) c FROM lead_academic_profiles WHERE lead_id = ?
       UNION ALL SELECT 'exam', COUNT(*) FROM lead_exam_attempts WHERE lead_id = ?
       UNION ALL SELECT 'pref', COUNT(*) FROM lead_preferences WHERE lead_id = ?
       UNION ALL SELECT 'shortlist', COUNT(*) FROM college_shortlist_entries WHERE lead_id = ?`,
      [lead.id, lead.id, lead.id, lead.id],
    );
    const map = Object.fromEntries(extras.map((row) => [row.t, Number(row.c)]));
    record(
      "MBA extras attached on apply_click path",
      map.academic >= 1 && map.exam >= 1 && map.pref >= 1 && map.shortlist >= 1,
      JSON.stringify(map),
    );
  }

  const failed = results.filter((x) => !x.ok);
  console.log("\n--- Summary ---");
  console.log(`Passed ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
