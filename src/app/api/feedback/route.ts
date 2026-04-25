import { db } from "@/lib/gtfs/db";
import { feedbackTable } from "@/lib/gtfs/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string };
    const message = body.message?.trim() ?? "";

    if (message.length < 3) {
      return Response.json(
        { error: "Feedback must be at least 3 characters." },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return Response.json({ error: "Feedback is too long." }, { status: 400 });
    }

    await db.insert(feedbackTable).values({ message });

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Failed to save feedback." },
      { status: 500 },
    );
  }
}
