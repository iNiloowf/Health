import { connection } from "next/server";
import { createHome, joinHome, leaveHome, pushHome, readHome } from "@/lib/home-file";
import type { ActivityEntry, Occurrence, OnboardingAnswers, Task } from "@/lib/types";

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  await connection();
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const home = await readHome(code);
  if (!home) return fail("No home with that code.", 404);
  return Response.json(home);
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as {
    action?: string;
    code?: string;
    name?: string;
    memberId?: string;
    tasks?: Task[];
    occurrences?: Occurrence[];
    droppedTaskIds?: string[];
    onboarding?: OnboardingAnswers | null;
    activity?: ActivityEntry[];
  };
  try {
    if (body.action === "create") {
      if (!body.memberId) return fail("Missing member.");
      return Response.json(await createHome({
        name: body.name || "Me",
        memberId: body.memberId,
        tasks: body.tasks ?? [],
        occurrences: body.occurrences ?? [],
        onboarding: body.onboarding ?? null,
        activity: body.activity ?? [],
      }));
    }
    if (body.action === "join") {
      if (!body.code || !body.memberId) return fail("Enter the code.");
      return Response.json(await joinHome({ code: body.code, name: body.name || "Me", memberId: body.memberId }));
    }
    if (body.action === "push") {
      if (!body.code || !body.memberId) return fail("Missing home.");
      return Response.json(await pushHome({
        code: body.code,
        memberId: body.memberId,
        name: body.name || "Me",
        tasks: body.tasks ?? [],
        occurrences: body.occurrences ?? [],
        droppedTaskIds: body.droppedTaskIds ?? [],
        onboarding: body.onboarding ?? null,
        activity: body.activity ?? [],
      }));
    }
    if (body.action === "leave") {
      if (!body.code || !body.memberId) return fail("Missing home.");
      await leaveHome({ code: body.code, memberId: body.memberId });
      return Response.json({ ok: true });
    }
    return fail("Unknown action.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update the shared home.");
  }
}
