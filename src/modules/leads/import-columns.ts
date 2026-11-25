/**
 * Flexible spreadsheet header matching for lead import.
 *
 * Accepts exact template names, common aliases, human labels
 * ("Full Name", "Mobile No."), and close spellings via normalized
 * + similarity matching — without inventing values for unmatched columns.
 */

/** Canonical keys used by leadFromImportRow / IMPORT_TEMPLATE_HEADERS. */
export const IMPORT_FIELD_ALIASES: Record<string, readonly string[]> = {
  fullName: [
    "fullName",
    "full_name",
    "fullname",
    "name",
    "student_name",
    "applicant_name",
    "candidate_name",
    "canidate_name", // common spreadsheet typo
    "lead_name",
    "contact_name",
    "student",
    "applicant",
    "full name",
    "student name",
    "applicant name",
    "candidate name",
    "canidate name",
    "lead name",
    "contact name",
    "name of student",
    "name of applicant",
  ],
  phone: [
    "phone",
    "mobile",
    "phone_number",
    "mobile_number",
    "mobile_no",
    "phone_no",
    "contact_number",
    "contact_no",
    "whatsapp",
    "whatsapp_number",
    "cell",
    "cellphone",
    "phone number",
    "mobile number",
    "mobile no",
    "phone no",
    "contact number",
    "contact no",
    "whatsapp number",
    "cell phone",
    "primary phone",
    "primary mobile",
  ],
  email: [
    "email",
    "email_address",
    "email_id",
    "mail",
    "mail_id",
    "e_mail",
    "email address",
    "email id",
    "mail id",
    "e-mail",
    "e mail",
  ],
  targetExam: [
    "targetExam",
    "target_exam",
    "exam",
    "entrance_exam",
    "target_entrance",
    "exam_name",
    "target exam",
    "entrance exam",
    "exam name",
    "mba exam",
  ],
  percentile: [
    "percentile",
    "score_band",
    "exam_percentile",
    "score",
    "percentile_score",
    "cat_percentile",
    "exam score",
    "exam percentile",
    "score band",
    "percentile/score",
    "percentile score",
  ],
  city: ["city", "location", "town", "city_name", "city name", "current city"],
  workExperience: [
    "workExperience",
    "work_experience",
    "experience",
    "work_exp",
    "exp",
    "years_of_experience",
    "yoe",
    "work experience",
    "work exp",
    "years of experience",
    "total experience",
    "professional experience",
  ],
  academicBackground: [
    "academicBackground",
    "academic_background",
    "academics",
    "education",
    "qualification",
    "degree",
    "academic background",
    "educational background",
    "ug degree",
    "graduation degree",
  ],
  budget: ["budget", "fee_budget", "fees_budget", "fee budget", "fees budget", "budget range"],
  specialization: [
    "specialization",
    "specialisation",
    "course",
    "preferred_specialization",
    "mba_specialization",
    "preferred specialization",
    "mba specialization",
    "interested specialization",
  ],
  college: [
    "college",
    "school_name",
    "School Name",
    "graduation_college",
    "school",
    "institute",
    "institution",
    "university",
    "ug_college",
    "college name",
    "school name",
    "graduation college",
    "undergrad college",
  ],
  notes: [
    "notes",
    "message",
    "comments",
    "remark",
    "remarks",
    "comment",
    "additional_notes",
    "additional notes",
    "counsellor notes",
    "lead notes",
  ],
  source: [
    "source",
    "lead_source",
    "form_type",
    "form",
    "campaign",
    "utm_source",
    "lead source",
    "form type",
    "website source",
    "source campaign",
  ],
  course_interested: [
    "course_interested",
    "courseInterested",
    "interested_course",
    "program",
    "programme",
    "course interested",
    "interested course",
    "interested program",
  ],
  alternate_phone: [
    "alternate_phone",
    "alternatePhone",
    "alt_phone",
    "secondary_phone",
    "alternate mobile",
    "alt mobile",
    "secondary mobile",
    "alternate phone",
  ],
  address: ["address", "full_address", "residential_address", "full address", "home address"],
  industry: ["industry", "sector", "work_industry", "work industry"],
  graduation_status: [
    "graduation_status",
    "graduated",
    "is_graduated",
    "graduation status",
    "grad status",
  ],
  graduation_course: ["graduation_course", "grad_course", "ug_course", "graduation course"],
  graduation_college: ["graduation_college", "grad_college", "ug college"],
  graduation_year: [
    "graduation_year",
    "grad_year",
    "year_of_graduation",
    "graduation year",
    "passout year",
    "passing year",
  ],
};

/** Prefer required / high-value fields when two columns compete for a fuzzy match. */
const FIELD_PRIORITY = [
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
  "course_interested",
  "alternate_phone",
  "address",
  "industry",
  "graduation_status",
  "graduation_course",
  "graduation_college",
  "graduation_year",
] as const;

export type ImportCanonicalField = (typeof FIELD_PRIORITY)[number];

/** Strip punctuation/case so "Full Name", "full_name", "fullname" compare equal. */
export function normalizeImportHeader(header: string): string {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const next = a[i] === b[j] ? diag : Math.min(diag, prev[j]!, prev[j + 1]!) + 1;
      diag = prev[j + 1]!;
      prev[j + 1] = next;
    }
  }
  return prev[b.length]!;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

type AliasIndex = { field: ImportCanonicalField; aliasNorm: string };

function buildAliasIndex(): AliasIndex[] {
  const out: AliasIndex[] = [];
  for (const field of FIELD_PRIORITY) {
    const aliases = IMPORT_FIELD_ALIASES[field] ?? [field];
    const seen = new Set<string>();
    for (const alias of aliases) {
      const aliasNorm = normalizeImportHeader(alias);
      if (!aliasNorm || seen.has(aliasNorm)) continue;
      seen.add(aliasNorm);
      out.push({ field, aliasNorm });
    }
  }
  return out;
}

const ALIAS_INDEX = buildAliasIndex();

function exactAliasField(headerNorm: string): ImportCanonicalField | null {
  const hits = ALIAS_INDEX.filter((entry) => entry.aliasNorm === headerNorm);
  if (!hits.length) return null;
  // Prefer the field that appears first in FIELD_PRIORITY when aliases collide.
  return FIELD_PRIORITY.find((field) => hits.some((hit) => hit.field === field)) ?? hits[0]!.field;
}

function fuzzyAliasField(headerNorm: string, claimed: Set<string>): ImportCanonicalField | null {
  if (headerNorm.length < 4) return null;
  let best: { field: ImportCanonicalField; score: number } | null = null;

  for (const { field, aliasNorm } of ALIAS_INDEX) {
    if (claimed.has(field)) continue;
    let score = 0;
    if (headerNorm === aliasNorm) {
      score = 1;
    } else {
      const dist = levenshtein(headerNorm, aliasNorm);
      // One-character typos ("Phon" → phone, "Ful Name" → fullName).
      if (dist <= 1 && Math.min(headerNorm.length, aliasNorm.length) >= 4) score = 0.9;
      else if (headerNorm.includes(aliasNorm) && aliasNorm.length >= 4) {
        score = 0.92 * (aliasNorm.length / headerNorm.length);
      } else if (aliasNorm.includes(headerNorm) && headerNorm.length >= 4) {
        // Require a strong containment ratio so "phon" does not weakly match longer aliases only.
        score = 0.9 * (headerNorm.length / aliasNorm.length);
      } else {
        score = similarity(headerNorm, aliasNorm);
      }
    }
    // Conservative threshold — avoid mapping "city" to "priority" etc.
    if (score < 0.84) continue;
    if (!best || score > best.score + 0.001) {
      best = { field, score };
    } else if (best && Math.abs(score - best.score) < 0.001) {
      // Tie: keep higher-priority field.
      const bestIdx = FIELD_PRIORITY.indexOf(best.field);
      const nextIdx = FIELD_PRIORITY.indexOf(field);
      if (nextIdx >= 0 && (bestIdx < 0 || nextIdx < bestIdx)) best = { field, score };
    }
  }
  return best?.field ?? null;
}

/**
 * Map spreadsheet header labels → canonical import field names.
 * Each source column is used at most once; required fields win ties.
 */
export function resolveImportColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const claimedFields = new Set<string>();
  const claimedHeaders = new Set<string>();

  const usable = headers
    .map((header) => String(header ?? "").trim())
    .filter(Boolean)
    .map((header) => ({ header, norm: normalizeImportHeader(header) }))
    .filter((entry) => entry.norm);

  // Pass 1: exact normalized alias matches (deterministic).
  for (const field of FIELD_PRIORITY) {
    for (const entry of usable) {
      if (claimedHeaders.has(entry.header)) continue;
      const matched = exactAliasField(entry.norm);
      if (matched !== field) continue;
      mapping[field] = entry.header;
      claimedFields.add(field);
      claimedHeaders.add(entry.header);
      break;
    }
  }

  // Pass 2: similar / fuzzy matches for remaining fields.
  for (const entry of usable) {
    if (claimedHeaders.has(entry.header)) continue;
    const field = fuzzyAliasField(entry.norm, claimedFields);
    if (!field || claimedFields.has(field)) continue;
    mapping[field] = entry.header;
    claimedFields.add(field);
    claimedHeaders.add(entry.header);
  }

  return mapping;
}

/** Copy matched column values onto canonical keys so cell lookups stay simple. */
export function remapImportRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapping = resolveImportColumnMapping(Object.keys(row));
  const out: Record<string, unknown> = { ...row };
  for (const [canonical, source] of Object.entries(mapping)) {
    if (!(source in row)) continue;
    // Prefer an already-present exact canonical value when both exist.
    if (canonical in row && row[canonical] !== row[source] && String(row[canonical] ?? "").trim()) continue;
    out[canonical] = row[source];
  }
  return out;
}
