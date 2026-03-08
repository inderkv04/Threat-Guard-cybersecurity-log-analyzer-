"use client";

type AlertTypeRow = {
  alert_type: string;
  count: number;
};

type TopAlertsProps = {
  items: AlertTypeRow[];
  maxItems?: number;
};

export function TopAlerts({ items, maxItems = 10 }: TopAlertsProps) {
  const list = items.slice(0, maxItems);

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-6 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Most Frequent Threat Types</h3>
      </div>
      <div className="space-y-3">
        {list.map((r) => (
          <div key={r.alert_type} className="flex items-center justify-between gap-4">
            <span className="font-mono min-w-0 flex-1 truncate text-sm text-gray-700">{r.alert_type}</span>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {r.count}
            </span>
          </div>
        ))}
        {list.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-500">No alerts.</div>
        ) : null}
      </div>
    </div>
  );
}
