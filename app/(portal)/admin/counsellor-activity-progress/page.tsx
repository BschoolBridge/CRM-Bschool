import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui";
import { reverse, withQuery } from "@/http/urls";
import { prisma } from "@/lib/prisma";
import { counsellorProgressBoard } from "@/modules/dashboard/targets.service";
import { requireSuperadmin } from "@/server/actor";

export const metadata = { title: "Counsellor Activity Progress" };

export default async function CounsellorActivityProgressPage() {
  await requireSuperadmin();
  const counsellors = await prisma.counsellor.findMany({
    where: { is_active: true },
    include: { admin: true },
    orderBy: [{ admin: { first_name: "asc" } }, { admin: { last_name: "asc" } }],
  });
  const progressRows = await counsellorProgressBoard(counsellors.map((counsellor) => counsellor.id));
  const progressById = new Map(progressRows.map((row) => [row.counsellor_id, row]));
  const rows = counsellors.map((counsellor) => ({
    counsellor,
    progress: progressById.get(counsellor.id) ?? {
      counsellor_id: counsellor.id,
      daily_target: 0,
      completed_toward_target: 0,
      target_progress_pct: 0,
      pending_activities: 0,
      visits_overdue: 0,
      visits_scheduled: 0,
      visits_today: 0,
      contact_touchpoints_today: 0,
      follow_up_activities_today: 0,
      new_leads_today: 0,
      leads_worked_today: 0,
      contacted_updates_today: 0,
    },
  }));

  return (
    <>
      <PageHeader title="Counsellor Activity Progress" />
      <style>{`
        .cap-row { border-bottom: 1px solid #dee2e6; padding: 0.85rem 0; }
        .cap-row:last-child { border-bottom: none; }
        .cap-metric { display: inline-block; margin-right: 1rem; font-size: 0.875rem; color: #6c757d; }
        .cap-metric strong { color: #212529; }
        .cap-progress { height: 8px; border-radius: 4px; }
      `}</style>
      <section className="content">
        <div className="container-fluid">
          <Card
            title={
              <>
                <i className="fas fa-user-check" /> Counsellor activity progress
              </>
            }
            tools={
              <Link href={reverse("manage_daily_targets")} className="btn btn-sm btn-default">
                Daily targets
              </Link>
            }
          >
            <p className="text-muted small mb-3">
              Today’s done count uses the same rules as <strong>Daily Targets</strong> and each counsellor’s <em>Today’s Target</em> page. Expand a row for the full breakdown.
            </p>
            {rows.length === 0 ? (
              <Empty text="No active counsellors." />
            ) : (
              rows.map(({ counsellor, progress }) => (
                <div className="cap-row" key={counsellor.id}>
                  <div className="row align-items-center">
                    <div className="col-lg-3 mb-2 mb-lg-0">
                      <strong>
                        {counsellor.admin.first_name} {counsellor.admin.last_name}
                      </strong>
                      <div className="mt-1">
                        <Link href={reverse("counsellor_detail", counsellor.id)} className="btn btn-xs btn-outline-primary btn-sm">
                          View
                        </Link>{" "}
                        <Link
                          href={withQuery(reverse("counsellor_work_view"), { counsellor: counsellor.id })}
                          className="btn btn-xs btn-outline-secondary btn-sm"
                        >
                          Activities
                        </Link>
                      </div>
                    </div>
                    <div className="col-lg-6 mb-2 mb-lg-0">
                      <div className="d-flex justify-content-between small mb-1">
                        <span>
                          <strong className="text-success">{progress.completed_toward_target}</strong> / {progress.daily_target} toward target
                        </span>
                        <span>{progress.target_progress_pct}%</span>
                      </div>
                      <div className="progress cap-progress">
                        <div className="progress-bar bg-success" style={{ width: `${progress.target_progress_pct}%` }} />
                      </div>
                    </div>
                    <div className="col-lg-3 text-lg-right">
                      {progress.pending_activities ? <span className="badge badge-warning">Pending {progress.pending_activities}</span> : null}{" "}
                      {progress.visits_overdue ? (
                        <span className="badge badge-danger">Overdue {progress.visits_overdue}</span>
                      ) : (
                        <span className="badge badge-light border">Overdue 0</span>
                      )}
                    </div>
                  </div>
                  <p className="mb-0 mt-2">
                    <a className="small" data-toggle="collapse" href={`#cap-detail-${counsellor.id}`} aria-expanded="false">
                      <i className="fas fa-chevron-down" /> Breakdown
                    </a>
                  </p>
                  <div className="collapse mt-2" id={`cap-detail-${counsellor.id}`}>
                    <div className="bg-light rounded p-2 small">
                      <span className="cap-metric">
                        Contact <strong>{progress.contact_touchpoints_today}</strong>
                      </span>
                      <span className="cap-metric">
                        Follow-up <strong>{progress.follow_up_activities_today}</strong>
                      </span>
                      <span className="cap-metric">
                        New leads <strong>{progress.new_leads_today}</strong>
                      </span>
                      <span className="cap-metric">
                        Worked <strong>{progress.leads_worked_today}</strong>
                      </span>
                      <span className="cap-metric">
                        Cont. leads <strong>{progress.contacted_updates_today}</strong>
                      </span>
                      <span className="cap-metric">
                        Visits set <strong>{progress.visits_scheduled}</strong>
                      </span>
                      <span className="cap-metric">
                        Visit today <strong>{progress.visits_today}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </section>
    </>
  );
}
