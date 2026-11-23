import { ROUTES } from "../http/urls";

const SECTIONS: Record<string, string[]> = {
  admin_dashboard: ["admin_home"],
  admin_leads: [
    "manage_leads", "add_lead", "edit_lead", "admin_view_lead", "delete_lead", "bulk_delete_leads",
    "delete_all_leads", "import_leads", "import_lead_failures", "download_import_failures_excel",
    "download_import_template", "assign_leads_to_counsellors", "bulk_transfer_leads", "transfer_lead",
    "admin_add_lead_activity", "admin_edit_lead_activity", "admin_delete_lead_activity",
    "admin_run_ai_workflow", "manual_route_student", "manage_businesses",
  ],
  admin_after_admission: [
    "manage_admitted_students", "add_admitted_student", "view_admitted_student", "edit_admitted_student",
    "add_admitted_student_remark", "delete_admitted_student", "promote_lead_to_admission",
    "import_won_leads_to_admission", "import_admitted_students_excel", "download_admitted_import_template",
  ],
  admin_counsellors: ["manage_counsellors", "add_counsellor", "edit_counsellor", "delete_counsellor", "counsellor_detail", "unfreeze_counsellor_activity_add"],
  admin_admins: ["manage_admins", "add_admin", "edit_admin", "delete_admin"],
  admin_lead_sources: ["manage_lead_sources", "add_lead_source", "edit_lead_source", "delete_lead_source", "lead_source_detail"],
  admin_lead_statuses: ["manage_lead_statuses", "add_lead_status", "edit_lead_status", "delete_lead_status"],
  admin_activity_types: ["manage_activity_types", "add_activity_type", "edit_activity_type", "delete_activity_type"],
  admin_meta: ["manage_meta_integration"],
  admin_aisensy: ["manage_aisensy_integration"],
  admin_webhook: ["manage_lead_webhook_integration"],
  admin_social_inbox: ["social_chat_inbox", "social_chat_send"],
  admin_daily_targets: ["manage_daily_targets", "create_daily_target", "update_daily_target", "delete_daily_target"],
  admin_activity_progress: ["counsellor_activity_progress_report"],
  admin_view_activities: ["counsellor_work_view"],
  admin_performance: ["counsellor_performance", "counsellor_performance_data"],
  admin_notifications: ["admin_view_notifications", "delete_admin_notification", "send_counsellor_notification"],
  counsellor_dashboard: ["counsellor_home", "get_my_analytics"],
  counsellor_leads: [
    "my_leads", "edit_my_lead", "lead_detail", "update_lead_status", "mark_lead_lost", "add_lead_activity",
    "edit_lead_activity", "schedule_follow_up", "request_lead_transfer", "delete_lead_activity",
    "mark_activity_complete", "mark_followup_complete", "create_business", "add_alternate_phone",
    "reveal_phone", "reveal_alternate_phone", "evaluate_conversion_score",
  ],
  counsellor_add_lead: ["counsellor_add_lead"],
  counsellor_businesses: ["my_businesses", "business_detail", "update_business_status"],
  counsellor_admission: [
    "counsellor_admission_followup", "counsellor_view_admitted_student", "counsellor_update_admission_followup",
    "counsellor_add_admitted_student_remark",
  ],
  counsellor_activities: ["my_activities", "counsellor_calendar"],
  counsellor_daily_target: ["my_daily_target"],
  counsellor_pending_tasks: ["pending_tasks"],
  counsellor_profile: ["counsellor_view_profile"],
  counsellor_notifications: [
    "counsellor_view_notifications", "check_current_time_notifications",
    "mark_assignment_notifications_read", "delete_counsellor_notification",
  ],
};

const BY_ROUTE = new Map(Object.entries(SECTIONS).flatMap(([section, routes]) => routes.map((r) => [r, section])));

function score(pattern: string): number {
  const params = (pattern.match(/:/g) ?? []).length;
  const literals = pattern.replace(/:[^/]+/g, "").length;
  return literals * 10 - params * 50;
}

/** Longest literal match wins, so `/counsellor/home/` does not light up the detail link. */
export function sidebarSectionForPath(pathname: string): string {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  let best = "";
  let bestScore = -1;
  for (const [name, pattern] of Object.entries(ROUTES)) {
    const re = new RegExp(`^${pattern.replace(/:[^/]+/g, "[^/]+")}$`);
    const points = score(pattern);
    if (re.test(path) && points > bestScore) {
      best = BY_ROUTE.get(name) ?? "";
      bestScore = points;
    }
  }
  return best;
}
