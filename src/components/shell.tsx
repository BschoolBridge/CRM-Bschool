import { headers } from "next/headers";
import { formatLocal } from "../lib/time";
import { reverse } from "../http/urls";
import { USER_TYPE_ADMIN, USER_TYPE_COUNSELLOR, type AuthUser } from "../server/auth";
import { sidebarSectionForPath } from "../server/nav";
import { shellState, type ShellState } from "../server/shell";
import { peekFlash } from "../server/flash";
import { FlashList } from "./ui";

/**
 * Use plain <a> for portal nav. Next.js client transitions were dropping the
 * session on Hostinger (soft nav → login) even when full document loads worked.
 */
function Item({ href, icon, label, active, badge }: { href: string; icon: string; label: string; active: boolean; badge?: number }) {
  return (
    <li className="nav-item">
      <a href={href} className={`nav-link${active ? " active" : ""}`}>
        <i className={`nav-icon ${icon}`} />
        <p>
          {label}
          {badge ? <span className="badge badge-danger right">{badge}</span> : null}
        </p>
      </a>
    </li>
  );
}

function AdminMenu({ active, shell }: { active: string; shell: ShellState }) {
  return (
    <>
      <Item href={reverse("admin_home")} icon="fas fa-tachometer-alt" label="Overview" active={active === "admin_dashboard"} />
      <li className="nav-header">LEADS</li>
      <Item href={reverse("manage_leads")} icon="fas fa-users" label="Leads" active={active === "admin_leads"} />
      <Item href={reverse("manage_admitted_students")} icon="fas fa-user-graduate" label="After Admission" active={active === "admin_after_admission"} />
      <li className="nav-header">TEAM</li>
      <Item href={reverse("manage_counsellors")} icon="fas fa-user-tie" label="Counsellors" active={active === "admin_counsellors"} />
      <Item href={reverse("manage_daily_targets")} icon="fas fa-bullseye" label="Daily Targets" active={active === "admin_daily_targets"} />
      {shell.isSuperadmin || shell.permPerformance ? <li className="nav-header">REPORTS</li> : null}
      {shell.isSuperadmin ? (
        <>
          <Item href={reverse("counsellor_activity_progress_report")} icon="fas fa-user-check" label="Activity Progress" active={active === "admin_activity_progress"} />
          <Item href={reverse("counsellor_work_view")} icon="fas fa-history" label="View Activities" active={active === "admin_view_activities"} />
        </>
      ) : null}
      {shell.permPerformance ? (
        <Item href={reverse("counsellor_performance")} icon="fas fa-chart-bar" label="Performance" active={active === "admin_performance"} />
      ) : null}
      <Item href={reverse("admin_view_notifications")} icon="fas fa-bell" label="Notifications" active={active === "admin_notifications"} badge={shell.notificationCount} />
      {shell.permSettings ? (
        <>
          <li className="nav-header">INTEGRATIONS</li>
          <Item href={reverse("manage_meta_integration")} icon="fab fa-whatsapp" label="WhatsApp and Meta" active={active === "admin_meta"} />
          <Item href={reverse("manage_aisensy_integration")} icon="fas fa-comment-dots" label="AiSensy WhatsApp" active={active === "admin_aisensy"} />
          <Item href={reverse("manage_lead_webhook_integration")} icon="fas fa-globe" label="Website Lead Webhook" active={active === "admin_webhook"} />
          <Item href={reverse("social_chat_inbox")} icon="fas fa-comments" label="Social Inbox" active={active === "admin_social_inbox"} />
          <li className="nav-header">SETTINGS</li>
          <Item href={reverse("manage_lead_sources")} icon="fas fa-tags" label="Lead Sources" active={active === "admin_lead_sources"} />
          <Item href={reverse("manage_lead_statuses")} icon="fas fa-flag" label="Lead Statuses" active={active === "admin_lead_statuses"} />
          <Item href={reverse("manage_activity_types")} icon="fas fa-tasks" label="Activity Types" active={active === "admin_activity_types"} />
        </>
      ) : null}
      {shell.isSuperadmin ? (
        <Item href={reverse("manage_admins")} icon="fas fa-user-shield" label="User Management" active={active === "admin_admins"} />
      ) : null}
    </>
  );
}

function CounsellorMenu({ active, shell }: { active: string; shell: ShellState }) {
  return (
    <>
      <Item href={reverse("counsellor_home")} icon="fas fa-tachometer-alt" label="My Dashboard" active={active === "counsellor_dashboard"} />
      <li className="nav-header">LEADS</li>
      <Item href={reverse("my_leads")} icon="fas fa-users" label="My Leads" active={active === "counsellor_leads"} />
      <Item href={reverse("counsellor_add_lead")} icon="fas fa-user-plus" label="Add Lead" active={active === "counsellor_add_lead"} />
      <Item href={reverse("my_businesses")} icon="fas fa-briefcase" label="My Businesses" active={active === "counsellor_businesses"} />
      {shell.canAdmission ? (
        <>
          <li className="nav-header">STUDENTS</li>
          <Item href={reverse("counsellor_admission_followup")} icon="fas fa-user-graduate" label="Our Student" active={active === "counsellor_admission"} />
        </>
      ) : null}
      <li className="nav-header">WORK</li>
      <Item href={reverse("my_activities")} icon="fas fa-history" label="Follow-ups" active={active === "counsellor_activities"} />
      <Item href={reverse("pending_tasks")} icon="fas fa-clipboard-list" label="My Tasks" active={active === "counsellor_pending_tasks"} badge={shell.pendingTaskCount} />
      <Item href={reverse("my_daily_target")} icon="fas fa-bullseye" label="Daily Targets" active={active === "counsellor_daily_target"} />
      <Item href={reverse("counsellor_view_notifications")} icon="fas fa-bell" label="Notifications" active={active === "counsellor_notifications"} badge={shell.notificationCount} />
      <li className="nav-header">ACCOUNT</li>
      <Item href={reverse("counsellor_view_profile")} icon="fas fa-user" label="My Profile" active={active === "counsellor_profile"} />
    </>
  );
}

export async function Shell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const [shell, flashes, headerList] = await Promise.all([shellState(user), peekFlash(), headers()]);
  const pathname = headerList.get("x-pathname") ?? "";
  const nonce = headerList.get("x-nonce") ?? undefined;
  const active = sidebarSectionForPath(pathname);
  const home = user.user_type === USER_TYPE_ADMIN ? reverse("admin_home") : reverse("counsellor_home");
  const notes = user.user_type === USER_TYPE_ADMIN ? reverse("admin_view_notifications") : reverse("counsellor_view_notifications");
  const loggedIn = user.last_login ? formatLocal(user.last_login, "yyyy-MM-dd HH:mm") : "";

  return (
    <div className="wrapper">
      {user.user_type === USER_TYPE_COUNSELLOR ? (
        <>
          <div className="security-banner">
            <div className="security-banner-inner">
              <i className="fas fa-shield-alt" /> All views and key actions are logged with your account. Unauthorized sharing of student data is strictly prohibited.
            </div>
          </div>
          <div className="security-watermark">
            <strong>{user.email}</strong> · Activity logged · {loggedIn}
          </div>
          <script id="counsellor-assignment-alerts-data" type="application/json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(shell.assignmentAlerts).replace(/</g, "\\u003c") }} />
        </>
      ) : null}
      <nav className="main-header navbar navbar-expand navbar-white navbar-light">
        <ul className="navbar-nav">
          <li className="nav-item">
            <a className="nav-link" data-widget="pushmenu" href="#" role="button">
              <i className="fas fa-bars" />
            </a>
          </li>
        </ul>
        <ul className="navbar-nav ml-auto">
          <li className="nav-item">
            <a className="nav-link" href={notes}>
              <i className="fas fa-bell" />
              {shell.notificationCount > 0 ? <span className="badge badge-danger navbar-badge">{shell.notificationCount}</span> : null}
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href={reverse("user_logout")}>
              <i className="fas fa-sign-out-alt" /> Logout
            </a>
          </li>
        </ul>
      </nav>
      <aside className="main-sidebar sidebar-dark-primary elevation-4">
        <a href={home} className="brand-link">
          <span className="brand-text">Bschool Bridge</span>
        </a>
        <div className="sidebar">
          <nav className="mt-2">
            <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
              {user.user_type === USER_TYPE_ADMIN ? <AdminMenu active={active} shell={shell} /> : <CounsellorMenu active={active} shell={shell} />}
            </ul>
          </nav>
        </div>
        <div className="sidebar-resize-handle" id="crm-sidebar-resize" />
      </aside>
      <div className="content-wrapper">
        <FlashList messages={flashes} />
        {children}
      </div>
      <footer className="main-footer">
        <strong>Bschool Bridge</strong>
      </footer>
    </div>
  );
}
