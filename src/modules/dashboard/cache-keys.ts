import { cache } from "../../lib/cache";

export const ADMIN_HOME_CACHE_KEY = "crm:admin_home_dashboard_v2";
export const ACTIVITY_BOARD_CACHE_KEY = "crm:counsellor_activity_board";
export const counsellorSnapshotKey = (counsellorId: number) => `crm:counsellor_activity_snapshot:${counsellorId}`;

/** Admin dashboard aggregates and the activity-progress board depend on lead counts and assignments. */
export function invalidateAdminDashboard(): Promise<void> {
  return Promise.all([cache.delete(ADMIN_HOME_CACHE_KEY), cache.delete(ACTIVITY_BOARD_CACHE_KEY)]).then(() => undefined);
}

export function invalidateCounsellorSnapshot(counsellorId: number): Promise<void> {
  return Promise.all([cache.delete(counsellorSnapshotKey(counsellorId)), cache.delete(ACTIVITY_BOARD_CACHE_KEY)]).then(
    () => undefined,
  );
}
