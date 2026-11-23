import { markSafe } from "../../forms/html";

/** Abbreviated list of the most common passwords (Django ships ~20k; these cover real-world reuse). */
const COMMON_PASSWORDS = new Set(
  `123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football
  monkey letmein 696969 shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 pussy superman
  1qaz2wsx 7777777 121212 000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer
  harley batman andrew tigger sunshine iloveyou 2000 charlie robert thomas hockey ranger daniel starwars klaster
  112233 george computer michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie
  159753 aaaaaa ginger princess joshua cheese amanda summer love ashley nicole chelsea biteme matthew access
  yankees 987654321 dallas austin thunder taylor matrix mobilemail mom monitor monitoring montana moon moscow
  admin admin123 password1 password123 qwerty123 welcome welcome1 passw0rd p@ssw0rd abcd1234 india123 india@123
  12341234 87654321 11223344 1q2w3e4r 1q2w3e4r5t qwer1234 changeme default secret letmein1 iloveyou1`
    .split(/\s+/)
    .filter(Boolean),
);

const EXTRA_WEAK = new Set(["password", "12345678", "qwerty123", "admin123", "password123"]);

export const PASSWORD_HELP_TEXT = markSafe(
  "<ul><li>Your password can’t be too similar to your other personal information.</li>" +
    "<li>Your password must contain at least 8 characters.</li>" +
    "<li>Your password can’t be a commonly used password.</li>" +
    "<li>Your password can’t be entirely numeric.</li></ul>",
);

const MAX_SIMILARITY = 0.7;

/** Python's SequenceMatcher.quick_ratio(): shared characters regardless of order. */
function quickRatio(a: string, b: string): number {
  const counts = new Map<string, number>();
  for (const ch of b) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let matches = 0;
  for (const ch of a) {
    const n = counts.get(ch) ?? 0;
    if (n > 0) {
      matches++;
      counts.set(ch, n - 1);
    }
  }
  return (2 * matches) / (a.length + b.length || 1);
}

interface PasswordOwner {
  email: string;
  first_name: string;
  last_name: string;
}

/** Django's default AUTH_PASSWORD_VALIDATORS, returning user-facing messages. */
export function validatePassword(password: string, user: PasswordOwner): string[] {
  const errors: string[] = [];
  const lower = password.toLowerCase();
  const attributes: Array<[string, string]> = [
    [user.email, "email"],
    [user.first_name, "first name"],
    [user.last_name, "last name"],
  ];
  for (const [value, label] of attributes) {
    if (!value) continue;
    const valueLower = value.toLowerCase();
    // Django skips attributes far shorter than the password (exceeds_maximum_length_ratio).
    if (password.length >= 10 * valueLower.length && valueLower.length < (MAX_SIMILARITY / 2) * password.length) continue;
    const parts = [...valueLower.split(/\W+/), valueLower].filter(Boolean);
    if (parts.some((part) => quickRatio(lower, part) >= MAX_SIMILARITY)) {
      errors.push(`The password is too similar to the ${label}.`);
      break;
    }
  }
  if (password.length < 8) errors.push("This password is too short. It must contain at least 8 characters.");
  if (COMMON_PASSWORDS.has(lower.trim())) errors.push("This password is too common.");
  if (/^\d+$/.test(password)) errors.push("This password is entirely numeric.");
  return errors;
}

export function isExtraWeak(password: string): boolean {
  return EXTRA_WEAK.has(password.toLowerCase());
}
