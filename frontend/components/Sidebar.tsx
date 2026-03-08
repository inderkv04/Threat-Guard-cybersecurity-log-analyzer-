"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload, History } from "lucide-react";

export type UploadItem = {
  id: number;
  filename: string;
  upload_time: string | null;
  user_id: number | null;
};

type SidebarProps = {
  uploads: UploadItem[];
  selectedId: number | null;
  onSelectUpload: (id: number) => void;
};

export function Sidebar({ uploads, selectedId, onSelectUpload }: SidebarProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const isUpload = pathname === "/upload";

  const activeSlate = "bg-[#444D58] text-white";
  const inactiveLink = "text-gray-500 hover:bg-white/60 hover:text-gray-800";
  const activeRounding = "rounded-l-none rounded-r-lg";

  return (
    <aside className="flex min-h-full w-64 flex-col border-r border-zinc-200 bg-[#E5E4E2] p-6">
      <div className="text-2xl font-semibold tracking-tight text-gray-800">Threat Guard</div>

      <nav className="mt-8 space-y-1">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition ${isDashboard ? `${activeSlate} ${activeRounding}` : `rounded-lg ${inactiveLink}`}`}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" strokeWidth={isDashboard ? 2.5 : 2} />
          Dashboard
        </Link>
        <Link
          href="/upload"
          className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition ${isUpload ? `${activeSlate} ${activeRounding}` : `rounded-lg ${inactiveLink}`}`}
        >
          <Upload className="h-5 w-5 shrink-0" strokeWidth={isUpload ? 2.5 : 2} />
          Upload
        </Link>
      </nav>

      <div className="mt-8">
        <div className="flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <History className="h-4 w-4" />
          Upload History
        </div>
        <div className="mt-2 max-h-[calc(100vh-20rem)] space-y-1 overflow-y-auto">
          {uploads.map((u) => {
            const active = selectedId === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUpload(u.id)}
                className={`w-full px-3 py-2.5 text-left text-sm transition ${
                  active ? `${activeSlate} ${activeRounding}` : `rounded-lg text-gray-500 hover:bg-white/60 hover:text-gray-800`
                }`}
              >
                <div className="truncate font-medium">{u.filename}</div>
                <div className={`truncate text-xs ${active ? "text-white/80" : "text-gray-400"}`}>
                  #{u.id} {u.upload_time ? `• ${u.upload_time}` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
