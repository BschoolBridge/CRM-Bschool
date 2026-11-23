import { PostButton } from "@/components/client-form";
import { Card, Empty, PageHeader, Pager } from "@/components/ui";
import { reverse } from "@/http/urls";
import { LIST_PAGE_SIZE, paginate } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { formatDjango } from "@/lib/time";
import { currentCounsellor, requireCounsellor } from "@/server/actor";
import { readSearch, type SearchParams } from "@/server/request";
import { deleteCounsellorNotificationById } from "@/modules/notifications/delete-notifications";

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
      <PageHeader title="Notifications" />
      <section className="content">
        <div className="container-fluid">
          <Card title="My Notifications">
            {notifications.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-bell fa-3x text-muted mb-3" />
                <h4 className="text-muted">No Notifications</h4>
                <Empty text="You have no notifications at the moment." />
              </div>
            ) : (
              <div className="timeline">
                {notifications.map((notification) => (
                  <div key={notification.id}>
                    <div className="time-label">
                      <span className="bg-red">{formatDjango(notification.created_at, "M d, Y")}</span>
                    </div>
                    <div>
                      <i className="fas fa-info bg-blue" />
                      <div className="timeline-item">
                        <span className="time">
                          <i className="fas fa-clock" /> {formatDjango(notification.created_at, "H:i")}
                        </span>
                        <h3 className="timeline-header">Admin Notification</h3>
                        <div className="timeline-body">{notification.message}</div>
                        <div className="timeline-footer">
                          <PostButton
                            action={remove.bind(null, notification.id)}
                            className="btn btn-danger btn-sm"
                            confirm="Are you sure you want to delete this notification?"
                          >
                            <i className="fas fa-trash" /> Delete
                          </PostButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pager page={notifications} path={reverse("counsellor_view_notifications")} />
          </Card>
        </div>
      </section>
    </>
  );
}
