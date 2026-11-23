/** Status codes added for MBA counselling. Existing sales codes stay in the database. */
export const ADDED_LEAD_STATUSES = [
  "CONTACT_PENDING",
  "COUNSELLING_SCHEDULED",
  "COUNSELLING_COMPLETED",
  "PROFILE_EVALUATION_PENDING",
  "COLLEGE_SHORTLISTING",
  "APPLICATION_IN_PROGRESS",
  "APPLICATION_SUBMITTED",
  "ADMISSION_OFFERED",
  "CONVERTED",
  "ON_HOLD",
  "DISQUALIFIED",
] as const;

export const PRESERVED_LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "AWAITING_RESPONSE",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
  "TRANSFERRED",
] as const;

export const APPLICATION_STATUSES = [
  "NOT_STARTED",
  "PREPARING",
  "READY_TO_SUBMIT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "INTERVIEW",
  "OFFER_RECEIVED",
  "WAITLISTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const SHORTLIST_STATUSES = ["CONSIDERING", "PREFERRED", "APPLIED", "DROPPED"] as const;

export const UNVERIFIED = "UNVERIFIED";

/** Usual published figure. An attempt may still store a raw score, a scaled score, and a percentile separately. */
export const EXAM_SCORE_KINDS = ["PERCENTILE", "SCALED", "MIXED"] as const;
