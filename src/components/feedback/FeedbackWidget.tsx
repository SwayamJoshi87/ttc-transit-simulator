"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const PROMPTS = [
  "Something broken?",
  "Missing a feature?",
  "General thoughts?",
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    function openFeedback() {
      setOpen(true);
    }
    window.addEventListener("open-feedback-sheet", openFeedback);
    return () =>
      window.removeEventListener("open-feedback-sheet", openFeedback);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTimeout(() => {
        setMessage("");
        setError(null);
        setSubmitted(false);
      }, 300);
    }
  }

  async function submitFeedback() {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setError("Please enter at least a few words.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

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

      setSubmitted(true);
      setMessage("");
    } catch {
      setError("Could not submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="absolute z-[1000] flex items-center gap-2"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
        right: "calc(env(safe-area-inset-right, 0px) + 0.75rem)",
      }}
    >
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-full bg-background/95 px-3 backdrop-blur shadow-lg md:h-8 md:rounded-md"
        onClick={() => window.dispatchEvent(new Event("open-tutorial"))}
      >
        <BookOpen className="h-3.5 w-3.5 mr-1" />
        Tutorial
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
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

        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Share feedback</SheetTitle>
            <SheetDescription>
              Help shape the simulator — bugs, ideas, or anything on your mind.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 px-4 flex flex-col gap-4">
            {submitted ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="font-medium">Thanks for your feedback!</p>
                <p className="text-sm text-muted-foreground">
                  We read everything and use it to improve the simulator.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setMessage((prev) =>
                          prev ? prev : p.replace("?", ": "),
                        )
                      }
                      className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Tell us what's on your mind..."
                    className="w-full min-h-40 resize-none rounded-lg border bg-muted/40 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between">
                    {error ? (
                      <p className="text-xs text-destructive">{error}</p>
                    ) : (
                      <span />
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {message.length}/2000
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-auto">
                  <Button
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={submitFeedback} disabled={isSubmitting}>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {isSubmitting ? "Sending…" : "Send feedback"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
