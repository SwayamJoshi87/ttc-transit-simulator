import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Lock, LogOut, MessageSquare } from "lucide-react";
import { db } from "@/lib/gtfs/db";
import { feedbackTable } from "@/lib/gtfs/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_COOKIE_NAME = "ttc-admin-auth";

async function loginAction(formData: FormData) {
  "use server";
  const entered = String(formData.get("password") ?? "");
  const cookieStore = await cookies();
  if (entered === ADMIN_PASSWORD) {
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
  const now = Date.now();
  const diff = now - value.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
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
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-2">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-1">
              <Lock className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <h1 className="text-base font-semibold">Admin Access</h1>
            <p className="text-sm text-muted-foreground">
              Enter the password to view submitted feedback.
            </p>
          </div>

          <Separator />

          <form action={loginAction} className="px-6 py-5 space-y-3">
            <Input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
            />
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
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Feedback</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              User-submitted feedback for the TTC Simulator.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {feedback.length} {feedback.length === 1 ? "entry" : "entries"}
            </Badge>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Log out
              </Button>
            </form>
          </div>
        </div>

        <Separator />

        {/* Feedback list */}
        {feedback.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">No feedback yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Submitted feedback will appear here once users start sending it in.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border bg-card p-4 space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    #{item.id}
                  </span>
                  <span
                    className="text-xs text-muted-foreground"
                    title={item.createdAt?.toISOString()}
                  >
                    {formatTimestamp(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {item.message}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
