import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const expectedUser = process.env.APP_USER ?? "";
  const expectedPass = process.env.APP_PASS ?? "";

  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { error: "Server not configured (APP_USER/APP_PASS)" },
      { status: 500 },
    );
  }

  if (username !== expectedUser || password !== expectedPass) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");

  const res = NextResponse.json({ ok: true });
  res.cookies.set("la_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}

