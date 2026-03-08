"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sidebar } from "@/components/Sidebar";
import { MetricCard } from "@/components/MetricCard";
import { ChartCard } from "../../components/ChartCard";
import { TopAlerts } from "@/components/TopAlerts";
import { AlertTable, type AlertItem } from "@/components/AlertTable";

type UploadItem = {
  id: number;
  filename: string;
  upload_time: string | null;
  user_id: number | null;
};

type UploadsResponse = {
  items: UploadItem[];
};

type Summary = {
  log_id: number;
  filename: string;
  entries_total: number;
  alerts_total: number;
  alerts_by_severity: { high: number; medium: number; low: number };
  alerts_by_type: { alert_type: string; count: number }[];
  top_ips_by_alerts: { ip_address: string; alert_count: number }[];
  time_range: { min: string | null; max: string | null };
};

type AlertsResponse = {
  total: number;
  alerts: AlertItem[];
};

export default function DashboardPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"" | AlertItem["severity"]>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await fetch("/api/logs", { cache: "no-store" });
      if (!resp.ok) {
        setLoading(false);
        return;
      }
      const data = (await resp.json()) as UploadsResponse;
      if (cancelled) return;
      setUploads(data.items ?? []);
      setSelectedId((data.items?.[0]?.id ?? null) as number | null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      const [s, a] = await Promise.all([
        fetch(`/api/logs/${selectedId}/summary`, { cache: "no-store" }),
        fetch(`/api/logs/${selectedId}/alerts`, { cache: "no-store" }),
      ]);
      if (!s.ok || !a.ok) return;
      const sData = (await s.json()) as Summary;
      const aData = (await a.json()) as AlertsResponse;
      if (cancelled) return;
      setSummary(sData);
      setAlerts(aData.alerts ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((al) => {
      if (severity && al.severity !== severity) return false;
      if (!q) return true;
      const hay = [
        al.alert_type,
        al.reason,
        al.entry_preview?.ip_address ?? "",
        al.entry_preview?.url ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [alerts, query, severity]);

  const severityChart = useMemo(() => {
    const s = summary?.alerts_by_severity;
    if (!s) return [];
    return [
      { name: "High", count: s.high },
      { name: "Medium", count: s.medium },
      { name: "Low", count: s.low },
    ];
  }, [summary]);

  function displayIp(al: AlertItem): string {
    if (al.entry_preview?.ip_address) return al.entry_preview.ip_address;
    const match = al.reason?.match(/\s+from\s+(.+)$/);
    const parsed = match ? match[1].trim() : "";
    // "single IP" is the default placeholder text, not a real address
    if (!parsed || parsed.toLowerCase() === "single ip") return "—";
    return parsed;
  }

  function formatAlertTime(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    } catch {
      return iso;
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900">
      <div className="flex min-h-screen">
        <div className="hidden md:block md:min-h-full">
          <Sidebar
            uploads={uploads}
            selectedId={selectedId}
            onSelectUpload={setSelectedId}
          />
        </div>

        <main className="flex-1 px-4 py-6 md:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-800">
                Threat Detection Dashboard
              </h1>
              <p className="mt-1 text-base text-gray-600">
                Turn raw logs into actionable security insights.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {loading ? "Loading..." : selectedId != null ? `Log ID: ${selectedId}` : ""}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-zinc-50"
              >
                Logout
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 md:hidden"
              >
                Back
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard accent="amber" title="Alerts" value={summary?.alerts_total ?? "—"} />
            <MetricCard accent="red" title="High severity" value={summary?.alerts_by_severity?.high ?? "—"} />
            <MetricCard accent="orange" title="Medium severity" value={summary?.alerts_by_severity?.medium ?? "—"} />
            <MetricCard accent="green" title="Low severity" value={summary?.alerts_by_severity?.low ?? "—"} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Threat Risk Distribution">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityChart} margin={{ top: 10, right: 10, left: 10, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} label={{ value: "Severity Level", position: "insideBottom", offset: -20, fill: "#6b7280", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} label={{ value: "Alert Count", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {severityChart.map((_, index) => {
                        const colors = ["#dc2626", "#FF7043", "#4ade80"];
                        return <Cell key={index} fill={colors[index] ?? "#94a3b8"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <TopAlerts items={summary?.alerts_by_type ?? []} maxItems={10} />
          </div>

          <div className="mt-6">
            <AlertTable
              alerts={filteredAlerts}
              searchQuery={query}
              onSearchChange={setQuery}
              severityFilter={severity}
              onSeverityFilterChange={setSeverity}
              displayIp={displayIp}
              formatTime={formatAlertTime}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
