"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  message: string;
  error?: string | null;
  onClose: () => void;
  onSignIn: (provider: "apple" | "google") => void;
};

export default function WorkbenchLoginModal({
  message,
  error,
  onClose,
  onSignIn,
}: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="workbench-login-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workbench-login-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="workbench-login-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workbench-login-modal-top">
          <h2 id="workbench-login-title" className="workbench-login-title">
            {message}
          </h2>
          <button
            type="button"
            className="workbench-flow-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="workbench-login-actions">
          <button
            type="button"
            className="workbench-submit-button workbench-submit-button--ghost"
            onClick={() => onSignIn("apple")}
          >
            continue with apple
          </button>
          <button
            type="button"
            className="workbench-submit-button workbench-submit-button--ghost"
            onClick={() => onSignIn("google")}
          >
            continue with google
          </button>
        </div>
        {error ? <p className="workbench-flow-error">{error}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
