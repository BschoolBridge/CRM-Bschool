import { config } from "../../config/env";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import type { Lead } from "../../generated/prisma/client";
import { updateLead } from "../leads/lead.repository";

const MODEL = "gpt-4o-mini";

/** Text from an OpenAI Responses API payload (`output[].content[].text`). */
function responseText(body: unknown): string {
  const data = body as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (data.output_text) return data.output_text;
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

async function ask(prompt: string): Promise<string | null> {
  if (!config.openAiApiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openAiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: prompt }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return responseText(await res.json()).trim();
  } catch (err) {
    logger.warn({ err }, "OpenAI request failed; using heuristic fallback");
    return null;
  }
}

const or = (value: unknown, fallback: string) => (value === null || value === undefined || value === "" ? fallback : String(value));

function scoringPrompt(lead: Lead, includeProfile: boolean): string {
  return (
    "You are an expert college admissions evaluator. Analyze this student's profile and predict their likelihood of successful enrollment.\n\n" +
    "EVALUATION CRITERIA:\n" +
    "1. Academic Background (30%): School reputation, graduation status, academic achievements\n" +
    "2. Course Interest Alignment (25%): Clarity of course choice, relevance to background\n" +
    "3. Engagement Level (20%): Lead status, priority, response to communications\n" +
    "4. Financial Capability (15%): Payment history if any\n" +
    "5. Profile Completeness (10%): Information quality, contact details, follow-up responsiveness\n\n" +
    "SCORING GUIDELINES:\n" +
    "- 90-100: Exceptional candidate, high-value, clear goals, strong background\n" +
    "- 80-89: Very good candidate, likely to enroll, good academic profile\n" +
    "- 70-79: Good candidate, moderate likelihood, some concerns\n" +
    "- 60-69: Average candidate, uncertain enrollment, needs nurturing\n" +
    "- 50-59: Below average, low likelihood, significant concerns\n" +
    "- 0-49: Poor candidate, very unlikely to enroll\n\n" +
    "STUDENT PROFILE:\n" +
    `Name: ${lead.first_name} ${lead.last_name}\n` +
    `12th School: ${or(lead.school_name, "Not provided")}\n` +
    (includeProfile ? `Academic Profile: ${or(lead.enriched_job_title, "Not enriched")}\n` : "") +
    `Graduation Status: ${or(lead.graduation_status, "Not provided")}\n` +
    `Graduation Course: ${or(lead.graduation_course, "Not provided")}\n` +
    `Graduation College: ${or(lead.graduation_college, "Not provided")}\n` +
    `Course Interested: ${or(lead.course_interested, "Not specified")}\n` +
    `Lead Status: ${or(lead.status, "Not set")}\n` +
    `Priority: ${or(lead.priority, "Not set")}\n` +
    `Financial Notes: ${or(lead.notes, "No financial info")}\n` +
    `Notes: ${or(lead.notes, "No notes")}\n\n` +
    "Based on the above criteria, provide ONLY an integer score from 0-100 representing the admission likelihood:"
  );
}

const STATUS_BASE: Record<string, number> = {
  NEW: 25, CONTACTED: 40, QUALIFIED: 55, PROPOSAL_SENT: 70, NEGOTIATION: 80, CLOSED_WON: 95, CLOSED_LOST: 5, TRANSFERRED: 35,
};
const PRIORITY_BONUS: Record<string, number> = { LOW: -5, MEDIUM: 0, HIGH: 5, URGENT: 10 };

/** College-focused heuristic used whenever the model is unavailable or unparseable. */
export function heuristicAdmissionScore(lead: Lead): number {
  let score = STATUS_BASE[lead.status] ?? 35;
  score += PRIORITY_BONUS[lead.priority] ?? 0;
  if (lead.graduation_status === "YES") score += 10;
  if (lead.course_interested) score += 5;
  if (lead.school_name) score += 5;
  return Math.max(0, Math.min(100, score));
}

function firstScore(text: string | null): number | null {
  const m = text ? /\b(100|\d{1,2})\b/.exec(text) : null;
  return m ? Number(m[1]) : null;
}

/** Counsellor "Evaluate conversion score" button. */
export async function evaluateConversionScore(lead: Lead): Promise<number> {
  const text = await ask(
    "You are a college admissions scoring function. Read the student details and output ONLY an integer 0-100 for admission likelihood.\n\n" +
      scoringPrompt(lead, false),
  );
  const score = firstScore(text) ?? heuristicAdmissionScore(lead);
  await updateLead(lead.id, { conversion_score: score });
  return score;
}

const ROUTES = ["undergraduate_counselor", "graduate_counselor", "specialized_department", "senior_counselor"] as const;
type AcademicRoute = (typeof ROUTES)[number] | string;

function heuristicRoute(lead: Lead): AcademicRoute {
  const score = lead.conversion_score ?? 0;
  const course = (lead.course_interested ?? "").toLowerCase();
  const has = (...words: string[]) => words.some((w) => course.includes(w));
  if ((lead.graduation_status || "NO") === "YES") {
    if (has("mba", "masters", "phd", "postgraduate", "pg")) return "graduate_counselor";
    if (has("engineering", "medicine", "law", "architecture")) return "specialized_department";
    return "graduate_counselor";
  }
  if (score >= 75 || has("engineering", "medicine", "law")) return "specialized_department";
  if (score >= 60) return "senior_counselor";
  return "undergraduate_counselor";
}

const ROUTE_ACTIONS: Record<string, { status: string; priority: string; label: string; message: (l: Lead) => string }> = {
  undergraduate_counselor: {
    status: "QUALIFIED", priority: "MEDIUM", label: "Undergraduate Counseling",
    message: (l) => `Student ${l.first_name} ${l.last_name} routed to Undergraduate Counseling for ${l.course_interested}`,
  },
  graduate_counselor: {
    status: "QUALIFIED", priority: "HIGH", label: "Graduate Counseling",
    message: (l) => `Graduate student ${l.first_name} ${l.last_name} routed to Graduate Counseling for ${l.course_interested}`,
  },
  specialized_department: {
    status: "PROPOSAL_SENT", priority: "HIGH", label: "Specialized Department",
    message: (l) => `Student ${l.first_name} ${l.last_name} routed to Specialized Department for ${l.course_interested} - High Priority`,
  },
  senior_counselor: {
    status: "NEGOTIATION", priority: "URGENT", label: "Senior Counselor",
    message: (l) => `Student ${l.first_name} ${l.last_name} routed to Senior Counselor for ${l.course_interested} - Urgent Priority`,
  },
};

function titleWords(s: string): string {
  return s.replace(/_/g, " ").replace(/[A-Za-z]+/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}

/** Apply a routing decision: status/priority, a note, an admin notification and a ROUTED activity. */
export async function executeAcademicRouting(leadId: number, routedTo: AcademicRoute, reason: string): Promise<boolean> {
  try {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { assigned_counsellor: true } });
    const action = ROUTE_ACTIONS[routedTo];
    if (action) {
      const line = `Routed to ${action.label}: ${reason}`;
      await updateLead(lead.id, {
        status: action.status,
        priority: action.priority,
        notes: lead.notes ? `${lead.notes}\n\n${line}` : line,
      });
      if (lead.assigned_counsellor) {
        await prisma.notificationAdmin.create({ data: { admin_id: lead.assigned_counsellor.admin_id, message: action.message(lead) } });
      }
    }
    if (!lead.assigned_counsellor_id) return false;
    await prisma.leadActivity.create({
      data: {
        lead_id: lead.id,
        counsellor_id: lead.assigned_counsellor_id,
        activity_type: "ROUTED",
        subject: "",
        description: `AI routed student to ${titleWords(routedTo)}: ${reason}`,
      },
    });
    return true;
  } catch (err) {
    logger.error({ err, leadId }, "academic routing failed");
    return false;
  }
}

export interface WorkflowMessage {
  level: "success" | "warning" | "error";
  text: string;
}

/** Enrich → score → route, recording each step on the lead. */
export async function runAgenticWorkflow(leadId: number): Promise<WorkflowMessage[]> {
  const out: WorkflowMessage[] = [];
  let lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  try {
    const text = await ask(
      "You are an expert college admissions data enricher. Analyze the student's educational background and create a comprehensive academic profile.\n\n" +
        "TASK: Create an academic profile summary and enrichment notes based on the student's educational background.\n\n" +
        "STUDENT DATA:\n" +
        `Name: ${lead.first_name} ${lead.last_name}\n` +
        `12th School: ${or(lead.school_name, "Not provided")}\n` +
        `Graduation Status: ${or(lead.graduation_status, "Not provided")}\n` +
        `Graduation Course: ${or(lead.graduation_course, "Not provided")}\n` +
        `Graduation Year: ${or(lead.graduation_year, "Not provided")}\n` +
        `Graduation College: ${or(lead.graduation_college, "Not provided")}\n` +
        `Course Interested: ${or(lead.course_interested, "Not specified")}\n` +
        `Notes: ${or(lead.notes, "No additional notes")}\n\n` +
        "ANALYSIS GUIDELINES:\n" +
        "1. Academic Profile: Summarize educational background, achievements, and academic level\n" +
        "2. Enrichment Notes: Identify strengths, potential concerns, and academic trajectory\n" +
        "3. Consider school reputation, course relevance, and academic progression\n" +
        "4. Note any gaps or inconsistencies in the academic journey\n\n" +
        "RESPONSE FORMAT (JSON):\n" +
        "{\n" +
        '  "academic_profile": "Brief summary of academic background and level",\n' +
        '  "enrichment_notes": "Key insights about academic strengths and considerations"\n' +
        "}\n\n" +
        "Provide the academic profile analysis:",
    );
    let profile = text ? /academic_profile\s*[:"]\s*([^\n"]+)/i.exec(text)?.[1]?.trim().slice(0, 150) : undefined;
    let notes = text ? /enrichment_notes\s*[:"]\s*([^\n]+)/i.exec(text)?.[1]?.trim() : undefined;
    profile ||= lead.graduation_status === "YES"
      ? `Graduate in ${lead.graduation_course || "General"} from ${lead.graduation_college || "College"}`
      : `12th Pass from ${lead.school_name || "School"}`;
    notes ||= "Academic profile enriched based on educational background and interests.";
    await updateLead(lead.id, { enriched_job_title: profile.slice(0, 150), enrichment_notes: notes });
  } catch (err) {
    out.push({ level: "warning", text: `Academic enrichment failed; using fallback. ${(err as Error).message}` });
  }

  try {
    lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    const score = firstScore(await ask(scoringPrompt(lead, true))) ?? heuristicAdmissionScore(lead);
    await updateLead(lead.id, { conversion_score: score });
  } catch (err) {
    out.push({ level: "warning", text: `Admission scoring failed; used fallback. ${(err as Error).message}` });
  }

  try {
    lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    const text = (
      await ask(
        "You are an expert college admissions routing AI. Analyze this student's profile and route them to the most appropriate academic department/counselor.\n\n" +
          "ROUTING OPTIONS:\n" +
          "- undergraduate_counselor: For 12th pass students seeking bachelor's degrees, general courses, or undecided majors\n" +
          "- graduate_counselor: For graduates seeking master's, MBA, PhD, or advanced degrees\n" +
          "- specialized_department: For high-value students in competitive fields (Engineering, Medicine, Law, Architecture, IIT/JEE prep)\n" +
          "- senior_counselor: For high-priority cases, complex requirements, or students needing specialized attention\n\n" +
          "ROUTING CRITERIA:\n" +
          "1. Graduation Status: YES = graduate_counselor, NO = undergraduate_counselor (unless high-value)\n" +
          "2. Course Complexity: Engineering/Medicine/Law = specialized_department\n" +
          "3. Admission Score: 80+ = senior_counselor, 60-79 = specialized_department\n" +
          "4. High-value cases: senior_counselor or specialized_department\n" +
          "5. Academic Profile: Advanced background = graduate_counselor\n\n" +
          "STUDENT PROFILE:\n" +
          `Name: ${lead.first_name} ${lead.last_name}\n` +
          `12th School: ${or(lead.school_name, "Not provided")}\n` +
          `Graduation Status: ${or(lead.graduation_status, "Not provided")}\n` +
          `Graduation Course: ${or(lead.graduation_course, "Not provided")}\n` +
          `Graduation College: ${or(lead.graduation_college, "Not provided")}\n` +
          `Course Interested: ${or(lead.course_interested, "Not specified")}\n` +
          `Academic Profile: ${or(lead.enriched_job_title, "Not enriched")}\n` +
          `Admission Likelihood Score: ${lead.conversion_score ?? 0}/100\n` +
          `Financial Notes: ${or(lead.notes, "No financial info")}\n` +
          `Priority: ${or(lead.priority, "Not set")}\n` +
          `Status: ${or(lead.status, "Not set")}\n\n` +
          "RESPONSE FORMAT:\n" +
          "route=<option>\n" +
          "reason=<brief explanation of routing decision>\n\n" +
          "Analyze the profile and provide the most appropriate routing decision:",
      )
    )?.toLowerCase();
    const routedTo = (text && new RegExp(`route\\s*=\\s*(${ROUTES.join("|")})`).exec(text)?.[1]) || heuristicRoute(lead);
    const reason =
      (text && /reason\s*=\s*(.+)/.exec(text)?.[1]?.trim()) ||
      `Assigned to ${routedTo.replace(/_/g, " ")} based on admission score ${lead.conversion_score}, course interest '${lead.course_interested}', and graduation status '${lead.graduation_status}'.`;
    await updateLead(lead.id, { routed_to: routedTo, routing_reason: reason.slice(0, 1000) });

    const label = routedTo.replace(/_/g, " ");
    if (await executeAcademicRouting(lead.id, routedTo, reason)) {
      out.push({ level: "success", text: `Academic workflow complete. Routed to ${label} and status updated.` });
    } else {
      out.push({ level: "warning", text: `Academic workflow completed but routing actions failed. Routed to ${label}.` });
    }
  } catch (err) {
    out.push({ level: "error", text: `Academic routing failed: ${(err as Error).message}` });
  }
  return out;
}
