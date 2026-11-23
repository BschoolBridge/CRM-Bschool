/** What `scripts/import-django-data.ts` copies, and the order a full copy would have to follow. */

export const USER_BOOTSTRAP_TABLE = "main_app_customuser";

export interface DjangoEntity {
  djangoTable: string;
  prismaModel: string | null;
  dependsOn: string[];
  importedNow: boolean;
}

export const DJANGO_ENTITIES: DjangoEntity[] = [
  { djangoTable: USER_BOOTSTRAP_TABLE, prismaModel: "User", dependsOn: [], importedNow: true },
  { djangoTable: "main_app_admin", prismaModel: "Admin", dependsOn: ["User"], importedNow: false },
  { djangoTable: "main_app_counsellor", prismaModel: "Counsellor", dependsOn: ["User"], importedNow: false },
  { djangoTable: "main_app_leadsource", prismaModel: "LeadSource", dependsOn: [], importedNow: false },
  { djangoTable: "main_app_leadstatus", prismaModel: "LeadStatus", dependsOn: [], importedNow: false },
  { djangoTable: "main_app_activitytype", prismaModel: "ActivityType", dependsOn: [], importedNow: false },
  { djangoTable: "main_app_nextaction", prismaModel: "NextAction", dependsOn: [], importedNow: false },
  { djangoTable: "main_app_lead", prismaModel: "Lead", dependsOn: ["LeadSource", "Counsellor"], importedNow: false },
  {
    djangoTable: "main_app_leadalternatephone",
    prismaModel: "LeadAlternatePhone",
    dependsOn: ["Lead"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_leadactivity",
    prismaModel: "LeadActivity",
    dependsOn: ["Lead", "Counsellor"],
    importedNow: false,
  },
  { djangoTable: "main_app_business", prismaModel: "Business", dependsOn: ["Lead", "Counsellor"], importedNow: false },
  {
    djangoTable: "main_app_admittedstudent",
    prismaModel: "AdmittedStudent",
    dependsOn: ["Lead", "Counsellor", "User"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_admittedstudentremark",
    prismaModel: "AdmittedStudentRemark",
    dependsOn: ["AdmittedStudent"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_admittedstudentactivity",
    prismaModel: "AdmittedStudentActivity",
    dependsOn: ["AdmittedStudent", "Counsellor"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_notificationcounsellor",
    prismaModel: "NotificationCounsellor",
    dependsOn: ["Counsellor"],
    importedNow: false,
  },
  { djangoTable: "main_app_notificationadmin", prismaModel: "NotificationAdmin", dependsOn: ["User"], importedNow: false },
  {
    djangoTable: "main_app_leadtransfer",
    prismaModel: "LeadTransfer",
    dependsOn: ["Lead", "Counsellor", "User"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_counsellorperformance",
    prismaModel: "CounsellorPerformance",
    dependsOn: ["Counsellor"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_dataaccesslog",
    prismaModel: "DataAccessLog",
    dependsOn: ["User"],
    importedNow: false,
  },
  { djangoTable: "main_app_dailytarget", prismaModel: "DailyTarget", dependsOn: ["User"], importedNow: false },
  {
    djangoTable: "main_app_dailytargetassignment",
    prismaModel: "DailyTargetAssignment",
    dependsOn: ["DailyTarget", "Counsellor"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_counselloractivityfreezelog",
    prismaModel: "CounsellorActivityFreezeLog",
    dependsOn: ["Counsellor", "User"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_metaintegrationsettings",
    prismaModel: "MetaIntegrationSettings",
    dependsOn: [],
    importedNow: false,
  },
  {
    djangoTable: "main_app_aisensyintegrationsettings",
    prismaModel: "AiSensyIntegrationSettings",
    dependsOn: [],
    importedNow: false,
  },
  { djangoTable: "main_app_socialchatthread", prismaModel: "SocialChatThread", dependsOn: ["Lead"], importedNow: false },
  {
    djangoTable: "main_app_socialchatmessage",
    prismaModel: "SocialChatMessage",
    dependsOn: ["SocialChatThread"],
    importedNow: false,
  },
  {
    djangoTable: "main_app_admissionsession",
    prismaModel: null,
    dependsOn: [],
    importedNow: false,
  },
];

const FRAMEWORK_TABLES = [
  "auth_group",
  "auth_group_permissions",
  "auth_permission",
  "django_admin_log",
  "django_content_type",
  "django_migrations",
  "django_session",
  "main_app_customuser_groups",
  "main_app_customuser_user_permissions",
];

export function importOrder(entities: DjangoEntity[] = DJANGO_ENTITIES): string[] {
  const nodes = entities.filter((entity) => entity.prismaModel);
  const known = new Set(nodes.map((entity) => entity.prismaModel as string));
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const entity of nodes) {
    const name = entity.prismaModel as string;
    indegree.set(name, indegree.get(name) ?? 0);
    for (const parent of entity.dependsOn) {
      if (!known.has(parent)) throw new Error(`Unknown dependency ${parent}`);
      indegree.set(name, (indegree.get(name) ?? 0) + 1);
      const next = children.get(parent) ?? [];
      next.push(name);
      children.set(parent, next);
    }
  }
  const ready = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([name]) => name)
    .sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const name = ready.shift();
    if (!name) break;
    order.push(name);
    for (const child of children.get(name) ?? []) {
      const degree = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, degree);
      if (degree === 0) ready.push(child);
    }
    ready.sort();
  }
  if (order.length !== nodes.length) throw new Error("Import order has a cycle");
  return order;
}

export function classifySqliteCounts(counts: Record<string, number>): {
  copied: string[];
  crmNotCopied: string[];
  frameworkIgnored: string[];
} {
  const crm = new Set(DJANGO_ENTITIES.map((entity) => entity.djangoTable));
  const copied: string[] = [];
  const crmNotCopied: string[] = [];
  const frameworkIgnored: string[] = [];
  for (const [name, count] of Object.entries(counts)) {
    if (count <= 0) continue;
    if (name === USER_BOOTSTRAP_TABLE) copied.push(name);
    else if (crm.has(name)) crmNotCopied.push(name);
    else if (FRAMEWORK_TABLES.includes(name)) frameworkIgnored.push(name);
  }
  return { copied, crmNotCopied: crmNotCopied.sort(), frameworkIgnored: frameworkIgnored.sort() };
}

export interface BootstrapUser {
  id: number;
  password: string;
  last_login: unknown;
  is_superuser: unknown;
  email: string;
  first_name: string;
  last_name: string;
  user_type: "1" | "2";
  gender: string;
  profile_pic: string;
  address: string;
  phone: string;
  fcm_token: string;
  date_joined: unknown;
  created_at: unknown;
  is_staff: unknown;
  is_active: boolean;
}

function bounded(row: Record<string, unknown>, field: string, max: number, id: number): string {
  const value = row[field] == null ? "" : String(row[field]);
  if (value.length > max) throw new Error(`User ${id} field ${field} is longer than ${max}`);
  return value;
}

export function parseBootstrapUser(row: Record<string, unknown>): BootstrapUser {
  const id = Number(row.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("User id must be a positive integer");
  const email = bounded(row, "email", 254, id).trim();
  if (!email) throw new Error(`User ${id} needs an email`);
  const password = bounded(row, "password", 255, id);
  if (!password) throw new Error(`User ${id} needs a password hash`);
  const userType = bounded(row, "user_type", 10, id);
  if (userType !== "1" && userType !== "2") throw new Error(`User ${id} has an unsupported user_type`);
  return {
    id,
    password,
    last_login: row.last_login,
    is_superuser: row.is_superuser,
    email,
    first_name: bounded(row, "first_name", 150, id),
    last_name: bounded(row, "last_name", 150, id),
    user_type: userType,
    gender: bounded(row, "gender", 50, id),
    profile_pic: bounded(row, "profile_pic", 100, id),
    address: row.address == null ? "" : String(row.address),
    phone: bounded(row, "phone", 20, id),
    fcm_token: bounded(row, "fcm_token", 255, id),
    date_joined: row.date_joined,
    created_at: row.created_at,
    is_staff: row.is_staff,
    is_active: row.is_active === 0 || row.is_active === false ? false : Boolean(row.is_active ?? true),
  };
}

export function describeImportPlan(): string {
  const order = importOrder()
    .map((name, index) => `${index + 1}. ${name}`)
    .join("\n");
  return [
    "Django import plan",
    "The current script bootstraps users only. It does not copy counsellors, leads, admissions, targets, or chat.",
    "Run it only against a disposable MariaDB copy. Do not point DATABASE_URL at production.",
    "Take a database dump before the run. Restore that dump to undo it.",
    "Existing user rows are left unchanged. A second run does not refresh passwords or emails already stored.",
    "The user batch is one transaction. A failed row rolls that batch back.",
    "An email that already belongs to a different id aborts the batch.",
    "After a successful batch, users.AUTO_INCREMENT is set to MAX(id)+1.",
    "SQLite timestamps are parsed as local time.",
    "Prisma has no admission-session model. Ignore main_app_admissionsession and admittedstudent.session_id.",
    "The CRM-Portal SQLite file checked for this plan is at Django migration 0051. Migration 0052, which drops AdmissionSession, is not applied there.",
    "Session rows are created by this app. Django sessions are not copied.",
    "Full copy order, not executed by this script:",
    order,
  ].join("\n");
}
