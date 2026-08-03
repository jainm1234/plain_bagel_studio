"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WorkbenchEngageBar from "@/components/WorkbenchEngageBar";
import {
  getCommentsForPost,
  type WorkbenchComment,
} from "@/lib/workbenchComments";

type Props = {
  postId: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function WorkbenchComments({ postId }: Props) {
  const [comments, setComments] = useState<WorkbenchComment[]>([]);

  useEffect(() => {
    setComments(getCommentsForPost(postId));
  }, [postId]);

  return (
    <section id="comments" className="workbench-project-section">
      <h2 className="workbench-project-heading">
        comments
        {comments.length > 0 ? (
          <span className="workbench-profile-count"> · {comments.length}</span>
        ) : null}
      </h2>

      {comments.length > 0 ? (
        <ul className="workbench-comments">
          {comments.map((comment) => (
            <li key={comment.id} className="workbench-comment">
              <p className="workbench-comment-meta">
                <Link
                  href={`/work-bench/u/${comment.authorId}`}
                  className="workbench-comment-author"
                >
                  {comment.authorHandle}
                </Link>
                <span> · {formatWhen(comment.createdAt)}</span>
              </p>
              <p className="workbench-comment-body">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="workbench-project-copy">no comments yet — be the first</p>
      )}

      <WorkbenchEngageBar
        postId={postId}
        inputId={`project-comment-${postId}`}
        compact={false}
        showSubmit
        showFire
        onCommentsChange={setComments}
      />
    </section>
  );
}
