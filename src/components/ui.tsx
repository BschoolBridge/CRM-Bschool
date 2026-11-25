import Link from "next/link";
import { templateLookups } from "../modules/reference/reference.service";
import type { Page } from "../lib/pagination";
import { withQuery } from "../http/urls";

const ALERT: Record<string, string> = {
  success: "alert-success",
  error: "alert-danger",
  warning: "alert-warning",
  info: "alert-info",
};

export function FlashList({ messages }: { messages: Array<{ level: string; text: string }> }) {
  if (!messages.length) return null;
  return (
    <div className="container-fluid pt-3">
      {messages.map((message, index) => (
        <div key={`${message.level}-${index}`} className={`alert ${ALERT[message.level] ?? "alert-info"} alert-dismissible`}>
          <button type="button" className="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
          {message.text}
        </div>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="content-header pb-2">
      <div className="container-fluid">
        <div className="row align-items-center">
          <div className="col-sm-6">
            <h1 className="m-0" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
              {title}
            </h1>
            {subtitle ? <p className="text-muted small m-0 mt-1">{subtitle}</p> : null}
          </div>
          <div className="col-sm-6 d-flex align-items-center justify-content-sm-end justify-content-start flex-wrap mt-2 mt-sm-0" style={{ gap: "0.5rem" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  footer,
  tools,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tools?: React.ReactNode;
}) {
  return (
    <div className="card shadow-none">
      {title ? (
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap" style={{ gap: "0.5rem" }}>
          <div>
            <h3 className="card-title font-weight-bold m-0" style={{ fontSize: "0.98rem", color: "#0f172a" }}>
              {title}
            </h3>
            {subtitle ? <p className="text-muted small m-0 mt-1">{subtitle}</p> : null}
          </div>
          {tools ? (
            <div className="card-tools ml-auto m-0 d-flex align-items-center justify-content-end flex-wrap" style={{ gap: "0.5rem" }}>
              {tools}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="card-body">{children}</div>
      {footer ? <div className="card-footer bg-white border-top">{footer}</div> : null}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="text-muted mb-0">{text}</p>;
}

export function Pager<T>({ page, path, query }: { page: Page<T>; path: string; query?: Record<string, string> }) {
  if (!page.has_other_pages) return null;
  const href = (n: number) => withQuery(path, { ...query, page: n });
  const windowStart = Math.max(1, page.number - 2);
  const windowEnd = Math.min(page.paginator.num_pages, page.number + 2);
  const pages = [];
  for (let n = windowStart; n <= windowEnd; n += 1) pages.push(n);
  return (
    <nav aria-label="Pagination">
      <ul className="pagination pagination-sm m-0">
        <li className={`page-item${page.has_previous ? "" : " disabled"}`}>
          {page.has_previous ? (
            <Link className="page-link" href={href(page.previous_page_number)}>
              Previous
            </Link>
          ) : (
            <span className="page-link">Previous</span>
          )}
        </li>
        {pages.map((n) => (
          <li key={n} className={`page-item${n === page.number ? " active" : ""}`}>
            <Link className="page-link" href={href(n)}>
              {n}
            </Link>
          </li>
        ))}
        <li className={`page-item${page.has_next ? "" : " disabled"}`}>
          {page.has_next ? (
            <Link className="page-link" href={href(page.next_page_number)}>
              Next
            </Link>
          ) : (
            <span className="page-link">Next</span>
          )}
        </li>
      </ul>
      <small className="text-muted">
        {page.start_index}–{page.end_index} of {page.paginator.count}
      </small>
    </nav>
  );
}

const BADGE_COLORS = new Set(["primary", "secondary", "success", "danger", "warning", "info", "light", "dark"]);

export async function StatusBadge({ code }: { code: string | null | undefined }) {
  const { lead_status_map } = await templateLookups();
  const info = code ? lead_status_map[code] : undefined;
  if (!info) return <span className="badge badge-secondary">{code || "None"}</span>;
  const color = BADGE_COLORS.has(info.color) ? info.color : "secondary";
  return <span className={`badge badge-${color}`}>{info.name}</span>;
}

export function PriorityBadge({ code }: { code: string | null | undefined }) {
  const color =
    code === "URGENT" || code === "HIGH" ? "danger" : code === "MEDIUM" ? "warning" : code === "LOW" ? "info" : "secondary";
  const label =
    code === "URGENT" ? "Urgent" : code === "HIGH" ? "High" : code === "MEDIUM" ? "Medium" : code === "LOW" ? "Low" : code || "—";
  return <span className={`badge badge-${color}`}>{label}</span>;
}
