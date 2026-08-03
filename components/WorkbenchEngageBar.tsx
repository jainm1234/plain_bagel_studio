"use client";

import WorkbenchCommentComposer from "@/components/WorkbenchCommentComposer";
import WorkbenchFireReaction from "@/components/WorkbenchFireReaction";
import type { WorkbenchComment } from "@/lib/workbenchComments";

type Props = {
  postId: string;
  inputId?: string;
  showSubmit?: boolean;
  showFire?: boolean;
  compact?: boolean;
  /** Same-line fire + input (feed cards). Off = fire above (post page). */
  inlineFire?: boolean;
  onCommentsChange?: (comments: WorkbenchComment[]) => void;
};

export default function WorkbenchEngageBar({
  postId,
  inputId,
  showSubmit = false,
  showFire = true,
  compact = true,
  inlineFire = false,
  onCommentsChange,
}: Props) {
  return (
    <div
      className={
        inlineFire ? "workbench-engage workbench-engage--inline" : "workbench-engage"
      }
    >
      {inlineFire ? (
        <>
          <WorkbenchCommentComposer
            postId={postId}
            compact={compact}
            showSubmit={showSubmit}
            inputId={inputId ?? `comment-${postId}`}
            onCommentsChange={onCommentsChange}
          />
          {showFire ? <WorkbenchFireReaction postId={postId} /> : null}
        </>
      ) : (
        <>
          {showFire ? <WorkbenchFireReaction postId={postId} /> : null}
          <WorkbenchCommentComposer
            postId={postId}
            compact={compact}
            showSubmit={showSubmit}
            inputId={inputId ?? `comment-${postId}`}
            onCommentsChange={onCommentsChange}
          />
        </>
      )}
    </div>
  );
}
