export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSessionCleanup } = await import("./src/server/session");
  startSessionCleanup();
  // Hostinger / panel deploys: create first admin from BOOTSTRAP_ADMIN_* env (no SSH needed).
  const { bootstrapAdminFromEnv } = await import("./src/modules/users/bootstrap-admin");
  void bootstrapAdminFromEnv().catch((err) => {
    console.error("bootstrap admin failed", err instanceof Error ? err.message : err);
  });
}
