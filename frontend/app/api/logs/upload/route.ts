import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function backendUrl() {
  return process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
}

export async function POST(req: Request) {
  const token = (await cookies()).get("la_auth")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const out = new FormData();
  out.set("file", file, file.name);

  const resp = await fetch(`${backendUrl()}/logs/upload`, {
    method: "POST",
    headers: { Authorization: `Basic ${token}` },
    body: out,
  });

  const text = await resp.text();
  return new NextResponse(text, {
    status: resp.status,
    headers: { "Content-Type": resp.headers.get("Content-Type") ?? "application/json" },
  });
}

