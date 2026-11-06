import { connection } from "next/server";
import { loginAccount, logoutAccount, registerAccount, saveAccount, sessionAccount } from "@/lib/account-file";
import type { AppData } from "@/lib/types";

export const runtime = "nodejs";

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as {
    action?: string;
    name?: string;
    password?: string;
    token?: string;
    data?: AppData;
  };
  try {
    if (body.action === "register") {
      if (!body.data) return fail("Missing home data.");
      return Response.json(await registerAccount({ name: body.name || "", password: body.password || "", data: body.data }));
    }
    if (body.action === "login") {
      return Response.json(await loginAccount({ name: body.name || "", password: body.password || "" }));
    }
    if (body.action === "session") {
      if (!body.token) return fail("Sign in again.");
      return Response.json(await sessionAccount(body.token));
    }
    if (body.action === "save") {
      if (!body.token || !body.data) return fail("Sign in again.");
      return Response.json(await saveAccount(body.token, body.data));
    }
    if (body.action === "logout") {
      if (!body.token) return Response.json({ ok: true });
      return Response.json(await logoutAccount(body.token));
    }
    return fail("Unknown action.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update the account.");
  }
}
