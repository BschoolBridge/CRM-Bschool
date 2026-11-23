import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/env";
import { ValidationError, type UploadedFile } from "../forms/fields";

const IMAGE_SIGNATURES: Array<{ ext: string[]; test: (b: Buffer) => boolean }> = [
  { ext: [".jpg", ".jpeg"], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: [".png"], test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: [".gif"], test: (b) => b.subarray(0, 4).toString("ascii") === "GIF8" },
  { ext: [".webp"], test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

/** Profile picture checks: size, declared type, extension and the actual file signature. */
export function validateProfilePicture(file: UploadedFile): UploadedFile {
  const maxMb = config.uploads.maxProfilePicMb;
  if (file.size > maxMb * 1024 * 1024) throw ValidationError.of(`Profile picture too large. Max size is ${maxMb}MB.`);
  if (!file.mimetype.startsWith("image/")) throw ValidationError.of("Invalid file type. Please upload an image.");
  const ext = path.extname(file.originalname).toLowerCase();
  const kind = IMAGE_SIGNATURES.find((s) => s.ext.includes(ext));
  if (!kind) throw ValidationError.of("Unsupported image format. Allowed: JPG, PNG, GIF, WEBP.");
  if (!kind.test(file.buffer)) {
    throw ValidationError.of("Upload a valid image. The file you uploaded was either not an image or a corrupted image.");
  }
  return file;
}

/** Store under MEDIA_ROOT/profile_pics with a random name; returns the relative path saved on the user. */
export async function saveProfilePicture(file: UploadedFile): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  const relative = path.posix.join("profile_pics", `${crypto.randomUUID()}${ext}`);
  const absolute = path.join(config.mediaRoot, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, file.buffer, { mode: 0o640 });
  return relative;
}

export function validateSpreadsheet(file: UploadedFile, { checkMime = false } = {}): UploadedFile {
  const ext = path.extname(file.originalname).toLowerCase();
  if (![".csv", ".xlsx"].includes(ext)) {
    throw ValidationError.of(
      checkMime ? "Unsupported file type. Only .csv and .xlsx files are allowed." : "Only .csv, .xlsx files are allowed.",
    );
  }
  const allowedTypes = new Set([
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  if (checkMime && file.mimetype && !allowedTypes.has(file.mimetype)) {
    throw ValidationError.of("Invalid MIME type for lead import file.");
  }
  const maxMb = config.uploads.maxLeadImportMb;
  if (file.size > maxMb * 1024 * 1024) throw ValidationError.of(`File too large. Max size is ${maxMb}MB.`);
  return file;
}
