"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    function openFeedback() {
      setOpen(true);
    }

    window.addEventListener("open-feedback-sheet", openFeedback);
    return () => {
      window.removeEventListener("open-feedback-sheet", openFeedback);
    };
  }, []);

  async function submitFeedback() {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setError("Please enter at least a few words.");
      setSuccess(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Could not submit feedback.");
        return;
      }

      setSuccess("Thanks! Your feedback was saved.");
      setMessage("");
    } catch {
      setError("Could not submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="absolute z-[1000]"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        right: "calc(env(safe-area-inset-right, 0px) + 0.75rem)",
      }}
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full bg-background/95 px-3 backdrop-blur shadow-lg md:h-8 md:rounded-md"
            />
          }
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          Feedback
        </SheetTrigger>

        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Share feedback</SheetTitle>
            <SheetDescription>
              Tell us what works and what should improve.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-2">
            <label
              htmlFor="feedback-message"
              className="text-xs text-muted-foreground"
            >
              Your feedback
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your feedback here..."
              className="mt-1 w-full min-h-32 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={2000}
            />
            <div className="mt-1 text-[11px] text-muted-foreground text-right">
              {message.length}/2000
            </div>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            {success && (
              <p className="mt-2 text-xs text-emerald-600">{success}</p>
            )}
          </div>

          <SheetFooter className="pt-0">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={submitFeedback} disabled={isSubmitting}>
              <Send className="h-3.5 w-3.5 mr-1" />
              {isSubmitting ? "Sending..." : "Send feedback"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
