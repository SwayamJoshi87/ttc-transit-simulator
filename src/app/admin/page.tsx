import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/gtfs/db";
import { feedbackTable } from "@/lib/gtfs/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const ADMIN_PASSWORD = "sway@8735";
const ADMIN_COOKIE_NAME = "ttc-admin-auth";

async function loginAction(formData: FormData) {
  "use server";

  const enteredPassword = String(formData.get("password") ?? "");
  const cookieStore = await cookies();

  if (enteredPassword === ADMIN_PASSWORD) {
    cookieStore.set(ADMIN_COOKIE_NAME, ADMIN_PASSWORD, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    redirect("/admin");
  }

  redirect("/admin?error=1");
}

async function logoutAction() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin");
}

function formatTimestamp(value: Date | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const hasError = params?.error === "1";
  const cookieStore = await cookies();
  const isAuthorized =
    cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_PASSWORD;

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-4">
            <h1 className="text-lg font-semibold">Admin Access</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the admin password to view feedback info.
            </p>
          </div>

          <Separator />

          <form action={loginAction} className="p-4 space-y-3">
            <div>
              <label
                htmlFor="admin-password"
                className="text-xs text-muted-foreground"
              >
                Password
              </label>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter admin password"
                className="mt-1"
              />
            </div>

            {hasError && (
              <p className="text-xs text-destructive">Incorrect password.</p>
            )}

            <Button type="submit" className="w-full">
              Unlock
            </Button>
          </form>
        </div>
      </main>
    );
  }

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
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{feedback.length} total</Badge>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
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
