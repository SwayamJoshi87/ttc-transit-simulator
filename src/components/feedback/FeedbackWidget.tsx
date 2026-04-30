"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) handleOpenChange(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    <>
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

        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full bg-background/95 px-3 backdrop-blur shadow-lg md:h-8 md:rounded-md"
          onClick={() => setOpen(true)}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          Feedback
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4 sm:p-8"
          style={{
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            backgroundColor: "rgba(0,0,0,0.50)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleOpenChange(false);
          }}
        >
          <div
            className="relative w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(48px) saturate(160%)",
              WebkitBackdropFilter: "blur(48px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.14)",
              maxHeight: "min(85vh, 640px)",
            }}
          >
            <button
              onClick={() => handleOpenChange(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="px-8 pt-8 pb-5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
            >
              <div className="flex items-center gap-2.5 mb-1">
                <MessageSquare className="h-5 w-5 text-white/75" />
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Share feedback
                </h2>
              </div>
              <p className="text-sm text-white/55 pl-7">
                Help shape the simulator — bugs, ideas, or anything on your
                mind.
              </p>
            </div>

            <div className="flex-1 px-8 py-6 flex flex-col gap-5 overflow-y-auto min-h-0">
              {submitted ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                  <p className="font-semibold text-white text-lg">
                    Thanks for your feedback!
                  </p>
                  <p className="text-sm text-white/55">
                    We read everything and use it to improve the simulator.
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                    onClick={() => handleOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setMessage((prev) =>
                            prev ? prev : p.replace("?", ": "),
                          )
                        }
                        className="rounded-full px-3 py-1 text-xs text-white/55 hover:text-white/90 hover:bg-white/10 transition-colors"
                        style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1">
                    <textarea
                      id="feedback-message"
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Tell us what's on your mind..."
                      className="w-full min-h-[180px] resize-none rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.13)",
                        caretColor: "white",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.border =
                          "1px solid rgba(255,255,255,0.30)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.border =
                          "1px solid rgba(255,255,255,0.13)";
                      }}
                      maxLength={2000}
                    />
                    <div className="flex items-center justify-between">
                      {error ? (
                        <p className="text-xs text-red-400">{error}</p>
                      ) : (
                        <span />
                      )}
                      <span className="text-[11px] text-white/35">
                        {message.length}/2000
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!submitted && (
              <div
                className="px-8 py-5 flex justify-end gap-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
              >
                <Button
                  variant="ghost"
                  className="text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitFeedback}
                  disabled={isSubmitting}
                  className="bg-white/15 hover:bg-white/25 text-white border border-white/20 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {isSubmitting ? "Sending…" : "Send feedback"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
