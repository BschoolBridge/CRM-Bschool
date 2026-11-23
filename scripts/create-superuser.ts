/**
 * Create (or promote) a CRM super admin — equivalent of `manage.py createsuperuser`.
 *
 *   npm run user:create-superuser -- --email admin@example.com --password 'S3cure!pass' --first Admin --last User
 *
 * Omit --password to be prompted.
 */
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";
import { ensureAdminProfile } from "../src/modules/users/user.service";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    first: { type: "string", default: "" },
    last: { type: "string", default: "" },
  },
});

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  const email = (values.email ?? (await prompt("Email: "))).toLowerCase();
  const password = values.password ?? (await prompt("Password: "));
  if (!email || !password) throw new Error("Email and password are required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash, is_superuser: true, is_staff: true, is_active: true, user_type: "1" },
    create: {
      email,
      password: passwordHash,
      first_name: values.first ?? "",
      last_name: values.last ?? "",
      is_superuser: true,
      is_staff: true,
      user_type: "1",
      gender: "M",
      address: "",
      fcm_token: "",
    },
  });
  await ensureAdminProfile(user.id, true);
  console.log(`Super admin ready: ${user.email} (id ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
