"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "plain-bagel-mailing-list-dismissed";

export default function MailingListPopover() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    const subject = encodeURIComponent("Mailing list signup");
    const body = encodeURIComponent(`Please add me to the mailing list.\n\nEmail: ${trimmed}`);
    window.location.href = `mailto:malvika.jain@icloud.com?subject=${subject}&body=${body}`;
    dismiss();
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
        <p>
          be the first to know about new products and publications
        </p>
        <form className="mailing-form" onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            className="mailing-input"
            placeholder="your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
          <button type="submit" className="mailing-submit">
            join
          </button>
        </form>
      </div>
    </div>
  );
}
