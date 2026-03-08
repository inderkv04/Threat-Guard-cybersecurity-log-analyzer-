import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function backendUrl() {
  return process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
}

export async function GET(req: Request) {
  const token = (await cookies()).get("la_auth")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "50";
  const offset = url.searchParams.get("offset") ?? "0";

  const resp = await fetch(`${backendUrl()}/logs?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`, {
    headers: { Authorization: `Basic ${token}` },
    cache: "no-store",
  });

  const text = await resp.text();
  return new NextResponse(text, {
    status: resp.status,
    headers: { "Content-Type": resp.headers.get("Content-Type") ?? "application/json" },
  });
}

