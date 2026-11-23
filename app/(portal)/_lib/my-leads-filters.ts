import { encodeQuery, field } from "@/http/params";
import { reverse } from "@/http/urls";
import { extractMyLeadFilters, MY_LEADS_FILTER_PARAMS, type MyLeadFilters } from "@/modules/leads/lead.queries";
import { readSession, updateSession } from "@/server/session";

function filtersFrom(source: Record<string, unknown>): MyLeadFilters {
  return extractMyLeadFilters(source as never);
}

function asStored(filters: MyLeadFilters): Record<string, string> {
  const stored: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) if (value) stored[key] = value;
  return stored;
}

/** Session key counsellor_my_leads_filters, same rules as persist_my_leads_filters(). */
export async function persistMyLeadFilters(query: Record<string, string>) {
  const keys = MY_LEADS_FILTER_PARAMS.filter((key) => key !== "page");
  const hasFilter = keys.some((key) => field(query, key));
  if (hasFilter || field(query, "page")) {
    const filters = asStored(filtersFrom(query));
    if (Object.keys(filters).length) {
      await updateSession((data) => {
        data.counsellor_my_leads_filters = filters;
      });
      return;
    }
  }
  await updateSession((data) => {
    delete data.counsellor_my_leads_filters;
  });
}

export function myLeadFiltersFrom(source: Record<string, unknown>): MyLeadFilters {
  return filtersFrom(source);
}

/** Prefer filters on this request; otherwise the session copy from My Leads. */
export async function myLeadsRedirectPath(source?: Record<string, unknown>) {
  const filters = source ? asStored(filtersFrom(source)) : {};
  const session = await readSession();
  const stored = Object.keys(filters).length ? filters : (session.data.counsellor_my_leads_filters ?? {});
  const qs = encodeQuery(stored);
  return reverse("my_leads") + (qs ? `?${qs}` : "");
}
