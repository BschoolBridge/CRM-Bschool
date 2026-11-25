import Link from "next/link";
import { PostButton } from "@/components/client-form";
import { PageHeader } from "@/components/ui";
import { reverse } from "@/http/urls";
import { LIST_PAGE_SIZE, paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { deleteCounsellorNotificationById } from "@/modules/notifications/delete-notifications";
import { presentNotificationMessage } from "@/modules/notifications/notification-display";
import { currentCounsellor, requireCounsellor } from "@/server/actor";
import { readSearch, type SearchParams } from "@/server/request";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

async function remove(id: number) {
  "use server";
  await deleteCounsellorNotificationById(id);
}

export default async function CounsellorNotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireCounsellor();
  const counsellor = await currentCounsellor(user);
  const search = await readSearch(searchParams);
  const where = { counsellor_id: counsellor.id };
  const notifications = await paginate(
    search.page,
    LIST_PAGE_SIZE,
    () => prisma.notificationCounsellor.count({ where }),
    (skip, take) => prisma.notificationCounsellor.findMany({ where, orderBy: { created_at: "desc" }, skip, take }),
  );
  await prisma.notificationCounsellor.updateMany({ where: { ...where, is_read: false }, data: { is_read: true } });

  return (
    <>
      <PageHeader title="Notifications" subtitle="Assignment alerts and admin messages" />
      <section className="content">
        <div className="container-fluid">
          <div className="crm-card">
            <div className="crm-card-header">
              <h3 className="crm-card-title">
                <i className="fas fa-bell crm-card-title-icon" /> My notifications
              </h3>
              <span className="badge badge-light" style={{ padding: "0.35rem 0.65rem", borderRadius: "8px" }}>
                {notifications.paginator.count}
              </span>
            </div>
            <div className="crm-card-body">
              {notifications.length === 0 ? (
                <div className="crm-empty-state">
                  <div className="crm-empty-icon">
                    <i className="far fa-bell" />
                  </div>
                  <div className="crm-empty-title">No notifications</div>
                  <p className="crm-empty-desc">Lead assignments and admin messages will show up here.</p>
                </div>
              ) : (
                <div className="crm-activity-list">
                  {notifications.map((notification) => {
                    const display = presentNotificationMessage(notification.message);
                    const icon =
                      display.kind === "assignment" || display.kind === "bulk_assignment"
                        ? { bg: "#ecfdf5", color: "#059669", icon: "fas fa-user-plus" }
                        : { bg: "#eff6ff", color: "#3157E8", icon: "fas fa-info" };
                    return (
                      <div key={notification.id} className="crm-activity-item">
                        <div className="crm-activity-icon" style={{ background: icon.bg, color: icon.color }}>
                          <i className={icon.icon} />
                        </div>
                        <div className="crm-activity-item-main">
                          <div className="crm-activity-item-top">
                            <div style={{ minWidth: 0 }}>
                              <div className="d-flex align-items-center flex-wrap" style={{ gap: "0.4rem" }}>
                                <span className="crm-activity-lead" style={{ cursor: "default" }}>
                                  {display.title}
                                </span>
                                <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 }}>
                                  {formatDjango(notification.created_at, "M d, Y H:i")}
                                </span>
                              </div>
                              <div className="crm-activity-subject" title={display.body}>
                                {display.body}
                              </div>
                            </div>
                            <div className="crm-activity-actions">
                              {display.href ? (
                                <Link className="btn btn-sm btn-outline-primary" href={display.href}>
                                  Open
                                </Link>
                              ) : null}
                              <PostButton
                                action={remove.bind(null, notification.id)}
                                className="btn btn-sm btn-outline-danger"
                                confirm="Delete this notification?"
                              >
                                Delete
                              </PostButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {notifications.has_other_pages ? (
                <div className="mt-3">
                  <nav aria-label="Pagination">
                    <ul className="pagination pagination-sm m-0">
                      <li className={`page-item${notifications.has_previous ? "" : " disabled"}`}>
                        {notifications.has_previous ? (
                          <Link className="page-link" href={`${reverse("counsellor_view_notifications")}?page=${notifications.previous_page_number}`}>
                            Previous
                          </Link>
                        ) : (
                          <span className="page-link">Previous</span>
                        )}
                      </li>
                      <li className={`page-item${notifications.has_next ? "" : " disabled"}`}>
                        {notifications.has_next ? (
                          <Link className="page-link" href={`${reverse("counsellor_view_notifications")}?page=${notifications.next_page_number}`}>
                            Next
                          </Link>
                        ) : (
                          <span className="page-link">Next</span>
                        )}
                      </li>
                    </ul>
                    <small className="text-muted">
                      {notifications.start_index}–{notifications.end_index} of {notifications.paginator.count}
                    </small>
                  </nav>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
