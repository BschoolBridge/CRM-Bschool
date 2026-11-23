import type { Prisma } from "../../lib/prisma";
import { prisma } from "../../lib/prisma";
import { formatHumanDateTime } from "../../lib/time";
import { ADMISSION_CALL_STATUS, choiceLabel, presentStudentActivity, presentUser } from "../presenters";
import { counsellorOptions } from "../users/user-options";

export function admissionCounsellorOptions() {
  return counsellorOptions({ is_active: true, can_handle_admission_followup: true }, { admin: { first_name: "asc" } });
}

export function admissionFollowupCounsellors() {
  return prisma.counsellor.findMany({
    where: { is_active: true, can_handle_admission_followup: true },
    include: { admin: true },
    orderBy: { admin: { first_name: "asc" } },
  });
}

export function admittedDueWhere(): Prisma.AdmittedStudentWhereInput {
  return { OR: [{ next_follow_up: { lte: new Date() } }, { next_follow_up: null }] };
}

export function filterAdmittedStudents(opts: {
  search?: string;
  status?: string;
  counsellorId?: string;
  due?: boolean;
  assignedCounsellorId?: number;
}): Prisma.AdmittedStudentWhereInput {
  const and: Prisma.AdmittedStudentWhereInput[] = [];
  if (opts.assignedCounsellorId) and.push({ assigned_counsellor_id: opts.assignedCounsellorId });
  if (opts.search) {
    const contains = { contains: opts.search };
    and.push({ OR: [{ name: contains }, { phone: contains }, { course: contains }] });
  }
  if (opts.status) and.push({ call_status: opts.status });
  if (opts.counsellorId === "none") and.push({ assigned_counsellor_id: null });
  else if (opts.counsellorId && /^\d+$/.test(opts.counsellorId)) and.push({ assigned_counsellor_id: Number(opts.counsellorId) });
  if (opts.due) and.push({ ...admittedDueWhere(), call_status: { not: "COMPLETED" } });
  return and.length ? { AND: and } : {};
}

export async function notifyAdmissionAssignment(student: { name: string; course: string; phone: string }, counsellorId: number | null) {
  if (!counsellorId) return;
  await prisma.notificationCounsellor.create({
    data: {
      counsellor_id: counsellorId,
      message: `Admission follow-up assigned: ${student.name} (${student.course}) — Phone: ${student.phone}`,
    },
  });
}

export async function addStudentRemark(studentId: number, remark: string, userId: number) {
  const text = remark.trim();
  if (!text) return false;
  await prisma.admittedStudentRemark.create({ data: { student_id: studentId, remark: text, created_by_id: userId } });
  return true;
}

export async function studentTimeline(studentId: number, includeAdded: boolean, createdAt: Date) {
  const [activities, remarks] = await Promise.all([
    prisma.admittedStudentActivity.findMany({
      where: { student_id: studentId, activity_type: { not: "STATUS_CHANGE" } },
      include: { counsellor: { include: { admin: true } }, created_by: true },
      orderBy: [{ completed_date: "desc" }, { scheduled_date: "desc" }, { created_at: "desc" }],
    }),
    prisma.admittedStudentRemark.findMany({
      where: { student_id: studentId },
      include: { created_by: true },
      orderBy: { created_at: "asc" },
    }),
  ]);
  const events: Array<{ at: Date; kind: string; activity?: unknown; remark?: unknown }> = [];
  if (includeAdded) events.push({ at: createdAt, kind: "added" });
  for (const activity of activities) {
    presentStudentActivity(activity);
    events.push({
      at: activity.completed_date ?? activity.scheduled_date ?? activity.created_at,
      kind: "call",
      activity,
    });
  }
  for (const remark of remarks) {
    presentUser(remark.created_by);
    events.push({ at: remark.created_at, kind: "remark", remark });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return events;
}

const UNSET = Symbol("unset");
type MaybeDate = Date | null | typeof UNSET;

export async function logAdmittedStudentCall(opts: {
  studentId: number;
  counsellorId: number;
  userId: number;
  notes: string;
  callStatus?: string | null;
  nextFollowUp?: MaybeDate;
  feeDueDate?: MaybeDate;
  documentsDueDate?: MaybeDate;
}) {
  const student = await prisma.admittedStudent.findUniqueOrThrow({ where: { id: opts.studentId } });
  const now = new Date();
  const oldStatus = student.call_status;
  const data: Prisma.AdmittedStudentUncheckedUpdateInput = { last_called_at: now };
  if (opts.callStatus && opts.callStatus !== student.call_status) data.call_status = opts.callStatus;
  if (opts.nextFollowUp !== undefined && opts.nextFollowUp !== UNSET) data.next_follow_up = opts.nextFollowUp;
  if (opts.feeDueDate !== undefined && opts.feeDueDate !== UNSET) data.fee_due_date = opts.feeDueDate;
  if (opts.documentsDueDate !== undefined && opts.documentsDueDate !== UNSET) data.documents_due_date = opts.documentsDueDate;
  await prisma.admittedStudent.update({ where: { id: student.id }, data });

  const parts: string[] = [];
  if (opts.notes.trim()) parts.push(opts.notes.trim());
  if (opts.callStatus && opts.callStatus !== oldStatus) {
    parts.push(
      `Status updated: ${choiceLabel(ADMISSION_CALL_STATUS, oldStatus)} → ${choiceLabel(ADMISSION_CALL_STATUS, opts.callStatus)}`,
    );
  }
  if (opts.nextFollowUp !== undefined && opts.nextFollowUp !== UNSET && opts.nextFollowUp) {
    parts.push(`Next call: ${formatHumanDateTime(opts.nextFollowUp)}`);
  }
  if (opts.feeDueDate !== undefined && opts.feeDueDate !== UNSET && opts.feeDueDate) {
    parts.push(`Fee follow-up date: ${formatHumanDateTime(opts.feeDueDate).split(",")[0]!}`);
  }
  if (opts.documentsDueDate !== undefined && opts.documentsDueDate !== UNSET && opts.documentsDueDate) {
    parts.push(`Documents follow-up date: ${formatHumanDateTime(opts.documentsDueDate).split(",")[0]!}`);
  }

  return prisma.admittedStudentActivity.create({
    data: {
      student_id: student.id,
      counsellor_id: opts.counsellorId,
      activity_type: "CALL",
      subject: "Phone call",
      description: parts.join("\n"),
      completed_date: now,
      is_completed: true,
      is_auto_generated: false,
      created_by_id: opts.userId,
    },
  });
}

