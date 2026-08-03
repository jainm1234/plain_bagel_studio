"use client";

import { useCallback } from "react";
import {
  getPostEdit,
  isPostOwner,
  mergePostDraft,
  openWorkbenchEditPost,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";

type Author = { id: string; handle: string };

type Props = {
  author?: Author;
  draft: WorkbenchPostDraft;
  className?: string;
};

export default function EditPostButton({
  author,
  draft,
  className = "workbench-submit-link",
}: Props) {
  const { user, ready, openLogin } = useWorkbenchAuth();

  const onEdit = useCallback(() => {
    if (!user) {
      openLogin("log in to edit your post");
      return;
    }
    if (!isPostOwner(user, author)) return;
    const saved = getPostEdit(draft.postId);
    openWorkbenchEditPost(mergePostDraft(draft, saved));
  }, [author, draft, openLogin, user]);

  if (!ready || !isPostOwner(user, author)) return null;

  return (
    <button type="button" className={className} onClick={onEdit}>
      edit
    </button>
  );
}
