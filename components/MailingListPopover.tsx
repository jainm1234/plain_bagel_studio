"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "plain-bagel-mailing-list-dismissed";

export default function MailingListPopover() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onWorkbench =
    pathname?.startsWith("/work-bench") ||
    pathname?.startsWith("/projects/note-taker");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (onWorkbench) return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;

    const timer = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [onWorkbench]);

  function dismiss() {
    setOpen(false);
    window.localStorage.setItem(STORAGE_KEY, "1");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/mailing-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          source: "mailing-list",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not save email");
      }
      setDone(true);
      window.setTimeout(dismiss, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save email");
    } finally {
      setBusy(false);
    }
  }

  if (onWorkbench || !open) return null;

  return (
    <div className="mailing-overlay" role="presentation" onClick={dismiss}>
      <div
        className="mailing-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mailing-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="mailing-close"
          onClick={dismiss}
          aria-label="Close"
        >
          ×
        </button>
        <h2 id="mailing-title">join our mailing list</h2>
        <p>be the first to know about new products and publications</p>
        {done ? (
          <p className="mailing-success">you&apos;re on the list</p>
        ) : (
          <form className="mailing-form" onSubmit={(e) => void handleSubmit(e)}>
            <input
              type="email"
              name="email"
              className="mailing-input"
              placeholder="your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              disabled={busy}
            />
            <button type="submit" className="mailing-submit" disabled={busy}>
              {busy ? "…" : "join"}
            </button>
          </form>
        )}
        {error ? <p className="mailing-error">{error}</p> : null}
      </div>
    </div>
  );
}
