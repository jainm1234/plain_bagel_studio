"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";

export default function WorkbenchAccount() {
  const { user, ready, signOut, openLogin } = useWorkbenchAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  if (!ready) {
    return (
      <span className="workbench-account-trigger workbench-account-trigger--ghost">
        …
      </span>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        className="workbench-account-trigger"
        onClick={() => openLogin("log in")}
      >
        log in
      </button>
    );
  }

  return (
    <div className="workbench-account" ref={ref}>
      <button
        type="button"
        className={
          open
            ? "workbench-account-trigger is-open"
            : "workbench-account-trigger"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {user.handle}
      </button>

      {open ? (
        <div className="workbench-account-menu" role="menu">
          <p className="workbench-account-meta">
            signed in with {user.provider}
          </p>
          <p className="workbench-account-meta">id · {user.id}</p>
          <Link
            href={`/work-bench/u/${user.id}`}
            className="workbench-account-option"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            profile
          </Link>
          <button
            type="button"
            className="workbench-account-option"
            role="menuitem"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
          >
            log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
