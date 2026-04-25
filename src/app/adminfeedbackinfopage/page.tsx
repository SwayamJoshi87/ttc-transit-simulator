import { desc } from "drizzle-orm";
import { db } from "@/lib/gtfs/db";
import { feedbackTable } from "@/lib/gtfs/schema";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export const dynamic = "force-dynamic";

function formatTimestamp(value: Date | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminFeedbackInfoPage() {
  const feedback = await db
    .select({
      id: feedbackTable.id,
      message: feedbackTable.message,
      createdAt: feedbackTable.createdAt,
    })
    .from(feedbackTable)
    .orderBy(desc(feedbackTable.createdAt));

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-4xl rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between gap-2 p-4">
          <div>
            <h1 className="text-lg font-semibold">Feedback Admin</h1>
            <p className="text-sm text-muted-foreground">
              Review feedback submitted by users.
            </p>
          </div>
          <Badge variant="secondary">{feedback.length} total</Badge>
        </div>

        <Separator />

        <ScrollArea className="h-[70vh]">
          <div className="p-4 space-y-3">
            {feedback.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            ) : (
              feedback.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border bg-background p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline">#{item.id}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {item.message}
                  </p>
                </article>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}
