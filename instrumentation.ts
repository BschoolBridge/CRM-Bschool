export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSessionCleanup } = await import("./src/server/session");
  startSessionCleanup();
}
