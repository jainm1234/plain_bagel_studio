"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import WorkbenchEngageBar from "@/components/WorkbenchEngageBar";
import EditPostButton from "@/components/EditPostButton";
import {
  getCommentsForPost,
  type WorkbenchComment,
} from "@/lib/workbenchComments";
import { postIdFromHref } from "@/lib/workbenchReactions";
import {
  getPostEdit,
  mergePostDraft,
  type WorkbenchPostDraft,
} from "@/lib/workbenchPostEdits";
import { loadProjectDraft } from "@/lib/workbenchPostDrafts";

type Props = {
  title: string;
  href: string;
  image?: string;
  tags: string[];
  description?: string;
  socialLink?: string;
  comingSoon?: boolean;
  author?: {
    id: string;
    handle: string;
  };
};

function socialLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
    if (host.includes("x.com") || host.includes("twitter")) return "x";
    return host;
  } catch {
    return "social";
  }
}

export default function WorkbenchProjectCard({
  title,
  href,
  image,
  description,
  socialLink,
  comingSoon = false,
  author,
}: Props) {
  const postId = postIdFromHref(href);
  const [comments, setComments] = useState<WorkbenchComment[]>([]);
  const [editDraft, setEditDraft] = useState<WorkbenchPostDraft | null>(null);

  useEffect(() => {
    if (comingSoon) return;
    setComments(getCommentsForPost(postId));
  }, [postId, comingSoon]);

  useEffect(() => {
    if (comingSoon || !author) return;
    let cancelled = false;
    void loadProjectDraft({
      postId,
      title,
      description: description || "",
      socialLink: socialLink || "",
    }).then((base) => {
      if (cancelled || !base) return;
      setEditDraft(mergePostDraft(base, getPostEdit(postId)));
    });
    return () => {
      cancelled = true;
    };
  }, [author, comingSoon, description, postId, socialLink, title]);

  return (
    <article
      className={
        comingSoon ? "workbench-card workbench-card--soon" : "workbench-card"
      }
    >
      <div className="workbench-card-media">
        {image ? (
          comingSoon ? (
            <div className="workbench-card-image">
              <Image
                src={image}
                alt=""
                width={800}
                height={600}
                className="workbench-card-img"
              />
            </div>
          ) : (
            <Link href={href} className="workbench-card-image">
              <Image
                src={image}
                alt=""
                width={800}
                height={600}
                className="workbench-card-img"
              />
            </Link>
          )
        ) : comingSoon ? (
          <div
            className="workbench-card-image workbench-card-image--placeholder"
            aria-hidden="true"
          />
        ) : (
          <Link
            href={href}
            className="workbench-card-image workbench-card-image--placeholder"
            aria-label={`${title} image placeholder`}
          />
        )}
      </div>

      <div className="workbench-card-body">
        <h2 className="workbench-card-title">
          {comingSoon ? (
            <span>
              {title}
              <span className="workbench-card-soon"> coming soon</span>
            </span>
          ) : (
            <Link href={href}>{title}</Link>
          )}
          {author ? (
            <>
              {" "}
              <span className="workbench-card-by">by</span>{" "}
              <Link
                href={`/work-bench/u/${author.id}`}
                className="workbench-card-author"
              >
                {author.handle}
              </Link>
            </>
          ) : null}
          {socialLink ? (
            <>
              {" "}
              <span className="workbench-card-by">on</span>{" "}
              <a
                className="workbench-card-social"
                href={socialLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {socialLabel(socialLink)}
              </a>
            </>
          ) : null}
          {editDraft ? (
            <>
              {" "}
              <EditPostButton
                author={author}
                draft={editDraft}
                className="workbench-card-edit"
              />
            </>
          ) : null}
        </h2>

        {description ? (
          <p className="workbench-card-description">{description}</p>
        ) : null}

        {!comingSoon ? (
          <div className="workbench-card-engage">
            {comments.length > 0 ? (
              <ul className="workbench-card-comments">
                {comments.map((comment) => (
                  <li key={comment.id} className="workbench-card-comment">
                    <Link
                      href={`/work-bench/u/${comment.authorId}`}
                      className="workbench-comment-author"
                    >
                      {comment.authorHandle}
                    </Link>
                    <span className="workbench-card-comment-body">
                      {" "}
                      {comment.body}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <WorkbenchEngageBar
              postId={postId}
              inputId={`card-comment-${postId}`}
              inlineFire
              onCommentsChange={setComments}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
