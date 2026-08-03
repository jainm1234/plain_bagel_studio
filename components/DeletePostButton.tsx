"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isPostOwner,
  removePostEdit,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";

type Author = { id: string; handle: string };

type Props = {
  author?: Author;
  draft: WorkbenchPostDraft;
  className?: string;
};

export default function DeletePostButton({
  author,
  draft,
  className = "workbench-submit-link",
}: Props) {
  const router = useRouter();
  const { user, ready, openLogin } = useWorkbenchAuth();
  const [busy, setBusy] = useState(false);

  const onDelete = useCallback(async () => {
    if (!user) {
      openLogin("log in to delete your post");
      return;
    }
    if (!isPostOwner(user, author)) return;
    const ok = window.confirm(`Delete “${draft.projectName || "this post"}”?`);
    if (!ok) return;

    setBusy(true);
    try {
      const response = await fetch(
        `/api/posts/${encodeURIComponent(draft.postId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        // Seeded / local-only posts: clear local edit and leave the page.
        if (response.status === 404 || response.status === 503) {
          removePostEdit(draft.postId);
          router.push("/work-bench");
          return;
        }
        window.alert(data.error || "Could not delete post");
        return;
      }

      removePostEdit(draft.postId);
      router.push("/work-bench");
    } catch {
      window.alert("Could not delete post");
    } finally {
      setBusy(false);
    }
  }, [author, draft.postId, draft.projectName, openLogin, router, user]);

  if (!ready || !isPostOwner(user, author)) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => void onDelete()}
      disabled={busy}
    >
      {busy ? "deleting…" : "delete"}
    </button>
  );
}
