import { PageHeader, PriorityBadge, StatusBadge } from "@/components/ui";
import { reverse } from "@/http/urls";
import { formatDjango } from "@/lib/time";
import { loadCallQueue, type CallQueueItem } from "@/modules/counsellor/call-queue.service";
import { nextActionChoices } from "@/modules/reference/reference.service";
import { QueueContactButtons, QuickOutcomeForm } from "../_components/quick-outcome-form";
import { counsellorContext } from "../_lib/owned";

export const metadata = { title: "Today’s Call Queue | Bschool Bridge" };

function QueueSection({
  title,
  hint,
  items,
  tone,
  nextChoices,
}: {
  title: string;
  hint: string;
  items: CallQueueItem[];
  tone: "danger" | "warning" | "info";
  nextChoices: Array<[string, string]>;
}) {
  const toneStyle =
    tone === "danger"
      ? { bg: "#fef2f2", color: "#dc2626", icon: "fas fa-exclamation-circle" }
      : tone === "warning"
        ? { bg: "#fffbeb", color: "#d97706", icon: "fas fa-clock" }
        : { bg: "#eff6ff", color: "#2563eb", icon: "fas fa-user-plus" };

  return (
    <div className="crm-card mb-3">
      <div className="crm-card-header">
        <h3 className="crm-card-title">
          <i className={`${toneStyle.icon} crm-card-title-icon`} style={{ color: toneStyle.color }} /> {title}
        </h3>
        <span className="badge badge-light" style={{ padding: "0.35rem 0.65rem", borderRadius: "8px" }}>
          {items.length}
        </span>
      </div>
      <div className="crm-card-body">
        <p className="text-muted small mb-3">{hint}</p>
        {items.length === 0 ? (
          <div className="crm-empty-state" style={{ padding: "1.25rem" }}>
            <div className="crm-empty-title" style={{ fontSize: "0.9rem" }}>
              Nothing here
            </div>
          </div>
        ) : (
          <div className="crm-activity-list">
            {items.map((item) => {
              const name = `${item.lead.first_name} ${item.lead.last_name}`.trim() || "Lead";
              return (
                <div key={item.key} className="crm-activity-item crm-queue-item">
                  <div className="crm-activity-icon" style={{ background: toneStyle.bg, color: toneStyle.color }}>
                    <i className={toneStyle.icon} />
                  </div>
                  <div className="crm-activity-item-main">
                    <div className="crm-activity-item-top">
                      <div style={{ minWidth: 0 }}>
                        <div className="d-flex align-items-center flex-wrap" style={{ gap: "0.35rem" }}>
                          <span className="crm-activity-lead" style={{ cursor: "default" }}>
                            {name}
                          </span>
                          <StatusBadge code={item.lead.status} />
                          <PriorityBadge code={item.lead.priority} />
                          {item.when ? (
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 }}>
                              {formatDjango(item.when, "M d, Y H:i")}
                            </span>
                          ) : null}
                        </div>
                        <div className="crm-activity-subject" title={item.reason}>
                          {item.reason}
                          {item.lead.phone ? ` · ${item.lead.phone}` : ""}
                        </div>
                      </div>
                      <QueueContactButtons phone={item.lead.phone} leadHref={reverse("lead_detail", item.lead.id)} />
                    </div>
                    <div className="mt-2">
                      <QuickOutcomeForm
                        leadId={item.lead.id}
                        activityId={item.activityId}
                        nextActionChoices={nextChoices}
                        returnTo="call_queue"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function CallQueuePage() {
  const { counsellor } = await counsellorContext();
  const [queue, nextChoices] = await Promise.all([loadCallQueue(counsellor.id), nextActionChoices()]);
  const choices = nextChoices.filter(([code]) => code) as Array<[string, string]>;

  return (
    <>
      <PageHeader
        title="Today’s call queue"
        subtitle="Overdue follow-ups, due today, then new leads — log outcomes without leaving this page"
      />
      <section className="content">
        <div className="container-fluid">
          <div className="admin-stat-grid mb-3">
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">In queue</div>
                <div className="admin-stat-num">{queue.total}</div>
                <p className="admin-stat-meta">Leads to work now</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#eff6ff", color: "#3157E8" }}>
                <i className="fas fa-headset" />
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Overdue</div>
                <div className="admin-stat-num">{queue.overdue.length}</div>
                <p className="admin-stat-meta">Past scheduled follow-ups</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
                <i className="fas fa-exclamation-circle" />
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">Due today</div>
                <div className="admin-stat-num">{queue.dueToday.length}</div>
                <p className="admin-stat-meta">Calls and visits today</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>
                <i className="fas fa-clock" />
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-info">
                <div className="admin-stat-label">New leads</div>
                <div className="admin-stat-num">{queue.newLeads.length}</div>
                <p className="admin-stat-meta">Still at New status</p>
              </div>
              <div className="admin-stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                <i className="fas fa-user-plus" />
              </div>
            </div>
          </div>

          <QueueSection
            title="Overdue"
            hint="Incomplete follow-ups scheduled before today — clear these first."
            items={queue.overdue}
            tone="danger"
            nextChoices={choices}
          />
          <QueueSection
            title="Due today"
            hint="Follow-ups and visits scheduled for today."
            items={queue.dueToday}
            tone="warning"
            nextChoices={choices}
          />
          <QueueSection
            title="New leads"
            hint="Assigned leads still marked New — first contact candidates."
            items={queue.newLeads}
            tone="info"
            nextChoices={choices}
          />
        </div>
      </section>
    </>
  );
}
