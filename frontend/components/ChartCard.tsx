"use client";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {subtitle ? <span className="text-xs text-gray-500">{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}
