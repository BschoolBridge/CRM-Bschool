export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSessionCleanup } = await import("./src/server/session");
  startSessionCleanup();
  // Hostinger often starts with `next start` (skips npm start). Apply schema on boot.
  const { applyPendingMigrations } = await import("./src/server/apply-migrations");
  void applyPendingMigrations();
}
