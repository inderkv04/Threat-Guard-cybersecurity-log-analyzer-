"use client";

export type AlertItem = {
  id: number;
  alert_type: string;
  reason: string;
  confidence_score: number | null;
  severity: "high" | "medium" | "low";
  created_at: string | null;
  log_entry_id: number | null;
  entry_preview: null | {
    id: number;
    timestamp: string | null;
    ip_address: string | null;
    url: string | null;
    status_code: number | null;
  };
};

type AlertTableProps = {
  alerts: AlertItem[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  severityFilter: "" | AlertItem["severity"];
  onSeverityFilterChange: (value: "" | AlertItem["severity"]) => void;
  displayIp: (al: AlertItem) => string;
  formatTime: (iso: string | null | undefined) => string;
};

function SeverityBadge({ severity }: { severity: AlertItem["severity"] }) {
  const styles =
    severity === "high"
      ? "bg-red-100 text-red-600"
      : severity === "medium"
        ? "bg-orange-100 text-orange-600"
        : "bg-green-100 text-green-600";
  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${styles}`}>
      {severity.toUpperCase()}
    </span>
  );
}

export function AlertTable({
  alerts,
  searchQuery,
  onSearchChange,
  severityFilter,
  onSeverityFilterChange,
  displayIp,
  formatTime,
}: AlertTableProps) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-6 shadow-md">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Alerts</h3>
          <p className="text-xs text-gray-500">{alerts.length} shown</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search type, reason, IP, URL..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none ring-zinc-200 focus:ring-2 sm:w-72"
          />
          <select
            value={severityFilter}
            onChange={(e) => onSeverityFilterChange(e.target.value as "" | AlertItem["severity"])}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-200 focus:ring-2"
          >
            <option value="">All severity</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="dashboard-grid min-w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="py-3 pr-4">Type</th>
              <th className="py-3 pr-4">Severity</th>
              <th className="py-3 pr-4">Confidence</th>
              <th className="py-3 pr-4">Reason</th>
              <th className="py-3 pr-4">IP</th>
              <th className="py-3 pr-4">URL</th>
              <th className="py-3 pr-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((al, idx) => (
              <tr
                key={al.id}
                className={`border-b border-zinc-100 text-sm transition hover:bg-zinc-50 ${
                  idx % 2 === 1 ? "bg-zinc-50/50" : ""
                }`}
              >
                <td className="font-mono py-3 pr-4 text-sm font-medium text-gray-800">{al.alert_type}</td>
                <td className="py-3 pr-4">
                  <SeverityBadge severity={al.severity} />
                </td>
                <td className="font-mono py-3 pr-4 text-sm text-gray-700">{al.confidence_score != null ? al.confidence_score : "—"}</td>
                <td className="font-mono py-3 pr-4 text-sm text-gray-700">{al.reason}</td>
                <td className="font-mono py-3 pr-4 text-sm text-gray-700">{displayIp(al)}</td>
                <td className="font-mono max-w-[320px] truncate py-3 pr-4 text-sm text-gray-700">
                  {al.entry_preview?.url ?? "—"}
                </td>
                <td className="font-mono py-3 pr-4 text-xs text-gray-500">{formatTime(al.entry_preview?.timestamp ?? al.created_at ?? undefined)}</td>
              </tr>
            ))}
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                  No alerts match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
