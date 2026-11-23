import crypto from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(crypto.pbkdf2);

// Same format and work factor Django 4.2 writes, so existing hashes verify as-is.
const ALGORITHM = "pbkdf2_sha256";
const ITERATIONS = 600_000;
const SALT_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSalt(length = 22): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (const b of bytes) out += SALT_ALPHABET[b % SALT_ALPHABET.length];
  return out;
}

async function derive(digest: "sha256" | "sha1", password: string, salt: string, iterations: number) {
  const keyLength = digest === "sha256" ? 32 : 20;
  const key = await pbkdf2(password, salt, iterations, keyLength, digest);
  return key.toString("base64");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomSalt();
  const hash = await derive("sha256", password, salt, ITERATIONS);
  return `${ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsRaw, salt, expected] = (encoded ?? "").split("$");
  const digest = algorithm === "pbkdf2_sha256" ? "sha256" : algorithm === "pbkdf2_sha1" ? "sha1" : null;
  const iterations = Number(iterationsRaw);
  if (!digest || !salt || !expected || !Number.isInteger(iterations) || iterations < 1) return false;

  const actual = await derive(digest, password, salt, iterations);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function passwordNeedsRehash(encoded: string): boolean {
  const [algorithm, iterations] = (encoded ?? "").split("$");
  return algorithm !== ALGORITHM || Number(iterations) < ITERATIONS;
}

let dummyHash: Promise<string> | null = null;

/** Burn the same CPU time as a real check so unknown emails aren't distinguishable by latency. */
export async function simulatePasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}
