/** Canonical lead sources for inbound website webhook leads. */
export const WEBSITE_SOURCE_ENQUIRY = "Website enquiry form";
export const WEBSITE_SOURCE_CONTACTS = "Website Contacts";
export const WEBSITE_SOURCE_LEGACY = "Website Form";
export const WEBSITE_SOURCE_ALL = [WEBSITE_SOURCE_ENQUIRY, WEBSITE_SOURCE_CONTACTS] as const;
export const WEBSITE_WEBHOOK_SOURCE_DESCRIPTION = "Inbound leads from website form webhook";

export function websiteLeadSourceLabel(): string {
  return `${WEBSITE_SOURCE_ENQUIRY} and ${WEBSITE_SOURCE_CONTACTS}`;
}

export function websiteLeadSourceNames(): string[] {
  return [...WEBSITE_SOURCE_ALL, WEBSITE_SOURCE_LEGACY];
}
