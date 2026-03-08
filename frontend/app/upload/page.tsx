"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Upload as UploadIcon } from "lucide-react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [lastLogId, setLastLogId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const accept = ".txt,.log";

  const onUpload = useCallback(async () => {
    if (!file) {
      setStatus("error");
      setMessage("Please select a .txt or .log file before uploading.");
      return;
    }
    setStatus("uploading");
    setMessage("");
    try {
      const fd = new FormData();
      fd.set("file", file, file.name);
      const resp = await fetch("/api/logs/upload", { method: "POST", body: fd });
      const data = (await resp.json().catch(() => null)) as
        | {
            log_id?: number;
            filename?: string;
            status?: string;
            entries_created?: number;
            alerts_created?: number;
            detail?: string;
          }
        | null;
      if (!resp.ok) throw new Error(data?.detail || "Upload failed");
      setLastLogId(typeof data?.log_id === "number" ? data.log_id : null);
      const accepted = resp.status === 202;
      setMessage(
        accepted
          ? "Upload accepted. Processing in the background. You can go to the dashboard and refresh to see results."
          : `Uploaded ${data?.filename ?? file.name}. Entries: ${data?.entries_created ?? "?"}, Alerts: ${data?.alerts_created ?? "?"}`,
      );
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Upload failed");
    }
  }, [file]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f && (f.name.endsWith(".txt") || f.name.endsWith(".log"))) setFile(f);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Threat Guard</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-800">Upload</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload a <code className="rounded bg-zinc-200 px-1">.txt</code> or{" "}
              <code className="rounded bg-zinc-200 px-1">.log</code> file. Detection runs automatically after upload.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-zinc-100 bg-white p-6 shadow-md">
          <p className="text-lg font-semibold text-gray-800">Log file</p>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition ${
              isDragging ? "border-emerald-400 bg-emerald-50/50" : "border-zinc-200 hover:bg-gray-50"
            }`}
          >
            <UploadIcon className="h-12 w-12 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-700">
              Drag and drop your log file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">Accepts .txt and .log files only</p>
            <label className="mt-4 cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800">
              <span>Choose file</span>
              <input
                type="file"
                accept={accept}
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <p className="mt-3 text-sm text-gray-600">
                Selected: <span className="font-medium">{file.name}</span>
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onUpload}
            disabled={status === "uploading" || !file}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-700"
          >
            {status === "uploading" ? "Uploading..." : "Upload"}
          </button>

          {message ? (
            <div
              className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
                status === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-zinc-200 bg-zinc-50 text-gray-700"
              }`}
            >
              {message}
              {lastLogId ? (
                <div className="mt-2">
                  <Link
                    className="font-semibold text-emerald-700 hover:underline"
                    href="/dashboard"
                  >
                    Go to dashboard
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
