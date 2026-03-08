"use client";

import { ReactNode } from "react";

export type MetricCardAccent = "neutral" | "amber" | "red" | "orange" | "green";

const accentStyles: Record<MetricCardAccent, { bg: string; title: string; value: string }> = {
  neutral: { bg: "bg-zinc-500", title: "text-white", value: "text-white" },
  amber: { bg: "bg-[#59A0FF]", title: "text-white", value: "text-white" },
  red: { bg: "bg-[#dc2626]", title: "text-white", value: "text-white" },
  orange: { bg: "bg-[#FF7043]", title: "text-white", value: "text-white" },
  green: { bg: "bg-green-400", title: "text-white", value: "text-white" },
};

type MetricCardProps = {
  title: string;
  value: string | number;
  sub?: string;
  accent?: MetricCardAccent;
  icon?: ReactNode;
  onClick?: () => void;
};

export function MetricCard({
  title,
  value,
  sub,
  accent = "neutral",
  icon,
  onClick,
}: MetricCardProps) {
  const { bg, title: titleClass, value: valueClass } = accentStyles[accent];

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl p-6 shadow-md transition hover:shadow-lg ${bg}`}
    >
      <div className="flex items-center justify-between">
        <div className={`text-sm font-semibold ${titleClass}`}>{title}</div>
        {icon}
      </div>

      <div className={`mt-2 text-4xl font-bold tracking-tight ${valueClass}`}>
        {value}
      </div>

      {sub ? <div className={`mt-1 text-xs ${titleClass} opacity-90`}>{sub}</div> : null}
    </div>
  );
}