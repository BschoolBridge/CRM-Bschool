/**
 * Named routes, kept identical to the Django URLconf so links, bookmarks and
 * external webhook URLs keep working after the migration.
 */
export const ROUTES = {
  // Auth
  login_page: "/",
  user_login: "/doLogin/",
  user_logout: "/logout_user/",
  showFirebaseJS: "/firebase-messaging-sw.js",
  password_reset: "/password_reset/",
  password_reset_done: "/password_reset/done/",
  password_reset_confirm: "/reset/:uidb64/:token/",
  password_reset_complete: "/reset/done/",

  // Integrations
  meta_webhook: "/integrations/meta/webhook/",
  aisensy_webhook: "/integrations/aisensy/webhook/",
  manage_aisensy_integration: "/integrations/aisensy/settings/",
  lead_webhook: "/integrations/leads/webhook/",
  manage_lead_webhook_integration: "/integrations/leads/settings/",
  manage_meta_integration: "/integrations/meta/settings/",
  social_chat_inbox: "/integrations/chats/",
  social_chat_send: "/integrations/chats/:thread_id/send/",

  // Admin
  admin_home: "/admin/home/",
  counsellor_activity_progress_report: "/admin/counsellor-activity-progress/",
  admin_view_profile: "/admin/profile/",
  admin_view_notifications: "/admin/notifications/",
  add_counsellor: "/counsellor/add/",
  manage_counsellors: "/counsellor/manage/",
  counsellor_detail: "/counsellor/:counsellor_id/",
  unfreeze_counsellor_activity_add: "/counsellor/:counsellor_id/unfreeze-activity-add/",
  edit_counsellor: "/counsellor/edit/:counsellor_id/",
  delete_counsellor: "/counsellor/delete/:counsellor_id/",
  add_admin: "/admin/add/",
  manage_admins: "/admin/manage/",
  edit_admin: "/admin/edit/:admin_id/",
  delete_admin: "/admin/delete/:admin_id/",
  counsellor_performance_data: "/counsellor/performance/data/",
  counsellor_performance: "/counsellor/performance/",
  counsellor_work_view: "/counsellor/work/",

  manage_leads: "/leads/manage/",
  add_lead: "/leads/add/",
  admin_view_lead: "/leads/view/:lead_id/",
  admin_add_lead_activity: "/leads/view/:lead_id/activity/add/",
  admin_edit_lead_activity: "/leads/view/:lead_id/activity/:activity_id/edit/",
  admin_delete_lead_activity: "/leads/view/:lead_id/activity/:activity_id/delete/",
  admin_run_ai_workflow: "/leads/ai-workflow/:lead_id/",
  manual_route_student: "/leads/manual-route/:lead_id/",
  edit_lead: "/leads/edit/:lead_id/",
  delete_lead: "/leads/delete/:lead_id/",
  bulk_delete_leads: "/leads/delete/bulk/",
  delete_all_leads: "/leads/delete/all/",
  import_leads: "/leads/import/",
  import_lead_failures: "/leads/import/failures/",
  download_import_failures_excel: "/leads/import/failures/download/",
  download_import_template: "/leads/import/template/:file_type/",
  assign_leads_to_counsellors: "/leads/assign/",
  bulk_transfer_leads: "/leads/transfer/bulk/",
  transfer_lead: "/leads/transfer/:lead_id/",

  manage_admitted_students: "/admission-followup/",
  add_admitted_student: "/admission-followup/add/",
  view_admitted_student: "/admission-followup/:student_id/view/",
  edit_admitted_student: "/admission-followup/:student_id/edit/",
  add_admitted_student_remark: "/admission-followup/:student_id/remarks/add/",
  delete_admitted_student: "/admission-followup/:student_id/delete/",
  promote_lead_to_admission: "/admission-followup/from-lead/:lead_id/",
  import_won_leads_to_admission: "/admission-followup/import-won/",
  import_admitted_students_excel: "/admission-followup/import/",
  download_admitted_import_template: "/admission-followup/import/template/",

  manage_lead_sources: "/lead-sources/manage/",
  lead_source_detail: "/lead-sources/:source_id/",
  add_lead_source: "/lead-sources/add/",
  edit_lead_source: "/lead-sources/edit/:source_id/",
  delete_lead_source: "/lead-sources/delete/:source_id/",
  manage_lead_statuses: "/lead-statuses/manage/",
  add_lead_status: "/lead-statuses/add/",
  edit_lead_status: "/lead-statuses/edit/:status_id/",
  delete_lead_status: "/lead-statuses/delete/:status_id/",
  manage_activity_types: "/activity-types/manage/",
  add_activity_type: "/activity-types/add/",
  edit_activity_type: "/activity-types/edit/:type_id/",
  delete_activity_type: "/activity-types/delete/:type_id/",
  manage_daily_targets: "/daily-targets/",
  create_daily_target: "/daily-targets/create/",
  update_daily_target: "/daily-targets/update/:target_id/",
  delete_daily_target: "/daily-targets/delete/:target_id/",
  manage_next_actions: "/next-actions/manage/",
  add_next_action: "/next-actions/add/",
  edit_next_action: "/next-actions/edit/:action_id/",
  delete_next_action: "/next-actions/delete/:action_id/",
  manage_businesses: "/businesses/manage/",
  send_counsellor_notification: "/notifications/send/",
  get_lead_analytics: "/analytics/leads/",
  get_admin_calendar_events: "/calendar/events/",

  // Counsellor
  counsellor_home: "/counsellor/home/",
  counsellor_view_profile: "/counsellor/profile/",
  counsellor_view_notifications: "/counsellor/notifications/",
  counsellor_fcmtoken: "/counsellor/fcmtoken/",
  my_leads: "/counsellor/leads/",
  counsellor_add_lead: "/counsellor/leads/add/",
  lead_detail: "/counsellor/leads/:lead_id/",
  edit_my_lead: "/counsellor/leads/:lead_id/edit/",
  add_alternate_phone: "/counsellor/leads/:lead_id/alternate-phone/add/",
  reveal_alternate_phone: "/counsellor/leads/:lead_id/alternate-phone/reveal/",
  reveal_phone: "/counsellor/leads/:lead_id/phone/reveal/",
  get_lead_calendar_events: "/counsellor/leads/:lead_id/calendar/events/",
  add_lead_activity: "/counsellor/leads/:lead_id/activity/add/",
  edit_lead_activity: "/counsellor/leads/:lead_id/activity/:activity_id/edit/",
  delete_lead_activity: "/counsellor/leads/:lead_id/activity/:activity_id/delete/",
  mark_activity_complete: "/counsellor/leads/:lead_id/activity/:activity_id/complete/",
  update_lead_status: "/counsellor/leads/:lead_id/status/update/",
  create_business: "/counsellor/leads/:lead_id/business/create/",
  request_lead_transfer: "/counsellor/leads/:lead_id/transfer/request/",
  schedule_follow_up: "/counsellor/leads/:lead_id/follow-up/schedule/",
  mark_followup_complete: "/counsellor/leads/:lead_id/follow-up/complete/",
  evaluate_conversion_score: "/counsellor/leads/:lead_id/conversion/evaluate/",
  mark_lead_lost: "/counsellor/leads/:lead_id/mark-lost/",
  my_businesses: "/counsellor/businesses/",
  business_detail: "/counsellor/businesses/:business_id/",
  update_business_status: "/counsellor/businesses/:business_id/status/update/",
  my_activities: "/counsellor/activities/",
  pending_tasks: "/counsellor/pending-tasks/",
  counsellor_call_queue: "/counsellor/call-queue/",
  my_daily_target: "/counsellor/daily-target/",
  counsellor_admission_followup: "/counsellor/admission-followup/",
  counsellor_view_admitted_student: "/counsellor/admission-followup/:student_id/view/",
  counsellor_update_admission_followup: "/counsellor/admission-followup/:student_id/",
  counsellor_add_admitted_student_remark: "/counsellor/admission-followup/:student_id/remarks/add/",
  counsellor_calendar: "/counsellor/calendar/",
  get_calendar_events: "/counsellor/calendar/events/",
  check_current_time_notifications: "/counsellor/notifications/check/",
  mark_assignment_notifications_read: "/counsellor/notifications/assignment-read/",
  get_my_analytics: "/counsellor/analytics/",
  delete_counsellor_notification: "/counsellor/notification/delete/:notification_id/",
  delete_admin_notification: "/admin/notification/delete/:notification_id/",
} as const;

export type RouteName = keyof typeof ROUTES;

export function reverse(name: RouteName | string, ...args: unknown[]): string {
  const pattern = (ROUTES as Record<string, string>)[name];
  if (!pattern) throw new Error(`No route named "${name}"`);
  let i = 0;
  const path = pattern.replace(/:(\w+)/g, (_m, param: string) => {
    if (i >= args.length) throw new Error(`Route "${name}" is missing argument "${param}"`);
    return encodeURIComponent(String(args[i++]));
  });
  return path;
}

export function withQuery(path: string, query: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
