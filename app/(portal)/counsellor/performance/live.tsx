"use client";

import { useEffect, useState } from "react";

export interface PerformanceRow {
  counsellor_id: number;
  first_name: string;
  last_name: string;
  employee_id: string;
  total_leads_assigned: number;
  total_leads_contacted: number;
  total_leads_qualified: number;
  converted_leads: number;
  average_response_time: number | string | null;
  conversion_rate: number | string;
}

function rate(value: number | string, digits: number): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : String(value);
}

function responseTime(value: number | string | null): string {
  return value == null ? "0" : String(value);
}

export function PerformanceLive({ initialRows, pollUrl }: { initialRows: PerformanceRow[]; pollUrl: string }) {
  const [rows, setRows] = useState(initialRows);
  const [status, setStatus] = useState("Updating every 15s…");
  const [isError, setIsError] = useState(false);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      setSpinning(true);
      try {
        const response = await fetch(pollUrl, {
          method: "GET",
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error("Session may have expired or you were redirected. Reload the page.");
        }
        const body = (await response.json()) as { rows?: PerformanceRow[]; updated_at?: string; error?: string };
        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        if (!Array.isArray(body.rows)) {
          if (!cancelled) {
            setIsError(true);
            setStatus("Could not refresh metrics (unexpected response). Try reloading the page.");
          }
          return;
        }
        if (cancelled) return;
        setRows(body.rows);
        setIsError(false);
        const updated = body.updated_at ? new Date(body.updated_at) : null;
        setStatus(updated && !Number.isNaN(updated.getTime()) ? `Updated ${updated.toLocaleString()}` : "");
      } catch (err) {
        if (!cancelled) {
          setIsError(true);
          setStatus(err instanceof Error ? err.message : "Could not refresh metrics.");
        }
      } finally {
        if (!cancelled) setSpinning(false);
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollUrl]);

  function exportReport() {
    const header = "Counsellor,Employee ID,Total Leads,Leads Contacted,Leads Qualified,Converted Leads (Month),Conversion Rate\n";
    const csv =
      header +
      rows
        .map((row) => {
          const name = `${row.first_name || ""} ${row.last_name || ""}`.trim().replace(/"/g, '""');
          return `"${name}",${row.employee_id},${row.total_leads_assigned},${row.total_leads_contacted},${row.total_leads_qualified},${row.converted_leads},${rate(row.conversion_rate, 2)}%`;
        })
        .join("\n") +
      (rows.length ? "\n" : "");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "counsellor_performance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Counsellor Performance Overview</h3>
        <div className="card-tools d-flex align-items-center flex-wrap">
          <span className="badge badge-success mr-2 mb-1">
            <i className={`fas fa-sync-alt${spinning ? " fa-spin" : ""} mr-1`} />
            Live
          </span>
          <small className={`${isError ? "text-danger" : "text-muted"} mr-3 mb-1`}>{status}</small>
          <button type="button" className="btn btn-primary mb-1" onClick={exportReport}>
            <i className="fas fa-download" /> Export Report
          </button>
        </div>
      </div>
      <div className="card-body">
        {rows.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-chart-bar fa-3x text-muted mb-3" />
            <h4 className="text-muted">No Performance Data Available</h4>
            <p className="text-muted mb-0">Performance data will appear here once active counsellors are available.</p>
          </div>
        ) : (
          <div className="row">
            {rows.map((row) => (
              <div className="col-md-6 col-lg-4" key={row.counsellor_id}>
                <div className="performance-card" data-counsellor-id={row.counsellor_id}>
                  <div className="performance-header">
                    <h5 className="mb-0">
                      <i className="fas fa-user-tie mr-2" />
                      {row.first_name} {row.last_name}
                    </h5>
                    <small>{row.employee_id}</small>
                  </div>
                  <div className="performance-body">
                    <div className="metric-item">
                      <span className="metric-label">Total Leads Assigned:</span>
                      <span className="metric-value">{row.total_leads_assigned}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Leads Contacted:</span>
                      <span className="metric-value">{row.total_leads_contacted}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Leads Qualified:</span>
                      <span className="metric-value">{row.total_leads_qualified}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Converted Leads This Month:</span>
                      <span className="metric-value">{row.converted_leads}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Avg Response Time:</span>
                      <span className="metric-value">{responseTime(row.average_response_time)}h</span>
                    </div>
                    <div className="conversion-rate">{rate(row.conversion_rate, 1)}% Conversion Rate</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
