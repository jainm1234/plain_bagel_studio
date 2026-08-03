"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import {
  addComment,
  getCommentsForPost,
  peekPendingComment,
  setPendingComment,
  takePendingComment,
  type WorkbenchComment,
} from "@/lib/workbenchComments";

type Props = {
  postId: string;
  compact?: boolean;
  showSubmit?: boolean;
  inputId?: string;
  onCommentsChange?: (comments: WorkbenchComment[]) => void;
};

export default function WorkbenchCommentComposer({
  postId,
  compact = false,
  showSubmit = false,
  inputId,
  onCommentsChange,
}: Props) {
  const { user, ready, openLogin } = useWorkbenchAuth();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const postedPending = useRef(false);

  function emitComments() {
    const next = getCommentsForPost(postId);
    onCommentsChange?.(next);
    return next;
  }

  useEffect(() => {
    emitComments();
    const pending = peekPendingComment(postId);
    if (pending) setBody(pending.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    if (!ready || !user || postedPending.current) return;
    const pending = takePendingComment(postId);
    if (!pending) return;

    postedPending.current = true;
    const created = addComment({
      postId,
      body: pending.body,
      authorId: user.id,
      authorHandle: user.handle,
    });

    if (!created) {
      setPendingComment(pending);
      postedPending.current = false;
      setError("couldn’t save that comment — try again");
      setBody(pending.body);
      return;
    }

    setBody("");
    setError("");
    emitComments();
  }, [ready, user, postId]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setError("write something first");
      (compact ? inputRef : textareaRef).current?.focus();
      return;
    }

    if (!user) {
      setPendingComment({ postId, body: text });
      openLogin("log in to leave a comment");
      return;
    }

    const created = addComment({
      postId,
      body: text,
      authorId: user.id,
      authorHandle: user.handle,
    });

    if (!created) {
      setError("couldn’t save that comment — try again");
      return;
    }

    setBody("");
    setError("");
    emitComments();
  }

  return (
    <form
      className={
        compact
          ? "workbench-comment-form workbench-comment-form--compact"
          : "workbench-comment-form"
      }
      onSubmit={onSubmit}
    >
      {compact ? (
        <input
          id={inputId ?? `comment-${postId}`}
          ref={inputRef}
          className="workbench-submit-input"
          type="text"
          placeholder="add a comment…"
          aria-label="add a comment"
          value={body}
          disabled={!ready}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError("");
          }}
        />
      ) : (
        <textarea
          id={inputId ?? `comment-${postId}`}
          ref={textareaRef}
          className="workbench-submit-textarea"
          rows={3}
          placeholder="add a comment…"
          aria-label="add a comment"
          value={body}
          disabled={!ready}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError("");
          }}
        />
      )}

      {error ? <p className="workbench-comment-error">{error}</p> : null}

      {showSubmit ? (
        <div className="workbench-flow-actions">
          <button
            className="workbench-submit-button"
            type="submit"
            disabled={!ready || !body.trim()}
          >
            post comment
          </button>
        </div>
      ) : null}
    </form>
  );
}
