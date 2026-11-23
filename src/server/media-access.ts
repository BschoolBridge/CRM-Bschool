/** Profile pictures are the only files this app stores under the media root. */

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export function profilePictureKey(parts: string[]): string | null {
  if (parts.length !== 2 || parts[0] !== "profile_pics") return null;
  const file = parts[1] ?? "";
  if (!file || file === "." || file === ".." || file.includes("/") || file.includes("\\") || file.includes("\0")) return null;
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot).toLowerCase() : "";
  if (!IMAGE_EXT.has(ext)) return null;
  return `profile_pics/${file}`;
}

/** Owner, or an admin. A counsellor cannot read another person's picture. */
export function canReadProfilePicture(viewer: { id: number; user_type: string }, ownerId: number | null): boolean {
  if (ownerId === null) return false;
  if (viewer.id === ownerId) return true;
  return viewer.user_type === "1";
}
