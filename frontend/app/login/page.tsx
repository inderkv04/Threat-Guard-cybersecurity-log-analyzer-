"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Status = "idle" | "loading" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  const disabled = useMemo(() => {
    return status === "loading" || !username.trim() || !password;
  }, [status, username, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Login failed");
      }
      router.replace("/dashboard");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Login failed");
      return;
    }
    setStatus("idle");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="text-xs font-semibold tracking-widest text-emerald-700">
              THREAT GUARD
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Use your admin username and password to access uploads and alerts.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-200 focus:ring-4"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                type="password"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-200 focus:ring-4"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={disabled}
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-emerald-700"
            >
              {status === "loading" ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-xs text-zinc-500">
            Tip: If you changed backend credentials, update `APP_USER` / `APP_PASS`
            in your frontend environment too.
          </div>
        </div>
      </div>
    </div>
  );
}

